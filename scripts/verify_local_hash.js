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
      console.error('Usage: node scripts/verify_local_hash.js <email> <password>')
      process.exit(2)
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const res = await pool.query('SELECT a."password" FROM neon_auth.account a JOIN neon_auth."user" u ON a."userId" = u."id" WHERE u."email" = $1 AND a."providerId" = $2 LIMIT 1', [email, 'credentials'])
    if ((res?.rowCount ?? 0) === 0) {
      console.error('No account row found')
      process.exit(3)
    }
    const hash = res.rows[0].password
    console.log('hash:', hash)
    const ok = await argon2.verify(hash, password)
    console.log('verified:', ok)
    await pool.end()
  } catch (e) {
    console.error('ERROR', e && e.message)
    process.exit(1)
  }
})()
