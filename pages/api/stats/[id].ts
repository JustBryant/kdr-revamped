import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getClassImageUrl } from '../../../lib/constants'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const { id } = req.query
  if (!id || Array.isArray(id)) return res.status(400).json({ message: 'Missing id' })

  try {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Ensure player stats exists
    let stats = await prisma.playerStats.findFirst({ where: { userId: user.id } })
    if (!stats) stats = await prisma.playerStats.create({ data: { userId: user.id } })

    const classStats = await prisma.playerClassStats.findMany({ where: { userId: user.id } })

    // Many legacy fields are stored inside the JSON `stats` column now
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
      // ignore inline/data URLs (placeholders) so UI uses real class images
      if (u.startsWith('data:')) return null
      try {
        if (u.includes('github.com') && u.includes('/blob/')) {
          const parts = u.split('github.com/')[1].split('/blob/')
          const repo = parts[0]
          const path = parts[1]
          return `https://raw.githubusercontent.com/${repo}/${path}`
        }
        return u
      } catch (e) {
        return null
      }
    }

    const classStatsMap: Record<string, any> = {}
    classStats.forEach((cs) => { classStatsMap[cs.classId] = cs })

    let merged: any[] = []
    try {
      const classFavCardIds = Array.from(new Set(classStats.map(s => ((s.stats as any)?.mostPickedCardId)).filter((x): x is string => typeof x === 'string')))
      const classFavCards = classFavCardIds.length > 0 ? await prisma.card.findMany({ where: { id: { in: classFavCardIds } }, select: { id: true, name: true, imageUrlCropped: true, konamiId: true } }) : []
      const classFavMap: Record<string, any> = {}
      classFavCards.forEach(c => { classFavMap[c.id] = c })

      merged = classesAll.map((c) => {
        const player = classStatsMap[c.id]
        let img = normalizeGithubRaw(c.image) ?? null
        if (img && !img.startsWith('http') && !img.includes('/')) {
          img = getClassImageUrl(img)
        }

        const classFavCardId = (player && player.stats) ? ((player.stats as any).mostPickedCardId) : null
        const classFavCard = classFavCardId ? classFavMap[classFavCardId] ?? null : null

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
      user: { id: user.id, name: user.name, image: user.image },
      stats: {
        ...stats,
        mostBeatenPlayer: mostBeaten ? { id: mostBeaten.id, name: mostBeaten.name } : null,
        mostLostToPlayer: mostLostTo ? { id: mostLostTo.id, name: mostLostTo.name } : null,
        mostPickedCard: mostPickedCard ? { id: mostPickedCard.id, name: mostPickedCard.name, konamiId: mostPickedCard.konamiId ?? null, imageUrlCropped: mostPickedCard.imageUrlCropped ?? null } : null,
        mostPickedClass: mostPickedClass ? { id: mostPickedClass.id, name: mostPickedClass.name } : null,
        mostPickedSkill: mostPickedSkill ? { id: mostPickedSkill.id, name: mostPickedSkill.name } : null,
        mostPickedTreasure: mostPickedTreasure ? { id: mostPickedTreasure.id, name: mostPickedTreasure.name } : null,
      },
      classStats: merged,
      classStatsCount: merged.length,
    })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
