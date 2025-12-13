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
  console.log('Checking for missing images...')
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
      imageUrlCropped: true
    }
  })

  console.log(`Checking ${cards.length} cards...`)

  const missing: { id: number | null, name: string, url: string | null }[] = []

  for (const card of cards) {
    if (!card.konamiId) continue

    const filename = `${card.konamiId}.jpg`
    const filepath = path.join(DOWNLOAD_DIR, filename)

    if (!fs.existsSync(filepath)) {
      missing.push({
        id: card.konamiId,
        name: card.name,
        url: card.imageUrlCropped
      })
    } else {
      // Check for empty files (failed downloads that weren't cleaned up)
      const stats = fs.statSync(filepath)
      if (stats.size === 0) {
        missing.push({
          id: card.konamiId,
          name: card.name,
          url: card.imageUrlCropped
        })
      }
    }
  }

  if (missing.length === 0) {
    console.log('All images are present!')
  } else {
    console.log(`Found ${missing.length} missing images:`)
    console.log('----------------------------------------')
    missing.forEach(m => {
      console.log(`ID: ${m.id} | Name: ${m.name}`)
      // console.log(`URL: ${m.url}`) // Optional: print URL if needed
    })
    console.log('----------------------------------------')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
