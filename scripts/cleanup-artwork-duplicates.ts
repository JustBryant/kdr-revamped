
import "dotenv/config";
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = (process.env.DATABASE_URL || '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function cleanupArtworkDuplicates() {
  console.log('--- STARTING CLEANUP OF ARTWORK DUPLICATES ---')
  
  try {
    // 1. Identification: Find items with the new suffix but Index 0
    // These were created because of the previous faulty logic
    const suspectItems = await prisma.item.findMany({
      where: {
        externalId: { contains: '_art_0' },
        type: 'PROFILE_ICON' as any
      }
    })

    console.log(`Found ${suspectItems.length} redundant Index 0 icons to remove.`)

    if (suspectItems.length > 0) {
      const idsToDelete = suspectItems.map(i => i.id)
      
      // Delete the items. Cascade will handle UserItem entries if any exist.
      const result = await prisma.item.deleteMany({
        where: { id: { in: idsToDelete } }
      })
      console.log(`Successfully deleted ${result.count} redundant icons.`)
    }

    console.log('--- CLEANUP COMPLETE ---')
  } catch (error) {
    console.error('ERROR DURING CLEANUP:', error)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

cleanupArtworkDuplicates().catch(console.error)
