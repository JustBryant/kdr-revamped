import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('Cleaning up orphaned PlayerItem entries...')
    // We can't easily do a nested query with 'not in' in Prisma for IDs that don't exist yet in the DB but exist in the model
    // So we'll fetch all items first
    const items = await prisma.item.findMany({ select: { id: true } })
    const itemIds = items.map(i => i.id)
    
    // Find PlayerItems with itemIds that are NOT in the Items table
    // (This usually happens if you manually added records or if the sync is partial)
    const playerItems = await prisma.playerItem.findMany({
      where: {
        itemId: {
          notIn: itemIds,
          not: null
        }
      }
    })

    console.log(`Found ${playerItems.length} orphaned PlayerItem entries.`)
    
    if (playerItems.length > 0) {
      const deleted = await prisma.playerItem.deleteMany({
        where: {
          id: {
            in: playerItems.map(pi => pi.id)
          }
        }
      })
      console.log(`Deleted ${deleted.count} orphaned entries.`)
    }
    
    console.log('Database should now be ready for sync.')
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
