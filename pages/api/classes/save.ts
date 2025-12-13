// Force reload
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const {
    id,
    name,
    image,
    skillName,
    skillDescription,
    questDescription,
    relicDescription,
    deck,
    startingSkills,
    lootPools,
    tipSkills,
    legendaryMonsterId
  } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Class name is required' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let classId = id
      let existingClass = null

      // 1. Determine if we are updating or creating
      if (classId) {
        existingClass = await tx.class.findUnique({ 
          where: { id: classId },
          select: { id: true, name: true }
        })
      } else {
        // Fallback to name check for legacy or new classes
        existingClass = await tx.class.findFirst({ 
          where: { name },
          select: { id: true, name: true }
        })
        classId = existingClass?.id
      }

      if (existingClass) {
        // Update existing class
        
        // Check for name collision if renaming
        if (existingClass.name !== name) {
          const nameTaken = await tx.class.findFirst({ 
            where: { name },
            select: { id: true }
          })
          if (nameTaken) {
            throw new Error(`Class name "${name}" is already taken`)
          }
        }

        await tx.class.update({
          where: { id: classId },
          data: {
            name,
            image,
            legendaryMonster: legendaryMonsterId,
            legendaryQuest: questDescription,
            legendaryRelic: relicDescription,
          }
        })

        // Clean up relations to rebuild
        await tx.classCard.deleteMany({ where: { classId } })
        await tx.lootPool.deleteMany({ where: { classId } })
        await tx.skill.deleteMany({ where: { classId } })

      } else {
        // Create new class
        
        // Check if name is taken
        const nameTaken = await tx.class.findFirst({ 
          where: { name },
          select: { id: true }
        })
        if (nameTaken) {
           throw new Error(`Class name "${name}" is already taken`)
        }

        const newClass = await tx.class.create({
          data: {
            name,
            image,
            description: `Class Skill: ${skillName}`,
            legendaryMonster: legendaryMonsterId,
            legendaryQuest: questDescription,
            legendaryRelic: relicDescription,
          }
        })
        classId = newClass.id
      }

      // Create Main Skill (Only if provided and not empty)
      if (skillName) {
        await tx.skill.create({
          data: {
            name: skillName,
            description: skillDescription || '',
            type: 'MAIN',
            classId
          }
        })
      }

      // Create Tip Skills
      if (tipSkills && tipSkills.length > 0) {
        await tx.skill.createMany({
          data: tipSkills.map((s: any) => ({
            name: s.name,
            description: s.description,
            type: 'TIP',
            classId
          }))
        })
      }

      // Create Starting Skills
      if (startingSkills && startingSkills.length > 0) {
        for (const s of startingSkills) {
          const createdSkill = await tx.skill.create({
            data: {
              name: s.name,
              description: s.description,
              type: 'STARTING',
              classId,
              isSellable: s.isSellable ?? true,
              providesCards: {
                connect: s.providesCards?.map((c: any) => ({ id: c.id })) || []
              }
            }
          })

          if (s.modifications && s.modifications.length > 0) {
            await tx.skillCardModification.createMany({
              data: s.modifications.map((mod: any) => ({
                skillId: createdSkill.id,
                cardId: mod.card.id,
                type: mod.type,
                highlightedText: mod.highlightedText,
                alteredText: mod.alteredText,
                note: mod.note
              }))
            })
          }
        }
      }

      // Create Starting Cards
      if (deck && deck.length > 0) {
        const validDeck = deck.filter((c: any) => c.id)
        if (validDeck.length > 0) {
          await tx.classCard.createMany({
            data: validDeck.map((card: any) => ({
              classId: classId!,
              cardId: card.id,
              category: card.category,
              quantity: card.quantity
            }))
          })
        }
      }

      // Create Loot Pools
      if (lootPools && lootPools.length > 0) {
        for (const pool of lootPools) {
          const createdPool = await tx.lootPool.create({
            data: {
              name: pool.name,
              tier: pool.tier,
              tax: pool.tax || 0,
              classId: classId!
            }
          })

          if (pool.items && pool.items.length > 0) {
            await tx.lootPoolItem.createMany({
              data: pool.items.map((item: any) => ({
                lootPoolId: createdPool.id,
                type: item.type,
                // Fix: Access nested objects if they exist, fallback to direct IDs if sent that way
                cardId: item.card?.id || item.cardId,
                skillName: item.skill?.name || item.skillName,
                skillDescription: item.skill?.description || item.skillDescription
              }))
            })
          }
        }
      }

      return { id: classId }
    })

    res.status(200).json(result)
  } catch (error: any) {
    console.error('Error saving class:', error)
    res.status(500).json({ message: error.message || 'Internal server error' })
  }
}
