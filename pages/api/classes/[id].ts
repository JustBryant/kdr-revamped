import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const isAdmin = session?.user && (session.user as any).role === 'ADMIN'

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid class ID' })
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    try {
      // Deleting a class involves several relations. 
      // Prisma cascading deletes should handle ClassCard, LootPool, FormatClass, etc.
      // because they are typically defined with onDelete: Cascade in schema.prisma.
      
      await prisma.class.delete({
        where: { id }
      })

      return res.status(200).json({ message: 'Class deleted successfully' })
    } catch (error) {
      console.error('Error deleting class:', error)
      return res.status(500).json({ message: 'Failed to delete class' })
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
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
                card: true,
                skill: {
                  include: {
                    modifications: { include: { card: true } },
                    providesCards: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' })
    }

    // Privacy check: only admins can see private classes
    if (!classData.isPublic && !isAdmin) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Dev debug: log skills/modifications counts when fetching class
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] /api/classes/[id] fetched class', id)
        console.log('[DEBUG] skills count:', (classData.skills || []).length)
        for (const s of (classData.skills || [])) {
          console.log('[DEBUG] skill', s.id || s.name, 'modifications:', (s.modifications || []).length)
        }
        console.log('[DEBUG] lootPools count:', (classData.lootPools || []).length)
        for (const p of (classData.lootPools || [])) {
          for (const it of (p.items || [])) {
            if (it.type === 'Skill' && it.skillName) {
              // Note: loot pool items may carry skillName/skillDescription rather than full skill object
              console.log('[DEBUG] loot pool item skillName:', it.skillName)
            }
          }
        }
      }
    } catch (e) {
      console.warn('[DEBUG] Failed to log classData shape', e)
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
