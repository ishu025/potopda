const { verifyToken } = require('../utils/auth');

// Reads the "token" cookie (if any) on every request and attaches the
// decoded user to req.user. Does NOT block the request — many routes
// (viewing files, viewing comments) work fine for logged-out visitors.
function attachUser(req, res, next) {
  const token = req.cookies && req.cookies.token;
  req.user = token ? verifyToken(token) : null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Please log in first.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only.' });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
