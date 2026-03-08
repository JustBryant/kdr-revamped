import { PrismaClient, ItemType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding initial cosmetics...')

  const items = [
    {
      name: 'Blue Eyes Border',
      description: 'A legendary border for the strongest duelist.',
      price: 500,
      type: 'BORDER' as any,
      imageUrl: 'https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/89631139.jpg',
      isSellable: true,
    },
    {
      name: 'Dark Magician Frame',
      description: 'The ultimate frame in terms of attack and defense.',
      price: 1000,
      type: 'FRAME' as any,
      imageUrl: 'https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/46986414.jpg',
      isSellable: true,
    },
    {
      name: 'King of Games',
      description: 'A title fit for a champion.',
      price: 1500,
      type: 'TITLE' as any,
      isSellable: true,
    },
  ]

  for (const item of items) {
    await prisma.item.upsert({
      where: { externalId: item.name.replace(/\s+/g, '_').toLowerCase() },
      update: {},
      create: {
        ...item,
        externalId: item.name.replace(/\s+/g, '_').toLowerCase(),
      },
    })
  }

  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
