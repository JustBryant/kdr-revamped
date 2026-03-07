const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
;(async()=>{
  try {
    const res = await pool.query('SELECT id, email, name FROM "User" WHERE password IS NOT NULL LIMIT 5')
    console.log(JSON.stringify(res.rows, null, 2))
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
