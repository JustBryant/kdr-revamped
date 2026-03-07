import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const list = await prisma.kDR.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        playerCount: true,
        settingsSnapshot: true,
        // include formatId and creator summary for lobby display
        formatId: true,
        createdById: true
      }
    })
    return res.status(200).json(list)
  } catch (err) {
    console.error('Error fetching active KDRs', err)
    return res.status(500).json({ error: 'Failed to fetch active KDRs' })
  }
}
