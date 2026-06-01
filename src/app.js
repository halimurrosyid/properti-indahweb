const express = require('express');
const path = require('path');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const pageRouter = require('./routers/pageRouter');
const authRouter = require('./routers/authRouter');
const listingRouter = require('./routers/listingRouter');
const publicBlogRouter = require('./routers/publicBlogRouter');
const adminBlogRouter = require('./routers/adminBlogRouter');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Trust proxy (necessary for express-rate-limit behind reverse proxies like Dokploy/CloudPanel)
app.set('trust proxy', 1);

// ====================================================
// Security Middlewares
// ====================================================

// Helmet: HTTP security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rate Limiter: Auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate Limiter: General API / form endpoints
const generalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100,
  message: 'Terlalu banyak request. Silakan coba lagi beberapa saat.',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply general limiter to all routes
app.use(generalLimiter);

// ====================================================
// View Engine Setup
// ====================================================
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('layout', 'layout'); // views/layout.ejs

// ====================================================
// Body Parsing & Static Files
// ====================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ====================================================
// Session Configuration
// ====================================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'properti_indahweb_session_secret_key_123456',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true,               // Prevent XSS cookie theft
    secure: isProd,               // HTTPS only in production
    sameSite: 'lax'               // CSRF protection
  }
}));

// ====================================================
// Global Template Variables
// ====================================================
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.canonicalUrl = req.protocol + '://' + req.get('host') + req.originalUrl.split('?')[0];
  next();
});

// ====================================================
// Application Routes
// ====================================================
app.use('/', pageRouter);
app.use('/auth', authLimiter, authRouter);   // Apply stricter rate limiting to auth
app.use('/property', listingRouter);
app.use('/artikel', publicBlogRouter);
app.use('/admin/blog', adminBlogRouter);

// ====================================================
// 404 Handler (must be after all routes)
// ====================================================
app.use((req, res) => {
  res.status(404).render('pages/404', {
    title: 'Halaman Tidak Ditemukan',
    description: 'Halaman yang Anda cari tidak ada.'
  });
});

// ====================================================
// 500 Error Handler
// ====================================================
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message || err);
  res.status(err.status || 500).render('pages/500', {
    title: 'Terjadi Kesalahan Server',
    description: 'Server mengalami masalah. Silakan coba lagi.',
    errorMessage: isProd ? null : (err.stack || err.message)
  });
});

module.exports = app;
