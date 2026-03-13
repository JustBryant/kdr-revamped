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
    if (!['BORDER', 'FRAME', 'TITLE', 'BACKGROUND', 'PROFILE_ICON', 'CARD_EFFECT', 'ICON_EFFECT', 'NONE'].includes(cosmeticType)) {
        return res.status(400).json({ message: "Invalid cosmetic type" })
    }

    try {
      // Check ownership (Ignore checks for un-equipping)
      if (itemId && itemId !== 'NONE') {
         // Use UserItem since that's what the Item model uses for owners in schema.prisma
         const owned = await prisma.userItem.findFirst({
            where: { userId: session.user.id, itemId }
         })
         
         // fallback to playerItem if that's where they are stored
         if (!owned) {
            const ownedAlt = await prisma.playerItem.findFirst({
                where: { userId: session.user.id, itemId }
            })
            if (!ownedAlt) return res.status(403).json({ message: "You don't own this item" })
         }
      }

      const updateData: any = {}
      const itemValue = itemId === 'NONE' ? null : itemId

      if (cosmeticType === 'BORDER') updateData.borderId = itemValue
      if (cosmeticType === 'FRAME') updateData.frameId = itemValue
      if (cosmeticType === 'TITLE') updateData.titleId = itemValue
      if (cosmeticType === 'BACKGROUND') updateData.backgroundId = itemValue
      if (cosmeticType === 'PROFILE_ICON') updateData.profileIconId = itemValue
      if (cosmeticType === 'CARD_EFFECT') updateData.cardEffectId = itemValue
      if (cosmeticType === 'ICON_EFFECT') updateData.iconEffectId = itemValue
      
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData
      })

      console.log(`[EQUIP SUCCESS] User ${session.user.id} updateData:`, updateData);
      
      return res.status(200).json({ message: "Updated session cosmetic preference", user: updatedUser })
    } catch (error) {
       console.error("[EQUIP ERROR]:", error)
       return res.status(500).json({ message: "Internal Server Error" })
    }
  }

  return res.status(405).json({ message: "Method not allowed" })
}
