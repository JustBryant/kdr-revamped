import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const items = [
      {
        externalId: 'blue_eyes_border',
        name: 'Blue Eyes Border',
        description: 'A legendary border for the strongest duelist.',
        price: 500,
        type: 'BORDER' as any,
        imageUrl: 'https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/89631139.jpg',
        isSellable: true,
      },
      {
        externalId: 'dark_magician_frame',
        name: 'Dark Magician Frame',
        description: 'The ultimate frame in terms of attack and defense.',
        price: 1000,
        type: 'FRAME' as any,
        imageUrl: 'https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/46986414.jpg',
        isSellable: true,
      },
      {
        externalId: 'king_of_games_title',
        name: 'King of Games',
        description: 'A title fit for a champion.',
        price: 1500,
        type: 'TITLE' as any,
        isSellable: true,
      },
    ]

    for (const item of items) {
      await prisma.item.upsert({
        where: { externalId: item.externalId },
        update: item,
        create: item,
      })
    }

    return res.status(200).json({ message: 'Cosmetics seeded successfully' })
  } catch (error: any) {
    console.error('Seeding error:', error)
    return res.status(500).json({ error: error.message })
  }
}
