import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import fs from 'fs'
import path from 'path'
import https from 'https'
import "dotenv/config";

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DOWNLOAD_DIR = path.join(process.cwd(), 'card_images')

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath)
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`))
        return
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(filepath, () => {})
      reject(err)
    })
  })
}

async function main() {
  console.log('Fetching cards from database...')
  const cards = await prisma.card.findMany({
    where: {
      imageUrlCropped: {
        not: null
      }
    },
    select: {
      id: true,
      konamiId: true,
      imageUrlCropped: true,
      imageUrl: true
    }
  })

  console.log(`Found ${cards.length} cards with cropped images.`)

  let count = 0
  let errors = 0

  // Process in batches of 20 to be nice to the API
  const BATCH_SIZE = 20
  
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE)
    
    await Promise.all(batch.map(async (card) => {
      if (!card.konamiId) return

      const filename = `${card.konamiId}.jpg`
      const filepath = path.join(DOWNLOAD_DIR, filename)

      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath)
        if (stats.size > 0) {
          // Skip if already exists and has content
          return
        }
        // If size is 0, it's a failed download, so try again
        console.log(`Retrying 0-byte file: ${filename}`)
      }

      try {
        if (card.imageUrlCropped) {
            await downloadImage(card.imageUrlCropped, filepath)
            count++
        } else {
            throw new Error('No cropped image URL')
        }
      } catch (error) {
        // Fallback to full image if cropped fails
        if (card.imageUrl) {
            try {
                console.log(`Fallback to full image for ${card.konamiId}`)
                await downloadImage(card.imageUrl, filepath)
                count++
            } catch (fallbackError) {
                console.error(`Failed to download ${card.konamiId} (both cropped and full):`, fallbackError)
                errors++
            }
        } else {
            console.error(`Failed to download ${card.konamiId}:`, error)
            errors++
        }
      }
    }))

    if ((i + BATCH_SIZE) % 100 === 0) {
      console.log(`Processed ${i + BATCH_SIZE} cards... (Downloaded: ${count}, Errors: ${errors})`)
    }
  }

  console.log(`Download complete! Downloaded ${count} new images. Errors: ${errors}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
