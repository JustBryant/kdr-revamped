import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ message: "Unauthorized" })

  if (req.method !== 'GET') {
    return res.status(405).json({ message: "Method not allowed" })
  }

  try {
    const userEmail = session.user.email
    if (!userEmail) return res.status(401).json({ message: "Unauthorized" })

    // Find user record first
    const userResult = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true }
    })

    if (!userResult) return res.status(404).json({ message: "User not found" })
    const userId = userResult.id

    console.log('[DEBUG] Fetching owned icons for user:', userId);

    // If prisma.userItem doesn't exist on the type, use string accessor to bypass TS check
    // while we wait for the IDE cache to catch up with the npx prisma generate
    const userItemModel = (prisma as any).userItem;
    if (!userItemModel) {
      throw new Error("UserItem model not found on Prisma client");
    }

    const items = await userItemModel.findMany({
      where: {
        userId,
        item: {
          type: 'PROFILE_ICON'
        }
      },
      include: {
        item: true
      }
    })

    console.log(`[DEBUG] Found ${items.length} owned icon records`);
    let ownedIcons = items.map((ui: any) => ui.item).filter(Boolean);

    // Filter duplicates by item ID OR Item Name
    const seenIds = new Set();
    const seenNames = new Set();
    const uniqueIcons = [];
    for (const icon of ownedIcons) {
      if (!seenIds.has(icon.id) && !seenNames.has(icon.name)) {
        seenIds.add(icon.id);
        seenNames.add(icon.name);
        uniqueIcons.push(icon);
      }
    }
    ownedIcons = uniqueIcons;

    console.log(`[DEBUG] After filtering duplicates: ${ownedIcons.length} unique icons`);

    // If they have no icons at all, find the default Blue-Eyes icon and "grant" it virtually
    const defaultIconName = "Blue-Eyes White Dragon";
    const hasDefault = ownedIcons.some((i: any) => i.name.toLowerCase().includes(defaultIconName.toLowerCase()));
    
    if (!hasDefault) {
      console.log(`[DEBUG] User lacks default icon "${defaultIconName}". Attempting virtual grant.`);
      const defaultIcon = await (prisma as any).item.findFirst({
        where: {
          name: { contains: defaultIconName, mode: 'insensitive' },
          type: 'PROFILE_ICON'
        }
      });
      
      if (defaultIcon) {
        ownedIcons.push(defaultIcon);
      }
    }

    return res.status(200).json({ icons: ownedIcons })
  } catch (error) {
    console.error('[ERROR] Failed to fetch owned icons:', error)
    return res.status(500).json({ message: "Internal server error", detail: (error as any).message })
  }
}
