import { PrismaClient } from '@prisma/client'

async function findBlueEyes() {
  const prisma = new PrismaClient()
  try {
    const user = await prisma.user.findFirst({
      where: { name: 'JustBryant' },
      select: { image: true }
    })
    console.log('USER_IMAGE:' + (user?.image || 'NOT_FOUND'))

    const card = await prisma.card.findFirst({
      where: { name: { contains: 'Blue-Eyes White Dragon', mode: 'insensitive' } },
      select: { imageUrlCropped: true, artworks: true }
    })
    console.log('CARD_IMAGE:' + (card?.imageUrlCropped || 'NOT_FOUND'))
    if (card?.artworks && Array.isArray(card.artworks) && card.artworks.length > 0) {
        console.log('ARTWORK_0:' + JSON.stringify(card.artworks[0]))
    }
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

findBlueEyes()
