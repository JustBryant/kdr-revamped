#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    // Timeout after 15s to avoid hanging on a single remote call
    req.setTimeout(15000, () => {
      req.abort();
      reject(new Error('Request timed out after 15s'));
    });
    req.on('error', (err) => reject(err));
  });
}

function extractPendAndMonster(card) {
  let rawDesc = card.desc || null;
  let pendulum_desc = card.pend_desc || card.pendulum_desc || null;
  let monster_desc = card.monster_desc || card.mon_desc || null;

  if ((!pendulum_desc || !monster_desc) && rawDesc) {
    try {
      const d = String(rawDesc).replace(/\r\n?/g, '\n');
      const pendMatch = d.match(/Pendulum Effect[:\s]*([\s\S]*?)(?=\n\s*Monster Effect[:\s]*|$)/i);
      const monMatch = d.match(/Monster Effect[:\s]*([\s\S]*?)(?=\n\s*Pendulum Effect[:\s]*|$)/i);
      if (pendMatch && pendMatch[1] && !pendulum_desc) pendulum_desc = pendMatch[1].trim();
      if (monMatch && monMatch[1] && !monster_desc) monster_desc = monMatch[1].trim();

      const isPendulumInType = (card.typeline && Array.isArray(card.typeline) && card.typeline.map(x=>String(x).toLowerCase()).includes('pendulum')) || (card.type && String(card.type).toLowerCase().includes('pendulum'));
      if ((!pendulum_desc || !monster_desc) && isPendulumInType) {
        const parts = d.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          if (!pendulum_desc) pendulum_desc = parts[0];
          if (!monster_desc) monster_desc = parts.slice(1).join('\n\n');
        }
        // If there are no explicit pendulum/monster sections and the card is pendulum,
        // the API often leaves the monster effect as the full `desc`. Use that as
        // `monster_desc` and ensure `pendulum_desc` is empty.
        if (!pendulum_desc && !monster_desc && d) {
          monster_desc = d.trim();
          pendulum_desc = null;
        }
      }
    } catch (e) {}
  }
  return { pendulum_desc, monster_desc };
}

async function fetchCardByName(name) {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`;
  const json = await httpGetJson(url);
  if (!json || !json.data || json.data.length === 0) throw new Error('No card data returned');
  return json.data[0];
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
  const nameArg = args.find(a => a.startsWith('--name='));
  const singleName = nameArg ? nameArg.split('=')[1] : null;
  const batchArg = args.find(a => a.startsWith('--batch-size='));
  const batchSize = batchArg ? Number(batchArg.split('=')[1]) : 100;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    let res;
    if (singleName) {
      // fetch specific card by name (case-sensitive match on stored name)
      const q1 = `SELECT id, name, "konamiId", "desc", metadata, "pendulumDesc", "monsterDesc" FROM "Card" WHERE name = $1 LIMIT 1`;
      res = await client.query(q1, [singleName]);
    } else {
      // Find candidate cards which look like pendulum but are missing pendulum/monster columns
      const q = `SELECT id, name, "konamiId", "desc", metadata, "pendulumDesc", "monsterDesc" FROM "Card" WHERE ("pendulumDesc" IS NULL OR "monsterDesc" IS NULL) AND (LOWER(COALESCE(type,'')) LIKE '%pendulum%' OR "desc" ILIKE '%Pendulum Effect%')` + (limit ? ` LIMIT ${limit}` : '');
      res = await client.query(q);
    }
    console.log(`Found ${res.rows.length} candidate cards to inspect.`);
    // list the candidate cards so the operator can verify
    for (const row of res.rows) {
      console.log(` - ${row.name} (id=${row.id}, konamiId=${row.konamiId || 'n/a'})`);
    }
    const toUpdate = [];
    for (let ri = 0; ri < res.rows.length; ri++) {
      const row = res.rows[ri];
      let apiCard = null;
      console.log(`Fetching remote card ${ri + 1}/${res.rows.length}: ${row.name}`);
      try {
        // prefer konamiId when available (API supports name query reliably)
        apiCard = await fetchCardByName(row.name);
      } catch (e) {
        console.warn(`Failed to fetch remote card for ${row.name}: ${e && e.message ? e.message : e}`);
        continue;
      }
      const { pendulum_desc, monster_desc } = extractPendAndMonster(apiCard);
      if (pendulum_desc || monster_desc) {
        toUpdate.push({ id: row.id, name: row.name, pendulum_desc, monster_desc });
      }
    }

    console.log(`${toUpdate.length} cards have pendulum/monster text available.`);
    if (!apply) {
      console.log('Dry-run mode (no DB writes). Use --apply to write updates. Sample:');
      console.log(toUpdate.slice(0, 10));
      return;
    }

    console.log(`Applying updates to DB in batches of ${batchSize}...`);
    let updatedCount = 0;
    // Process in batches so we can commit periodically and observe progress
    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batch = toUpdate.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);
      await client.query('BEGIN');
      for (const u of batch) {
        const pend = u.pendulum_desc || null;
        const mon = u.monster_desc || null;
        const q2 = `
          UPDATE "Card" SET
            "pendulumDesc" = $1,
            "monsterDesc" = $2,
            metadata = (CASE
              WHEN (COALESCE(metadata::jsonb, '{}'::jsonb) - 'pendulumDesc' - 'monsterDesc' - 'combinedDesc') = '{}'::jsonb THEN NULL::jsonb
              ELSE (COALESCE(metadata::jsonb, '{}'::jsonb) - 'pendulumDesc' - 'monsterDesc' - 'combinedDesc')
            END)
          WHERE id = $3
        `;
        await client.query(q2, [pend, mon, u.id]);
        updatedCount++;
        if (updatedCount % 25 === 0) console.log(`  Applied ${updatedCount}/${toUpdate.length} updates...`);
      }
      await client.query('COMMIT');
      console.log(`Committed batch ${Math.floor(i / batchSize) + 1}. Total applied: ${updatedCount}/${toUpdate.length}`);
    }
    console.log('All DB updates applied.');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (er) {}
    console.error('Error:', e && e.stack ? e.stack : e);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  // report progress if interrupted
  process.on('SIGINT', () => {
    console.warn('\nInterrupted by user (SIGINT). Exiting.');
    process.exit(130);
  });
  main().catch(err => { console.error(err); process.exit(1); });
}
