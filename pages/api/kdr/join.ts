import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../lib/kdrHelpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const userId = (session?.user as any)?.id
  const userEmail = session?.user?.email
  if (!session || (!userEmail && !userId)) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { kdrId, deckId, classId, password } = req.body || {}
    if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing or invalid kdrId' })

    const user = await prisma.user.findFirst({
      where: { OR: [
        { id: userId || undefined },
        { email: userEmail || undefined }
      ]}
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const kdr = await findKdr(kdrId)
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    // Check password if KDR is private
    if (kdr.password) {
      if (!password || password !== kdr.password) {
        return res.status(401).json({ error: 'Incorrect password' })
      }
    }

    // Prevent duplicate joins (use canonical kdr.id)
    const exists = await prisma.kDRPlayer.findFirst({ where: { kdrId: kdr.id, userId: user.id } })
    const attachPlayerKey = (p: any) => { if (!p) return p; try { return { ...p, playerKey: (p.userId && kdr?.id) ? generatePlayerKey(p.userId, kdr.id) : null } } catch (e) { return p } }
    
    if (exists) {
      if (exists.status === 'ACTIVE') {
        return res.status(200).json({ message: 'Already joined', player: attachPlayerKey(exists) })
      }
      // Re-activate previously left/kicked player
      const reactivated = await prisma.kDRPlayer.update({
        where: { id: exists.id },
        data: { status: 'ACTIVE' }
      })
      return res.status(200).json({ message: 'Re-activated', player: attachPlayerKey(reactivated) })
    }

    // Create the player and record the chosen class for this KDR (classId preferred, fallback from deck)
    let chosenClassId: string | undefined = undefined
    if (classId && typeof classId === 'string') chosenClassId = classId
    if (!chosenClassId && deckId) {
      const deck = await prisma.deck.findUnique({ where: { id: deckId }, select: { classId: true } })
      if (deck?.classId) chosenClassId = deck.classId
    }

    const created = await prisma.kDRPlayer.create({ data: { kdrId: kdr.id, userId: user.id, deckId: deckId || undefined, classId: chosenClassId || undefined } })

    // Trigger Pusher updates
    try {
      const { triggerPusher } = await import('../../../lib/pusher')
      await triggerPusher('kdr-lobby', 'update', { type: 'update', action: 'join' })
      if (kdr.id) {
        await triggerPusher(`kdr-${kdr.id}`, 'update', { type: 'update', action: 'join' })
      }
    } catch (e) {
      console.error('Failed to trigger Pusher for join:', e)
    }

    // Award the per-KDR class pick once when joining, if a class was chosen
    if (chosenClassId) {
      const classStat = await prisma.playerClassStats.findFirst({ where: { userId: user.id, classId: chosenClassId } })
      if (!classStat) {
        await prisma.playerClassStats.create({ data: { userId: user.id, classId: chosenClassId, picks: 1 } })
      } else {
        await prisma.playerClassStats.update({ where: { id: classStat.id }, data: { picks: { increment: 1 } } })
      }

      // Award starting items for the class (so inventory is tracked)
      try {
        const cls = await prisma.class.findUnique({ where: { id: chosenClassId }, include: { startingCards: true, skills: true } })
        if (cls) {
          for (const sc of (cls.startingCards || [])) {
            if (!sc.cardId) continue
            await prisma.playerItem.create({ data: { userId: user.id, kdrId: kdr.id, kdrPlayerId: created.id, cardId: sc.cardId, qty: sc.quantity || 1 } })
          }
          for (const s of (cls.skills || [])) {
            await prisma.playerItem.create({ data: { userId: user.id, kdrId: kdr.id, kdrPlayerId: created.id, skillId: s.id, qty: 1 } })
          }
        }
      } catch (e) {
        console.warn('Failed to grant starting items in join.ts', e)
      }
    }

    return res.status(201).json(attachPlayerKey(created))
  } catch (error) {
    console.error('Error joining KDR:', error)
    return res.status(500).json({ error: 'Failed to join KDR' })
  }
}
