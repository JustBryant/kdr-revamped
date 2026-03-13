import React from 'react'

interface Props {
  tier: string
  isGeneric: boolean
  poolsInGroup: any[]
  groupKey: string
  loading: boolean
  lootExitPhase: boolean
  call: (action: string, data?: any, opts?: any) => Promise<any>
  setPlayer: (p: any) => void
  setFrozenPools: React.Dispatch<React.SetStateAction<Record<string, any[]>>>
  setAnimatingOutGroups: React.Dispatch<React.SetStateAction<Set<string>>>
  groupNodeRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  player: any
  suppressStageEffectRef: React.MutableRefObject<boolean>
}

export default function LootPoolPurchaseButton({
  tier,
  isGeneric,
  poolsInGroup,
  groupKey,
  loading,
  lootExitPhase,
  call,
  setPlayer,
  setFrozenPools,
  setAnimatingOutGroups,
  groupNodeRefs,
  player,
  suppressStageEffectRef,
}: Props) {
  const qualityCost = poolsInGroup[0]?.cost || 0
  const qualityLabel = isGeneric
    ? ({ STARTER: 'Staples', MID: 'Removal/Disruption', HIGH: 'Engine' } as any)[tier] || tier
    : (tier === 'STARTER' ? 'Starter' : tier)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (loading || lootExitPhase) return

    try {
      suppressStageEffectRef.current = true
      const res = await call('purchaseLootPool', { tier, isGeneric }, { autoSetPlayer: false })

      if (res && res.error) {
        alert(`Purchase failed: ${res.error}`)
        try { suppressStageEffectRef.current = false } catch (e) {}
      } else if (res && res.player) {
        // freeze and animate group out
        setFrozenPools((prev) => ({ ...prev, [groupKey]: poolsInGroup }))
        setAnimatingOutGroups((prev) => new Set(prev).add(groupKey))

        const groupEl = groupNodeRefs.current[groupKey]
        if (groupEl) {
          try {
            groupEl.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 1, 1)'
            groupEl.style.transform = 'translateX(-120vw)'
            groupEl.style.opacity = '0'
            groupEl.style.filter = 'blur(10px) grayscale(1)'
          } catch (e) {}
        }

        setTimeout(() => {
          try {
            // Merge returned player into existing state to avoid clobbering transient UI values
            setPlayer((prev: any) => {
              try {
                const incoming = res.player || {}
                const merged = { ...(prev || {}), ...(incoming || {}) }
                const prevPurchases = Array.isArray(prev?.shopState?.purchases) ? prev.shopState.purchases : []
                const incPurchases = Array.isArray(incoming?.shopState?.purchases) ? incoming.shopState.purchases : []
                const mergedPurchases = incPurchases.length ? incPurchases : prevPurchases
                merged.shopState = { ...(prev?.shopState || {}), ...(incoming?.shopState || {}) }
                merged.shopState.purchases = mergedPurchases
                // Enforce LOOT stage after purchase
                merged.shopState = { ...(merged.shopState || {}), stage: (merged.shopState?.stage || 'LOOT') }
                return merged
              } catch (e) { return res.player }
            })
          } catch (e) {}

          setAnimatingOutGroups((prev) => {
            const next = new Set(prev)
            next.delete(groupKey)
            return next
          })
          setFrozenPools((prev) => {
            const next = { ...prev }
            delete next[groupKey]
            return next
          })

          if (groupEl) {
            try {
              groupEl.style.transition = ''
              groupEl.style.transform = ''
              groupEl.style.opacity = ''
              groupEl.style.filter = ''
            } catch (e) {}
          }

          // Clear suppression after animation and state applied
          try { suppressStageEffectRef.current = false } catch (e) {}
        }, 600)
      }
    } catch (err) {
      console.error('purchase bulk failed', err)
      try { suppressStageEffectRef.current = false } catch (e) {}
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || player?.gold < qualityCost}
      className={`group relative flex items-center justify-center bg-neutral-900 border-2 ${
        tier === 'STARTER'
          ? 'border-blue-500/40 hover:border-blue-400 shadow-blue-500/10'
          : tier === 'MID'
          ? 'border-purple-500/40 hover:border-purple-400 shadow-purple-500/10'
          : 'border-amber-500/40 hover:border-amber-400 shadow-amber-500/10'
      } px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl`}
    >
      <div className="flex flex-col items-center">
        <span className={`text-[10px] ${tier === 'STARTER' ? 'text-blue-400' : tier === 'MID' ? 'text-purple-400' : 'text-amber-400'} font-black uppercase tracking-widest leading-none mb-1`}>
          Purchase {qualityLabel}
        </span>
        <span className="text-xl font-black text-white leading-none whitespace-nowrap">{qualityCost}G</span>
      </div>
    </button>
  )
}
