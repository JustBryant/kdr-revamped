import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

function slugify(input: string) {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const ALLOWED_VARIANTS = ['TCG', 'RUSH']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const formats = await prisma.format.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, variant: true } })
      return res.status(200).json(formats)
    } catch (err) {
      console.error('Error fetching formats', err)
      return res.status(500).json({ error: 'Failed to fetch formats' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, variant } = req.body || {}

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Missing or invalid name' })
      }

      const chosenVariant = (variant || 'TCG').toString().toUpperCase()
      if (!ALLOWED_VARIANTS.includes(chosenVariant)) {
        return res.status(400).json({ error: 'Invalid variant' })
      }

      const slug = slugify(name)

      const existing = await prisma.format.findUnique({ where: { slug } })
      if (existing) {
        return res.status(409).json({ error: 'A format with that name/slug already exists' })
      }

      const created = await prisma.format.create({ data: { name: name.trim(), slug, variant: chosenVariant as any } })
      return res.status(201).json({ id: created.id, name: created.name, slug: created.slug, variant: created.variant })
    } catch (err) {
      console.error('Error creating format', err)
      return res.status(500).json({ error: 'Failed to create format' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
