const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

const connectionString = "postgresql://kdr-revamped_owner:npg_Lg5Htm3UexiM@ep-black-water-a5qpsunx-pooler.us-east-2.aws.neon.tech/kdr-revamped?sslmode=require"
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding initial cosmetics...')

  const items = [
    {
      name: 'Blue Eyes Border',
      description: 'A legendary border for the strongest duelist.',
      price: 500,
      type: 'BORDER',
      imageUrl: 'https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/89631139.jpg',
      isSellable: true,
    },
    {
      name: 'Dark Magician Frame',
      description: 'The ultimate frame in terms of attack and defense.',
      price: 1000,
      type: 'FRAME',
      imageUrl: 'https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/46986414.jpg',
      isSellable: true,
    },
    {
      name: 'King of Games',
      description: 'A title fit for a champion.',
      price: 1500,
      type: 'TITLE',
      isSellable: true,
    },
  ]

  for (const item of items) {
    try {
      const externalId = item.name.replace(/\s+/g, '_').toLowerCase()
      await prisma.item.upsert({
        where: { externalId: externalId },
        update: {},
        create: {
          ...item,
          externalId: externalId,
        },
      })
      console.log(`Upserted: ${item.name}`)
    } catch (err) {
      console.error(`Failed to upsert ${item.name}:`, err)
    }
  }

  console.log('Seeding complete.')
  await prisma.$disconnect()
  process.exit(0)
}

main()
