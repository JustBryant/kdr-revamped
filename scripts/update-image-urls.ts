import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import "dotenv/config";

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const GITHUB_REPO_URL = 'https://raw.githubusercontent.com/JustBryant/card-images/main'

async function main() {
  console.log('Updating card image URLs to point to GitHub...')
  
  // We can do this in a single batch update or iterate if we want to be safe.
  // Since we want to construct the URL based on the Konami ID, we might need to iterate or use raw SQL.
  // Prisma doesn't support "update where column = value constructed from other column" easily without raw SQL.
  
  // Let's try a raw query for efficiency if possible, but PrismaPg adapter might make raw queries tricky with syntax.
  // Let's stick to iteration with Promise.all for safety and compatibility.
  
  const cards = await prisma.card.findMany({
    where: {
      konamiId: { not: null }
    },
    select: { id: true, konamiId: true }
  })

  console.log(`Updating ${cards.length} cards...`)

  const BATCH_SIZE = 100
  let updated = 0

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE)
    
    await prisma.$transaction(
      batch.map(card => 
        prisma.card.update({
          where: { id: card.id },
          data: {
            imageUrlCropped: `${GITHUB_REPO_URL}/${card.konamiId}.jpg`,
            // We can also update the main image URL if we downloaded full images, 
            // but our script focused on cropped (mostly). 
            // If you want to use the github repo for ALL images, we can update this too.
            // For now, let's stick to cropped as requested.
          }
        })
      )
    )
    updated += batch.length
    if (updated % 1000 === 0) console.log(`Updated ${updated} cards...`)
  }

  console.log('All card URLs updated successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
