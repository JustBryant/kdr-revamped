const { Client } = require('pg');
require('dotenv').config({ path: '.env' });
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT k.id, k.slug, k.status, count(pi.*)::int AS playeritem_count
      FROM "KDR" k
      JOIN "PlayerItem" pi ON pi."kdrId" = k.id
      WHERE k.status = 'DELETED'
      GROUP BY k.id, k.slug, k.status
      ORDER BY playeritem_count DESC
      LIMIT 50
    `);
    if (res.rows.length === 0) {
      console.log('No deleted KDRs with PlayerItem rows found.');
    } else {
      console.log('Deleted KDRs that still have PlayerItem rows:');
      for (const r of res.rows) {
        console.log(`- ${r.id} (slug=${r.slug}) -> ${r.playeritem_count} PlayerItem rows`);
      }
    }
  } catch (e) {
    console.error('Query failed:', e);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
})();
