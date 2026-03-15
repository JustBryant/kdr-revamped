import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../lib/kdrHelpers'
import { getPlayerShopModifiers, applyShopModifiers } from '../../../lib/shopModifiers'
import { computeLevel, sampleArray, weightedPickIndex } from '../../../lib/shopHelpers'
import { persistStateForPlayer, appendHistoryForPlayer } from '../../../lib/shop-v2/state'
import { invalidateKdrCache } from '../../../lib/redis'

// Minimal dedicated shop-v2 handler: implements the core actions used by
// shop-v2 client (`get`, `start`, `appendHistory`, `train`, `chooseSkill`, `chooseStat`).
// This avoids build-time importing or relying on the legacy monolith `pages/api/kdr/shop.ts`.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { kdrId, action, payload } = req.body || {}
    if (!kdrId || typeof kdrId !== 'string') return res.status(400).json({ error: 'Missing kdrId' })

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const kdr = await findKdr(kdrId)
    if (!kdr) return res.status(404).json({ error: 'KDR not found' })

    const maybeInvalidate = async () => {
      try { await invalidateKdrCache(kdr.id) } catch (e) { console.warn('Failed to invalidate KDR cache (shop-v2)', e) }
    }

    const latestRoundAtStart = await prisma.kDRRound.findFirst({ where: { kdrId: kdr.id }, orderBy: { number: 'desc' }, select: { id: true, number: true } })
    const currentRoundNumberAtStart = Number(latestRoundAtStart?.number || 0)

    const player = await prisma.kDRPlayer.findFirst({ where: { kdrId: kdr.id, userId: user.id }, include: { user: true, shopInstances: true } })
    if (!player) return res.status(404).json({ error: 'Player not found in this KDR' })

    let shopInstance = player.shopInstances?.find((i: any) => i.roundNumber === currentRoundNumberAtStart) || null
    const shopState: any = player.shopState || {}

    const attachPlayerKey = (p: any, forcedInst?: any) => {
      if (!p) return p
      try {
        const key = (p.userId && kdr?.id) ? generatePlayerKey(p.userId, kdr.id) : null
        // Prefer an explicitly provided shop instance, else find one in shopInstances for current round
        const shopInst = forcedInst || p.shopInstances?.find((i: any) => i.roundNumber === currentRoundNumberAtStart)
        const persistedState = (p.shopState && Object.keys(p.shopState).length > 0) ? p.shopState : null

        // Build a merged, authoritative finalState so clients don't see transient differences
        const baseState = { stage: 'START', chosenSkills: [], purchases: [], tipAmount: 0, history: [], shopAwarded: false }
        // Start with instance state if present (represents current round view), otherwise with persisted
        const instState = shopInst ? (shopInst.shopState || {}) : null
        const finalState = { ...baseState, ...(instState || {}), ...(persistedState || {}) }

        // Merge purchases and seen arrays (dedupe) from both instance and persisted state
        const instPurch = Array.isArray(instState?.purchases) ? instState.purchases : []
        const persistedPurch = Array.isArray(persistedState?.purchases) ? persistedState.purchases : []
        const combinedPurchMap = new Map<string, any>()
        ;[...instPurch, ...persistedPurch].forEach((pp: any) => {
          if (!pp) return
          const keyId = String(pp.lootPoolId ?? pp.poolId ?? pp.itemId ?? JSON.stringify(pp))
          if (!combinedPurchMap.has(keyId)) combinedPurchMap.set(keyId, pp)
        })
        const mergedPurchases = Array.from(combinedPurchMap.values())

        const instSeen = Array.isArray(instState?.seen) ? instState.seen.map((s: any) => String(s)) : []
        const persistedSeen = Array.isArray(persistedState?.seen) ? persistedState.seen.map((s: any) => String(s)) : []
        const mergedSeen = Array.from(new Set([...(instSeen || []), ...(persistedSeen || [])]))

        // Determine completeness and lastRound
        const finalComplete = !!(shopInst ? shopInst.isComplete : p.shopComplete)
        const finalRound = shopInst ? shopInst.roundNumber : (p.lastShopRound || currentRoundNumberAtStart)

        try {
          console.log('[SHOP:ATTACH] merged purchases', { playerId: p.id, instCount: (instPurch || []).length, persistedCount: (persistedPurch || []).length, mergedCount: mergedPurchases.length })
        } catch (e) {}
        return { ...p, playerKey: key, shopState: { ...finalState, purchases: mergedPurchases, seen: mergedSeen }, shopComplete: finalComplete, lastShopRound: finalRound }
      } catch (e) { return p }
    }

    // Helper: filter outgoing offers against DB-level purchased pools only
    const filterOutgoingOffers = (offers: any[], dbPlayer: any) => {
      if (!Array.isArray(offers)) return offers
      try {
        const purchasedSet = new Set<string>((Array.isArray(dbPlayer?.purchasedPools) ? dbPlayer.purchasedPools : []).map((x: any) => String(x)))
        return (offers || []).filter((o: any) => {
          const id = String(o?.id || '')
          if (!id) return true
          if (purchasedSet.has(id)) {
            try { console.log('[SHOP-V2] filtering outgoing offer (purchased)', { playerId: player.id, poolId: id }) } catch (e) {}
            return false
          }
          return true
        })
      } catch (e) { return offers }
    }

    // Resolve settings
    let settings: any = null
    if (kdr.settingsSnapshot) settings = kdr.settingsSnapshot
    else if (kdr.formatId) {
      const fmt = await prisma.format.findUnique({ where: { id: kdr.formatId } })
      settings = (fmt && (fmt.settings as any)) || null
    }
    const defaults = { goldPerRound: 50, xpPerRound: 100, levelXpCurve: [0, 100, 300, 600, 1000], trainingCost: 50, trainingXp: 100, skillSelectionCount: 3 }
    let baseSettings = { ...defaults, ...(settings || {}) }
    let modifiers = {}
    try { modifiers = await getPlayerShopModifiers(player.id) } catch (e) { modifiers = {} }
    settings = applyShopModifiers(baseSettings, modifiers)

    // helpers

    // helpers moved to lib/shop-v2/state.ts
    const persistState = persistStateForPlayer;
    const appendHistoryServer = appendHistoryForPlayer;

    switch (action) {
      case 'appendHistory': {
        const entry = payload || {}
        try { const { updated } = await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry, playerShopState: shopInstance?.shopState || player.shopState }); return res.status(200).json({ message: 'History appended', player: attachPlayerKey(updated) }) } catch (e) { return res.status(500).json({ error: 'Failed to append history' }) }
      }

      case 'get': {
        // return current player snapshot for v2
        return res.status(200).json({ player: attachPlayerKey(player, shopInstance) })
      }

      case 'markSeen': {
        try {
          const { poolId } = payload || {}
          if (!poolId || typeof poolId !== 'string') return res.status(400).json({ error: 'Missing poolId' })

          // Merge into instance/persisted seen arrays via persistStateForPlayer
          const currentInstState: any = (shopInstance?.shopState as any) || {}
          const playerShopStateAny: any = (player.shopState as any) || {}
          const existingSeen = Array.isArray((currentInstState as any)?.seen)
            ? (currentInstState as any).seen.map((s: any) => String(s))
            : Array.isArray(playerShopStateAny?.seen)
            ? (playerShopStateAny.seen || []).map((s: any) => String(s))
            : []
          const mergedSeen = Array.from(new Set([...(existingSeen || []), String(poolId)]))

          const existingSeenPools = Array.isArray((currentInstState as any)?.seenPools)
            ? (currentInstState as any).seenPools.map((s: any) => String(s))
            : Array.isArray(playerShopStateAny?.seenPools)
            ? (playerShopStateAny.seenPools || []).map((s: any) => String(s))
            : []
          const mergedSeenPools = Array.from(new Set([...(existingSeenPools || []), String(poolId)]))

          const { updated } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { seen: mergedSeen, seenPools: mergedSeenPools }, playerShopState: currentInstState })
          return res.status(200).json({ message: 'Marked seen', player: attachPlayerKey(updated) })
        } catch (e: any) {
          console.error('Failed to mark seen', e)
          return res.status(500).json({ error: 'Failed to mark seen' })
        }
      }

      case 'start': {
        let inst = await prisma.kDRShopInstance.findUnique({ where: { playerId_roundNumber: { playerId: player.id, roundNumber: currentRoundNumberAtStart } } })
        if (inst && inst.isComplete) return res.status(403).json({ error: 'SHOP_LOCKED', player: attachPlayerKey(player, inst) })
        if (!inst || currentRoundNumberAtStart > (Number(player.lastShopRound) || 0)) {
          const existingPurchases = Array.isArray((player.shopState as any)?.purchases) ? [...(player.shopState as any).purchases] : []
          const existingPurchasedPools = Array.isArray((player as any)?.purchasedPools) ? [...(player as any).purchasedPools] : []
          const existingPurchasedPoolsFromDb = Array.isArray((player as any)?.purchasedPools) ? [...(player as any).purchasedPools] : []
          const existingSeenPoolsFromDb = Array.isArray((player as any)?.seenPools) ? [...(player as any).seenPools] : []
          const resetState = { chosenSkills: [], purchases: existingPurchases, purchasedPools: Array.from(new Set([...(existingPurchasedPools || []), ...existingPurchasedPoolsFromDb])), tipAmount: 0, lootOffers: [], pendingSkillChoices: [], statPoints: (player.shopState as any)?.statPoints || 0, history: [], stage: 'START', stats: (player as any).stats || {}, shopAwarded: false }
          await prisma.kDRPlayer.update({ where: { id: player.id }, data: { shopComplete: false, shopState: resetState as any, lastShopRound: currentRoundNumberAtStart, purchasedPools: Array.from(new Set([...(existingPurchasedPools || []), ...existingPurchasedPoolsFromDb])), seenPools: existingSeenPoolsFromDb } })
          const { updated, shopState: newState } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: resetState, playerShopState: player.shopState })
          inst = await prisma.kDRShopInstance.findUnique({ where: { playerId_roundNumber: { playerId: player.id, roundNumber: currentRoundNumberAtStart } } })
        }

        const hasAwarded = (inst?.shopState as any)?.shopAwarded || false
        if (!hasAwarded) {
          const awardedGold = Number(settings.goldPerRound || 0)
          const awardedXp = Number(settings.xpPerRound || 0)
          const updatedPlayer = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: awardedGold }, xp: { increment: awardedXp } } })
          const prevLevel = computeLevel((player.xp || 0), settings.levelXpCurve)
          const newLevel = computeLevel((updatedPlayer.xp || 0), settings.levelXpCurve)

          // pick initial loot offers (provide full pool details so client can render them)
          // Ensure class pools are restricted to the player's class and generic pools remain generic.
          const allPools = await prisma.lootPool.findMany({ include: { items: { include: { card: true, skill: true } } } })
          const availablePools = allPools.filter((p: any) => {
            const hasTreasure = (p.items || []).some((i: any) => {
              const t = String(i.type || '').toUpperCase()
              return t === 'TREASURE' || (t === 'CARD' && (String(i.card?.rarity || '').toUpperCase() === 'UR' || String(i.card?.rarity || '').toUpperCase() === 'SR'))
            })
            return !hasTreasure
          })

          const classPools = availablePools.filter((p: any) => p.classId && player.classId && p.classId === player.classId)
          const genericPools = availablePools.filter((p: any) => !p.classId)
          try { console.log('[SHOP-V2] start sampling', { playerId: player.id, playerClass: player.classId, classPools: classPools.length, genericPools: genericPools.length, classStarterCount: Number(settings.classStarterCount||0), genericStarterCount: Number(settings.genericStarterCount||0) }) } catch (e) {}

          const sampleFromPools = (pools: any[], count: number) => { if (!Array.isArray(pools) || count <= 0) return []; const shuffled = [...pools].sort(() => Math.random() - 0.5); return shuffled.slice(0, count) }

          const sampled: any[] = []
          // Exclude pools the player has already purchased (persisted or in-instance) and any already-seen pools per DB
          const existingPurchIds = new Set<string>()
          const instPurch = Array.isArray((inst?.shopState as any)?.purchases) ? (inst!.shopState as any).purchases : []
          const persistedPurch = Array.isArray((player.shopState as any)?.purchases) ? (player.shopState as any).purchases : []
          ;[...instPurch, ...persistedPurch].forEach((pp: any) => { if (!pp) return; const id = String(pp.lootPoolId ?? pp.poolId ?? pp.itemId ?? ''); if (id) existingPurchIds.add(id) })
          // Also include any previously recorded purchasedPools arrays on instance or player shopState
          try {
            const instPurchased = Array.isArray((inst?.shopState as any)?.purchasedPools) ? (inst!.shopState as any).purchasedPools : []
            const persistedPurchased = Array.isArray((player as any)?.purchasedPools) ? (player as any).purchasedPools : []
            ;[...instPurchased, ...persistedPurchased].forEach((pid: any) => { if (pid) existingPurchIds.add(String(pid)) })
          // Also incorporate DB-level purchasedPools and seenPools as authoritative exclusions
          try {
            if (Array.isArray((player as any)?.purchasedPools)) (player as any).purchasedPools.forEach((pid: any) => { if (pid) existingPurchIds.add(String(pid)) })
          } catch (e) {}
          } catch (e) {}
          try {
            const inventoryPools = await prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { ['lootPoolId' as any]: null } } as any), select: { ['lootPoolId' as any]: true } as any }) as any[]
            inventoryPools.forEach(i => { if (i && (i as any).lootPoolId) existingPurchIds.add(String((i as any).lootPoolId)) })
          } catch (e) {}

          if (Number(settings.classStarterCount || 0) > 0) sampled.push(...sampleFromPools(classPools.filter((p: any) => ((p.tier || '').toUpperCase() === 'STARTER') && !existingPurchIds.has(String(p.id))), Number(settings.classStarterCount || 0)).map(p => ({ ...p, isGeneric: false })))
          if (Number(settings.genericStarterCount || 0) > 0) sampled.push(...sampleFromPools(genericPools.filter((p: any) => ((p.tier || '').toUpperCase() === 'STARTER') && !existingPurchIds.has(String(p.id))), Number(settings.genericStarterCount || 0)).map(p => ({ ...p, isGeneric: true })))

          const initialLootOffers = sampled.map((fullPool: any) => {
            const poolTierNormalized = (fullPool.tier || 'STARTER').toUpperCase()
            const poolCards = (fullPool.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ id: i.card.id, name: i.card.name, konamiId: i.card.konamiId || null, imageUrlCropped: i.card.imageUrlCropped || null, variant: i.card.variant || 'TCG', artworks: i.card.artworks || null, primaryArtworkIndex: i.card.primaryArtworkIndex || 0 }))
            const isGeneric = fullPool.isGeneric ?? !fullPool.classId
            let baseCost = 0
            if (isGeneric) baseCost = poolTierNormalized === 'STARTER' ? (settings.genericStarterCost || 0) : poolTierNormalized === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
            else baseCost = poolTierNormalized === 'STARTER' ? (settings.classStarterCost || 0) : poolTierNormalized === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
            const totalCost = baseCost + (Number(fullPool.tax) || 0)
            return { id: fullPool.id, name: fullPool.name, tier: poolTierNormalized, isGeneric: isGeneric, tax: Number(fullPool.tax) || 0, cost: totalCost, cards: poolCards, items: (fullPool.items || []).map((i: any) => ({ id: i.id, type: i.type, card: i.card, skill: i.skill ? { ...i.skill, statRequirements: i.skill.statRequirements ? (typeof i.skill.statRequirements === 'string' ? JSON.parse(i.skill.statRequirements) : i.skill.statRequirements) : [] } : null, skillName: i.skillName, skillDescription: i.skillDescription, amount: i.amount })) }
          })

          let pendingSkillChoices = undefined
          let nextStage: any = 'STATS'
          const levelGain = newLevel - prevLevel
          const existingPoints = ((inst?.shopState as any)?.statPoints || 0) || 0
          const newPoints = existingPoints + 1 + levelGain
          if (newLevel > prevLevel) {
            const ownedSkillIds = await prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { skillId: null } } as any), select: { skillId: true } }).then(list => list.map(li => li.skillId).filter(Boolean) as string[])
            const availableSkills = await prisma.skill.findMany({ where: { classId: null, type: 'GENERIC', id: { notIn: ownedSkillIds } } })
            pendingSkillChoices = sampleArray(availableSkills, settings.skillSelectionCount).map((s: any) => ({ id: s.id, name: s.name, description: s.description || '' }))
            nextStage = 'SKILL'
          }

          // Deduplicate offers by id to avoid duplicate lootPool entries (prevents React key collisions)
          const uniqueInitialLootOffers = Array.from(new Map((initialLootOffers || []).map((o: any) => [String(o.id), o])).values())
          // Defensive filter: ensure we do not include any pool the player already owns (inventory or purchases)
          const filteredInitialLootOffers = (uniqueInitialLootOffers || []).filter((o: any) => {
            if (existingPurchIds.has(String(o.id))) {
              try { console.log('[SHOP-V2] excluding owned pool from initial offers', { playerId: player.id, poolId: String(o.id) }) } catch (e) {}
              return false
            }
            return true
          })
          const mergedSeenStart = Array.from(new Set([...(((inst?.shopState as any)?.seen) || ((player.shopState as any)?.seen) || []), ...((filteredInitialLootOffers || []).map((o: any) => String(o.id)))]))
          const mergedSeenPoolsStart = Array.from(new Set([...(((inst?.shopState as any)?.seenPools) || ((player as any)?.seenPools) || []), ...((filteredInitialLootOffers || []).map((o: any) => String(o.id)))]))
          const mergedPurchasedPools = Array.from(new Set([...(Array.isArray((inst?.shopState as any)?.purchasedPools) ? (inst!.shopState as any).purchasedPools : []), ...(Array.isArray((player as any)?.purchasedPools) ? (player as any).purchasedPools : [])]))
          const { updated, shopState: newState } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { shopAwarded: true, stage: nextStage, lootOffers: filteredInitialLootOffers, statPoints: newPoints, pendingSkillChoices, shopAward: { gold: awardedGold, xp: awardedXp }, seen: mergedSeenStart, seenPools: mergedSeenPoolsStart, purchasedPools: mergedPurchasedPools }, playerShopState: inst?.shopState || player.shopState })
          try { await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'award', text: `Player gained ${awardedGold} gold and ${awardedXp} XP this round.`, gold: awardedGold, xp: awardedXp }, playerShopState: inst?.shopState || player.shopState }) } catch (e) {}
          let levelEntry = undefined
          if (newLevel > prevLevel) {
            const lev = { type: 'level', text: `Level ${newLevel + 1} Reached!`, level: newLevel + 1 }
            try { await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: lev, playerShopState: inst?.shopState || player.shopState }) } catch (e) {}
            levelEntry = lev
          }
          try { await maybeInvalidate() } catch (e) {}
          return res.status(200).json({ message: 'Shop initialized', player: attachPlayerKey(updated), next: nextStage, prevLevel, newLevel, awarded: { gold: awardedGold, xp: awardedXp }, levelEntry })
        }
        return res.status(200).json({ message: 'Shop resumed', player: attachPlayerKey(player, inst), next: (inst?.shopState as any).stage || 'SKILL' })
      }

      case 'train': {
        const cost = settings.trainingCost || 0
        const xpGain = settings.trainingXp || 0
        if ((player.gold || 0) < cost) return res.status(400).json({ error: 'Insufficient gold for training' })
        const updatedPlayer = await prisma.kDRPlayer.update({ where: { id: player.id }, data: { gold: { decrement: cost }, xp: { increment: xpGain } } })
        const prevLevel = computeLevel((player.xp || 0), settings.levelXpCurve)
        const newLevel = computeLevel((updatedPlayer.xp || 0), settings.levelXpCurve)
        if (newLevel > prevLevel) {
            const ownedSkillIds = await prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { skillId: null } } as any), select: { skillId: true } }).then(list => list.map(li => li.skillId).filter(Boolean) as string[])
          const availableSkills = await prisma.skill.findMany({ where: { classId: null, type: 'GENERIC', id: { notIn: ownedSkillIds } } }) as any[]
          const choices = sampleArray(availableSkills, settings.skillSelectionCount).map((s: any) => ({ id: s.id, name: s.name, description: s.description || '' }))
            try { console.log('[DBG] server.train pendingSkillChoices', { playerId: player.id, choices: choices.map(c => ({ id: c.id, name: c.name, hasDescription: !!c.description })) }) } catch (e) {}
          const levelGain = newLevel - prevLevel
          const existingPoints = ((shopInstance?.shopState as any)?.statPoints || 0) || 0
          const newPoints = existingPoints + levelGain
          const { updated } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { stage: 'SKILL', pendingSkillChoices: choices, statPoints: newPoints }, playerShopState: shopInstance?.shopState || player.shopState })
          let levelEntry = undefined
          try {
            const lev = { type: 'level', text: `Level ${newLevel + 1} Reached!`, level: newLevel + 1 }
            try { await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: lev, playerShopState: shopInstance?.shopState || player.shopState }) } catch (e) {}
            levelEntry = lev
          } catch (e) {}
          try { await maybeInvalidate() } catch (e) {}
          return res.status(200).json({ message: 'Trained and leveled', player: attachPlayerKey(updated), pendingSkillChoices: choices, prevLevel, newLevel, levelEntry })
        }
        const { updated } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: {}, playerShopState: shopInstance?.shopState || player.shopState })
        let returnedPlayer: any = updatedPlayer
        try {
          const appendRes = await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'train', text: `Player trained and gained ${xpGain} XP`, xp: xpGain, gold: -cost }, playerShopState: shopInstance?.shopState || player.shopState })
          if (appendRes && appendRes.updated) returnedPlayer = appendRes.updated
        } catch (e) {}
        try { await maybeInvalidate() } catch (e) {}
        return res.status(200).json({ message: 'Trained', player: attachPlayerKey(returnedPlayer), prevLevel, newLevel })
      }

      case 'chooseSkill': {
        const { skillId } = payload || {}
        if (!skillId || typeof skillId !== 'string') return res.status(400).json({ error: 'Missing skillId' })
        const skill = await prisma.skill.findUnique({ where: { id: skillId } })
        if (!skill) return res.status(404).json({ error: 'Skill not found' })
        const chosen = Array.isArray((shopInstance?.shopState as any)?.chosenSkills) ? [...(shopInstance!.shopState as any).chosenSkills] : []
        chosen.push(skillId)
        await prisma.playerItem.create({ data: { userId: user.id, skillId, kdrId: kdr.id, kdrPlayerId: player.id, qty: 1 } })
        const havePoints = Number((shopInstance?.shopState as any)?.statPoints || 0) > 0
        const { updated } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { chosenSkills: chosen, pendingSkillChoices: undefined, stage: (havePoints ? 'STATS' : 'TRAINING') }, playerShopState: shopInstance?.shopState || player.shopState })
        try { await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'skill', text: `Player chose skill: ${skill.name}`, skillId: skill.id, skillName: skill.name }, playerShopState: shopInstance?.shopState || player.shopState }) } catch (e) {}
        try { await maybeInvalidate() } catch (e) {}
        return res.status(200).json({ message: 'Skill chosen', player: attachPlayerKey(updated), chosenSkills: chosen })
      }

      case 'chooseStat': {
        const { stat } = payload || {}
        if (!stat || typeof stat !== 'string') return res.status(400).json({ error: 'Missing stat' })
        const key = (stat || '').toLowerCase()
        const valid = ['dex', 'con', 'str', 'int', 'cha']
        if (!valid.includes(key)) return res.status(400).json({ error: 'Invalid stat' })
        const availablePoints = Number((shopInstance?.shopState as any)?.statPoints || 0)
        if (availablePoints <= 0) return res.status(400).json({ error: 'No stat points available' })
        const curStats = (shopInstance?.shopState as any)?.stats || {}
        const newStats = { ...(curStats || {}), [key]: (Number(curStats?.[key] || 0) + 1) }
        const remaining = Math.max(0, availablePoints - 1)
        const { updated } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { stats: newStats, statPoints: remaining, stage: (remaining > 0 ? ((shopInstance?.shopState as any)?.stage || 'STATS') : 'TRAINING') }, playerShopState: shopInstance?.shopState || player.shopState })
        await prisma.kDRPlayer.update({ where: { id: player.id }, data: { stats: newStats } as any })
        try { await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'stat', text: `Player increased ${key.toUpperCase()} to ${newStats[key]}`, stat: key, value: newStats[key] }, playerShopState: shopInstance?.shopState || player.shopState }) } catch (e) {}
        try { await maybeInvalidate() } catch (e) {}
        return res.status(200).json({ message: 'Stat increased', player: attachPlayerKey(updated) })
      }

      case 'skipTraining':
      case 'rerollTreasure': {
        const treasures = await prisma.item.findMany({
          where: {
            type: 'TREASURE',
            formatId: kdr.formatId || undefined
          }
        }) as any[]

        const itemCardIds = treasures.map(t => t.cardId).filter(Boolean) as string[]
        const itemSkillIds = treasures.map(t => t.skillId).filter(Boolean) as string[]
        const [itemCards, itemSkills] = await Promise.all([
          itemCardIds.length ? prisma.card.findMany({ where: { id: { in: itemCardIds } } }) : [],
          itemSkillIds.length ? prisma.skill.findMany({ where: { id: { in: itemSkillIds } } }) : []
        ])
        const itemCardMap = Object.fromEntries(itemCards.map(c => [c.id, c]))
        const itemSkillMap = Object.fromEntries(itemSkills.map(s => [s.id, s]))
        treasures.forEach(t => { if (t.cardId) t.card = itemCardMap[t.cardId]; if (t.skillId) t.skill = itemSkillMap[t.skillId] })

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
          const candidates = treasures.filter((t: any) => {
            const tr = normalizeRarity(t.rarity || t.card?.rarity)
            return tr === target
          }).filter((t: any) => !excludedIds.has(String(t.id)))
          if (candidates.length === 0) {
            const fallback = treasures.filter((t: any) => !excludedIds.has(String(t.id)))
            return fallback.length > 0 ? sampleArray(fallback, 1)[0] : null
          }
          return sampleArray(candidates, 1)[0]
        }

        const offers: any[] = []
        const baseOfferCount = Number((payload && (Number(payload.offerCount) || Number(payload.count))) || settings.treasureOfferCount || 1)

        const rerollsUsed = Number((shopInstance?.shopState as any)?.rerollsUsed || 0)
        const maxRerolls = Number(settings.rerollsAvailable || 0)
        const isReroll = action === 'rerollTreasure'
        if (isReroll) {
          if (rerollsUsed >= maxRerolls) return res.status(400).json({ error: 'No rerolls remaining' })
          try { await appendHistoryServer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'reroll', text: `Player rerolled treasure offers (${rerollsUsed + 1}/${maxRerolls})` }, playerShopState: shopInstance?.shopState || player.shopState }) } catch (e) {}
        }

        const pickedIds = new Set<string>()
        if (treasures.length > 0) {
          for (let i = 0; i < baseOfferCount; i++) {
            const idx = weightedPickIndex(rarityWeights)
            const rarity = idx >= 0 && idx < RARITIES.length ? RARITIES[idx] : RARITIES[Math.floor(Math.random() * RARITIES.length)]
            const picked = pickTreasureForRarity(rarity, pickedIds)
            if (picked) {
              pickedIds.add(String(picked.id))
              const offerRarity = normalizeRarity(picked.rarity || picked.card?.rarity)
              offers.push({
                id: picked.id,
                cardId: picked.cardId,
                skillId: picked.skillId,
                rarity: offerRarity,
                name: picked.name,
                description: picked.description,
                card: picked.card ? { id: picked.card.id, name: picked.card.name, konamiId: picked.card.konamiId, imageUrlCropped: picked.card.imageUrlCropped, rarity: picked.card.rarity } : null,
                skill: picked.skill ? { id: picked.skill.id, name: picked.skill.name, description: picked.skill.description } : null
              })
            }
          }
        }

        if (offers.length === 0) {
          // No treasures: sample loot offers and enter LOOT phase
          // Reuse sampling logic from lootOffers below to produce poolOffers
          const allPoolsRaw2 = await prisma.lootPool.findMany({ include: { items: { include: { card: true, skill: true } } } }) as any[]
          const availablePools2 = allPoolsRaw2.filter(p => {
            const hasTreasure = (p.items || []).some((i: any) => {
              const t = String(i.type || '').toUpperCase()
              return t === 'TREASURE' || (t === 'CARD' && (String(i.card?.rarity || '').toUpperCase() === 'UR' || String(i.card?.rarity || '').toUpperCase() === 'SR'))
            })
            return !hasTreasure
          })
          const classPools2 = availablePools2.filter((p: any) => p.classId && player.classId && p.classId === player.classId)
          const genericPools2 = availablePools2.filter((p: any) => !p.classId)
          const currentLevel2 = computeLevel((player.xp || 0), settings.levelXpCurve) + 1
          const sampledPools2: any[] = []
          const getPoolsByTier2 = (pools: any[], tier: string) => pools.filter((p: any) => (p.tier || '').toUpperCase() === tier.toUpperCase())
          const sampleFromPools2 = (pools: any[], count: number) => { if (count <= 0) return []; const shuffled = [...pools].sort(() => Math.random() - 0.5); return shuffled.slice(0, count) }

          // Exclude pools already purchased by the player (persisted or in-instance)
          const existingPurchIds2 = new Set<string>()
          const instPurch2 = Array.isArray((shopInstance?.shopState as any)?.purchases) ? (shopInstance!.shopState as any).purchases : []
          const persistedPurch2 = Array.isArray((player.shopState as any)?.purchases) ? (player.shopState as any).purchases : []
          ;[...instPurch2, ...persistedPurch2].forEach((pp: any) => { if (!pp) return; const id = String(pp.lootPoolId ?? pp.poolId ?? pp.itemId ?? ''); if (id) existingPurchIds2.add(id) })
          try {
            const inventoryPools2 = await prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { ['lootPoolId' as any]: null } } as any), select: { ['lootPoolId' as any]: true } as any }) as any[]
            inventoryPools2.forEach(i => { if (i && (i as any).lootPoolId) existingPurchIds2.add(String((i as any).lootPoolId)) })
            // Also incorporate DB-level purchasedPools and seenPools as authoritative exclusions
            try { if (Array.isArray((player as any)?.purchasedPools)) (player as any).purchasedPools.forEach((pid: any) => { if (pid) existingPurchIds2.add(String(pid)) }) } catch (e) {}
          } catch (e) {}

          if (settings.classStarterCount > 0) sampledPools2.push(...sampleFromPools2(getPoolsByTier2(classPools2, 'STARTER').filter((p: any) => !existingPurchIds2.has(String(p.id))), Number(settings.classStarterCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.classMidCount > 0 && currentLevel2 >= (settings.classMidMinLevel || 1)) sampledPools2.push(...sampleFromPools2(getPoolsByTier2(classPools2, 'MID').filter((p: any) => !existingPurchIds2.has(String(p.id))), Number(settings.classMidCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.classHighCount > 0 && currentLevel2 >= (settings.classHighMinLevel || 1)) sampledPools2.push(...sampleFromPools2(getPoolsByTier2(classPools2, 'HIGH').filter((p: any) => !existingPurchIds2.has(String(p.id))), Number(settings.classHighCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.genericStarterCount > 0) sampledPools2.push(...sampleFromPools2(getPoolsByTier2(genericPools2, 'STARTER').filter((p: any) => !existingPurchIds2.has(String(p.id))), Number(settings.genericStarterCount)).map(p => ({ ...p, isGeneric: true })))
          if (settings.genericMidCount > 0 && currentLevel2 >= (settings.genericMidMinLevel || 1)) sampledPools2.push(...sampleFromPools2(getPoolsByTier2(genericPools2, 'MID').filter((p: any) => !existingPurchIds2.has(String(p.id))), Number(settings.genericMidCount)).map(p => ({ ...p, isGeneric: true })))
          if (settings.genericHighCount > 0 && currentLevel2 >= (settings.genericHighMinLevel || 1)) sampledPools2.push(...sampleFromPools2(getPoolsByTier2(genericPools2, 'HIGH').filter((p: any) => !existingPurchIds2.has(String(p.id))), Number(settings.genericHighCount)).map(p => ({ ...p, isGeneric: true })))

          const poolOffers2 = sampledPools2.map((fullPool: any) => {
            const poolTierNormalized = (fullPool.tier || 'STARTER').toUpperCase()
            const poolCards = (fullPool.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ id: i.card.id, name: i.card.name, konamiId: i.card.konamiId || null, imageUrlCropped: i.card.imageUrlCropped || null, variant: i.card.variant || 'TCG', artworks: i.card.artworks || null, primaryArtworkIndex: i.card.primaryArtworkIndex || 0 }))
            const isGeneric = fullPool.isGeneric ?? !fullPool.classId
            let baseCost = 0
            if (isGeneric) baseCost = poolTierNormalized === 'STARTER' ? (settings.genericStarterCost || 0) : poolTierNormalized === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
            else baseCost = poolTierNormalized === 'STARTER' ? (settings.classStarterCost || 0) : poolTierNormalized === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
            const totalCost = baseCost + (Number(fullPool.tax) || 0)
            return { id: fullPool.id, name: fullPool.name, tier: poolTierNormalized, isGeneric: isGeneric, tax: Number(fullPool.tax) || 0, cost: totalCost, cards: poolCards, items: (fullPool.items || []).map((i: any) => ({ id: i.id, type: i.type, card: i.card, skill: i.skill ? { ...i.skill, statRequirements: i.skill.statRequirements ? (typeof i.skill.statRequirements === 'string' ? JSON.parse(i.skill.statRequirements) : i.skill.statRequirements) : [] } : null, skillName: i.skillName, skillDescription: i.skillDescription, amount: i.amount })) }
          })

          // Deduplicate pool offers by id to avoid duplicated pools being shown
          const uniquePoolOffers2 = Array.from(new Map((poolOffers2 || []).map((o: any) => [String(o.id), o])).values())
          const mergedSeen2 = Array.from(new Set([...(shopInstance?.shopState as any)?.seen || [], ...((uniquePoolOffers2 || []).map((o: any) => String(o.id)))]))
          const { updated } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { stage: 'LOOT', lootOffers: uniquePoolOffers2, seen: mergedSeen2 }, playerShopState: shopInstance?.shopState || player.shopState })
          try { await maybeInvalidate() } catch (e) {}
          const filteredPoolOffers2 = filterOutgoingOffers(poolOffers2, updated || player)
          return res.status(200).json({ message: 'No treasures available, entering loot stage', player: attachPlayerKey(updated), offers: filteredPoolOffers2, skippedToLoot: true })
        }

        const { updated } = await persistState({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { stage: 'TREASURES', treasureOffers: offers, rerollsUsed: isReroll ? rerollsUsed + 1 : rerollsUsed }, playerShopState: shopInstance?.shopState || player.shopState })
        try { await maybeInvalidate() } catch (e) {}
        return res.status(200).json({ message: isReroll ? 'Treasure rerolled' : 'Entered treasure stage', player: attachPlayerKey(updated), treasureOffers: offers, rerollsUsed: isReroll ? rerollsUsed + 1 : rerollsUsed, maxRerolls })
      }

      case 'chooseTreasure': {
        const { treasureId } = payload || {}
        if (!treasureId || typeof treasureId !== 'string') return res.status(400).json({ error: 'Missing treasureId' })
        const treasure = await prisma.item.findUnique({ where: { id: treasureId } }) as any
        if (!treasure) return res.status(404).json({ error: 'Treasure not found (must be an Item of type TREASURE)' })
        if (treasure.cardId) treasure.card = await prisma.card.findUnique({ where: { id: treasure.cardId } })
        if (treasure.skillId) treasure.skill = await prisma.skill.findUnique({ where: { id: treasure.skillId } })
        const offer = (shopInstance?.shopState as any)?.treasureOffers?.find((t: any) => String(t.id) === String(treasureId))
        const finalRarity = offer?.rarity || treasure.rarity || treasure.card?.rarity || 'UR'
        try {
          const purchases = Array.isArray((shopInstance?.shopState as any)?.purchases) ? [...(shopInstance!.shopState as any).purchases] : []
          purchases.push({ itemId: treasure.id, name: treasure.name || treasure.card?.name || treasure.skill?.name, type: 'TREASURE', rarity: finalRarity, ts: Date.now() })
          // After choosing a treasure, skip loot phase and complete shop
          // After choosing a treasure, sample loot offers and enter LOOT phase
          const currentInstState: any = (shopInstance?.shopState as any) || {}
          const mergedPurchases = Array.isArray(currentInstState.purchases) ? [...currentInstState.purchases] : []
          const newPurchases = [...mergedPurchases, ...(purchases || [])]

          // Sample loot offers now that we're entering LOOT (reuse logic from lootOffers)
          const allPoolsRaw3 = await prisma.lootPool.findMany({ include: { items: { include: { card: true, skill: true } } } }) as any[]
          const availablePools3 = allPoolsRaw3.filter(p => {
            const hasTreasure = (p.items || []).some((i: any) => {
              const t = String(i.type || '').toUpperCase()
              return t === 'TREASURE' || (t === 'CARD' && (String(i.card?.rarity || '').toUpperCase() === 'UR' || String(i.card?.rarity || '').toUpperCase() === 'SR'))
            })
            return !hasTreasure
          })
          const classPools3 = availablePools3.filter((p: any) => p.classId && player.classId && p.classId === player.classId)
          const genericPools3 = availablePools3.filter((p: any) => !p.classId)
          const currentLevel3 = computeLevel((player.xp || 0), settings.levelXpCurve) + 1
          const sampledPools3: any[] = []
          const getPoolsByTier3 = (pools: any[], tier: string) => pools.filter((p: any) => (p.tier || '').toUpperCase() === tier.toUpperCase())
          const sampleFromPools3 = (pools: any[], count: number) => { if (count <= 0) return []; const shuffled = [...pools].sort(() => Math.random() - 0.5); return shuffled.slice(0, count) }

          // Build exclusion set to avoid offering pools the player already owns / has seen
          const existingPurchIds3 = new Set<string>()
          const instPurch3 = Array.isArray((shopInstance?.shopState as any)?.purchases) ? (shopInstance!.shopState as any).purchases : []
          const persistedPurch3 = Array.isArray((player.shopState as any)?.purchases) ? (player.shopState as any).purchases : []
          ;[...instPurch3, ...persistedPurch3].forEach((pp: any) => { if (!pp) return; const id = String(pp.lootPoolId ?? pp.poolId ?? pp.itemId ?? ''); if (id) existingPurchIds3.add(id) })
          try { if (Array.isArray((player as any)?.purchasedPools)) (player as any).purchasedPools.forEach((pid: any) => { if (pid) existingPurchIds3.add(String(pid)) }) } catch (e) {}
          try {
            const inventoryPools3 = await prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { ['lootPoolId' as any]: null } } as any), select: { ['lootPoolId' as any]: true } as any }) as any[]
            inventoryPools3.forEach(i => { if (i && (i as any).lootPoolId) existingPurchIds3.add(String((i as any).lootPoolId)) })
          } catch (e) {}

          if (settings.classStarterCount > 0) sampledPools3.push(...sampleFromPools3(getPoolsByTier3(classPools3, 'STARTER').filter((p: any) => !existingPurchIds3.has(String(p.id))), Number(settings.classStarterCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.classMidCount > 0 && currentLevel3 >= (settings.classMidMinLevel || 1)) sampledPools3.push(...sampleFromPools3(getPoolsByTier3(classPools3, 'MID').filter((p: any) => !existingPurchIds3.has(String(p.id))), Number(settings.classMidCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.classHighCount > 0 && currentLevel3 >= (settings.classHighMinLevel || 1)) sampledPools3.push(...sampleFromPools3(getPoolsByTier3(classPools3, 'HIGH').filter((p: any) => !existingPurchIds3.has(String(p.id))), Number(settings.classHighCount)).map(p => ({ ...p, isGeneric: false })))
          if (settings.genericStarterCount > 0) sampledPools3.push(...sampleFromPools3(getPoolsByTier3(genericPools3, 'STARTER').filter((p: any) => !existingPurchIds3.has(String(p.id))), Number(settings.genericStarterCount)).map(p => ({ ...p, isGeneric: true })))
          if (settings.genericMidCount > 0 && currentLevel3 >= (settings.genericMidMinLevel || 1)) sampledPools3.push(...sampleFromPools3(getPoolsByTier3(genericPools3, 'MID').filter((p: any) => !existingPurchIds3.has(String(p.id))), Number(settings.genericMidCount)).map(p => ({ ...p, isGeneric: true })))
          if (settings.genericHighCount > 0 && currentLevel3 >= (settings.genericHighMinLevel || 1)) sampledPools3.push(...sampleFromPools3(getPoolsByTier3(genericPools3, 'HIGH').filter((p: any) => !existingPurchIds3.has(String(p.id))), Number(settings.genericHighCount)).map(p => ({ ...p, isGeneric: true })))

          const poolOffers3 = sampledPools3.map((fullPool: any) => {
            const poolTierNormalized = (fullPool.tier || 'STARTER').toUpperCase()
            const poolCards = (fullPool.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ id: i.card.id, name: i.card.name, konamiId: i.card.konamiId || null, imageUrlCropped: i.card.imageUrlCropped || null, variant: i.card.variant || 'TCG', artworks: i.card.artworks || null, primaryArtworkIndex: i.card.primaryArtworkIndex || 0 }))
            const isGeneric = fullPool.isGeneric ?? !fullPool.classId
            let baseCost = 0
            if (isGeneric) baseCost = poolTierNormalized === 'STARTER' ? (settings.genericStarterCost || 0) : poolTierNormalized === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
            else baseCost = poolTierNormalized === 'STARTER' ? (settings.classStarterCost || 0) : poolTierNormalized === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
            const totalCost = baseCost + (Number(fullPool.tax) || 0)
            return { id: fullPool.id, name: fullPool.name, tier: poolTierNormalized, isGeneric: isGeneric, tax: Number(fullPool.tax) || 0, cost: totalCost, cards: poolCards, items: (fullPool.items || []).map((i: any) => ({ id: i.id, type: i.type, card: i.card, skill: i.skill ? { ...i.skill, statRequirements: i.skill.statRequirements ? (typeof i.skill.statRequirements === 'string' ? JSON.parse(i.skill.statRequirements) : i.skill.statRequirements) : [] } : null, skillName: i.skillName, skillDescription: i.skillDescription, amount: i.amount })) }
          })

          const mergedSeen3 = Array.from(new Set([...(currentInstState.seen || []), ...((poolOffers3 || []).map((o: any) => String(o.id)))]))
          // First, persist the chosen treasure to the player's inventory so
          // it is guaranteed to be present before we update the shop state.
          try {
            await prisma.playerItem.create({ data: { userId: user.id, kdrId: kdr.id, kdrPlayerId: player.id, itemId: treasure.id, cardId: treasure.cardId || null, skillId: treasure.skillId || null, qty: 1, purchased: true, seen: true } })
          } catch (e) {
            console.error('Failed to create playerItem for chosen treasure', e)
            // If inventory creation fails, return an error so the client can retry.
            return res.status(500).json({ error: 'Failed to grant treasure' })
          }

          // Persist shop state with the new purchase and the sampled loot offers
          const { updated } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { purchases: newPurchases, stage: 'LOOT', lootOffers: poolOffers3, treasureOffers: [], seen: mergedSeen3 }, playerShopState: currentInstState })
          try { await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'treasure', text: `Player chose treasure: ${treasure.name || treasure.card?.name || treasure.skill?.name}`, itemId: treasure.id, name: treasure.name, rarity: finalRarity }, playerShopState: currentInstState }) } catch (e) {}
          try { await maybeInvalidate() } catch (e) {}

          // Return the updated player and the loot offers so client enters LOOT
          const filteredPoolOffers3 = filterOutgoingOffers(poolOffers3, updated || player)
          return res.status(200).json({ message: 'Treasure chosen; entering loot stage', player: attachPlayerKey(updated), offers: filteredPoolOffers3, next: 'LOOT' })
        } catch (e) {
          console.error('Failed to choose treasure', e)
          return res.status(500).json({ error: 'Failed to choose treasure' })
        }
      }

      case 'lootOffers':
      case 'rerollLoot': {
        const isReroll = action === 'rerollLoot' || payload?.action === 'rerollLoot'
        const rerollsUsed = Number((shopInstance?.shopState as any)?.rerollsUsed || 0)
        const maxRerolls = Number(settings.rerollsAvailable || 0)
        if (isReroll && rerollsUsed >= maxRerolls) return res.status(400).json({ error: 'No rerolls remaining' })

        // If the client is not requesting an explicit reroll and we already have
        // loot offers stored in the instance/persisted shop state, return those
        // cached offers instead of re-sampling all qualities. This prevents a
        // single-quality refresh (e.g. Starter Packs) from causing a full
        // re-sample of every quality when nothing changed for them.
        const existingState = (shopInstance?.shopState as any) || (player.shopState as any) || {}
        const existingOffers = Array.isArray(existingState.lootOffers) ? existingState.lootOffers : []
        const purchasedPoolIds = new Set<string>()

        // Pre-collect purchased pool ids (from previous shop instances, player inventory, and DB-level purchased/seen)
        const [allPurchasesForExclusion_pre, inventoryPools_pre] = await Promise.all([
          prisma.kDRShopInstance.findMany({ where: { playerId: player.id }, select: { shopState: true } }),
          prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { ['lootPoolId' as any]: null } } as any), select: { ['lootPoolId' as any]: true } as any }) as Promise<any[]>
        ])
        inventoryPools_pre.forEach(i => { if ((i as any).lootPoolId) purchasedPoolIds.add(String((i as any).lootPoolId)) })
        allPurchasesForExclusion_pre.forEach(inst => {
          const state = inst.shopState as any
          if (state && Array.isArray(state.purchases)) state.purchases.forEach((p: any) => { const poolId = p.lootPoolId || p.poolId; if (poolId) purchasedPoolIds.add(String(poolId)) })
        })
        // Also include DB-level purchasedPools and seenPools as authoritative
        try { if (Array.isArray((player as any)?.purchasedPools)) (player as any).purchasedPools.forEach((pid: any) => { if (pid) purchasedPoolIds.add(String(pid)) }) } catch (e) {}

        const currentLevel = computeLevel((player.xp || 0), settings.levelXpCurve) + 1
        if (!isReroll && existingOffers.length > 0) {
          // Determine expected counts per tier/generic based on settings and player level
          const currentLevel = computeLevel((player.xp || 0), settings.levelXpCurve) + 1
          const expected = {
            class: { STARTER: Number(settings.classStarterCount || 0), MID: (Number(settings.classMidCount || 0) && currentLevel >= (settings.classMidMinLevel || 1)) ? Number(settings.classMidCount || 0) : 0, HIGH: (Number(settings.classHighCount || 0) && currentLevel >= (settings.classHighMinLevel || 1)) ? Number(settings.classHighCount || 0) : 0 },
            generic: { STARTER: Number(settings.genericStarterCount || 0), MID: (Number(settings.genericMidCount || 0) && currentLevel >= (settings.genericMidMinLevel || 1)) ? Number(settings.genericMidCount || 0) : 0, HIGH: (Number(settings.genericHighCount || 0) && currentLevel >= (settings.genericHighMinLevel || 1)) ? Number(settings.genericHighCount || 0) : 0 }
          }

          // Adjust expected counts to account for pools the player has already purchased
          const purchasedCounts: any = { class: { STARTER: 0, MID: 0, HIGH: 0 }, generic: { STARTER: 0, MID: 0, HIGH: 0 } }
          try {
            if (purchasedPoolIds.size > 0) {
              const purchasedPoolsDetails = await prisma.lootPool.findMany({ where: { id: { in: Array.from(purchasedPoolIds) } } })
              purchasedPoolsDetails.forEach((pp: any) => {
                const t = ((pp.tier || 'STARTER') as string).toUpperCase()
                const bucket = pp.classId ? 'class' : 'generic'
                if (purchasedCounts[bucket] && purchasedCounts[bucket][t] !== undefined) purchasedCounts[bucket][t]++
              })
            }
          } catch (e) { /* ignore purchased lookup failures */ }

          const adjustedExpected: any = { class: { STARTER: 0, MID: 0, HIGH: 0 }, generic: { STARTER: 0, MID: 0, HIGH: 0 } }
          for (const b of ['class','generic'] as const) {
            for (const t of ['STARTER','MID','HIGH'] as const) {
              const need = expected[b][t] || 0
              const purchased = purchasedCounts[b][t] || 0
              adjustedExpected[b][t] = Math.max(0, need - purchased)
            }
          }

          const counts: any = { class: { STARTER: 0, MID: 0, HIGH: 0 }, generic: { STARTER: 0, MID: 0, HIGH: 0 } }
          existingOffers.forEach((o: any) => {
            const tier = ((o.tier || 'STARTER') as string).toUpperCase()
            const bucket = o.isGeneric ? 'generic' : 'class'
            if (counts[bucket] && counts[bucket][tier] !== undefined) counts[bucket][tier]++
          })

          // If all expected counts are satisfied, return cached offers.
          let allSatisfied = true
          for (const bucket of ['class', 'generic'] as const) {
            for (const tier of ['STARTER', 'MID', 'HIGH'] as const) {
              const need = adjustedExpected[bucket][tier]
              const have = counts[bucket][tier] || 0
              if ((need || 0) > have) { allSatisfied = false; break }
            }
            if (!allSatisfied) break
          }

          if (allSatisfied) {
            const mergedSeen = Array.from(new Set([...(existingState.seen || []), ...existingOffers.map((o: any) => String(o.id))]))
            try { await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { lootOffers: existingOffers, seen: mergedSeen }, playerShopState: shopInstance?.shopState || player.shopState }) } catch (e) {}
            const filteredExistingOffers = filterOutgoingOffers(existingOffers, player)
            return res.status(200).json({ message: 'Loot offers (cached)', player: attachPlayerKey(player, shopInstance), offers: filteredExistingOffers, rerollsUsed, maxRerolls })
          }
          // Otherwise fall through to re-sample missing categories below
        }

        

        const allPoolsRaw = await prisma.lootPool.findMany({ include: { items: { include: { card: true, skill: true } } } }) as any[]
        const availablePools = allPoolsRaw.filter(p => {
          if (purchasedPoolIds.has(String(p.id))) return false
          const hasTreasure = (p.items || []).some((i: any) => {
            const t = String(i.type || '').toUpperCase()
            return t === 'TREASURE' || (t === 'CARD' && (String(i.card?.rarity || '').toUpperCase() === 'UR' || String(i.card?.rarity || '').toUpperCase() === 'SR'))
          })
          return !hasTreasure
        })

        const classPools = availablePools.filter((p: any) => p.classId && player.classId && p.classId === player.classId)
        const genericPools = availablePools.filter((p: any) => !p.classId)

        // currentLevel already computed above for level gating
        const sampledPools: any[] = []
        const getPoolsByTier = (pools: any[], tier: string) => pools.filter((p: any) => (p.tier || '').toUpperCase() === tier.toUpperCase())
        const sampleFromPools = (pools: any[], count: number) => { if (count <= 0) return []; const shuffled = [...pools].sort(() => Math.random() - 0.5); return shuffled.slice(0, count) }

        if (settings.classStarterCount > 0) sampledPools.push(...sampleFromPools(getPoolsByTier(classPools, 'STARTER'), Number(settings.classStarterCount)).map(p => ({ ...p, isGeneric: false })))
        if (settings.classMidCount > 0 && currentLevel >= (settings.classMidMinLevel || 1)) sampledPools.push(...sampleFromPools(getPoolsByTier(classPools, 'MID'), Number(settings.classMidCount)).map(p => ({ ...p, isGeneric: false })))
        if (settings.classHighCount > 0 && currentLevel >= (settings.classHighMinLevel || 1)) sampledPools.push(...sampleFromPools(getPoolsByTier(classPools, 'HIGH'), Number(settings.classHighCount)).map(p => ({ ...p, isGeneric: false })))
        if (settings.genericStarterCount > 0) sampledPools.push(...sampleFromPools(getPoolsByTier(genericPools, 'STARTER'), Number(settings.genericStarterCount)).map(p => ({ ...p, isGeneric: true })))
        try { console.log('[SHOP-V2] lootOffers sampledPools', { playerId: player.id, playerClass: player.classId, sampledCount: sampledPools.length, sampledByTier: sampledPools.reduce((acc:any,p:any)=>{ const t=(p.tier||'STARTER').toUpperCase(); const b = p.isGeneric ? 'generic' : 'class'; acc[b]=acc[b]||{}; acc[b][t]=(acc[b][t]||0)+1; return acc }, {}) }) } catch(e) {}
        if (settings.genericMidCount > 0 && currentLevel >= (settings.genericMidMinLevel || 1)) sampledPools.push(...sampleFromPools(getPoolsByTier(genericPools, 'MID'), Number(settings.genericMidCount)).map(p => ({ ...p, isGeneric: true })))
        if (settings.genericHighCount > 0 && currentLevel >= (settings.genericHighMinLevel || 1)) sampledPools.push(...sampleFromPools(getPoolsByTier(genericPools, 'HIGH'), Number(settings.genericHighCount)).map(p => ({ ...p, isGeneric: true })))

        const poolOffers = sampledPools.map((fullPool: any) => {
          const poolTierNormalized = (fullPool.tier || 'STARTER').toUpperCase()
          const poolCards = (fullPool.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ id: i.card.id, name: i.card.name, konamiId: i.card.konamiId || null, imageUrlCropped: i.card.imageUrlCropped || null, variant: i.card.variant || 'TCG', artworks: i.card.artworks || null, primaryArtworkIndex: i.card.primaryArtworkIndex || 0 }))
          const isGeneric = fullPool.isGeneric ?? !fullPool.classId
          let baseCost = 0
          if (isGeneric) baseCost = poolTierNormalized === 'STARTER' ? (settings.genericStarterCost || 0) : poolTierNormalized === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
          else baseCost = poolTierNormalized === 'STARTER' ? (settings.classStarterCost || 0) : poolTierNormalized === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
          const totalCost = baseCost + (Number(fullPool.tax) || 0)
          return { id: fullPool.id, name: fullPool.name, tier: poolTierNormalized, isGeneric: isGeneric, tax: Number(fullPool.tax) || 0, cost: totalCost, cards: poolCards, items: (fullPool.items || []).map((i: any) => ({ id: i.id, type: i.type, card: i.card, skill: i.skill ? { ...i.skill, statRequirements: i.skill.statRequirements ? (typeof i.skill.statRequirements === 'string' ? JSON.parse(i.skill.statRequirements) : i.skill.statRequirements) : [] } : null, skillName: i.skillName, skillDescription: i.skillDescription, amount: i.amount })) }
        })

        const mergedSeen = Array.from(new Set([...(((shopInstance?.shopState as any)?.seen) || ((player.shopState as any)?.seen) || []), ...((poolOffers || []).map((o: any) => String(o.id)))]))
        const mergedSeenPools = Array.from(new Set([...(((shopInstance?.shopState as any)?.seenPools) || ((player as any)?.seenPools) || []), ...((poolOffers || []).map((o: any) => String(o.id)))]))
        // Persist offers but do not advance stage to LOOT; keep stage as-is so client won't enter loot
        const { updated } = await persistState({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { lootOffers: poolOffers, rerollsUsed: isReroll ? rerollsUsed + 1 : rerollsUsed, seen: mergedSeen, seenPools: mergedSeenPools }, playerShopState: shopInstance?.shopState || player.shopState })
        try { if (isReroll) await appendHistoryServer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'reroll', text: `Player rerolled ALL loot offers (${rerollsUsed + 1}/${maxRerolls})` }, playerShopState: shopInstance?.shopState || player.shopState }) } catch (e) {}
        try { await maybeInvalidate() } catch (e) {}
        const filteredPoolOffers = filterOutgoingOffers(poolOffers, updated || player)
        return res.status(200).json({ message: isReroll ? 'Loot rerolled' : 'Loot offers (not entering loot stage)', player: attachPlayerKey(updated), offers: filteredPoolOffers, rerollsUsed: isReroll ? rerollsUsed + 1 : rerollsUsed, maxRerolls })
      }

        case 'purchaseLootPool': {
          const { lootPoolId: reqLootPoolId, tier: reqTier, isGeneric: reqIsGeneric } = payload || {}
          // Bulk purchase by tier (tier + generic/class) if `tier` provided
          if (reqTier) {
            try {
              const tierKey = String(reqTier).toUpperCase()
              const isGenericBool = !!reqIsGeneric
              const currentLevel = computeLevel((player.xp || 0), settings.levelXpCurve) + 1

              const isRandomPurchase = !!(payload && (payload.random === true || payload.randomPurchase === true))
              if (isRandomPurchase) {
                // Random purchase: buy `desiredCount` pools of this tier (matching generic/class)
                // Charge only the configured base cost (no tax), and mark purchases/seen.
                try {
                  const tierKeyLower = tierKey
                  const desiredCount = (() => {
                    const t = tierKeyLower
                    if (isGenericBool) {
                      if (t === 'STARTER') return Number(settings.genericStarterCount || 0)
                      if (t === 'MID') return currentLevel >= (settings.genericMidMinLevel || 1) ? Number(settings.genericMidCount || 0) : 0
                      return currentLevel >= (settings.genericHighMinLevel || 1) ? Number(settings.genericHighCount || 0) : 0
                    } else {
                      if (t === 'STARTER') return Number(settings.classStarterCount || 0)
                      if (t === 'MID') return currentLevel >= (settings.classMidMinLevel || 1) ? Number(settings.classMidCount || 0) : 0
                      return currentLevel >= (settings.classHighMinLevel || 1) ? Number(settings.classHighCount || 0) : 0
                    }
                  })()

                  // Enforce tier unlock: if desiredCount is zero, tier is locked for this player
                  if (!desiredCount || Number(desiredCount) <= 0) return res.status(403).json({ error: 'Tier locked or not available at your level' })

                  // Build exclusion set from past purchases & inventory
                  const [allPurchasesEx, inventoryPoolsEx] = await Promise.all([
                    prisma.kDRShopInstance.findMany({ where: { playerId: player.id }, select: { shopState: true } }),
                    prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { ['lootPoolId' as any]: null } } as any), select: { ['lootPoolId' as any]: true } as any }) as Promise<any[]>
                  ])
                  const excluded = new Set<string>()
                  inventoryPoolsEx.forEach(i => { if ((i as any).lootPoolId) excluded.add(String((i as any).lootPoolId)) })
                  allPurchasesEx.forEach(inst => {
                    const s = inst.shopState as any
                    if (s && Array.isArray(s.purchases)) s.purchases.forEach((p: any) => { if (p.lootPoolId) excluded.add(String(p.lootPoolId)) })
                    if (s && Array.isArray(s.purchasedPools)) s.purchasedPools.forEach((pid: any) => { if (pid) excluded.add(String(pid)) })
                  })
                  // also exclude any purchasedPools persisted on the player (both shopState and DB-level)
                  try { if (Array.isArray((player as any)?.purchasedPools)) (player as any).purchasedPools.forEach((pid: any) => { if (pid) excluded.add(String(pid)) }) } catch (e) {}

                  // Candidate pools matching tier + generic/class filter
                  const classFilter = isGenericBool ? { classId: null } : { classId: player.classId }
                  const candidates = await prisma.lootPool.findMany({ where: { tier: tierKey, id: { notIn: Array.from(excluded) }, ...classFilter }, include: { items: { include: { card: true, skill: true } } } })
                  if (!candidates || candidates.length === 0) return res.status(400).json({ error: 'No pools available for random purchase' })

                  // Allow the client to request fewer than the configured `desiredCount`
                  // by passing `payload.count`. Otherwise buy the configured desiredCount.
                  const clientRequestedCount = payload && payload.count ? Number(payload.count) : null
                  const buyCount = clientRequestedCount && Number.isFinite(clientRequestedCount) && clientRequestedCount > 0
                    ? Math.min(Number(clientRequestedCount), Number(desiredCount || 0), candidates.length)
                    : Math.min(Number(desiredCount || 0), candidates.length)
                  const picks = sampleArray(candidates, Math.min(buyCount, candidates.length))

                  const result = await prisma.$transaction(async (tx) => {
                    const freshPlayer = await tx.kDRPlayer.findUnique({ where: { id: player.id }, include: { shopInstances: { where: { roundNumber: currentRoundNumberAtStart } } } }) as any
                    if (!freshPlayer) throw new Error('Player not found')

                    // determine single-base cost for tier (no tax)
                    let singleBaseCost = 0
                    if (isGenericBool) {
                      singleBaseCost = tierKey === 'STARTER' ? (settings.genericStarterCost || 0) : tierKey === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
                    } else {
                      singleBaseCost = tierKey === 'STARTER' ? (settings.classStarterCost || 0) : tierKey === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
                    }

                    const desired = picks.length
                    // Tier purchases charge a single tier cost regardless of how
                    // many pools are acquired in that purchase. Charge base cost
                    // once (per-tier), not per-pool.
                    const totalBaseCost = Number(singleBaseCost || 0)

                    const playerGoldNow = Number(freshPlayer.gold || 0)
                    if (playerGoldNow < totalBaseCost) throw new Error(`INSUFFICIENT_GOLD:${playerGoldNow}`)

                    let currentInst = freshPlayer.shopInstances?.[0]
                    if (!currentInst) {
                      const basePurchases = Array.isArray((freshPlayer.shopState as any)?.purchases) ? [...(freshPlayer.shopState as any).purchases] : []
                      const resetState = { chosenSkills: [], purchases: basePurchases, tipAmount: 0, lootOffers: [], pendingSkillChoices: [], statPoints: (freshPlayer.shopState as any)?.statPoints || 0, history: [], stage: 'START', stats: freshPlayer.stats || {}, shopAwarded: false }
                      currentInst = await tx.kDRShopInstance.create({ data: { playerId: player.id, roundNumber: currentRoundNumberAtStart, shopState: resetState, isComplete: false } })
                    }

                    const baseShopState = currentInst.shopState || {}
                    const txPurchases = Array.isArray(baseShopState.purchases) ? [...baseShopState.purchases] : []
                    const playerItemsToCreate: any[] = []
                    let totalGoldInc = 0

                    let first = true
                    for (const pick of picks) {
                      for (const item of ((pick as any).items || [])) {
                        const typ = (item.type || '').toString()
                        if (typ === 'Card' && item.card?.id) playerItemsToCreate.push({ userId: user.id, kdrId: kdr.id, kdrPlayerId: player.id, itemId: null, cardId: item.card.id, qty: 1, lootPoolId: pick.id })
                        else if (typ === 'Skill') {
                          const skillId = item.skillId || item.skill?.id || (item.skillName ? item.id : null)
                          if (skillId) playerItemsToCreate.push({ userId: user.id, skillId, itemId: null, kdrId: kdr.id, kdrPlayerId: player.id, qty: 1, lootPoolId: pick.id })
                        } else if (typ === 'Gold' || item.amount) totalGoldInc += Number(item.amount || 0)
                      }
                      // Record cost only on the first purchased pool so the sum of
                      // recorded costs matches the single charged tier cost.
                      const recordCost = first ? Number(singleBaseCost || 0) : 0
                      txPurchases.push({ lootPoolId: pick.id, qty: 1, cost: recordCost, bulk: true })
                      first = false
                    }

                    const freshPlayerOffers = Array.isArray(baseShopState.lootOffers) ? [...baseShopState.lootOffers] : []

                    // Remove any picked pools from offers first, then compute how many
                    // replacements we need for this category. This ensures displayed
                    // slots that were purchased are counted as empty and get refilled.
                    const updatedOffersBeforeRefill = freshPlayerOffers.filter((o: any) => !picks.some((pb: any) => String(pb.id) === String(o.id)))
                    // Refill offers up to desiredCount for the category if needed
                    let currentCategoryCount = updatedOffersBeforeRefill.filter((o: any) => ((o.tier || '').toUpperCase() === tierKey) && (!!o.isGeneric === !!isGenericBool)).length
                    let need = Math.max(0, Number(desiredCount || 0) - currentCategoryCount)
                    let refillPicks: any[] = []
                    if (need > 0) {
                      // Exclude any pools that are already present in the player's remaining offers
                      const remainingOfferIds = updatedOffersBeforeRefill.map((o: any) => String(o.id))
                      const pickedIds = (picks || []).map((p: any) => String(p.id))
                      const combinedExclusion = new Set<string>([...Array.from(excluded), ...remainingOfferIds, ...pickedIds])
                      const refillCandidates = await tx.lootPool.findMany({ where: { id: { notIn: Array.from(combinedExclusion) }, tier: tierKey, ...(isGenericBool ? { classId: null } : { classId: player.classId }) }, include: { items: { include: { card: true, skill: true } } } })
                      if (refillCandidates && refillCandidates.length > 0) {
                        const picks2 = sampleArray(refillCandidates, Math.min(need, refillCandidates.length))
                        refillPicks = picks2.map((pick: any) => {
                          const isPickGeneric = !pick.classId
                          const pickBaseCost = isPickGeneric ? (pick.tier === 'STARTER' ? (settings.genericStarterCost || 0) : pick.tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)) : (pick.tier === 'STARTER' ? (settings.classStarterCost || 0) : pick.tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0))
                          return {
                            id: pick.id,
                            name: pick.name,
                            tier: pick.tier,
                            isGeneric: isPickGeneric,
                            tax: pick.tax || 0,
                            cost: Number(pickBaseCost || 0) + Number(pick.tax || 0),
                            cards: (pick.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ id: i.card.id, name: i.card.name, imageUrlCropped: i.card.imageUrlCropped, artworks: i.card.artworks })),
                            items: (pick.items || []).map((i: any) => ({ id: i.id, type: i.type, card: { ...i.card, imageUrlCropped: i.card?.imageUrlCropped, artworks: i.card?.artworks }, skill: i.skill ? { ...i.skill, statRequirements: i.skill.statRequirements ? (typeof i.skill.statRequirements === 'string' ? JSON.parse(i.skill.statRequirements) : i.skill.statRequirements) : [] } : null, skillName: i.skillName, skillDescription: i.skillDescription, amount: i.amount }))
                          }
                        })
                      }
                    }

                    // Build finalOffers by replacing purchased slots in-place
                    const originalOffers = Array.isArray(baseShopState.lootOffers) ? [...baseShopState.lootOffers] : []
                    const picksQueue = Array.from(picks || [])
                    const refillQueue = Array.from(refillPicks || [])
                    let finalOffers = originalOffers.map((o: any) => {
                      if (picksQueue.some((pb: any) => String(pb.id) === String(o.id))) {
                        if (refillQueue.length > 0) return refillQueue.shift() as any
                        // No refill available for this slot; remove the purchased entry
                        return null
                      }
                      return o
                    }).filter((x: any) => x)
                    try { console.log('[SHOP-V2] randomPurchase replacement', { playerId: player.id, picks: picks.map((p:any)=>String(p.id)), refillCount: refillQueue.length, finalOffersCount: finalOffers.length }) } catch(e) {}

                    const mergedSeenFinal = Array.from(new Set([...(((baseShopState as any)?.seen) || []), ...((finalOffers || []).map((o: any) => String(o.id)))]))
                    const mergedSeenPoolsFinal = Array.from(new Set([...(((baseShopState as any)?.seenPools) || []), ...((finalOffers || []).map((o: any) => String(o.id)))]))
                    // Merge existing purchasedPools from instance/persisted state and append picks
                    const mergedPurchasedPoolsSet = new Set<string>()
                    ;((baseShopState as any)?.purchasedPools || []).forEach((pid: any) => { if (pid) mergedPurchasedPoolsSet.add(String(pid)) })
                    ;((freshPlayer as any)?.purchasedPools || []).forEach((pid: any) => { if (pid) mergedPurchasedPoolsSet.add(String(pid)) })
                    ;(picks || []).forEach((pk: any) => { if (pk && pk.id) mergedPurchasedPoolsSet.add(String(pk.id)) })
                    const mergedPurchasedPools = Array.from(mergedPurchasedPoolsSet)

                    if (playerItemsToCreate.length > 0) await tx.playerItem.createMany({ data: playerItemsToCreate })

                    // After random purchases, do not transition to LOOT; keep shop active or complete as appropriate
                    const updatedPlayer = await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { decrement: totalBaseCost - totalGoldInc }, shopState: { ...baseShopState, purchases: txPurchases, lootOffers: finalOffers, seen: mergedSeenFinal, seenPools: mergedSeenPoolsFinal, purchasedPools: mergedPurchasedPools, stage: 'LOOT' }, seenPools: mergedSeenPoolsFinal, purchasedPools: mergedPurchasedPools, shopComplete: false, lastShopRound: currentRoundNumberAtStart } })

                    await tx.kDRShopInstance.upsert({ where: { playerId_roundNumber: { playerId: player.id, roundNumber: currentRoundNumberAtStart } }, create: { playerId: player.id, roundNumber: currentRoundNumberAtStart, shopState: updatedPlayer.shopState, isComplete: false }, update: { shopState: updatedPlayer.shopState, isComplete: false } })

                    return attachPlayerKey(updatedPlayer)
                  }, { timeout: 10000 })

                  try {
                    const count = picks.length
                    const names = picks.map((p: any) => p.name || String(p.id || ''))
                    const tierLabel = isGenericBool ? (tierKey === 'STARTER' ? 'Staples' : tierKey === 'MID' ? 'Removal/Disruption' : 'Engine') : (tierKey === 'STARTER' ? 'Starter' : tierKey === 'MID' ? 'Mid' : 'High')
                    const text = `Player has randomly purchased ${count} ${tierLabel} Loot Pool${count === 1 ? '' : 's'} - ${names.map(n => `"${n}"`).join(', ')}`
                    try { await appendHistoryServer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'loot_purchase', text, tier: tierKey, isGeneric: isGenericBool, count, poolNames: names, poolIds: picks.map((p: any) => p.id) }, playerShopState: shopInstance?.shopState || player.shopState }) } catch (e) {}
                  } catch (e) {}

                  // Return purchased pool summaries so client can show a modal
                  const purchasedPools = (picks || []).map((p: any) => {
                    const poolCards = (p.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ id: i.card.id, name: i.card.name, imageUrlCropped: i.card.imageUrlCropped || null }))
                    return { id: p.id, name: p.name, tier: p.tier, isGeneric: !!p.classId ? false : true, cards: poolCards }
                  })

                  try { await maybeInvalidate() } catch (e) {}
                  return res.status(200).json({ message: 'Random quality purchased', player: result, purchasedPools })
                } catch (e: any) {
                  console.error('Random bulk purchase failed', e)
                  if (e.message?.startsWith('INSUFFICIENT_GOLD')) return res.status(400).json({ error: 'Insufficient funds' })
                  return res.status(500).json({ error: 'Internal server error' })
                }
              }

              // determine base cost
              let baseCost = 0
              if (isGenericBool) {
                baseCost = tierKey === 'STARTER' ? (settings.genericStarterCost || 0) : tierKey === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
              } else {
                baseCost = tierKey === 'STARTER' ? (settings.classStarterCost || 0) : tierKey === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
              }

              const currentState = (shopInstance?.shopState as any) || {}
              const currentOffers = Array.isArray(currentState.lootOffers) ? currentState.lootOffers : []
              const poolsToBuy = currentOffers.filter((o: any) => (o.tier || '').toUpperCase() === tierKey && !!o.isGeneric === isGenericBool)
              if (poolsToBuy.length === 0) return res.status(400).json({ error: 'No pools found for this quality' })

              // prefetch full pool data
              const fullPoolsData = await prisma.lootPool.findMany({ where: { id: { in: poolsToBuy.map((p: any) => p.id) } }, include: { items: { include: { card: true, skill: true } } } })

              // build exclusion set
              const updatedOffersBefore = currentOffers.filter((o: any) => !poolsToBuy.some((pb: any) => String(pb.id) === String(o.id)))
              const purchasedIds = new Set<string>()
              const purchasedArr = Array.from(purchasedIds)
              const excluded = new Set<string>()
              for (const o of updatedOffersBefore) if (o && o.id) excluded.add(String(o.id))
              for (const pb of (poolsToBuy || [])) if (pb && pb.id) excluded.add(String(pb.id))

              try { console.log('[SHOP-V2] bulk-quality debug PRE-EXCLUDE', { playerId: player.id, tier: tierKey, isGeneric: isGenericBool, poolsToBuy: poolsToBuy.map((p:any)=>String(p.id)), updatedOffersBeforeCount: updatedOffersBefore.length, updatedOffersBeforeIds: updatedOffersBefore.map((o:any)=>String(o.id)), excludedCount: excluded.size }) } catch(e) {}

              const [allPurchasesEx, inventoryPoolsEx] = await Promise.all([
                prisma.kDRShopInstance.findMany({ where: { playerId: player.id }, select: { shopState: true } }),
                prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { ['lootPoolId' as any]: null } } as any), select: { ['lootPoolId' as any]: true } as any })
              ])
              inventoryPoolsEx.forEach(i => { if ((i as any).lootPoolId) excluded.add(String((i as any).lootPoolId)) })
              allPurchasesEx.forEach(inst => {
                const s = inst.shopState as any
                if (s && Array.isArray(s.purchases)) s.purchases.forEach((p: any) => { if (p.lootPoolId) excluded.add(String(p.lootPoolId)) })
              })

              // Also include DB-level purchasedPools and seenPools as authoritative exclusions
              try { if (Array.isArray((player as any)?.purchasedPools)) (player as any).purchasedPools.forEach((pid: any) => { if (pid) excluded.add(String(pid)) }) } catch (e) {}

              try { console.log('[SHOP-V2] bulk-quality debug POST-EXCLUDE', { playerId: player.id, tier: tierKey, excludedCount: excluded.size }) } catch(e) {}

              const refillCandidates = await prisma.lootPool.findMany({ where: { id: { notIn: Array.from(excluded) }, tier: tierKey, ...(isGenericBool ? { classId: null } : { classId: player.classId }) }, include: { items: { include: { card: true, skill: true } } } })

              try { console.log('[SHOP-V2] bulk-quality candidates', { playerId: player.id, tier: tierKey, refillCandidatesCount: refillCandidates.length, refillCandidatesIds: refillCandidates.map((r:any)=>String(r.id)) }) } catch(e) {}

              const result = await prisma.$transaction(async (tx) => {
                const freshPlayer = await tx.kDRPlayer.findUnique({ where: { id: player.id }, include: { shopInstances: { where: { roundNumber: currentRoundNumberAtStart } } } }) as any
                if (!freshPlayer) throw new Error('Player not found')
                const playerGoldNow = Number(freshPlayer.gold || 0)
                if (playerGoldNow < baseCost) throw new Error(`INSUFFICIENT_GOLD:${playerGoldNow}`)

                let currentInst = freshPlayer.shopInstances?.[0]
                if (!currentInst) {
                  const basePurchases = Array.isArray((freshPlayer.shopState as any)?.purchases) ? [...(freshPlayer.shopState as any).purchases] : []
                  const resetState = { chosenSkills: [], purchases: basePurchases, tipAmount: 0, lootOffers: [], pendingSkillChoices: [], statPoints: (freshPlayer.shopState as any)?.statPoints || 0, history: [], stage: 'START', stats: freshPlayer.stats || {}, shopAwarded: false }
                  currentInst = await tx.kDRShopInstance.create({ data: { playerId: player.id, roundNumber: currentRoundNumberAtStart, shopState: resetState, isComplete: false } })
                }

                const baseShopState = currentInst.shopState || {}
                const playerItemsToCreate: any[] = []
                const txPurchases = Array.isArray(baseShopState.purchases) ? [...baseShopState.purchases] : []
                let totalGoldInc = 0

                for (const fullPool of fullPoolsData) {
                  if (txPurchases.some((p: any) => String(p.lootPoolId) === String(fullPool.id))) continue
                  for (const item of ((fullPool as any).items || [])) {
                    const typ = (item.type || '').toString()
                    if (typ === 'Card' && item.card?.id) playerItemsToCreate.push({ userId: user.id, kdrId: kdr.id, kdrPlayerId: player.id, itemId: null, cardId: item.card.id, qty: 1, lootPoolId: fullPool.id })
                    else if (typ === 'Skill') {
                      const skillId = item.skillId || item.skill?.id || (item.skillName ? item.id : null)
                      if (skillId) playerItemsToCreate.push({ userId: user.id, skillId, itemId: null, kdrId: kdr.id, kdrPlayerId: player.id, qty: 1, lootPoolId: fullPool.id })
                    } else if (typ === 'Gold' || item.amount) totalGoldInc += Number(item.amount || 0)
                  }
                  txPurchases.push({ lootPoolId: fullPool.id, qty: 1, cost: 0, bulk: true })
                }

                const freshPlayerOffers = Array.isArray(baseShopState.lootOffers) ? [...baseShopState.lootOffers] : []
                const originalOffers = Array.isArray(baseShopState.lootOffers) ? [...baseShopState.lootOffers] : []

                const tierKeyLower = (tierKey || 'STARTER').toUpperCase()
                const desiredCount = (() => {
                  const t = tierKeyLower
                  if (isGenericBool) {
                    if (t === 'STARTER') return Number(settings.genericStarterCount || 0)
                    if (t === 'MID') return currentLevel >= (settings.genericMidMinLevel || 1) ? Number(settings.genericMidCount || 0) : 0
                    return currentLevel >= (settings.genericHighMinLevel || 1) ? Number(settings.genericHighCount || 0) : 0
                  } else {
                    if (t === 'STARTER') return Number(settings.classStarterCount || 0)
                    if (t === 'MID') return currentLevel >= (settings.classMidMinLevel || 1) ? Number(settings.classMidCount || 0) : 0
                    return currentLevel >= (settings.classHighMinLevel || 1) ? Number(settings.classHighCount || 0) : 0
                  }
                })()
                if (!desiredCount || Number(desiredCount) <= 0) return res.status(403).json({ error: 'Tier locked or not available at your level' })
                // Count current category slots after removing the pools that were just purchased
                let currentCategoryCount = updatedOffersBefore.filter((o: any) => ((o.tier || '').toUpperCase() === tierKeyLower) && (!!o.isGeneric === !!isGenericBool)).length
                let need = Math.max(0, Number(desiredCount || 0) - currentCategoryCount)

                // Collect refill picks (as mapped offers) if needed
                let refillPicks: any[] = []
                if (need > 0 && refillCandidates?.length > 0) {
                  const picks = sampleArray(refillCandidates, Math.min(need, refillCandidates.length))
                  refillPicks = picks.map((pick: any) => {
                    const isPickGeneric = !pick.classId
                    const pickBaseCost = isPickGeneric ? (pick.tier === 'STARTER' ? (settings.genericStarterCost || 0) : pick.tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)) : (pick.tier === 'STARTER' ? (settings.classStarterCost || 0) : pick.tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0))
                    return {
                      id: pick.id,
                      name: pick.name,
                      tier: pick.tier,
                      isGeneric: isPickGeneric,
                      tax: pick.tax || 0,
                      cost: Number(pickBaseCost || 0) + Number(pick.tax || 0),
                      cards: (pick.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ id: i.card.id, name: i.card.name, imageUrlCropped: i.card.imageUrlCropped, artworks: i.card.artworks })),
                      items: (pick.items || []).map((i: any) => ({ id: i.id, type: i.type, card: { ...i.card, imageUrlCropped: i.card?.imageUrlCropped, artworks: i.card?.artworks }, skill: i.skill ? { ...i.skill, statRequirements: i.skill.statRequirements ? (typeof i.skill.statRequirements === 'string' ? JSON.parse(i.skill.statRequirements) : i.skill.statRequirements) : [] } : null, skillName: i.skillName, skillDescription: i.skillDescription, amount: i.amount }))
                    }
                  })
                }

                // Build finalOffers by replacing purchased slots in-place for this category
                const purchasedSet = new Set((poolsToBuy || []).map((p: any) => String(p.id)))
                const refillQueue = Array.from(refillPicks || [])
                const finalOffers = originalOffers.map((o: any) => {
                  if (((o.tier || '').toUpperCase() === tierKeyLower) && (!!o.isGeneric === !!isGenericBool) && purchasedSet.has(String(o.id))) {
                    return refillQueue.length ? refillQueue.shift() as any : null
                  }
                  return o
                }).filter((x: any) => x)

                const mergedSeenFinal = Array.from(new Set([...(((baseShopState as any)?.seen) || []), ...((finalOffers || []).map((o: any) => String(o.id)))]))

                // Ensure we remain in LOOT stage after purchase to keep client UI stable
                const isComplete = false

                if (playerItemsToCreate.length > 0) await tx.playerItem.createMany({ data: playerItemsToCreate })

                try { console.log('[SHOP-V2] bulk-quality finalOffers', { playerId: player.id, finalCount: (finalOffers||[]).length, byTier: (finalOffers||[]).reduce((acc:any,o:any)=>{ const t=(o.tier||'STARTER').toUpperCase(); const b=o.isGeneric?'generic':'class'; acc[b]=acc[b]||{}; acc[b][t]=(acc[b][t]||0)+1; return acc }, {}) }) } catch(e) {}
                // After bulk-quality purchase, avoid setting stage to LOOT
                // Merge purchasedPools and append newly purchased pool ids
                const mergedPurchasedPoolsSet2 = new Set<string>()
                ;((baseShopState as any)?.purchasedPools || []).forEach((pid: any) => { if (pid) mergedPurchasedPoolsSet2.add(String(pid)) })
                ;((freshPlayer as any)?.purchasedPools || []).forEach((pid: any) => { if (pid) mergedPurchasedPoolsSet2.add(String(pid)) })
                ;((poolsToBuy || []).map((p: any) => p.id) || []).forEach((pid: any) => { if (pid) mergedPurchasedPoolsSet2.add(String(pid)) })
                const mergedPurchasedPools2 = Array.from(mergedPurchasedPoolsSet2)
                const updatedPlayer = await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { decrement: baseCost - totalGoldInc }, shopState: { ...baseShopState, purchases: txPurchases, lootOffers: finalOffers, seen: mergedSeenFinal, purchasedPools: mergedPurchasedPools2, stage: 'LOOT' }, seenPools: mergedSeenFinal, purchasedPools: mergedPurchasedPools2, shopComplete: isComplete, lastShopRound: currentRoundNumberAtStart } })

                await tx.kDRShopInstance.upsert({ where: { playerId_roundNumber: { playerId: player.id, roundNumber: currentRoundNumberAtStart } }, create: { playerId: player.id, roundNumber: currentRoundNumberAtStart, shopState: updatedPlayer.shopState, isComplete }, update: { shopState: updatedPlayer.shopState, isComplete } })

                return attachPlayerKey(updatedPlayer)
              }, { timeout: 10000 })

              try {
                // Append history entry for bulk quality purchase
                const count = (poolsToBuy || []).length
                const names = (poolsToBuy || []).map((p: any) => p.name || String(p.id || ''))
                const getTierLabel = (tier: string, isGen: boolean) => {
                  const t = (tier || '').toUpperCase()
                  if (isGen) {
                    const genericLabels: Record<string, string> = { 'STARTER': 'Staples', 'MID': 'Removal/Disruption', 'HIGH': 'Engine' }
                    return genericLabels[t] || t
                  } else {
                    const classLabels: Record<string, string> = { 'STARTER': 'Starter', 'MID': 'Mid', 'HIGH': 'High' }
                    return classLabels[t] || t
                  }
                }
                const tierLabel = getTierLabel(tierKey, isGenericBool)
                const text = `Player has purchased ${count} ${tierLabel} Loot Pool${count === 1 ? '' : 's'} - ${names.map(n => `"${n}"`).join(', ')}`
                try {
                  const appendRes = await appendHistoryServer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'loot_purchase', text, tier: tierKey, isGeneric: isGenericBool, count, poolNames: names, poolIds: poolsToBuy.map((p: any) => p.id) }, playerShopState: shopInstance?.shopState || player.shopState })
                  if (appendRes && appendRes.updated) { try { await maybeInvalidate() } catch (e) {} ; return res.status(200).json({ message: 'Quality purchased', player: attachPlayerKey(appendRes.updated) }) }
                } catch (e) {}
              } catch (e) {}
              try { await maybeInvalidate() } catch (e) {}
              return res.status(200).json({ message: 'Quality purchased', player: result })
            } catch (e: any) {
              console.error('Bulk purchase failed', e)
              if (e.message?.startsWith('INSUFFICIENT_GOLD')) return res.status(400).json({ error: 'Insufficient funds' })
              return res.status(500).json({ error: 'Internal server error' })
            }
          }

          // Single pool purchase
          if (!reqLootPoolId || typeof reqLootPoolId !== 'string') return res.status(400).json({ error: 'Missing lootPoolId' })
          const pool = await prisma.lootPool.findUnique({ where: { id: reqLootPoolId }, include: { items: { include: { card: true } } } }) as any
          if (!pool) return res.status(404).json({ error: 'Loot pool not found' })

          const tier = (pool.tier || 'STARTER').toUpperCase()
          const isGeneric = !pool.classId
          let baseCost = 0
          if (isGeneric) baseCost = tier === 'STARTER' ? (settings.genericStarterCost || 0) : tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)
          else baseCost = tier === 'STARTER' ? (settings.classStarterCost || 0) : tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0)
          const totalCost = Number(baseCost || 0) + Number(pool.tax || 0)

          const [allPurchasesForExclusion, inventoryPools] = await Promise.all([
            prisma.kDRShopInstance.findMany({ where: { playerId: player.id }, select: { shopState: true } }),
            prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: player.id }, { userId: user.id, kdrId: kdr.id } ], NOT: { ['lootPoolId' as any]: null } } as any), select: { ['lootPoolId' as any]: true } as any }) as Promise<any[]>
          ])

          const purchasedPoolIds = new Set<string>()
          inventoryPools.forEach(i => { if ((i as any).lootPoolId) purchasedPoolIds.add(String((i as any).lootPoolId)) })
          allPurchasesForExclusion.forEach(inst => { const state = inst.shopState as any; if (state && Array.isArray(state.purchases)) state.purchases.forEach((p: any) => { const poolId = p.lootPoolId || p.poolId; if (poolId) purchasedPoolIds.add(String(poolId)) }); if (state && Array.isArray(state.purchasedPools)) state.purchasedPools.forEach((pid:any)=>{ if (pid) purchasedPoolIds.add(String(pid)) }) })
          try { if (Array.isArray((player as any)?.purchasedPools)) (player as any).purchasedPools.forEach((pid:any)=>{ if (pid) purchasedPoolIds.add(String(pid)) }) } catch (e) {}

          try {
            const result = await prisma.$transaction(async (tx) => {
              const freshPlayer = await tx.kDRPlayer.findUnique({ where: { id: player.id } })
              const playerGoldNow = Number(freshPlayer?.gold || 0)
              if (playerGoldNow < Number(totalCost || 0)) throw new Error(`INSUFFICIENT_GOLD:${playerGoldNow}`)
              await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { decrement: totalCost } } })

              for (const item of (pool.items || [])) {
                const typ = (item.type || '').toString()
                if (typ === 'Card' && item.card && item.card.id) await (tx.playerItem as any).create({ data: { userId: user.id, kdrId: kdr.id, itemId: null, cardId: item.card.id, qty: 1, lootPoolId: pool.id } })
                else if (typ === 'Skill') {
                  const skillId = item.skillId || item.skill?.id || null
                  if (skillId) { try { await (tx.playerItem as any).create({ data: { userId: user.id, skillId, kdrId: kdr.id, qty: 1, lootPoolId: pool.id } }) } catch (e) {} }
                  else if (item.skillName) await (tx.playerItem as any).create({ data: { userId: user.id, kdrId: kdr.id, itemId: null, qty: 1, lootPoolId: pool.id } })
                } else if (typ === 'Gold' || item.amount) {
                  const amt = Number(item.amount || 0)
                  if (amt > 0) await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: amt } } })
                } else {
                  await (tx.playerItem as any).create({ data: { userId: user.id, kdrId: kdr.id, itemId: null, qty: 1, lootPoolId: pool.id } })
                }
              }

              const fresh = await tx.kDRPlayer.findUnique({ where: { id: player.id } })
              const currentState = (fresh?.shopState as any) || {}
              const purchases = Array.isArray(currentState.purchases) ? [...currentState.purchases] : []
              purchases.push({ lootPoolId: pool.id, qty: 1, cost: totalCost })
              const existingOffers = Array.isArray(currentState.lootOffers) ? [...currentState.lootOffers] : []
              let updatedOffers = existingOffers.filter((o: any) => String(o.id) !== String(pool.id))

              const tierKey2 = (tier || 'STARTER').toUpperCase()
              const desiredCount2 = isGeneric ? (tierKey2 === 'STARTER' ? (settings.genericStarterCount || 0) : tierKey2 === 'MID' ? (settings.genericMidCount || 0) : (settings.genericHighCount || 0)) : (tierKey2 === 'STARTER' ? (settings.classStarterCount || 0) : tierKey2 === 'MID' ? (settings.classMidCount || 0) : (settings.classHighCount || 0))
              const currentCategoryCount2 = updatedOffers.filter((o: any) => ((o.tier || '').toUpperCase() === tierKey2) && (!!o.isGeneric === !!isGeneric)).length
              let need2 = Math.max(0, Number(desiredCount2 || 0) - currentCategoryCount2)

              if (need2 > 0) {
                const purchasedIdsSet = new Set<string>((purchases || []).map((p: any) => String(p.lootPoolId)))
                const excluded2 = new Set<string>()
                for (const id of Array.from(purchasedIdsSet)) excluded2.add(String(id))
                for (const o of updatedOffers) if (o && o.id) excluded2.add(String(o.id))
                excluded2.add(String(pool.id))

                // Also exclude DB-level purchasedPools
                try { if (Array.isArray((player as any)?.purchasedPools)) (player as any).purchasedPools.forEach((pid: any) => { if (pid) excluded2.add(String(pid)) }) } catch (e) {}

                const candidates = await tx.lootPool.findMany({ where: { id: { notIn: Array.from(excluded2) }, tier: tierKey2, ...(isGeneric ? { classId: null } : { classId: player.classId }) }, include: { items: { include: { card: true, skill: true } } } })

                if (candidates && candidates.length > 0) {
                  const picks = sampleArray(candidates, Math.min(need2, candidates.length))
                  for (const pick of picks) {
                    const poolCards = (pick.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({ id: i.card.id, name: i.card.name, konamiId: i.card.konamiId || null, imageUrlCropped: i.card.imageUrlCropped, artworks: i.card.artworks }))
                    const isPickGeneric = !pick.classId
                    if (purchasedPoolIds.has(String(pick.id))) continue
                    const pickBaseCost = isPickGeneric ? (pick.tier === 'STARTER' ? (settings.genericStarterCost || 0) : pick.tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0)) : (pick.tier === 'STARTER' ? (settings.classStarterCost || 0) : pick.tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCost || 0))
                    const pickTotalCost = Number(pickBaseCost || 0) + Number(pick.tax || 0)
                    const mapped = { id: pick.id, name: pick.name, tier: pick.tier, isGeneric: isPickGeneric, tax: pick.tax || 0, cost: pickTotalCost, cards: poolCards, items: (pick.items || []).map((i: any) => ({ id: i.id, type: i.type, card: { ...i.card, imageUrlCropped: i.card?.imageUrlCropped, artworks: i.card?.artworks }, skillName: i.skillName, skillDescription: i.skillDescription, amount: i.amount })) }
                    updatedOffers.push(mapped)
                    excluded2.add(String(pick.id))
                    need2--
                    if (need2 <= 0) break
                  }
                }
              }

              const mergedSeenAfterPurchase = Array.from(new Set([...(((currentState as any)?.seen) || []), ...((updatedOffers || []).map((o: any) => String(o.id)))]))
              const existingPurchasedPools = Array.isArray(currentState.purchasedPools) ? [...currentState.purchasedPools] : []
              if (!existingPurchasedPools.includes(String(pool.id))) existingPurchasedPools.push(String(pool.id))

              // Merge updatedOffers into the existing currentState offers for
              // this category (tierKey2 + isGeneric) to avoid altering other
              // qualities shown to the player.
              const originalOffersCur = Array.isArray(currentState.lootOffers) ? [...currentState.lootOffers] : []
              const catKey = (tierKey2 || 'STARTER').toUpperCase()
              const catIsGeneric = !!isGeneric
              const filteredOrigCur = originalOffersCur
              const newCatOffers = (updatedOffers || []).filter((o: any) => ((o.tier || '').toUpperCase() === catKey) && (!!o.isGeneric === catIsGeneric))
              const newCatQueue = Array.from(newCatOffers || [])
              const finalOffersCur = filteredOrigCur.map((o: any) => {
                if (((o.tier || '').toUpperCase() === catKey) && (!!o.isGeneric === catIsGeneric) && purchasedPoolIds.has(String(o.id))) {
                  return newCatQueue.length ? newCatQueue.shift() as any : null
                }
                return o
              }).filter((x: any) => x)

              try { console.log('[SHOP-V2] single-pool finalOffersCur', { playerId: player.id, finalCount: (finalOffersCur||[]).length, byTier: (finalOffersCur||[]).reduce((acc:any,o:any)=>{ const t=(o.tier||'STARTER').toUpperCase(); const b=o.isGeneric?'generic':'class'; acc[b]=acc[b]||{}; acc[b][t]=(acc[b][t]||0)+1; return acc }, {}) }) } catch(e) {}
              // Single-pool purchase: update offers but do not advance to LOOT
              const { updated: finalPlayer } = await persistState({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { purchases: [...purchases, { lootPoolId: pool.id, qty: 1, cost: totalCost }], lootOffers: finalOffersCur, stage: 'LOOT', seen: mergedSeenAfterPurchase, purchasedPools: existingPurchasedPools }, playerShopState: currentState })

              return { updatedPlayer: finalPlayer }
            })
            try {
              // Append history entry for single pool purchase
              const names = [pool.name || String(pool.id || '')]
              const getTierLabel = (tier: string, isGen: boolean) => {
                const t = (tier || '').toUpperCase()
                if (isGen) {
                  const genericLabels: Record<string, string> = { 'STARTER': 'Staples', 'MID': 'Removal/Disruption', 'HIGH': 'Engine' }
                  return genericLabels[t] || t
                } else {
                  const classLabels: Record<string, string> = { 'STARTER': 'Starter', 'MID': 'Mid', 'HIGH': 'High' }
                  return classLabels[t] || t
                }
              }
              const tierLabel = getTierLabel(tier, isGeneric)
              const text = `Player has purchased 1 ${tierLabel} Loot Pool - ${names.map(n => `"${n}"`).join(', ')}`
              try {
                const appendRes = await appendHistoryServer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'loot_purchase', text, tier, isGeneric, count: 1, poolNames: names, poolIds: [pool.id] }, playerShopState: shopInstance?.shopState || player.shopState })
                if (appendRes && appendRes.updated) { try { await maybeInvalidate() } catch (e) {} ; return res.status(200).json({ message: 'Pool purchased', player: attachPlayerKey(appendRes.updated) }) }
              } catch (e) {}
            } catch (e) {}
            try { await maybeInvalidate() } catch (e) {}
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

        case 'finish': {
          // Mark the player's shop instance as finished for this round, and apply per-format "interest" if configured.
          try {
            const { updated, shopState: finalState } = await persistStateForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, partial: { stage: 'DONE' }, playerShopState: shopInstance?.shopState || player.shopState })

            // Determine interest settings (support both new object shape and legacy flat keys)
            const interestCfg = (settings && settings.interest) ? settings.interest : null
            const requirement = Number((interestCfg && interestCfg.requirement) ?? settings.interestRequirement ?? 0)
            const per = Number((interestCfg && interestCfg.per) ?? settings.interestPer ?? 0)

            // Only award interest once per shop instance. Use a flag on the persisted state to guard.
            let interestAwarded = Boolean((finalState && finalState.interestAwarded) || (finalState && finalState.shopInterestAwarded))
            let awardedAmount = 0

            if (!interestAwarded && requirement > 0 && per > 0) {
              // Fetch fresh player row to get authoritative gold amount
              const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
              const playerGoldNow = Number(fresh?.gold || 0)
              const times = Math.floor(playerGoldNow / requirement)
              if (times > 0) {
                awardedAmount = times * per
                try {
                  // Atomically increment player gold and mark interest awarded on the instance/state
                  const txRes = await prisma.$transaction(async (tx) => {
                    const updatedPlayer = await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: awardedAmount } } })
                    // mark the shop instance/state with interestAwarded and amount
                    const inst = await tx.kDRShopInstance.upsert({
                      where: { playerId_roundNumber: { playerId: player.id, roundNumber: currentRoundNumberAtStart } },
                      create: { playerId: player.id, roundNumber: currentRoundNumberAtStart, shopState: { ...(finalState || {}), interestAwarded: true, interestAmount: awardedAmount }, isComplete: true },
                      update: { shopState: { ...(finalState || {}), interestAwarded: true, interestAmount: awardedAmount }, isComplete: true }
                    })
                    // also persist the shopState onto the player row for convenience
                    const finalPlayer = await tx.kDRPlayer.update({ where: { id: player.id }, data: { shopComplete: true, lastShopRound: currentRoundNumberAtStart, shopState: { ...(finalState || {}), interestAwarded: true, interestAmount: awardedAmount } }, include: { shopInstances: { where: { roundNumber: currentRoundNumberAtStart } } } })
                    return { updatedPlayer: finalPlayer, inst }
                  }, { timeout: 10000 })
                  // append a history entry to record the interest award
                  try { await appendHistoryForPlayer({ playerId: player.id, roundNumber: currentRoundNumberAtStart, entry: { type: 'interest', text: `Interest awarded: +${awardedAmount} gold`, gold: awardedAmount }, playerShopState: finalState }) } catch (e) {}
                  console.log(`[SHOP:TRACE] finish: applied interest ${awardedAmount} to player ${player.id} for round ${currentRoundNumberAtStart}`)
                  try { await maybeInvalidate() } catch (e) {}
                  return res.status(200).json({ message: 'Shop finished', player: attachPlayerKey(txRes.updatedPlayer, txRes.inst) })
                } catch (e: any) {
                  console.error('Failed to apply interest award', e)
                  // fallback to marking finished without interest
                }
              }
            }

            // If no interest awarded or a failure occurred applying it, still mark instance/player complete
            try {
              const updatedInst = await prisma.kDRShopInstance.upsert({
                where: { playerId_roundNumber: { playerId: player.id, roundNumber: currentRoundNumberAtStart } },
                create: { playerId: player.id, roundNumber: currentRoundNumberAtStart, shopState: finalState, isComplete: true },
                update: { shopState: finalState, isComplete: true }
              })

              const final = await prisma.kDRPlayer.update({
                where: { id: player.id },
                data: { shopComplete: true, lastShopRound: currentRoundNumberAtStart, shopState: finalState },
                include: { shopInstances: { where: { roundNumber: currentRoundNumberAtStart } } }
              })
              console.log(`[SHOP:TRACE] finish: Player finished round ${currentRoundNumberAtStart}. interestAwarded=${interestAwarded} amount=${awardedAmount}`)
              try { await maybeInvalidate() } catch (e) {}
              return res.status(200).json({ message: 'Shop finished', player: attachPlayerKey(final, updatedInst) })
            } catch (e: any) {
              console.error('Failed to finish shop-v2', e)
              return res.status(500).json({ error: 'Failed to finish' })
            }
          } catch (e: any) {
            console.error('Failed to finish shop-v2', e)
            return res.status(500).json({ error: 'Failed to finish' })
          }
        }

        case 'getPlayerSkills': {
        try {
          // Fetch playerItem rows that represent skills and inventory cards for this user
          // For inventory, we limit to the current KDR.
          // Prefer per-KDRPlayer-scoped rows (kdrPlayerId). Fall back to userId+kdrId if migration not yet applied.
          // Fetch playerItem rows for skills and inventory. Prefer rows explicitly tied
          // to the KDR player via `kdrPlayerId`, but always include legacy rows
          // scoped by `userId + kdrId` to handle partially-backfilled data.
          const playerSkillRows = await prisma.playerItem.findMany({
            where: ({ OR: [ { kdrPlayerId: player.id }, { AND: [ { userId: user.id }, { kdrId: kdr.id } ] } ], NOT: { skillId: null } } as any)
          })

          const playerLootRows = await prisma.playerItem.findMany({
            where: ({ AND: [ { OR: [ { kdrPlayerId: player.id }, { AND: [ { userId: user.id }, { kdrId: kdr.id } ] } ] }, { OR: [{ NOT: { cardId: null } }, { NOT: { itemId: null } }] } ] } as any)
          })

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
          skillRows.forEach(s => { if (s && s.id) skillById[s.id] = s });

          // Build a deduped skills map from playerItem rows that reference skills
          // Prefer explicit playerSkillRows (all playerItem rows with skillId),
          // and include any inventory playerLootRows that reference a skill as fallback.
          const skillsMap: Record<string, any> = {};

          // Primary source: playerSkillRows (all playerItem rows that have skillId)
          ;(playerSkillRows || []).forEach((pl: any) => {
            if (!pl || !pl.skillId) return
            const sid = pl.skillId
            const base = skillById[sid] || null
            const isBaseSellable = base ? (base.isSellable !== false) : true
            const isCore = classSkillIds && classSkillIds.indexOf(sid) !== -1
            const isSellable = isBaseSellable && !isCore
            const playerSkillId = pl.id
            skillsMap[sid] = { ...(skillsMap[sid] || {}), ...(base || {}), id: base?.id || sid, name: base?.name || pl.skillName || 'Skill', playerSkillId, _source: 'PLAYER_ITEM', isSellable }
          })

          // Secondary: inventory rows in this KDR that reference skills (playerLootRows)
          ;(playerLootRows || []).forEach((pl: any) => {
            if (!pl || !pl.skillId) return
            const sid = pl.skillId
            if (skillsMap[sid]) return // already accounted for
            const base = skillById[sid] || null
            const isBaseSellable = base ? (base.isSellable !== false) : true
            const isCore = classSkillIds && classSkillIds.indexOf(sid) !== -1
            const isSellable = isBaseSellable && !isCore
            skillsMap[sid] = { ...(skillsMap[sid] || {}), ...(base || {}), id: base?.id || sid, name: base?.name || pl.skillName || 'Skill', playerItemId: pl.id, _source: 'INVENTORY', isSellable }
          })

          // Build inventory/treasures list for player's playerItem rows
          const itemIds = Array.from(new Set((playerLootRows || []).map((pl: any) => pl.itemId).filter(Boolean)))
          const cardIds = Array.from(new Set((playerLootRows || []).map((pl: any) => pl.cardId).filter(Boolean)))
          const lootItemIds = Array.from(new Set((playerLootRows || []).map((pl: any) => pl.lootItemId).filter(Boolean)))

          const [items, cards, lootItems] = await Promise.all([
            itemIds.length ? prisma.item.findMany({ where: { id: { in: itemIds } } }) : [],
            cardIds.length ? prisma.card.findMany({ where: { id: { in: cardIds } } }) : [],
            lootItemIds.length ? prisma.lootItem.findMany({ where: { id: { in: lootItemIds } } }) : []
          ])
          const itemById = Object.fromEntries((items || []).map((it: any) => [it.id, it]))
          const cardById = Object.fromEntries((cards || []).map((c: any) => [c.id, c]))
          const lootById = Object.fromEntries((lootItems || []).map((l: any) => [l.id, l]))

          const detailedInventory = (playerLootRows || []).map((pl: any) => {
            const skill = pl.skillId ? (skillById[pl.skillId] || null) : null
            const item = pl.itemId ? (itemById[pl.itemId] || null) : null
            const card = pl.cardId ? (cardById[pl.cardId] || null) : null
            const loot = pl.lootItemId ? (lootById[pl.lootItemId] || null) : null
            const lootNameStr = pl.name || (card ? card.name : (skill ? skill.name : (loot ? loot.name : '')))
            return {
              ...pl,
              card,
              skill: skill ? { ...skill, isSellable: skill.isSellable } : null,
              name: lootNameStr,
              type: card ? (card.type || 'Card') : skill ? 'Skill' : (loot?.type || 'Loot Item'),
              isSellable: !!(pl.itemId || (skill && skill.isSellable)),
              isTreasure: !!(pl.itemId && itemById[pl.itemId] && String(itemById[pl.itemId].type || '').toUpperCase() === 'TREASURE')
            }
          })

          // Split out treasures (explicit Item.type === TREASURE) from the general inventory
          const treasures = detailedInventory.filter((pl: any) => !!pl.isTreasure)
          const inventory = detailedInventory.filter((pl: any) => !pl.isTreasure)

          const finalSkills = Object.values(skillsMap).filter((s: any) => s && s.isSellable)
          try { console.log('[DBG] getPlayerSkills', { playerId: player.id, playerSkillRows: (playerSkillRows || []).length, playerLootRows: (playerLootRows || []).length, allSkillIds: allSkillIds.length, finalSkills: finalSkills.length }) } catch (e) {}
          // Include lightweight debug info to help front-end troubleshooting (temporary)
          const debug = {
            playerSkillRows: (playerSkillRows || []).length,
            playerLootRows: (playerLootRows || []).length,
            allSkillIds: allSkillIds.length,
            returnedSkillIds: finalSkills.map((s: any) => s.id).slice(0, 20)
          }
          return res.status(200).json({ playerSkills: finalSkills, inventory, treasures, debug })
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
              where: ({ id: sellId, OR: [ { kdrPlayerId: player.id }, { AND: [ { userId: user.id }, { kdrId: kdr.id } ] } ] } as any)
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
            try { await maybeInvalidate() } catch (e) {}
            return res.status(200).json({ message: 'Item sold', player: attachPlayerKey(fresh) })
          }

          if (type === 'lootItem') {
            // Sell by lootItemId (used when client only has purchase placeholders)
            // or by itemId (for TREASUREs which are Item model instances)
            
            // First check if it's a TREASURE (Item model instance)
            const item = await prisma.item.findUnique({ 
              where: { id: sellId }
            })
            console.log('[DBG] sellItem: lootItem payload', { sellId, itemFound: !!item, itemType: item?.type, playerId: player.id, userId: user.id, kdrId: kdr.id })

            const goldGainTreasure = 1 // Corrected: All items sell for 1 gold

            if (item && String(item.type || '').toUpperCase() === 'TREASURE') {
              // It's a treasure. Find corresponding playerItem.
              const foundPl = await prisma.playerItem.findFirst({ 
                where: ({ OR: [ { kdrPlayerId: player.id, itemId: item.id }, { AND: [ { userId: user.id }, { kdrId: kdr.id }, { itemId: item.id } ] } ] } as any)
              })
              console.log('[DBG] sellItem: lootItem playerItem lookup', { sellId, itemId: item.id, foundPl: !!foundPl, foundPlId: foundPl?.id })
              if (!foundPl) {
                // Log any playerItem rows referencing this item for further diagnosis
                try {
                  const candidates = await prisma.playerItem.findMany({ where: { itemId: item.id } })
                  console.log('[DBG] sellItem: lootItem candidate playerItems for itemId', { itemId: item.id, candidatesCount: (candidates || []).length, candidateIds: (candidates || []).map(c => c.id) })
                } catch (e) {}
                return res.status(404).json({ error: 'Treasure not found in your inventory' })
              }
              
              await prisma.$transaction(async (tx) => {
                const check = await tx.playerItem.findUnique({ where: { id: foundPl.id } })
                if (!check) throw new Error('ALREADY_SOLD')

                await tx.playerItem.delete({ where: { id: foundPl.id } })
                
                // FIX: Remove from shopState.purchases if it's there, to ensure immediate UI removal in the modal
                const currentPurchases = Array.isArray(shopState.purchases) ? [...shopState.purchases] : []
                const newPurchases = currentPurchases.filter((p: any) => p.itemId !== item.id && p.id !== item.id)
                const newState = { ...shopState, purchases: newPurchases }
                
                await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: goldGainTreasure }, shopState: newState } })
              })
              const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
              try { await maybeInvalidate() } catch (e) {}
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
              where: ({ OR: [ { kdrPlayerId: player.id, OR: [{ cardId: loot.cardId || undefined }, { skillId: loot.skillId || undefined }] }, { AND: [ { userId: user.id }, { kdrId: kdr.id }, { OR: [{ cardId: loot.cardId || undefined }, { skillId: loot.skillId || undefined }] } ] } ] } as any)
            })
            if (!pl) return res.status(404).json({ error: 'Inventory item not found for lootItemId' })
            await prisma.$transaction(async (tx) => {
              const check = await tx.playerItem.findUnique({ where: { id: pl.id } })
              if (!check) throw new Error('ALREADY_SOLD')

              await tx.playerItem.delete({ where: { id: pl.id } })
              await tx.kDRPlayer.update({ where: { id: player.id }, data: { gold: { increment: goldGain } } })
            })
            const fresh = await prisma.kDRPlayer.findUnique({ where: { id: player.id } })
            try { await maybeInvalidate() } catch (e) {}
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
                try { await maybeInvalidate() } catch (e) {}
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
            try { await maybeInvalidate() } catch (e) {}
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
  } catch (e: any) {
    console.error('shop-v2 handler failed', e)
    return res.status(500).json({ error: 'shop-v2 failed', detail: e?.message || String(e) })
  }
}
