import dotenv from 'dotenv'
import readline from 'readline'

dotenv.config()

async function main() {
  const argv = process.argv.slice(2)
  const opts: any = {}
  for (const a of argv) {
    if (a.startsWith('--slug=')) opts.slug = a.split('=')[1]
    if (a.startsWith('--formatId=')) opts.formatId = a.split('=')[1]
  }

  const { PrismaClient } = (await import('@prisma/client')) as any
  const { Pool } = (await import('pg')) as any
  const { PrismaPg } = (await import('@prisma/adapter-pg')) as any

  let connectionString = process.env.DATABASE_URL || ''
  if ((connectionString.startsWith('"') && connectionString.endsWith('"')) || (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
    connectionString = connectionString.slice(1, -1)
  }
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  let formatId: string | undefined = undefined
  if (opts.slug) {
    const f = await prisma.format.findUnique({ where: { slug: String(opts.slug) } })
    if (!f) {
      console.error('Format slug not found:', opts.slug)
      await prisma.$disconnect()
      process.exit(1)
    }
    formatId = f.id
  }
  if (opts.formatId) formatId = String(opts.formatId)

  const where: any = { type: 'TREASURE', rarity: 'C' }
  const allItems = await prisma.item.findMany({ where, select: { id: true, name: true, cardId: true, formatId: true, createdAt: true } })

  let inFormat: any[] = []
  let notInFormat: any[] = []
  if (formatId) {
    for (const it of allItems) {
      if (it.formatId === formatId) inFormat.push(it)
      else notInFormat.push(it)
    }
  } else {
    // nothing specified — treat those with formatId null as not in any format
    for (const it of allItems) {
      if (it.formatId) inFormat.push(it)
      else notInFormat.push(it)
    }
  }

  console.log('\nTOTAL common TREASURE items:', allItems.length)
  console.log(`With format ${formatId || '(any)'}:`, inFormat.length)
  console.table(inFormat)
  console.log('\nCommon TREASURE items NOT in that format:', notInFormat.length)
  console.table(notInFormat)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Error listing common treasures:', err)
  process.exit(1)
})
