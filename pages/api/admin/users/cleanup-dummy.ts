import { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  if (!session || session.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { kdrId } = req.body || {}

    // find dummy users. If kdrId provided, match emails created by fill-dummy which use `dummy+{kdrId}-{suffix}`
    const whereClause: any = kdrId ? { email: { contains: `dummy+${kdrId}-` } } : { email: { startsWith: 'dummy+' } }

    const users = await prisma.user.findMany({ where: whereClause, select: { id: true } })
    if (!users || users.length === 0) return res.status(200).json({ message: 'No dummy users found' })

    const userIds = users.map((u: any) => u.id)

    // delete related kDRPlayer rows first to avoid FK errors
    await prisma.kDRPlayer.deleteMany({ where: { userId: { in: userIds } } })

    // delete other user-related records if necessary (playerItem) - optional
    await prisma.playerItem.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {})

    // finally delete users
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })

    return res.status(200).json({ message: `Deleted ${userIds.length} dummy users` })
  } catch (error) {
    console.error('Failed to cleanup dummy users', error)
    return res.status(500).json({ error: 'Failed to cleanup dummy users' })
  }
}
