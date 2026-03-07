const fs = require('fs')
const { Pool } = require('pg')
const argon2 = require('argon2')

// Load .env if present
try {
  if (fs.existsSync('.env')) {
    const raw = fs.readFileSync('.env', 'utf8')
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(?:"([^"]*)"|'([^']*)'|(.*))\s*$/)
      if (m) {
        const key = m[1].trim()
        const val = m[2] ?? m[3] ?? m[4] ?? ''
        if (!process.env[key]) process.env[key] = val
      }
    })
  }
} catch (e) {}

;(async ()=>{
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL not set')
      process.exit(2)
    }
    const email = process.argv[2]
    const password = process.argv[3]
    if (!email || !password) {
      console.error('Usage: node scripts/upsert_neon_account.js <email> <password>')
      process.exit(2)
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const userRes = await pool.query('SELECT id FROM neon_auth."user" WHERE email = $1 LIMIT 1', [email])
    if ((userRes?.rowCount ?? 0) === 0) {
      console.error('No neon_auth.user found for email', email)
      process.exit(3)
    }
    const userId = userRes.rows[0].id
    const hashed = await argon2.hash(password)

    const accTable = 'neon_auth.' + '"account"'
    // Try update existing account row first (some installs don't have a unique constraint)
    const updSql = `UPDATE ${accTable} SET "password" = $1, "updatedAt" = now() WHERE "accountId" = $2 AND "providerId" = $3 AND ("password" IS NULL OR "password" = '') RETURNING id`
    const upd = await pool.query(updSql, [hashed, email, 'credentials'])
    if ((upd?.rowCount ?? 0) === 0) {
      const insSql = `INSERT INTO ${accTable} ("accountId","providerId","userId","password","createdAt","updatedAt") VALUES ($1,$2,$3,$4, now(), now())`
      await pool.query(insSql, [email, 'credentials', userId, hashed])
    }
    console.log('Upserted account for', email)
    await pool.end()
  } catch (e) {
    console.error('ERROR', e && e.message)
    process.exit(1)
  }
})()
