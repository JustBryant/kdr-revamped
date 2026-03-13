import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfill() {
  console.log('Starting backfill of kdrPlayerId on PlayerItem')
  const BATCH = 1000
  let cursor: string | null = null
  let total = 0

  while (true) {
    const items = await prisma.playerItem.findMany({
      where: { kdrId: { not: null }, kdrPlayerId: null },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    })
    if (!items || items.length === 0) break

    for (const it of items) {
      try {
        // Find matching KDRPlayer by userId + kdrId
        const kp = await prisma.kDRPlayer.findFirst({ where: { userId: it.userId, kdrId: it.kdrId } })
        if (kp) {
          await prisma.playerItem.update({ where: { id: it.id }, data: { kdrPlayerId: kp.id } })
          total++
        } else {
          // No matching KDRPlayer: skip for manual inspection (log once)
          console.warn(`No KDRPlayer for PlayerItem ${it.id} (userId=${it.userId}, kdrId=${it.kdrId})`)
        }
      } catch (e) {
        console.error('Failed to backfill item', it.id, e)
      }
      cursor = it.id
    }

    if (items.length < BATCH) break
  }

  console.log(`Backfill complete. Updated ${total} rows.`)
}

backfill().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
