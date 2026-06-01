const crypto = require('crypto');

// Generate secure random token
const generateToken = () => {
  return crypto.randomBytes(24).toString('hex');
};

exports.csrfProtection = (req, res, next) => {
  // Ensure session is active
  if (!req.session) {
    return next(new Error('Session is required for CSRF protection.'));
  }

  // Generate token if not exists in session
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken();
  }

  // Make token available to templates/views
  res.locals.csrfToken = req.session.csrfToken;

  // Validate only for state-changing requests
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Fetch token from request body, query or headers
  const reqToken = req.body.csrfToken || 
                   req.query.csrfToken || 
                   req.headers['x-csrf-token'];

  if (!reqToken || reqToken !== req.session.csrfToken) {
    const err = new Error('Keamanan Form Terganggu (Invalid CSRF Token). Silakan muat ulang halaman dan coba lagi.');
    err.status = 403;
    return next(err);
  }

  next();
};
