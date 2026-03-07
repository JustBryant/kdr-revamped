import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string }
  if (!id) return res.status(400).json({ error: 'Missing shopkeeper id' })

  try {
    const items = await prisma.shopkeeperDialogue.findMany({ where: { shopkeeperId: id }, orderBy: { createdAt: 'desc' } })
    return res.status(200).json(items)
  } catch (err) {
    console.error('Failed to fetch shopkeeper dialogues', err)
    return res.status(500).json({ error: 'Failed to fetch dialogues' })
  }
}
