import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"
import { ItemType } from '@prisma/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (req.method === 'GET') {
    try {
      const { 
        type = 'BORDER', 
        page = '1', 
        search = '', 
        limit = '50' 
      } = req.query

      const pageNum = Math.max(1, parseInt(page as string))
      const limitNum = Math.min(100, Math.max(10, parseInt(limit as string)))
      const skip = (pageNum - 1) * limitNum

      const where: any = {
        type: type as any,
        isSellable: true
      }

      if (search) {
        where.name = {
          contains: search as string,
          mode: 'insensitive'
        }
      }

      const [cosmetics, total] = await Promise.all([
        prisma.item.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { name: 'asc' }
        }),
        prisma.item.count({ where })
      ])
      
      let ownedIds: string[] = []
      if ((session?.user as any)?.id) {
        const userId = (session!.user as any).id
        const ownedItems = await prisma.playerItem.findMany({
          where: {
            userId,
            itemId: { in: cosmetics.map(c => c.id) }
          },
          select: { itemId: true }
        })
        ownedIds = ownedItems.map(oi => oi.itemId as string)
      }

      return res.status(200).json({ 
        cosmetics, 
        ownedIds,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: "Internal Server Error" })
    }
  }

  if (req.method === 'POST') {
    if (!(session?.user as any)?.id) return res.status(401).json({ message: "Unauthorized" })

    const { itemId } = req.body
    if (!itemId) return res.status(400).json({ message: "Item ID required" })

    try {
      const item = await prisma.item.findUnique({ where: { id: itemId } })
      if (!item) return res.status(404).json({ message: "Item not found" })

      // Check if already owned
      const userId = (session!.user as any).id
      const existing = await prisma.playerItem.findFirst({
        where: { userId, itemId }
      })
      if (existing) return res.status(400).json({ message: "Already owned" })

      // For now, we'll just "purchase" it for free or check stats if you have a currency system.
      // Since I don't see a "Gold" field on User yet, I'll assume free for now or add a placeholder check.
      
      await prisma.playerItem.create({
        data: {
          userId,
          itemId: itemId,
          purchased: true
        }
      })

      return res.status(200).json({ message: "Purchase successful" })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: "Internal Server Error" })
    }
  }

  return res.status(405).json({ message: "Method not allowed" })
}
