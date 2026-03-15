import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { findKdr } from '../../../lib/kdrHelpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { kdrId } = req.body || {}
  if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing kdrId' })

  try {
    const kdr = await findKdr(kdrId, { select: { id: true, createdById: true, createdBy: { select: { id: true, email: true } } } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    const userId = session?.user?.id
    const userEmail = session?.user?.email
    const isHost = (kdr.createdBy && userEmail && kdr.createdBy.email === userEmail) || (kdr.createdById && userId && kdr.createdById === userId)
    if (!isHost) return res.status(403).json({ error: 'Forbidden' })

    // Hard-delete: remove the KDR row so DB-level ON DELETE CASCADE
    // will remove related rows (PlayerItem, KDRPlayer, rounds, etc.).
    await prisma.kDR.delete({ where: { id: kdr.id } })

    return res.status(200).json({ success: true, deleted: true })
  } catch (error) {
    console.error('Failed to delete KDR', error)
    return res.status(500).json({ error: 'Failed to delete KDR' })
  }
}
