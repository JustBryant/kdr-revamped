import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    // Fetch users who are active
    const users = await prisma.user.findMany({ 
      where: {
        AND: [
          { name: { not: { contains: 'Dummy' } } }, 
          { name: { not: { contains: 'Test' } } },  
          { name: { not: { contains: 'Dev' } } },   // Exclude "Dev Admin" or similar
          { email: { not: { contains: 'example.com' } } } 
        ]
      },
      select: { id: true, name: true, image: true } 
    })
    
    const userIds = users.map(u => u.id)
    const statsRows = await prisma.playerStats.findMany({ where: { userId: { in: userIds } }, select: { userId: true, stats: true } })
    const statsMap: Record<string, any> = {}
    for (const r of statsRows) {
      try { statsMap[r.userId] = r.stats || {} } catch (e) { statsMap[r.userId] = {} }
    }

    const mapped = users.map(u => {
      const s = statsMap[u.id] || {}
      const elo = Number(s?.elo ?? 1500)
      const wins = Number(s?.wins ?? 0)
      const losses = Number(s?.losses ?? 0)
      
      // If a user exists but has no stats record yet, we'll give them default 0/0 and 1500 Elo
      return { id: u.id, name: u.name || 'Unknown', image: u.image || null, elo, wins, losses, wl: `${wins}/${losses}` }
    })

    mapped.sort((a, b) => b.elo - a.elo)
    return res.status(200).json(mapped.slice(0, 50)) 
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
