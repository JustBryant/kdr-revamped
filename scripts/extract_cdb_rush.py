#!/usr/bin/env python3
import sqlite3, json, os, re

db='/tmp/cards-rush.cdb'
out_dir='data/cards/rush'
os.makedirs(out_dir, exist_ok=True)
con=sqlite3.connect(db)
cur=con.cursor()
# find all records for the exact english name (case-insensitive)
cur.execute("SELECT id,name,desc FROM texts WHERE LOWER(name)=? ORDER BY id",('sevens road magician',))
rows=cur.fetchall()
if not rows:
    # fallback: any rows matching LIKE
    cur.execute("SELECT id,name,desc FROM texts WHERE name LIKE ? ORDER BY id",('%Sevens Road Magician%',))
    rows=cur.fetchall()
if not rows:
    print('Card not found')
    raise SystemExit(1)

# choose the primary as the lowest id
rows_sorted = sorted(rows, key=lambda r: r[0])
primary = rows_sorted[0]
card_id,name,desc = primary
other_ids = [r[0] for r in rows_sorted[1:]]
# parse desc into sections and capture any leftover notes
req=None; eff=None; notes=None
if desc:
    d=desc.replace('\r\n','\n')
    req_match=re.search(r'\[REQUIREMENT\]\s*(.*?)\s*(?:\[EFFECT\]|$)', d, re.S|re.I)
    eff_match=re.search(r'\[EFFECT\]\s*(.*)', d, re.S|re.I)
    if req_match:
        req=req_match.group(1).strip()
    if eff_match:
        eff=eff_match.group(1).strip()
    # remove matched blocks to reveal leftover text
    if req_match:
        d=d.replace(req_match.group(0),'')
    if eff_match:
        d=d.replace(eff_match.group(0),'')
    d=d.strip()
    if not req and not eff:
        eff=d or None
        d=''
    if d:
        notes=d
# pull datas row for stats
cur.execute('SELECT atk,def,level,attribute,race,type FROM datas WHERE id=?', (card_id,))
d=cur.fetchone() or (None,None,None,None,None,None)
atk,def_,level,attribute_val,race_val,type_val = d

# Map attribute bitmask to readable attribute name(s)
attr_map = {
    1: 'EARTH',
    2: 'WATER',
    4: 'FIRE',
    8: 'WIND',
    16: 'LIGHT',
    32: 'DARK',
    64: 'DIVINE'
}
def map_attribute(v):
    if v is None:
        return None
    # If single-bit value, return single name, else list of names
    names = [name for bit,name in attr_map.items() if v & bit]
    if not names:
        return str(v)
    return names[0] if len(names)==1 else names

# Map race bitmask to readable race name(s)
race_map = {
    1: 'Warrior',
    2: 'Spellcaster',
    4: 'Fairy',
    8: 'Fiend',
    16: 'Zombie',
    32: 'Machine',
    64: 'Aqua',
    128: 'Pyro',
    256: 'Rock',
    512: 'Winged Beast',
    1024: 'Plant',
    2048: 'Insect',
    4096: 'Thunder',
    8192: 'Dragon',
    16384: 'Beast',
    32768: 'Beast-Warrior',
    65536: 'Dinosaur',
    131072: 'Fish',
    262144: 'Sea Serpent',
    524288: 'Reptile',
    1048576: 'Psychic',
    2097152: 'Divine-Beast',
    4194304: 'Creator God',
    8388608: 'Wyrm',
    16777216: 'Cyberse'
}
def map_race(v):
    if v is None:
        return None
    names = [name for bit,name in race_map.items() if v & bit]
    if not names:
        return str(v)
    return names[0] if len(names)==1 else names

# Map type bitmask -> canonical subtype tokens (lowercase)
type_map = {
    1: 'monster', 2: 'spell', 4: 'trap',
    16: 'normal', 32: 'effect', 64: 'fusion', 128: 'ritual',
    256: 'trapmonster', 512: 'spirit', 1024: 'union', 2048: 'gemini',
    4096: 'tuner', 8192: 'synchro', 16384: 'token', 32768: 'quickplay',
    65536: 'continuous', 131072: 'equip', 262144: 'field', 524288: 'counter',
    1048576: 'flip', 2097152: 'toon', 4194304: 'xyz', 8388608: 'pendulum',
    16777216: 'link'
}
def map_type(v):
    if v is None:
        return []
    names = [name for bit,name in type_map.items() if v & bit]
    return names

attribute = map_attribute(attribute_val)
race = map_race(race_val)

subtypes = map_type(type_val)
payload={'konami_id': card_id, 'name': name, 'requirement': req, 'effect': eff, 'notes': notes, 'atk': atk, 'def': def_, 'level': level, 'attribute': attribute, 'race': race, 'subtypes': subtypes, 'alternate_artwork_ids': other_ids}
out_path=os.path.join(out_dir, 'rush-cdb-Sevens_Road_Magician.json')
with open(out_path,'w',encoding='utf8') as f:
    json.dump(payload,f,ensure_ascii=False,indent=2)
print('Wrote', out_path)
print(json.dumps(payload,ensure_ascii=False,indent=2))
