// One-off deletion script to remove unwanted Format slugs 'rush' and 'standard'.
// Usage: copy your .env or set DATABASE_URL and run: `node scripts/delete-formats.js`

require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

// Create the same adapter-backed PrismaClient the app uses via lib/prisma
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set; aborting')
  process.exit(1)
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const slugs = ['rush', 'standard']
  console.log('Deleting formats:', slugs)
  const result = await prisma.format.deleteMany({ where: { slug: { in: slugs } } })
  console.log('Deleted count:', result.count)
}

main().catch((e) => {
  console.error('Error deleting formats:', e)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
  await pool.end()
})
