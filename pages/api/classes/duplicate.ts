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

  const { classId } = req.body

  if (!classId) {
    return res.status(400).json({ message: 'Class ID is required' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch source class with all relations
      const sourceClass = await tx.class.findUnique({
        where: { id: classId },
        include: {
          startingCards: true,
          skills: {
            include: {
              modifications: true,
              providesCards: true
            }
          },
          lootPools: {
            include: {
              items: true
            }
          }
        }
      })

      if (!sourceClass) {
        throw new Error('Class not found')
      }

      // 2. Generate unique name
      let newName = `${sourceClass.name} (Subclass)`
      let counter = 1
      while (await tx.class.findFirst({ where: { name: newName }, select: { id: true } })) {
        counter++
        newName = `${sourceClass.name} (Subclass ${counter})`
      }

      // 3. Create new Class
      const newClass = await tx.class.create({
        data: {
          name: newName,
          image: sourceClass.image,
          description: sourceClass.description,
          legendaryMonster: sourceClass.legendaryMonster,
          legendaryQuest: sourceClass.legendaryQuest,
          legendaryRelic: sourceClass.legendaryRelic,
        }
      })

      // 4. Copy Starting Cards
      if (sourceClass.startingCards.length > 0) {
        await tx.classCard.createMany({
          data: sourceClass.startingCards.map(card => ({
            classId: newClass.id,
            cardId: card.cardId,
            category: card.category,
            quantity: card.quantity
          }))
        })
      }

      // 5. Copy Skills (Main, Tip, Starting)
      for (const skill of sourceClass.skills) {
        const newSkill = await tx.skill.create({
          data: {
            classId: newClass.id,
            name: skill.name,
            description: skill.description,
            type: skill.type,
            cost: skill.cost,
            cooldown: skill.cooldown,
            stackable: skill.stackable,
            isSellable: skill.isSellable,
            providesCards: {
              connect: skill.providesCards.map(card => ({ id: card.id }))
            }
          }
        })

        // Copy Modifications for this skill
        if (skill.modifications.length > 0) {
          await tx.skillCardModification.createMany({
            data: skill.modifications.map(mod => ({
              skillId: newSkill.id,
              cardId: mod.cardId,
              type: mod.type,
              highlightedText: mod.highlightedText,
              alteredText: mod.alteredText,
              startIndex: mod.startIndex,
              endIndex: mod.endIndex,
              note: mod.note
            }))
          })
        }
      }

      // 6. Copy Loot Pools
      for (const pool of sourceClass.lootPools) {
        const newPool = await tx.lootPool.create({
          data: {
            classId: newClass.id,
            name: pool.name,
            tier: pool.tier
          }
        })

        // Copy Loot Pool Items
        if (pool.items.length > 0) {
          await tx.lootPoolItem.createMany({
            data: pool.items.map(item => ({
              lootPoolId: newPool.id,
              type: item.type,
              cardId: item.cardId,
              skillName: item.skillName,
              skillDescription: item.skillDescription
            }))
          })
        }
      }

      return newClass
    })

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error duplicating class:', error)
    return res.status(500).json({ message: 'Failed to duplicate class' })
  }
}
