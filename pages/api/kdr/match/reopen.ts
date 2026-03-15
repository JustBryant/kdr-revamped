import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { findKdr } from '../../../../lib/kdrHelpers'
import { invalidateKdrCache } from '../../../../lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { matchId } = req.body || {}
    if (!matchId || typeof matchId !== 'string') return res.status(400).json({ error: 'Missing matchId' })

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const match = await (prisma as any).kDRMatch.findUnique({ where: { id: matchId }, include: { round: true } })
    if (!match) return res.status(404).json({ error: 'Match not found' })

    const round = match.round
    if (!round) return res.status(400).json({ error: 'Match round not found' })

    const kdr = await findKdr(round.kdrId, { include: { createdBy: true } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    // Only the KDR host or an admin may reopen matches
    const isAdmin = user.role === 'ADMIN'
    if (!isAdmin && kdr.createdById !== user.id && kdr.createdBy?.email !== session.user.email) {
      return res.status(403).json({ error: 'Only the KDR host or an admin may reopen matches' })
    }

    // Only proceed if match was completed or reported/disputed
    if (match.status !== 'COMPLETED' && match.status !== 'DISPUTED' && match.status !== 'REPORTED') {
      return res.status(400).json({ error: `Cannot reopen match with status ${match.status}` })
    }

    // Fetch players to map to users
    const playerA = match.playerAId ? await (prisma as any).kDRPlayer.findUnique({ where: { id: match.playerAId }, select: { userId: true, classId: true } }) : null
    const playerB = match.playerBId ? await (prisma as any).kDRPlayer.findUnique({ where: { id: match.playerBId }, select: { userId: true, classId: true } }) : null

    // Revert match: clear winner and reset status to SCHEDULED
    const reverted = await prisma.kDRMatch.update({ where: { id: matchId }, data: { status: 'SCHEDULED', winnerId: null, scoreA: 0, scoreB: 0 } })

    try { await invalidateKdrCache(round.kdrId) } catch (e) { console.warn('Failed to invalidate KDR cache after reopen', e) }
    // Adjust PlayerStats counters safely (do not go below zero)
    const safeAdjust = async (userId: string | undefined, deltaWins: number, deltaLosses: number, deltaGames: number) => {
      if (!userId) return
      const ps = await prisma.playerStats.findFirst({ where: { userId } })
      if (!ps) return
      const s = (ps.stats as any) || {}
      const curWins = Number(s.wins || 0)
      const curLosses = Number(s.losses || 0)
      const curGames = Number(s.gamesPlayed || 0)
      const newWins = Math.max(0, curWins + deltaWins)
      const newLosses = Math.max(0, curLosses + deltaLosses)
      const newGames = Math.max(0, curGames + deltaGames)
      const newStats = { ...s, wins: newWins, losses: newLosses, gamesPlayed: newGames }
      await prisma.playerStats.update({ where: { id: ps.id }, data: { stats: newStats } })
    }

    const safeAdjustClass = async (userId: string | undefined, classId: string | undefined, winDelta: number, lossDelta: number) => {
      if (!userId || !classId) return
      const cs = await prisma.playerClassStats.findFirst({ where: { userId, classId } })
      if (!cs) return
      const cstats = (cs.stats as any) || {}
      const curWins = Number(cstats.wins || 0)
      const curLosses = Number(cstats.losses || 0)
      const newWins = Math.max(0, curWins + winDelta)
      const newLosses = Math.max(0, curLosses + lossDelta)
      const newStats = { ...cstats, wins: newWins, losses: newLosses }
      await prisma.playerClassStats.update({ where: { id: cs.id }, data: { stats: newStats } })
    }

    if (match.winnerId) {
      let winnerUserId: string | undefined
      let loserUserId: string | undefined
      let winnerClassId: string | undefined
      let loserClassId: string | undefined
      if (match.winnerId === match.playerAId) {
        winnerUserId = playerA?.userId ?? undefined
        loserUserId = playerB?.userId ?? undefined
        winnerClassId = playerA?.classId ?? undefined
        loserClassId = playerB?.classId ?? undefined
      } else if (match.winnerId === match.playerBId) {
        winnerUserId = playerB?.userId ?? undefined
        loserUserId = playerA?.userId ?? undefined
        winnerClassId = playerB?.classId ?? undefined
        loserClassId = playerA?.classId ?? undefined
      }

      await safeAdjust(winnerUserId ?? undefined, -1, 0, -1)
      await safeAdjust(loserUserId ?? undefined, 0, -1, -1)

      await safeAdjustClass(winnerUserId ?? undefined, winnerClassId ?? undefined, -1, 0)
      await safeAdjustClass(loserUserId ?? undefined, loserClassId ?? undefined, 0, -1)
    } else {
      await safeAdjust(playerA?.userId, 0, 0, -1)
      await safeAdjust(playerB?.userId, 0, 0, -1)
    }

    return res.status(200).json({ message: 'Match reopened (reverted to SCHEDULED)', match: reverted })
  } catch (error) {
    console.error('Error reopening match:', error)
    return res.status(500).json({ error: 'Failed to reopen match' })
  }
}
