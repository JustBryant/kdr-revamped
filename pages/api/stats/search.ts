import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q || q.length < 1) return res.status(200).json([])

  try {
    const users = await prisma.user.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: 20,
      select: {
        id: true,
        name: true,
        image: true,
      },
    })

    // Load corresponding PlayerStats rows and read legacy fields from JSON `stats`
    const userIds = users.map(u => u.id)
    const statsRows = userIds.length ? await prisma.playerStats.findMany({ where: { userId: { in: userIds } }, select: { userId: true, stats: true } }) : []
    const statsByUser: Record<string, any> = {}
    statsRows.forEach(r => { statsByUser[r.userId] = (r.stats as any) || {} })

    const mapped = users.map((u) => {
      const s = statsByUser[u.id] || {}
      return {
        id: u.id,
        name: u.name || 'Unknown',
        image: u.image || null,
        elo: typeof s.elo === 'number' ? s.elo : 1500,
        wins: typeof s.wins === 'number' ? s.wins : 0,
        losses: typeof s.losses === 'number' ? s.losses : 0,
      }
    })

    return res.status(200).json(mapped)
  } catch (error) {
    console.error('Error searching users for stats:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
