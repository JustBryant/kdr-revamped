#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
// load .env so Prisma/DB URL is available when writing to site DB
try { require('dotenv').config(); } catch (e) {}

async function fetchCard(name) {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (!json.data || json.data.length === 0) throw new Error('No card data returned');
  return json.data[0];
}

function normalizeTypeline(typeline) {
  if (!typeline) return [];
  const canon = {
    tuner: 'tuner',
    flip: 'flip',
    gemini: 'gemini',
    pendulum: 'pendulum',
    link: 'link',
    synchro: 'synchro',
    xyz: 'xyz',
    ritual: 'ritual',
    fusion: 'fusion',
    toon: 'toon',
    effect: 'effect',
    token: 'token',
    spirit: 'spirit'
  };
  return typeline.map(t => {
    const key = String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
    return canon[key] || String(t).trim();
  });
}

function buildPayload(card) {
  const typeline = card.typeline || [];
  const subtypes = normalizeTypeline(typeline);
  const images = card.card_images || [];
  const primary = images[0] || {};

  // attempt to pull pendulum/monster-specific effect text when possible
  let rawDesc = card.desc || null;
  let pendulum_desc = card.pend_desc || card.pendulum_desc || null;
  let monster_desc = card.monster_desc || card.mon_desc || null;

  if ((!pendulum_desc || !monster_desc) && rawDesc) {
    try {
      const d = String(rawDesc).replace(/\r\n?/g, '\n');
      // first try explicit headings like "Pendulum Effect" / "Monster Effect"
      const pendMatch = d.match(/Pendulum Effect[:\s]*([\s\S]*?)(?=\n\s*Monster Effect[:\s]*|$)/i);
      const monMatch = d.match(/Monster Effect[:\s]*([\s\S]*?)(?=\n\s*Pendulum Effect[:\s]*|$)/i);
      if (pendMatch && pendMatch[1] && !pendulum_desc) pendulum_desc = pendMatch[1].trim();
      if (monMatch && monMatch[1] && !monster_desc) monster_desc = monMatch[1].trim();

      // If headings not present but this is a pendulum card, try splitting on double newlines
      const isPendulumInType = (card.typeline && Array.isArray(card.typeline) && card.typeline.map(x=>String(x).toLowerCase()).includes('pendulum')) || (card.type && String(card.type).toLowerCase().includes('pendulum'));
      if ((!pendulum_desc || !monster_desc) && isPendulumInType) {
        const parts = d.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          if (!pendulum_desc) pendulum_desc = parts[0];
          if (!monster_desc) monster_desc = parts.slice(1).join('\n\n');
        }
        // If there are no explicit pendulum/monster sections and the card is pendulum,
        // the API sometimes puts the monster effect into `desc` only. In that case
        // prefer using the full desc as `monster_desc` and leave `pendulum_desc` empty.
        if (!pendulum_desc && !monster_desc && d) {
          monster_desc = d.trim();
          pendulum_desc = null;
        }
      }
    } catch (e) {
      // ignore parse errors and continue with whatever we have
    }
  }

  return {
    konamiId: card.id || null,
    name: card.name || null,
    // prefer separated pendulum/monster descs when available
    desc: rawDesc || null,
    pendulum_desc,
    monster_desc,
    type: card.type || null,
    frameType: card.frameType || null,
    subtypes,
    race: card.race || null,
    attribute: card.attribute || null,
    atk: ('atk' in card) ? card.atk : null,
    def: ('def' in card) ? card.def : null,
    level: ('level' in card) ? card.level : null,
    archetype: card.archetype || null,
    scale: ('scale' in card) ? card.scale : null,
    linkVal: card.linkval || card.linkVal || null,
    linkMarkers: card.linkmarkers || card.link_markers || null,
    artworks: images,
    primaryArtworkIndex: 0,
    imageUrl: primary.image_url || primary.imageUrl || null,
    imageUrlSmall: primary.image_url_small || primary.image_url_small || null,
    imageUrlCropped: primary.image_url_cropped || primary.image_url_cropped || null,
    ygoprodeckUrl: card.ygoprodeck_url || null
  };
}

const { execSync } = require('child_process');

async function fetchAllApiCards() {
  const url = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
  console.log('Fetching all cards from YGOPRODeck API...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (!json.data) throw new Error('Invalid API response');
  return json.data;
}

function runCmd(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

async function ensureImagesRepo(localPath, repoUrl) {
  const fs = require('fs');
  if (!fs.existsSync(localPath)) {
    console.log(`Cloning images repo into ${localPath}`);
    runCmd(`git clone ${repoUrl} "${localPath}"`);
  } else {
    console.log(`Pulling latest in images repo at ${localPath}`);
    runCmd(`git -C "${localPath}" pull --ff-only`);
  }
}

async function ensureYamlRepo(localPath, repoUrl) {
  const fs = require('fs');
  if (!fs.existsSync(localPath)) {
    console.log(`Cloning yaml-yugi repo into ${localPath}`);
    runCmd(`git clone ${repoUrl} "${localPath}"`);
  } else {
    console.log(`Pulling latest in yaml-yugi repo at ${localPath}`);
    runCmd(`git -C "${localPath}" pull --ff-only`);
  }
}

async function ensureSourceRepo(localPath, repoUrl, name) {
  const fs = require('fs');
  if (!fs.existsSync(localPath)) {
    console.log(`Cloning ${name} repo into ${localPath}`);
    runCmd(`git clone ${repoUrl} "${localPath}"`);
  } else {
    console.log(`Pulling latest in ${name} repo at ${localPath}`);
    runCmd(`git -C "${localPath}" pull --ff-only`);
  }
}

function findRushCardInYaml(name, yamlLocal) {
  const fs = require('fs');
  const p = require('path');
  const tryDirs = [p.join(yamlLocal, 'data', 'rush'), p.join(yamlLocal, 'data', 'cards')];
  const target = String(name).toLowerCase();
  for (const dir of tryDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const full = p.join(dir, f);
        const j = JSON.parse(fs.readFileSync(full, 'utf8'));
        // gather possible english name variations
        const namesToCheck = [];
        if (j.name && typeof j.name === 'string') namesToCheck.push(j.name);
        if (j.name && typeof j.name === 'object') {
          if (j.name.en) namesToCheck.push(j.name.en);
          for (const v of Object.values(j.name)) namesToCheck.push(v);
        }
        if (j.names && typeof j.names === 'object') {
          for (const v of Object.values(j.names)) namesToCheck.push(v);
        }
        if (j.name_en) namesToCheck.push(j.name_en);
        if (j.english_name) namesToCheck.push(j.english_name);
        // also check top-level english-like fields
        if (j.names && j.names.en) namesToCheck.push(j.names.en);

        for (const cand of namesToCheck) {
          if (!cand) continue;
          if (String(cand).toLowerCase() === target) return j;
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }
  return null;
}

function findFileInRepo(repoRoot, filename) {
  const fs = require('fs');
  const p = require('path');
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = p.join(dir, e.name);
      if (e.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (e.isFile() && e.name === filename) {
        return full;
      }
    }
    return null;
  };
  return walk(repoRoot);
}

function findAnyFileStartingWith(repoRoot, start) {
  const fs = require('fs');
  const p = require('path');
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = p.join(dir, e.name);
      if (e.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (e.isFile() && e.name && (e.name === start || e.name.startsWith(start + '.') || e.name.startsWith(start + '-'))) {
        return full;
      }
    }
    return null;
  };
  return walk(repoRoot);
}

function runSqliteJson(cdbPath, sql) {
  // use sqlite3 CLI to get JSON output; relay errors
  try {
    const cmd = `sqlite3 -json ${cdbPath} "${sql.replace(/"/g, '\\"')}"`;
    const out = execSync(cmd, { encoding: 'utf8' }).trim();
    if (!out) return [];
    return JSON.parse(out);
  } catch (err) {
    throw new Error(`sqlite3 query failed: ${err && err.message ? err.message : err}`);
  }
}

function mapAttributeNumeric(v) {
  const attr_map = {1:'EARTH',2:'WATER',4:'FIRE',8:'WIND',16:'LIGHT',32:'DARK',64:'DIVINE'};
  if (v == null) return null;
  const names = Object.entries(attr_map).filter(([bit]) => (v & Number(bit))).map(([,name]) => name);
  if (names.length === 0) return String(v);
  return names.length === 1 ? names[0] : names;
}

function mapRaceNumeric(v) {
  const race_map = {1:'Warrior',2:'Spellcaster',4:'Fairy',8:'Fiend',16:'Zombie',32:'Machine',64:'Aqua',128:'Pyro',256:'Rock',512:'Winged Beast',1024:'Plant',2048:'Insect',4096:'Thunder',8192:'Dragon',16384:'Beast',32768:'Beast-Warrior',65536:'Dinosaur',131072:'Fish',262144:'Sea Serpent',524288:'Reptile',1048576:'Psychic',2097152:'Divine-Beast',4194304:'Creator God',8388608:'Wyrm',16777216:'Cyberse'};
  if (v == null) return null;
  const names = Object.entries(race_map).filter(([bit]) => (v & Number(bit))).map(([,name]) => name);
  if (names.length === 0) return String(v);
  return names.length === 1 ? names[0] : names;
}

function mapTypeNumeric(v) {
  if (v == null) return [];
  const type_map = {
    1: 'monster', 2: 'spell', 4: 'trap',
    16: 'normal', 32: 'effect', 64: 'fusion', 128: 'ritual',
    256: 'trapmonster', 512: 'spirit', 1024: 'union', 2048: 'gemini',
    4096: 'tuner', 8192: 'synchro', 16384: 'token', 32768: 'quickplay',
    65536: 'continuous', 131072: 'equip', 262144: 'field', 524288: 'counter',
    1048576: 'flip', 2097152: 'toon', 4194304: 'xyz', 8388608: 'pendulum',
    16777216: 'link'
  };
  const names = Object.entries(type_map).filter(([bit]) => (v & Number(bit))).map(([,name]) => name);
  return names;
}

async function downloadImage(url, dest) {
  const fs = require('fs');
  const dir = require('path').dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(dest)) {
    return false; // already exists
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
  return true;
}

function filenameFromUrl(url, defaultName) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    const name = parts[parts.length - 1];
    if (name) return name;
  } catch (e) {}
  return defaultName;
}

async function run(names, options = {}) {
  const imagesRepoUrl = options.imagesRepoUrl || 'https://github.com/JustBryant/KDR-Revamped-Images.git';
  const imagesLocal = options.imagesLocal || require('path').resolve(__dirname, '..', 'KDR-Revamped-Images');
  const doPush = !!options.push;
  const apiDataMap = options.apiDataMap || new Map();
  if (options.ensureRepo) await ensureImagesRepo(imagesLocal, imagesRepoUrl);

  // load or init manifest mapping remote URL -> saved filename
  const fs = require('fs');
  const manifestPath = require('path').join(imagesLocal, 'manifest.json');
  let manifest = {};
  try {
    if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) || {};
  } catch (e) {
    console.warn('Failed to load manifest, continuing with empty manifest');
    manifest = {};
  }

  const showProgress = !!options.showProgress;
  for (let _idx = 0; _idx < names.length; _idx++) {
    const name = names[_idx];
    try {
      if (showProgress) {
        process.stdout.write(`Collecting: ${_idx + 1}/${names.length} - ${String(name).replace(/\r|\n/g,' ')}\r`);
      } else {
        console.log(`Fetching: ${name}`);
      }
      let card;
      let payload;
      if (options.rush) {
        // rush branch (CDB-only): prepare variables for artwork handling
         // Rush branch: use CDB-only processing (YAML fallback removed)
         // prepare source repos for artwork copying if requested
         const rushHdLocal = options.rushHdLocal || require('path').resolve(__dirname, '..', 'Rush-HD-Pictures');
         const orrLocal = options.orrLocal || require('path').resolve(__dirname, '..', 'Rush-HD-ORR-Extension');
         if (options.ensureRepo) {
           const rushHdRepoUrl = options.rushHdRepoUrl || 'https://github.com/Yoshi80/Rush-HD-Pictures.git';
           const orrRepoUrl = options.orrRepoUrl || 'https://github.com/Yoshi80/Rush-HD-ORR-Extension.git';
           await ensureSourceRepo(rushHdLocal, rushHdRepoUrl, 'Rush-HD-Pictures');
           await ensureSourceRepo(orrLocal, orrRepoUrl, 'Rush-HD-ORR-Extension');
         }

        // Build rush-formatted payload (English-only)
        let rushPayload = {};
        if (!options.cdbOnly) {
          // Build minimal rush payload (do not include a legacy `images` array)
          rushPayload = {
            konami_id: card.konami_id || card.password || card.konamiId || null,
            name: (card.name && (card.name.en || card.name_en)) || (card.names && card.names.en) || (typeof card.name === 'string' ? card.name : null) || name,
            requirement: (card.requirement && card.requirement.en) || null,
            effect: (card.effect && card.effect.en) || null,
            notes: (card.notes && card.notes.en) || card.notes || null,
            card_type: card.card_type || card.type || null,
            // removed monster_type_line (not used)
            attribute: card.attribute || null,
            level: card.level || null,
            atk: card.atk || null,
            def: card.def || null,
            yugipedia_page_id: card.yugipedia_page_id || null
          };
        }

        // Build artworks using CDB when requested, or fall back to pre-generated CDB JSON
        try {
          const cdbPath = options.cdbPath || '/tmp/cards-rush.cdb';
          let idList = [];
          if (options.cdbOnly) {
            if (!fs.existsSync(cdbPath)) throw new Error(`CDB not found at ${cdbPath}`);
            const safeName = String(name).replace(/'/g, "''");
            let rows = runSqliteJson(cdbPath, `SELECT id,name,desc FROM texts WHERE LOWER(name)=LOWER('${safeName}') ORDER BY id`);
            if (!rows || rows.length === 0) rows = runSqliteJson(cdbPath, `SELECT id,name,desc FROM texts WHERE name LIKE '%${safeName}%' ORDER BY id`);
            if (!rows || rows.length === 0) throw new Error(`Card not found in CDB: ${name}`);
            const ids = rows.map(r => r.id).sort((a,b) => a-b);
            idList = ids;
            // refresh rushPayload using CDB datas
            const primary = ids[0];
            const dataRow = runSqliteJson(cdbPath, `SELECT atk,def,level,attribute,race,type,id FROM datas WHERE id=${primary}`)[0] || {};
            const desc = rows.find(r => r.id === primary).desc || null;
            let req = null, eff = null, notes = null;
            if (desc) {
              // normalize CR/LF variants to LF so regexes and replacements behave consistently
              let d = String(desc).replace(/\r\n?/g, '\n');
              const reqMatch = d.match(/\[REQUIREMENT\]\s*([\s\S]*?)(?:\[EFFECT\]|$)/i);
              const effMatch = d.match(/\[EFFECT\]\s*([\s\S]*)/i);
              if (reqMatch) req = reqMatch[1].trim();
              if (effMatch) eff = effMatch[1].trim();
              // remove matched blocks via regex to avoid substring/overlap fragility
              // remove effect block first, then requirement
              d = d.replace(/\[EFFECT\][\s\S]*/i, '');
              d = d.replace(/\[REQUIREMENT\][\s\S]*?(?:\[EFFECT\]|$)/i, '');
              d = d.trim();
              // If requirement present but no explicit [EFFECT] block, treat leftover as effect
              if (!eff && req && d) {
                eff = d;
                d = '';
              }
              // If no explicit markers present, treat the whole desc as notes (do not assume it's an effect)
              if (!req && !eff && d) {
                notes = d;
                d = '';
              }
              if (d) notes = d;
            }
            rushPayload = {
              konami_id: primary,
              name: rows.find(r => r.id === primary).name,
              requirement: req,
              effect: eff,
              notes: notes || null,
              card_type: 'Monster',
              // removed monster_type_line (not used)
              attribute: mapAttributeNumeric(dataRow.attribute),
              race: mapRaceNumeric(dataRow.race),
              subtypes: mapTypeNumeric(dataRow.type),
              level: dataRow.level || null,
              atk: dataRow.atk || null,
              def: dataRow.def || null,
              
            };
          } else {
            const normName = String(name).replace(/[^a-z0-9]/gi, '_');
            const cdbJsonPath = require('path').join(__dirname, '..', 'data', 'cards', 'rush', `rush-cdb-${normName}.json`);
            let cdbJson = null;
            if (fs.existsSync(cdbJsonPath)) {
              try { cdbJson = JSON.parse(fs.readFileSync(cdbJsonPath, 'utf8')); } catch(e) { cdbJson = null; }
            }
            if (cdbJson && cdbJson.konami_id) idList.push(cdbJson.konami_id);
            if (cdbJson && Array.isArray(cdbJson.alternate_artwork_ids)) idList.push(...cdbJson.alternate_artwork_ids);
            if (idList.length === 0 && rushPayload.konami_id) idList.push(rushPayload.konami_id);
          }

          // locate and (if needed) copy images for each id
          const foundMap = new Map();
          const folders = ['full_rush_orr', 'full_rush'];
          const rushHdLocal = options.rushHdLocal || require('path').resolve(__dirname, '..', 'Rush-HD-Pictures');
          const orrLocal = options.orrLocal || require('path').resolve(__dirname, '..', 'Rush-HD-ORR-Extension');
          for (const idVal of idList) {
            if (!idVal) continue;
            const idStr = String(idVal);
            for (const folder of folders) {
              const folderPath = require('path').join(imagesLocal, folder);
              if (!fs.existsSync(folderPath)) continue;
              const entries = fs.readdirSync(folderPath);
              for (const e of entries) {
                if (!e) continue;
                const base = require('path').basename(e);
                if (base === idStr || base.startsWith(idStr + '.') || base.startsWith(idStr + '-')) {
                  const rel = require('path').join(folder, base);
                  const rawBase = (imagesRepoUrl || '').replace(/^https:\/\/github.com\//, 'https://raw.githubusercontent.com/').replace(/\.git$/, '') + '/main';
                  const url = rawBase + '/' + rel.replace(/^\/+/, '');
                  const key = idStr;
                  const existing = foundMap.get(key) || { id: idVal };
                  if (folder === 'full_rush_orr') existing.image_full_orr = url; else existing.image_full = url;
                  foundMap.set(key, existing);
                }
              }
            }
            // if not found locally, search source repos and copy into images repo
            if (!foundMap.has(idStr) && options.ensureRepo) {
              let foundPath = null;
              if (fs.existsSync(orrLocal)) foundPath = findAnyFileStartingWith(orrLocal, idStr);
              if (foundPath) {
                const destFolder = require('path').join(imagesLocal, 'full_rush_orr');
                if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                const dest = require('path').join(destFolder, require('path').basename(foundPath));
                try { fs.copyFileSync(foundPath, dest); } catch(e) {}
                const rel = require('path').join('full_rush_orr', require('path').basename(foundPath));
                const rawBase = (imagesRepoUrl || '').replace(/^https:\/\/github.com\//, 'https://raw.githubusercontent.com/').replace(/\.git$/, '') + '/main';
                const url = rawBase + '/' + rel.replace(/^\/+/, '');
                foundMap.set(idStr, { id: idVal, image_full_orr: url });
                continue;
              }
              if (fs.existsSync(rushHdLocal)) {
                foundPath = findAnyFileStartingWith(rushHdLocal, idStr);
                if (foundPath) {
                  const destFolder = require('path').join(imagesLocal, 'full_rush');
                  if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                  const dest = require('path').join(destFolder, require('path').basename(foundPath));
                  try { fs.copyFileSync(foundPath, dest); } catch(e) {}
                  const rel = require('path').join('full_rush', require('path').basename(foundPath));
                  const rawBase = (imagesRepoUrl || '').replace(/^https:\/\/github.com\//, 'https://raw.githubusercontent.com/').replace(/\.git$/, '') + '/main';
                  const url = rawBase + '/' + rel.replace(/^\/+/, '');
                  foundMap.set(idStr, { id: idVal, image_full: url });
                }
              }
            }
          }
          const foundArtworks = Array.from(foundMap.values());
          if (foundArtworks.length > 0) {
            rushPayload.artworks = foundArtworks;
          } else {
            rushPayload.artworks = [];
          }
        } catch (e) {
          console.warn('Failed to build rush artworks from CDB/images:', e && e.message ? e.message : e);
        }

        // assign payload to rushPayload for downstream processing/writing
        payload = rushPayload;
      } else {
        if (apiDataMap.has(name)) {
          card = apiDataMap.get(name);
        } else {
          card = await fetchCard(name);
        }
        payload = buildPayload(card);
      }
      const defaultOutDir = options.rush ? path.join(__dirname, '..', 'data', 'cards', 'rush') : path.join(__dirname, '..', 'data', 'cards');
      const outDir = options.outDir ? require('path').resolve(options.outDir) : defaultOutDir;
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const prefix = options.rush ? 'rush-' : '';
      const outPath = path.join(outDir, `${prefix}sample-${name.replace(/[^a-z0-9]/gi, '_')}.json`);

      // If user requested pendulum-only, skip any non-pendulum cards
      const isPendulumCard = (() => {
        try {
          // payload.subtypes may contain normalized typeline entries
          if (payload && Array.isArray(payload.subtypes) && payload.subtypes.map(s => String(s).toLowerCase()).includes('pendulum')) return true;
          if (payload && payload.type && String(payload.type).toLowerCase().includes('pendulum')) return true;
          // raw API `card` object may contain typeline/desc markers
          if (card) {
            if (Array.isArray(card.typeline) && card.typeline.map(s => String(s).toLowerCase()).includes('pendulum')) return true;
            if (card.type && String(card.type).toLowerCase().includes('pendulum')) return true;
            // also look for 'Pendulum Effect' marker in the description
            if (card.desc && String(card.desc).toLowerCase().includes('pendulum effect')) return true;
          }
        } catch (e) {}
        return false;
      })();

      if (options.pendulumOnly && !isPendulumCard) {
        if (showProgress) process.stdout.write(`Skipping non-pendulum: ${name}\n`);
        continue;
      }

      // image download: map image fields to folders (TCG-only)
      if (options.ensureRepo && !options.rush) {
        const images = card.card_images || [];
        for (const img of images) {
          const id = String(card.id || payload.konamiId || 'unknown');
          // variants
          const mappings = [
            { url: img.image_url, folder: 'full_tcg' },
            { url: img.image_url_small, folder: 'small_tcg' },
            { url: img.image_url_cropped, folder: 'cropped_tcg' }
          ];
          for (const m of mappings) {
            if (!m.url) continue;
            // if this URL is already recorded in the manifest, skip downloading
            if (manifest[m.url]) {
              console.log(`URL already recorded in manifest, skipping: ${m.url} -> ${manifest[m.url]}`);
              continue;
            }
            const origName = filenameFromUrl(m.url, `${id}.jpg`);
            const folderPath = require('path').join(imagesLocal, m.folder);
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            let saveName = origName || `${id}${require('path').extname(origName) || '.jpg'}`;
            let dest = require('path').join(folderPath, saveName);

            // If a file with this name already exists, fetch remote bytes and compare to avoid duplicates
            if (fs.existsSync(dest)) {
              try {
                const res = await fetch(m.url);
                if (res.ok) {
                  const remoteBuf = Buffer.from(await res.arrayBuffer());
                  const localBuf = fs.readFileSync(dest);
                  if (remoteBuf.equals(localBuf)) {
                    // same content, record mapping and skip
                    manifest[m.url] = require('path').join(m.folder, saveName);
                    console.log(`Existing file matches remote; recorded manifest mapping for ${m.url} -> ${manifest[m.url]}`);
                    continue;
                  }
                  // different content: find a unique filename
                  let counter = 1;
                  const base = require('path').basename(saveName, require('path').extname(saveName));
                  const ext = require('path').extname(saveName);
                  let candidate;
                  do {
                    candidate = `${base}-${counter}${ext}`;
                    dest = require('path').join(folderPath, candidate);
                    counter++;
                  } while (fs.existsSync(dest));
                  // write remoteBuf to dest
                  fs.writeFileSync(dest, remoteBuf);
                  manifest[m.url] = require('path').join(m.folder, candidate);
                  console.log(`Downloaded ${m.url} -> ${dest}`);
                  continue;
                } else {
                  console.error(`Failed to fetch remote for comparison: ${m.url} -> ${res.status}`);
                }
              } catch (err) {
                console.error(`Error comparing remote to local for ${m.url}:`, err.message || err);
              }
            }

            // Normal path: file doesn't exist locally; download and save
            try {
              const res = await fetch(m.url);
              if (!res.ok) throw new Error(`Failed to download ${m.url}: ${res.status}`);
              const buf = Buffer.from(await res.arrayBuffer());
              fs.writeFileSync(dest, buf);
              manifest[m.url] = require('path').join(m.folder, require('path').basename(dest));
              console.log(`Downloaded ${m.url} -> ${dest}`);
            } catch (err) {
              console.error(`Failed to download ${m.url}:`, err.message || err);
            }
          }
        }
      }
      // After images processed, update payload image URLs to point at the images repo raw URLs when available in manifest
      try {
        const rawBase = (imagesRepoUrl || '').replace(/^https:\/\/github.com\//, 'https://raw.githubusercontent.com/').replace(/\.git$/, '') + '/main';
        if (payload && Array.isArray(payload.artworks)) {
          for (let i = 0; i < payload.artworks.length; i++) {
            const art = payload.artworks[i];
            // if the artwork is a plain URL string, try to resolve manifest entries or leave as-is
            if (typeof art === 'string') {
              // direct manifest mapping for original URL or filename
              if (manifest[art]) {
                payload.artworks[i] = rawBase + '/' + manifest[art].replace(/^\/+/, '');
                continue;
              }
              // if it's already an http(s) URL, keep it
              if (/^https?:\/\//i.test(art)) continue;
              // otherwise try common manifest keys (yaml://, rushhd://, orr://)
              const keys = [`yaml://${art}`, `rushhd://${art}`, `orr://${art}`, art];
              for (const key of keys) {
                if (manifest[key]) {
                  payload.artworks[i] = rawBase + '/' + manifest[key].replace(/^\/+/, '');
                  break;
                }
              }
              continue;
            }
            // if artwork is an object, preserve existing behavior and rewrite fields
            if (art && typeof art === 'object') {
              // rewrite any legacy image_url fields
              ['image_url', 'image_url_small', 'image_url_cropped'].forEach(k => {
                if (art && art[k] && manifest[art[k]]) {
                  art[k] = rawBase + '/' + manifest[art[k]].replace(/^\/+/, '');
                }
              });
              // also support grouped keys produced by this importer: image_full / image_full_orr
              ['image_full', 'image_full_orr'].forEach(k => {
                if (art && art[k] && manifest[art[k]]) {
                  art[k] = rawBase + '/' + manifest[art[k]].replace(/^\/+/, '');
                }
              });
              if (art && art.filename) {
                const keys = [`yaml://${art.filename}`, `rushhd://${art.filename}`, `orr://${art.filename}`, art.filename];
                for (const key of keys) {
                  if (manifest[key]) {
                    art.image_url = rawBase + '/' + manifest[key].replace(/^\/+/, '');
                    break;
                  }
                }
              }
                // Fallback: if no manifest mapping was found but fields exist and look like URLs,
                // rewrite them to point at the images repo raw path using conventional folders.
                const fallbackFilename = (url) => {
                  try { return filenameFromUrl(url, 'unknown.jpg'); } catch (e) { return 'unknown.jpg' }
                }
                if (art.image_url && (!manifest[art.image_url])) {
                  const name = fallbackFilename(art.image_url)
                  art.image_url = rawBase + '/full_tcg/' + encodeURIComponent(name)
                }
                if (art.image_url_small && (!manifest[art.image_url_small])) {
                  const name = fallbackFilename(art.image_url_small)
                  art.image_url_small = rawBase + '/small_tcg/' + encodeURIComponent(name)
                }
                if (art.image_url_cropped && (!manifest[art.image_url_cropped])) {
                  const name = fallbackFilename(art.image_url_cropped)
                  art.image_url_cropped = rawBase + '/cropped_tcg/' + encodeURIComponent(name)
                }
                if (art.image_full && (!manifest[art.image_full])) {
                  const name = fallbackFilename(art.image_full)
                  art.image_full = rawBase + '/full_rush/' + encodeURIComponent(name)
                }
                if (art.image_full_orr && (!manifest[art.image_full_orr])) {
                  const name = fallbackFilename(art.image_full_orr)
                  art.image_full_orr = rawBase + '/full_rush_orr/' + encodeURIComponent(name)
                }
            }
          }
          // update primary image shortcuts: support string or object entries
          const primary = payload.artworks[0] || null;
          if (typeof primary === 'string') {
            payload.imageUrl = primary;
          } else if (primary && typeof primary === 'object') {
            // prefer grouped keys if present
            payload.imageUrl = primary.image_full_orr || primary.image_full || primary.image_url || primary.imageUrl || payload.imageUrl;
            payload.imageUrlSmall = primary.image_full || primary.image_url_small || primary.imageUrlSmall || payload.imageUrlSmall;
            payload.imageUrlCropped = primary.image_full || primary.image_url_cropped || primary.imageUrlCropped || payload.imageUrlCropped;
          }
        }
          // legacy: non-rush payloads may include a payload.images array; only rewrite those when not in Rush mode
          if (!options.rush && payload && Array.isArray(payload.images)) {
            for (const img of payload.images) {
              if (!img) continue;
              if (img.image) {
                const key = `yaml://${img.image}`;
                if (manifest[key]) img.image_url = rawBase + '/' + manifest[key].replace(/^\/+/,'');
              }
              if (img.illustration) {
                const key = `yaml://${img.illustration}`;
                if (manifest[key]) img.illustration_url = rawBase + '/' + manifest[key].replace(/^\/+/,'');
              }
            }
            // set primary shortcuts
            if (!payload.imageUrl && payload.images[0] && payload.images[0].image) {
              const key = `yaml://${payload.images[0].image}`;
              if (manifest[key]) payload.imageUrl = rawBase + '/' + manifest[key].replace(/^\/+/,'');
            }
          }
      } catch (err) {
        console.warn('Failed to rewrite payload image URLs:', err && err.message ? err.message : err);
      }

      // persist manifest to disk so it can be committed
      try {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      } catch (err) {
        console.warn('Failed to write manifest to disk:', err && err.message ? err.message : err);
      }

      // write the sample payload (now with updated image links)
      try {
        // For Rush-mode payloads we don't want the legacy primary image shortcuts or the unused `images` array
        if (options.rush) {
          delete payload.imageUrl;
          delete payload.imageUrlSmall;
          delete payload.imageUrlCropped;
          delete payload.images;
          // ensure any legacy `monster_type_line` or `series` left over from YAML/CDB sources is removed
          delete payload.monster_type_line;
          delete payload.series;
        }
        // mark variant (top-level) and avoid stuffing requirement/effect/notes into metadata
        payload.isRush = !!options.rush || !!options.cdbOnly;
        // top-level variant only (do not duplicate into metadata)
        payload.variant = payload.isRush ? 'RUSH' : 'TCG';
        // ensure metadata object exists for other non-critical fields (pendulum/monster descs)
        payload.metadata = payload.metadata || {};
        // formats: allow caller to pass `--formats=a,b` or default to an empty list
        // Only set `formats` when the caller explicitly passed `--formats`.
        // Do not default to an empty array or inject a 'STANDARD' tag.
        if (options.formats && Array.isArray(options.formats)) {
          payload.formats = options.formats;
        } else {
          // remove any implicit formats so downstream DB write won't persist an empty array
          if (Object.prototype.hasOwnProperty.call(payload, 'formats')) delete payload.formats;
        }
        // Do NOT copy requirement/effect/notes into metadata. Keep them as top-level fields:
        // payload.requirement, payload.effect, payload.notes (already set when building Rush payloads).
        // For Pendulum TCG cards where the API provides both pendulum and monster descriptions,
        // omit the combined `desc` field to avoid duplication — keep the split fields in metadata.
        if (!payload.isRush && payload.pendulum_desc && payload.monster_desc) {
          // move desc into metadata if present, then remove
          try {
            if (payload.desc) payload.metadata.combinedDesc = payload.desc;
          } catch (e) {}
          delete payload.desc;
        }
        // extra-safeguard: remove `series` if still present for any reason
        if (payload && Object.prototype.hasOwnProperty.call(payload, 'series')) {
          delete payload.series;
        }
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
        if (!showProgress) {
          console.log(`Wrote sample to ${outPath}`);
          console.log('Payload preview:', JSON.stringify(payload, null, 2).slice(0, 1000));
        }
        // Optional: write normalized card into site DB (Postgres) when requested
        if (options.dbWrite) {
          try {
            const { Pool } = require('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            const client = await pool.connect();
            try {
              const konamiIdVal = payload.konami_id || payload.konamiId || null;
              const matchName = payload.name || name;
              let existing = null;
              if (konamiIdVal) {
                const res = await client.query('SELECT id, "konamiId" FROM "Card" WHERE "konamiId" = $1 LIMIT 1', [konamiIdVal]);
                if (res.rows.length) existing = res.rows[0];
              }
              if (!existing) {
                const res2 = await client.query('SELECT id FROM "Card" WHERE name = $1 LIMIT 1', [matchName]);
                if (res2.rows.length) existing = res2.rows[0];
              }

                  // ensure pendulum/monster descs are preserved in metadata (if present)
                  payload.metadata = payload.metadata || {};
                  if (payload.pendulum_desc) payload.metadata.pendulumDesc = payload.pendulum_desc;
                  if (payload.monster_desc) payload.metadata.monsterDesc = payload.monster_desc;

              const dbData = {
                // Variant: must match Prisma enum values (TCG / RUSH)
                variant: (payload.metadata && payload.metadata.variant) ? payload.metadata.variant : (payload.isRush ? 'RUSH' : 'TCG'),
                konamiId: konamiIdVal || null,
                name: payload.name || matchName,
                // keep `desc` for combined TCG descriptions only; do not shove Rush fields here
                // DB requires a non-null desc column — default to empty string when missing
                desc: (payload.desc !== undefined && payload.desc !== null) ? payload.desc : '',
                type: payload.card_type || payload.type || null,
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
                // Rush-specific top-level fields
                requirement: payload.requirement || null,
                effect: payload.effect || null,
                notes: payload.notes || null,
                artworks: payload.artworks ? JSON.stringify(payload.artworks) : null,
                primaryArtworkIndex: payload.primaryArtworkIndex || null,
                metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
                // only include formats when explicitly provided via CLI
                formats: (options.formats && Array.isArray(options.formats)) ? payload.formats : undefined
              };

              // set updatedAt for updates/inserts
              try { dbData.updatedAt = new Date(); } catch (e) {}

                if (existing) {
                // only keep columns that exist in the DB schema
                const allowed = ['variant','konamiId','name','desc','type','atk','def','level','race','attribute','archetype','scale','linkVal','linkMarkers','requirement','effect','notes','imageUrlCropped','metadata','artworks','primaryArtworkIndex','formats','subtypes','createdAt','updatedAt'];
                const keys = Object.keys(dbData).filter(k => dbData[k] !== undefined && allowed.includes(k));
                const sets = keys.map((k, i) => `"${k}" = $${i + 1}`);
                const values = keys.map(k => dbData[k]);
                values.push(existing.id);
                const q = `UPDATE "Card" SET ${sets.join(', ')} WHERE id = $${values.length}`;
                await client.query(q, values);
                console.log(`DB: updated Card id=${existing.id}`);
              } else {
                const allowed = ['variant','konamiId','name','desc','type','atk','def','level','race','attribute','archetype','scale','linkVal','linkMarkers','requirement','effect','notes','imageUrlCropped','metadata','artworks','primaryArtworkIndex','formats','subtypes','createdAt','updatedAt'];
                // ensure we supply a primary id when inserting (Prisma's cuid default is not a DB-level default)
                try { const crypto = require('crypto'); if (!dbData.id) dbData.id = crypto.randomUUID(); } catch (e) {}
                // ensure createdAt/updatedAt are present for DB insert defaults
                try { dbData.createdAt = dbData.createdAt || new Date(); dbData.updatedAt = dbData.updatedAt || new Date(); } catch (e) {}
                // ensure id is allowed/added
                if (!allowed.includes('id')) allowed.push('id');
                const keys = Object.keys(dbData).filter(k => dbData[k] !== undefined && allowed.includes(k));
                const cols = keys.map(k => `"${k}"`).join(', ');
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                const values = keys.map(k => dbData[k]);
                const q = `INSERT INTO "Card" (${cols}) VALUES (${placeholders})`;
                await client.query(q, values);
                console.log('DB: inserted new Card');
              }
            } finally {
              client.release();
              await pool.end();
            }
          } catch (e) {
            console.error('DB write failed:', e && e.message ? e.message : e);
          }
        }
      } catch (err) {
        console.error('Failed to write sample payload:', err && err.message ? err.message : err);
      }
    } catch (err) {
      console.error(`Error for ${name}:`, err.message || err);
    }
  }

  // git commit & push if requested
  if (options.ensureRepo && doPush) {
    try {
      console.log('Staging image changes...');
      runCmd(`git -C "${imagesLocal}" add --all full_tcg small_tcg cropped_tcg full_rush full_rush_orr manifest.json`);
      const msg = `Add images for ${names.length} cards`;
      try { 
        // Use a simple, safe commit message to avoid shell argument limit issues
        runCmd(`git -C "${imagesLocal}" commit -m "${msg}"`); 
      } catch (e) { 
        /* ignore "nothing to commit" */ 
      }
      
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        console.log('Using GITHUB_TOKEN for push...');
        const remoteUrl = imagesRepoUrl.replace('https://', `https://${token}@`);
        runCmd(`git -C "${imagesLocal}" remote remove temp-origin >/dev/null 2>&1 || true`);
        runCmd(`git -C "${imagesLocal}" remote add temp-origin ${remoteUrl} >/dev/null 2>&1`);
        runCmd(`git -C "${imagesLocal}" push temp-origin HEAD:main`);
        runCmd(`git -C "${imagesLocal}" remote remove temp-origin >/dev/null 2>&1 || true`);
      } else {
        console.log('No GITHUB_TOKEN found; attempting standard git push (using system auth)...');
        runCmd(`git -C "${imagesLocal}" push origin main`);
      }
      console.log('Pushed image commits.');
    } catch (err) {
      console.error('Failed to commit/push images:', err.message || err);
    }
  }
}

if (require.main === module) {
  const raw = process.argv.slice(2);
  const names = [];
  const options = { ensureRepo: false, push: false };
  let noPrompt = false;
  for (const a of raw) {
    if (a === '--ensure-repo') { options.ensureRepo = true; continue; }
    if (a === '--push') { options.push = true; continue; }
    if (a === '--no-prompt' || a === '--no-interactive') { noPrompt = true; continue; }
    if (a.startsWith('--images-local=')) { options.imagesLocal = a.split('=')[1]; continue; }
    if (a.startsWith('--images-repo=')) { options.imagesRepoUrl = a.split('=')[1]; continue; }
    if (a.startsWith('--outdir=')) { options.outDir = a.split('=')[1]; continue; }
    if (a === '--rush') { options.rush = true; continue; }
    if (a === '--cdb-only') { options.cdbOnly = true; continue; }
    if (a.startsWith('--cdb-local=')) { options.cdbPath = a.split('=')[1]; continue; }
    if (a === '--pendulum-only') { options.pendulumOnly = true; continue; }
    if (a === '--db-write') { options.dbWrite = true; continue; }
    if (a === '--no-db') { options.noDb = true; continue; }
    if (a === '--no-skip-existing') { options.noSkipExisting = true; continue; }
    if (a.startsWith('--formats=')) { options.formats = a.split('=')[1].split(',').map(s => s.trim()).filter(Boolean); continue; }
    if (a.startsWith('--yaml-local=')) { options.yamlLocal = a.split('=')[1]; continue; }
    if (a.startsWith('--yaml-repo=')) { options.yamlRepoUrl = a.split('=')[1]; continue; }
    if (a === '--fetch-all-api') { options.fetchAllApi = true; continue; }
    names.push(a);
  }
  if (names.length === 0) {
    // Auto-run mode: when invoked with no names, perform a full import for both
    // TCG (from local backup JSON or API) and Rush (from local CDB). This allows
    // running the script with just the script name to import everything.
    const fs = require('fs');
    const p = require('path');
    (async () => {
      try {
        console.log('No names supplied — running full import (TCG + Rush) and writing to DB.');
        
        // 1. Collect TCG candidates
        let tcgNames = [];
        let allApiData = null; // if we fetch all api, we might already have the data
        
        if (options.fetchAllApi) {
          try {
            allApiData = await fetchAllApiCards();
            tcgNames = allApiData.map(c => c.name).filter(Boolean);
            console.log(`Fetched ${tcgNames.length} names from official API.`);
          } catch (e) {
            console.warn('Failed to fetch from API:', e.message);
          }
        }
        
        // If we didn't fetch from API or it failed, try the local backup
        if (tcgNames.length === 0) {
          const backupPath = p.join(__dirname, '..', 'db_backup_1768861324816', 'public__Card.json');
          try {
            if (fs.existsSync(backupPath)) {
              const raw = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
              tcgNames = Array.from(new Set(raw.map(r => (r && r.name) ? String(r.name).trim() : null).filter(Boolean)));
            } else {
              console.warn('TCG backup not found at', backupPath);
            }
          } catch (e) {
            console.warn('Failed to load TCG backup:', e && e.message ? e.message : e);
          }
        }

        // 2. Collect Rush candidates
        const cdbPath = options.cdbPath || '/tmp/cards-rush.cdb';
        let rushNames = [];
        try {
          if (fs.existsSync(cdbPath)) {
            const rows = runSqliteJson(cdbPath, "SELECT DISTINCT name FROM texts ORDER BY name;");
            rushNames = Array.from(new Set(rows.map(r => r.name).filter(Boolean)));
          } else {
            console.warn('CDB not found at', cdbPath);
          }
        } catch (e) {
          console.warn('Failed to read CDB:', e && e.message ? e.message : e);
        }

        // ensure DB writes for full-run by default (unless --no-db is passed)
        const optTCG = Object.assign({}, options, { rush: false, dbWrite: !options.noDb });
        if (allApiData) {
          const apiMap = new Map();
          for (const c of allApiData) if (c.name) apiMap.set(c.name, c);
          optTCG.apiDataMap = apiMap;
        }
        const optRush = Object.assign({}, options, { rush: true, cdbOnly: true, cdbPath: cdbPath, dbWrite: !options.noDb });

        // Optionally skip existing cards to avoid reprocessing everything.
        const skipExisting = !options.noSkipExisting && !options.noDb;
        if (skipExisting) {
          try {
            const { Pool } = require('pg');
            if (process.env.DATABASE_URL) {
              const pool = new Pool({ connectionString: process.env.DATABASE_URL });
              const client = await pool.connect();
              try {
                if (tcgNames.length) {
                  const lowered = tcgNames.map(n => String(n).toLowerCase());
                  const res = await client.query('SELECT name FROM "Card" WHERE LOWER(name) = ANY($1)', [lowered]);
                  const existing = new Set(res.rows.map(r => String(r.name).toLowerCase()));
                  const before = tcgNames.length;
                  tcgNames = tcgNames.filter(n => !existing.has(String(n).toLowerCase()));
                  console.log(`Skipping ${before - tcgNames.length} existing TCG cards; ${tcgNames.length} remain.`);
                }
                if (rushNames.length) {
                  const loweredR = rushNames.map(n => String(n).toLowerCase());
                  const res2 = await client.query('SELECT name FROM "Card" WHERE LOWER(name) = ANY($1)', [loweredR]);
                  const existingR = new Set(res2.rows.map(r => String(r.name).toLowerCase()));
                  const beforeR = rushNames.length;
                  rushNames = rushNames.filter(n => !existingR.has(String(n).toLowerCase()));
                  console.log(`Skipping ${beforeR - rushNames.length} existing Rush cards; ${rushNames.length} remain.`);
                }
              } finally {
                client.release();
                await pool.end();
              }
            } else {
              console.warn('DATABASE_URL not set — cannot skip existing cards.');
            }
          } catch (e) {
            console.warn('Failed to check existing cards in DB — proceeding without skipping:', e && e.message ? e.message : e);
          }
        }

        if (tcgNames.length) {
          console.log(`Collecting TCG payloads for ${tcgNames.length} names (no DB writes)`);
          // collect samples only (do not write to DB yet)
          await run(tcgNames, Object.assign({}, optTCG, { dbWrite: false, showProgress: true }));
        } else {
          console.log('No TCG names found to import.');
        }

        if (rushNames.length) {
          console.log(`Collecting Rush payloads for ${rushNames.length} names (no DB writes)`);
          await run(rushNames, Object.assign({}, optRush, { dbWrite: false, showProgress: true }));
        } else {
          console.log('No Rush names found to import.');
        }

        if (options.noDb) {
          console.log('Skipping bulk DB upsert phase (--no-db passed).');
          console.log('Full import complete (images only).');
          process.exit(0);
        }

        // Bulk upsert phase: read sample files and perform DB writes with a single DB connection
        console.log('Starting bulk DB upsert of collected payloads...');
        try {
          const { Pool } = require('pg');
          const pool = new Pool({ connectionString: process.env.DATABASE_URL });
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const sampleDirs = [p.join(__dirname, '..', 'data', 'cards'), p.join(__dirname, '..', 'data', 'cards', 'rush')];
            // compute total files for progress
            let totalFiles = 0;
            for (const dir of sampleDirs) {
              if (!fs.existsSync(dir)) continue;
              totalFiles += fs.readdirSync(dir).filter(f => f.endsWith('.json')).length;
            }
            let processed = 0;
            for (const dir of sampleDirs) {
              if (!fs.existsSync(dir)) continue;
              const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
              for (const f of files) {
                processed++;
                if (totalFiles > 0) process.stdout.write(`Upserting: ${processed}/${totalFiles} - ${f}\r`);
                try {
                  const full = p.join(dir, f);
                  const payload = JSON.parse(fs.readFileSync(full, 'utf8'));
                  // build dbData (same mapping as single-upsert path)
                  const konamiIdVal = payload.konami_id || payload.konamiId || null;
                  const matchName = payload.name || null;
                  const metadataObj = payload.metadata || {};
                  // preserve pendulum/monster desc in metadata if present
                  if (payload.pendulum_desc) metadataObj.pendulumDesc = payload.pendulum_desc;
                  if (payload.monster_desc) metadataObj.monsterDesc = payload.monster_desc;

                  const dbData = {
                    variant: (payload.isRush || payload.variant === 'RUSH') ? 'RUSH' : 'TCG',
                    konamiId: konamiIdVal || null,
                    name: matchName,
                    desc: (payload.desc !== undefined && payload.desc !== null) ? payload.desc : '',
                    type: payload.card_type || payload.type || null,
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
                    metadata: Object.keys(metadataObj).length ? JSON.stringify(metadataObj) : null,
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

                  // allowed columns list (match schema)
                  const allowed = ['variant','konamiId','name','desc','type','atk','def','level','race','attribute','archetype','scale','linkVal','linkMarkers','requirement','effect','notes','imageUrlCropped','metadata','artworks','primaryArtworkIndex','formats','subtypes','createdAt','updatedAt'];
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
                  console.error('Failed to upsert sample file', f, e && e.message ? e.message : e);
                }
              }
            }
            await client.query('COMMIT');
            if (typeof totalFiles !== 'undefined' && totalFiles > 0) process.stdout.write('\n');
            console.log('Bulk upsert completed successfully.');
          } catch (e) {
            try { await client.query('ROLLBACK'); } catch (er) {}
            console.error('Bulk upsert failed:', e && e.message ? e.message : e);
          } finally {
            client.release();
            await pool.end();
          }
        } catch (e) {
          console.error('Bulk upsert infrastructure failed:', e && e.message ? e.message : e);
        }

        console.log('Full import complete.');
        process.exit(0);
      } catch (err) {
        console.error('Full import failed:', err && err.message ? err.message : err);
        process.exit(1);
      }
    })();
    return;
  }

  // Interactive mode: if running in a TTY and no explicit mode flags provided,
  // prompt the user to choose TCG / Rush / Both. Use --no-prompt to skip.
  const hasExplicitMode = !!(options.rush || options.cdbOnly);
  const interactive = process.stdin.isTTY && !noPrompt && !hasExplicitMode;

  async function runInteractive() {
    if (!interactive) {
      return run(names, options).catch(err => { console.error(err); process.exit(1); });
    }
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    const question = (q) => new Promise(res => rl.question(q, res));
    try {
      const ans = (await question('\nSelect run mode:\n1) TCG only\n2) Rush only\n3) Both\nEnter 1/2/3: ')).trim();
      rl.close();
      if (ans === '1') {
        // TCG only
        options.rush = false;
        await run(names, options);
      } else if (ans === '2') {
        // Rush only
        options.rush = true;
        await run(names, options);
      } else {
        // Both: run TCG then Rush
        const optTCG = Object.assign({}, options, { rush: false });
        const optRush = Object.assign({}, options, { rush: true });
        await run(names, optTCG);
        await run(names, optRush);
      }
    } catch (err) {
      rl.close();
      console.error('Interactive prompt failed:', err && err.message ? err.message : err);
      process.exit(1);
    }
  }

  runInteractive();
}
