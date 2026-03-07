require('dotenv').config();
const { Pool } = require('pg');
(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM "Card" WHERE name = $1 LIMIT 1', ['Odd-Eyes Pendulum Dragon']);
    if (!res.rows.length) { console.log('Not found'); return; }
    const row = res.rows[0];
    console.log('Columns present on Card row:');
    console.log(Object.keys(row).sort().join(', '));
    // print specific columns that might exist
    const cols = ['monsterDesc','pendulumDesc','notes','metadata'];
    for (const c of cols) {
      console.log(c + ':', Object.prototype.hasOwnProperty.call(row, c) ? (row[c] === null ? 'NULL' : JSON.stringify(row[c]).substring(0,200)) : '<absent>');
    }
  } catch (e) { console.error('Query failed:', e && e.message ? e.message : e); }
  finally { client.release(); await pool.end(); }
})();
