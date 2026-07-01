// ============================================================
// Auth routes: register, login, logout, session check
// ============================================================
// Every login attempt (successful or not) is recorded in the
// login_attempts table, as required. Accounts lock temporarily
// after repeated failures to slow down brute-force attempts.
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { validateRegistration, validateLogin, sanitizeString } = require('./validators');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const SALT_ROUNDS = 12;

// ------------------------------------------------------------
// POST /api/auth/register
// ------------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    const errors = validateRegistration({ fullName, email, phone, password });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = sanitizeString(fullName);
    const cleanPhone = sanitizeString(phone);

    // Check for an existing account with this email
    const [existing] = await pool.query(
      'SELECT customer_id FROM customers WHERE email = ?',
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please log in instead.'
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO customers (full_name, email, phone, password_hash)
       VALUES (?, ?, ?, ?)`,
      [cleanName, cleanEmail, cleanPhone, passwordHash]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful. You can now log in.',
      customerId: result.insertId
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ------------------------------------------------------------
// POST /api/auth/login
// Validates credentials on every attempt and logs every
// attempt (success or failure) to login_attempts.
// ------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  const errors = validateLogin({ email, password });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const [rows] = await pool.query(
      'SELECT * FROM customers WHERE email = ?',
      [cleanEmail]
    );

    const logAttempt = async (success, customerId = null) => {
      await pool.query(
        `INSERT INTO login_attempts (email, customer_id, success, ip_address)
         VALUES (?, ?, ?, ?)`,
        [cleanEmail, customerId, success, ip]
      );
    };

    if (rows.length === 0) {
      await logAttempt(false);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const customer = rows[0];

    // Check account lock status
    if (customer.locked_until && new Date(customer.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(customer.locked_until) - new Date()) / 60000);
      await logAttempt(false, customer.customer_id);
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to repeated failed attempts. Try again in ${minutesLeft} minute(s).`
      });
    }

    const passwordMatches = await bcrypt.compare(password, customer.password_hash);

    if (!passwordMatches) {
      const newFailedCount = customer.failed_attempts + 1;
      let lockedUntil = null;

      if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60000);
      }

      await pool.query(
        'UPDATE customers SET failed_attempts = ?, locked_until = ? WHERE customer_id = ?',
        [lockedUntil ? 0 : newFailedCount, lockedUntil, customer.customer_id]
      );

      await logAttempt(false, customer.customer_id);

      if (lockedUntil) {
        return res.status(423).json({
          success: false,
          message: `Too many failed attempts. Account locked for ${LOCK_DURATION_MINUTES} minutes.`
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        attemptsRemaining: MAX_FAILED_ATTEMPTS - newFailedCount
      });
    }

    // Successful login: reset failed attempts, log success, start session
    await pool.query(
      'UPDATE customers SET failed_attempts = 0, locked_until = NULL WHERE customer_id = ?',
      [customer.customer_id]
    );
    await logAttempt(true, customer.customer_id);

    req.session.customerId = customer.customer_id;
    req.session.customerName = customer.full_name;

    res.json({
      success: true,
      message: 'Login successful.',
      customer: {
        id: customer.customer_id,
        fullName: customer.full_name,
        email: customer.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ------------------------------------------------------------
// POST /api/auth/logout
// ------------------------------------------------------------
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// ------------------------------------------------------------
// GET /api/auth/session
// Lets the frontend check if the user is currently logged in
// ------------------------------------------------------------
router.get('/session', (req, res) => {
  if (req.session && req.session.customerId) {
    return res.json({
      loggedIn: true,
      customer: { id: req.session.customerId, fullName: req.session.customerName }
    });
  }
  res.json({ loggedIn: false });
});

module.exports = router;
