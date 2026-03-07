import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  if (!id) return res.status(400).json({ error: 'Missing shopkeeper id' })

  if (req.method === 'GET') {
    try {
      if (prisma && (prisma as any).shopkeeperDialogue && typeof (prisma as any).shopkeeperDialogue.findMany === 'function') {
        const items = await (prisma as any).shopkeeperDialogue.findMany({ where: { shopkeeperId: id }, orderBy: { createdAt: 'desc' } })
        return res.status(200).json(items)
      }
      // Fallback raw select
      const raw = await prisma.$queryRaw`SELECT id, shopkeeper_id as "shopkeeperId", type, text, created_at as "createdAt" FROM "ShopkeeperDialogue" WHERE shopkeeper_id = ${id} ORDER BY created_at DESC`
      return res.status(200).json(raw)
    } catch (err) {
      console.error('Failed to list dialogues', err)
      return res.status(500).json({ error: 'Failed to list dialogues', details: (err && (err as any).message) || String(err) })
    }
  }

  if (req.method === 'POST') {
    const { type, text } = req.body || {}
    if (!type || !text) return res.status(400).json({ error: 'Missing type or text' })
    try {
      if (prisma && (prisma as any).shopkeeperDialogue && typeof (prisma as any).shopkeeperDialogue.create === 'function') {
        const item = await (prisma as any).shopkeeperDialogue.create({ data: { shopkeeperId: id, type, text } })
        return res.status(201).json(item)
      }
      // Fallback raw insert
      const inserted = await prisma.$queryRaw`INSERT INTO "ShopkeeperDialogue" (id, shopkeeper_id, type, text, created_at) VALUES (gen_random_uuid(), ${id}, ${type}, ${text}, now()) RETURNING id, shopkeeper_id as "shopkeeperId", type, text, created_at as "createdAt"`
      const arr = inserted as any[]
      return res.status(201).json(arr[0] || arr)
    } catch (err) {
      console.error('Failed to create dialogue', err)
      return res.status(500).json({ error: 'Failed to create dialogue' })
    }
  }

  if (req.method === 'PUT') {
    const { dialogueId, text } = req.body || {}
    if (!dialogueId || !text) return res.status(400).json({ error: 'Missing dialogueId or text' })
    try {
      if (prisma && (prisma as any).shopkeeperDialogue && typeof (prisma as any).shopkeeperDialogue.update === 'function') {
        const item = await (prisma as any).shopkeeperDialogue.update({ where: { id: dialogueId }, data: { text } })
        return res.status(200).json(item)
      }
      await prisma.$queryRaw`UPDATE "ShopkeeperDialogue" SET text = ${text} WHERE id = ${dialogueId}`
      return res.status(200).json({ message: 'Updated' })
    } catch (err) {
      console.error('Failed to update dialogue', err)
      return res.status(500).json({ error: 'Failed to update dialogue' })
    }
  }

  if (req.method === 'DELETE') {
    const { dialogueId } = req.body || {}
    if (!dialogueId) return res.status(400).json({ error: 'Missing dialogueId' })
    try {
      if (prisma && (prisma as any).shopkeeperDialogue && typeof (prisma as any).shopkeeperDialogue.delete === 'function') {
        await (prisma as any).shopkeeperDialogue.delete({ where: { id: dialogueId } })
        return res.status(200).json({ message: 'Deleted' })
      }
      await prisma.$queryRaw`DELETE FROM "ShopkeeperDialogue" WHERE id = ${dialogueId}`
      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      console.error('Failed to delete dialogue', err)
      return res.status(500).json({ error: 'Failed to delete dialogue' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
