import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ message: "Unauthorized" })

  if (req.method === 'GET') {
    try {
      const userId = session.user.id
      
      // Get global user info (for signature card)
      const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { favoriteCard: true }
      })

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
      const mostPlayed = [...classStats].sort((a, b) => b.picks - a.picks)[0]
      const mostPlayedClass = mostPlayed ? classMap[mostPlayed.classId]?.name : 'None'

      return res.status(200).json({
        user,
        stats: enrichedStats,
        classStats: enrichedClassStats,
        recentMatches,
        mostPlayedClass,
        signatureCard: user?.favoriteCard?.name || 'None'
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: "Internal Server Error" })
    }
  }

  return res.status(405).json({ message: "Method not allowed" })
}
