import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import "dotenv/config";

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Fetching cards from YGOPRODeck API...')
  
  // Fetch all cards
  const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php')
  const data = await response.json()
  
  if (!data.data) {
    console.error('Failed to fetch cards')
    return
  }

  const cards = data.data
  console.log(`Found ${cards.length} cards. Starting sync...`)

  let count = 0
  
  // Process in chunks to avoid memory issues
  for (const card of cards) {
    // Filter out Skill Cards and known invalid cards
    if (
      card.type === 'Skill Card' || 
      card.name.includes('(Skill Card)') ||
      (card.id >= 300000000 && card.id < 301000000) || // Skill Card ID range
      [662853, 662854, 662855, 662857, 111000561, 100000101].includes(card.id) // Prize/Special cards
    ) {
      continue
    }

    try {
      await prisma.card.upsert({
        where: { konamiId: card.id },
        update: {
          name: card.name,
          type: card.type,
          desc: card.desc,
          atk: card.atk,
          def: card.def,
          level: card.level,
          race: card.race,
          attribute: card.attribute,
          archetype: card.archetype,
          scale: card.scale,
          linkVal: card.linkval,
          linkMarkers: card.linkmarkers || [],
          imageUrl: card.card_images?.[0]?.image_url,
          imageUrlSmall: card.card_images?.[0]?.image_url_small,
          imageUrlCropped: card.card_images?.[0]?.image_url_cropped,
        },
        create: {
          konamiId: card.id,
          name: card.name,
          type: card.type,
          desc: card.desc,
          atk: card.atk,
          def: card.def,
          level: card.level,
          race: card.race,
          attribute: card.attribute,
          archetype: card.archetype,
          scale: card.scale,
          linkVal: card.linkval,
          linkMarkers: card.linkmarkers || [],
          imageUrl: card.card_images?.[0]?.image_url,
          imageUrlSmall: card.card_images?.[0]?.image_url_small,
          imageUrlCropped: card.card_images?.[0]?.image_url_cropped,
        }
      })
      
      count++
      if (count % 100 === 0) {
        console.log(`Synced ${count} cards...`)
      }
    } catch (error) {
      console.error(`Failed to sync card ${card.name} (${card.id}):`, error)
    }
  }

  console.log(`Sync complete! Processed ${count} cards.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
