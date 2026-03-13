import { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Prefer server session helper in API routes for reliable cookie/session parsing
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    const { search } = req.query
    try {
      const where: any = {}
      if (search && typeof search === 'string') {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          duelistPoints: true,
        },
        orderBy: {
          name: 'asc',
        },
      })
      return res.status(200).json(users)
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch users' })
    }
  }

  if (req.method === 'PUT') {
    const { userId, role } = req.body

    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role' })
    }

    // Prevent changing your own role to non-admin (lockout protection)
    if (userId === session.user.id && role !== 'ADMIN') {
       // Optional: allow it but warn? For now let's block it to be safe.
       return res.status(400).json({ error: 'You cannot remove your own Admin status.' })
    }

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { role },
      })
      return res.status(200).json(user)
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update user' })
    }
  }

  if (req.method === 'PATCH') {
    const { userId, duelistPoints } = req.body

    if (!userId || duelistPoints === undefined) {
      return res.status(400).json({ error: 'Missing userId or duelistPoints' })
    }

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { duelistPoints: parseInt(duelistPoints) },
      })
      return res.status(200).json(user)
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update user DP' })
    }
  }

  if (req.method === 'DELETE') {
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'Missing userId' })

    // Prevent deleting yourself
    if (userId === session.user?.id) return res.status(400).json({ error: 'You cannot delete your own account' })

    try {
      await prisma.user.delete({ where: { id: userId } })
      return res.status(200).json({ message: 'User deleted' })
    } catch (error) {
      console.error('Failed to delete user', error)
      return res.status(500).json({ error: 'Failed to delete user' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
