// ============================================================
// Vercel Serverless Entry Point — PostgreSQL edition
// ============================================================

require('dotenv').config();
const path    = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors    = require('cors');
const rateLimit = require('express-rate-limit');

const { pool, testConnection } = require('../server/db');
const authRoutes    = require('../server/authRoutes');
const menuRoutes    = require('../server/menuRoutes');
const orderRoutes   = require('../server/orderRoutes');
const kitchenRoutes = require('../server/kitchenRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Session store backed by PostgreSQL ─────────────────────
// connect-pg-simple creates a "session" table automatically
// on first run (createTableIfMissing: true).
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
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   1000 * 60 * 60 * 2   // 2 hours
  }
}));

// ── Rate limiting ──────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/auth/login', loginLimiter);

// ── API routes ─────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/menu',    menuRoutes);
app.use('/api/orders',  orderRoutes);
app.use('/api/kitchen', kitchenRoutes);

// ── Page routes ────────────────────────────────────────────
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
);
app.get('/kitchen', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'kitchen.html'))
);

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

// ── Start server when run directly ──────────────────────────
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, async () => {
    console.log(`✅  Server running on http://localhost:${port}`);
    await testConnection();
  });
}

// ── Export for Vercel ──────────────────────────────────────
module.exports = app;