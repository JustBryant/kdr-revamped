import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const session = await getServerSession(req, res, authOptions)
    const isAdmin = session?.user && (session.user as any).role === 'ADMIN'

    const classes = await prisma.class.findMany({
      where: isAdmin ? {} : { isPublic: true },
      select: { id: true, name: true, image: true }
    })
    return res.status(200).json(classes)
  } catch (err) {
    console.error('Failed to fetch classes', err)
    return res.status(500).json({ error: 'Failed to fetch classes' })
  }
}
