import React, { useEffect, useState } from 'react'
import { useShopContext } from '../../ShopContext'
import { computeLevel } from '../../../../lib/shopHelpers'
import axios from 'axios'
import useShopCaches from '../../utils/useShopCaches'
import { usePoolVisibility } from './PoolVisibility'
import LootTierPoolsModal from '../loot/LootTierPoolsModal'

export default function LootTierUnlocks() {
  const { player } = useShopContext()
  const ctx = useShopContext()
  const kdr = (ctx as any).kdr
  const defaults: any = { levelXpCurve: [0, 100, 300, 600, 1000] }
  const settings = kdr ? (kdr.settingsSnapshot ? { ...defaults, ...(kdr.settingsSnapshot || {}) } : (kdr.format && kdr.format.gameSettings ? { ...defaults, ...(kdr.format.gameSettings || {}) } : defaults)) : defaults
  const currentLevel = (player && typeof player.xp === 'number') ? computeLevel(Number(player.xp || 0), settings.levelXpCurve) : 0

  const tiers = ['STARTER', 'MID', 'HIGH']
  const [classPoolsRemote, setClassPoolsRemote] = useState<any[] | null>(null)

  // If the player has a classId but we don't have class pools available
  // on player/kdr, fetch the class details as a fallback so totals render.
  useEffect(() => {
    let mounted = true
    const classId = player?.classId
    const haveLocal = Array.isArray(player?.shopState?.classLootPools) || Array.isArray(player?.classDetails?.lootPools) || Array.isArray(player?.class?.lootPools) || Array.isArray(kdr?.format?.lootPools)
    if (!classId || haveLocal) return
    ;(async () => {
      try {
        const res = await axios.get(`/api/classes/${encodeURIComponent(classId)}`)
        if (!mounted) return
        const data = res.data || {}
        setClassPoolsRemote(Array.isArray(data?.lootPools) ? data.lootPools : [])
      } catch (e) {
        if (!mounted) return
        setClassPoolsRemote([])
      }
    })()
    return () => { mounted = false }
  }, [player?.classId, player?.shopState?.classLootPools, player?.classDetails, player?.class, kdr?.format?.lootPools])

  const pv = usePoolVisibility({ player, classDetails: player?.classDetails || player?.class, kdr, classPoolsFallback: classPoolsRemote })
  const { ensureCardDetails } = useShopCaches()

  // DEBUG: trace purchases/instances for flicker investigation
  React.useEffect(() => {
    try {
      const now = Date.now()
      const insts = Array.isArray(player?.shopInstances) ? player.shopInstances : []
      const instPurchases = insts.flatMap((i: any) => Array.isArray(i?.shopState?.purchases) ? i.shopState.purchases : [])
      const curPurchases = Array.isArray(player?.shopState?.purchases) ? player.shopState.purchases : []
      console.debug('[LOOT-TIER-DEBUG]', { ts: now, stage: player?.shopState?.stage, instCount: insts.length, instPurchasesCount: instPurchases.length, curPurchasesCount: curPurchases.length, pvPurchasesCount: Array.isArray(pv?.purchases) ? pv.purchases.length : null })
    } catch (e) {}
  }, [player?.shopState?.purchases, player?.shopInstances, pv?.purchases, player?.shopState?.stage])

  const [tierModalOpen, setTierModalOpen] = React.useState(false)
  const [tierModalSeenPools, setTierModalSeenPools] = React.useState<any[] | null>(null)
  const [tierModalPurchasedPools, setTierModalPurchasedPools] = React.useState<any[] | null>(null)
  const [tierModalTitle, setTierModalTitle] = React.useState<string | undefined>(undefined)

  const openTierModal = async (tier: string, isClass: boolean) => {
    const pools = isClass ? pv.classPools : pv.genericPools
    const all = (pools || []).filter((p: any) => String((p && p.tier) || 'STARTER').toUpperCase() === String(tier).toUpperCase())
    const offersSource = Array.isArray(pv.offers) ? pv.offers : []

    const enrichPool = async (candidate: any) => {
      if (!candidate) return candidate
      try {
        const found = (pools || []).concat(offersSource || []).find((lp: any) => String(lp.id) === String(candidate.id)) || candidate
        const pool = { ...(found || candidate) }
        const cardsArr = Array.isArray(pool.cards) ? pool.cards : []
        if (cardsArr.length === 0 && Array.isArray(pool.items)) {
          const derived = pool.items.filter((it: any) => it && it.type === 'Card').map((it: any) => it.card).filter(Boolean)
          if (derived.length) pool.cards = derived
        }
        if (ensureCardDetails && Array.isArray(pool.cards) && pool.cards.length) {
          const results = await Promise.all(pool.cards.map(async (c: any) => {
            try { return await ensureCardDetails(c) || c } catch (e) { return c }
          }))
          pool.cards = results.filter(Boolean)
        }
        return pool
      } catch (e) { return candidate }
    }

    const purchased = await Promise.all(all
      .filter((p: any) => (pv.purchasedIds || []).includes(String(p.id)))
      .map(async (p: any) => await enrichPool(p)))

    const seenOnly = await Promise.all(all
      .filter((p: any) => (pv.seenIds || []).includes(String(p.id)) && !(pv.purchasedIds || []).includes(String(p.id)))
      .map(async (p: any) => await enrichPool(p)))

    setTierModalPurchasedPools(purchased.filter(Boolean))
    setTierModalSeenPools(seenOnly.filter(Boolean))
    setTierModalTitle(`${isClass ? 'Class' : 'Generic'} ${tier} Pools`)
    setTierModalOpen(true)
  }

  // Short-lived cache to avoid transient UI flicker when server snapshots briefly omit purchases
  const recentPurchasedCacheRef = React.useRef<Record<string, { count: number; ts: number }>>({})

  return (
    <div className="w-full mt-4 p-2">
      <div className="grid grid-cols-1 gap-3">
        {['Class','Generic'].map((type) => {
          const isClass = type === 'Class'
          return (
            <div key={type} className="p-3 rounded-lg bg-gradient-to-br from-gray-900/20 to-transparent border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-base font-bold text-white">{type} Loot</div>
                <div className="text-xs text-gray-400">Hover for details</div>
              </div>

              <div className="flex flex-col gap-2">
                {tiers.map((tier) => {
                  const shortLabel = (tier === 'STARTER' ? 'Starter' : (tier === 'MID' ? 'Mid' : 'High'))
                  const genericLabels: Record<string, string> = { STARTER: 'Staples', MID: 'Removal/Disruption', HIGH: 'Engine' }
                  const displayLabel = isClass ? `${shortLabel} Packs` : (genericLabels[tier as keyof typeof genericLabels] || `${shortLabel} Packs`)
                  const minKey = `${isClass ? 'class' : 'generic'}${shortLabel}MinLevel`
                  const fallbackKey = `${isClass ? 'class' : 'generic'}StarterMinLevel`
                  const minLevel = Number(settings?.[minKey] ?? settings?.[fallbackKey] ?? 1)
                  const unlocked = ((currentLevel + 1) >= minLevel)
                  // Use centralized pool visibility helper
                  const poolsCount = pv.seenCountFor(tier, isClass)
                  const purchasedCountComputed = (() => {
                    try {
                      // Derive purchased ids directly from the authoritative `player` snapshot
                      const insts = Array.isArray(player?.shopInstances) ? player.shopInstances : []
                      const fromInsts = insts.flatMap((i: any) => Array.isArray(i?.shopState?.purchases) ? i.shopState.purchases.map((p: any) => String(p.lootPoolId || p.poolId)) : [])
                      const cur = Array.isArray(player?.shopState?.purchases) ? player.shopState.purchases.map((p: any) => String(p.lootPoolId || p.poolId)) : []
                      const purchasedSet = new Set<string>([...fromInsts.filter(Boolean), ...cur.filter(Boolean)])
                      const pools = isClass ? pv.classPools : pv.genericPools
                      return pools.filter((p: any) => purchasedSet.has(String(p.id)) && String((p && p.tier) || 'STARTER').toUpperCase() === String(tier).toUpperCase()).length
                    } catch (e) {
                      // Fallback to existing visibility helper if anything goes wrong
                      return pv.purchasedCountFor(tier, isClass)
                    }
                  })()

                  // Determine displayed count with short debounce cache (2s)
                  const cacheKey = `${isClass ? 'class' : 'generic'}_${tier}`
                  const nowTs = Date.now()
                  const cacheEntry = recentPurchasedCacheRef.current[cacheKey]
                  if ((purchasedCountComputed || 0) > 0) {
                    recentPurchasedCacheRef.current[cacheKey] = { count: purchasedCountComputed, ts: nowTs }
                  }
                  let purchasedCount = purchasedCountComputed
                  if ((!purchasedCountComputed || purchasedCountComputed === 0) && cacheEntry && (nowTs - cacheEntry.ts) <= 2000) {
                    purchasedCount = cacheEntry.count
                  }

                  // Ensure we don't drop below what the centralized visibility helper reports
                  try {
                    const pvCount = pv && typeof pv.purchasedCountFor === 'function' ? pv.purchasedCountFor(tier, isClass) : 0
                    purchasedCount = Math.max(purchasedCount || 0, pvCount || 0, purchasedCountComputed || 0)
                  } catch (e) {}
                  const totalPools = pv.totalPoolsFor(tier, isClass)

                  return (
                    <div key={tier} onClick={() => openTierModal(tier, isClass)} className="flex items-center justify-between p-3.5 bg-gray-900/30 rounded-lg hover:bg-gray-800/30 transition-all duration-150 cursor-pointer">
                      <div>
                        <div className="text-base text-white font-medium">{displayLabel}</div>
                        <div className="text-xs text-gray-400">{unlocked ? 'Available' : `Requires Lvl ${minLevel}`}</div>
                        <div className="text-xs text-gray-300">Seen: {poolsCount} • Purchased: {purchasedCount} / {totalPools}</div>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${unlocked ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>{unlocked ? 'UNLOCKED' : 'LOCKED'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <LootTierPoolsModal
        isOpen={tierModalOpen}
        onClose={() => setTierModalOpen(false)}
        purchasedPools={tierModalPurchasedPools || []}
        seenPools={tierModalSeenPools || []}
        title={tierModalTitle}
      />
    </div>
  )
}
