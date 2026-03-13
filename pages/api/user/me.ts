import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ message: "Unauthorized" })

  if (req.method === 'GET') {
    try {
      const email = session.user.email
      if (!email) return res.status(401).json({ message: "Unauthorized: No email" })
      
      // Get global user info (for signature card)
      const user = await prisma.user.findUnique({
          where: { email: email as string },
          include: { 
            favoriteCard: true,
            border: true,
            frame: true,
            title: true,
            background: true,
            profileIcon: true,
            cardEffect: true,
            iconEffect: true
          }
      })

      if (!user) return res.status(404).json({ message: "User not found" })
      console.log(`[ME DEBUG] User Found: ${user.id}. Equipped Profile Icon ID: ${user.profileIconId}`);
      
      
      console.log(`[ME DEBUG] User Found: ${user.id}. Equipped Profile Icon ID: ${user.profileIconId}`);
      
      const userId = user.id
      
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

      console.log(`[ME DEBUG] Success. Profile Icon Image: ${user.profileIcon?.imageUrl}`);

      return res.status(200).json({
        user,
        stats: enrichedStats,
        classStats: enrichedClassStats,
        recentMatches,
        mostPlayedClass,
        signatureCard: user?.favoriteCard || null
      })
    } catch (error) {
      console.error("[ME ERROR]:", error)
      return res.status(500).json({ message: "Internal Server Error" })
    }
  } else if (req.method === 'PUT') {
    const { name, image, favoriteCardId, profileIconId } = req.body
    console.log('[ME PUT DEBUG] Incoming request body:', { name, image, favoriteCardId, profileIconId });
    try {
      const email = session.user.email
      if (!email) {
        console.error('[DEBUG] Session has no email:', session.user);
        return res.status(401).json({ message: 'Unauthorized: No email in session' });
      }

      console.log('[DEBUG] Attempting update for user email:', email);
      
      const userExists = await prisma.user.findUnique({ where: { email } });
      if (!userExists) {
        console.error('[DEBUG] User record NOT found for email:', email);
        return res.status(404).json({ message: 'User record not found' });
      }

      const updateData: any = {
        favoriteCardId: favoriteCardId || null,
      }
      
      // If profileIconId is provided, use the URL from the Item table and set the ID
      if (profileIconId) {
        console.log('[DEBUG] Searching for icon item:', profileIconId);
        // Using dynamic accessor if 'item' isn't explicitly in schema, otherwise use normal prisma.item
        const item = await (prisma as any).item.findUnique({ where: { id: profileIconId } })
        if (item) {
          console.log('[DEBUG] Found icon item:', item.name, item.type);
          if (item.type === 'PROFILE_ICON') {
            updateData.profileIconId = profileIconId
            // Only update the hard-coded image URL if it's not a Discord user
            // Discord users always have their image field controlled by Discord info or our internal override logic
            if (!userExists.image || !userExists.image.includes('discordapp.com')) {
               updateData.image = item.imageUrl || image
            }
          }
        } else {
          console.warn('[DEBUG] Profile icon item not found in DB:', profileIconId);
          if (image) updateData.image = image
        }
      } else if (image) {
        updateData.image = image
      }

      console.log('[DEBUG] Update Data constructed:', updateData);

      // Handle name update if provided
      if (typeof name !== 'undefined') {
        const trimmedName = name?.trim();
        const currentName = userExists.name || '';
        
        console.log('[DEBUG] Comparing names:', { 
          trimmedName, 
          currentName,
          match: trimmedName.toLowerCase() === currentName.toLowerCase() 
        });

        // 1. If the name is IDENTICAL to current, do nothing.
        if (trimmedName === currentName) {
          console.log('[DEBUG] Name is identical, no change.');
        } 
        // 2. If the name is DIFFERENT, but effectively the same (just casing), update it directly.
        else if (trimmedName.toLowerCase() === currentName.toLowerCase()) {
          console.log('[DEBUG] Updating name casing only.');
          updateData.name = trimmedName;
        } 
        // 3. If the name is actually changing (different letters/words), check if it's taken.
        else if (trimmedName) {
          console.log('[DEBUG] Name is actually changing. Checking collision...');
          const nameTaken = await prisma.user.findFirst({
            where: { 
              name: { equals: trimmedName, mode: 'insensitive' },
              id: { not: userExists.id }
            }
          });
          
          if (nameTaken) {
            console.log('[DEBUG] Collision found with user:', nameTaken.id);
            // Return 200 with success: false to prevent axios from throwing an error
            return res.status(200).json({ success: false, message: 'This display name is already taken.' });
          }
          
          updateData.name = trimmedName;
        }
      }

      const updatedUser = await prisma.user.update({
        where: { email },
        data: updateData,
      })
      console.log('[DEBUG] Profile updated for:', email);
      return res.status(200).json({ success: true, message: 'Profile updated', user: updatedUser })
    } catch (error) {
      console.error('[ERROR] Error updating profile:', error)
      return res.status(200).json({ 
        success: false,
        message: 'Internal server error', 
        detail: (error as any).message,
        code: (error as any).code 
      })
    }
  } else if (req.method === 'PATCH') {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing fields' })
    }
    try {
      const email = session.user.email
      if (!email) return res.status(401).json({ message: 'Unauthorized' })

      const { findNeonUserByEmail, updatePasswordByEmail } = await import('../../../lib/neonAuth')
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: process.env.DATABASE_URL })
      
      const user = await prisma.user.findUnique({ where: { email } })
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
