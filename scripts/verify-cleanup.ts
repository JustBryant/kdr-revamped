import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import "dotenv/config";

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const skillCards = await prisma.card.count({
    where: {
      OR: [
        { type: 'Skill Card' },
        { name: { contains: '(Skill Card)' } },
        { konamiId: { gte: 300000000, lt: 301000000 } }
      ]
    }
  })
  
  console.log(`Remaining Skill Cards in DB: ${skillCards}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
