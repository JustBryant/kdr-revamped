import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid class ID' })
  }

  try {
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        startingCards: {
          include: {
            card: true
          }
        },
        skills: {
          include: {
            modifications: {
              include: {
                card: true
              }
            },
            providesCards: true
          }
        },
        lootPools: {
          include: {
            items: {
              include: {
                card: true
              }
            }
          }
        }
      }
    })

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' })
    }

    // Fetch legendary monster card details if it exists
    let legendaryMonster = null
    if (classData.legendaryMonster) {
      legendaryMonster = await prisma.card.findUnique({
        where: { id: classData.legendaryMonster }
      })
    }

    res.status(200).json({ ...classData, legendaryMonsterCard: legendaryMonster })
  } catch (error) {
    console.error('Error fetching class:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
