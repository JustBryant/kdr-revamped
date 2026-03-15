import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react'
import useShopV2 from './hooks/useShopV2'
import useShopAnimations, { resetEntranceAnimation } from './components/animations/useShopAnimations'

type ShopContextValue = ReturnType<typeof useShopV2> & {
  delayTrainingUntil: number | null
  setDelayTraining: (ms: number) => void
  clearDelayTraining: () => void
  shopHistory: any[]
  addHistory: (entry: any) => void
  // Shopkeeper dialogue controls
  triggerShopkeeperSpecial: (key: string, text?: string, opts?: { timeoutMs?: number }) => void
  clearShopkeeperSpecial: () => void
  // Finish/orchestration helpers for loot exit animation
  finishLootPhase?: () => Promise<void>
  lootExitPhase?: boolean
  setLootExitPhase?: (val: boolean) => void
  rerollLoot?: () => Promise<void>
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function ShopProvider({ kdrId, children }: { kdrId: string; children: ReactNode }) {
  const base = useShopV2({ kdrId })
  const [delayTrainingUntil, setDelayTrainingUntil] = useState<number | null>(null)
  const [shopHistory, setShopHistory] = useState<any[]>([])
  const [shopkeeperSpecial, setShopkeeperSpecial] = useState<any | null>(null)

  // Initialize history from sessionStorage if available
  useEffect(() => {
    try {
      const storedKey = kdrId ? `shopHistory:${kdrId}` : null
      if (storedKey && typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem(storedKey)
        if (raw) {
          try { const parsed = JSON.parse(raw || '[]'); if (Array.isArray(parsed) && parsed.length > 0) setShopHistory(parsed) } catch (e) {}
        }
      }
    } catch (e) {}
  }, [kdrId])

  // Sync history from server player when it changes (authoritative)
  useEffect(() => {
    try {
      const p = (base as any).player
      if (p && p.shopState && Array.isArray(p.shopState.history) && p.shopState.history.length > 0) {
        const serverHistory = p.shopState.history || []
        setShopHistory((prev: any[]) => {
          const prevList = prev || []
          try {
            const optimistic = prevList.filter((it: any) => it && it.optimistic)
            const remainingOptimistic = optimistic.filter((o: any) => {
              const matched = serverHistory.some((s: any) => (s.clientId && s.clientId === o.clientId) || (s.text === o.text && Math.abs((s.ts || 0) - (o.ts || 0)) < 3000))
              return !matched
            })
            return [...serverHistory, ...remainingOptimistic]
          } catch (err) {
            return serverHistory
          }
        })
      }
    } catch (e) {}
  }, [(base as any).player])

  const setDelayTraining = useCallback((ms: number) => {
    try {
      setDelayTrainingUntil(Date.now() + ms)
    } catch (e) {
      // ignore
    }
  }, [])

  const clearDelayTraining = useCallback(() => {
    try { setDelayTrainingUntil(null) } catch (e) {}
  }, [])

  // addHistory: append locally (dedupe) and forward to server via base.appendHistory if available
  const addHistory = useCallback((entry: any) => {
    const e = { ts: entry.ts || Date.now(), ...entry }
    if (e.type === 'dialogue') return
    setShopHistory((prev: any[]) => {
      const list = prev || []
      const last = list.length ? list[list.length - 1] : null
      try {
        if (last && last.type === e.type && last.text === e.text) return list
        if (last && last.text === e.text && Math.abs((e.ts || 0) - (last.ts || 0)) < 5000) return list
      } catch (err) {}
      const next = [...list, e]
      try {
        const key = kdrId ? `shopHistory:${kdrId}` : null
        if (key && typeof window !== 'undefined') window.sessionStorage.setItem(key, JSON.stringify(next || []))
      } catch (err) {}
      return next
    })

    // NOTE: do NOT forward optimistic entries to the server here.
    // Server-side actions (train/chooseStat/etc) will append authoritative history.
  }, [kdrId, base])

  const triggerShopkeeperSpecial = useCallback((key: string, text?: string, opts?: { timeoutMs?: number }) => {
    try {
      setShopkeeperSpecial({ key, text, ts: Date.now() })
      if (opts && opts.timeoutMs && opts.timeoutMs > 0) {
        const id = setTimeout(() => setShopkeeperSpecial(null), opts.timeoutMs)
        // clear timeout if component unmounts
        return () => clearTimeout(id)
      }
    } catch (e) {}
  }, [])

  const clearShopkeeperSpecial = useCallback(() => {
    try { setShopkeeperSpecial(null) } catch (e) {}
  }, [])

  const [lootExitPhase, setLootExitPhase] = useState<boolean>(false)
  const shopWindowRef = useRef<HTMLDivElement | null>(null)
  const animatedPoolsRef = useRef<Set<string>>(new Set())
  const prevOfferIdsRef = useRef<string | null>(null)
  const initialEntranceRef = useRef<boolean>(true)
  const [resyncKey, setResyncKey] = useState<number>(0)

  const {
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
  } = useShopAnimations({
    player: (base as any).player,
    lootExitPhase,
    resyncKey,
    initialEntranceRef,
    animatedPoolsRef,
    prevOfferIdsRef,
    shopWindowRef,
    call: (base as any).call,
    setPlayer: (base as any).setPlayer
  })

  const finishLootPhase = useCallback(async () => {
    try {
      if (!base || typeof (base as any).call !== 'function') return
      // Call server-side finish action and merge returned player snapshot
      const res = await (base as any).call('finish', {}, { autoSetPlayer: false })
      if (res && res.player) {
        const incoming = res.player
        try {
          (base as any).setPlayer((prev: any) => {
            if (!prev) return incoming
            const merged = { ...(prev || {}), ...(incoming || {}) }
            merged.shopState = { ...(prev?.shopState || {}), ...(incoming?.shopState || {}) }
            return merged
          })
        } catch (e) {
          try { (base as any).setPlayer(incoming) } catch (e) {}
        }
      }
    } catch (e) {
      console.error('[ShopContext] finishLootPhase error', e)
    }
  }, [base])

  const rerollLoot = useCallback(async () => {
    try {
      if (!base || typeof (base as any).call !== 'function') return
      // Reset entrance animation state so the incoming offers animate correctly
      try {
        resetEntranceAnimation({ prevOfferIdsRef, animatedPoolsRef, initialEntranceRef, setLootTierTyping, setLootLineProgress, setLootPoolDropProgress, setLootCardFlips, setStartLootPoolAnimation, setResyncKey })
      } catch (e) {}

      // Call server-side reroll; use default autoSetPlayer behavior so useShopV2 updates state
      const res = await (base as any).call('rerollLoot')
      if (res && res.player) {
        try {
          (base as any).setPlayer((prev: any) => {
            if (!prev) return res.player
            const merged = { ...(prev || {}), ...(res.player || {}) }
            merged.shopState = { ...(prev?.shopState || {}), ...(res.player?.shopState || {}) }
            return merged
          })
        } catch (e) {
          try { (base as any).setPlayer(res.player) } catch (e) {}
        }
      }
      return res
    } catch (e) {
      console.error('[ShopContext] rerollLoot error', e)
      return
    }
  }, [base])

  const value: ShopContextValue = { ...(base as any), delayTrainingUntil, setDelayTraining, clearDelayTraining, shopHistory, addHistory, triggerShopkeeperSpecial, clearShopkeeperSpecial, finishLootPhase, lootExitPhase, setLootExitPhase, rerollLoot }

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShopContext() {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShopContext must be used within ShopProvider')
  return ctx
}

export default ShopContext
