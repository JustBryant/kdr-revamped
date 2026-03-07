require('dotenv').config()
const { Pool } = require('pg')
;(async()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const res = await pool.query('SELECT id, email, name, "neonId", "emailVerified" FROM "User" WHERE email = $1 LIMIT 1', ['test+local@example.com'])
    console.log(JSON.stringify(res.rows, null, 2))
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
