import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { invalidateKdrCache } from '../../../../lib/redis'
import { findKdr } from '../../../../lib/kdrHelpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' })

  try {
    const kdr = await findKdr(id)
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    const maybeInvalidate = async () => { try { await invalidateKdrCache(kdr.id) } catch (e) { console.warn('Failed to invalidate KDR cache (available-classes)', e) } }

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const player = await prisma.kDRPlayer.findFirst({ where: { kdrId: kdr.id, userId: user.id } })
    if (!player) return res.status(403).json({ error: 'You are not in this KDR' })

    if (player.classId) return res.status(400).json({ error: 'Class already picked' })

    const offeredClasses = (player as any).offeredClasses
    // If classes are already offered, return them (filtered by isPublic)
    if (offeredClasses && offeredClasses.length > 0) {
      const classes = await prisma.class.findMany({
        where: { 
          id: { in: offeredClasses },
          isPublic: true
        },
        select: { id: true, name: true, image: true }
      })
      // Maintain order if possible? Prisma doesn't guarantee order with `in`.
      // For now simple is fine.
      return res.status(200).json(classes)
    }

    // Otherwise, generate them
    const settings = (kdr.settingsSnapshot as any) || {}
    const classChoices = settings.classChoices || 0 
    const disabledClassIds = settings.disabledClassIds || []
    const allowDuplicateClasses = settings.allowDuplicateClasses ?? true

    // Fetch classes already picked by other players IF duplicate classes are NOT allowed
    let pickedClassIds: string[] = []
    if (!allowDuplicateClasses) {
      const otherPlayers = await prisma.kDRPlayer.findMany({
        where: { kdrId: kdr.id, classId: { not: null } },
        select: { classId: true }
      })
      pickedClassIds = otherPlayers.map(p => p.classId as string)
    }

    const allFormatClasses = await prisma.formatClass.findMany({
      where: { 
        formatId: kdr.formatId,
        class: { isPublic: true }
      },
      include: { class: { select: { id: true, name: true } } }
    })
    
    let availableClassIds = allFormatClasses
      .map(fc => fc.classId)
      .filter(id => !disabledClassIds.includes(id) && !pickedClassIds.includes(id))
    
    // Fallback if no format classes (though there should be)
    if (availableClassIds.length === 0) {
      const allClasses = await prisma.class.findMany({ 
        where: { isPublic: true },
        select: { id: true, name: true } 
      })
      availableClassIds = allClasses
        .map(c => c.id)
        .filter(id => !disabledClassIds.includes(id) && !pickedClassIds.includes(id))
    }

    let finalClassIds: string[] = []

    if (classChoices > 0 && availableClassIds.length > classChoices) {
      // Shuffling logic for Subclasses:
      // If a "Main" class is picked as one of the random choices, its "Subclasses" should ALSO be included 
      // but NOT count towards the classChoices limit.
      
      const shuffled = [...availableClassIds].sort(() => 0.5 - Math.random())
      const selectedIds: string[] = []
      
      // Get full class info for the available classes to identify potential parents or children
      const classesInfo = await prisma.class.findMany({
        where: { id: { in: availableClassIds } },
        select: { id: true, name: true }
      })

      // We identify a "Subclass" by the naming convention: "ParentName (Subclass ...)"
      const extractParentName = (name: string) => {
        const match = name.match(/^(.*?) \(Subclass/i)
        return match ? match[1].trim() : null
      }

      for (const cid of shuffled) {
        if (selectedIds.length >= classChoices) break
        if (selectedIds.includes(cid)) continue
        
        const cls = classesInfo.find(c => c.id === cid)
        if (!cls) continue
        
        // If this is a subclass, don't pick it as a primary choice 
        // (it should be pulled in by its parent instead)
        if (extractParentName(cls.name)) continue

        selectedIds.push(cid)
        
        // Automatically include all subclasses of THIS class
        const parentName = cls.name
        const subclasses = classesInfo.filter(c => extractParentName(c.name) === parentName)
        
        for (const sub of subclasses) {
          if (!selectedIds.includes(sub.id)) {
            selectedIds.push(sub.id)
            // Note: Does not count towards the Class Option Count limit
          }
        }
      }

      // Safeguard: If we somehow didn't pick enough classes (e.g. all remaining were subclasses),
      // fill with remaining available until we hit the choice count.
      if (selectedIds.length < classChoices && availableClassIds.length > selectedIds.length) {
        for (const cid of shuffled) {
          if (selectedIds.length >= classChoices) break
          if (!selectedIds.includes(cid)) {
            selectedIds.push(cid)
          }
        }
      }

      finalClassIds = selectedIds
    } else {
      finalClassIds = availableClassIds
    }

    // Store them
    await prisma.kDRPlayer.update({
      where: { id: player.id },
      data: { offeredClasses: finalClassIds } as any
    })

    try { await maybeInvalidate() } catch (e) {}

    const classes = await prisma.class.findMany({
      where: { id: { in: finalClassIds } },
      select: { id: true, name: true, image: true }
    })

    return res.status(200).json(classes)
  } catch (err) {
    console.error('Failed to fetch available classes', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
