import React, { useEffect, useState } from 'react'

interface UseShopAnimationsProps {
  player: any
  lootExitPhase: boolean
  resyncKey: number
  initialEntranceRef: React.MutableRefObject<boolean>
  animatedPoolsRef: React.MutableRefObject<Set<string>>
  prevOfferIdsRef: React.MutableRefObject<string | null>
  shopWindowRef: React.MutableRefObject<HTMLDivElement | null>
  call: (action: string, payload?: any) => Promise<any>
  setPlayer: (p: any) => void
}

export default function useShopAnimations({
  player,
  lootExitPhase,
  // resyncKey is intentionally unused by this minimal implementation but kept
  // for compatibility with callers that pass it.
  resyncKey,
  initialEntranceRef,
  animatedPoolsRef,
  prevOfferIdsRef,
  shopWindowRef,
  call,
  setPlayer
}: UseShopAnimationsProps) {
  const [lootTierTyping, setLootTierTyping] = useState<Record<string, number>>({})
  const [lootLineProgress, setLootLineProgress] = useState<Record<string, number>>({})
  const [lootPoolDropProgress, setLootPoolDropProgress] = useState<Record<string, number>>({})
  const [lootPoolDropProgressPool, setLootPoolDropProgressPool] = useState<Record<string, number>>({})
  const [lootCardFlips, setLootCardFlips] = useState<Record<string, number[]>>({})
  const [startLootPoolAnimation, setStartLootPoolAnimation] = useState<boolean>(false)

  // Minimal effect: keep prevOfferIdsRef in sync with current offers so
  // higher-level code can rely on it. This intentionally keeps behaviour
  // lightweight while exposing the same API as the original hook.
  useEffect(() => {
    if (!player?.shopState?.lootOffers || player.shopState.lootOffers.length === 0) return
    const offerIds = (player.shopState.lootOffers || []).map((p: any) => String(p.id)).join(',')
    const prevIdsStr = prevOfferIdsRef.current || null
    if ((prevIdsStr || '') === offerIds && prevIdsStr !== null) return
    prevOfferIdsRef.current = offerIds
  }, [player?.shopState?.lootOffers, prevOfferIdsRef])

  return {
    lootTierTyping,
    lootLineProgress,
    lootPoolDropProgress,
    lootPoolDropProgressPool,
    lootCardFlips,
    startLootPoolAnimation,
    setLootTierTyping,
    setLootLineProgress,
    setLootPoolDropProgress,
    setLootCardFlips,
    setStartLootPoolAnimation
  }
}

// Helper: perform the legacy-style entrance reset sequence.
export function resetEntranceAnimation(opts: {
  prevOfferIdsRef: React.MutableRefObject<string | null>
  animatedPoolsRef: React.MutableRefObject<Set<string>>
  initialEntranceRef: React.MutableRefObject<boolean>
  setLootTierTyping: (v: Record<string, number>) => void
  setLootLineProgress: (v: Record<string, number>) => void
  setLootPoolDropProgress: (v: Record<string, number>) => void
  setLootCardFlips: (v: Record<string, number[]>) => void
  setStartLootPoolAnimation: (v: boolean) => void
  setResyncKey?: (fn: (prev: number) => number) => void
}) {
  try {
    opts.prevOfferIdsRef.current = null
    opts.animatedPoolsRef.current = new Set()
    opts.initialEntranceRef.current = true
    try { opts.setLootTierTyping({}) } catch (e) {}
    try { opts.setLootLineProgress({}) } catch (e) {}
    try { opts.setLootPoolDropProgress({}) } catch (e) {}
    try { opts.setLootCardFlips({}) } catch (e) {}
    try { opts.setStartLootPoolAnimation(false) } catch (e) {}
    if (opts.setResyncKey) {
      try { opts.setResyncKey(prev => prev + 1) } catch (e) {}
    }
  } catch (e) {
    // swallow — best-effort reset
  }
}
