import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { q } = req.query

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ message: 'Query parameter is required' })
  }

  try {
    const cards = await prisma.card.findMany({
      where: {
        name: {
          contains: q,
          mode: 'insensitive',
        },
      },
      take: 10,
      select: {
        id: true,
        konamiId: true,
        name: true,
        type: true,
        desc: true,
        atk: true,
        def: true,
        level: true,
        race: true,
        attribute: true,
        imageUrl: true,
        imageUrlSmall: true,
      },
    })

    res.status(200).json(cards)
  } catch (error) {
    console.error('Error searching cards:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
