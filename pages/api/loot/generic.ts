import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const pools = await prisma.lootPool.findMany({
        where: { classId: null },
        include: {
          items: {
            include: {
              card: true
            }
          }
        }
      })
      
      // Transform to frontend format
      const formattedPools = pools.map(pool => ({
        id: pool.id,
        name: pool.name,
        tier: pool.tier,
        tax: pool.tax,
        items: pool.items.map(item => ({
          id: item.id,
          type: item.type,
          card: item.card,
          skill: item.type === 'Skill' ? {
            name: item.skillName,
            description: item.skillDescription
          } : undefined
        }))
      }))

      return res.status(200).json(formattedPools)
    } catch (error) {
      console.error('Error fetching generic loot:', error)
      return res.status(500).json({ message: 'Failed to fetch generic loot' })
    }
  }

  if (req.method === 'POST') {
    const { pools } = req.body

    try {
      await prisma.$transaction(async (tx) => {
        // Delete all existing generic loot pools
        await tx.lootPool.deleteMany({
          where: { classId: null }
        })

        // Create new pools
        for (const pool of pools) {
          await tx.lootPool.create({
            data: {
              name: pool.name,
              tier: pool.tier,
              tax: pool.tax || 0,
              classId: null,
              items: {
                create: pool.items.map((item: any) => ({
                  type: item.type,
                  cardId: item.type === 'Card' ? item.card.id : undefined,
                  skillName: item.type === 'Skill' ? item.skill.name : undefined,
                  skillDescription: item.type === 'Skill' ? item.skill.description : undefined
                }))
              }
            }
          })
        }
      })

      return res.status(200).json({ message: 'Generic loot saved successfully' })
    } catch (error) {
      console.error('Error saving generic loot:', error)
      return res.status(500).json({ message: 'Failed to save generic loot' })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
