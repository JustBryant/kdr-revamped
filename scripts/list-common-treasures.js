require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const argv = process.argv.slice(2);
  const opts = {};
  for (const a of argv) {
    if (a.startsWith('--slug=')) opts.slug = a.split('=')[1];
    if (a.startsWith('--formatId=')) opts.formatId = a.split('=')[1];
  }

  let connectionString = process.env.DATABASE_URL || '';
  if ((connectionString.startsWith('"') && connectionString.endsWith('"')) || (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
    connectionString = connectionString.slice(1, -1);
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  let formatId = undefined;
  if (opts.slug) {
    const f = await prisma.format.findUnique({ where: { slug: String(opts.slug) } });
    if (!f) {
      console.error('Format slug not found:', opts.slug);
      await prisma.$disconnect();
      process.exit(1);
    }
    formatId = f.id;
  }
  if (opts.formatId) formatId = String(opts.formatId);

  // fetch ALL TREASURE items and normalize rarity in JS to catch variants like 'Common', 'C', 'Normal', etc.
  const items = await prisma.item.findMany({ where: { type: 'TREASURE' }, include: { card: true } });

  const normalizeRarity = (v) => {
    const s = String(v || '').trim().toUpperCase()
    if (!s) return ''
    if (s === 'C' || s === 'COMMON' || s === 'N' || s === 'NORMAL') return 'C'
    if (s === 'R' || s === 'RARE') return 'R'
    if (s === 'SR' || s === 'S' || s === 'SUPER' || s === 'SUPER RARE') return 'SR'
    if (s === 'UR' || s === 'U' || s === 'ULTRA' || s === 'ULTRA RARE') return 'UR'
    return s
  }

  const commonItems = items.filter(it => normalizeRarity(it.rarity || (it.card && it.card.rarity)) === 'C')

  const inFormat = [];
  const notInFormat = [];
  for (const it of commonItems) {
    if (formatId && it.formatId === formatId) inFormat.push(it);
    else notInFormat.push(it);
  }

  console.log('FORMAT ID:', formatId);
  console.log('Total C treasures:', commonItems.length);
  console.log('In format:', inFormat.length);
  console.table(inFormat);
  console.log('\nNot in format:', notInFormat.length);
  console.table(notInFormat);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
