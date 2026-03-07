require('dotenv').config();
const { Client } = require('pg');

async function main(){
  const conn = process.env.DATABASE_URL;
  if(!conn){
    console.error('DATABASE_URL not found in .env');
    process.exit(2);
  }
  const client = new Client({ connectionString: conn });
  try{
    await client.connect();

    // Count all classes
    const allRes = await client.query('SELECT count(*)::int AS total FROM "Class"');
    const total = allRes.rows[0].total;

    // Count FormatClass links
    const linkRes = await client.query('SELECT count(*)::int AS links FROM "FormatClass"');
    const links = linkRes.rows[0].links;

    // Count classes linked to kdr format
    const kdrRes = await client.query(`
      SELECT count(*)::int AS kdr_count
      FROM "FormatClass" fc
      JOIN "Format" f ON f.id = fc."formatId"
      WHERE f.slug = 'kdr'
    `);
    const kdrCount = kdrRes.rows[0].kdr_count;

    // List classes with no FormatClass links
    const unlinkedRes = await client.query(`
      SELECT c.id, c.name
      FROM "Class" c
      LEFT JOIN "FormatClass" fc ON fc."classId" = c.id
      WHERE fc.id IS NULL
      ORDER BY c.name
      LIMIT 200
    `);

    console.log('total_classes:', total);
    console.log('total_formatclass_links:', links);
    console.log('kdr_links:', kdrCount);
    console.log('unlinked_classes_count:', unlinkedRes.rowCount);
    if(unlinkedRes.rowCount > 0){
      console.log('unlinked_classes (first 200):');
      unlinkedRes.rows.forEach(r => console.log('-', r.id, r.name));
    }

    await client.end();
  }catch(err){
    console.error('ERROR:', err.message || err);
    try{ await client.end(); }catch(e){}
    process.exit(3);
  }
}

main();
