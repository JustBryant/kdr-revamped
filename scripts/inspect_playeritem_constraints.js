const { Client } = require('pg');
require('dotenv').config({ path: '.env' });
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query(`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = '"PlayerItem"'::regclass;`);
    console.log('constraints for PlayerItem:');
    for (const r of res.rows) {
      console.log('- %s: %s', r.conname, r.definition);
    }
  } catch (e) {
    console.error('Query failed:', e);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
})();
