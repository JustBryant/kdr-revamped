const { Client } = require('pg');
require('dotenv').config({ path: '.env' });
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const totalRes = await client.query(`SELECT count(*)::int AS total FROM "PlayerItem";`);
    const kdrNotNullRes = await client.query(`SELECT count(*)::int AS kdr_not_null FROM "PlayerItem" WHERE "kdrId" IS NOT NULL;`);
    const orphanRes = await client.query(`SELECT count(*)::int AS orphan_kdr_refs FROM "PlayerItem" pi LEFT JOIN "KDR" k ON pi."kdrId"=k.id WHERE pi."kdrId" IS NOT NULL AND k.id IS NULL;`);
    const noKdrNoKdrPlayerRes = await client.query(`SELECT count(*)::int AS no_kdr_no_kdrplayer FROM "PlayerItem" WHERE "kdrId" IS NULL AND "kdrPlayerId" IS NULL;`);
    console.log('PlayerItem counts:');
    console.log(' - total:', totalRes.rows[0].total);
    console.log(' - with kdrId:', kdrNotNullRes.rows[0].kdr_not_null);
    console.log(' - orphan kdr refs (kdrId set but KDR missing):', orphanRes.rows[0].orphan_kdr_refs);
    console.log(' - neither kdrId nor kdrPlayerId set:', noKdrNoKdrPlayerRes.rows[0].no_kdr_no_kdrplayer);
  } catch (e) {
    console.error('Query failed:', e);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
})();
