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

      // Calculate aggregate wins and losses from class stats as a fallback/verification
      const aggregateWins = enrichedClassStats.reduce((sum, cs) => sum + cs.wins, 0)
      const aggregateLosses = enrichedClassStats.reduce((sum, cs) => sum + cs.losses, 0)

      // Get global wins, losses, and elo from global stats JSON
      const globalStatsJson = (stats?.stats as any) || {}
      const enrichedStats = {
        ...stats,
        elo: Number(globalStatsJson.elo ?? 1500),
        wins: Math.max(Number(globalStatsJson.wins || 0), aggregateWins),
        losses: Math.max(Number(globalStatsJson.losses || 0), aggregateLosses)
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
  } else if (req.method === 'PUT') {
    const { name, image, favoriteCardId } = req.body
    try {
      const userId = session.user.id
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          image,
          favoriteCardId: favoriteCardId || null,
        },
      })
      return res.status(200).json({ message: 'Profile updated', user: updatedUser })
    } catch (error) {
      console.error('Error updating profile:', error)
      return res.status(500).json({ message: 'Internal server error' })
    }
  } else if (req.method === 'PATCH') {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing fields' })
    }
    try {
      const userId = session.user.id
      const { findNeonUserByEmail, updatePasswordByEmail } = await import('../../../lib/neonAuth')
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: process.env.DATABASE_URL })
      
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user || !user.email) return res.status(404).json({ message: 'User not found' })

      const neonUser = await findNeonUserByEmail(pool, user.email)
      if (!neonUser) {
        await pool.end()
        return res.status(404).json({ message: 'Auth profile not found' })
      }

      const bc = await import('bcryptjs')
      // Note: findNeonUserByEmail returns row with account_password
      const isCorrect = await bc.compare(currentPassword, neonUser.account_password)
      if (!isCorrect) {
        await pool.end()
        return res.status(401).json({ message: 'Incorrect current password' })
      }

      const hashed = await bc.hash(newPassword, 10)
      await updatePasswordByEmail(pool, user.email, hashed)
      
      await pool.end()
      return res.status(200).json({ message: 'Password updated successfully' })
    } catch (error) {
      console.error('Error updating password:', error)
      return res.status(500).json({ message: 'Internal server error' })
    }
  }

  return res.status(405).json({ message: "Method not allowed" })
}
