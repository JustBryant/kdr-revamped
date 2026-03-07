require('dotenv').config();
const { Pool } = require('pg');
(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const sql = `SELECT id, "konamiId", name, "desc" as card_desc, subtypes, "imageUrl" as imageUrl, "primaryArtworkIndex" as primaryArtworkIndex, artworks, "isRush" as isRush, "createdAt" as createdAt, "updatedAt" as updatedAt FROM "Card" ORDER BY "createdAt" DESC LIMIT 5`;
    const res = await client.query(sql);
    const out = res.rows.map(r => ({
      id: r.id,
      konamiId: r.konamiid,
      name: r.name,
      desc: (r.card_desc || '').substring(0, 200),
      subtypes: r.subtypes,
      imageUrl: r.imageurl,
      primaryArtworkIndex: r.primaryartworkindex,
      artworks: r.artworks ? (Array.isArray(r.artworks) ? r.artworks.slice(0,2) : r.artworks) : null,
      isRush: r.isrush,
      createdAt: r.createdat,
      updatedAt: r.updatedat
    }));
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('Query failed:', e && e.message ? e.message : e);
  } finally {
    client.release();
    await pool.end();
  }
})();
