
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Testing KDRPlayer include...')
  try {
    const kdr = await prisma.kDR.findFirst({
        include: {
            players: {
                include: {
                    user: true,
                    playerDeck: true,
                    playerClass: true
                }
            }
        }
    })
    console.log('Success!')
  } catch (e: any) {
    console.error('FAILED TO FETCH:', e.message)
  }
  process.exit(0)
}

main()
