// ============================================================
// MySQL connection pool
// ============================================================
// Centralized place that creates and exports a connection pool
// used by every route/controller in the app.
// ============================================================

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hotel_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Quick helper used at startup to confirm the DB is reachable
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('✅  MySQL connection established.');
    return true;
  } catch (err) {
    console.error('❌  Could not connect to MySQL:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection };
