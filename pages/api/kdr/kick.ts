import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../lib/kdrHelpers'
import { appendAudit } from '../../../lib/adminAudit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { kdrId, playerId, playerKey } = req.body || {}
  if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing kdrId' })
  if ((!playerId || typeof playerId !== 'string') && (!playerKey || typeof playerKey !== 'string')) return res.status(400).json({ error: 'Missing playerId or playerKey' })

  try {
    const kdr = await findKdr(kdrId, { select: { id: true, name: true, createdById: true, createdBy: { select: { id: true, email: true } } } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    const userId = session?.user?.id
    const userEmail = session?.user?.email
    const isHost = (kdr.createdBy && userEmail && kdr.createdBy.email === userEmail) || (kdr.createdById && userId && kdr.createdById === userId)
    if (!isHost) return res.status(403).json({ error: 'Forbidden' })

    let targetPlayerId = playerId as string | undefined

    // If a playerKey was supplied, resolve it to the internal player id
    if (!targetPlayerId && playerKey) {
      const players = await (prisma as any).kDRPlayer.findMany({
        where: { kdrId: kdr.id },
        include: { user: { select: { id: true } } }
      })
      const match = players.find((p: any) => {
        try {
          const key = generatePlayerKey(p.user?.id, kdr.id)
          return key === playerKey
        } catch (e) { return false }
      })
      if (!match) return res.status(404).json({ error: `Player not found (by playerKey: ${playerKey})` })
      targetPlayerId = match.id
    }

    if (!targetPlayerId) return res.status(400).json({ error: 'Missing player id' })

    const player = await (prisma as any).kDRPlayer.findUnique({ 
      where: { id: targetPlayerId },
      include: { user: { select: { email: true, name: true } } } 
    })
    if (!player) return res.status(404).json({ error: 'Player not found' })
    if (player.kdrId !== kdr.id) return res.status(400).json({ error: 'Player does not belong to the specified KDR' })

    // Mark player as kicked. Do not hard-delete to preserve history.
    await prisma.kDRPlayer.update({ where: { id: targetPlayerId }, data: { status: 'KICKED' } })

    // Log the kick
    appendAudit({
      adminEmail: userEmail || 'unknown',
      action: 'KICK_PLAYER',
      targetId: targetPlayerId,
      details: {
        kdrId,
        kdrName: kdr.name,
        playerEmail: player.user?.email,
        playerName: player.user?.name
      }
    })

    return res.status(200).json({ success: true, kickedId: targetPlayerId })
  } catch (error) {
    console.error('Failed to kick player', error)
    return res.status(500).json({ error: 'Failed to kick player' })
  }
}
