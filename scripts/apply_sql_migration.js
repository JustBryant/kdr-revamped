#!/usr/bin/env node
const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env' });
(async () => {
  const sqlFile = process.argv[2] || 'prisma/migrations/20260121_add_card_artworks_metadata.sql';
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB, executing SQL from', sqlFile);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('SQL executed successfully');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('SQL execution failed:');
    console.error(err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
})();
