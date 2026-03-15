import React from 'react'
import LootPoolTile from './LootPoolTile'
import LootPoolPurchaseButton from './LootPoolPurchaseButton'
import LootPoolGroup from './LootPoolGroup'

interface LootPoolInstanceProps {
  player: any
  animatingOutGroups: Set<string>
  frozenPools: Record<string, any[]>
  groupNodeRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  loading: boolean
  lootExitPhase: boolean
  call: (action: string, data?: any) => Promise<any>
  setPlayer: (player: any) => void
  openPoolViewer: (pool: any) => void
  setFrozenPools: React.Dispatch<React.SetStateAction<Record<string, any[]>>>
  setAnimatingOutGroups: React.Dispatch<React.SetStateAction<Set<string>>>
  suppressStageEffectRef: React.MutableRefObject<boolean>
}

export default function LootPoolInstance({
  player,
  animatingOutGroups,
  frozenPools,
  groupNodeRefs,
  loading,
  lootExitPhase,
  call,
  setPlayer,
  openPoolViewer,
  setFrozenPools,
  setAnimatingOutGroups,
  suppressStageEffectRef,
}: LootPoolInstanceProps) {
  const getTierLabel = (tier: string, isGeneric: boolean) => {
    if (isGeneric) {
      const genericLabels: Record<string, string> = {
        STARTER: 'Staples',
        MID: 'Removal/Disruption',
        HIGH: 'Engine',
      }
      return genericLabels[tier] || tier
    } else {
      const classLabels: Record<string, string> = {
        STARTER: 'Starter Packs',
        MID: 'Mid Quality',
        HIGH: 'High Quality',
      }
      return classLabels[tier] || tier
    }
  }

  if (!player?.shopState?.lootOffers || player.shopState.lootOffers.length === 0) {
    return null
  }

  // Build groups
  const groupKeyFunc = (pool: any) => `${pool.tier}_${pool.isGeneric ? 'generic' : 'class'}`
  const groups: Record<string, any[]> = {}
  const displayedGroups: Record<string, any[]> = {}
  const categoryStock: Record<string, number> = {}

  player.shopState.lootOffers.forEach((pool: any) => {
    const key = groupKeyFunc(pool)
    if (!groups[key]) {
      groups[key] = []
      categoryStock[key] = 0
    }
    groups[key].push(pool)

    const hasBeenBought = (player?.shopState?.purchases || []).some(
      (p: any) => String(p.lootPoolId) === String(pool.id)
    )
    if (!hasBeenBought) {
      categoryStock[key]++
    }
  })

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const tierOrderMap: Record<string, number> = { STARTER: 0, MID: 1, HIGH: 2 }
    const [tierA, typeA] = a.split('_')
    const [tierB, typeB] = b.split('_')
    if (typeA !== typeB) return typeA === 'class' ? -1 : 1
    return (tierOrderMap[tierA] ?? 99) - (tierOrderMap[tierB] ?? 99)
  })

  sortedKeys.forEach((key) => {
    displayedGroups[key] = animatingOutGroups.has(key) ? (frozenPools[key] || groups[key]) : groups[key]
  })

  try {
    // Debugging: log grouping and stock counts to help diagnose missing tiers
    try {
      const purchasesList = (player?.shopState?.purchases || []).map((p: any) => ({ lootPoolId: String(p.lootPoolId || p.poolId || p.itemId || ''), source: p.source, name: p.name }))
      const groupPools: Record<string, any[]> = {}
      Object.keys(groups).forEach(k => { groupPools[k] = (groups[k] || []).map((p: any) => String(p.id)) })
      console.debug('[SHOP DEBUG] loot groups', { sortedKeys, categoryStock, groupPools, purchases: purchasesList.slice(0,50) })
    } catch (e) { console.debug('[SHOP DEBUG] loot groups logging failed', e) }
  } catch (e) {}

  const tierOrderMap: Record<string, number> = { STARTER: 0, MID: 1, HIGH: 2 }

  return (
      <div className="mb-4 space-y-6 relative">
        <div className="transition-opacity duration-300">
          {sortedKeys.map((key) => {
            const [tier, type] = key.split('_')
            const poolsInGroup = displayedGroups[key]
            const isGeneric = type === 'generic'

            return (
              <div key={key}>
                <React.Suspense fallback={null}>
                  {/* Lazy-ish grouping component to keep this file small */}
                  {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                  {/* @ts-ignore */}
                  <LootPoolGroup
                    keyId={key}
                    tier={tier}
                    isGeneric={isGeneric}
                    poolsInGroup={poolsInGroup}
                    player={player}
                    animatingOutGroups={animatingOutGroups}
                    frozenPools={frozenPools}
                    groupNodeRefs={groupNodeRefs}
                    loading={loading}
                    lootExitPhase={lootExitPhase}
                    call={call}
                    setPlayer={setPlayer}
                    openPoolViewer={openPoolViewer}
                    setFrozenPools={setFrozenPools}
                    setAnimatingOutGroups={setAnimatingOutGroups}
                    suppressStageEffectRef={suppressStageEffectRef}
                  />
                </React.Suspense>
              </div>
            )
          })}
        </div>
      </div>
    )
}

// Global keyframes used by the loot group entrance/exit animations.
// These mirror the legacy shop implementation so the inline `opacity: 0`
// style above is transitioned to visible by the animations.
export const __lootPoolInstanceStyles = null

/*
 NOTE: We can't export JSX-style <style jsx global> from here because
 this file is a pure component file — but adding a side-effecting
 style block inline is acceptable for parity. We'll append the
 style via a small hack: inject global styles when module loads
 so the `animation` names referenced in inline styles exist.
*/
;(function injectLootKeyframes() {
  try {
    if (typeof document === 'undefined') return
    const id = 'kdr-loot-keyframes'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.innerHTML = `
      .shopkeeper-float { transform-origin: center; animation: shopFloat 4200ms ease-in-out infinite; }
      @keyframes shopFloat { 0% { transform: translateY(0px) } 50% { transform: translateY(-22px) } 100% { transform: translateY(0px) } }

      @keyframes flyUp {
        0% { transform: translateY(600px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }

      @keyframes slideInFromRight {
        0% { transform: translateX(120%); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
      }

      @keyframes slideOutToLeft {
        0% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(-120%); opacity: 0; }
      }

      @keyframes fadeOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-100px); } }

      .pool-purchase-slide-out { animation: slideOutToLeft 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards !important; }
    `
    document.head.appendChild(el)
  } catch (e) {
    // ignore in SSR or if DOM not available
  }
})()
