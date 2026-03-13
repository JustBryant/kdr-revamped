import React, { useRef, useState } from 'react'
import { useShopContext } from '../../ShopContext'
import StatChooser from '../animations/StatChooser'

type Props = {
  player: any
  displayedStats: any
  statPoints: number
  loading: boolean
  setPlayer: (p: any) => void
  call: (action: string, payload?: any, opts?: { autoSetPlayer?: boolean }) => Promise<any>
  appendHistory?: (entry: any) => void
  finishStatPoint: () => void
  showStatOverlay?: (statCenter: any) => void
  shopWindowRef?: React.RefObject<HTMLDivElement | null>
}

export default function StatPhase({ player, displayedStats, statPoints, loading, setPlayer, call, appendHistory, finishStatPoint, showStatOverlay, shopWindowRef }: Props) {
  const [statButtonsExit, setStatButtonsExit] = useState<boolean>(false)
  const [statAnimating, setStatAnimating] = useState<boolean>(false)
  const [overlayLock, setOverlayLock] = useState<boolean>(false)
  const [bumpedStat, setBumpedStat] = useState<string | null>(null)
  const statHideTimeoutRef = useRef<number | null>(null)
  const overlayUnlockRef = useRef<number | null>(null)
  const ctx = useShopContext()
  // statCenter overlay is now shown via parent flow (LevelUpAnimation)

  const onChooseStat = async (key: string, e: React.MouseEvent) => {
    if (statPoints <= 0) return
    if (statAnimating) return
    if (overlayLock) return
    try {
      setStatAnimating(true)
      const el = (e && (e.currentTarget as HTMLElement)) || null
      if (el && typeof window !== 'undefined') {
        // We no longer show the small in-window stat pop; keep statAnimating for timing
        try { void el.getBoundingClientRect() } catch (e) {}
      }
    } catch (err) {}

    setBumpedStat(key)
    try {
      const oldVal = Number(displayedStats?.[key] ?? 0)
      const newVal = oldVal + 1
      const colorMap: Record<string, string> = { dex: '#d97706', con: '#10b981', str: '#fb7185', int: '#0ea5e9', cha: '#8b5cf6' }
      const chosenColor = colorMap[key] || '#fff'
      // Use parent-provided overlay (reuses LevelUpAnimation) so the stat bump appears
      try { 
        if (showStatOverlay) {
          // lock further stat choices while overlay animates
          setOverlayLock(true)
          if (overlayUnlockRef.current) { try { window.clearTimeout(overlayUnlockRef.current) } catch (e) {} }
          overlayUnlockRef.current = window.setTimeout(() => {
            try { setOverlayLock(false) } catch (e) {}
            try { setStatAnimating(false) } catch (e) {}
            overlayUnlockRef.current = null
          }, 900)
          showStatOverlay({ label: key.toUpperCase(), oldValue: oldVal, newValue: newVal, showNew: false, color: chosenColor })
        }
      } catch (e) {}
    } catch (e) {}

    // optimistic local update
    setPlayer((prev: any) => {
      if (!prev) return prev
      const cur = (prev.shopState && (prev.shopState as any).stats) ? (prev.shopState as any).stats : (prev.stats || {})
      const next = { ...(cur || {}), [key]: (Number(cur?.[key] || 0) + 1) }
      const ss = { ...(prev.shopState || {}), stats: next }
      return { ...prev, shopState: ss }
    })
    window.setTimeout(() => setBumpedStat(null), 1500)

    // optimistic history entry for stat bump
    try {
      const addHist = (ctx as any).addHistory || appendHistory
      const clientId = `c-${Date.now()}`
      const optimisticNewVal = Number(displayedStats?.[key] ?? 0) + 1
      const optimisticEntry = { ts: Date.now(), type: 'stat', text: `Player increased ${key.toUpperCase()} to ${optimisticNewVal}`, stat: key, value: optimisticNewVal, optimistic: true, clientId }
      try { if (addHist) addHist(optimisticEntry) } catch (e) {}
    } catch (e) {}

      try {
        const res = await call('chooseStat', { stat: key }, { autoSetPlayer: false })
        // merge returned player into existing player to avoid a full replace (prevents visual jitter)
        try {
          const incoming = res?.player || {}
          if (incoming) {
            setPlayer((prev: any) => {
              try {
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
                return incoming
              }
            })
          }
        } catch (e) {}
      try {
        // Server already appends a stat history entry inside the 'chooseStat' action,
        // so we avoid calling `appendHistory` here to prevent duplicates.
        const upd = res?.player || player
        const label = (upd?.user?.name) ? (upd.user.name) : 'Player'
        const newVal = (res?.player?.shopState?.stats?.[key] ?? res?.player?.stats?.[key] ?? ((player?.stats?.[key] ?? 0) + 1))
      } catch (e) {}

      try {
        const remaining = Number(res?.player?.shopState?.statPoints ?? res?.player?.statPoints ?? player?.shopState?.statPoints ?? player?.statPoints ?? 0)
        if (remaining > 0) {
            if (statHideTimeoutRef.current) { try { window.clearTimeout(statHideTimeoutRef.current) } catch (e) {} ; statHideTimeoutRef.current = null }
            // re-enable buttons after overlay lock clears (so the stat reveal isn't skipped)
            if (!overlayLock) {
              try { setStatAnimating(false) } catch (e) {}
            }
            // keep chooser visible
        } else {
          if (statHideTimeoutRef.current) { try { window.clearTimeout(statHideTimeoutRef.current) } catch (e) {} }
          // delay training render on the page so training entrance animation isn't interrupted
          try { ctx.setDelayTraining(700) } catch (e) {}
          setStatButtonsExit(true)
          window.setTimeout(() => {
            try { setStatButtonsExit(false); } catch (e) {}
            try { finishStatPoint() } catch (e) {}
          }, 700)
        }
      } catch (e) {}
    } catch (err) {
      // ignore error
    }
  }

  // cleanup timeouts
  React.useEffect(() => {
    return () => {
      try { if (statHideTimeoutRef.current) window.clearTimeout(statHideTimeoutRef.current) } catch (e) {}
      try { if (overlayUnlockRef.current) window.clearTimeout(overlayUnlockRef.current) } catch (e) {}
    }
  }, [])

  return (
    <>
      <div className="w-full">
        <div className="pointer-events-auto w-full max-w-4xl px-6 mx-auto">
          <StatChooser
            statButtonsExit={statButtonsExit}
            statPoints={statPoints}
            displayedStats={displayedStats}
            bumpedStat={bumpedStat}
            loading={loading}
            statAnimating={statAnimating}
            onChooseStat={onChooseStat}
          />
        </div>
      </div>

    </>
  )
}
