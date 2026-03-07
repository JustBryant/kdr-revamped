import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  if (!id) return res.status(400).json({ error: 'Missing shopkeeper id' })

  if (req.method === 'POST') {
    const { text, audioUrl } = req.body || {}
    if (!text) return res.status(400).json({ error: 'Missing text' })
    try {
      const v = await prisma.shopkeeperVoiceLine.create({ data: { shopkeeperId: id, text, audioUrl } })
      return res.status(201).json(v)
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to create voice line' })
    }
  }

  if (req.method === 'DELETE') {
    const { voiceLineId } = req.body || {}
    if (!voiceLineId) return res.status(400).json({ error: 'Missing voiceLineId' })
    try {
      await prisma.shopkeeperVoiceLine.delete({ where: { id: voiceLineId } })
      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to delete' })
    }
  }

  if (req.method === 'GET') {
    try {
      const v = await prisma.shopkeeperVoiceLine.findMany({ where: { shopkeeperId: id }, orderBy: { createdAt: 'desc' } })
      return res.status(200).json(v)
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to fetch voice lines' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
