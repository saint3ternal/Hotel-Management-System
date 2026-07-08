// ============================================================
// PostgreSQL connection pool  (node-postgres / pg)
// ============================================================

require('dotenv').config();
const { Pool } = require('postgres');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }   // required by Neon / Supabase / Railway
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     Number(process.env.DB_PORT) || 5432,
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME     || 'hotel_management',
        ssl: false
      }
);

// Quick startup check
async function testConnection() {
  try {
    const { rows } = await pool.query(
      'SELECT current_database() AS db, current_user AS usr'
    );
    console.log(`✅  PostgreSQL connected — db: ${rows[0].db}, user: ${rows[0].usr}`);
    return true;
  } catch (err) {
    console.error('❌  PostgreSQL connection failed:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection };