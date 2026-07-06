// ============================================================
// Kitchen staff auth middleware
// ============================================================
// The dashboard uses a separate staff session (not tied to a
// customer account). Staff authenticate with a PIN code stored
// in the environment variable KITCHEN_PIN.
// ============================================================
 
const KITCHEN_PIN = process.env.KITCHEN_PIN || '1234';
 
function requireStaff(req, res, next) {
  if (req.session && req.session.isStaff === true) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Staff authentication required.' });
}
 
function staffLogin(req, res) {
  const { pin } = req.body;
  if (!pin || String(pin) !== String(KITCHEN_PIN)) {
    return res.status(401).json({ success: false, message: 'Incorrect PIN. Try again.' });
  }
  req.session.isStaff = true;
  res.json({ success: true });
}
 
function staffLogout(req, res) {
  req.session.isStaff = false;
  res.json({ success: true });
}
 
module.exports = { requireStaff, staffLogin, staffLogout };
 
