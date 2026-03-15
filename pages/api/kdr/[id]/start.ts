import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { findKdr } from '../../../../lib/kdrHelpers'
import { sendKdrStartedEmail } from '../../../../lib/email'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const kdr = await findKdr(id, { include: { createdBy: { select: { id: true, email: true } }, players: { include: { user: { select: { id: true, email: true, name: true } } } } } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    const userId = session?.user?.id
    const userEmail = session?.user?.email
    const isAdmin = session?.user?.role === 'ADMIN'
    const isHost = (kdr.createdBy && userEmail && kdr.createdBy.email === userEmail) || (kdr.createdById && userId && kdr.createdById === userId)
    if (!isHost && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

    // Update status to STARTED (only if currently OPEN)
    if (kdr.status === 'OPEN') {
      await prisma.kDR.update({ where: { id: kdr.id }, data: { status: 'STARTED' } })
    }

    // Notify players: create Notification rows and send emails
    const activePlayers = (kdr.players || []).filter((p: any) => p.status === 'ACTIVE')

    const notifications = activePlayers
      .filter((p: any) => p.user?.id)
      .map((p: any) => ({ userId: p.user.id, title: `KDR started: ${kdr.name}`, body: `KDR ${kdr.name} has started. Click to view.` }))
    // bulk create notifications (if Notification model exists in DB)
    if (notifications.length > 0) {
      try {
        if ((prisma as any).notification) await (prisma as any).notification.createMany({ data: notifications })
      } catch (e) {
        console.warn('Skipping notifications.createMany - model may not exist', e)
      }
    }

    // send emails in background (do not block on failures)
    for (const p of activePlayers) {
      if (p.user?.email) {
        sendKdrStartedEmail(p.user.email, { id: kdr.id, name: kdr.name, slug: kdr.slug })
      }
    }

    const updated = await findKdr(id, { include: { players: { include: { user: { select: { id: true, name: true, email: true, image: true } } } }, createdBy: { select: { id: true, name: true, email: true } } } })
    return res.status(200).json(updated)
  } catch (err) {
    console.error('Failed to start KDR', err)
    return res.status(500).json({ error: 'Failed to start KDR' })
  }
}
