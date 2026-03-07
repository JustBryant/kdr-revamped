const fs = require('fs')
const { Pool } = require('pg')

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
    if (!email) {
      console.error('Usage: node scripts/test_neon_user.js <email>')
      process.exit(2)
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const sql = `SELECT u."id" as id, u."email" as email, u."emailVerified" as emailVerified, a."password" as account_password, a."providerId" as providerId FROM neon_auth."user" u LEFT JOIN neon_auth.account a ON a."userId" = u."id" AND a."providerId" = $2 WHERE u."email" = $1 LIMIT 1`
    const res = await pool.query(sql, [email, 'credentials'])
    console.log(JSON.stringify(res.rows, null, 2))
    await pool.end()
  } catch (e) {
    console.error('ERROR', e && e.message)
    process.exit(1)
  }
})()
