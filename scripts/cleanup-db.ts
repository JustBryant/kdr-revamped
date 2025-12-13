import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import "dotenv/config";

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Starting database cleanup...')

  // 1. Delete Skill Cards
  const deleteSkills = await prisma.card.deleteMany({
    where: {
      OR: [
        { type: 'Skill Card' },
        { name: { contains: '(Skill Card)' } },
        { konamiId: { gte: 300000000, lt: 301000000 } } // Range for 300xxxxxx IDs
      ]
    }
  })
  console.log(`Deleted ${deleteSkills.count} Skill Cards.`)

  // 2. Delete known Prize Cards / Match Winners that often lack art
  // These IDs were identified from the failed download list
  const prizeCardIds = [
    662853, // Sanctity of Dragon
    662854, // Noritoshi in Darkest Rainment
    662855, // Amatsu-Okami of the Divine Peaks
    662857, // Iron Knight of Revolution
    111000561, // Get Your Game On!
    100000101, // Ojamandala (Anime card/Illegal)
    111000561, // Get Your Game On!
    // Add others if they persist after retry
  ]

  const deletePrize = await prisma.card.deleteMany({
    where: {
      konamiId: {
        in: prizeCardIds
      }
    }
  })
  console.log(`Deleted ${deletePrize.count} Prize/Special Cards.`)

}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
