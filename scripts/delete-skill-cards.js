// Deletes cards that match the same selection criteria as `find-skill-cards.js`.
// Run only after reviewing the output from the finder script.
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set in environment or .env')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
async function main() {
  // WARNING: irreversible delete. We show the rows first, then perform the delete.
  const rows = await prisma.$queryRaw`
    SELECT id, name, "konamiId", type
    FROM "Card"
    WHERE LOWER(COALESCE(type, '')) LIKE '%skill%'
       OR LOWER(COALESCE(name, '')) LIKE '%skill%'
       OR (metadata->>'frameType') = 'skill'
    ORDER BY name
  `

  console.log(`About to delete ${rows.length} cards:`)
  for (const r of rows) {
    console.log(`${r.id} | ${r.konamiId || '-'} | ${r.name} | type=${r.type || '-'} `)
  }

  // Confirm environment before deleting automatically
  if (process.env.CONFIRM_DELETE !== 'yes') {
    console.log('\nTo actually delete these rows, re-run this script with environment variable CONFIRM_DELETE=yes')
    await prisma.$disconnect()
    return
  }

  // Create a backup table and copy rows there before deleting
  console.log('Creating backup table backup_deleted_skill_cards (if not exists) and copying rows...')
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS backup_deleted_skill_cards AS TABLE "Card" WITH NO DATA
  `
  const copied = await prisma.$executeRaw`
    INSERT INTO backup_deleted_skill_cards
    SELECT * FROM "Card"
    WHERE LOWER(COALESCE(type, '')) LIKE '%skill%'
       OR LOWER(COALESCE(name, '')) LIKE '%skill%'
       OR (metadata->>'frameType') = 'skill'
  `
  console.log('Copied rows into backup_deleted_skill_cards, result:', copied)

  // Perform the delete
  const res = await prisma.$executeRaw`
    DELETE FROM "Card"
    WHERE LOWER(COALESCE(type, '')) LIKE '%skill%'
       OR LOWER(COALESCE(name, '')) LIKE '%skill%'
       OR (metadata->>'frameType') = 'skill'
  `

  console.log('Delete executed, result (rows affected):', res)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
