import { prisma } from './lib/prisma.ts'
async function main() {
  await (prisma as any).$connect()
  const card = await (prisma as any).card.findFirst({
    where: { name: 'Blue-Eyes White Dragon' },
    select: { id: true, imageUrlCropped: true, artworks: true }
  })
  console.log('RESULT:' + JSON.stringify(card))
  process.exit(0)
}
main()
