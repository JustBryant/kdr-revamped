require('dotenv').config();
const { Pool } = require('pg');
(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, "konamiId", name, metadata FROM "Card" WHERE name = $1 LIMIT 1', ['Odd-Eyes Pendulum Dragon']);
    if (!res.rows.length) {
      console.log('No row found for Odd-Eyes Pendulum Dragon');
      return;
    }
    const r = res.rows[0];
    console.log('id:', r.id);
    console.log('konamiId:', r.konamiid);
    console.log('name:', r.name);
    console.log('metadata:', JSON.stringify(r.metadata, null, 2));
  } catch (e) {
    console.error('Query failed:', e && e.message ? e.message : e);
  } finally {
    client.release();
    await pool.end();
  }
})();
