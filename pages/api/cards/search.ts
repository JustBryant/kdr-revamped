import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { q } = req.query
  const variantQ = req.query.variant

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ message: 'Query parameter is required' })
  }

  try {
    const where: any = {
      name: {
        contains: q,
        mode: 'insensitive',
      },
    }

    if (variantQ && typeof variantQ === 'string') {
      where.variant = variantQ
    }

    const cards = await prisma.card.findMany({
      where,
      take: 10,
      select: {
        id: true,
        konamiId: true,
        name: true,
        type: true,
        desc: true,
        atk: true,
        def: true,
        level: true,
        race: true,
        attribute: true,
        imageUrlCropped: true,
        artworks: true,
        primaryArtworkIndex: true,
      },
    })

    const normalize = (card: any) => {
      let artworkUrl: string | null = null
      try {
        const arts = Array.isArray(card.artworks) ? card.artworks : []
        const idx = typeof card.primaryArtworkIndex === 'number' ? card.primaryArtworkIndex : 0
        const a = arts[idx] || arts[0]
        if (a) artworkUrl = a.image_full || a.image_full_orr || a.image_url_cropped || a.image_url_small || a.image_url || a.imageUrlCropped || a.imageUrlSmall || a.imageUrl || null
      } catch (e) {
        artworkUrl = null
      }
      if (!artworkUrl && card.imageUrlCropped) artworkUrl = card.imageUrlCropped
      // Do not construct konami/raw image URLs here; return raw artwork metadata
      // so the client-side `CardImage` can decide how to resolve konamiId fallbacks.
      if (!artworkUrl) artworkUrl = null
      return { ...card, artworkUrl }
    }

    res.status(200).json(cards.map(normalize))
  } catch (error) {
    console.error('Error searching cards:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
