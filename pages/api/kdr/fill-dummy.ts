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

    // host check
    const userId = session?.user?.id
    const userEmail = session?.user?.email
    const isHost = (kdr.createdBy && userEmail && kdr.createdBy.email === userEmail) || (kdr.createdById && userId && kdr.createdById === userId)
    if (!isHost) return res.status(403).json({ error: 'Forbidden' })

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
      const suffix = `${now}-${i}`
      const dummyEmail = `dummy+${kdrId}-${suffix}@example.invalid`
      const dummyName = `Dummy Player ${i + 1}`
      creations.push({ name: dummyName, email: dummyEmail })
    }

    // create users and players in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const createdUsers: any[] = []
      for (const c of creations) {
        // create dummy users (schema no longer has isDummy flag)
        const u = await tx.user.create({ data: { name: c.name, email: c.email } })
        createdUsers.push(u)
      }

      const createdPlayers: any[] = []
      for (const u of createdUsers) {
        const p = await tx.kDRPlayer.create({ data: { kdrId: kdr.id, userId: u.id } })
        createdPlayers.push(p)
      }

      return { users: createdUsers, players: createdPlayers }
    })

    const updated = await findKdr(kdr.id, { include: { players: { include: { user: { select: { id: true, name: true, image: true } } } }, createdBy: { select: { id: true, name: true, email: true } } } })
    return res.status(200).json(updated)
  } catch (err) {
    console.error('Failed to fill dummy players', err)
    return res.status(500).json({ error: 'Failed to fill dummy players' })
  }
}
