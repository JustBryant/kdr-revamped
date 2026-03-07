require('dotenv').config();
const { Pool } = require('pg');
(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const ids = ['01c1d5f6-b737-453f-aa67-ffdb86b79cfa','22639613-f975-4f2c-b156-334f6389c0fe'];
    const res = await client.query('DELETE FROM "Card" WHERE id = ANY($1::text[]) RETURNING id,name', [ids]);
    console.log('Deleted rows:', res.rows);
  } catch (e) {
    console.error('Delete failed:', e && e.message ? e.message : e);
  } finally {
    client.release();
    await pool.end();
  }
})();
