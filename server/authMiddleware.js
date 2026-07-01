// ============================================================
// Auth middleware
// ============================================================
// Protects routes that should only be accessible to logged-in
// customers (viewing menu detail, placing orders, etc.)
// ============================================================

function requireAuth(req, res, next) {
  if (req.session && req.session.customerId) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Please log in to continue.' });
}

module.exports = { requireAuth };
