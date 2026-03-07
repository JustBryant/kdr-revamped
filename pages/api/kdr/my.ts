import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json([])

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return res.status(200).json([])

    const myKdrs = await prisma.kDR.findMany({
      where: { createdById: user.id, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        playerCount: true,
        settingsSnapshot: true,
        formatId: true
      }
    })

    return res.status(200).json(myKdrs)
  } catch (err) {
    console.error('Error fetching my KDRs', err)
    return res.status(500).json({ error: 'Failed to fetch' })
  }
}
