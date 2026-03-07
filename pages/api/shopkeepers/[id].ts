import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' })

  try {
    const sk = await prisma.shopkeeper.findUnique({ where: { id }, select: { id: true, name: true, image: true } })
    if (!sk) return res.status(404).json({ error: 'Shopkeeper not found' })
    return res.status(200).json(sk)
  } catch (e) {
    console.error('Failed to fetch shopkeeper', e)
    return res.status(500).json({ error: 'Failed to fetch shopkeeper' })
  }
}
