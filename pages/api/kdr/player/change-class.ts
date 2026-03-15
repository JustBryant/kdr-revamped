import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../../lib/kdrHelpers'
import { invalidateKdrCache } from '../../../../lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { kdrId, kdrPlayerId, kdrPlayerKey, newClassId } = req.body || {}
    if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing or invalid kdrId' })
    if ((!kdrPlayerId || typeof kdrPlayerId !== 'string') && (!kdrPlayerKey || typeof kdrPlayerKey !== 'string')) return res.status(400).json({ error: 'Missing or invalid kdrPlayerId or kdrPlayerKey' })
    if (!newClassId || typeof newClassId !== 'string') return res.status(400).json({ error: 'Missing or invalid newClassId' })

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const kdr = await findKdr(kdrId, { select: { id: true, status: true, createdById: true } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    // Only allow when KDR is not started yet
    if (kdr.status !== 'OPEN') return res.status(400).json({ error: 'Cannot change class after the KDR has started' })

    // Only host (createdBy) or admin can change
    const isHost = kdr.createdById && user.id === kdr.createdById
    const isAdmin = user.role === 'ADMIN'
    if (!isHost && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

    let targetPlayerId = kdrPlayerId as string | undefined
    if (!targetPlayerId && kdrPlayerKey) {
      const players = await prisma.kDRPlayer.findMany({ where: { kdrId: kdr.id }, select: { id: true, userId: true } })
      const match = players.find((p) => {
        try {
          const key = (p.userId && kdr.id) ? generatePlayerKey(p.userId, kdr.id) : null
          return key === kdrPlayerKey
        } catch (e) { return false }
      })
      if (!match) return res.status(404).json({ error: 'Player not found (by kdrPlayerKey)' })
      targetPlayerId = match.id
    }

    const player = await prisma.kDRPlayer.findUnique({ where: { id: targetPlayerId } })
    if (!player || player.kdrId !== kdr.id) return res.status(404).json({ error: 'Player not found in this KDR' })

    const oldClassId = player.classId
    if (oldClassId === newClassId) return res.status(200).json({ message: 'No change', player })

    const attachPlayerKey = (p: any) => { if (!p) return p; try { return { ...p, playerKey: (p.userId && kdr?.id) ? generatePlayerKey(p.userId, kdr.id) : null } } catch (e) { return p } }
    
    // Update the player's chosen class
    const updatedPlayer = await prisma.kDRPlayer.update({ where: { id: targetPlayerId as string }, data: { classId: newClassId } })

    // Adjust per-KDR PlayerClassStats.picks: decrement old class pick (if present) and increment new one
    if (oldClassId) {
      const oldStat = await prisma.playerClassStats.findFirst({ where: { userId: player.userId, classId: oldClassId } })
      if (oldStat && oldStat.picks > 0) {
        await prisma.playerClassStats.update({ where: { id: oldStat.id }, data: { picks: Math.max(0, oldStat.picks - 1) } })
      }
    }

    const newStat = await prisma.playerClassStats.findFirst({ where: { userId: player.userId, classId: newClassId } })
    if (!newStat) {
      await prisma.playerClassStats.create({ data: { userId: player.userId, classId: newClassId, picks: 1 } })
    } else {
      await prisma.playerClassStats.update({ where: { id: newStat.id }, data: { picks: { increment: 1 } } })
    }

    try { await invalidateKdrCache(kdr.id) } catch (e) { console.warn('Failed to invalidate KDR cache after change-class', e) }
    return res.status(200).json({ message: 'Player class updated', player: attachPlayerKey(updatedPlayer) })
  } catch (error) {
    console.error('Error changing player class:', error)
    return res.status(500).json({ error: 'Failed to change player class' })
  }
}
