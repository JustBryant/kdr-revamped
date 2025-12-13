import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import "dotenv/config";

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Fetching cards from YGOPRODeck API...')
  
  try {
    const { data } = await axios.get('https://db.ygoprodeck.com/api/v7/cardinfo.php')
    const cards = data.data
    
    console.log(`Fetched ${cards.length} cards. Starting seed...`)

    // Process in chunks to avoid memory issues and connection timeouts
    const chunkSize = 100
    for (let i = 0; i < cards.length; i += chunkSize) {
      const chunk = cards.slice(i, i + chunkSize)
      
      const operations = chunk.map((card: any) => {
        return prisma.card.upsert({
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
            linkMarkers: card.linkmarkers,
            imageUrl: card.card_images[0]?.image_url,
            imageUrlSmall: card.card_images[0]?.image_url_small,
            imageUrlCropped: card.card_images[0]?.image_url_cropped,
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
            linkMarkers: card.linkmarkers,
            imageUrl: card.card_images[0]?.image_url,
            imageUrlSmall: card.card_images[0]?.image_url_small,
            imageUrlCropped: card.card_images[0]?.image_url_cropped,
          },
        })
      })

      await prisma.$transaction(operations)
      console.log(`Processed ${i + chunk.length}/${cards.length} cards`)
    }

    console.log('Seeding completed successfully.')
  } catch (error) {
    console.error('Error seeding cards:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
