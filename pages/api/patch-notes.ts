import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { version } = req.query

  try {
    if (version) {
      const note = await prisma.patchNote.findUnique({
        where: { version: String(version) },
        include: { author: { select: { name: true, image: true } } }
      })
      if (!note || !note.isPublished) return res.status(404).json({ error: 'Patch not found' })
      return res.status(200).json(note)
    }

    const notes = await prisma.patchNote.findMany({
      where: { isPublished: true },
      orderBy: { date: 'desc' },
      select: { id: true, version: true, title: true, date: true }
    })
    return res.status(200).json(notes)
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
