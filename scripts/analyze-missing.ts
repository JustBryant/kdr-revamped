import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import fs from 'fs'
import path from 'path'
import "dotenv/config";

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DOWNLOAD_DIR = path.join(process.cwd(), 'card_images')

async function main() {
  console.log('Analyzing missing cards...')
  const cards = await prisma.card.findMany({
    where: {
      imageUrlCropped: {
        not: null
      }
    },
    select: {
      id: true,
      konamiId: true,
      name: true,
      type: true,
      race: true,
      imageUrlCropped: true
    }
  })

  const missing = []

  for (const card of cards) {
    if (!card.konamiId) continue
    const filename = `${card.konamiId}.jpg`
    const filepath = path.join(DOWNLOAD_DIR, filename)

    if (!fs.existsSync(filepath) || fs.statSync(filepath).size === 0) {
      missing.push(card)
    }
  }

  console.log(`Found ${missing.length} missing cards.`)
  
  // Group by type to see patterns
  const byType: Record<string, number> = {}
  missing.forEach(c => {
    const t = c.type || 'Unknown'
    byType[t] = (byType[t] || 0) + 1
  })

  console.log('Missing cards by Type:', byType)

  // Check for Skill Cards specifically
  const skillCards = missing.filter(c => c.type === 'Skill Card' || c.name.includes('(Skill Card)'))
  console.log(`Potential Skill Cards: ${skillCards.length}`)

  // Check for IDs starting with 300 (common for skills in some DBs) or other patterns
  const specialIds = missing.filter(c => c.konamiId && c.konamiId.toString().startsWith('300'))
  console.log(`IDs starting with 300: ${specialIds.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
