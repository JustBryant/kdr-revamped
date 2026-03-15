import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { persistStateForPlayer } from '../../../../lib/shop-v2/state'
import { invalidateKdrCache } from '../../../../lib/redis'

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
          status: 'COMPLETED',
          replayUrl,
          reportedById: user.id,
          reportedAt: new Date(),
          winnerId: scoreA > scoreB ? match.playerAId : (scoreB > scoreA ? match.playerBId : null)
        },
      })

      // Update Stats on Finalization
      const winnerId = scoreA > scoreB ? match.playerAId : (scoreB > scoreA ? match.playerBId : null)
      if (winnerId) {
        const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId
        const winPlayer = await prisma.kDRPlayer.findUnique({ where: { id: winnerId }, select: { userId: true, classId: true } })
        
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
        }

        // Loser Stats
        if (loserId) {
          const losePlayer = await prisma.kDRPlayer.findUnique({ where: { id: loserId }, select: { userId: true } })
          if (losePlayer?.userId) {
            const ps = await prisma.playerStats.findFirst({ where: { userId: losePlayer.userId } })
            if (ps) {
              const s = (ps.stats as any) || {}
              await prisma.playerStats.update({
                where: { id: ps.id },
                data: { stats: { ...s, losses: (s.losses || 0) + 1, gamesPlayed: (s.gamesPlayed || 0) + 1 } }
              })
            }
          }
        }
      }

      // Trigger Pusher updates
      try {
        const { triggerPusher } = await import('../../../../lib/pusher')
        await triggerPusher('kdr-lobby', 'match-update', { type: 'match-update', matchId })
        if (match.kdrId) {
          await triggerPusher(`kdr-${match.kdrId}`, 'update', { type: 'update', action: 'match-reported' })
        }
      } catch (e) {
        console.error('Failed to trigger Pusher for match report:', e)
      }

      // Ensure both players get a fresh per-round shop instance for the current round.
      try {
        if (match.kdrId) {
          const latestRound = await prisma.kDRRound.findFirst({ where: { kdrId: match.kdrId }, orderBy: { number: 'desc' }, select: { number: true } })
          const currentRoundNumber = Number(latestRound?.number || 0)

          const playerIds = [match.playerAId, match.playerBId].filter(Boolean) as string[]
          for (const pid of playerIds) {
            try {
              const p = await prisma.kDRPlayer.findUnique({ where: { id: pid }, select: { shopState: true, stats: true } })
              const resetState = {
                chosenSkills: [],
                purchases: [],
                tipAmount: 0,
                lootOffers: [],
                pendingSkillChoices: [],
                statPoints: (p?.shopState as any)?.statPoints || 0,
                history: [],
                stage: 'START',
                stats: (p?.stats as any) || {},
                shopAwarded: false
              }
              await persistStateForPlayer({ playerId: pid, roundNumber: currentRoundNumber, partial: resetState, playerShopState: p?.shopState })
            } catch (e) {
              console.error(`[SHOP:ERROR] Failed to prepare shop instance for player ${pid}:`, e)
            }
          }
        }
      } catch (e) {
        console.error('Failed to ensure per-round shop instances after match report:', e)
      }

      try { if (match.kdrId) await invalidateKdrCache(match.kdrId) } catch (e) { console.warn('Failed to invalidate KDR cache after match report', e) }
      return res.status(200).json({ message: 'Match result confirmed and finalized' })
    }

    return res.status(400).json({ error: 'Unable to process report' })
  } catch (error) {
    console.error('Error reporting match:', error)
    return res.status(500).json({ error: 'Failed to report match' })
  }
}
