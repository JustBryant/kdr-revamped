import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../../lib/kdrHelpers'
import { invalidateKdrCache } from '../../../../lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { kdrId, newClassId } = req.body || {}
    if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing kdrId' })
    if (!newClassId || typeof newClassId !== 'string') return res.status(400).json({ error: 'Missing newClassId' })

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const kdr = await findKdr(kdrId, { select: { id: true, status: true, settingsSnapshot: true } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    // Only allow picking class after KDR started
    if (kdr.status !== 'STARTED') return res.status(400).json({ error: 'Cannot pick class before KDR has started' })

    const player = await prisma.kDRPlayer.findFirst({ where: { kdrId: kdr.id, userId: user.id } })
    if (!player) return res.status(404).json({ error: 'Player not part of this KDR' })

    // Check if duplicate classes are allowed
    const settings = (kdr.settingsSnapshot as any) || {}
    const allowDuplicateClasses = settings.allowDuplicateClasses ?? true

    if (!allowDuplicateClasses) {
      const alreadyPicked = await prisma.kDRPlayer.findFirst({
        where: { kdrId: kdr.id, classId: newClassId, NOT: { id: player.id } },
        select: { id: true }
      })
      if (alreadyPicked) {
        return res.status(403).json({ error: 'This class has already been picked by another player' })
      }
    }

    // If classes were specifically offered, verify selection is valid
    const offeredClasses = (player as any).offeredClasses
    if (offeredClasses && offeredClasses.length > 0) {
      if (!offeredClasses.includes(newClassId)) {
        return res.status(403).json({ error: 'This class was not offered to you' })
      }
    }

    const attachPlayerKey = (p: any) => {
      if (!p) return p
      try { return { ...p, playerKey: (p.userId && kdr?.id) ? generatePlayerKey(p.userId, kdr.id) : null } } catch (e) { return p }
    }

    if (player.classId === newClassId) return res.status(200).json({ message: 'No change', player: attachPlayerKey(player) })

    const updated = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { classId: newClassId } })

    // Grant starting cards and skills via PlayerItem. 
    // This ensures inventory tracking in classview and shop is consistent.
    try {
      const cls = await prisma.class.findUnique({ 
        where: { id: newClassId }, 
        include: { startingCards: { include: { card: true } }, skills: { take: 10 } } 
      })
      if (cls) {
        // Clear old starting items if they exist (clean slate for new class)
        // Note: we only clear items associated with THIS KDR for THIS user.
        // We might want to be careful not to delete items they BOUGHT in the shop, 
        // but since they just picked/switched a class, it's usually the first action.
        
        // Award cards
        for (const sc of (cls.startingCards || [])) {
          if (!sc.cardId) continue
          await prisma.playerItem.create({ 
            data: { 
              userId: user.id, 
              kdrId: kdr.id, 
              kdrPlayerId: player.id,
              cardId: sc.cardId, 
              qty: sc.quantity || 1 
            } 
          })
        }
        // Award skills marked as "INITIAL" or just the basic class skills if applicable
        // Only award the "MAIN" skill implicitly (innate ability).
        // Skills intended for the loot pool should be acquired via the shop.
        for (const s of (cls.skills || [])) {
          if (s.type === 'MAIN' || s.type === 'INNATE' || s.type === 'STARTING') {
              await prisma.playerItem.create({ 
                data: { 
                  userId: user.id, 
                  kdrId: kdr.id, 
                  kdrPlayerId: player.id,
                  skillId: s.id, 
                  qty: 1 
                } 
              })
          }
        }
      }
    } catch (e) {
      console.warn('Failed to grant starting items for class', e)
    }

    // increment playerClassStats picks
    const stat = await prisma.playerClassStats.findFirst({ where: { userId: user.id, classId: newClassId } })
    if (!stat) await prisma.playerClassStats.create({ data: { userId: user.id, classId: newClassId, picks: 1 } })
    else await prisma.playerClassStats.update({ where: { id: stat.id }, data: { picks: { increment: 1 } } })

    try { await invalidateKdrCache(kdr.id) } catch (e) { console.warn('Failed to invalidate KDR cache after pick-class', e) }
    return res.status(200).json({ message: 'Class picked', player: attachPlayerKey(updated) })
  } catch (err) {
    console.error('Failed to pick class', err)
    return res.status(500).json({ error: 'Failed to pick class' })
  }
}
