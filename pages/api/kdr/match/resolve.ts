import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { appendAudit } from '../../../../lib/adminAudit'
import { invalidateKdrCache } from '../../../../lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { matchId, scoreA, scoreB, winnerId } = req.body || {}
    if (!matchId || typeof matchId !== 'string') return res.status(400).json({ error: 'Missing matchId' })

    const admin = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true, email: true } })
    if (!admin) return res.status(404).json({ error: 'User not found' })
    if (admin.role !== 'ADMIN') return res.status(403).json({ error: 'Only admins may resolve disputed matches' })

    const match = await prisma.kDRMatch.findUnique({ 
      where: { id: matchId },
      include: { 
        playerA: { include: { user: { select: { name: true } } } },
        playerB: { include: { user: { select: { name: true } } } }
      }
    })
    if (!match) return res.status(404).json({ error: 'Match not found' })

    // Validate winnerId if provided
    if (winnerId && winnerId !== match.playerAId && winnerId !== match.playerBId) {
      return res.status(400).json({ error: 'winnerId must be one of the match players' })
    }

    // Finalize match (do not set reportedById - field removed from schema)
    const updatedMatch = await prisma.kDRMatch.update({ where: { id: matchId }, data: { scoreA: typeof scoreA === 'number' ? scoreA : match.scoreA, scoreB: typeof scoreB === 'number' ? scoreB : match.scoreB, winnerId: winnerId || (typeof scoreA === 'number' && typeof scoreB === 'number' ? (scoreA > scoreB ? match.playerAId : (scoreB > scoreA ? match.playerBId : null)) : null), status: 'COMPLETED' } })

    try { if (match && match.kdrId) await invalidateKdrCache(match.kdrId) } catch (e) { console.warn('Failed to invalidate KDR cache after match resolve', e) }

    // Log the override
    appendAudit({
      adminEmail: admin.email || 'unknown',
      action: 'RESOLVE_MATCH_OVERRIDE',
      targetId: matchId,
      details: {
        playerA: match.playerA?.user?.name,
        playerB: match.playerB?.user?.name,
        newScore: `${scoreA}-${scoreB}`,
        winnerId: winnerId
      }
    })
    // Update player stats (PlayerStats) and per-class stats (PlayerClassStats) for winner/loser
    const playerA = match.playerAId ? await prisma.kDRPlayer.findUnique({ where: { id: match.playerAId }, select: { userId: true, classId: true } }) : null
    const playerB = match.playerBId ? await prisma.kDRPlayer.findUnique({ where: { id: match.playerBId }, select: { userId: true, classId: true } }) : null

    const applyPlayerStats = async (userId: string | undefined, win: boolean, loss: boolean) => {
      if (!userId) return
      let ps = await prisma.playerStats.findFirst({ where: { userId } })
      if (!ps) {
        const initial = { wins: win ? 1 : 0, losses: loss ? 1 : 0, gamesPlayed: 1 }
        await prisma.playerStats.create({ data: { userId, stats: initial } })
      } else {
        const s = (ps.stats as any) || {}
        const newStats = { ...s, wins: (Number(s.wins || 0) + (win ? 1 : 0)), losses: (Number(s.losses || 0) + (loss ? 1 : 0)), gamesPlayed: (Number(s.gamesPlayed || 0) + 1) }
        await prisma.playerStats.update({ where: { id: ps.id }, data: { stats: newStats } })
      }
    }

    const applyClassStats = async (userId: string | undefined, classId: string | undefined, winInc: number, lossInc: number) => {
      if (!userId || !classId) return
      const classStat = await prisma.playerClassStats.findFirst({ where: { userId, classId } })
      if (!classStat) {
        const initial = { wins: Math.max(0, winInc), losses: Math.max(0, lossInc), picks: 0 }
        await prisma.playerClassStats.create({ data: { userId, classId, stats: initial } })
      } else {
        const cs = (classStat.stats as any) || {}
        const newStats = { ...cs, wins: (Number(cs.wins || 0) + winInc), losses: (Number(cs.losses || 0) + lossInc) }
        await prisma.playerClassStats.update({ where: { id: classStat.id }, data: { stats: newStats } })
      }
    }

    // Determine winner from updatedMatch.winnerId
    const resolvedWinnerId = updatedMatch.winnerId
    if (resolvedWinnerId) {
      // winner and loser mapping
      const winnerPlayer = resolvedWinnerId === match.playerAId ? playerA : playerB
      const loserPlayer = resolvedWinnerId === match.playerAId ? playerB : playerA
      await applyPlayerStats(winnerPlayer?.userId ?? undefined, true, false)
      await applyPlayerStats(loserPlayer?.userId ?? undefined, false, true)

      // Update class stats: winner +1 win, loser +1 loss (use stored per-KDR classId)
      await applyClassStats(winnerPlayer?.userId ?? undefined, winnerPlayer?.classId ?? undefined, 1, 0)
      await applyClassStats(loserPlayer?.userId ?? undefined, loserPlayer?.classId ?? undefined, 0, 1)
      // Award 1 stat point to each participant for playing a match (skip BYE/null opponents)
      try {
        const participants = [match.playerAId, match.playerBId].filter(Boolean) as string[]
        for (const pid of participants) {
          try {
            const p = await prisma.kDRPlayer.findUnique({ where: { id: pid } })
            if (!p) continue
            const cs = (p.shopState as any) || {}
            const curPoints = Number(cs.statPoints || 0)
            const newState = { ...cs, statPoints: curPoints + 1 }
            await prisma.kDRPlayer.update({ where: { id: pid }, data: { shopState: newState } })
          } catch (e) {}
        }
      } catch (e) {}
    } else {
      // draw -> increment gamesPlayed and picks for both
      await applyPlayerStats(playerA?.userId ?? undefined, false, false)
      await applyPlayerStats(playerB?.userId ?? undefined, false, false)
      await applyClassStats(playerA?.userId ?? undefined, playerA?.classId ?? undefined, 0, 0)
      await applyClassStats(playerB?.userId ?? undefined, playerB?.classId ?? undefined, 0, 0)
    }

    return res.status(200).json({ message: 'Match resolved by admin', match: updatedMatch })
  } catch (error) {
    console.error('Error resolving match:', error)
    return res.status(500).json({ error: 'Failed to resolve match' })
  }
}
