import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const treasures = await prisma.lootItem.findMany({
        where: {
          type: 'Card'
        },
        include: {
          card: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      return res.status(200).json(treasures)
    } catch (error) {
      console.error('Error fetching treasures:', error)
      return res.status(500).json({ error: 'Failed to fetch treasures' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { cardId, rarity } = req.body

      if (!cardId || !rarity) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const treasure = await prisma.lootItem.create({
        data: {
          type: 'Card',
          cardId,
          rarity
        },
        include: {
          card: true
        }
      })

      return res.status(201).json(treasure)
    } catch (error) {
      console.error('Error creating treasure:', error)
      return res.status(500).json({ error: 'Failed to create treasure' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
