import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../lib/kdrHelpers'
import { getPlayerShopModifiers, applyShopModifiers } from '../../../lib/shopModifiers'

import { computeLevel, sampleArray, weightedPickIndex, weightedSampleArray, ShopStage } from '../../../lib/shopHelpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { kdrId, action, payload } = req.body || {}
    if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing kdrId' })

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Resolve KDR (accept slug or id) and use canonical id for player lookup
    const kdr = await findKdr(kdrId)
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    const player = await prisma.kDRPlayer.findFirst({ 
      where: { kdrId: kdr.id, userId: user.id },
      include: {
        user: true
      }
    })
    if (!player) return res.status(404).json({ error: 'Player not found in this KDR' })

    const attachPlayerKey = (p: any) => {
      if (!p) return p
      try {
        const key = (p.userId && kdr?.id) ? generatePlayerKey(p.userId, kdr.id) : null
        return { ...p, playerKey: key }
      } catch (e) { return p }
    }

    // Resolve settings: prefer snapshot, then linked format settings, otherwise defaults
    let settings: any = null
    if (kdr.settingsSnapshot) settings = kdr.settingsSnapshot
    else if (kdr.formatId) {
      const fmt = await prisma.format.findUnique({ where: { id: kdr.formatId } })
      settings = (fmt && (fmt.settings as any)) || null
    }
    const defaults = {
      goldPerRound: 50,
      xpPerRound: 100,
      levelXpCurve: [0, 100, 300, 600, 1000],
      trainingCost: 50,
      trainingXp: 100,
      skillSelectionCount: 3,
      treasureOfferCount: 1,
      tipThreshold: 100,
      classStarterCost: 0,
      classMidCost: 0,
      classHighCost: 0,
      genericStarterCost: 0,
      genericMidCost: 0,
      genericHighCost: 0,
      classStarterCount: 3,
      classMidCount: 2,
      classHighCount: 1,
      genericStarterCount: 3,
      genericMidCount: 2,
      genericHighCount: 1
    }
    let baseSettings = { ...defaults, ...(settings || {}) }

    // Resolve player-specific shop modifiers based on their current inventory and stats
    let modifiers = {}
    try {
      modifiers = await getPlayerShopModifiers(player.id)
    } catch (err) {
      console.error('Failed to get shop modifiers, falling back to defaults:', err)
    }
    settings = applyShopModifiers(baseSettings, modifiers)

    // load and normalize current shopState (do not force a default stage)
    const shopState: any = (player.shopState as any) || { chosenSkills: [], purchases: [], tipAmount: 0 }

        // Helper to persist shopState and return fresh player
        const persistState = async (partial: any = {}): Promise<{ updated: any; shopState: any }> => {
          // Force a load of the current state before updating to avoid using stale data from the start of the handler
          const current = await prisma.kDRPlayer.findUnique({ where: { id: player.id }, select: { shopState: true } })
          const baseState = (current?.shopState as any) || shopState
          const newState = { ...baseState, ...partial }
          const updated = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { shopState: newState } })
          return { updated, shopState: newState }
        }

    // Helper to append a history entry server-side (persisted in kDRPlayer.shopState.history)
    const appendHistoryServer = async (entry: any) => {
      const e = { ts: entry.ts || Date.now(), ...entry }
      // load fresh player row to avoid clobbering concurrent updates
      const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
      const currentState = (fresh?.shopState as any) || {}
      const hist = Array.isArray(currentState.history) ? [...currentState.history] : []
      // avoid exact consecutive duplicates
      const last = hist.length ? hist[hist.length - 1] : null
      if (last && last.type === e.type && last.text === e.text && Math.abs((e.ts || 0) - (last.ts || 0)) < 5000) {
        return { updated: fresh }
      }
      hist.push(e)
      const updated = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { shopState: { ...currentState, history: hist } } })
      return { updated }
    }

    // Action dispatcher
    switch (action) {
      case 'appendHistory': {
        const entry = payload || {}
        try {
          const { updated } = await appendHistoryServer(entry)
          return res.status(200).json({ message: 'History appended', player: attachPlayerKey(updated) })
        } catch (e) {
          console.error('Failed to append history', e)
          return res.status(500).json({ error: 'Failed to append history' })
        }
      }
      
      case 'start': {
        // Force reset shop if this is a new round
        // We detect this if the player's current stage is DONE or they have shopComplete: true
        // FIX: Also check if the current round has increased since last shop visit
        const latestRound = await prisma.kDRRound.findFirst({ where: { kdrId: kdr.id }, orderBy: { number: "desc" }, select: { number: true } })
        const lastShopRound = Number((player as any).lastShopRound || 0)
        const currentRound = Number(latestRound?.number || 0)

        if (shopState.stage === 'DONE' || player.shopComplete || currentRound > lastShopRound) {
          // Reset shopState but preserve history and statPoints
          const resetState = { 
            chosenSkills: [], 
            purchases: [], 
            tipAmount: 0,
            lootOffers: [],
            pendingSkillChoices: [],
            statPoints: shopState.statPoints || 0,
            history: (shopState.history || [])
          }
          await prisma.kDRPlayer.update({ 
            where: { id: player.id }, 
            data: { shopComplete: false, shopState: resetState, lastShopRound: currentRound } 
          })
          // Update local shopState reference for the rest of this handler
          Object.assign(shopState, resetState)
        }

        // award gold/xp
        const awardedGold = settings.goldPerRound
        const awardedXp = settings.xpPerRound

        // Pick initial loot offers if they don't exist yet
        let initialLootOffers = (shopState.lootOffers || []) as any[]
        if (initialLootOffers.length === 0) {
          // Trigger the internal sampling logic (mirrors rerollLoot logic)
          const allPools = await prisma.lootPool.findMany({ 
            include: { 
              items: { 
                include: { 
                  card: true
                } 
              } 
            } 
          }) as any[]

          const classPools = allPools.filter((p: any) => p.classId && player.classId && p.classId === player.classId)
          const genericPools = allPools.filter((p: any) => !p.classId)
          const currentLevel = computeLevel((player.xp || 0), settings.levelXpCurve) + 1
          const sampledPools: any[] = []

          const getPoolsByTier = (pools: any[], tier: string) => pools.filter((p: any) => (p.tier || '').toUpperCase() === tier.toUpperCase())
          const sampleFromPools = (pools: any[], count: number) => {
            if (count <= 0) return []
            const shuffled = [...pools].sort(() => Math.random() - 0.5)
            // Fix: Filter out any pools that contain treasures (items with type 'Card' and rarity UR or specifically designated as treasure)
            const available = shuffled.filter((p: any) => {
              // Usually treasures are handled in the TREASURE phase, so we filter them out of LOOT pools
              // to prevent duplicates or mis-categorization.
              // Updated: Also filter out SR rarities as they are now considered treasures in the TREASURE pick logic.
              const hasTreasure = (p.items || []).some((i: any) => {
                const t = String(i.type || '').toUpperCase()
                return t === 'TREASURE' || (t === 'CARD' && (String(i.card?.rarity || '').toUpperCase() === 'UR' || String(i.card?.rarity || '').toUpperCase() === 'SR'))
              })
              return !hasTreasure
            })
            return available.slice(0, count)
          }

          if (settings.classStarterCount > 0) sampledPools.push(...sampleFromPools(getPoolsByTier(classPools, 'STARTER'), Number(settings.classStarterCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.classMidCount > 0 && currentLevel >= (settings.classMidMinLevel || 1)) sampledPools.push(...sampleFromPools(getPoolsByTier(classPools, 'MID'), Number(settings.classMidCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.classHighCount > 0 && currentLevel >= (settings.classHighMinLevel || 1)) sampledPools.push(...sampleFromPools(getPoolsByTier(classPools, 'HIGH'), Number(settings.classHighCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.genericStarterCount > 0) sampledPools.push(...sampleFromPools(getPoolsByTier(genericPools, 'STARTER'), Number(settings.genericStarterCount)).map(p => ({ ...p, isGeneric: true })))
          if (settings.genericMidCount > 0 && currentLevel >= (settings.genericMidMinLevel || 1)) sampledPools.push(...sampleFromPools(getPoolsByTier(genericPools, 'MID'), Number(settings.genericMidCount)).map(p => ({ ...p, isGeneric: true })))
          if (settings.genericHighCount > 0 && currentLevel >= (settings.genericHighMinLevel || 1)) sampledPools.push(...sampleFromPools(getPoolsByTier(genericPools, 'HIGH'), Number(settings.genericHighCount)).map(p => ({ ...p, isGeneric: true })))

          initialLootOffers = sampledPools.map((fullPool: any) => {
            const poolTierNormalized = (fullPool.tier || 'STARTER').toUpperCase()
            const totalCost = (fullPool.isGeneric 
              ? (poolTierNormalized === 'STARTER' ? Number(settings.genericStarterCost) : poolTierNormalized === 'MID' ? Number(settings.genericMidCost) : Number(settings.genericHighCost))
              : (poolTierNormalized === 'STARTER' ? Number(settings.classStarterCost) : poolTierNormalized === 'MID' ? Number(settings.classMidCost) : Number(settings.classHighCost))
            ) + (Number(fullPool.tax) || 0)
            
            return {
              id: fullPool.id,
              name: fullPool.name,
              tier: poolTierNormalized,
              isGeneric: fullPool.isGeneric,
              tax: Number(fullPool.tax) || 0,
              cost: totalCost,
              cards: (fullPool.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ 
                id: i.card.id, 
                name: i.card.name, 
                konamiId: i.card.konamiId, 
                imageUrlCropped: i.card.imageUrlCropped,
                artworks: i.card.artworks
              })),
              items: (fullPool.items || []).map((i: any) => ({ id: i.id, type: i.type, card: i.card, skillName: i.skillName, skillDescription: i.skillDescription, amount: i.amount }))
            }
          })
        }

        const updatedPlayer = await prisma.kDRPlayer.update({ 
          where: { id: player.id }, 
          data: { 
            gold: { increment: awardedGold }, 
            xp: { increment: awardedXp },
            shopState: { ...shopState, lootOffers: initialLootOffers }
          } 
        })

        const prevLevel = computeLevel((player.xp || 0), settings.levelXpCurve)
        const newLevel = computeLevel((updatedPlayer.xp || 0), settings.levelXpCurve)

        const result: any = { awarded: { gold: awardedGold, xp: awardedXp }, prevLevel, newLevel }

        // Pick a random shopkeeper for this shop session (if any exist)
        let chosenShopkeeper: any = null
        let chosenGreeting: string | null = null
        try {
          const shopkeepers = await prisma.shopkeeper.findMany({ orderBy: { name: 'asc' } })
          if (shopkeepers && shopkeepers.length > 0) {
            const picked = sampleArray(shopkeepers, 1)[0]
            if (picked) chosenShopkeeper = { id: picked.id, name: picked.name, image: picked.image }

            // fetch GREETING dialogues and pick one at random
            try {
              const greetings = await prisma.shopkeeperDialogue.findMany({ where: { shopkeeperId: picked.id, type: 'GREETING' }, orderBy: { createdAt: 'desc' } })
              if (greetings && greetings.length > 0) {
                const g = sampleArray(greetings, 1)[0]
                if (g && g.text) chosenGreeting = g.text
              }
            } catch (e) {
              console.warn('Failed to load shopkeeper greetings', e)
            }
          }
        } catch (e) {
          console.warn('Failed to pick shopkeeper', e)
        }

        if (newLevel > prevLevel) {
          // pick skill choices
          // Only offer generic skills on level-up here — do NOT include class or loot-pool skills
          // We filter for type: 'GENERIC' specifically to ensure no specialty or loot-exclusive skills leak in.
          // FIX: Filter out skills the player already has in their inventory
          const ownedSkillIds = await prisma.playerItem.findMany({
            where: { userId: user.id, kdrId: kdr.id, NOT: { skillId: null } },
            select: { skillId: true }
          }).then(list => list.map(li => li.skillId).filter(Boolean) as string[])

          const availableSkills = await prisma.skill.findMany({ 
            where: { 
              classId: null,
              type: 'GENERIC',
              id: { notIn: ownedSkillIds }
            } 
          }) as any[]
          const choices = sampleArray(availableSkills, settings.skillSelectionCount).map((s: any) => ({ id: s.id, name: s.name, description: s.description }))
          // award stat points: always grant 1 for playing the match/shop,
          // plus additional points for level gains (1 per level gained)
          const levelGain = newLevel - prevLevel
          const existingPoints = (shopState && (shopState.statPoints || 0)) || 0
          const newPoints = existingPoints + 1 + levelGain
          const { updated, shopState: newState } = await persistState({ stage: 'SKILL', pendingSkillChoices: choices, chosenSkills: shopState.chosenSkills || [], shopkeeper: chosenShopkeeper, shopkeeperGreeting: chosenGreeting, shopAward: { gold: awardedGold, xp: awardedXp }, statPoints: newPoints })
          // persist award into history server-side; do NOT persist shopkeeper dialogue lines
          try { await appendHistoryServer({ type: 'award', text: `Player gained ${awardedGold} gold and ${awardedXp} XP this round.`, gold: awardedGold, xp: awardedXp }) } catch (e) {}
          // if level up, record it as well
          if (newLevel > prevLevel) {
            try { await appendHistoryServer({ type: 'level', text: `Level ${newLevel + 1} Reached!`, level: newLevel + 1 }) } catch (e) {}
          }
          return res.status(200).json({ message: 'Shop started', player: attachPlayerKey(updated), next: 'SKILL', pendingSkillChoices: choices, prevLevel, newLevel, awarded: { gold: awardedGold, xp: awardedXp }, shopGreeting: chosenGreeting })
        }

        // no level up => always grant 1 stat point for playing the match / starting the shop
        // move to STATS stage first (so player can use their stat point), then to TRAINING
        try {
          const existingPoints = (shopState && (shopState.statPoints || 0)) || 0
          const { updated, shopState: newState } = await persistState({ stage: 'STATS', shopkeeper: chosenShopkeeper, shopkeeperGreeting: chosenGreeting, shopAward: { gold: awardedGold, xp: awardedXp }, statPoints: existingPoints + 1 })
          // persist award into history server-side; do NOT persist shopkeeper dialogue lines
          try { await appendHistoryServer({ type: 'award', text: `Player gained ${awardedGold} gold and ${awardedXp} XP this round.`, gold: awardedGold, xp: awardedXp }) } catch (e) {}
          return res.status(200).json({ message: 'Shop started', player: attachPlayerKey(updated), next: 'STATS', prevLevel, newLevel, awarded: { gold: awardedGold, xp: awardedXp }, shopGreeting: chosenGreeting })
        } catch (e) {
          // fallback persist without statPoints change
          const { updated, shopState: newState } = await persistState({ stage: 'STATS', shopkeeper: chosenShopkeeper, shopkeeperGreeting: chosenGreeting, shopAward: { gold: awardedGold, xp: awardedXp } })
          try { await appendHistoryServer({ type: 'award', text: `Player gained ${awardedGold} gold and ${awardedXp} XP this round.`, gold: awardedGold, xp: awardedXp }) } catch (e) {}
          return res.status(200).json({ message: 'Shop started', player: attachPlayerKey(updated), next: 'STATS', prevLevel, newLevel, awarded: { gold: awardedGold, xp: awardedXp }, shopGreeting: chosenGreeting })
        }
      }

      case 'markReturned': {
        // Append a 'RETURNING' dialogue (if available) when a player returns to the shop
        try {
          const sk = (player.shopState as any)?.shopkeeper || null
          const skId = sk && sk.id ? sk.id : null
          if (!skId) return res.status(200).json({ message: 'No shopkeeper to mark return' })
          const lines = await prisma.shopkeeperDialogue.findMany({ where: { shopkeeperId: skId, type: 'RETURNING' } })
          if (!lines || lines.length === 0) return res.status(200).json({ message: 'No returning lines available' })
          const pick = sampleArray(lines, 1)[0]
          if (pick && pick.text) {
            // Do not append returning dialogue to history. Persist as current shopkeeperGreeting
            const { updated, shopState: newState } = await persistState({ shopkeeperGreeting: pick.text })
            return res.status(200).json({ message: 'Returning dialogue set', player: attachPlayerKey(updated), returningText: pick.text })
          }
          return res.status(200).json({ message: 'No returning dialogue picked' })
        } catch (e) {
          console.error('Failed to mark returned', e)
          return res.status(500).json({ error: 'Failed to mark returned' })
        }
      }

      case 'chooseSkill': {
        const { skillId } = payload || {}
        if (!skillId || typeof skillId !== 'string') return res.status(400).json({ error: 'Missing skillId' })
        const skill = await prisma.skill.findUnique({ where: { id: skillId } })
        if (!skill) return res.status(404).json({ error: 'Skill not found' })

        const chosen = Array.isArray(shopState.chosenSkills) ? [...shopState.chosenSkills] : []
        chosen.push(skillId)
        // persist chosen skill and update shopState transactionally
        try {
          await prisma.$transaction(async (tx) => {
            await tx.playerItem.create({ data: { userId: user.id, skillId, kdrId: kdr.id, qty: 1 } })
            const havePoints = Number((shopState && shopState.statPoints) || 0) > 0
            const newState = { ...shopState, chosenSkills: chosen, pendingSkillChoices: undefined, stage: (havePoints ? 'STATS' : 'TRAINING') }
            await tx.kDRPlayer.update({ where: { id: player.id }, data: { shopState: newState } })
          })
        } catch (e) {
          console.error('Failed to persist PlayerSkill (transaction)', e)
        }
        const { updated } = await persistState({ chosenSkills: chosen, pendingSkillChoices: undefined, stage: (Number((shopState && shopState.statPoints) || 0) > 0 ? 'STATS' : 'TRAINING') })
        // record which skill was chosen in server history
        try { await appendHistoryServer({ type: 'skill', text: `Player chose skill: ${skill.name}`, skillId: skill.id, skillName: skill.name }) } catch (e) {}
        return res.status(200).json({ message: 'Skill chosen', player: attachPlayerKey(updated), chosenSkills: chosen })
      }

      case 'chooseStat': {
        const { stat } = payload || {}
        if (!stat || typeof stat !== 'string') return res.status(400).json({ error: 'Missing stat' })
        const key = (stat || '').toLowerCase()
        const valid = ['dex', 'con', 'str', 'int', 'cha']
        if (!valid.includes(key)) return res.status(400).json({ error: 'Invalid stat' })
        // load fresh player and shopState to avoid clobber
        const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
        const currentState = (fresh?.shopState as any) || {}
        const availablePoints = Number(currentState?.statPoints || 0)
        if (availablePoints <= 0) return res.status(400).json({ error: 'No stat points available' })

        const curStats = (currentState.stats as any) || {}
        const newStats = { ...(curStats || {}), [key]: (Number(curStats?.[key] || 0) + 1) }
        const remaining = Math.max(0, availablePoints - 1)
        const newState = { ...currentState, stats: newStats, statPoints: remaining, stage: (remaining > 0 ? (currentState.stage || 'STATS') : 'TRAINING') }
        const updated = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { shopState: newState } })

        // append server-side history entry for stat gain
        try {
          await appendHistoryServer({ type: 'stat', text: `Player increased ${key.toUpperCase()} to ${newStats[key]}`, stat: key, value: newStats[key] })
        } catch (e) {}

        return res.status(200).json({ message: 'Stat increased', player: attachPlayerKey(updated) })
      }

      case 'train': {
        // training costs gold and grants xp; can be repeated
        const cost = settings.trainingCost || 0
        const xpGain = settings.trainingXp || 0
        if ((player.gold || 0) < cost) return res.status(400).json({ error: 'Insufficient gold for training' })
        const updatedPlayer = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { gold: { decrement: cost }, xp: { increment: xpGain } } })
        const prevLevel = computeLevel((player.xp || 0), settings.levelXpCurve)
        const newLevel = computeLevel((updatedPlayer.xp || 0), settings.levelXpCurve)

        if (newLevel > prevLevel) {
          // Only offer generic skills on level-up from training — do NOT include class or loot-pool skills
          // We filter for type: 'GENERIC' specifically to ensure no specialty or loot-exclusive skills leak in.
          // FIX: Filter out skills the player already has in their inventory
          const ownedSkillIds = await prisma.playerItem.findMany({
            where: { userId: user.id, kdrId: kdr.id, NOT: { skillId: null } },
            select: { skillId: true }
          }).then(list => list.map(li => li.skillId).filter(Boolean) as string[])

          const availableSkills = await prisma.skill.findMany({ 
            where: { 
              classId: null,
              type: 'GENERIC',
              id: { notIn: ownedSkillIds }
            } 
          }) as any[]
          const choices = sampleArray(availableSkills, settings.skillSelectionCount).map((s: any) => ({ id: s.id, name: s.name, description: s.description }))
          // award stat points: only grant points for level gains here.
          // Do NOT add a baseline +1 for the training action to avoid double-awarding
          // when the player already received the participation point at shop start.
          const levelGain = newLevel - prevLevel
          const existingPoints = (shopState && (shopState.statPoints || 0)) || 0
          const newPoints = existingPoints + levelGain
          const { updated } = await persistState({ stage: 'SKILL', pendingSkillChoices: choices, statPoints: newPoints })
          // append server-side history for the level up
          try { await appendHistoryServer({ type: 'level', text: `Level ${newLevel + 1} Reached!`, level: newLevel + 1 }) } catch (e) {}
          return res.status(200).json({ message: 'Trained and leveled', player: attachPlayerKey(updated), pendingSkillChoices: choices, prevLevel, newLevel })
        }

        const { updated } = await persistState({})
        return res.status(200).json({ message: 'Trained', player: attachPlayerKey(updatedPlayer), prevLevel, newLevel })
      }

      case 'skipTraining':
      case 'rerollTreasure': {
        // treasures are exclusively from items with type 'TREASURE' linked to this format
        const treasures = await prisma.item.findMany({ 
          where: { 
            type: 'TREASURE',
            formatId: kdr.formatId || undefined
          }
        }) as any[]

        // Pre-fetch cards/skills for these items since Item doesn't have direct relations
        const itemCardIds = treasures.map(t => t.cardId).filter(Boolean) as string[]
        const itemSkillIds = treasures.map(t => t.skillId).filter(Boolean) as string[]
        const [itemCards, itemSkills] = await Promise.all([
          itemCardIds.length ? prisma.card.findMany({ where: { id: { in: itemCardIds } } }) : [],
          itemSkillIds.length ? prisma.skill.findMany({ where: { id: { in: itemSkillIds } } }) : []
        ])
        const itemCardMap = Object.fromEntries(itemCards.map(c => [c.id, c]))
        const itemSkillMap = Object.fromEntries(itemSkills.map(s => [s.id, s]))

        // Attach them manually
        treasures.forEach(t => {
          if (t.cardId) t.card = itemCardMap[t.cardId]
          if (t.skillId) t.skill = itemSkillMap[t.skillId]
        })

        const RARITIES = ['C', 'R', 'SR', 'UR']
        const rarityWeights = Array.isArray(settings.treasureRarityWeights) ? settings.treasureRarityWeights : [70, 20, 8, 2]

        const normalizeRarity = (value: any) => {
          const s = String(value || '').trim().toUpperCase()
          if (!s) return ''
          if (s === 'C' || s === 'COMMON' || s === 'N' || s === 'NORMAL') return 'C'
          if (s === 'R' || s === 'RARE') return 'R'
          if (s === 'SR' || s === 'S' || s === 'SUPER' || s === 'SUPER RARE') return 'SR'
          if (s === 'UR' || s === 'U' || s === 'ULTRA' || s === 'ULTRA RARE') return 'UR'
          return s
        }

        const pickTreasureForRarity = (rarity: string, excludedIds: Set<string> = new Set()) => {
          const target = normalizeRarity(rarity)
          // Filter treasures by normalized rarity
          const candidates = treasures.filter((t: any) => {
            const tr = normalizeRarity(t.rarity || t.card?.rarity)
            return tr === target
          }).filter((t: any) => !excludedIds.has(String(t.id)))

          // Debug: log candidate counts for this rarity
          try {
            const counts: Record<string, number> = { C: 0, R: 0, SR: 0, UR: 0, other: 0 }
            for (const t of treasures) {
              const tr = normalizeRarity(t.rarity || t.card?.rarity) || 'other'
              if (counts[tr as string] !== undefined) counts[tr as string] = (counts[tr as string] || 0) + 1
              else counts.other = (counts.other || 0) + 1
            }
            console.info('[TREASURE-DEBUG] treasure distro', { formatId: kdr.formatId, total: treasures.length, counts })
            console.info('[TREASURE-DEBUG] pick target', { requested: rarity, normalized: target, candidates: candidates.length })
          } catch (e) {}

          if (candidates.length === 0) {
            // Fallback to ANY treasure in this format if requested rarity is missing
            const fallback = treasures.filter((t: any) => !excludedIds.has(String(t.id)))
            return fallback.length > 0 ? sampleArray(fallback, 1)[0] : null
          }
          return sampleArray(candidates, 1)[0]
        }

        const offers: any[] = []
        const baseOfferCount = Number((payload && (Number(payload.offerCount) || Number(payload.count))) || settings.treasureOfferCount || 1)
        
        const rerollsUsed = Number(shopState.rerollsUsed || 0)
        const maxRerolls = Number(settings.rerollsAvailable || 0)
        const isReroll = action === 'rerollTreasure'
        
        if (isReroll) {
          if (rerollsUsed >= maxRerolls) {
            return res.status(400).json({ error: 'No rerolls remaining' })
          }
          // Note: rerollsUsed is persisted later in persistState
          try { await appendHistoryServer({ type: 'reroll', text: `Player rerolled treasure offers (${rerollsUsed + 1}/${maxRerolls})` }) } catch (e) {}
        }

        const pickedIds = new Set<string>()
        // Only pick if we actually have treasures defined in the format
        if (treasures.length > 0) {
          for (let i = 0; i < baseOfferCount; i++) {
            const idx = weightedPickIndex(rarityWeights)
            const rarity = idx >= 0 && idx < RARITIES.length ? RARITIES[idx] : RARITIES[Math.floor(Math.random() * RARITIES.length)]
            const picked = pickTreasureForRarity(rarity, pickedIds)
            if (picked) {
              pickedIds.add(String(picked.id))
              // Normalize rarity and only include Item-sourced treasures
              const offerRarity = normalizeRarity(picked.rarity || picked.card?.rarity)
              offers.push({
                id: picked.id,
                cardId: picked.cardId,
                skillId: picked.skillId,
                rarity: offerRarity,
                name: picked.name,
                description: picked.description,
                card: picked.card ? {
                  id: picked.card.id,
                  name: picked.card.name,
                  konamiId: picked.card.konamiId,
                  imageUrlCropped: picked.card.imageUrlCropped,
                  rarity: picked.card.rarity
                } : null,
                skill: picked.skill ? {
                  id: picked.skill.id,
                  name: picked.skill.name,
                  description: picked.skill.description
                } : null
              })
            }
          }
        }

        if (offers.length === 0) {
          const { updated } = await persistState({ stage: 'LOOT', treasureOffers: [] })
          return res.status(200).json({ message: 'No treasures available, skipping to loot stage', player: attachPlayerKey(updated), skippedToLoot: true })
        }

        const { updated } = await persistState({ stage: 'TREASURE', treasureOffers: offers, rerollsUsed: isReroll ? rerollsUsed + 1 : rerollsUsed })
        return res.status(200).json({ 
          message: isReroll ? 'Treasure rerolled' : 'Entered treasure stage', 
          player: attachPlayerKey(updated), 
          treasureOffers: offers,
          rerollsUsed: isReroll ? rerollsUsed + 1 : rerollsUsed,
          maxRerolls
        })
      }

      case 'chooseTreasure': {
        const { treasureId } = payload || {}
        if (!treasureId || typeof treasureId !== 'string') return res.status(400).json({ error: 'Missing treasureId' })
        
        // Find treasure in Item model (must be a format-specific TREASURE)
        const treasure = await prisma.item.findUnique({ 
          where: { id: treasureId }
        }) as any

        // Do NOT fall back to legacy LootItem here. Treasures must be `Item` rows
        if (!treasure) {
          console.warn('[TREASURE] attempt to choose non-Item treasure', { treasureId })
          return res.status(404).json({ error: 'Treasure not found (must be an Item of type TREASURE)' })
        }

        // Manually fetch and attach card/skill if they exist
        if (treasure.cardId) {
          treasure.card = await prisma.card.findUnique({ where: { id: treasure.cardId } });
        }
        if (treasure.skillId) {
          treasure.skill = await prisma.skill.findUnique({ where: { id: treasure.skillId } });
        }
        
        const offer = (shopState.treasureOffers || []).find((t: any) => String(t.id) === String(treasureId))
        const finalRarity = offer?.rarity || treasure.rarity || treasure.card?.rarity || 'UR'

        let updatedPlayer: any = player

        try {
          updatedPlayer = await prisma.$transaction(async (tx) => {
            await tx.playerItem.create({ 
              data: { 
                userId: user.id, 
                kdrId: kdr.id, 
                itemId: treasure.id, 
                cardId: treasure.cardId || null, 
                skillId: treasure.skillId || null, 
                qty: 1,
                purchased: true,
                seen: true
              } 
            })
            
            const purchases = Array.isArray(shopState.purchases) ? [...shopState.purchases] : []
            purchases.push({ 
              itemId: treasure.id, 
              name: treasure.name || treasure.card?.name || treasure.skill?.name,
              type: 'TREASURE',
              rarity: finalRarity,
              ts: Date.now()
            })

            const newState = { ...shopState, purchases, stage: 'LOOT', treasureOffers: [] }
            // FIX: Ensure we return the state so the client can refresh immediately
            const result = await tx.kDRPlayer.update({ where: { id: player.id }, data: { shopState: newState } })
            return result
          })
        } catch (e) {
          console.error('Failed to choose treasure', e)
          return res.status(500).json({ error: 'Failed to choose treasure' })
        }

        try { await appendHistoryServer({ type: 'treasure', text: `Player chose treasure: ${treasure.name || treasure.card?.name || treasure.skill?.name}` }) } catch (e) {}
        // Use updatedPlayer from transaction to ensure next state is correct
        return res.status(200).json({ message: 'Treasure chosen', player: attachPlayerKey(updatedPlayer) })
      }

      case 'lootOffers':
      case 'rerollLoot': {
        const isReroll = action === 'rerollLoot' || payload?.action === 'rerollLoot';
        const rerollsUsed = Number(shopState.rerollsUsed || 0)
        // settings.rerollsAvailable is calculated in lib/shopModifiers.ts based on CHA
        const maxRerolls = Number(settings.rerollsAvailable || 0)

        if (isReroll && rerollsUsed >= maxRerolls) {
          return res.status(400).json({ error: 'No rerolls remaining' })
        }

        // Fetch ALL candidate pools
        const allPools = await prisma.lootPool.findMany({ 
          include: { 
            items: { 
              include: { 
                card: true
              } 
            } 
          } 
        }) as any[]

        // Filter out treasures from loot pools – treasures are handled in the TREASURE stage.
        const filteredAllPools = allPools.filter((p: any) => {
          // A pool contains a treasure if it has any item of type 'TREASURE'
          // or a card with rarity 'UR' or 'SR' (since those are sampled in pickTreasureForRarity)
          const hasTreasure = (p.items || []).some((i: any) => {
            const t = String(i.type || '').toUpperCase()
            return t === 'TREASURE' || (t === 'CARD' && (String(i.card?.rarity || '').toUpperCase() === 'UR' || String(i.card?.rarity || '').toUpperCase() === 'SR'))
          })
          // Exclude pools that contain treasure/high-rarity cards from the generic loot sampling
          return !hasTreasure
        })
        const purchasedPoolIds = new Set<string>((Array.isArray(shopState.purchases) ? shopState.purchases : [])
          .filter((pp: any) => pp && (pp.lootPoolId || pp.lootPool))
          .map((pp: any) => String(pp.lootPoolId || pp.lootPool)))

        const availablePools = filteredAllPools.filter((p: any) => !p.id || !p.id.toString ? true : !purchasedPoolIds.has(String(p.id)))
        const classPools = availablePools.filter((p: any) => p.classId && player.classId && p.classId === player.classId)
        const genericPools = availablePools.filter((p: any) => !p.classId)

        const currentLevel = computeLevel((player.xp || 0), settings.levelXpCurve) + 1
        const sampledPools: any[] = []

        const getPoolsByTier = (pools: any[], tier: string) => {
          return pools.filter((p: any) => (p.tier || '').toUpperCase() === tier.toUpperCase())
        }

        const sampleFromPools = (pools: any[], count: number) => {
          if (count <= 0) return []
          // Shuffle with random seed for true randomness
          const shuffled = [...pools].sort(() => Math.random() - 0.5)
          const chosen = shuffled.slice(0, count)
          console.log(`[RerollLoot] Sampled ${chosen.length} from ${pools.length} candidates. (Targets: ${count})`)
          return chosen
        }

        // Gather class-specific loot by tier
        if (settings.classStarterCount > 0) {
          const pools = getPoolsByTier(classPools, 'STARTER')
          const sampled = sampleFromPools(pools, Number(settings.classStarterCount || 0))
          sampledPools.push(...sampled.map(p => ({ ...p, isGeneric: false })))
        }
        if (settings.classMidCount > 0 && currentLevel >= (settings.classMidMinLevel || 1)) {
          const pools = getPoolsByTier(classPools, 'MID')
          const sampled = sampleFromPools(pools, Number(settings.classMidCount || 0))
          sampledPools.push(...sampled.map(p => ({ ...p, isGeneric: false })))
        }
        if (settings.classHighCount > 0 && currentLevel >= (settings.classHighMinLevel || 1)) {
          const pools = getPoolsByTier(classPools, 'HIGH')
          const sampled = sampleFromPools(pools, Number(settings.classHighCount || 0))
          sampledPools.push(...sampled.map(p => ({ ...p, isGeneric: false })))
        }

        // Gather generic loot by tier (using same STARTER/MID/HIGH tiers)
        if (settings.genericStarterCount > 0) {
          const pools = getPoolsByTier(genericPools, 'STARTER')
          const sampled = sampleFromPools(pools, Number(settings.genericStarterCount || 0))
          sampledPools.push(...sampled.map(p => ({ ...p, isGeneric: true })))
        }
        if (settings.genericMidCount > 0 && currentLevel >= (settings.genericMidMinLevel || 1)) {
          const pools = getPoolsByTier(genericPools, 'MID')
          const sampled = sampleFromPools(pools, Number(settings.genericMidCount || 0))
          sampledPools.push(...sampled.map(p => ({ ...p, isGeneric: true })))
        }
        if (settings.genericHighCount > 0 && currentLevel >= (settings.genericHighMinLevel || 1)) {
          const pools = getPoolsByTier(genericPools, 'HIGH')
          const sampled = sampleFromPools(pools, Number(settings.genericHighCount || 0))
          sampledPools.push(...sampled.map(p => ({ ...p, isGeneric: true })))
        }

        // Group into finalized pool format
        const poolOffers = sampledPools.map((fullPool: any) => {
          const poolTierNormalized = (fullPool.tier || 'STARTER').toUpperCase()
          const poolCards = (fullPool.items || [])
            .filter((i: any) => i.type === 'Card' && i.card)
            .map((i: any) => ({
              id: i.card.id,
              name: i.card.name,
              konamiId: i.card.konamiId || null,
              imageUrlCropped: i.card.imageUrlCropped || null,
              variant: i.card.variant || 'TCG',
              artworks: i.card.artworks || null,
              primaryArtworkIndex: i.card.primaryArtworkIndex || 0
            }))
          
          const isGeneric = fullPool.isGeneric ?? !fullPool.classId
          let baseCost = 0
          if (isGeneric) {
            baseCost = poolTierNormalized === 'STARTER' ? (Number(settings.genericStarterCost) || 0) : 
                      poolTierNormalized === 'MID' ? (Number(settings.genericMidCost) || 0) : 
                      (Number(settings.genericHighCost) || 0)
          } else {
            baseCost = poolTierNormalized === 'STARTER' ? (Number(settings.classStarterCost) || 0) : 
                      poolTierNormalized === 'MID' ? (Number(settings.classMidCost) || 0) : 
                      (Number(settings.classHighCost) || 0)
          }
          const totalCost = baseCost + (Number(fullPool.tax) || 0)
          
          return {
            id: fullPool.id,
            name: fullPool.name,
            tier: poolTierNormalized,
            isGeneric: isGeneric,
            tax: Number(fullPool.tax) || 0,
            cost: totalCost,
            cards: poolCards,
            items: (fullPool.items || []).map((i: any) => ({
              id: i.id,
              type: i.type,
              card: i.card,
              skillName: i.skillName,
              skillDescription: i.skillDescription,
              amount: i.amount
            }))
          }
        })

        // Use the newly hardened persistState to avoid stale shop data
        const { updated } = await persistState({ 
          lootOffers: poolOffers, 
          rerollsUsed: isReroll ? rerollsUsed + 1 : rerollsUsed 
        })
        
        try { 
          if (isReroll) {
            await appendHistoryServer({ type: 'reroll', text: `Player rerolled ALL loot offers (${rerollsUsed + 1}/${maxRerolls})` }) 
          }
        } catch (e) {}

        return res.status(200).json({ 
          message: isReroll ? 'Loot rerolled' : 'Loot offers', 
          player: attachPlayerKey(updated), 
          offers: poolOffers,
          rerollsUsed: isReroll ? rerollsUsed + 1 : rerollsUsed,
          maxRerolls
        });
      }

      case 'purchaseLoot': {
        const { lootItemId, qty } = payload || {}
        const q = Number(qty) || 1
        if (!lootItemId || typeof lootItemId !== 'string') return res.status(400).json({ error: 'Missing lootItemId' })
        
        // lootItemId is actually a LootPoolItem id
        const poolItem = await prisma.lootPoolItem.findUnique({ 
          where: { id: lootItemId },
          include: { lootPool: true, card: true }
        }) as any
        if (!poolItem) return res.status(404).json({ error: 'Loot item not found' })
        
        // Derive unit cost from pool tier and whether pool is class-specific
        const tier = (poolItem.lootPool?.tier || 'STARTER').toUpperCase()
        const isClass = !!(poolItem.lootPool?.classId && player.classId && poolItem.lootPool.classId === player.classId)
        const tax = Number(poolItem.lootPool?.tax || 0)

        let unitCost = 0
        if (isClass) {
          // Class-specific loot pricing
          if (tier === 'STARTER') {
            unitCost = settings.classStarterCost || 0
          } else if (tier === 'MID') {
            unitCost = settings.classMidCost || 0
          } else if (tier === 'HIGH') {
            unitCost = settings.classHighCost || 0
          } else {
            unitCost = settings.classStarterCost || 0
          }
        } else {
          // Generic loot pricing
          if (tier === 'STARTER') {
            unitCost = settings.genericStarterCost || 0
          } else if (tier === 'MID') {
            unitCost = settings.genericMidCost || 0
          } else if (tier === 'HIGH') {
            unitCost = settings.genericHighCost || 0
          } else {
            unitCost = settings.genericStarterCost || 0
          }
        }
        
        // Apply pool-specific tax
        unitCost += tax
        
        const total = unitCost * q
        
        // perform atomic purchase: ensure sufficient gold, create/reuse LootItem, create PlayerLoot, update shopState
        try {
          const result = await prisma.$transaction(async (tx) => {
            const updatedMany = await tx.kDRPlayer.updateMany({ where: { id: player.id, gold: { gte: total } }, data: { gold: { decrement: total } } })
            if (updatedMany.count === 0) {
              throw new Error('INSUFFICIENT_GOLD')
            }
            
            // Find or create a LootItem for this pool item
            let lootItem = null
            if (poolItem.cardId) {
              lootItem = await tx.lootItem.findFirst({ where: { cardId: poolItem.cardId, type: poolItem.type } })
              if (!lootItem) {
                lootItem = await tx.lootItem.create({
                  data: {
                    cardId: poolItem.cardId,
                    type: poolItem.type,
                    rarity: poolItem.card?.rarity || 'C'
                  }
                })
              }
            } else if (poolItem.skillId) {
              // If the pool item references a Skill model, grant a PlayerItem representing that skill
              try {
                await tx.playerItem.create({ data: { userId: user.id, skillId: poolItem.skillId, kdrId: kdr.id, qty: 1 } })
              } catch (e) {
                // ignore duplicate or other errors
              }
              // create a placeholder lootItem pointing to the skill for inventory visibility
              lootItem = await tx.lootItem.create({ data: { skillId: poolItem.skillId, type: 'Skill', rarity: 'C' } })
            } else if (poolItem.skillName) {
              // For skills without a Skill model entry, create a generic LootItem
              lootItem = await tx.lootItem.create({
                data: {
                  type: poolItem.type,
                  rarity: 'C'
                }
              })
            }
            
            if (!lootItem) throw new Error('Failed to create loot item')
            
            // Persist inventory as PlayerItem (new schema)
            const playerLoot = await tx.playerItem.create({ 
              data: { 
                userId: user.id, 
                kdrId: kdr.id,
                itemId: lootItem.id, // SAVE THE LOOT ID
                cardId: lootItem.cardId || undefined,
                skillId: lootItem.skillId || undefined,
                qty: q,
                purchased: true,
                seen: true
              } 
            })
            const purchases = Array.isArray(shopState.purchases) ? [...shopState.purchases] : []
            purchases.push({ lootPoolItemId: lootItemId, lootItemId: lootItem.id, qty: q, cost: total })
            const newState = { ...shopState, purchases }
            await tx.kDRPlayer.update({ where: { id: player.id }, data: { shopState: newState } })
            const updatedPlayer = await tx.kDRPlayer.findUnique({ where: { id: player.id } })
            return { playerLoot, updatedPlayer }
          })
          return res.status(200).json({ message: 'Purchased', player: attachPlayerKey(result.updatedPlayer) })
        } catch (e: any) {
          if (e && e.message === 'INSUFFICIENT_GOLD') return res.status(400).json({ error: 'Insufficient gold' })
          console.error('Failed to complete purchase transaction', e)
          return res.status(500).json({ error: 'Failed to complete purchase' })
        }
      }

      case 'markSeen': {
        // Persist that the player has seen a particular loot pool (do not remove duplicates)
        try {
          const { poolId } = payload || {}
          if (!poolId) return res.status(400).json({ error: 'Missing poolId' })
          // load fresh player to avoid clobbering concurrent updates
          console.log('markSeen: poolId=', poolId, 'player.id=', player.id)
          const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player?.id || undefined } })
          if (!fresh) return res.status(404).json({ error: 'Player not found' })
          const currentState = (fresh?.shopState as any) || {}
          const seenArr = Array.isArray(currentState.seen) ? [...currentState.seen.map((s: any) => String(s))] : []
          if (!seenArr.includes(String(poolId))) {
            seenArr.push(String(poolId))
            const { updated } = await persistState({ ...currentState, seen: seenArr })
            return res.status(200).json({ message: 'Marked seen', player: attachPlayerKey(updated) })
          }
          return res.status(200).json({ message: 'Already seen', player: attachPlayerKey(fresh) })
        } catch (e) {
          console.error('Failed to mark seen', e)
          return res.status(500).json({ error: 'Failed to mark seen' })
        }
      }

      case 'purchaseLootPool': {
        const { lootPoolId, tier: reqTier, isGeneric: reqIsGeneric } = payload || {}
        
        // Handle logic for buying a whole quality (tier + type)
        if (reqTier) {
          try {
            const playerKeyLog = (player.userId && kdr?.id) ? generatePlayerKey(player.userId, kdr.id) : null
            console.log('Bulk Quality Purchase', { tier: reqTier, isGeneric: reqIsGeneric, playerKey: playerKeyLog })
            
            const tierKey = String(reqTier).toUpperCase()
            const isGenericBool = !!reqIsGeneric
            
            // 1. Determine cost
            let baseCost = 0
            if (isGenericBool) {
              baseCost = tierKey === 'STARTER' ? (settings.genericStarterCost || 0) : tierKey === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
            } else {
              baseCost = tierKey === 'STARTER' ? (settings.classStarterCost || 0) : tierKey === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
            }
            
            // 2. Identify all pools in this quality that the player is currently offered
            const currentState = (player.shopState as any) || {}
            const currentOffers = Array.isArray(currentState.lootOffers) ? currentState.lootOffers : []
            const poolsToBuy = currentOffers.filter((o: any) => 
               (o.tier || '').toUpperCase() === tierKey && 
               !!o.isGeneric === isGenericBool
            )

            if (poolsToBuy.length === 0) return res.status(400).json({ error: 'No pools found for this quality' })

            // 3. Perform transaction
            const result = await prisma.$transaction(async (tx) => {
              const freshPlayer = await tx.kDRPlayer.findUnique({ where: { id: player.id } })
              if (!freshPlayer) throw new Error('Player not found')
              
              const playerGoldNow = Number(freshPlayer.gold || 0)
              if (playerGoldNow < baseCost) throw new Error(`INSUFFICIENT_GOLD:${playerGoldNow}`)
              
              // Deduct cost
              await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { decrement: baseCost } } })
              
              const currentPurchases = Array.isArray((freshPlayer.shopState as any)?.purchases) ? [...(freshPlayer.shopState as any).purchases] : []
              
              // Process each pool (grant items + record purchase)
              for (const poolOffer of poolsToBuy) {
                // Fetch full pool details within transaction
                const fullPool = await tx.lootPool.findUnique({ 
                  where: { id: poolOffer.id }, 
                  include: { items: { include: { card: true } } } 
                }) as any
                if (!fullPool) continue

                // Avoid double-purchasing if somehow offered twice
                if (currentPurchases.some((p: any) => String(p.lootPoolId) === String(fullPool.id))) continue

                // Grant items logic (extracted same logic as single purchase)
                for (const item of (fullPool.items || [])) {
                  const typ = (item.type || '').toString()
                  if (typ === 'Card' && item.card && item.card.id) {
                    await tx.playerItem.create({ data: { userId: user.id, kdrId: kdr.id, itemId: null, cardId: item.card.id, qty: 1 } })
                  } else if (typ === 'Skill') {
                    const skillId = item.skillId || item.skill?.id || null
                    if (skillId) {
                      try { await tx.playerItem.create({ data: { userId: user.id, skillId, itemId: null, kdrId: kdr.id, qty: 1 } }) } catch (e) {}
                    }
                  } else if (typ === 'Gold' || item.amount) {
                    const amt = Number(item.amount || 0)
                    if (amt > 0) await tx.kDRPlayer.update({ where: { id: freshPlayer.id }, data: { gold: { increment: amt } } })
                  }
                }

                currentPurchases.push({ lootPoolId: fullPool.id, qty: 1, cost: 0, bulk: true })
              }

              // Update shop state (clear all pools in this quality category)
              const freshPlayerOffers = Array.isArray((freshPlayer.shopState as any)?.lootOffers) ? [...(freshPlayer.shopState as any).lootOffers] : []
              let updatedOffers = freshPlayerOffers.filter((o: any) => 
                !poolsToBuy.some((pb: any) => String(pb.id) === String(o.id))
              )

              // --- REFILL LOGIC FOR BULK PURCHASE ---
              const tierKeyLower = (tierKey || 'STARTER').toUpperCase()
              const desiredCount = isGenericBool
                ? (tierKeyLower === 'STARTER' ? (settings.genericStarterCount || 0) : tierKeyLower === 'MID' ? (settings.genericMidCount || 0) : (settings.genericHighCount || 0))
                : (tierKeyLower === 'STARTER' ? (settings.classStarterCount || 0) : tierKeyLower === 'MID' ? (settings.classMidCount || 0) : (settings.classHighCount || 0))

              let currentCategoryCount = updatedOffers.filter((o: any) => ((o.tier || '').toUpperCase() === tierKeyLower) && (!!o.isGeneric === !!isGenericBool)).length
              let need = Math.max(0, Number(desiredCount || 0) - currentCategoryCount)

              if (need > 0) {
                const purchasedIds = new Set<string>((currentPurchases || []).map((p: any) => String(p.lootPoolId)))
                const excluded = new Set<string>([...Array.from(purchasedIds), ...updatedOffers.map((o: any) => String(o.id))])

                const candidates = await tx.lootPool.findMany({
                  where: {
                    id: { notIn: Array.from(excluded) },
                    tier: tierKeyLower,
                    ...(isGenericBool ? { classId: null } : { classId: (poolsToBuy[0] as any).classId })
                  },
                  include: { items: { include: { card: true } } }
                })

                if (candidates && candidates.length > 0) {
                  const picks = sampleArray(candidates, Math.min(need, candidates.length))
                  for (const pick of picks) {
                    const poolCards = (pick.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ 
                      id: i.card.id, 
                      name: i.card.name, 
                      konamiId: i.card.konamiId || null,
                      imageUrlCropped: i.card.imageUrlCropped,
                      artworks: i.card.artworks
                    }))
                    const isPickGeneric = !pick.classId
                    const pickBaseCost = isPickGeneric
                      ? (pick.tier === 'STARTER' ? (settings.genericStarterCost || 0) : pick.tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0))
                      : (pick.tier === 'STARTER' ? (settings.classStarterCost || 0) : pick.tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0))
                    const pickTotalCost = Number(pickBaseCost || 0) + Number(pick.tax || 0)
                    updatedOffers.push({
                      id: pick.id,
                      name: pick.name,
                      tier: pick.tier,
                      isGeneric: isPickGeneric,
                      tax: pick.tax || 0,
                      cost: pickTotalCost,
                      cards: poolCards,
                      items: (pick.items || []).map((i: any) => ({ 
                        id: i.id, 
                        type: i.type, 
                        card: {
                          ...i.card,
                          imageUrlCropped: i.card?.imageUrlCropped,
                          artworks: i.card?.artworks
                        }, 
                        skillName: i.skillName, 
                        skillDescription: i.skillDescription, 
                        amount: i.amount 
                      }))
                    })
                    need--
                    if (need <= 0) break
                  }
                }
              }
              // --- END REFILL LOGIC ---

              const updatedPlayer = await tx.kDRPlayer.update({
                where: { id: freshPlayer.id },
                data: {
                  shopState: {
                    ...((freshPlayer.shopState as any) || {}),
                    purchases: currentPurchases,
                    lootOffers: updatedOffers
                  }
                }
              })
              
              return attachPlayerKey(updatedPlayer)
            })

            return res.status(200).json({ message: 'Quality purchased', player: result })
          } catch (e: any) {
            console.error('Bulk purchase failed', e)
            if (e.message?.startsWith('INSUFFICIENT_GOLD')) {
              return res.status(400).json({ error: 'Insufficient funds' })
            }
            return res.status(500).json({ error: 'Internal server error' })
          }
        }

        // --- Original Single Pool Purchase Logic ---
        if (!lootPoolId || typeof lootPoolId !== 'string') return res.status(400).json({ error: 'Missing lootPoolId' })

        const pool = await prisma.lootPool.findUnique({ where: { id: lootPoolId }, include: { items: { include: { card: true } } } }) as any
        if (!pool) return res.status(404).json({ error: 'Loot pool not found' })

        const tier = (pool.tier || 'STARTER').toUpperCase()
        const isGeneric = !pool.classId
        let baseCost = 0
        if (isGeneric) {
          baseCost = tier === 'STARTER' ? (settings.genericStarterCost || 0) : tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
        } else {
          baseCost = tier === 'STARTER' ? (settings.classStarterCost || 0) : tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
        }
        const totalCost = Number(baseCost || 0) + Number(pool.tax || 0)

        try {
          const result = await prisma.$transaction(async (tx) => {
            try {
              const playerKeyLog = (player.userId && kdr?.id) ? generatePlayerKey(player.userId, kdr.id) : null
              console.log('Attempting purchaseLootPool', { userId: user.id, playerKey: playerKeyLog, totalCost, poolId: pool.id })
            } catch (e) {
              console.log('Attempting purchaseLootPool', { userId: user.id, playerId: player.id, totalCost, poolId: pool.id })
            }
            // Read fresh player gold inside transaction and ensure enough funds
            const freshPlayer = await tx.kDRPlayer.findUnique({ where: { id: player.id } })
            const playerGoldNow = Number(freshPlayer?.gold || 0)
            if (playerGoldNow < Number(totalCost || 0)) {
              throw new Error(`INSUFFICIENT_GOLD:${playerGoldNow}`)
            }
            // Deduct cost
            await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { decrement: totalCost } } })

            // For each pool item, grant appropriate inventory entry
            for (const item of (pool.items || [])) {
              const typ = (item.type || '').toString()
                if (typ === 'Card' && item.card && item.card.id) {
                await tx.playerItem.create({ data: { userId: user.id, kdrId: kdr.id, itemId: null, cardId: item.card.id, qty: 1 } })
              } else if (typ === 'Skill') {
                const skillId = item.skillId || item.skill?.id || null
                if (skillId) {
                  // grant skill directly
                  try { await tx.playerItem.create({ data: { userId: user.id, skillId, itemId: null, kdrId: kdr.id, qty: 1 } }) } catch (e) {}
                } else if (item.skillName) {
                  // fallback
                  await tx.playerItem.create({ data: { userId: user.id, kdrId: kdr.id, itemId: null, qty: 1 } })
                }
              } else if (typ === 'Gold' || item.amount) {
                const amt = Number(item.amount || 0)
                if (amt > 0) {
                  await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: amt } } })
                }
              } else {
                // Generic fallback
                await tx.playerItem.create({ data: { userId: user.id, kdrId: kdr.id, itemId: null, qty: 1 } })
              }
            }

            // Append a purchase record into shopState.purchases
            const fresh = await tx.kDRPlayer.findUnique({ where: { id: player.id } })
            const currentState = (fresh?.shopState as any) || {}
            const purchases = Array.isArray(currentState.purchases) ? [...currentState.purchases] : []
            purchases.push({ lootPoolId: pool.id, qty: 1, cost: totalCost })
            // Also remove the purchased pool from any persisted lootOffers so it won't be shown again
            const existingOffers = Array.isArray(currentState.lootOffers) ? [...currentState.lootOffers] : []
            // remove purchased pool from persisted offers
            let updatedOffers = existingOffers.filter((o: any) => String(o.id) !== String(pool.id))

            // Determine desired display count for this pool's category (tier + generic/class)
            const tierKey = (tier || 'STARTER').toUpperCase()
            const desiredCount = isGeneric
              ? (tierKey === 'STARTER' ? (settings.genericStarterCount || 0) : tierKey === 'MID' ? (settings.genericMidCount || 0) : (settings.genericHighCount || 0))
              : (tierKey === 'STARTER' ? (settings.classStarterCount || 0) : tierKey === 'MID' ? (settings.classMidCount || 0) : (settings.classHighCount || 0))

            const currentCategoryCount = updatedOffers.filter((o: any) => ((o.tier || '').toUpperCase() === tierKey) && (!!o.isGeneric === !!isGeneric)).length
            let need = Math.max(0, Number(desiredCount || 0) - currentCategoryCount)

            if (need > 0) {
              // Build exclusion set: already purchased + already shown
              const purchasedIds = new Set<string>((purchases || []).map((p: any) => String(p.lootPoolId)))
              const excluded = new Set<string>([...Array.from(purchasedIds), ...updatedOffers.map((o: any) => String(o.id)), String(pool.id)])

              // Query candidate pools matching tier and type (class-specific vs generic), excluding already used ones
                const candidates = await tx.lootPool.findMany({
                where: {
                  id: { notIn: Array.from(excluded) },
                  tier: tierKey,
                  ...(isGeneric ? { classId: null } : { classId: pool.classId })
                },
                include: { items: { include: { card: true } } }
              })

              if (candidates && candidates.length > 0) {
                const picks = sampleArray(candidates, Math.min(need, candidates.length))
                for (const pick of picks) {
                  const poolCards = (pick.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ 
                    id: i.card.id, 
                    name: i.card.name, 
                    konamiId: i.card.konamiId || null,
                    imageUrlCropped: i.card.imageUrlCropped,
                    artworks: i.card.artworks
                  }))
                  const isPickGeneric = !pick.classId
                  const baseCost = isPickGeneric
                    ? (pick.tier === 'STARTER' ? (settings.genericStarterCost || 0) : pick.tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0))
                    : (pick.tier === 'STARTER' ? (settings.classStarterCost || 0) : pick.tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0))
                  const totalCost = Number(baseCost || 0) + Number(pick.tax || 0)
                  const mapped = {
                    id: pick.id,
                    name: pick.name,
                    tier: pick.tier,
                    isGeneric: isPickGeneric,
                    tax: pick.tax || 0,
                    cost: totalCost,
                    cards: poolCards,
                    items: (pick.items || []).map((i: any) => ({ 
                      id: i.id, 
                      type: i.type, 
                      card: {
                        ...i.card,
                        imageUrlCropped: i.card?.imageUrlCropped,
                        artworks: i.card?.artworks
                      }, 
                      skillName: i.skillName, 
                      skillDescription: i.skillDescription, 
                      amount: i.amount 
                    }))
                  }
                  updatedOffers.push(mapped)
                  // avoid re-picking same pool
                  excluded.add(String(pick.id))
                  need--
                  if (need <= 0) break
                }
              }
            }

            await tx.kDRPlayer.update({ where: { id: player.id }, data: { shopState: { ...currentState, purchases, lootOffers: updatedOffers } } })

            const updatedPlayer = await tx.kDRPlayer.findUnique({ where: { id: player.id } })
            return { updatedPlayer }
          })
          return res.status(200).json({ message: 'Pool purchased', player: attachPlayerKey(result.updatedPlayer) })
        } catch (e: any) {
          if (e && typeof e.message === 'string' && e.message.startsWith('INSUFFICIENT_GOLD')) {
            const parts = e.message.split(':')
            const have = parts[1] ? Number(parts[1]) : null
            return res.status(400).json({ error: 'Insufficient gold', have, required: totalCost })
          }
          console.error('Failed to purchase loot pool', e)
          return res.status(500).json({ error: 'Failed to purchase loot pool' })
        }
      }

      case 'tip': {
        const { amount } = payload || {}
        const a = Number(amount) || 0
        if (a <= 0) return res.status(400).json({ error: 'Invalid tip amount' })
        if ((player.gold || 0) < a) return res.status(400).json({ error: 'Insufficient gold to tip' })
        const updatedPlayer = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { gold: { decrement: a } } })
        const tipAmount = (shopState.tipAmount || 0) + a
        const { updated } = await persistState({ tipAmount })
        // if threshold reached, offer tip skills
        if (tipAmount >= (settings.tipThreshold || 100)) {
          const tipSkills = await prisma.skill.findMany({ where: { type: 'UNIQUE' } })
          const choices = sampleArray(tipSkills, settings.skillSelectionCount || 1).map(s => ({ id: s.id, name: s.name, description: s.description }))
          await persistState({ pendingTipSkillChoices: choices })
          return res.status(200).json({ message: 'Tip applied - tip reward available', player: attachPlayerKey(updatedPlayer), tipAmount, tipChoices: choices })
        }
        return res.status(200).json({ message: 'Tip applied', player: attachPlayerKey(updatedPlayer), tipAmount })
      }

      case 'chooseTipSkill': {
        const { skillId } = payload || {}
        if (!skillId || typeof skillId !== 'string') return res.status(400).json({ error: 'Missing skillId' })
        const skill = await prisma.skill.findUnique({ where: { id: skillId } })
        if (!skill) return res.status(404).json({ error: 'Skill not found' })
        try {
          await prisma.playerItem.create({ data: { userId: user.id, skillId, kdrId: kdr.id, qty: 1 } })
        } catch (e) {
          console.error('Failed to persist PlayerItem (tip)', e)
        }
        const { updated } = await persistState({ pendingTipSkillChoices: undefined })
        return res.status(200).json({ message: 'Tip skill chosen', player: attachPlayerKey(updated) })
      }

      case 'finish': {
        const { updated } = await persistState({ stage: 'DONE' })
        // mark shopComplete flag as well
        const final = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { shopComplete: true, shopState: updated.shopState } })
        return res.status(200).json({ message: 'Shop finished', player: attachPlayerKey(final) })
      }

      case 'getPlayerSkills': {
        try {
          // Fetch playerItem rows that represent skills and inventory cards for this user
          // For inventory, we limit to the current KDR.
          const [playerSkillRows, playerLootRows] = await Promise.all([
            prisma.playerItem.findMany({ where: { userId: user.id, NOT: { skillId: null } } }),
            prisma.playerItem.findMany({ 
              where: { 
                userId: user.id, 
                kdrId: kdr.id, 
                OR: [
                  { NOT: { cardId: null } },
                  { NOT: { itemId: null } }
                ] 
              } 
            })
          ])

          const kdrStart = kdr?.createdAt ? new Date(kdr.createdAt).getTime() : 0
          const shopState: any = player.shopState || {}
          const chosenSkillIds = Array.isArray(shopState.chosenSkills) ? shopState.chosenSkills : []

          // Load unique skill ids referenced to avoid N+1 queries
          const allSkillIds = Array.from(new Set([
            ...chosenSkillIds,
            ...(playerSkillRows || []).map((r: any) => r.skillId).filter(Boolean),
            ...(playerLootRows || []).map((r: any) => r.skillId).filter(Boolean)
          ]))
          
          // Identify the player's starting Class Skills to mark them as non-sellable
          let classSkillIds: string[] = []
          if (player.classId) {
            try {
              const cls = await prisma.class.findUnique({ 
                where: { id: player.classId }, 
                include: { skills: { select: { id: true, type: true } } } 
              })
              if (cls) {
                classSkillIds = (cls.skills || [])
                  .filter((s: any) => s.type === 'MAIN' || s.type === 'INNATE' || s.type === 'STARTING')
                  .map((s: any) => s.id)
              }
            } catch (e) {}
          }

          const skillRows = allSkillIds.length ? await prisma.skill.findMany({ where: { id: { in: allSkillIds as string[] } } }) : []
          const skillById: Record<string, any> = {}
          for (const s of skillRows) {
            skillById[s.id] = {
              ...s,
              // A skill is sellable if its model says so AND it's not the player's core class skill
              isSellable: s.isSellable && !classSkillIds.includes(s.id)
            }
          }

          // Load unique card ids for inventory details
          const allCardIds = Array.from(new Set([...(playerLootRows || []).map((r: any) => r.cardId).filter(Boolean)]))
          const cardRows = allCardIds.length ? await prisma.card.findMany({ where: { id: { in: allCardIds as string[] } } }) : []
          const cardById: Record<string, any> = {}
          for (const c of cardRows) cardById[c.id] = c
          
          // Load unique loot ids to ensure we have names for generic loot
          const allLootIds = Array.from(new Set([...(playerLootRows || []).map((r: any) => r.itemId).filter(Boolean)]))
          // LootItem (legacy) rows
          const lootRows = allLootIds.length ? await prisma.lootItem.findMany({ 
            where: { id: { in: allLootIds as string[] } },
            include: { card: true, skill: true } 
          }) : []
          const lootById: Record<string, any> = {}
          for (const l of lootRows) lootById[l.id] = l

          // Also load Item model rows for any itemIds that refer to Item rows (TREASURE or other)
          const itemRows = allLootIds.length ? await prisma.item.findMany({ 
            where: { id: { in: allLootIds as string[] } }
          }) : []
          const itemById: Record<string, any> = {}
          for (const it of itemRows) {
            const item = it as any;
            if (item.cardId) item.card = cardById[item.cardId];
            if (item.skillId) item.skill = skillById[item.skillId];
            itemById[item.id] = item;
          }

          const skillsMap: Record<string, any> = {}

          // 1. Add chosen SHOP skills (explicit picks in this KDR)

          // 1. Add chosen SHOP skills (explicit picks in this KDR)
          for (const sid of chosenSkillIds) {
            const s = skillById[sid]
            if (s) {
              skillsMap[sid] = { 
                id: s.id, 
                name: s.name, 
                description: s.description || s.desc || '', 
                isSellable: s.isSellable,
                _source: 'SHOP' 
              }
            }
          }

          // 2. Add inventory-derived skills (playerItem rows that reference a skill)
          for (const pl of (playerLootRows || [])) {
            if (pl.skillId) {
              const sid = pl.skillId
              const s = skillById[sid]
              if (s) {
                skillsMap[sid] = { 
                  id: s.id, 
                  name: s.name, 
                  description: s.description || s.desc || '', 
                  playerItemId: pl.id, 
                  isSellable: s.isSellable,
                  _source: 'INVENTORY' 
                }
              }
            }
          }

          // 3. Include playerItem rows created during this KDR (approximate) or linked to this KDR
          for (const ps of (playerSkillRows || [])) {
            if (!ps || !ps.skillId) continue
            const sid = ps.skillId
            const created = ps.createdAt ? new Date(ps.createdAt).getTime() : 0
            if (ps.kdrId === kdr.id || created >= kdrStart) {
              const s = skillById[sid]
              if (s && !skillsMap[sid]) {
                skillsMap[sid] = { 
                  id: s.id, 
                  name: s.name, 
                  description: s.description || s.desc || '', 
                  playerItemId: ps.id, 
                  isSellable: s.isSellable,
                  _source: 'LOOT_POOL' 
                }
              }
            }
          }

          // Map inventory with full card/skill details
          const detailedInventory = playerLootRows.map((pl: any) => {
            // Prefer Item model rows (which include TREASUREs); fall back to legacy LootItem rows
            const loot = pl.itemId ? (itemById[pl.itemId] || lootById[pl.itemId]) : null
            const card = pl.cardId ? cardById[pl.cardId] : (loot?.card || null)
            const skill = pl.skillId ? skillById[pl.skillId] : (loot?.skill || null)
            
            const lootNameStr = card?.name || skill?.name || pl.lootName || 
              (loot ? `${loot.rarity || ''} ${loot.type || 'Loot'}`.trim() : 'Unknown Item')

            return {
              ...pl,
              card,
              skill: skill ? { ...skill, isSellable: skill.isSellable } : null,
              name: lootNameStr,
              type: card ? (card.type || 'Monster') : skill ? 'Skill' : (loot?.type || 'Loot Item'),
              // Only items with itemId or sellable skills are sellable.
              isSellable: !!(pl.itemId || (skill && skill.isSellable)),
              // Mark whether this inventory row represents an Item model TREASURE
              isTreasure: !!(pl.itemId && itemById[pl.itemId] && String(itemById[pl.itemId].type || '').toUpperCase() === 'TREASURE')
            }
          })

          // Split out treasures (explicit Item.type === TREASURE) from the general inventory
          const treasures = detailedInventory.filter((pl: any) => !!pl.isTreasure)
          const inventory = detailedInventory.filter((pl: any) => !pl.isTreasure)

          const finalSkills = Object.values(skillsMap).filter((s: any) => s && s.isSellable)
          return res.status(200).json({ playerSkills: finalSkills, inventory, treasures })
        } catch (e) {
          console.error('Failed to load playerSkills', e)
          return res.status(500).json({ error: 'Failed to load player skills' })
        }
      }

      case 'sellItem': {
        // Sell an inventory item or a playerSkill for a flat amount (1 gold)
        try {
          const { type, id: sellId } = payload || {}
          if (!type || !sellId) return res.status(400).json({ error: 'Missing sell parameters' })
          const goldGain = 1

          if (type === 'playerLoot' || type === 'playerItem') {
            // Delete playerItem entry and credit gold
            const pl = await prisma.playerItem.findFirst({ 
              where: { id: sellId, userId: user.id, kdrId: kdr.id }
            })
            if (!pl) return res.status(404).json({ error: 'Inventory item not found' })

            // Enforce isSellable for skills found in inventory
            if (pl.skillId) {
              const s = await prisma.skill.findUnique({ 
                where: { id: pl.skillId }, 
                select: { id: true, isSellable: true, type: true } 
              })
              if (s) {
                let isCore = false
                if (player.classId) {
                  const cls = await prisma.class.findUnique({ 
                    where: { id: player.classId }, 
                    select: { skills: { select: { id: true, type: true } } } 
                  })
                  if (cls?.skills?.some(cs => cs.id === s.id && (cs.type === 'MAIN' || cs.type === 'INNATE' || cs.type === 'STARTING'))) {
                    isCore = true
                  }
                }
                if (s.isSellable === false || isCore) {
                  return res.status(403).json({ error: 'This item cannot be sold' })
                }
              }
            } else if (!pl.itemId) {
              // Not a core skill, so if it doesn't have an itemId (LootItem reference), it is a core class card and is not sellable.
              return res.status(403).json({ error: 'This item cannot be sold' })
            }

            await prisma.$transaction(async (tx) => {
              // Re-verify the existence of the playerItem inside the transaction
              const check = await tx.playerItem.findUnique({ where: { id: pl.id } })
              if (!check) throw new Error('ALREADY_SOLD')

              await tx.playerItem.delete({ where: { id: pl.id } })
              await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: goldGain } } })
            })
            const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
            return res.status(200).json({ message: 'Item sold', player: attachPlayerKey(fresh) })
          }

          if (type === 'lootItem') {
            // Sell by lootItemId (used when client only has purchase placeholders)
            // or by itemId (for TREASUREs which are Item model instances)
            
            // First check if it's a TREASURE (Item model instance)
            const item = await prisma.item.findUnique({ 
              where: { id: sellId }
            })

            const goldGainTreasure = 1 // Corrected: All items sell for 1 gold

            if (item && String(item.type || '').toUpperCase() === 'TREASURE') {
              // It's a treasure. Find corresponding playerItem.
              const pl = await prisma.playerItem.findFirst({ 
                where: { userId: user.id, kdrId: kdr.id, itemId: item.id } 
              })
              if (!pl) return res.status(404).json({ error: 'Treasure not found in your inventory' })
              
              await prisma.$transaction(async (tx) => {
                const check = await tx.playerItem.findUnique({ where: { id: pl.id } })
                if (!check) throw new Error('ALREADY_SOLD')

                await tx.playerItem.delete({ where: { id: pl.id } })
            // FIX: Remove from shopState.purchases if it's there, to ensure immediate UI removal in the modal
            const currentPurchases = Array.isArray(shopState.purchases) ? [...shopState.purchases] : []
            const newPurchases = currentPurchases.filter((p: any) => p.itemId !== item.id && p.id !== item.id)
            const newState = { ...shopState, purchases: newPurchases }
            
            await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: goldGainTreasure }, shopState: newState } })
              const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
              return res.status(200).json({ message: 'Treasure sold', player: attachPlayerKey(fresh) })
            }

            // Fallback for legacy lootItem (LootItem model)
            const loot = await prisma.lootItem.findUnique({ 
              where: { id: sellId }
            })
            if (!loot) return res.status(404).json({ error: 'Loot item not found' })

            // Check sellability
            if (loot.skillId) {
              const s = await prisma.skill.findUnique({ where: { id: loot.skillId }, select: { isSellable: true } })
              if (s?.isSellable === false) return res.status(403).json({ error: 'This skill cannot be sold' })
            }

            const pl = await prisma.playerItem.findFirst({ 
              where: { userId: user.id, kdrId: kdr.id, OR: [{ cardId: loot.cardId || undefined }, { skillId: loot.skillId || undefined }] } 
            })
            if (!pl) return res.status(404).json({ error: 'Inventory item not found for lootItemId' })
            await prisma.$transaction(async (tx) => {
              const check = await tx.playerItem.findUnique({ where: { id: pl.id } })
              if (!check) throw new Error('ALREADY_SOLD')

              await tx.playerItem.delete({ where: { id: pl.id } })
              await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: goldGain } } })
            })
            const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
            return res.status(200).json({ message: 'Item sold', player: attachPlayerKey(fresh) })
          }

          if (type === 'playerSkill') {
            // First check if it is an inventory-based skill (Loot pools or manual adds)
            let ps = await prisma.playerItem.findFirst({ 
              where: { id: sellId, userId: user.id, NOT: { skillId: null } }
            })
            
            // If not found by row ID, it might be a Shop-Picked skill (represented as skillId in chosenSkills)
            if (!ps) {
              const shopSkills = Array.isArray(shopState.chosenSkills) ? shopState.chosenSkills : []
              const sid = sellId // In this case, sellId passed IS the skill UUID
              if (shopSkills.includes(sid)) {
                // Check if sellable
                const s = await prisma.skill.findUnique({ where: { id: sid } })
                if (s?.isSellable === false) return res.status(403).json({ error: 'This skill is not sellable' })

                // Remove from shopState
                const newChosen = shopSkills.filter((id: string) => id !== sid)
                const newState = { ...shopState, chosenSkills: newChosen }
                
                await prisma.$transaction(async (tx) => {
                  const check = await tx.kDRPlayer.findUnique({ where: { id: player.id } })
                  const checkState = (check?.shopState as any) || {}
                  const checkSkills = Array.isArray(checkState.chosenSkills) ? checkState.chosenSkills : []
                  if (!checkSkills.includes(sid)) throw new Error('ALREADY_SOLD')

                  await tx.kDRPlayer.update({ where: { id: player.id }, data: { shopState: newState, gold: { increment: goldGain } } })
                })
                const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
                return res.status(200).json({ message: 'Shop skill sold', player: attachPlayerKey(fresh) })
              }
              return res.status(404).json({ error: 'Skill not found in inventory or shop picks' })
            }

            // Enforce sellability for inventory-based playerItems
            if (ps.skillId) {
              const s = await prisma.skill.findUnique({ where: { id: ps.skillId }, select: { isSellable: true, id: true, type: true } })
              if (s) {
                let isCore = false
                if (player.classId) {
                  const cls = await prisma.class.findUnique({ 
                    where: { id: player.classId }, 
                    select: { skills: { select: { id: true, type: true } } } 
                  })
                  if (cls?.skills?.some(cs => cs.id === s.id && (cs.type === 'MAIN' || cs.type === 'INNATE' || cs.type === 'STARTING'))) {
                    isCore = true
                  }
                }
                if (s.isSellable === false || isCore) {
                  return res.status(403).json({ error: 'This skill cannot be sold' })
                }
              }
            }
            
            await prisma.$transaction(async (tx) => {
              const check = await tx.playerItem.findFirst({ where: { id: ps.id } })
              if (!check) throw new Error('ALREADY_SOLD')

              await tx.playerItem.delete({ where: { id: ps.id } })
              await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: goldGain } } })
            })
            const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
            return res.status(200).json({ message: 'Skill sold', player: attachPlayerKey(fresh) })
          }

          return res.status(400).json({ error: 'Invalid sell type' })
        } catch (e: any) {
          console.error('Failed to sell item', e)
          if (e.message === 'ALREADY_SOLD') {
            return res.status(400).json({ error: 'Item already sold' })
          }
          return res.status(500).json({ error: 'Failed to sell item' })
        }
      }

      default:
        return res.status(400).json({ error: 'Unknown action' })
    }
  } catch (error) {
    console.error('Error running shop phase:', error)
    return res.status(500).json({ error: 'Failed to run shop phase' })
  }
}
