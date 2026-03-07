// Lists cards that look like YGOPRODECK "Skill" cards for review.
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
  // Find cards where type or name mentions 'skill' or metadata.frameType == 'skill'
  const rows = await prisma.$queryRaw`
    SELECT id, name, "konamiId", type, metadata
    FROM "Card"
    WHERE LOWER(COALESCE(type, '')) LIKE '%skill%'
       OR LOWER(COALESCE(name, '')) LIKE '%skill%'
       OR (metadata->>'frameType') = 'skill'
    ORDER BY name
    LIMIT 1000
  `

  console.log(`Found ${rows.length} candidate skill cards:`)
  for (const r of rows) {
    console.log(`${r.id} | ${r.konamiId || '-'} | ${r.name} | type=${r.type || '-'} | metadata=${JSON.stringify(r.metadata)}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
