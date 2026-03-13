import { useMemo } from 'react'

type PlayerLike = any
type KdrLike = any

export function usePoolVisibility({ player, classDetails, kdr, classPoolsFallback }: { player: PlayerLike, classDetails?: any, kdr?: KdrLike, classPoolsFallback?: any[] | null }) {
  // Authoritative pool lists
  const classPools: any[] = useMemo(() => {
    if (Array.isArray((player as any)?.shopState?.classLootPools)) return (player as any).shopState.classLootPools
    if (classDetails && Array.isArray(classDetails.lootPools)) return classDetails.lootPools
    if (player?.class && Array.isArray(player.class.lootPools)) return player.class.lootPools
    if (Array.isArray(classPoolsFallback)) return classPoolsFallback
    if (kdr?.format && Array.isArray(kdr.format.lootPools)) return kdr.format.lootPools
    return []
  }, [player, classDetails, kdr, classPoolsFallback])

  const genericPools: any[] = useMemo(() => {
    if (Array.isArray(kdr?.genericLootPools)) return kdr.genericLootPools
    if (Array.isArray((player as any)?.kdrGenericLootPools)) return (player as any).kdrGenericLootPools
    return []
  }, [player, kdr])

  const shopState = (player as any)?.shopState || {}
  const offers: any[] = Array.isArray(shopState.lootOffers) ? shopState.lootOffers : []

  // Aggregate purchases across all shop instances (historical rounds) plus current shopState
  const purchasesAll: any[] = useMemo(() => {
    const insts = Array.isArray((player as any)?.shopInstances) ? (player as any).shopInstances : []
    const fromInsts = insts.flatMap((i: any) => Array.isArray(i?.shopState?.purchases) ? i.shopState.purchases : [])
    const cur = Array.isArray(shopState.purchases) ? shopState.purchases : []
    return [...fromInsts, ...cur].filter(Boolean)
  }, [player?.shopInstances, JSON.stringify(shopState.purchases || [])])

  // IDs marked seen server-side across all instances + current shopState
  const seenStateIds: string[] = useMemo(() => {
    const insts = Array.isArray((player as any)?.shopInstances) ? (player as any).shopInstances : []
    const fromInsts = insts.flatMap((i: any) => Array.isArray(i?.shopState?.seen) ? i.shopState.seen.map((s: any) => String(s)) : [])
    const cur = Array.isArray(shopState.seen) ? shopState.seen.map((s: any) => String(s)) : []
    return Array.from(new Set([...fromInsts, ...cur]))
  }, [player?.shopInstances, JSON.stringify(shopState.seen || [])])

  // Purchase ids (lootPoolId entries) aggregated across all rounds
  const purchasedIds: string[] = useMemo(() => {
    return purchasesAll.map((p: any) => p && (p.lootPoolId || p.poolId) ? String(p.lootPoolId || p.poolId) : null).filter(Boolean)
  }, [purchasesAll])

  // Seen ids = union of server-side seen across rounds, currently displayed offers, and purchased pools (since picks/purchases imply visibility)
  const seenIdsSet = useMemo(() => {
    const s = new Set<string>()
    for (const id of seenStateIds) s.add(String(id))
    for (const o of offers) if (o && o.id) s.add(String(o.id))
    for (const id of purchasedIds) s.add(String(id))
    return s
  }, [JSON.stringify(seenStateIds || []), JSON.stringify(offers || []), JSON.stringify(purchasedIds || [])])

  function totalPoolsFor(tier: string, isClass: boolean) {
    const pools = isClass ? classPools : genericPools
    return pools.filter((p: any) => String((p && p.tier) || 'STARTER').toUpperCase() === String(tier).toUpperCase()).length
  }

  function seenCountFor(tier: string, isClass: boolean) {
    const pools = isClass ? classPools : genericPools
    return pools.filter((p: any) => seenIdsSet.has(String(p.id)) && String((p && p.tier) || 'STARTER').toUpperCase() === String(tier).toUpperCase()).length
  }

  function purchasedCountFor(tier: string, isClass: boolean) {
    const pools = isClass ? classPools : genericPools
    const purchasedSet = new Set(purchasedIds)
    return pools.filter((p: any) => purchasedSet.has(String(p.id)) && String((p && p.tier) || 'STARTER').toUpperCase() === String(tier).toUpperCase()).length
  }

  return {
    classPools,
    genericPools,
    offers,
    purchases: purchasesAll,
    seenIds: Array.from(seenIdsSet),
    purchasedIds,
    totalPoolsFor,
    seenCountFor,
    purchasedCountFor
  }
}

export default null as any
