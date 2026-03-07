import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session || (session as any).user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    const { id } = req.query
    try {
      if (id) {
        const note = await (prisma as any).patchNote.findUnique({
          where: { id: String(id) }
        })
        return res.status(200).json(note)
      }
      const notes = await (prisma as any).patchNote.findMany({
        orderBy: { date: 'desc' }
      })
      return res.status(200).json(notes)
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch' })
    }
  }

  if (req.method === 'POST') {
    const { version, title, content, isPublished, date } = req.body
    try {
      const note = await (prisma as any).patchNote.create({
        data: {
          version,
          title,
          content,
          isPublished,
          date: date ? new Date(date) : new Date(),
          authorId: (session as any).user.id
        }
      })
      return res.status(201).json(note)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Failed to create' })
    }
  }

  if (req.method === 'PUT') {
    const { id, version, title, content, isPublished, date } = req.body
    try {
      const note = await (prisma as any).patchNote.update({
        where: { id: String(id) },
        data: {
          version,
          title,
          content,
          isPublished,
          date: date ? new Date(date) : new Date()
        }
      })
      return res.status(200).json(note)
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update' })
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    try {
      await (prisma as any).patchNote.delete({
        where: { id: String(id) }
      })
      return res.status(200).json({ success: true })
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
