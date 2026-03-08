import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!(session?.user as any)?.id) return res.status(401).json({ message: "Unauthorized" })

  if (req.method !== 'POST') return res.status(405).json({ message: "Method not allowed" })

  try {
    const userId = (session!.user as any).id
    const lootCratePrice = 500 // Generic price for a random crate

    // 1. Get user gold/stats (placeholder check)
    // const stats = await prisma.playerStats.findFirst({ where: { userId } })
    // if (!stats || stats.gold < lootCratePrice) return res.status(400).json({ message: "Insufficient gold" })

    // 2. Pick a random Profile Icon that the user doesn't own
    const ownedItems = await prisma.playerItem.findMany({
      where: { userId, itemId: { not: null } },
      select: { itemId: true }
    })
    const ownedIds = ownedItems.map(oi => oi.itemId as string)

    const unownedIcons = await prisma.item.findMany({
      where: {
        type: 'PROFILE_ICON' as any,
        id: { notIn: ownedIds }
      },
      take: 100 // Sample 100 to pick from for randomness
    })

    if (unownedIcons.length === 0) {
      return res.status(400).json({ message: "You already own all profile icons!" })
    }

    const wonItem = unownedIcons[Math.floor(Math.random() * unownedIcons.length)]

    // 3. Subtract gold (placeholder) and grant item
    await prisma.playerItem.create({
      data: {
        userId,
        itemId: wonItem.id,
        purchased: true
      }
    })

    return res.status(200).json({ 
      message: "Loot crate opened!",
      item: wonItem
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: "Internal Server Error" })
  }
}
