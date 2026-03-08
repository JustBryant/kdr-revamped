import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ message: "Unauthorized" })

  if (req.method === 'POST') {
    if (!session?.user?.id) return res.status(401).json({ message: "Unauthorized" })
    const { itemId, cosmeticType } = req.body
    if (!['BORDER', 'FRAME', 'TITLE', 'NONE'].includes(cosmeticType)) {
        return res.status(400).json({ message: "Invalid cosmetic type" })
    }

    try {
      // Check ownership first
      if (itemId) {
         const owned = await prisma.playerItem.findFirst({
            where: { userId: session.user.id, itemId }
         })
         if (!owned) return res.status(403).json({ message: "You don't own this item" })
      }

      const updateData: any = {}
      if (cosmeticType === 'BORDER') updateData.borderId = itemId
      if (cosmeticType === 'FRAME') updateData.frameId = itemId
      if (cosmeticType === 'TITLE') updateData.titleId = itemId
      
      // Handle un-equipping
      if (cosmeticType === 'NONE') {
         // require specific field
         const field = req.body.field // 'border', 'frame', 'title'
         if (field === 'border') updateData.borderId = null
         if (field === 'frame') updateData.frameId = null
         if (field === 'title') updateData.titleId = null
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data: updateData
      })

      return res.status(200).json({ message: "Updated session cosmetic preference" })
    } catch (error) {
       console.error(error)
       return res.status(500).json({ message: "Internal Server Error" })
    }
  }

  return res.status(405).json({ message: "Method not allowed" })
}
