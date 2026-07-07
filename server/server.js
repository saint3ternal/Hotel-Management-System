// ============================================================
// Server entry point — PostgreSQL + Render deployment
// ============================================================

require('dotenv').config();
const path      = require('path');
const express   = require('express');
const session   = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const { pool, testConnection } = require('./db');
const authRoutes    = require('./authRoutes');
const menuRoutes    = require('./menuRoutes');
const orderRoutes   = require('./orderRoutes');
const kitchenRoutes = require('./kitchenRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Render sits behind a proxy — required for req.ip and secure cookies to work
app.set('trust proxy', 1);

// ── CORS ───────────────────────────────────────────────────
// In production, restrict to the actual Render domain.
// ALLOWED_ORIGIN env var is set in Render dashboard after first deploy.
const corsOrigin = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim())
  : true; // allow all in development

app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Session store — persisted in PostgreSQL ────────────────
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,        // HTTPS-only on Render, plain HTTP in local dev
    sameSite: isProd ? 'lax' : 'strict',
    maxAge: 1000 * 60 * 60 * 2   // 2 hours
  }
}));

// ── Rate limiting ──────────────────────────────────────────
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
}));

// ── API routes ─────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/menu',    menuRoutes);
app.use('/api/orders',  orderRoutes);
app.use('/api/kitchen', kitchenRoutes);

// ── Static frontend ────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/',        (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get('/kitchen', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'kitchen.html')));

// ── Global error handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🏨  Hotel Management running on port ${PORT} [${isProd ? 'production' : 'development'}]`);
  await testConnection();
});