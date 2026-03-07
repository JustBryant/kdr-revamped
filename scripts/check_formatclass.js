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
    const res1 = await client.query("SELECT to_regclass('public.\"FormatClass\"') AS exists;");
    const res2 = await client.query('SELECT count(*)::int AS count FROM public."FormatClass";');
    console.log('exists:', res1.rows[0].exists);
    console.log('count:', res2.rows[0].count);
    await client.end();
  }catch(err){
    console.error('ERROR:', err.message || err);
    try{ await client.end(); }catch(e){}
    process.exit(3);
  }
}

main();
