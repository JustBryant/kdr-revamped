import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ message: "Invalid User ID" })

  if (req.method === 'GET') {
    try {
      const userId = id
      
      // Get global user info (for signature card)
      const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { favoriteCard: true }
      })

      if (!user) return res.status(404).json({ message: "User not found" })

      // Get global stats
      const stats = await prisma.playerStats.findFirst({
        where: { userId }
      })

      // Get class specific stats
      const classStats = await prisma.playerClassStats.findMany({
        where: { userId }
      })

      // Get recent matches (from KDRMatch)
      const recentMatches = await prisma.kDRMatch.findMany({
          where: {
              OR: [
                  { playerA: { userId } },
                  { playerB: { userId } }
              ],
              status: 'COMPLETED'
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
              playerA: { 
                  include: { 
                      user: { select: { name: true, image: true } }, 
                      playerClass: { select: { name: true, image: true } } 
                  } 
              },
              playerB: { 
                  include: { 
                      user: { select: { name: true, image: true } }, 
                      playerClass: { select: { name: true, image: true } } 
                  } 
              },
              winner: { select: { id: true } }
          }
      })

      // Fetch class details for the stats
      const classes = await prisma.class.findMany({
          where: { id: { in: classStats.map(cs => cs.classId) } },
          select: { id: true, name: true, image: true }
      })

      const classMap = Object.fromEntries(classes.map(c => [c.id, c]))

      // Enrich class stats with name, image, and extracted wins/losses from JSON
      const enrichedClassStats = classStats.map(cs => {
          const s = (cs.stats as any) || {}
          return {
              ...cs,
              className: classMap[cs.classId]?.name || 'Unknown',
              classImage: classMap[cs.classId]?.image || null,
              wins: Number(s.wins || 0),
              losses: Number(s.losses || 0)
          }
      })

      // Get global wins, losses, and elo from global stats JSON
      const globalStatsJson = (stats?.stats as any) || {}
      const enrichedStats = {
        ...stats,
        elo: Number(globalStatsJson.elo ?? 1500),
        wins: Number(globalStatsJson.wins || 0),
        losses: Number(globalStatsJson.losses || 0)
      }

      // Determine most played class
      const mostPlayed = classStats.length > 0 ? [...classStats].sort((a, b) => b.picks - a.picks)[0] : null
      const mostPlayedClass = mostPlayed ? classMap[mostPlayed.classId]?.name : 'None'

      return res.status(200).json({
        user,
        stats: enrichedStats,
        classStats: enrichedClassStats,
        recentMatches: recentMatches || [],
        mostPlayedClass,
        signatureCard: user?.favoriteCard?.name || 'None'
      })
    } catch (error: any) {
      console.error('API Error in user/[id]:', error.message, error.stack)
      return res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
  }

  return res.status(405).json({ message: "Method not allowed" })
}
