const fs = require('fs')
const { Pool } = require('pg')

// Load .env into process.env if present (simple parser)
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
} catch (e) {
  // ignore
}

(async ()=>{
  try {
    if (!process.env.DATABASE_URL) {
      console.error('ERROR: DATABASE_URL not set in environment or .env')
      process.exit(2)
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const res = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='neon_auth' ORDER BY table_name, ordinal_position")
    console.log(JSON.stringify(res.rows, null, 2))
    await pool.end()
  } catch (e) {
    console.error('ERROR', e && e.message)
    process.exit(1)
  }
})()
