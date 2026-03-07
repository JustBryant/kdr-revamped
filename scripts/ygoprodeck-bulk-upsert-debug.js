#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function run() {
  const sampleDirs = [path.join(__dirname, '..', 'data', 'cards'), path.join(__dirname, '..', 'data', 'cards', 'rush')];
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log('Starting debug bulk upsert...');
    await client.query('BEGIN');
    // compute files
    const files = [];
    for (const dir of sampleDirs) {
      if (!fs.existsSync(dir)) continue;
      const list = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      for (const f of list) files.push(path.join(dir, f));
    }
    console.log(`Found ${files.length} sample files`);
    for (let i = 0; i < files.length; i++) {
      const full = files[i];
      const f = path.basename(full);
      process.stdout.write(`Upserting (${i + 1}/${files.length}): ${f}\r`);
      let payload = null;
      try {
        payload = JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch (e) {
        console.error('\nFailed to parse JSON', full, e && e.message);
        await client.query('ROLLBACK');
        throw e;
      }
      try {
        const konamiIdVal = payload.konami_id || payload.konamiId || null;
        const matchName = payload.name || null;
        const metadataObj = Object.assign({}, payload.metadata || {});
        // If payload supplied dedicated pendulum/monster descs, prefer them
        const pendulumFromPayload = payload.pendulum_desc || payload.pendulumDesc || null;
        const monsterFromPayload = payload.monster_desc || payload.monsterDesc || null;

        // If metadata contains a combinedDesc (legacy), attempt to split into pendulum/monster
        let pendulumFromCombined = null;
        let monsterFromCombined = null;
        if (!pendulumFromPayload && !monsterFromPayload && metadataObj && metadataObj.combinedDesc) {
          const combined = (metadataObj.combinedDesc || '').toString();
          // Try to split on common delimiters between pendulum and monster blocks
          const splitMarker = '\n\n['; // fallback heuristic
          if (combined.includes('[ Pendulum')) {
            const pieces = combined.split(/\[\s*Pendulum Effect\s*\]|\[\s*Monster Effect\s*\]/i).map(s => s.trim()).filter(Boolean);
            if (pieces.length === 2) {
              pendulumFromCombined = pieces[0];
              monsterFromCombined = pieces[1];
            }
          } else if (combined.includes('\n\n')) {
            const parts = combined.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
            if (parts.length >= 2) {
              pendulumFromCombined = parts[0];
              monsterFromCombined = parts.slice(1).join('\n\n');
            }
          }
        }

        const isRushVariant = !!(payload.isRush || payload.variant === 'RUSH')

        // Resolve type deterministically:
        // - If explicit `card_type` or `type` provided, use it.
        // - If this is a Rush payload and explicit type is missing, derive from `subtypes` (Trap/Spell/Monster) when possible.
        // - Otherwise leave `type` null so we don't accidentally default to Monster.
        let resolvedType = null
        if (payload.card_type || payload.type) resolvedType = payload.card_type || payload.type
        else if (isRushVariant && Array.isArray(payload.subtypes)) {
          const lowered = payload.subtypes.map(s => (s || '').toString().toLowerCase())
          if (lowered.some(s => s.includes('trap'))) resolvedType = 'Trap'
          else if (lowered.some(s => s.includes('spell'))) resolvedType = 'Spell'
          else if (lowered.some(s => s.includes('monster'))) resolvedType = 'Monster'
        }

        const dbData = {
          variant: isRushVariant ? 'RUSH' : 'TCG',
          konamiId: konamiIdVal || null,
          name: matchName,
          // DB requires `desc` NOT NULL — default to empty string when missing
          desc: (payload.desc !== undefined && payload.desc !== null) ? payload.desc : '',
          type: resolvedType || null,
          frameType: payload.frameType || null,
          subtypes: Array.isArray(payload.subtypes) ? payload.subtypes : [],
          atk: payload.atk || null,
          def: payload.def || null,
          level: payload.level || null,
          race: payload.race || null,
          attribute: payload.attribute || null,
          archetype: payload.archetype || null,
          scale: payload.scale || null,
          linkVal: payload.linkVal || payload.linkval || null,
          linkMarkers: Array.isArray(payload.linkMarkers) ? payload.linkMarkers : (Array.isArray(payload.linkmarkers) ? payload.linkmarkers : []),
          requirement: payload.requirement || null,
          effect: payload.effect || null,
          notes: payload.notes || null,
          artworks: payload.artworks ? JSON.stringify(payload.artworks) : null,
          primaryArtworkIndex: payload.primaryArtworkIndex || null,
          // Write pendulum/monster descriptions into dedicated columns when available
          pendulumDesc: pendulumFromPayload || pendulumFromCombined || null,
          monsterDesc: monsterFromPayload || monsterFromCombined || null,
          metadata: (function() {
            // Remove legacy/duplicate keys from metadata so DB columns hold canonical data
            const m = Object.assign({}, metadataObj || {});
            delete m.pendulumDesc;
            delete m.monsterDesc;
            delete m.combinedDesc;
            return Object.keys(m).length ? JSON.stringify(m) : null;
          })(),
          formats: Array.isArray(payload.formats) ? payload.formats : null
        };

        // detect existing row by konamiId or name
        let existing = null;
        if (dbData.konamiId) {
          const res = await client.query('SELECT id FROM "Card" WHERE "konamiId" = $1 LIMIT 1', [dbData.konamiId]);
          if (res.rows.length) existing = res.rows[0];
        }
        if (!existing) {
          const res2 = await client.query('SELECT id FROM "Card" WHERE name = $1 LIMIT 1', [dbData.name]);
          if (res2.rows.length) existing = res2.rows[0];
        }

        const allowed = ['variant','konamiId','name','desc','type','atk','def','level','race','attribute','archetype','scale','linkVal','linkMarkers','requirement','effect','notes','imageUrlCropped','metadata','artworks','primaryArtworkIndex','formats','subtypes','createdAt','updatedAt','pendulumDesc','monsterDesc'];
        if (existing) {
          const keys = Object.keys(dbData).filter(k => dbData[k] !== undefined && allowed.includes(k));
          const sets = keys.map((k, i) => `"${k}" = $${i + 1}`);
          const values = keys.map(k => dbData[k]);
          values.push(existing.id);
          const q = `UPDATE "Card" SET ${sets.join(', ')} WHERE id = $${values.length}`;
          await client.query(q, values);
        } else {
          try { const crypto = require('crypto'); if (!dbData.id) dbData.id = crypto.randomUUID(); } catch (e) {}
          try { dbData.createdAt = dbData.createdAt || new Date(); dbData.updatedAt = dbData.updatedAt || new Date(); } catch (e) {}
          if (!allowed.includes('id')) allowed.push('id');
          const keys = Object.keys(dbData).filter(k => dbData[k] !== undefined && allowed.includes(k));
          const cols = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map(k => dbData[k]);
          const q = `INSERT INTO "Card" (${cols}) VALUES (${placeholders})`;
          await client.query(q, values);
        }
      } catch (e) {
        console.error('\nDB error while upserting', full, '\n', e && e.stack ? e.stack : e && e.message ? e.message : e);
        try { await client.query('ROLLBACK'); } catch (er) {}
        throw e;
      }
    }
    await client.query('COMMIT');
    console.log('\nDebug bulk upsert completed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Debug runner failed:', err && err.message ? err.message : err);
  process.exit(1);
});
