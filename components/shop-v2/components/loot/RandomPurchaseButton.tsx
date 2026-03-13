import React, { useState } from 'react'
import CardImage from '../../../common/CardImage'
import LootTierPoolsModal from './LootTierPoolsModal'

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
  openPoolViewer?: (pool: any) => void
}

export default function RandomPurchaseButton({
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
  openPoolViewer,
}: Props) {
  const qualityCost = poolsInGroup[0]?.cost || 0
  const qualityLabel = isGeneric
    ? ({ STARTER: 'Staples', MID: 'Removal/Disruption', HIGH: 'Engine' } as any)[tier] || tier
    : (tier === 'STARTER' ? 'Starter' : tier)
  const [purchasedPools, setPurchasedPools] = useState<any[] | null>(null)
  const [purchasedModalContext, setPurchasedModalContext] = useState<{ tier: string; isClass: boolean } | null>(null)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (loading || lootExitPhase) return

    try {
      suppressStageEffectRef.current = true
      const res = await call('purchaseLootPool', { tier, isGeneric, random: true }, { autoSetPlayer: false })

      const respPurchased = res && res.purchasedPools ? res.purchasedPools : null

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
                // Determine which purchased IDs came back from the server
                const respIds = (respPurchased || []).map((p: any) => String(p.id))
                // Determine if any of the purchased IDs match the currently displayed group
                const displayedIds = (poolsInGroup || []).map((p: any) => String(p.id))
                const shouldReplaceDisplayed = respIds.some(id => displayedIds.includes(id))

                setPlayer((prev: any) => {
              try {
                const incoming = res.player || {}
                const merged = { ...(prev || {}), ...(incoming || {}) }
                // Preserve purchases: merge incoming purchases with existing ones (favor incoming)
                const prevPurchases = Array.isArray(prev?.shopState?.purchases) ? prev.shopState.purchases : []
                const incPurchases = Array.isArray(incoming?.shopState?.purchases) ? incoming.shopState.purchases : []
                const mergedPurchases = incPurchases.length ? incPurchases : prevPurchases
                merged.shopState = { ...(prev?.shopState || {}), ...(incoming?.shopState || {}) }
                merged.shopState.purchases = mergedPurchases
                // If server returned purchasedPools, ensure they are removed from visible lootOffers (we will then fetch replacements)
                try {
                  if (shouldReplaceDisplayed && respIds.length > 0) {
                    merged.shopState = merged.shopState || {}
                    merged.shopState.lootOffers = (merged.shopState.lootOffers || []).filter((o: any) => !respIds.includes(String(o.id)))
                  }
                } catch (e) {}
                merged.shopState = { ...(merged.shopState || {}), stage: (merged.shopState?.stage || 'LOOT') }
                return merged
              } catch (e) { return res.player }
            })
            // If any displayed pool was purchased, request fresh offers to replace them in-place
            if (shouldReplaceDisplayed) {
              ;(async () => {
                try {
                  const offersResp = await call('lootOffers', {}, { autoSetPlayer: false })
                  if (offersResp && Array.isArray(offersResp.offers)) {
                    setPlayer((prev: any) => {
                      try {
                        const merged2 = { ...(prev || {}) }
                        merged2.shopState = { ...(prev?.shopState || {}), ...(merged2.shopState || {}) }
                        merged2.shopState.lootOffers = offersResp.offers
                        return merged2
                      } catch (e) { return prev }
                    })
                  }
                } catch (e) {}
              })()
            }
            // show modal with purchased pools after state updated
            try {
              if (respPurchased && respPurchased.length > 0) {
                ;(async () => {
                  try {
                    const allCardIds = Array.from(new Set((respPurchased || []).flatMap((p: any) => (p.cards || []).map((c: any) => String(c.id)))))
                    const cardDataMap: Record<string, any> = {}
                    if (allCardIds.length > 0) {
                      await Promise.all(allCardIds.map(async (cid) => {
                        try {
                          const r = await fetch(`/api/cards/${encodeURIComponent(String(cid))}`)
                          if (!r.ok) return
                          const data = await r.json()
                          cardDataMap[String(cid)] = data
                        } catch (e) {}
                      }))
                    }

                    const enriched = (respPurchased || []).map((p: any) => ({
                      ...p,
                      cards: (p.cards || []).map((c: any) => ({ ...(cardDataMap[String(c.id)] || {}), ...c })),
                    }))

                    setPurchasedPools(enriched)
                    try { setPurchasedModalContext({ tier, isClass: !isGeneric }) } catch (e) {}
                  } catch (e) {
                    setPurchasedPools(respPurchased)
                    try { setPurchasedModalContext({ tier, isClass: !isGeneric }) } catch (e) {}
                  }
                })()
              }
            } catch (e) {}
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

          try { suppressStageEffectRef.current = false } catch (e) {}
        }, 600)
      }
    } catch (err) {
      console.error('random purchase failed', err)
      try { suppressStageEffectRef.current = false } catch (e) {}
    }
  }

  // Use the project's LootTierPoolsModal to match shop modal styling/behavior

  // Render button + modal together
  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading || player?.gold < qualityCost}
        className={`group relative flex items-center justify-center bg-neutral-900 border-2 ${
          tier === 'STARTER'
            ? 'border-blue-500/40 hover:border-blue-400 shadow-blue-500/10'
            : tier === 'MID'
            ? 'border-purple-500/40 hover:border-purple-400 shadow-purple-500/10'
            : 'border-amber-500/40 hover:border-amber-400 shadow-amber-500/10'
        } px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md`}
      >
        <div className="flex flex-col items-center">
          <span className={`text-[10px] ${tier === 'STARTER' ? 'text-blue-400' : tier === 'MID' ? 'text-purple-400' : 'text-amber-400'} font-black uppercase tracking-widest leading-none mb-1`}>
            Random {qualityLabel}
          </span>
          <span className="text-lg font-black text-white leading-none">{qualityCost}G</span>
        </div>
      </button>

      {purchasedPools && purchasedPools.length > 0 && (
        <LootTierPoolsModal
          isOpen={true}
          onClose={() => { setPurchasedPools(null); setPurchasedModalContext(null) }}
          purchasedPools={purchasedPools}
          seenPools={[]}
          title={`Random ${qualityLabel}`}
        />
      )}
    </>
  )
}
