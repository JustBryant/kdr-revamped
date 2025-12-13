import { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })

  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
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

  return res.status(405).json({ error: 'Method not allowed' })
}
