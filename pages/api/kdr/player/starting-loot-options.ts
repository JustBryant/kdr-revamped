import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { findKdr } from '../../../../lib/kdrHelpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  const { kdrId } = req.query
  if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing kdrId' })

  try {
    // Set cache headers - loot options only change when session/KDR changes
    // 30 seconds should be safe to prevent hammering
    res.setHeader('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=10')

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const kdr = await findKdr(kdrId, { select: { id: true } })
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    const player = await prisma.kDRPlayer.findFirst({
      where: { kdrId: kdr.id, userId: user.id }
    })
    if (!player) return res.status(404).json({ error: 'Player not found' })

    // 1. Fetch 3 random Generic Skills
    // Strictly fetch skills where type is 'GENERIC' and classId is null.
    // These are the "Generic Skills" configured in the Admin Edit Mode.
    const skillsChoice = await prisma.skill.findMany({
      where: {
        classId: null,
        type: 'GENERIC'
      },
      include: {
        providesCards: true,
        modifications: true
      }
    }).then(skills => 
      skills.sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(s => ({
          ...s,
          rarity: 'GENERIC' // Label it clearly
        }))
    )

    // 2. Fetch 2 Starter Packs specifically for their class
    // User wants ONLY CLASS STARTER PACKS (no generic staples/loot here)
    const starterPacks = await prisma.lootPool.findMany({
      where: {
        tier: 'STARTER',
        classId: player.classId,
        NOT: { classId: null }
      },
      include: {
        items: {
          include: {
            card: true,
            skill: true
          }
        }
      }
    })

    const packsChoice = starterPacks
      .sort(() => 0.5 - Math.random())
      .slice(0, 2)

    return res.status(200).json({
      skills: skillsChoice,
      packs: packsChoice
    })
  } catch (err) {
    console.error('Failed to fetch starting loot options', err)
    return res.status(500).json({ error: 'Failed to fetch starting loot options' })
  }
}
