import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { findKdr } from '../../../../lib/kdrHelpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { kdrId, skillId, packId, itemId } = req.body || {}
  
  if (!kdrId || !skillId || !packId) {
    return res.status(400).json({ error: 'Missing kdrId, skillId or packId' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, name: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const kdr = await findKdr(kdrId, { select: { id: true } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    const player = await prisma.kDRPlayer.findFirst({
      where: { kdrId: kdr.id, userId: user.id }
    })
    if (!player) return res.status(404).json({ error: 'Player not found' })

    // 1. Grant Selected Skill
    const skill = await prisma.skill.findUnique({ where: { id: skillId } })
    if (!skill) return res.status(404).json({ error: 'Skill not found' })

    await prisma.playerItem.create({
      data: {
        userId: user.id,
        kdrId: kdr.id,
        skillId: skill.id,
        itemId: itemId || null,
        qty: 1
      }
    })

    // 2. Grant Selected Starter Pack (LootPool)
    const pack = await prisma.lootPool.findUnique({ 
      where: { id: packId },
      include: { items: true }
    })
    if (!pack) return res.status(404).json({ error: 'Pack not found' })

    // Award all items in the pack
    for (const item of pack.items) {
      if (item.cardId) {
        await prisma.playerItem.create({
          data: {
            userId: user.id,
            kdrId: kdr.id,
            cardId: item.cardId,
            qty: 1
          }
        })
      } else if (item.skillId) {
        await prisma.playerItem.create({
          data: {
            userId: user.id,
            kdrId: kdr.id,
            skillId: item.skillId,
            qty: 1
          }
        })
      }
    }

    // 3. Mark Choice as Complete (Optionally we can store this in player shopState or other JSON field)
    // For now we'll just track it by the fact that items were added.
    // We'll use the existing shopState field or just a local flag in the session/frontend.
    await prisma.kDRPlayer.update({
      where: { id: player.id },
      data: {
        shopState: {
          ...(player.shopState as any || {}),
          startingLootClaimed: true,
          startingLoot: {
            skillName: skill.name,
            packName: pack.name,
            claimedAt: new Date().toISOString()
          }
        }
      }
    })

    return res.status(200).json({ success: true, message: 'Starting loot claimed' })
  } catch (err) {
    console.error('Failed to claim starting loot', err)
    return res.status(500).json({ error: 'Failed to claim starting loot' })
  }
}
