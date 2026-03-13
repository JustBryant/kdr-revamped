import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  const { userIds } = req.body
  console.log('--- BULK DEBUG ---');
  console.log('Method:', req.method);
  console.log('User IDs Count:', userIds?.length);
  console.log('First 5 IDs:', userIds?.slice(0, 5));

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    console.log('Validation Failed: No userIds');
    return res.status(400).json({ error: 'No user IDs provided' })
  }

  if (req.method === 'DELETE') {
    // Prevent deleting yourself in bulk
    const filteredIds = userIds.filter(id => id !== session.user.id)

    try {
      console.log('Starting bulk delete for', filteredIds.length, 'users');
      // Process in chunks to avoid URL/payload length limits and DB timeouts
      const chunkSize = 50
      let deletedCount = 0
      
      for (let i = 0; i < filteredIds.length; i += chunkSize) {
        const chunk = filteredIds.slice(i, i + chunkSize)
        console.log(`Deleting chunk ${i/chunkSize + 1}: ${chunk.length} users`);
        const result = await prisma.user.deleteMany({
          where: { id: { in: chunk } }
        })
        deletedCount += result.count
        console.log(`Successfully deleted ${result.count} users in this chunk. Total: ${deletedCount}`);
      }

      console.log('Bulk delete completed. Total deleted:', deletedCount);
      return res.status(200).json({ message: `Deleted ${deletedCount} users` })
    } catch (error) {
      console.error('CRITICAL BULK DELETE ERROR:', error);
      return res.status(500).json({ error: 'Failed to perform bulk delete', details: (error as any).message })
    }
  }

  if (req.method === 'PATCH') {
    const { role, dpAction, dpAmount } = req.body
    
    // Adjust logic for DP actions
    if (dpAction && (dpAmount === undefined || dpAmount === null)) {
      return res.status(400).json({ error: 'DP amount required for DP action' })
    }

    try {
      let updatedCount = 0

      if (dpAction) {
        // updateMany doesn't support relative operations (like += or decrement) in Prisma with many connectors.
        // We'll use a single RAW SQL for efficiency if possible or loop for small sets. 
        // Given we are in the admin panel and may be doing bulk, a single update query with SQL is best.
        
        const operator = dpAction === 'add' ? '+' : '-';
        const amount = Math.abs(parseInt(dpAmount));

        // Use a transaction + executeRaw to handle the relative update across IDs
        const idsString = userIds.map(id => `'${id}'`).join(',');
        const query = `UPDATE "User" SET "duelistPoints" = "duelistPoints" ${operator} ${amount} WHERE id IN (${idsString})`;
        
        await (prisma as any).$executeRawUnsafe(query);
        updatedCount = userIds.length;
      } else if (role) {
        // Prevent changing your own role in bulk if it's not ADMIN
        const filteredIds = userIds.filter(id => {
          if (id === session.user.id && role !== 'ADMIN') return false
          return true
        })

        // Chunking for role updates
        const chunkSize = 100
        for (let i = 0; i < filteredIds.length; i += chunkSize) {
          const chunk = filteredIds.slice(i, i + chunkSize)
          const result = await prisma.user.updateMany({
            where: { id: { in: chunk } },
            data: { role },
          })
          updatedCount += result.count
        }
      }

      return res.status(200).json({ message: `Updated ${updatedCount} users` })
    } catch (error) {
      console.error('Bulk update error:', error)
      return res.status(500).json({ error: 'Failed to perform bulk update' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
