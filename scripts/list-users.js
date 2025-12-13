const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

// Load env vars if not already loaded (though usually not needed if running in same env)
// require('dotenv').config() 

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/kdr-revamped" // Fallback or use env

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  const users = await prisma.user.findMany()
  console.log('Users:', users)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
