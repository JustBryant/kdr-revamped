import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { resolveKdrId } from '../../../lib/kdrHelpers'
import { invalidateKdrCache } from '../../../lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { kdrId } = req.body || {}
  if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing kdrId' })

  try {
    const id = await resolveKdrId(kdrId)
    if (!id) return res.status(404).json({ error: 'KDR not found' })

    const player = await prisma.kDRPlayer.findFirst({
      where: {
        kdrId: id,
        user: {
          OR: [
            { id: session.user.id },
            { email: session.user.email }
          ]
        },
        status: 'ACTIVE'
      }
    })
    
    if (!player) return res.status(404).json({ error: 'You are not an active participant in this KDR' })

    // Change status to LEFT.
    await prisma.kDRPlayer.update({ where: { id: player.id }, data: { status: 'LEFT' } })

    try { await invalidateKdrCache(id) } catch (e) { console.warn('Failed to invalidate KDR cache on leave', e) }

    // Trigger Pusher updates
    try {
      const { triggerPusher } = await import('../../../lib/pusher')
      await triggerPusher('kdr-lobby', 'update', { type: 'update', action: 'leave' })
      if (id) {
        await triggerPusher(`kdr-${id}`, 'update', { type: 'update', action: 'leave' })
      }
    } catch (e) {
      console.error('Failed to trigger Pusher for leave:', e)
    }

    return res.status(200).json({ message: 'You have left the KDR' })
  } catch (error: any) {
    console.error('Error leaving KDR:', error)
    return res.status(500).json({ error: 'Failed to leave KDR' })
  }
}
