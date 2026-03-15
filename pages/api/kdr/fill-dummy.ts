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
    const kdr = await findKdr(kdrId, { select: { id: true, playerCount: true, createdById: true, createdBy: { select: { id: true, email: true } }, players: { where: { status: 'ACTIVE' }, select: { id: true, userId: true } } } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    // host or admin check
    const userId = session?.user?.id
    const userEmail = session?.user?.email
    const isAdmin = session?.user?.role === 'ADMIN'
    const isHost = (kdr.createdBy && userEmail && kdr.createdBy.email === userEmail) || (kdr.createdById && userId && kdr.createdById === userId)
    if (!isHost && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

    const configured = kdr.playerCount || 0
    const current = (kdr.players || []).length
    const toCreate = Math.max(0, configured - current)
    if (toCreate <= 0) {
      const updated = await findKdr(kdr.id, { include: { players: { include: { user: { select: { id: true, name: true, image: true } } } }, createdBy: { select: { id: true, name: true, email: true } } } })
      return res.status(200).json(updated)
    }

    const now = Date.now()
    const creations: any[] = []
    for (let i = 0; i < toCreate; i++) {
      const dummyName = `Dummy Player ${i + 1}`
      creations.push({ name: dummyName })
    }

    // Create players directly without creating users
    await prisma.$transaction(async (tx) => {
      for (const c of creations) {
        await tx.kDRPlayer.create({ 
          data: { 
            kdrId: kdr.id, 
            userId: null, 
            name: c.name 
          } 
        })
      }
    })

    const updated = await findKdr(kdr.id, { include: { players: { include: { user: { select: { id: true, name: true, image: true } } } }, createdBy: { select: { id: true, name: true, email: true } } } })
    return res.status(200).json(updated)
  } catch (err) {
    console.error('Failed to fill dummy players', err)
    return res.status(500).json({ error: 'Failed to fill dummy players' })
  }
}
