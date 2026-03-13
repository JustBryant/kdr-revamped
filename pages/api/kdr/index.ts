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
        where: { NOT: { status: 'DELETED' } },
        include: {
          players: { where: { status: 'ACTIVE' }, select: { id: true } },
          format: { select: { name: true } }
        }
      })
      // Post-process to provide _count manually since we filtered relations
      const result = list.map(kdr => {
        const { players, ...rest } = kdr as any;
        return {
          ...rest,
          _count: { players: players.length }
        }
      });
      return res.status(200).json(result)
    } catch (error) {
      console.error('Failed to list KDRs', error)
      return res.status(500).json({ error: 'Failed to list KDRs' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
