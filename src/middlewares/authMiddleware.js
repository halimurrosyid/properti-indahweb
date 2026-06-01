// Middleware to protect routes from guest users
exports.isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

// Middleware to protect routes from non-admin users
exports.isAdmin = (req, res, next) => {
  if (req.session && req.session.user && (req.session.user.role === 'super_admin' || req.session.user.role === 'admin')) {
    return next();
  }
  res.status(403).send('Akses Ditolak: Halaman ini hanya dapat diakses oleh Administrator.');
};
