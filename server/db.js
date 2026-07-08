// ============================================================
// PostgreSQL connection (postgres.js / porsager)
// ============================================================

require('dotenv').config();
const postgres = require('postgres');

const sql = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, {
      ssl: 'require' // required by Neon / Supabase / Railway / Render
    })
  : postgres({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hotel_management',
      ssl: false
    });

// Quick startup check
async function testConnection() {
  try {
    const rows = await sql`SELECT current_database() AS db, current_user AS usr`;
    console.log(`✅  PostgreSQL connected — db: ${rows[0].db}, user: ${rows[0].usr}`);
    return true;
  } catch (err) {
    console.error('❌  PostgreSQL connection failed:', err.message);
    return false;
  }
}

module.exports = { sql, testConnection };