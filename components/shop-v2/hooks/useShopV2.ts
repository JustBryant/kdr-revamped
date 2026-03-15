import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'

// Previously forced LOOT -> DONE to disable the phase. Keep snapshots intact now.
function sanitizeIncomingPlayer(p: any) {
  try {
    if (!p) return p
    // Return a shallow copy so callers can merge safely, but preserve stage
    const copy = { ...(p || {}) }
    copy.shopState = { ...(p.shopState || {}) }
    return copy
  } catch (e) {
    return p
  }
}

export default function useShopV2({ kdrId }: { kdrId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [player, setPlayer] = useState<any | null>(null)
  const [kdr, setKdr] = useState<any | null>(null)
  const [shopkeeperDialogues, setShopkeeperDialogues] = useState<any[] | null>(null)

  const call = useCallback(async (action: string, payload: any = {}, opts: { autoSetPlayer?: boolean } = { autoSetPlayer: true }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post('/api/kdr/shop-v2', { kdrId, action, payload })
      const data = res.data || {}
      if (data.player && opts.autoSetPlayer !== false) {
        try { console.debug('[useShopV2.call] autoSetPlayer', { action, autoSetPlayer: opts.autoSetPlayer, playerStage: data.player?.shopState?.stage }) } catch (e) {}
        setPlayer((prev: any) => {
          try {
            const incoming = sanitizeIncomingPlayer(data.player || {})
            if (!prev) return incoming
            const merged = { ...(prev || {}), ...(incoming || {}) }
            merged.shopState = { ...(prev?.shopState || {}), ...(incoming?.shopState || {}) }
            // Defensive: avoid regressing to START if client already progressed
            try {
              const prevStage = prev?.shopState?.stage
              const incStage = incoming?.shopState?.stage
              if (prevStage && prevStage !== 'START' && (!incStage || incStage === 'START')) {
                merged.shopState.stage = prevStage
              }
            } catch (e) {}
            return merged
          } catch (e) {
            return data.player
          }
        })
      } else {
        try { console.debug('[useShopV2.call] no-autoSet', { action, autoSetPlayer: opts.autoSetPlayer, playerPresent: !!data.player }) } catch (e) {}
      }
      setLoading(false)
      return data
    } catch (err: any) {
      // Enhanced logging for debugging API 400s
      try {
        if (err && err.response) {
          console.error('[useShopV2.call] API error', { action, status: err.response.status, data: err.response.data })
          setError(`${err.response.status}: ${JSON.stringify(err.response.data)}`)
        } else {
          console.error('[useShopV2.call] Network/error', err)
          setError(err?.message || String(err))
        }
      } catch (logErr) {
        console.error('[useShopV2.call] Error while logging error', logErr)
        setError(err?.message || String(err))
      }
      setLoading(false)
      throw err
    }
  }, [kdrId])

  // Initial hydrate: fetch KDR and currentPlayer snapshot so UI can show pre-start
  useEffect(() => {
    let mounted = true
    const fetch = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`/api/kdr/${encodeURIComponent(kdrId)}`)
        if (!mounted) return
        const data = res.data || {}
        // API returns the KDR as the response body and may include `currentPlayer`
        setKdr(data)
        if (data.currentPlayer) setPlayer(sanitizeIncomingPlayer(data.currentPlayer))
      } catch (e: any) {
        // ignore
      } finally { if (mounted) setLoading(false) }
    }
    if (kdrId) fetch()
    return () => { mounted = false }
  }, [kdrId])

  // Load dialogues for the chosen shopkeeper when it changes
  useEffect(() => {
    let mounted = true
    const skId = player?.shopState?.shopkeeper?.id
    if (!skId) {
      setShopkeeperDialogues(null)
      return
    }

    const fetchDialogues = async () => {
      try {
        const res = await axios.get(`/api/shopkeepers/${encodeURIComponent(skId)}/dialogues`)
        if (!mounted) return
        setShopkeeperDialogues(res.data || [])
      } catch (e) {
        if (!mounted) return
        setShopkeeperDialogues([])
      }
    }

    fetchDialogues()
    return () => { mounted = false }
  }, [player?.shopState?.shopkeeper?.id])

  // Loot disabled: removed safety-net that fetched loot offers from server

  // Ensure player snapshot is refreshed when the shop stage changes.
  // Some client actions use `autoSetPlayer: false` and rely on callers to setPlayer;
  // this effect guarantees the authoritative player state is fetched after a stage transition
  // so UI components (like LootTierUnlocks) see persistent counts without a full page reload.
  useEffect(() => {
    let mounted = true
    try {
      const stage = player?.shopState?.stage
      const lastStage = (player as any)?._lastRefreshedStage
      // Only refresh when stage changes
      if (stage && stage !== lastStage) {
        // small delay to allow any immediate optimistic updates to settle
        const t = setTimeout(async () => {
          try {
            if (!mounted) return
            // call 'get' which returns the current player snapshot for v2
            const res = await call('get')
            if (!mounted) return
            if (res && res.player) {
              try {
                const incoming = sanitizeIncomingPlayer(res.player || {})
                setPlayer((prev: any) => {
                  try {
                    if (!prev) return { ...incoming, _lastRefreshedStage: stage }
                    const merged = { ...(prev || {}), ...(incoming || {}) }
                    merged.shopState = { ...(prev?.shopState || {}), ...(incoming?.shopState || {}) }
                    // Preserve purchases if server response doesn't include them
                    const prevPurchases = Array.isArray(prev?.shopState?.purchases) ? prev.shopState.purchases : []
                    const incPurchases = Array.isArray(incoming?.shopState?.purchases) ? incoming.shopState.purchases : []
                    merged.shopState.purchases = incPurchases.length ? incPurchases : prevPurchases
                    // Defensive: avoid regressing to START
                    try {
                      const prevStage = prev?.shopState?.stage
                      const incStage = incoming?.shopState?.stage
                      if (prevStage && prevStage !== 'START' && (!incStage || incStage === 'START')) {
                        merged.shopState.stage = prevStage
                      }
                    } catch (e) {}
                    merged._lastRefreshedStage = stage
                    return merged
                  } catch (e) {
                    return { ...incoming, _lastRefreshedStage: stage }
                  }
                })
              } catch (e) {}
            }
          } catch (e) {
            // ignore
          }
        }, 120)
        return () => { mounted = false; try { clearTimeout(t) } catch (e) {} }
      }
    } catch (e) {}
    return () => { mounted = false }
  }, [player?.shopState?.stage, call, setPlayer])

  const pickShopkeeperDialogue = useCallback(async (type: string) => {
    const skId = player?.shopState?.shopkeeper?.id
    if (!skId) return null

    // Ensure dialogues are loaded
    let dialogues = shopkeeperDialogues
    if (!dialogues) {
      try {
        const res = await axios.get(`/api/shopkeepers/${encodeURIComponent(skId)}/dialogues`)
        dialogues = res.data || []
        setShopkeeperDialogues(dialogues)
      } catch (e) {
        dialogues = []
      }
    }

    const pool = Array.isArray(dialogues) ? dialogues.filter((d: any) => d.type === type) : []
    if (!pool || pool.length === 0) return null
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick && pick.text) {
      setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeperGreeting: pick.text } }) : prev)
      return pick.text
    }
    return null
  }, [player?.shopState?.shopkeeper?.id, shopkeeperDialogues, setPlayer])

  const startShop = useCallback(async () => call('start', {}, { autoSetPlayer: false }), [call])

  const appendHistory = useCallback(async (entry: any) => call('appendHistory', entry), [call])

  return {
    kdrId,
    loading,
    error,
    player,
    kdr,
    shopkeeperDialogues,
    pickShopkeeperDialogue,
    call,
    startShop,
    appendHistory,
    setPlayer
  }
}
