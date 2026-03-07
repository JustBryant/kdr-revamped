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
    isPublic,
    image,
    skillName,
    skillDescription,
    questDescription,
    relicDescription,
    deck,
    startingSkills,
    lootPools,
    tipSkills,
    legendaryMonsterId,
    mainSkill,
    relicSkill
  } = req.body
  const formatSlug: string | undefined = req.body.formatSlug

  // Debug: log incoming startingSkills/modifications shape to help trace missing mods
  try {
    if (startingSkills) {
      console.log('\n[DEBUG] /api/classes/save incoming startingSkills count:', (startingSkills || []).length)
      // log first few entries to avoid huge output
      console.log('[DEBUG] startingSkills sample:', JSON.stringify((startingSkills || []).slice(0,5), null, 2))
      for (const s of (startingSkills || [])) {
        if (s.modifications && s.modifications.length) {
          for (const m of s.modifications) {
            if (!m.card || !m.card.id) {
              console.warn('[DEBUG] Found modification with missing card.id for skill', s.name || s.id, JSON.stringify(m))
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[DEBUG] Failed to log startingSkills payload', e)
  }

  if (!name) {
    return res.status(400).json({ message: 'Class name is required' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let classId = id
      let existingClass = null
      let createdNew = false

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
            isPublic: isPublic ?? true,
            image,
            legendaryMonster: legendaryMonsterId,
            legendaryQuest: questDescription,
            legendaryRelic: relicDescription,
          }
        })

        // Clean up relations to rebuild
        await tx.classCard.deleteMany({ where: { classId } })
        
        // Delete loot pool items first, then pools (but NOT the skills they reference)
        const existingPools = await tx.lootPool.findMany({ 
          where: { classId },
          select: { id: true }
        })
        for (const pool of existingPools) {
          await tx.lootPoolItem.deleteMany({ where: { lootPoolId: pool.id } })
        }
        await tx.lootPool.deleteMany({ where: { classId } })
        
        // Find all skill IDs belonging to this class that we are about to delete
        const skillsToDelete = await tx.skill.findMany({
          where: { 
            classId,
            type: { in: ['MAIN', 'STARTING', 'TIP', 'UNIQUE'] }
          },
          select: { id: true }
        })
        const skillIds = skillsToDelete.map(s => s.id)

        if (skillIds.length > 0) {
          // Clean up relations for these skills first
          await tx.skillCardModification.deleteMany({
            where: { skillId: { in: skillIds } }
          })
          
          // Clear many-to-many relations for SkillProvidesCards and DeckSkills
          // Prisma doesn't support deleteMany on implicit join tables directly in create/update nested syntax effectively for IDs,
          // so we update the skills to disconnect them before deleting.
          for (const sId of skillIds) {
            await tx.skill.update({
              where: { id: sId },
              data: {
                providesCards: { set: [] },
                decks: { set: [] }
              }
            })
          }
          
          // Nullify LootPoolItem references
          await tx.lootPoolItem.updateMany({
            where: { skillId: { in: skillIds } },
            data: { skillId: null }
          })

          // Now delete the skills
          await tx.skill.deleteMany({ 
            where: { id: { in: skillIds } }
          })
        }

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
            isPublic: isPublic ?? true,
            image,
            description: `Class Skill: ${skillName}`,
            legendaryMonster: legendaryMonsterId,
            legendaryQuest: questDescription,
            legendaryRelic: relicDescription,
          }
        })
        createdNew = true
        classId = newClass.id
      }

      // Create Main Skill (Only if provided and not empty)
      if (mainSkill && mainSkill.name) {
        const createdMain = await tx.skill.create({
          data: {
            name: mainSkill.name || skillName || '',
            description: mainSkill.description || skillDescription || '',
            type: 'MAIN',
            classId,
            isSellable: mainSkill.isSellable ?? true,
            providesCards: {
              connect: (mainSkill.providesCards || []).filter((c:any) => c && c.id).map((c:any) => ({ id: c.id }))
            }
          }
        })

        if (mainSkill.modifications && mainSkill.modifications.length > 0) {
          const created = await tx.skillCardModification.createMany({
            data: mainSkill.modifications.map((mod: any) => ({
              skillId: createdMain.id,
              cardId: mod.card.id,
              type: mod.type,
              highlightedText: mod.highlightedText,
              alteredText: mod.alteredText,
              note: mod.note
            }))
          })
          console.log('[DEBUG] Created main skill modifications count:', created.count)
        }
      } else if (skillName) {
        // legacy fallback: create basic main skill
        await tx.skill.create({
          data: {
            name: skillName,
            description: skillDescription || '',
            type: 'MAIN',
            classId
          }
        })
      }

      // Create Relic Skill (optional) — stored as GENERIC skill linked to relic
      if (relicSkill && relicSkill.name) {
        const createdRelic = await tx.skill.create({
          data: {
            name: relicSkill.name,
            description: relicSkill.description || relicDescription || '',
            type: 'GENERIC',
            classId,
            isSellable: relicSkill.isSellable ?? false,
            providesCards: {
              connect: (relicSkill.providesCards || []).filter((c:any) => c && c.id).map((c:any) => ({ id: c.id }))
            }
          }
        })

        if (relicSkill.modifications && relicSkill.modifications.length > 0) {
            const createdRelicMods = await tx.skillCardModification.createMany({
              data: relicSkill.modifications.map((mod: any) => ({
                skillId: createdRelic.id,
                cardId: mod.card.id,
                type: mod.type,
                highlightedText: mod.highlightedText,
                alteredText: mod.alteredText,
                note: mod.note
              }))
            })
            console.log('[DEBUG] Created relic skill modifications count:', createdRelicMods.count)
        }
      }

      // Create Unique Skills (formerly Tip Skills). Each may include an optional `uniqueRound`.
      if (tipSkills && tipSkills.length > 0) {
        await tx.skill.createMany({
          data: tipSkills.map((s: any) => ({
            name: s.name,
            description: s.description,
            type: 'UNIQUE',
            classId,
            uniqueRound: s.uniqueRound ?? null
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
              const createdStartingMods = await tx.skillCardModification.createMany({
                data: s.modifications.map((mod: any) => ({
                  skillId: createdSkill.id,
                  cardId: mod.card.id,
                  type: mod.type,
                  highlightedText: mod.highlightedText,
                  alteredText: mod.alteredText,
                  note: mod.note
                }))
              })
              console.log('[DEBUG] Created starting skill modifications count for skill', createdSkill.id, createdStartingMods.count)
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
        console.log('\n=== SAVING LOOT POOLS ===')
        for (const pool of lootPools) {
          console.log(`Pool: ${pool.name}`)
          const createdPool = await tx.lootPool.create({
            data: {
              name: pool.name,
              tier: pool.tier,
              tax: pool.tax || 0,
              classId: classId!
            }
          })

          if (pool.items && pool.items.length > 0) {
            // Process items one by one to handle skill creation
            for (const item of pool.items) {
              console.log(`  Item type: ${item.type}`)
              if (item.type === 'Skill') {
                console.log(`    Skill name: ${item.skill?.name}`)
                console.log(`    Skill ID: ${item.skill?.id}`)
                console.log(`    Modifications: ${item.skill?.modifications?.length || 0}`)
                if (item.skill?.modifications?.length > 0) {
                  console.log(`    First mod:`, JSON.stringify(item.skill.modifications[0], null, 2))
                }
              }
              
              let skillId: string | null = null
              
              // If it's a skill, handle skill creation/update
              if (item.type === 'Skill' && item.skill) {
                if (item.skill.id && !item.skill.id.startsWith('temp_')) {
                  // Existing skill - try to UPDATE it, or CREATE if it doesn't exist
                  skillId = item.skill.id
                  
                  // Check if skill exists
                  const existingSkill = await tx.skill.findUnique({
                    where: { id: skillId as string }
                  })
                  
                  if (existingSkill) {
                    // Update the skill itself
                    await tx.skill.update({
                      where: { id: skillId as string },
                      data: {
                        name: item.skill.name,
                        description: item.skill.description,
                        isSellable: item.skill.isSellable ?? true
                      }
                    })
                  } else {
                    // Skill was deleted, create a new one
                    const createdSkill = await tx.skill.create({
                      data: {
                        name: item.skill.name,
                        description: item.skill.description,
                        isSellable: item.skill.isSellable ?? true,
                        type: 'LOOT_POOL',
                        classId: classId
                      }
                    })
                    skillId = createdSkill.id
                  }
                  
                  // Delete old modifications
                  await tx.skillCardModification.deleteMany({
                    where: { skillId: skillId as string }
                  })
                  
                  // Create new modifications
                  if (item.skill.modifications && item.skill.modifications.length > 0) {
                      const createdUpdatedMods = await tx.skillCardModification.createMany({
                        data: item.skill.modifications.map((mod: any) => ({
                          skillId: skillId,
                          cardId: mod.card.id,
                          type: mod.type,
                          highlightedText: mod.highlightedText,
                          alteredText: mod.alteredText,
                          note: mod.note
                        }))
                      })
                      console.log('[DEBUG] Recreated modifications for existing skill', skillId, createdUpdatedMods.count)
                  }
                } else {
                  // New skill - create it
                  const createdSkill = await tx.skill.create({
                    data: {
                      name: item.skill.name,
                      description: item.skill.description,
                      isSellable: item.skill.isSellable ?? true,
                      type: 'LOOT_POOL',
                      classId: classId
                    }
                  })
                  skillId = createdSkill.id
                  
                  // Create modifications for the skill
                  if (item.skill.modifications && item.skill.modifications.length > 0) {
                      const createdPoolSkillMods = await tx.skillCardModification.createMany({
                        data: item.skill.modifications.map((mod: any) => ({
                          skillId: createdSkill.id,
                          cardId: mod.card.id,
                          type: mod.type,
                          highlightedText: mod.highlightedText,
                          alteredText: mod.alteredText,
                          note: mod.note
                        }))
                      })
                      console.log('[DEBUG] Created loot-pool skill modifications for new skill', createdSkill.id, createdPoolSkillMods.count)
                  }
                }
              }
              
              // Create the loot pool item (store skillId when available)
              await tx.lootPoolItem.create({
                data: {
                  lootPoolId: createdPool.id,
                  type: item.type,
                  cardId: item.card?.id || item.cardId,
                  skillId: skillId || undefined,
                  skillName: item.skill?.name || item.skillName,
                  skillDescription: item.skill?.description || item.skillDescription
                }
              })
            }
          }
        }
      }

      // If a formatSlug was provided, link this class to that format via FormatClass
      if (formatSlug) {
        try {
          const fmt = await tx.format.findUnique({ where: { slug: formatSlug } })
          if (fmt) {
            const existingLink = await tx.formatClass.findFirst({ where: { formatId: fmt.id, classId } })
            if (!existingLink) {
              await tx.formatClass.create({ data: { formatId: fmt.id, classId } })
            }
          }
        } catch (e) {
          console.warn('Failed to link class to format', formatSlug, e)
        }
      }

      // Do not auto-link to a hardcoded format here. Linking is only performed
      // when `formatSlug` is explicitly provided by the client. This avoids
      // surprising behavior and lets the UI decide which format a new class
      // should belong to (per-format editor sends `formatSlug`).

      return { id: classId }
    })

    res.status(200).json(result)
  } catch (error: any) {
    console.error('Error saving class:', error)
    res.status(500).json({ message: error.message || 'Internal server error' })
  }
}
