// ============================================================
// PostgreSQL connection pool
// ============================================================
// Centralized place that creates and exports the shared SQL client
// used by every route/controller in the app.
// ============================================================

require('dotenv').config();

const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL || `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'hotel_management'}`;

const sql = postgres(connectionString, {
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
});

async function testConnection() {
  try {
    const [row] = await sql`SELECT current_database() AS db_name, current_user AS user_name`;
    console.log('Database connection successful.', row);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }
}

module.exports = { sql, testConnection };