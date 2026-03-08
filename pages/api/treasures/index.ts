import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      // Attempt to scope GET to the format: prefer explicit query params, then referer
      const referer = req.headers.referer || req.headers.referrer || ''
      let formatId: string | undefined = undefined
      try {
        if (req.query?.formatId) {
          formatId = String(req.query.formatId)
        } else if (req.query?.slug) {
          const fmt = await prisma.format.findUnique({ where: { slug: String(req.query.slug) } })
          if (fmt) formatId = fmt.id
        } else {
          const m = String(referer).match(/\/admin\/formats\/([^\/]+)/)
          if (m && m[1]) {
            const slug = decodeURIComponent(m[1])
            const fmt = await prisma.format.findUnique({ where: { slug } })
            if (fmt) formatId = fmt.id
          }
        }
      } catch (e) {}

      const treasures = await prisma.item.findMany({
        where: {
          type: 'TREASURE',
          formatId: formatId || undefined
        },
        orderBy: {
          createdAt: 'desc'
        }
      }) as any[]

      // Manually attach card data since Item model has no direct relation
      const cardIds = treasures.map(t => t.cardId).filter(Boolean) as string[]
      if (cardIds.length) {
        const cards = await prisma.card.findMany({
          where: { id: { in: cardIds } }
        })
        const cardMap = Object.fromEntries(cards.map(c => [c.id, c]))
        treasures.forEach(t => {
          if (t.cardId) t.card = cardMap[t.cardId]
        })
      }
      // Debug: list found treasures for quick inspection
      try {
        console.info('[TREASURE-DEBUG] GET treasures', { formatId, count: treasures.length })
        for (const t of treasures) console.info('[TREASURE-DEBUG] item', { id: t.id, cardId: t.cardId, rarity: t.rarity, name: t.name, formatId: t.formatId })
      } catch (e) {}
      return res.status(200).json(treasures)
    } catch (error) {
      console.error('Error fetching treasures:', error)
      return res.status(500).json({ error: 'Failed to fetch treasures' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { cardId, rarity } = req.body

      if (!cardId || !rarity) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Debug: capture admin and request context to track where treasures are added from
      const referer = req.headers.referer || req.headers.referrer || ''
      let formatSlug: string | null = null
      let formatId: string | undefined = undefined
      try {
        const m = String(referer).match(/\/admin\/formats\/([^\/]+)/)
        if (m && m[1]) {
          formatSlug = decodeURIComponent(m[1])
          const fmt = await prisma.format.findUnique({ where: { slug: formatSlug } })
          if (fmt) formatId = fmt.id
        }
      } catch (e) {
        // ignore
      }

      console.info('[TREASURE-DEBUG] create request', {
        at: new Date().toISOString(),
        admin: session?.user?.id || session?.user?.email || 'unknown',
        referer,
        formatSlug,
        payload: { cardId, rarity }
      })

      // Validate card exists to avoid FK errors and normalize rarity
      const cardRow = await prisma.card.findUnique({ where: { id: String(cardId) } })
      if (!cardRow) {
        console.error('[TREASURE-DEBUG] card not found for id', { cardId })
        return res.status(400).json({ error: 'Card not found' })
      }

      const normalizeRarity = (value: any) => {
        const s = String(value || '').trim().toUpperCase()
        if (!s) return ''
        if (s === 'C' || s === 'COMMON' || s === 'N' || s === 'NORMAL') return 'C'
        if (s === 'R' || s === 'RARE') return 'R'
        if (s === 'SR' || s === 'S' || s === 'SUPER' || s === 'SUPER RARE') return 'SR'
        if (s === 'UR' || s === 'U' || s === 'ULTRA' || s === 'ULTRA RARE') return 'UR'
        return s
      }

      const normalizedRarity = normalizeRarity(rarity)

      // Create an Item of type TREASURE scoped to the format when available.
      const treasure = await prisma.item.create({
        data: {
          type: 'TREASURE',
          cardId: String(cardId),
          rarity: normalizedRarity,
          formatId: formatId || undefined,
          name: cardRow.name || `Card ${cardRow.id}`
        },
        include: {
          card: true
        }
      })

      // Debug: log the created row for authoritative evidence
      console.info('[TREASURE-DEBUG] created', {
        at: new Date().toISOString(),
        admin: session?.user?.id || session?.user?.email || 'unknown',
        treasureId: treasure.id,
        cardId: treasure.cardId,
        rarity: treasure.rarity,
        createdAt: treasure.createdAt,
        formatId,
        formatSlug
      })

      return res.status(201).json(treasure)
    } catch (error: any) {
      // Log structured error info for debugging
      if (error && error.code) {
        console.error('Error creating treasure (Prisma error):', error.code, error.message)
      } else {
        console.error('Error creating treasure:', error && error.message ? error.message : error)
      }
      console.error('Request body:', req.body)
      // Temporary: return error detail to client for faster debugging
      return res.status(500).json({ error: 'Failed to create treasure', detail: error && error.message ? String(error.message) : 'unknown' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
