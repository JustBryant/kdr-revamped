import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
const { appendAudit } = require('../../../../lib/adminAudit.cjs')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(403).json({ error: 'Forbidden' })
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!dbUser || dbUser.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { classId } = req.body || {}
    let kdrId = req.body?.kdrId
    let formatSlug = req.body?.formatSlug
    console.log('[admin/class-snapshot] request body:', { classId, kdrId, formatSlug })
    console.log('[admin/class-snapshot] session user:', session.user?.email)
    if (!classId) return res.status(400).json({ error: 'Missing classId' })

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        startingCards: { include: { card: true } },
        skills: { include: { modifications: { include: { card: true } }, providesCards: true } },
        lootPools: { include: { items: { include: { card: true } } } }
      }
    }) as any

    if (!cls) return res.status(404).json({ error: 'Class not found' })

    const classSnapshot: any = {
      id: cls.id,
      name: cls.name,
      image: cls.image || undefined,
      legendaryMonster: cls.legendaryMonster || undefined,
      legendaryQuest: cls.legendaryQuest || undefined,
      legendaryRelic: cls.legendaryRelic || undefined,
      startingCards: (cls.startingCards || []).map((sc: any) => ({ card: sc.card || sc, quantity: sc.quantity, category: sc.category })),
      skills: (cls.skills || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        type: s.type,
        providesCards: (s.providesCards || []).map((c: any) => (c)),
        modifications: (s.modifications || []).map((m: any) => ({ ...m, card: m.card }))
      })),
      lootPools: (cls.lootPools || []).map((p: any) => ({ id: p.id, name: p.name, tier: p.tier, tax: p.tax, items: (p.items || []).map((it: any) => ({ ...it, card: it.card })) }))
    }

    const applyToKdr = async (kdr: any) => {
      const existing = kdr.settingsSnapshot || {}
      const classSnapshots = existing.classSnapshots || {}
      const prevSnapshot = classSnapshots[classId]

      const prevStartingCardIds: string[] = (prevSnapshot?.startingCards || []).map((sc: any) => sc?.card?.id || sc?.cardId || sc?.id || sc).filter(Boolean)
      const prevSkillIds: string[] = (prevSnapshot?.skills || []).map((s: any) => s?.id).filter(Boolean)

      const currStartingCardIds: string[] = (classSnapshot.startingCards || []).map((sc: any) => sc?.card?.id || sc?.cardId || sc?.id || sc).filter(Boolean)
      const currSkillIds: string[] = (classSnapshot.skills || []).map((s: any) => s?.id).filter(Boolean)

      const removedCardIds = prevStartingCardIds.filter((id: string) => !currStartingCardIds.includes(id))
      const removedSkillIds = prevSkillIds.filter((id: string) => !currSkillIds.includes(id))

      classSnapshots[classId] = classSnapshot
      const newSnapshot = { ...existing, classSnapshots }

      const players = await prisma.kDRPlayer.findMany({ where: { kdrId: kdr.id, classId }, select: { id: true, userId: true, deckId: true } })
      const deckIds = players.map((p: any) => p.deckId).filter(Boolean as any)
      const userIds = players.map((p: any) => p.userId).filter(Boolean as any)

      const txOps: any[] = []
      txOps.push(prisma.kDR.update({ where: { id: kdr.id }, data: { settingsSnapshot: newSnapshot } }))

      if (removedCardIds.length > 0 && deckIds.length > 0) {
        txOps.push(prisma.deckCard.deleteMany({ where: { deckId: { in: deckIds }, cardId: { in: removedCardIds } } }))
      }

      if (removedSkillIds.length > 0 && userIds.length > 0) {
        txOps.push(prisma.playerItem.deleteMany({ where: { userId: { in: userIds }, skillId: { in: removedSkillIds }, kdrId: kdr.id } }))
      }

      const results = await prisma.$transaction(txOps)
      return results[0]
    }

    if (kdrId && typeof kdrId === 'string') {
      const kdr = await prisma.kDR.findUnique({ where: { id: kdrId } })
      if (!kdr) return res.status(404).json({ error: 'KDR not found' })
      const updated = await applyToKdr(kdr)
      try { appendAudit({ action: 'publish_class_snapshot', target: 'kdr', kdrId: kdrId, classId, user: session.user?.email }) } catch (e) {}
      return res.status(200).json({ message: 'Class snapshot applied to KDR', kdr: updated })
    }

    if (formatSlug && typeof formatSlug === 'string') {
      const format = await prisma.format.findUnique({ where: { slug: formatSlug } })
      if (!format) return res.status(404).json({ error: 'Format not found' })
      const where = { formatId: format.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
      const kdrs = await prisma.kDR.findMany({ where })
      const updates = await Promise.all(kdrs.map((k: any) => applyToKdr(k)))
      try { appendAudit({ action: 'publish_class_snapshot', target: 'format', formatId: format.id, classId, count: updates.length, user: session.user?.email }) } catch (e) {}
      return res.status(200).json({ message: 'Class snapshots applied', count: updates.length })
    }

    return res.status(400).json({ error: 'Missing kdrId or formatSlug' })
  } catch (error: any) {
    console.error('Error publishing class snapshot to KDRs:', error)
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({ error: error.message || 'Failed to publish class snapshot', stack: error.stack })
    }
    return res.status(500).json({ error: 'Failed to publish class snapshot' })
  }
}