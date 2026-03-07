// One-off script: set the user with name "JustBryant" to Role.ADMIN
// Usage: node scripts/set-admin.js
require('dotenv').config()
const { Pool } = require('pg')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const username = process.argv[2] || 'JustBryant'
  const user = await prisma.user.findFirst({ where: { name: username } })
  if (!user) {
    console.error(`User not found: ${username}`)
    process.exitCode = 2
    return
  }

  if (user.role === 'ADMIN') {
    console.log(`User ${username} (${user.id}) is already ADMIN`)
    return
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  console.log(`Updated user ${username} (${updated.id}) to role=${updated.role}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
