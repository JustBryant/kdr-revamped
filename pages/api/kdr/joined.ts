import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { generatePlayerKey } from '../../../lib/kdrHelpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json([])

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return res.status(200).json([])

    const joined = await prisma.kDRPlayer.findMany({
      where: {
        userId: user.id,
        status: { not: 'KICKED' },
        kdr: {
          status: { notIn: ['DELETED', 'ARCHIVED'] }
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        kdr: true
      }
    })

    const payload = joined.map((p) => {
      const k = p.kdr
      return {
        kdrId: p.kdrId,
        name: k?.name ?? null,
        slug: k?.slug ?? null,
        kdrStatus: k?.status ?? null,
        playerKey: (p.userId && p.kdrId && k?.id) ? generatePlayerKey(p.userId, k.id) : null,
        playerStatus: p.status,
      }
    })

    return res.status(200).json(payload)
  } catch (err) {
    console.error('Error fetching joined KDRs', err)
    return res.status(500).json({ error: 'Failed to fetch' })
  }
}
