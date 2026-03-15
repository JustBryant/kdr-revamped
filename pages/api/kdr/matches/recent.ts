import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import crypto from 'crypto'
import { getJson, setJson } from '../../../../lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const cacheKey = `kdr:matches:recent`
    const ifNone = req.headers['if-none-match'] as string | undefined

    // If we have a cached payload, serve it (or 304 if ETag matches) without hitting DB
    try {
      const cached = await getJson(cacheKey)
      if (cached && cached.etag) {
        if (ifNone && ifNone === cached.etag) return res.status(304).end()
        res.setHeader('ETag', cached.etag)
        return res.status(200).json({ matches: cached.matches })
      }
    } catch (e) {
      console.warn('Failed to read recent matches cache', e)
    }

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
      const playerA = (m.playerAId && typeof m.playerAId === 'string') ? await prisma.kDRPlayer.findUnique({ where: { id: m.playerAId }, select: { userId: true } }) : null
      const playerB = (m.playerBId && typeof m.playerBId === 'string') ? await prisma.kDRPlayer.findUnique({ where: { id: m.playerBId }, select: { userId: true } }) : null
      
      const userA = (playerA?.userId && typeof playerA.userId === 'string') ? await prisma.user.findUnique({ where: { id: playerA.userId }, select: { id: true, name: true, email: true } }) : null
      const userB = (playerB?.userId && typeof playerB.userId === 'string') ? await prisma.user.findUnique({ where: { id: playerB.userId }, select: { id: true, name: true, email: true } }) : null

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
        replayUrl: m.replayUrl,
      }
    }))

    // Compute ETag and cache the enriched result for a short TTL
    try {
      const payloadStr = JSON.stringify(enriched)
      const etag = crypto.createHash('sha256').update(payloadStr).digest('hex')
      await setJson(cacheKey, { etag, matches: enriched }, 3)
      res.setHeader('ETag', etag)
    } catch (e) {
      console.warn('Failed to set recent matches cache', e)
    }

    return res.status(200).json({ matches: enriched })
  } catch (error) {
    console.error('Failed to load recent matches:', error)
    return res.status(500).json({ error: 'Failed to load recent matches' })
  }
}
