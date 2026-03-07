import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    try {
      const list = await prisma.kDR.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          playerCount: true,
          settingsSnapshot: true,
          formatId: true,
          createdById: true
        }
      })
      return res.status(200).json(list)
    } catch (error) {
      console.error('Failed to list KDRs', error)
      return res.status(500).json({ error: 'Failed to list KDRs' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
