#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log('Scanning Rush cards for missing/incorrect `type` values...');
    const res = await client.query(`SELECT id, subtypes, type FROM "Card" WHERE variant = 'RUSH' AND (type IS NULL OR type = '' OR lower(type) = 'monster')`);
    console.log(`Found ${res.rows.length} candidate rows`);
    let fixed = 0;
    for (const row of res.rows) {
      let newType = null;
      try {
        const subs = row.subtypes ? (Array.isArray(row.subtypes) ? row.subtypes : JSON.parse(row.subtypes)) : [];
        const lowered = (subs || []).map(s => (s || '').toString().toLowerCase());
        if (lowered.some(s => s.includes('trap'))) newType = 'Trap';
        else if (lowered.some(s => s.includes('spell'))) newType = 'Spell';
      } catch (e) {
        // malformed subtypes; skip
      }
      if (newType) {
        await client.query('UPDATE "Card" SET "type" = $1, "updatedAt" = $2 WHERE id = $3', [newType, new Date(), row.id]);
        fixed++;
        console.log(`Updated ${row.id} -> ${newType}`);
      }
    }
    console.log(`Completed. Updated ${fixed} rows.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Repair script failed:', err && err.message ? err.message : err);
  process.exit(1);
});
