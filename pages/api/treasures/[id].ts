import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (req.method === 'DELETE') {
    try {
      // Delete an Item of type TREASURE instead of legacy LootItem
      await prisma.item.delete({
        where: { id: String(id) }
      })
      return res.status(200).json({ message: 'Treasure (Item) deleted' })
    } catch (error) {
      console.error('Error deleting treasure:', error)
      return res.status(500).json({ error: 'Failed to delete treasure' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
