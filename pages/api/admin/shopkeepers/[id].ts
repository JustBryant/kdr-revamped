import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  if (!id) return res.status(400).json({ error: 'Missing id' })

  if (req.method === 'PUT') {
    const { name, description, image, greeting } = req.body || {}
    try {
      const shop = await prisma.shopkeeper.update({ where: { id }, data: { name, description, image, greeting } })
      return res.status(200).json(shop)
    } catch (err) {
      console.error('Failed to update shopkeeper', err)
      return res.status(500).json({ error: 'Failed to update', details: (err && (err as any).message) || String(err) })
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.shopkeeperVoiceLine.deleteMany({ where: { shopkeeperId: id } }).catch(() => {})
        await tx.shopkeeper.delete({ where: { id } })
      })
      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      console.error('Failed to delete shopkeeper', err)
      return res.status(500).json({ error: 'Failed to delete', details: (err && (err as any).message) || String(err) })
    }
  }

  if (req.method === 'GET') {
    try {
      const shop = await prisma.shopkeeper.findUnique({ where: { id }, include: { voiceLines: true } })
      if (!shop) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json(shop)
    } catch (err) {
      console.error('Failed to fetch shopkeeper', err)
      return res.status(500).json({ error: 'Failed to fetch', details: (err && (err as any).message) || String(err) })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
