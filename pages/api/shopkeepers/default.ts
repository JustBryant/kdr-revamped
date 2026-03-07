import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Prefer a shopkeeper named Hugin (case-insensitive), fall back to first shopkeeper
    const byName = await prisma.shopkeeper.findFirst({ where: { name: { contains: 'Hugin', mode: 'insensitive' } }, select: { id: true, name: true, image: true } })
    if (byName) return res.status(200).json(byName)
    const any = await prisma.shopkeeper.findFirst({ select: { id: true, name: true, image: true } })
    if (any) return res.status(200).json(any)
    return res.status(404).json({ error: 'No shopkeepers configured' })
  } catch (e) {
    console.error('Failed to fetch default shopkeeper', e)
    return res.status(500).json({ error: 'Failed to fetch default shopkeeper' })
  }
}
