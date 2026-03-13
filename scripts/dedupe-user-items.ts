import "dotenv/config";
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = (process.env.DATABASE_URL || '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function dedupeUserItems() {
  console.log('--- STARTING DEDUPLICATION OF USERITEM ENTRIES ---')
  
  try {
    // Check if userItem exists on the prisma object
    const userItemModel = (prisma as any).userItem;
    if (!userItemModel) {
      throw new Error('UserItem model not found on Prisma client.');
    }

    // 1. Fetch all UserItem entries
    const allUserItems = await userItemModel.findMany()
    console.log(`Found ${allUserItems.length} total UserItem entries.`)

    const seen = new Set()
    const duplicateIds: string[] = []

    for (const record of allUserItems) {
      // Unique key: userId + itemId
      const key = `${record.userId}-${record.itemId}`
      if (seen.has(key)) {
        duplicateIds.push(record.id)
      } else {
        seen.add(key)
      }
    }

    if (duplicateIds.length === 0) {
      console.log('No duplicates found in the database. All unique records.')
      return
    }

    console.log(`Identified ${duplicateIds.length} duplicate entries to remove.`)

    // 2. Delete the specific duplicate IDs
    const result = await userItemModel.deleteMany({
      where: {
        id: { in: duplicateIds }
      }
    })

    console.log(`Successfully deleted ${result.count} duplicate records.`)
    console.log('--- DEDUPLICATION COMPLETE ---')

  } catch (error) {
    console.error('CRITICAL ERROR DURING DEDUPLICATION:', error)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

dedupeUserItems().catch(console.error)
