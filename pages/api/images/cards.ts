import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  try {
    // If a query exists, prefer searching our DB for matching cards (so names map to konamiId filenames)
    if (q && q.length > 1) {
      const cards = await prisma.card.findMany({
        where: {
          name: {
            contains: q,
            mode: 'insensitive',
          },
        },
        take: 50,
        select: {
          konamiId: true,
          name: true,
        },
      })

      const results = cards
        .filter((c) => c.konamiId)
        .map((c) => ({
          name: c.name, // user-friendly display name
          url: `https://raw.githubusercontent.com/JustBryant/card-images/main/card_art/${c.konamiId}.jpg`,
        }))

      return res.status(200).json(results)
    }

    // Fallback: list files directly from GitHub when no query provided
    const response = await fetch('https://api.github.com/repos/JustBryant/card-images/contents/card_art')

    if (!response.ok) {
      console.error('GitHub API Error:', response.status, response.statusText)
      const errorBody = await response.text()
      console.error('GitHub API Response:', errorBody)
      throw new Error(`Failed to fetch images from GitHub: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    const images = data
      .filter((item: any) => item.type === 'file' && /\.(jpg|jpeg|png|webp)$/i.test(item.name))
      .map((item: any) => ({
        name: item.name,
        url: `https://raw.githubusercontent.com/JustBryant/card-images/main/card_art/${encodeURIComponent(item.name)}`,
      }))

    res.status(200).json(images.slice(0, 250))
  } catch (error) {
    console.error('Error fetching card images:', error)
    res.status(500).json({ message: 'Failed to fetch card images' })
  }
}
