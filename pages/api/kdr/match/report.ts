import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { matchId, scoreA, scoreB, replayUrl } = req.body || {}
    if (!matchId || typeof matchId !== 'string') return res.status(400).json({ error: 'Missing matchId' })
    if (typeof scoreA !== 'number' || typeof scoreB !== 'number') return res.status(400).json({ error: 'Missing or invalid scores' })
    if (!replayUrl || typeof replayUrl !== 'string') return res.status(400).json({ error: 'A DuelingBook replay URL is required with every report' })

    // Basic validation to ensure it's a DuelingBook link — keep permissive but helpful
    const isValidDuelingBookUrl = (url: string) => {
      try {
        const u = new URL(url)
        return /duelingbook/i.test(u.hostname) || /duelingbook/i.test(url)
      } catch (e) {
        return false
      }
    }
    if (!isValidDuelingBookUrl(replayUrl)) return res.status(400).json({ error: 'Invalid DuelingBook replay URL' })

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const match = await prisma.kDRMatch.findUnique({ where: { id: matchId } })
    if (!match) return res.status(404).json({ error: 'Match not found' })

    // If this is a BYE match (no playerB), reporting is not allowed — BYEs are auto-finalized
    if (!match.playerBId) {
      return res.status(400).json({ error: 'BYE matches are auto-finalized and cannot be reported' })
    }

    const reporterPlayer = await prisma.kDRPlayer.findFirst({ where: { id: match.playerAId, userId: user.id } })
    const reporterPlayerB = match.playerBId ? await prisma.kDRPlayer.findFirst({ where: { id: match.playerBId, userId: user.id } }) : null
    const isPlayerAReporter = !!reporterPlayer
    const isPlayerBReporter = !!reporterPlayerB
    const isAdmin = user.role === 'ADMIN'

    if (!isPlayerAReporter && !isPlayerBReporter && !isAdmin) return res.status(403).json({ error: 'Only match players or admins may report' })

    // If no previous provisional report, store the report as provisional and save replay metadata
    if (match.status !== 'REPORTED') {
      const updated = await prisma.kDRMatch.update({
        where: { id: matchId },
        data: {
          scoreA,
          scoreB,
          status: 'REPORTED',
          replayUrl,
          reportedById: user.id,
          reportedAt: new Date(),
        },
      })
      return res.status(200).json({ message: 'Report recorded', match: updated })
    }

    // If there is an existing provisional report, compare values
    // If they match, finalize; if they differ, mark disputed.
    if (match.status === 'REPORTED') {
      // If second reporter provides a differing replay URL, flag dispute
      const existingReplay = match.replayUrl
      if (match.scoreA === scoreA && match.scoreB === scoreB) {
        // Require the replay URL to match the originally submitted one for auto-finalize
        if (existingReplay && existingReplay !== replayUrl) {
          const disputed = await prisma.kDRMatch.update({ where: { id: matchId }, data: { status: 'DISPUTED' } })
          return res.status(200).json({ message: 'Replay mismatch — match flagged as DISPUTED', match: disputed })
        }

        let winnerId: string | null = null
        if (scoreA > scoreB) winnerId = match.playerAId
        else if (scoreB > scoreA && match.playerBId) winnerId = match.playerBId
        
        const finalized = await prisma.kDRMatch.update({ where: { id: matchId }, data: { status: 'COMPLETED', winnerId } })

        // Update Stats on Finalization
        if (winnerId) {
          const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId
          const winPlayer = await prisma.kDRPlayer.findUnique({ where: { id: winnerId }, select: { userId: true, classId: true } })
          const losePlayer = loserId ? await prisma.kDRPlayer.findUnique({ where: { id: loserId }, select: { userId: true, classId: true } }) : null

          // Winner Stats
          if (winPlayer?.userId) {
            const ps = await prisma.playerStats.findFirst({ where: { userId: winPlayer.userId } })
            if (ps) {
              const s = (ps.stats as any) || {}
              await prisma.playerStats.update({
                where: { id: ps.id },
                data: { stats: { ...s, wins: (s.wins || 0) + 1, gamesPlayed: (s.gamesPlayed || 0) + 1 } }
              })
            }
            if (winPlayer.classId) {
              const cs = await prisma.playerClassStats.findFirst({ where: { userId: winPlayer.userId, classId: winPlayer.classId } })
              if (cs) {
                const s = (cs.stats as any) || {}
                await prisma.playerClassStats.update({
                  where: { id: cs.id },
                  data: { stats: { ...s, wins: (s.wins || 0) + 1 } }
                })
              }
            }
          }

          // Loser Stats
          if (losePlayer?.userId) {
            const ps = await prisma.playerStats.findFirst({ where: { userId: losePlayer.userId } })
            if (ps) {
              const s = (ps.stats as any) || {}
              await prisma.playerStats.update({
                where: { id: ps.id },
                data: { stats: { ...s, losses: (s.losses || 0) + 1, gamesPlayed: (s.gamesPlayed || 0) + 1 } }
              })
            }
            if (losePlayer.classId) {
              const cs = await prisma.playerClassStats.findFirst({ where: { userId: losePlayer.userId, classId: losePlayer.classId } })
              if (cs) {
                const s = (cs.stats as any) || {}
                await prisma.playerClassStats.update({
                  where: { id: cs.id },
                  data: { stats: { ...s, losses: (s.losses || 0) + 1 } }
                })
              }
            }
          }
        }

        return res.status(200).json({ message: 'Match result confirmed and finalized', match: finalized })
      }

      const disputed = await prisma.kDRMatch.update({ where: { id: matchId }, data: { status: 'DISPUTED' } })
      return res.status(200).json({ message: 'Discrepancy detected — match flagged as DISPUTED', match: disputed })
    }

    return res.status(400).json({ error: 'Unable to process report' })
  } catch (error) {
    console.error('Error reporting match:', error)
    return res.status(500).json({ error: 'Failed to report match' })
  }
}
