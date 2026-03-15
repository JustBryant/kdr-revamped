import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { findKdr, generatePlayerKey } from '../../../../lib/kdrHelpers'
import { getJson, setJson } from '../../../../lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  // Allow a development-only debug bypass when ?_debug=1 is supplied so
  // we can inspect classview payloads without a logged-in session.
  const devDebug = process.env.NODE_ENV === 'development' && req.query?._debug === '1'
  if (!session && !devDebug) return res.status(401).json({ error: 'Unauthorized' })

const { id, playerKey } = req.query
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' })

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    // Try short-lived Redis cache for expensive classview payloads.
    const cacheKey = `kdr:resp:${id}:classview`
    try {
        const cached = await getJson(cacheKey)
        if (cached) {
            let currentPlayer = null
            if (playerKey && typeof playerKey === 'string') {
                currentPlayer = (cached.players || []).find((p: any) => p.playerKey === playerKey) || null
            }
            if (!currentPlayer && session?.user?.email) {
                const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
                if (user) currentPlayer = (cached.players || []).find((p: any) => p.user?.id === user.id || p.userId === user.id) || null
            }
            return res.status(200).json({ ...cached, currentPlayer })
        }
    } catch (e) {
        console.warn('Failed to read classview cache', e)
    }

    try {
        // Minimal KDR payload optimized for the class page
        const kdr = await findKdr(id, {
            select: {
                id: true,
                name: true,
                slug: true,
                createdAt: true,
                status: true,
                playerCount: true,
                formatId: true,
                settingsSnapshot: true,
                // include players with necessary fields
                players: {
                    select: {
                        id: true,
                        userId: true,
                        classId: true,
                        deckId: true,
                        gold: true,
                        xp: true,
                        status: true,
                        shopComplete: true,
                        shopState: true,
                        user: { select: { id: true, name: true, email: true, image: true } },
                        playerDeck: { select: { id: true, name: true } }
                    }
                },
                // include only the latest round and its matches (minimal)
                rounds: { orderBy: { number: 'desc' }, take: 1, select: { id: true, number: true, matches: { select: { id: true, playerAId: true, playerBId: true, status: true, scoreA: true, scoreB: true, winnerId: true, reportedById: true } } } }
            }
        })

        if (!kdr) return res.status(404).json({ error: 'KDR not found' })
        if (kdr.status === 'DELETED') return res.status(404).json({ error: 'KDR not found' })

        // Append stable playerKey for each player. Inventory and skills are derived from `PlayerItem` rows.
                const userIds = (kdr.players || []).map((p: any) => p.user?.id || p.userId).filter(Boolean)
                const kdrPlayerIds = (kdr.players || []).map((p: any) => p.id).filter(Boolean)
                // Prefer items explicitly tied to the KDR player via `kdrPlayerId`, but
                // fall back to legacy (userId + kdrId) for rows not yet backfilled.
                const playerItems = (kdrPlayerIds.length || userIds.length)
                    ? await prisma.playerItem.findMany({ where: ({ OR: [ { kdrPlayerId: { in: kdrPlayerIds } }, { AND: [ { userId: { in: userIds } }, { kdrId: kdr.id } ] } ] } as any) })
                    : []
        const playerItemsByUser: Record<string, any[]> = {}
        playerItems.forEach((it: any) => {
            const uid = it.userId
            if (!playerItemsByUser[uid]) playerItemsByUser[uid] = []
            playerItemsByUser[uid].push(it)
        })

        // Batch fetch referenced cards and skills
        const cardIds = Array.from(new Set(playerItems.map((it: any) => it.cardId).filter(Boolean)))
        const skillIds = Array.from(new Set(playerItems.map((it: any) => it.skillId).filter(Boolean)))
        const cards = cardIds.length ? await prisma.card.findMany({ where: { id: { in: cardIds } } }) : []
        const skills = skillIds.length ? await prisma.skill.findMany({ where: { id: { in: skillIds } } }) : []
        const cardById: Record<string, any> = {}
        const skillById: Record<string, any> = {}
        for (const c of cards) cardById[c.id] = c
        for (const s of skills) skillById[s.id] = {
            ...s,
            statRequirements: s.statRequirements ? (typeof s.statRequirements === 'string' ? JSON.parse(s.statRequirements) : s.statRequirements) : []
        }

        // Preload referenced Item / LootItem rows so we can identify TREASURE Item types
        // PlayerItem rows reference `itemId`.
        const allItemIds = Array.from(new Set(playerItems.map((it: any) => it.itemId).filter(Boolean)))
        const itemRows = allItemIds.length ? await prisma.item.findMany({ where: { id: { in: allItemIds as string[] } } }) : []
        const itemById: Record<string, any> = {}
        for (const it of itemRows) itemById[it.id] = it

        const players: any[] = (kdr.players || []).map((p: any) => {
            const pid = p.user?.id || p.userId
            const pk = pid ? generatePlayerKey(pid, kdr.id) : null
            const items = (playerItemsByUser[pid] || [])
            // Map inventory rows, preferring Item model rows (which include TREASUREs)
            const mapped = items.map((it: any) => {
                const refId = it.itemId || null
                const item = refId ? itemById[refId] : null
                
                // Since Item doesn't have direct card/skill relations, 
                // we'll rely on the playerItem.cardId/skillId that was already fetched in cardById/skillById
                const card = it.cardId ? cardById[it.cardId] ?? null : (item?.cardId ? cardById[item.cardId] ?? null : null)
                const skill = it.skillId ? skillById[it.skillId] ?? null : (item?.skillId ? skillById[item.skillId] ?? null : null)
                const isTreasure = !!(item && String(item.type || '').toUpperCase() === 'TREASURE')
                
                return {
                    id: it.id, // playerItem id
                    qty: it.qty || 1,
                    itemId: refId,
                    card,
                    skill,
                    createdAt: it.createdAt,
                    isTreasure,
                    rarity: item?.rarity || card?.rarity || 'C'
                }
            })
            const inventory = mapped.filter((m: any) => !m.isTreasure)
            const treasures = mapped.filter((m: any) => !!m.isTreasure)

            // Build skills from chosen SHOP picks and inventory-derived skills
            const invSkillIds = inventory.map((it: any) => it.skill?.id).filter(Boolean)
            const shopState: any = p.shopState || {}
            const chosenSkillIds = Array.isArray(shopState.chosenSkills) ? shopState.chosenSkills : []
            const skillsMap: Record<string, any> = {}
            
            // chosen SHOP skills
            chosenSkillIds.forEach((sid: string) => {
                const row = skillById[sid]
                if (row) {
                    skillsMap[sid] = { 
                        id: row.id, 
                        name: row.name, 
                        description: row.description || '', 
                        statRequirements: row.statRequirements,
                        _source: 'SHOP' 
                    }
                }
            })
            // inventory-derived skills
            invSkillIds.forEach((sid: string) => {
                const row = skillById[sid]
                if (row) {
                    skillsMap[sid] = { 
                        id: row.id, 
                        name: row.name, 
                        description: row.description || '', 
                        statRequirements: row.statRequirements,
                        _source: 'INVENTORY' 
                    }
                }
            })
            // LOOT_POOL approximated from playerItems created during KDR
            const kdrStart = kdr.createdAt ? new Date(kdr.createdAt).getTime() : 0;
            (playerItemsByUser[pid] || []).forEach((it: any) => {
                if (!it.skillId) return
                const created = it.createdAt ? new Date(it.createdAt).getTime() : 0
                if (created >= kdrStart) {
                    const sid = it.skillId
                    if (!skillsMap[sid]) {
                        const srow = skillById[sid]
                        if (srow) {
                            skillsMap[sid] = { 
                                id: srow.id, 
                                name: srow.name, 
                                description: srow.description || '', 
                                statRequirements: srow.statRequirements,
                                _source: 'LOOT_POOL' 
                            }
                        }
                    }
                }
            })

            const skillsArr = Object.values(skillsMap)
            return { ...p, playerKey: pk, inventory, treasures, skills: skillsArr, deck: p.playerDeck }
        })

        // Resolve currentPlayer
        let currentPlayer = null
        // 1. Priority: playerKey from URL
        if (playerKey && typeof playerKey === 'string') {
            currentPlayer = players.find((p: any) => p.playerKey === playerKey) || null
        }
        // 2. Fallback: session user
        if (!currentPlayer && session?.user?.email) {
            const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
            if (user) {
                currentPlayer = players.find((p: any) => p.user?.id === user.id || p.userId === user.id) || null
            }
        }

        // Fetch generic loot pools (classId == null)
        let genericLootPools: any[] = []
        try {
            genericLootPools = await prisma.lootPool.findMany({ where: { classId: null }, include: { items: { include: { card: true } } } })
        } catch (e) {
            console.warn('Failed to load generic loot pools', e)
        }

        const responsePayload = { 
            id: kdr.id, 
            name: kdr.name, 
            slug: kdr.slug, 
            status: kdr.status, 
            playerCount: kdr.playerCount, 
            settingsSnapshot: kdr.settingsSnapshot, 
            players, 
            rounds: kdr.rounds || [], 
            genericLootPools 
        }
        try { await setJson(cacheKey, responsePayload, 3) } catch (e) { console.warn('Failed to set classview cache', e) }
        return res.status(200).json({ ...responsePayload, currentPlayer })
    } catch (error) {
        console.error('Failed to fetch classview KDR', error)
        return res.status(500).json({ error: 'Failed to fetch KDR' })
    }
}
