require('dotenv').config()
const { Pool } = require('pg')
;(async()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query('UPDATE "User" SET "emailVerified" = now() WHERE email = $1', ['test+local@example.com'])
    console.log('emailVerified set')
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
