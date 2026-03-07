import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../lib/kdrHelpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  // Allow public read; specific actions check authorization.
  
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' })

  if (req.method === 'GET') {
    try {
      const kdr = await findKdr(id, {
        include: {
          format: true,
          createdBy: { select: { id: true, name: true, email: true } },
          players: { 
            include: { 
              user: { select: { id: true, name: true, email: true, image: true } }, 
              playerDeck: true,
              playerClass: { select: { id: true, name: true, image: true } }
            } 
          },
          rounds: { 
            include: { 
              matches: { 
                include: { 
                  playerA: { include: { user: { select: { id: true, name: true, image: true } } } },
                  playerB: { include: { user: { select: { id: true, name: true, image: true } } } },
                  winner: { include: { user: { select: { id: true, name: true, image: true } } } }
                } 
              } 
            }, 
            orderBy: { number: 'asc' } 
          }
        }
      })
      if (!kdr) return res.status(404).json({ error: 'KDR not found' })
      // If the KDR was soft-deleted, treat as not found for now.
      if (kdr.status === 'DELETED') return res.status(404).json({ error: 'KDR not found' })
      
      // Fetch generic loot pools (no classId) for the format
      let genericLootPools: any[] = []
      if (kdr.formatId) {
        genericLootPools = await prisma.lootPool.findMany({
          where: { classId: null },
          include: {
            items: {
              include: {
                card: true
              }
            }
          }
        })
      }
      
      // Attach currentPlayer for the requesting session user if present
      let currentPlayer = null
      try {
        const userId = (session?.user as any)?.id
        const userEmail = session?.user?.email
        if (userId || userEmail) {
          const user = await prisma.user.findFirst({
            where: { OR: [
              { id: userId || undefined },
              { email: userEmail || undefined }
            ]}
          })
          if (user) {
            // Use the resolved canonical KDR id (kdr.id) so requests by slug work correctly
            // Cast to `any` because the generated Prisma client may have a different include shape
            const cp = await (prisma.kDRPlayer as any).findFirst({ 
              where: { kdrId: kdr.id, userId: user.id }, 
              include: { 
                playerDeck: true, 
                playerClass: { select: { id: true, name: true, image: true } },
                user: { select: { id: true, name: true, email: true } } 
              } 
            })
            if (cp) currentPlayer = cp
          }
        }
      } catch (e) {
        console.error('Failed to load currentPlayer', e)
      }

      // Attach a stable playerKey for each player (frontend should prefer this)
      const playersWithKey = (kdr.players || []).map((p: any) => ({
        ...p,
        playerKey: (p.user?.id && kdr?.id) ? generatePlayerKey(p.user.id, kdr.id) : null
      }))

      const currentWithKey = currentPlayer ? { ...currentPlayer, playerKey: (currentPlayer.user?.id && kdr?.id) ? generatePlayerKey(currentPlayer.user.id, kdr.id) : null } : null

      // Omit raw password from response, instead provide a boolean flag
      const { password: _, ...passlessKdr } = kdr
      const hasPassword = !!kdr.password

      return res.status(200).json({
        ...passlessKdr,
        hasPassword,
        players: playersWithKey,
        currentPlayer: currentWithKey,
        genericLootPools
      })
    } catch (error) {
      console.error('Failed to fetch KDR', error)
      return res.status(500).json({ error: 'Failed to fetch KDR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
