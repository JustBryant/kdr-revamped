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
        isSellable: true
      }

      console.log('[DEBUG] Fetching cosmetics with type:', type);

      if (type === 'ALL') {
        where.type = { in: ['CARD_EFFECT', 'ICON_EFFECT'] }
      } else {
        where.type = type as any
      }

      if (search) {
        where.name = {
          contains: search as string,
          mode: 'insensitive'
        }
      }

      console.log('[DEBUG] Prisma Query Where:', JSON.stringify(where));

      const [cosmetics, total] = await Promise.all([
        prisma.item.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { name: 'asc' }
        }),
        prisma.item.count({ where })
      ])
      
      console.log(`[DEBUG] Found ${cosmetics.length} items out of ${total} total.`);
      
      let ownedIds: string[] = []
      let userPoints = 0

      if (session?.user) {
        const userEmail = session.user.email
        const user = await prisma.user.findUnique({ 
          where: { email: userEmail as string },
          select: { id: true, duelistPoints: true }
        })
        if (user) {
          userPoints = user.duelistPoints
          const ownedItems = await (prisma as any).userItem.findMany({
            where: {
              userId: user.id,
              itemId: { in: (cosmetics as any).map((c: any) => c.id) }
            },
            select: { itemId: true }
          })
          ownedIds = ownedItems.map((oi: any) => oi.itemId as string)
        }
      }

      return res.status(200).json({ 
        cosmetics, 
        ownedIds,
        userPoints,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      })
    } catch (error: any) {
      console.error('[API ERROR] /api/shop/cosmetics:', error.message)
      console.error(error.stack)
      return res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
  }

  if (req.method === 'POST') {
    if (!session?.user?.email) return res.status(401).json({ message: "Unauthorized" })

    const { itemId } = req.body
    if (!itemId) return res.status(400).json({ message: "Item ID required" })

    try {
      const user = await prisma.user.findUnique({ 
        where: { email: session.user.email },
        select: { id: true, duelistPoints: true } as any
      }) as any
      if (!user) return res.status(404).json({ message: "User not found" })

      const item = await prisma.item.findUnique({ where: { id: itemId } }) as any
      if (!item) return res.status(404).json({ message: "Item not found" })

      // Check if already owned
      const userId = user.id
      const existing = await (prisma as any).userItem.findFirst({
        where: { userId, itemId }
      })
      if (existing) return res.status(400).json({ message: "Already owned" })

      // Check Price (using item.price as DP cost)
      const price = item.price || 0
      if ((user.duelistPoints || 0) < price) {
        return res.status(400).json({ message: `Insufficient DP (Cost: ${price}, You have: ${user.duelistPoints || 0})` })
      }

      // Deduct DP and add item in a transaction
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { duelistPoints: { decrement: price } } as any
        }),
        (prisma as any).userItem.create({
          data: {
            userId,
            itemId: itemId
          }
        })
      ])

      return res.status(200).json({ success: true, message: "Purchase successful" })
    } catch (error: any) {
      console.error('Purchase error:', error)
      return res.status(500).json({ message: error.message || "Internal Server Error" })
    }
  }

  return res.status(405).json({ message: "Method not allowed" })
}
