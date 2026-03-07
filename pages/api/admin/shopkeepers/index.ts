import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    try {
      const shops = await prisma.shopkeeper.findMany({ include: { voiceLines: true }, orderBy: { name: 'asc' } })
      return res.status(200).json(shops)
    } catch (err) {
      console.error('Prisma findMany failed:', err)
      // fallback: try raw SQL SELECT for basic fields
      try {
        const raw = await prisma.$queryRaw`SELECT id, name, description FROM shopkeeper ORDER BY name ASC`
        return res.status(200).json(raw)
      } catch (err2) {
        console.error('Fallback raw select failed:', err2)
        return res.status(500).json({ error: 'Failed to fetch shopkeepers', details: (err2 && (err2 as any).message) || String(err2) })
      }
    }
  }

  if (req.method === 'POST') {
    const { name, description, image, greeting } = req.body || {}
    if (!name) return res.status(400).json({ error: 'Missing name' })
    try {
      const shop = await prisma.shopkeeper.create({ data: { name, description, image, greeting } })
      return res.status(201).json(shop)
    } catch (err) {
      console.error('Prisma create failed:', err)
      // attempt raw INSERT as fallback in case Prisma client schema mismatched
      try {
        const inserted = await prisma.$queryRaw`INSERT INTO shopkeeper (name, description, image, greeting) VALUES (${name}, ${description}, ${image}, ${greeting}) RETURNING *`
        const arr = inserted as any[]
        return res.status(201).json(arr[0] || arr)
      } catch (err2) {
        console.error('Fallback raw insert failed:', err2)
        // include Prisma error meta if available for debugging
        const meta = (err && typeof err === 'object' && (err as any).meta) ? (err as any).meta : undefined
        return res.status(500).json({ error: 'Failed to create shopkeeper', details: (err2 && (err2 as any).message) || String(err2), meta })
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
