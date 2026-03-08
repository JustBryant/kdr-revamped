import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../lib/kdrHelpers'

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { kdrId } = req.body || {}
    if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing kdrId' })

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const kdr = await findKdr(kdrId, {
      include: {
        rounds: { include: { matches: true } }
      }
    })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })
    const canonicalKdrId = kdr.id

    // Check if the tournament is already completed
    if (kdr.status === 'COMPLETED') return res.status(400).json({ error: 'Tournament is already finished' })

    // Only admins or the KDR creator can generate
    if (user.role !== 'ADMIN' && kdr.createdById !== user.id) return res.status(403).json({ error: 'Forbidden' })

    // Fetch players
    const players = await prisma.kDRPlayer.findMany({ where: { kdrId: canonicalKdrId }, orderBy: { createdAt: 'asc' } })
    if (!players || players.length === 0) return res.status(400).json({ error: 'No players to create matches for' })

    // Verify all current round matches are done before generating next round
    const lastRound = await prisma.kDRRound.findFirst({ where: { kdrId: canonicalKdrId }, orderBy: { number: 'desc' }, include: { matches: true } })
    if (lastRound && lastRound.matches.some(m => m.status !== 'COMPLETED')) {
      return res.status(400).json({ error: 'Finish all current matches before generating a new round' })
    }

    const roundNumber = lastRound ? lastRound.number + 1 : 1

    // ROUND ROBIN LIMITER: 
    // In a round robin tournament with N players, there are N-1 rounds (if N is even) 
    // or N rounds (if N is odd, with one player sitting out each round).
    // Let's cap it at N-1 (even) or N (odd) to prevent infinite rounds.
    const maxRounds = players.length % 2 === 0 ? players.length - 1 : players.length
    if (roundNumber > maxRounds) {
      // Finalize the tournament status if we've reached the limit
      await prisma.kDR.update({ where: { id: canonicalKdrId }, data: { status: 'COMPLETED' } })
      return res.status(400).json({ error: 'Tournament completed. All rounds have been played.' })
    }

    // Build playerKey map and shuffle/pair
    const playerKeyMap = new Map<string, string | null>(players.map(p => [p.id, (p.userId && kdr.id) ? generatePlayerKey(p.userId, kdr.id) : null]))
    const playerIds = shuffle(players.map(p => p.id))

    const createdRound = await prisma.kDRRound.create({ data: { kdrId: canonicalKdrId, number: roundNumber } })

    const createdMatches = [] as any[]
    for (let i = 0; i < playerIds.length; i += 2) {
      const a = playerIds[i]
      const b = playerIds[i + 1]

        if (!b) {
        // Bye: create a match with playerBId null and automatically finalize as a 2-0 win
        await prisma.kDRPlayer.update({ where: { id: a }, data: { bye: true } })
        const m = await prisma.kDRMatch.create({ 
          data: { 
            kdrId: canonicalKdrId, 
            roundId: createdRound.id, 
            playerAId: a, 
            scoreA: 2, 
            scoreB: 0, 
            status: 'COMPLETED', 
            winnerId: a 
          } 
        })
        
        // Count the BYE as a win in player stats and class stats
        const playerAData = players.find(p => p.id === a)
        if (playerAData?.userId) {
          // Update global stats
          const ps = await prisma.playerStats.findFirst({ where: { userId: playerAData.userId } })
          if (ps) {
            const s = (ps.stats as any) || {}
            const newStats = { 
              ...s, 
              wins: (Number(s.wins || 0) + 1), 
              gamesPlayed: (Number(s.gamesPlayed || 0) + 1) 
            }
            await prisma.playerStats.update({ where: { id: ps.id }, data: { stats: newStats } })
          }

          // Update class stats
          if (playerAData.classId) {
            const classStat = await prisma.playerClassStats.findFirst({ 
              where: { userId: playerAData.userId, classId: playerAData.classId } 
            })
            if (classStat) {
              const cs = (classStat.stats as any) || {}
              const newStats = { 
                ...cs, 
                wins: (Number(cs.wins || 0) + 1)
              }
              await prisma.playerClassStats.update({ where: { id: classStat.id }, data: { stats: newStats } })
            }
          }
        }

        createdMatches.push({ ...m, playerAKey: playerKeyMap.get(a) || null, playerBKey: null })
      } else {
        const m = await prisma.kDRMatch.create({ data: { kdrId: canonicalKdrId, roundId: createdRound.id, playerAId: a, playerBId: b, status: 'SCHEDULED' } })
        createdMatches.push({ ...m, playerAKey: playerKeyMap.get(a) || null, playerBKey: playerKeyMap.get(b) || null })
      }
    }

    return res.status(201).json({ round: createdRound, matches: createdMatches })
  } catch (error) {
    console.error('Failed to generate bracket:', error)
    return res.status(500).json({ error: 'Failed to generate bracket' })
  }
}
