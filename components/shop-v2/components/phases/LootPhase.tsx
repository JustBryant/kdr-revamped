import React, { useCallback, useState, useRef } from 'react'
import { useShopContext } from '../../ShopContext'
import LootPoolInstance from '../loot/LootPoolInstance'
import LootPoolDetailModal from '../loot/LootPoolDetailModal'
import useShopCaches from '../../utils/useShopCaches'
import HoverTooltip from '../HoverTooltip'


export default function LootPhase({ lootExitPhase }: { lootExitPhase?: boolean } = {}) {
  const { player, call, setPlayer, loading, lootExitPhase: ctxLootExitPhase } = useShopContext()

  // Local state to satisfy legacy `LootPoolInstance` props
  const [animatingOutGroups, setAnimatingOutGroups] = useState<Set<string>>(new Set())
  const [frozenPools, setFrozenPools] = useState<Record<string, any[]>>({})
  const groupNodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const suppressStageEffectRef = useRef<boolean>(false)

  // Modal + hover state (v2 needs its own hover/modal wiring)
  const [selectedPool, setSelectedPool] = useState<any | null>(null)
  const { cardDetailsCacheRef, ensureCardDetails } = useShopCaches()
  const [hoverTooltip, setHoverTooltip] = useState<any>({ visible: false, x: 0, y: 0, idKey: null, cardLike: null })
  const tooltipScrollRef = useRef<HTMLDivElement | null>(null)

  const showHover = useCallback((e: any, cardLike?: any, idKey?: any, skills?: any[]) => {
    try { if (cardLike && ensureCardDetails) ensureCardDetails(cardLike).catch(() => {}) } catch (err) {}
    try { setHoverTooltip({ visible: true, x: e?.clientX || 0, y: e?.clientY || 0, idKey, cardLike, skills, stats: {} }) } catch (err) {}
  }, [ensureCardDetails])

  const moveHover = useCallback((e: any) => { try { setHoverTooltip((prev: any) => ({ ...(prev || {}), x: e?.clientX || 0, y: e?.clientY || 0 })) } catch (err) {} }, [])
  const hideHover = useCallback(() => { try { setHoverTooltip((prev: any) => ({ ...(prev || {}), visible: false })) } catch (err) {} }, [])

  const openPoolViewer = useCallback((pool: any) => {
    try {
      if (pool && pool.id) {
        try {
          call('markSeen', { poolId: pool.id }).then((res: any) => {
            try { if (res && res.player) setPlayer(res.player) } catch (e) {}
          }).catch(() => {})
        } catch (e) {}
      }
    } catch (e) {}
    // open the modal to view full pool
    setSelectedPool(pool)
  }, [call, setPlayer, player, setFrozenPools, setAnimatingOutGroups, groupNodeRefs, suppressStageEffectRef])

  const closePoolViewer = useCallback(() => setSelectedPool(null), [])

  const handlePurchaseFromModal = useCallback(
    async (pool: any) => {
      if (!pool || !pool.id) return
      const key = `${(pool.tier || '').toUpperCase()}_${pool.isGeneric ? 'generic' : 'class'}`
      const poolsInGroup = (player?.shopState?.lootOffers || []).filter((p: any) => `${(p.tier || '').toUpperCase()}_${p.isGeneric ? 'generic' : 'class'}` === key)

      try {
        suppressStageEffectRef.current = true
        const res = await call('purchaseLootPool', { poolId: pool.id }, { autoSetPlayer: false })

        if (res && res.error) {
          alert(`Purchase failed: ${res.error}`)
          suppressStageEffectRef.current = false
          return
        }

        if (!res || !res.player) {
          suppressStageEffectRef.current = false
          return
        }

        // Freeze the current group's pools and animate them out
        setFrozenPools((prev) => ({ ...prev, [key]: poolsInGroup }))
        setAnimatingOutGroups((prev) => new Set(prev).add(key))

        const groupEl = groupNodeRefs.current[key]
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
            setPlayer((prev: any) => {
              const incoming = res.player || {}
              const merged = { ...(prev || {}), ...(incoming || {}) }
              const prevPurchases = Array.isArray(prev?.shopState?.purchases) ? prev.shopState.purchases : []
              const incPurchases = Array.isArray(incoming?.shopState?.purchases) ? incoming.shopState.purchases : []
              const mergedPurchases = incPurchases.length ? incPurchases : prevPurchases
              merged.shopState = { ...(prev?.shopState || {}), ...(incoming?.shopState || {}) }
              merged.shopState.purchases = mergedPurchases
              merged.shopState = { ...(merged.shopState || {}), stage: merged.shopState?.stage || 'LOOT' }
              return merged
            })
          } catch (e) {}

          setAnimatingOutGroups((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
          setFrozenPools((prev) => {
            const next = { ...prev }
            delete next[key]
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

          suppressStageEffectRef.current = false
        }, 600)
      } catch (err) {
        try { suppressStageEffectRef.current = false } catch (e) {}
      }
    },
    [call, setPlayer, player, setFrozenPools, setAnimatingOutGroups, groupNodeRefs, suppressStageEffectRef]
  )

  const allPools = player?.shopState?.lootOffers || []
  const handleNextPool = useCallback(() => {
    if (!selectedPool || allPools.length <= 1) return
    const idx = allPools.findIndex((p: any) => String(p.id) === String(selectedPool.id))
    if (idx === -1) return
    const nextIdx = (idx + 1) % allPools.length
    setSelectedPool(allPools[nextIdx])
  }, [selectedPool, allPools])

  const handlePrevPool = useCallback(() => {
    if (!selectedPool || allPools.length <= 1) return
    const idx = allPools.findIndex((p: any) => String(p.id) === String(selectedPool.id))
    if (idx === -1) return
    const prevIdx = (idx - 1 + allPools.length) % allPools.length
    setSelectedPool(allPools[prevIdx])
  }, [selectedPool, allPools])

  if (!player?.shopState?.lootOffers || player.shopState.lootOffers.length === 0) return null

  return (
    <div className="w-full">
      <LootPoolInstance
        player={player}
        animatingOutGroups={animatingOutGroups}
        frozenPools={frozenPools}
        groupNodeRefs={groupNodeRefs}
        loading={loading}
        lootExitPhase={typeof ctxLootExitPhase !== 'undefined' ? !!ctxLootExitPhase : !!lootExitPhase}
        call={call}
        setPlayer={setPlayer}
        openPoolViewer={openPoolViewer}
        setFrozenPools={setFrozenPools}
        setAnimatingOutGroups={setAnimatingOutGroups}
        suppressStageEffectRef={suppressStageEffectRef}
      />
      {selectedPool && (
        <LootPoolDetailModal
          pool={selectedPool}
          onClose={closePoolViewer}
          showHover={showHover}
          moveHover={moveHover}
          hideHover={hideHover}
          onTooltipWheel={() => {}}
          hoverTooltip={hoverTooltip}
          cardDetailsCacheRef={cardDetailsCacheRef}
          tooltipScrollRef={tooltipScrollRef}
          ensureCardDetails={ensureCardDetails}
          onPurchase={handlePurchaseFromModal}
          loading={loading}
          onNext={handleNextPool}
          onPrev={handlePrevPool}
        />
      )}
      <HoverTooltip hoverTooltip={hoverTooltip} cardDetailsCacheRef={cardDetailsCacheRef} tooltipScrollRef={tooltipScrollRef} />
    </div>
  )
}
