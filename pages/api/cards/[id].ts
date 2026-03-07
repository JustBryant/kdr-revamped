import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing card id' })
  try {
    const card = await prisma.card.findFirst({
      where: {
        OR: [
          { id },
          { konamiId: isNaN(Number(id)) ? -1 : Number(id) }
        ]
      },
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
        variant: true,
        archetype: true,
        rarity: true,
        artworks: true,
        primaryArtworkIndex: true,
        pendulumDesc: true,
        monsterDesc: true,
        scale: true,
        subtypes: true,
        metadata: true,
        isCustom: true
      }
    })
    if (!card) return res.status(404).json({ error: 'Card not found' })
    if (card.variant !== 'TCG' && !card.isCustom) {
      return res.status(404).json({ error: 'Card variant not supported for artworks' })
    }
    return res.status(200).json(card)
  } catch (error) {
    console.error('Error fetching card by id:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
