import React, { useState, useRef } from 'react'
import { computeLevel } from '../../../../lib/shopHelpers'
import { useShopContext } from '../../ShopContext'

type Props = {
  player: any
  loading: boolean
  setPlayer: (p: any) => void
  call: (action: string, payload?: any, opts?: { autoSetPlayer?: boolean }) => Promise<any>
  appendHistory?: (entry: any) => void
  onTrainingResult?: (updatedPlayer: any) => boolean
}

const TrainingPhase: React.FC<Props> = ({ player, loading, setPlayer, call, appendHistory, onTrainingResult }) => {
  const [trainingButtonsExit, setTrainingButtonsExit] = useState<boolean>(false)

  const ctx = useShopContext()
  const kdr = (ctx as any).kdr
  const defaults: any = { trainingCost: 50, trainingXp: 50, levelXpCurve: [0, 100, 300, 600, 1000] }
  const settings = kdr ? (kdr.settingsSnapshot ? { ...defaults, ...(kdr.settingsSnapshot || {}) } : (kdr.format && kdr.format.gameSettings ? { ...defaults, ...(kdr.format.gameSettings || {}) } : defaults)) : defaults

  const playerGold = Number(player?.gold || 0)
  const trainingCost = Number(settings.trainingCost ?? player?.shopState?.trainingCost ?? defaults.trainingCost)
  const trainingXp = Number(settings.trainingXp ?? defaults.trainingXp ?? 0)
  // compute sessions to next level using settings.levelXpCurve
  const currentLevel = computeLevel(Number(player?.xp || 0), settings.levelXpCurve)
  const currentLevelXp = (settings.levelXpCurve && settings.levelXpCurve.length > currentLevel) ? settings.levelXpCurve[currentLevel] : 0
  const nextLevelXp = (settings.levelXpCurve && settings.levelXpCurve.length > (currentLevel + 1)) ? settings.levelXpCurve[currentLevel + 1] : (currentLevelXp + 100)
  const xpToNext = Math.max(0, nextLevelXp - Number(player?.xp || 0))
  const sessionsToNext = Math.max(1, Math.ceil(xpToNext > 0 ? (xpToNext / Math.max(1, trainingXp)) : 1))
  const cha = Number((player?.shopState && (player.shopState as any).stats) ? (player.shopState as any).stats?.cha : (player?.stats?.cha || 0))
  const rerollsUsed = Number(player?.shopState?.rerollsUsed || 0)

  const onTrain = async () => {
    if (loading || playerGold < trainingCost) return
    const priorStage = player?.shopState?.stage || 'TRAINING'
    const prevHistory = (player?.shopState && player.shopState.history) ? player.shopState.history : []
    let leveled = false
    // Add an optimistic history entry so UI updates immediately; it will be reconciled when server returns
    try {
      const addHist = (ctx as any).addHistory || appendHistory
      const clientId = `c-${Date.now()}`
      const optimisticEntry = { type: 'train', ts: Date.now(), text: `Player trained and gained ${trainingXp} XP`, xp: trainingXp, gold: -trainingCost, optimistic: true, clientId }
      try { if (addHist) addHist(optimisticEntry) } catch (e) {}

      // do NOT add an optimistic level entry here; rely on server `levelEntry` for authoritative message

      // detect optimistic level-up (based on current xp and trainingXp) and switch UI to SKILL phase immediately
      try {
        const curXp = Number(player?.xp || 0)
        const curLevel = computeLevel(curXp, settings.levelXpCurve)
        const nextLevelXp = (settings.levelXpCurve && settings.levelXpCurve.length > (curLevel + 1)) ? settings.levelXpCurve[curLevel + 1] : (settings.levelXpCurve[curLevel] || 0) + 100
        const willLevel = (curXp + Number(trainingXp || 0)) >= nextLevelXp
        if (willLevel) {
          try {
            try { console.debug('[TrainingPhase] optimistic level willLevel -> set local stage SKILL') } catch (e) {}
            setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), stage: 'SKILL' } }) : prev)
            setTrainingButtonsExit(true)
          } catch (e) {}
        }
      } catch (e) {}

      const res = await call('train', {}, { autoSetPlayer: false })
      // if server included a level entry, show it shortly after the award for better ordering
      try {
        if (res && res.levelEntry) {
          const addHist = (ctx as any).addHistory || appendHistory
          if (addHist) window.setTimeout(() => { try { addHist(res.levelEntry) } catch (e) {} }, 300)
        }
      } catch (e) {}
      const serverPlayer = res && res.player ? res.player : null

      // Ask flow whether this training caused a level-up (flow will set phase/overlays)
      try {
        if (typeof onTrainingResult === 'function') {
          leveled = Boolean(onTrainingResult(serverPlayer))
        }
      } catch (e) {}

      if (serverPlayer) {
        const serverShop = serverPlayer.shopState || {}
        if (leveled) {
          // On level-up: don't replace the entire player immediately (causes visual flash).
          // Instead merge the authoritative fields after the exit animation completes.
          try { console.debug('[TrainingPhase] server indicates level-up; scheduling merged server player apply', { serverStage: serverShop.stage }) } catch (e) {}
          // keep exit flag set; apply authoritative server fields after animation
          const applyAfter = 700
          window.setTimeout(() => {
            try {
              setPlayer((prev: any) => {
                if (!prev) return serverPlayer
                try {
                  const mergedHistory = (serverShop.history && serverShop.history.length > 0) ? serverShop.history : (prev.shopState && prev.shopState.history) || []
                  const nextShop = { ...(prev.shopState || {}), ...(serverShop || {}) }
                  // prefer server stage if meaningful, otherwise use SKILL (optimistic)
                  nextShop.stage = serverShop.stage && serverShop.stage !== 'START' ? serverShop.stage : 'SKILL'
                  nextShop.history = mergedHistory
                  return { ...prev, gold: typeof serverPlayer.gold === 'number' ? serverPlayer.gold : prev.gold, xp: typeof serverPlayer.xp === 'number' ? serverPlayer.xp : prev.xp, shopState: nextShop }
                } catch (e) { return serverPlayer }
              })
            } catch (e) {}
          }, applyAfter)
          setTrainingButtonsExit(true)
        } else {
          // Avoid replacing the entire player object to prevent large reflows.
          // Apply only the minimal authoritative fields returned by the server.
          try { console.debug('[TrainingPhase] applying partial server update (no level)', { priorStage, serverStage: serverShop.stage }) } catch (e) {}
          setPlayer((prev: any) => {
            if (!prev) return serverPlayer
            try {
              const mergedHistory = (serverShop.history && serverShop.history.length > 0) ? serverShop.history : prevHistory
              const nextShop = { ...(prev.shopState || {}), ...(serverShop || {}) }
              // preserve the priorStage unless server intentionally changed it
              nextShop.stage = serverShop.stage && serverShop.stage !== 'START' ? serverShop.stage : priorStage
              nextShop.history = mergedHistory
              return { ...prev, gold: typeof serverPlayer.gold === 'number' ? serverPlayer.gold : prev.gold, xp: typeof serverPlayer.xp === 'number' ? serverPlayer.xp : prev.xp, shopState: nextShop }
            } catch (e) {
              return serverPlayer
            }
          })
        }
      }
    } catch (e) {
      // ignore
    } finally {
      if (!leveled) setTrainingButtonsExit(false)
    }
  }

  // Keep the training buttons hidden when the server-stage indicates
  // we've moved past TRAINING. This ensures the UI doesn't remain
  // visible until a manual refresh.
  // Guard against rapid stage flips that can cause the training-entry
  // animation to play briefly when we actually want the buttons to stay hidden
  // (for example during an optimistic level-up followed by a quick server sync).
  const _lastStageRef = useRef<string | null>(null)
  const _lastStageChangeTs = useRef<number>(0)
  React.useEffect(() => {
    try {
      const stage = (player && player.shopState && player.shopState.stage) ? player.shopState.stage : 'TRAINING'
      const prev = _lastStageRef.current
      const now = Date.now()
      // If we're no longer in TRAINING, ensure buttons are hidden.
      if (stage !== 'TRAINING') {
        setTrainingButtonsExit(true)
      } else {
        // stage === 'TRAINING'
        // Only allow the buttons to slide back in if the previous stage
        // was also TRAINING or if enough time has passed since the last
        // stage change (to avoid quick re-entry flashes).
        const elapsed = now - (_lastStageChangeTs.current || 0)
        if (prev === 'TRAINING' || elapsed > 800) {
          setTrainingButtonsExit(false)
        } else {
          // keep hidden during short transitions
          setTrainingButtonsExit(true)
        }
      }
      _lastStageRef.current = stage
      _lastStageChangeTs.current = now
    } catch (e) {}
  }, [player && player.shopState && player.shopState.stage])

  const onDontTrain = async () => {
    // Start exit animation and optimistically add history, then fire RPC without awaiting
    setTrainingButtonsExit(true)
    const prevHistory = (player?.shopState && player.shopState.history) ? player.shopState.history : []
    const addHist = (ctx as any).addHistory || appendHistory
    const clientId = `c-${Date.now()}`
    const optimisticEntry = { type: 'train', ts: Date.now(), text: `Player skipped training`, optimistic: true, clientId }
    try { if (addHist) addHist(optimisticEntry) } catch (e) {}

    // Fire-and-forget so UI exit animation is immediate and not blocked by network
    call('skipTraining', {}, { autoSetPlayer: false }).then((res: any) => {
      try {
        const serverPlayer = res && res.player ? res.player : null
        if (serverPlayer) {
          const serverShop = serverPlayer.shopState || {}
          const mergedHistory = (serverShop.history && serverShop.history.length > 0) ? serverShop.history : prevHistory
          // Apply minimal partial update to avoid full reflow/flash
          setPlayer((prev: any) => {
            if (!prev) return serverPlayer
            try {
              const nextShop = { ...(prev.shopState || {}), ...(serverShop || {}) }
              nextShop.history = mergedHistory
              // prefer server stage if it's meaningful
              nextShop.stage = serverShop.stage && serverShop.stage !== 'START' ? serverShop.stage : prev.shopState?.stage || nextShop.stage
              return { ...prev, gold: typeof serverPlayer.gold === 'number' ? serverPlayer.gold : prev.gold, xp: typeof serverPlayer.xp === 'number' ? serverPlayer.xp : prev.xp, shopState: nextShop }
            } catch (e) { return serverPlayer }
          })
          // safety: if backend skipped straight to loot, fetch loot offers
          if (res && res.skippedToLoot) {
            try { call('lootOffers').catch(() => {}) } catch (e) {}
          }
        }
      } catch (e) {}
    }).catch(() => {})

    // After the CSS exit duration, hide the choices. Do NOT clear
    // `trainingButtonsExit` here — keep the exit flag set until the
    // server returns the authoritative stage update. Clearing it
    // prematurely causes the buttons to slide back in while treasures
    // are being displayed.
    window.setTimeout(() => {
      try { /* keep choices hidden */ } catch (e) {}
    }, 700)
  }

  return (
    <div className="mt-6 w-full">
      <div className="w-full flex justify-center">
        <div style={{ width: '100%', maxWidth: '720px' }}>
          <div className="training-wrap" style={{ transform: trainingButtonsExit ? 'translateX(-220%)' : 'translateX(0)', transition: 'transform 700ms cubic-bezier(.2,.9,.2,1), opacity 300ms', opacity: trainingButtonsExit ? 0 : 1 }}>
            <div className="h-[88px] flex items-center justify-center">
              <div className="inline-flex flex-col sm:flex-row items-center gap-4" style={{ zIndex: 20 }}>
                <button style={{ animationDelay: '0ms' }} className="px-8 py-4 bg-emerald-600 text-white rounded-lg text-xl font-semibold shadow-lg min-w-[160px] inline-flex items-center justify-center gap-3 train-left transform transition-transform duration-150 hover:scale-105 hover:shadow-2xl focus:outline-none" disabled={loading || (playerGold < trainingCost)} onClick={async () => { try { await onTrain() } catch (e) {} }}>
                  <span>Train</span>
                  <span className="text-sm opacity-90">-{trainingCost}g</span>
                </button>
                <button style={{ animationDelay: '120ms' }} className="px-8 py-4 bg-gray-600 text-white rounded-lg text-xl font-semibold shadow min-w-[160px] flex items-center justify-center train-right transform transition-transform duration-150 hover:scale-105 hover:shadow-lg focus:outline-none" disabled={loading} onClick={async () => { try { await onDontTrain() } catch (e) {} }}>
                  Don't Train
                </button>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-300 text-center train-footnote" style={{ animationDelay: '560ms' }}>
              Cost: <span className="font-semibold text-white">{trainingCost} gold</span> — Sessions to next level: <span className="font-semibold text-white">{sessionsToNext}</span>
              
            </div>
            <style jsx>{`
              .train-left { transform: translateX(-120%); opacity: 0; }
              .train-right { transform: translateX(120%); opacity: 0; }
              .train-footnote { transform: translateY(-18px); opacity: 0; }
              @keyframes trainInLeft { 0% { transform: translateX(-120%); opacity: 0 } 60% { transform: translateX(8px); opacity: 1 } 100% { transform: translateX(0); opacity: 1 } }
              @keyframes trainInRight { 0% { transform: translateX(120%); opacity: 0 } 60% { transform: translateX(-8px); opacity: 1 } 100% { transform: translateX(0); opacity: 1 } }
              @keyframes footnoteIn { 0% { transform: translateY(-18px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
              .train-left { animation: trainInLeft 420ms cubic-bezier(.2,.9,.2,1) forwards; }
              .train-right { animation: trainInRight 420ms cubic-bezier(.2,.9,.2,1) forwards; }
              .train-footnote { animation: footnoteIn 360ms cubic-bezier(.2,.9,.2,1) forwards; }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingPhase

