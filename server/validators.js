// ============================================================
// Validation helpers
// ============================================================
// Centralized validation rules for registration and login so
// the same rules are applied consistently everywhere.
// ============================================================

const validator = require('validator');

function validateRegistration({ fullName, email, phone, password }) {
  const errors = [];

  if (!fullName || validator.isEmpty(fullName.trim())) {
    errors.push('Full name is required.');
  } else if (fullName.trim().length < 2 || fullName.trim().length > 100) {
    errors.push('Full name must be between 2 and 100 characters.');
  }

  if (!email || validator.isEmpty(email.trim())) {
    errors.push('Email is required.');
  } else if (!validator.isEmail(email.trim())) {
    errors.push('Please provide a valid email address.');
  }

  if (!phone || validator.isEmpty(phone.trim())) {
    errors.push('Phone number is required.');
  } else if (!validator.isMobilePhone(phone.trim(), 'any')) {
    errors.push('Please provide a valid phone number.');
  }

  if (!password) {
    errors.push('Password is required.');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number.');
    }
  }

  return errors;
}

function validateLogin({ email, password }) {
  const errors = [];

  if (!email || validator.isEmpty(email.trim())) {
    errors.push('Email is required.');
  } else if (!validator.isEmail(email.trim())) {
    errors.push('Please provide a valid email address.');
  }

  if (!password || validator.isEmpty(password)) {
    errors.push('Password is required.');
  }

  return errors;
}

function sanitizeString(value) {
  return validator.escape(validator.trim(String(value || '')));
}

module.exports = { validateRegistration, validateLogin, sanitizeString };
