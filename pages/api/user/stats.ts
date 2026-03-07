import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { getClassImageUrl } from '../../../lib/constants'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || !session.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (req.method === 'GET') {
      // Find or create a PlayerStats record for this user and include per-class breakdown
      let stats = await prisma.playerStats.findFirst({ where: { userId: user.id } })
      if (!stats) {
        stats = await prisma.playerStats.create({ data: { userId: user.id } })
      }

      const classStats = await prisma.playerClassStats.findMany({ where: { userId: user.id } })

      // Resolve referenced names where possible (players, card, class, skill, treasure)
      // many legacy fields are now stored inside the JSON `stats` column; read from there
      const sdata = (stats.stats as any) || {}
      const mostBeaten = sdata.mostBeatenPlayerId ? await prisma.user.findUnique({ where: { id: sdata.mostBeatenPlayerId }, select: { id: true, name: true } }) : null
      const mostLostTo = sdata.mostLostToPlayerId ? await prisma.user.findUnique({ where: { id: sdata.mostLostToPlayerId }, select: { id: true, name: true } }) : null
      const mostPickedCard = sdata.mostPickedCardId ? await prisma.card.findUnique({ where: { id: sdata.mostPickedCardId }, select: { id: true, name: true, konamiId: true, imageUrlCropped: true } }) : null
      const mostPickedClass = sdata.mostPickedClassId ? await prisma.class.findUnique({ where: { id: sdata.mostPickedClassId }, select: { id: true, name: true } }) : null
      const mostPickedSkill = sdata.mostPickedSkillId ? await prisma.skill.findUnique({ where: { id: sdata.mostPickedSkillId }, select: { id: true, name: true } }) : null
      const mostPickedTreasure = sdata.mostPickedTreasureId ? await prisma.card.findUnique({ where: { id: sdata.mostPickedTreasureId }, select: { id: true, name: true } }) : null

      // Fetch all classes and merge with player's classStats so UI can show class images
      // Note: only show public classes OR classes the user has already played (classStats exists)
      const classesAll = await prisma.class.findMany({ 
        where: {
          OR: [
            { isPublic: true },
            { id: { in: classStats.map(cs => cs.classId) } }
          ]
        },
        select: { id: true, name: true, image: true }, 
        orderBy: { name: 'asc' } 
      })
      const normalizeGithubRaw = (u: string | null | undefined) => {
        if (!u) return null
        // treat data: URLs as absent (these are placeholders)
        if (u.startsWith('data:')) return null
        try {
          if (u.includes('github.com') && u.includes('/blob/')) {
            const parts = u.split('github.com/')[1].split('/blob/')
            const repo = parts[0]
            const path = parts[1]
            return `https://raw.githubusercontent.com/${repo}/${path}`
          }
          // already a raw.githubusercontent or direct image URL — use as-is
          return u
        } catch (e) {
          return null
        }
      }

      const classStatsMap: Record<string, any> = {}
      classStats.forEach((cs) => { classStatsMap[cs.classId] = cs })

      // Attempt to resolve per-class favourite cards and merge; on any failure fall back
      let merged: any[] = []
      try {
        // collect referenced per-class favourite card ids (best-effort)
        const classFavCardIds = Array.from(new Set(classStats.map(s => ((s.stats as any)?.mostPickedCardId)).filter((x): x is string => typeof x === 'string')))
        const classFavCards = classFavCardIds.length > 0 ? await prisma.card.findMany({ where: { id: { in: classFavCardIds } }, select: { id: true, name: true, imageUrlCropped: true, konamiId: true } }) : []
        const classFavMap: Record<string, any> = {}
        classFavCards.forEach(c => { classFavMap[c.id] = c })

        merged = classesAll.map((c) => {
          const player = classStatsMap[c.id]
          let img = normalizeGithubRaw(c.image) ?? null
          // If image looks like just a filename (no scheme), prefix with class image base URL
          if (img && !img.startsWith('http') && !img.includes('/')) {
            img = getClassImageUrl(img)
          }

          const classFavCardId = (player && player.stats) ? ((player.stats as any).mostPickedCardId) : null
          const classFavCard = classFavCardId ? classFavMap[classFavCardId] ?? null : null

          // Do not synthesize final image URLs here — clients should use `CardImage`.

          return {
            id: player?.id ?? null,
            classId: c.id,
            className: c.name,
            classImage: img,
            wins: ((player && (player.stats as any)) ? ((player.stats as any).wins ?? 0) : 0),
            losses: ((player && (player.stats as any)) ? ((player.stats as any).losses ?? 0) : 0),
            picks: player?.picks ?? 0,
            classFavouriteCard: classFavCard ? { id: classFavCard.id, name: classFavCard.name, konamiId: classFavCard.konamiId ?? null, imageUrlCropped: classFavCard.imageUrlCropped ?? null } : null,
          }
        })
      } catch (err) {
        console.warn('Warning: per-class favourite card resolution failed, returning basic class stats', err)
        merged = classesAll.map((c) => {
          const player = classStatsMap[c.id]
          let img = normalizeGithubRaw(c.image) ?? null
          if (img && !img.startsWith('http') && !img.includes('/')) {
            img = getClassImageUrl(img)
          }
          return {
            id: player?.id ?? null,
            classId: c.id,
            className: c.name,
            classImage: img,
            wins: player?.wins ?? 0,
            losses: player?.losses ?? 0,
            picks: player?.picks ?? 0,
            classFavouriteCard: null,
          }
        })
      }

      return res.status(200).json({
        ...stats,
        mostBeatenPlayer: mostBeaten ? { id: mostBeaten.id, name: mostBeaten.name } : null,
        mostLostToPlayer: mostLostTo ? { id: mostLostTo.id, name: mostLostTo.name } : null,
        mostPickedCard: mostPickedCard ? { id: mostPickedCard.id, name: mostPickedCard.name, konamiId: mostPickedCard.konamiId ?? null, imageUrlCropped: mostPickedCard.imageUrlCropped ?? null } : null,
        mostPickedClass: mostPickedClass ? { id: mostPickedClass.id, name: mostPickedClass.name } : null,
        mostPickedSkill: mostPickedSkill ? { id: mostPickedSkill.id, name: mostPickedSkill.name } : null,
        mostPickedTreasure: mostPickedTreasure ? { id: mostPickedTreasure.id, name: mostPickedTreasure.name } : null,
        classStats: merged,
        classStatsCount: merged.length,
      })
    }

    if (req.method === 'PATCH') {
      // Allow partial updates (admin or internal services should be used carefully)
      const data = req.body || {}
      const allowed: any = {}
      if (typeof data.wins === 'number') allowed.wins = data.wins
      if (typeof data.losses === 'number') allowed.losses = data.losses
      if (typeof data.gamesPlayed === 'number') allowed.gamesPlayed = data.gamesPlayed
      if (typeof data.elo === 'number') allowed.elo = data.elo
      if (typeof data.mostBeatenPlayerId === 'string') allowed.mostBeatenPlayerId = data.mostBeatenPlayerId
      if (typeof data.mostLostToPlayerId === 'string') allowed.mostLostToPlayerId = data.mostLostToPlayerId
      if (typeof data.mostPickedCardId === 'string') allowed.mostPickedCardId = data.mostPickedCardId
      if (typeof data.mostPickedClassId === 'string') allowed.mostPickedClassId = data.mostPickedClassId

      // Persist these legacy fields inside the JSON `stats` column
      let ps = await prisma.playerStats.findFirst({ where: { userId: user.id } })
      if (!ps) {
        const createObj: any = { userId: user.id, stats: allowed }
        ps = await prisma.playerStats.create({ data: createObj })
        return res.status(200).json(ps)
      }

      const mergedStats = { ...(ps.stats as any || {}), ...allowed }
      const updated = await prisma.playerStats.update({ where: { id: ps.id }, data: { stats: mergedStats } })
      return res.status(200).json(updated)
    }

    res.setHeader('Allow', ['GET', 'PATCH'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  } catch (error) {
    console.error('Error handling user stats:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
