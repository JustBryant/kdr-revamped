import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { matchId } = req.body || {}
    if (!matchId || typeof matchId !== 'string') return res.status(400).json({ error: 'Missing matchId' })

    const admin = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
    if (!admin) return res.status(404).json({ error: 'User not found' })
    if (admin.role !== 'ADMIN') return res.status(403).json({ error: 'Only admins may undo matches' })

    const match = await prisma.kDRMatch.findUnique({ where: { id: matchId } })
    if (!match) return res.status(404).json({ error: 'Match not found' })

    // Only proceed if match was completed (or allow undo of disputed/reported)
    if (match.status !== 'COMPLETED' && match.status !== 'DISPUTED' && match.status !== 'REPORTED') {
      return res.status(400).json({ error: `Cannot undo match with status ${match.status}` })
    }

    // Fetch players to map to users
    const playerA = match.playerAId ? await prisma.kDRPlayer.findUnique({ where: { id: match.playerAId }, select: { userId: true, classId: true } }) : null
    const playerB = match.playerBId ? await prisma.kDRPlayer.findUnique({ where: { id: match.playerBId }, select: { userId: true, classId: true } }) : null

    // Revert match: clear winner and reset status to SCHEDULED
    const reverted = await prisma.kDRMatch.update({ where: { id: matchId }, data: { status: 'SCHEDULED', winnerId: null, scoreA: 0, scoreB: 0 } })

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

    // If match had a winner, decrement winner.wins and loser.losses and both.gamesPlayed and adjust class stats
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
      // Map winner to userId and deckId
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

      // revert class stats: winner -1 win, loser -1 loss (use stored classId)
      await safeAdjustClass(winnerUserId ?? undefined, winnerClassId ?? undefined, -1, 0)
      await safeAdjustClass(loserUserId ?? undefined, loserClassId ?? undefined, 0, -1)
    } else {
      // No winner (draw or bye finalization), decrement gamesPlayed for participants only
      await safeAdjust(playerA?.userId, 0, 0, -1)
      await safeAdjust(playerB?.userId, 0, 0, -1)
    }

    return res.status(200).json({ message: 'Match undone (reverted to SCHEDULED)', match: reverted })
  } catch (error) {
    console.error('Error undoing match:', error)
    return res.status(500).json({ error: 'Failed to undo match' })
  }
}
