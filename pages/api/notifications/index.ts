import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      if (!user) return res.status(200).json([])
      let notes: any[] = []
      try {
        notes = (prisma as any).notification ? await (prisma as any).notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }) : []
      } catch (e) {
        console.warn('Notification model missing or query failed, returning empty list', e)
        notes = []
      }
      return res.status(200).json(notes)
    } catch (err) {
      console.error('Failed to load notifications', err)
      return res.status(500).json({ error: 'Failed to load notifications' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
