// Backfill script: populate `skillId` on LootPoolItem when possible.
// Run with: `node ./scripts/backfill-lootpool-skillId.js` (ensure DATABASE_URL is set in .env)
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
async function main() {
  console.log('Starting backfill for LootPoolItem.skillId...')
  const items = await prisma.lootPoolItem.findMany({
    where: { type: 'Skill', skillId: null },
    include: { lootPool: { select: { classId: true } } }
  })

  console.log(`Found ${items.length} loot pool items to inspect.`)
  let updated = 0
  for (const it of items) {
    const classId = it.lootPool?.classId
    if (!classId || !it.skillName) continue
    const skill = await prisma.skill.findFirst({ where: { name: it.skillName, classId } })
    if (skill) {
      await prisma.lootPoolItem.update({ where: { id: it.id }, data: { skillId: skill.id } })
      updated++
      console.log(`Updated item ${it.id} -> skillId ${skill.id}`)
    } else {
      console.log(`No matching skill for item ${it.id} (skillName='${it.skillName}')`) 
    }
  }

  console.log(`Backfill complete. Updated ${updated} items.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
