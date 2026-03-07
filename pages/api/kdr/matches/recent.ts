import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const matches = await prisma.kDRMatch.findMany({
      where: {
        updatedAt: {
          gte: twentyFourHoursAgo
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })

    // Enrich with player user names
    const enriched = await Promise.all(matches.map(async (m) => {
      const playerA = m.playerAId ? await prisma.kDRPlayer.findUnique({ where: { id: m.playerAId }, select: { userId: true } }) : null
      const playerB = m.playerBId ? await prisma.kDRPlayer.findUnique({ where: { id: m.playerBId }, select: { userId: true } }) : null
      const userA = playerA ? await prisma.user.findUnique({ where: { id: playerA.userId }, select: { id: true, name: true, email: true } }) : null
      const userB = playerB ? await prisma.user.findUnique({ where: { id: playerB.userId }, select: { id: true, name: true, email: true } }) : null

      return {
        id: m.id,
        kdrId: m.kdrId,
        roundId: m.roundId,
        playerAId: m.playerAId,
        playerBId: m.playerBId,
        playerAName: userA?.name || userA?.email || null,
        playerBName: userB?.name || userB?.email || null,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        status: m.status,
        reportedAt: m.reportedAt,
        updatedAt: m.updatedAt,
      }
    }))

    return res.status(200).json({ matches: enriched })
  } catch (error) {
    console.error('Failed to load recent matches:', error)
    return res.status(500).json({ error: 'Failed to load recent matches' })
  }
}
