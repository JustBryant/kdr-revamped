import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { slug, variant, q } = req.query
  if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'Missing format slug' })
  try {
    const where: any = {
      formats: {
        has: slug
      }
    }
    if (variant && typeof variant === 'string') where.variant = variant
    if (q && typeof q === 'string' && q.trim().length > 0) {
      where.name = { contains: q, mode: 'insensitive' }
    }

    const cards = await prisma.card.findMany({
      where,
      take: 200,
      select: {
        id: true,
        konamiId: true,
        name: true,
        type: true,
        imageUrlCropped: true,
        artworks: true,
        primaryArtworkIndex: true,
        variant: true
      }
    })

    const normalize = (card: any) => {
      let artworkUrl: string | null = null
      try {
        const arts = Array.isArray(card.artworks) ? card.artworks : []
        const idx = typeof card.primaryArtworkIndex === 'number' ? card.primaryArtworkIndex : 0
        const a = arts[idx] || arts[0]
        // Prefer Rush/full artworks stored under image_full / image_full_orr
        if (a) artworkUrl = a.image_full || a.image_full_orr || a.image_url_cropped || a.image_url_small || a.image_url || a.imageUrlCropped || a.imageUrlSmall || a.imageUrl || null
      } catch (e) {
        artworkUrl = null
      }
      if (!artworkUrl && card.imageUrlCropped) artworkUrl = card.imageUrlCropped
      // Do not synthesize konami/raw URLs here — prefer returning raw artwork fields and
      // let the client `CardImage` component resolve konamiId when needed.
      if (!artworkUrl) artworkUrl = null
      return { ...card, artworkUrl }
    }

    const normalized = cards.map(normalize)

    // If no cards found for the format and a search query was provided,
    // fall back to a name search so the UI can still show relevant cards.
    if ((cards || []).length === 0 && q && typeof q === 'string' && q.trim().length > 0) {
      try {
        const fallbackWhere: any = { name: { contains: String(q), mode: 'insensitive' } }
        if (variant && typeof variant === 'string') fallbackWhere.variant = variant
        const fallback = await prisma.card.findMany({ where: fallbackWhere, take: 200, select: {
          id: true, konamiId: true, name: true, type: true, imageUrlCropped: true, artworks: true, primaryArtworkIndex: true, variant: true
        } })
        return res.status(200).json(fallback.map(normalize))
      } catch (e) {
        console.error('Fallback search failed', e)
        return res.status(200).json([])
      }
    }

    return res.status(200).json(normalized)
  } catch (err) {
    console.error('Error fetching cards for format', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
