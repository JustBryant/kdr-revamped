const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const EMAIL = process.env.TEST_USER_EMAIL || 'test+local@example.com'
const PLAIN = process.env.TEST_USER_PASSWORD || 'TestPass123!'

;(async()=>{
  try {
    const hashed = await bcrypt.hash(PLAIN, 10)
    // Upsert by email: if exists, update password; otherwise insert with a random id
    const id = 'test-' + Math.random().toString(36).slice(2,10)
    const upsert = `INSERT INTO "User" (id, email, name, password, "emailVerified", role) VALUES ($1,$2,$3,$4, null, 'USER') ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password RETURNING id,email`;
    const res = await pool.query(upsert, [id, EMAIL, 'Local Test User', hashed])
    console.log('Upserted user:', res.rows[0])
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
