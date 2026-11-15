const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ message: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
}

function requireCustomer(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role && req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access required.' });
    return next();
  });
}

function requireAgent(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'agent') return res.status(403).json({ message: 'Agent access required.' });
    return next();
  });
}

module.exports = { requireAuth, requireCustomer, requireAgent };
