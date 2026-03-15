require('dotenv').config();
const { Pool } = require('pg');
(async ()=>{
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    const migrations = await client.query('SELECT id, migration_name, started_at, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 50');
    console.log('MIGRATIONS:', JSON.stringify(migrations.rows, null, 2));

    const locks = await client.query(`SELECT l.locktype, l.mode, l.granted, p.pid, p.usename, p.query, p.query_start
      FROM pg_locks l
      LEFT JOIN pg_stat_activity p ON l.pid = p.pid
      ORDER BY p.query_start DESC NULLS LAST LIMIT 200`);
    console.log('LOCKS:', JSON.stringify(locks.rows, null, 2));

    const active = await client.query(`SELECT pid, usename, application_name, client_addr, state, query, query_start
      FROM pg_stat_activity WHERE state <> 'idle' ORDER BY query_start DESC LIMIT 200`);
    console.log('ACTIVE:', JSON.stringify(active.rows, null, 2));
  } catch (e) {
    console.error('Query failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
