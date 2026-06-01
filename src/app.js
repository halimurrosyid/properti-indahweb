const express = require('express');
const path = require('path');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const pageRouter = require('./routers/pageRouter');
const authRouter = require('./routers/authRouter');
const listingRouter = require('./routers/listingRouter');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup View Engine with EJS Layouts
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('layout', 'layout'); // Point to views/layout.ejs

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'properti_indahweb_session_secret_key_123456',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Set global template variables (res.locals)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.canonicalUrl = req.protocol + '://' + req.get('host') + req.originalUrl.split('?')[0];
  next();
});

// App Routes
app.use('/', pageRouter);
app.use('/auth', authRouter);
app.use('/property', listingRouter);


// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Terjadi kesalahan pada server! Hubungi Admin.');
});

module.exports = app;
