import readline from 'readline'

async function main() {
  const argv = process.argv.slice(2)
  const opts: any = {}
  for (const a of argv) {
    if (a.startsWith('--formatId=')) opts.formatId = a.split('=')[1]
    if (a.startsWith('--slug=')) opts.slug = a.split('=')[1]
    if (a === '--force') opts.force = true
    if (a === '--all') opts.all = true
  }

  // create a local PrismaClient instance to avoid importing the project's
  // `lib/prisma` which may have bundler/runtime-specific adapters.
  const dotenv = await import('dotenv')
  dotenv.config()

  const { PrismaClient } = (await import('@prisma/client')) as any
  const { Pool } = (await import('pg')) as any
  const { PrismaPg } = (await import('@prisma/adapter-pg')) as any

  // mirror connection-string cleanup done in lib/prisma
  let connectionString = process.env.DATABASE_URL || ''
  if ((connectionString.startsWith('"') && connectionString.endsWith('"')) || (connectionString.startsWith('\'') && connectionString.endsWith('\''))) {
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
      process.exit(1)
    }
    formatId = f.id
  }
  if (opts.formatId) formatId = String(opts.formatId)

  if (!formatId && !opts.all) {
    console.log('No format specified. Use --slug=SLUG, --formatId=ID, or --all to target all formats. Aborting.')
    process.exit(1)
  }

  // fetch all treasures and normalize rarity in JS to capture 'Common', 'C', 'Normal', etc.
  const allTreasures = await prisma.item.findMany({ where: { type: 'TREASURE' }, include: { card: true }, orderBy: { createdAt: 'asc' } })

  const normalizeRarity = (v: any) => {
    const s = String(v || '').trim().toUpperCase()
    if (!s) return ''
    if (s === 'C' || s === 'COMMON' || s === 'N' || s === 'NORMAL') return 'C'
    if (s === 'R' || s === 'RARE') return 'R'
    if (s === 'SR' || s === 'S' || s === 'SUPER' || s === 'SUPER RARE') return 'SR'
    if (s === 'UR' || s === 'U' || s === 'ULTRA' || s === 'ULTRA RARE') return 'UR'
    return s
  }

  const candidates = allTreasures.filter((it: any) => {
    const nr = normalizeRarity(it.rarity || (it.card && it.card.rarity))
    if (nr !== 'C') return false
    if (formatId) return it.formatId === formatId
    return true
  })

  console.log(`Found ${candidates.length} TREASURE items normalized as 'C'` + (formatId ? ` for format ${formatId}` : ' (all formats)'))
  if (candidates.length > 0) console.table(candidates.map((c: any) => ({ id: c.id, name: c.name, cardId: c.cardId, formatId: c.formatId, rarity: c.rarity, createdAt: c.createdAt })))

  if (candidates.length === 0) {
    await prisma.$disconnect()
    process.exit(0)
  }

  if (!opts.force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const answer = await new Promise<string>((res) => rl.question('Proceed to DELETE these items? Type "yes" to confirm: ', res))
    rl.close()
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted by user. No changes made.')
      await prisma.$disconnect()
      process.exit(0)
    }
  }

  const ids = candidates.map((i: any) => i.id)
  const result = await prisma.item.deleteMany({ where: { id: { in: ids } } })
  console.log('Deleted count:', result.count)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Error running remove-common-treasures:', err)
  process.exit(1)
})
