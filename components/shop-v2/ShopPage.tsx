import React from 'react'
import { useLayoutEffect, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { ShopProvider, useShopContext } from './ShopContext'
import UserPanel from './components/panels/UserPanel'
import SellModal from './components/panels/SellModal'
import Shopkeeper from './components/panels/Shopkeeper'
import ShopkeeperDialogue from './components/ShopkeeperDialogue'
import LootTierUnlocks from './components/panels/LootTierUnlocks'
import QuickClassButton from './components/panels/QuickClassButton'
import ClassQuickView from './components/panels/ClassQuickView'
import StartButton from './components/ui/StartButton'
import FinishShopButton from './components/ui/FinishShopButton'
import RerollAllButton from './components/ui/RerollAllButton'
import useShopFlow from './flow/useShopFlow'
import { computeLevel } from '../../lib/shopHelpers'
import LevelUpAnimation from './components/animations/LevelUpAnimation'
import StatPhase from './components/phases/StatPhase'
import SkillChoicePanel from './components/phases/SkillChoicePanel'
import TrainingPhase from './components/phases/TrainingPhase'
import TreasurePhase from './components/phases/TreasurePhase'
import LootPhase from './components/phases/LootPhase'
import ShopWindow from './components/layout/ShopWindow'
// Loot pools temporarily disabled in v2 preview

function Inner({ kdrId }: { kdrId: string }) {
  // Scale wrapper refs & state (match original shop responsive scaler)
  const fullParentRef = useRef<HTMLDivElement | null>(null)
  const fullChildRef = useRef<HTMLDivElement | null>(null)
  const shopWindowRef = useRef<HTMLDivElement | null>(null)
  const lootRef = useRef<HTMLDivElement | null>(null)
  const quickWrapperRef = useRef<HTMLDivElement | null>(null)
  const quickBtnRef = useRef<HTMLButtonElement | null>(null)
  const [scale, setScale] = useState<number>(1)
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined)
  const [currentDesignWidth, setCurrentDesignWidth] = useState<number>(1600)
  const [quickOffset, setQuickOffset] = useState<number | null>(null)
  const [rightColHeight, setRightColHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const parent = fullParentRef.current
    const child = fullChildRef.current
    if (!parent || !child) return

    const compute = () => {
      const availW = Math.max(320, (document.documentElement.clientWidth || window.innerWidth) - 48)
      const dw = 1600
      setCurrentDesignWidth(dw)
      const naturalH = child.offsetHeight || 0
      const s = Math.min(1, availW / dw)
      const finalScale = Math.max(0.5, s)
      setScale(finalScale)
      setScaledHeight(naturalH * finalScale)
    }

    compute()
    const onResize = () => compute()
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(parent)
    ro.observe(child)
    return () => {
      window.removeEventListener('resize', onResize)
      try { ro.disconnect() } catch (e) {}
    }
  }, [])

  // Measure LootTierUnlocks and quick button to align them vertically
  useLayoutEffect(() => {
    const computeOffset = () => {
      try {
        const lootEl = lootRef.current
        const quickEl = quickWrapperRef.current
        const container = fullChildRef.current
        if (!lootEl || !quickEl || !container) return
        const lootRect = lootEl.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const quickH = quickEl.offsetHeight || 0
        // position quick button so its center aligns with loot element center
        const desired = (lootRect.top - containerRect.top) + (lootRect.height / 2) - (quickH / 2)
        setQuickOffset(Math.max(8, Math.round(desired)))
      } catch (e) {
        // ignore
      }
    }
    computeOffset()
    window.addEventListener('resize', computeOffset)
    return () => { try { window.removeEventListener('resize', computeOffset) } catch (e) {} }
  }, [scale])

  // Measure ShopWindow height so right column can match and we can anchor top/bottom
  useLayoutEffect(() => {
    const computeRight = () => {
      try {
        const w = shopWindowRef.current
        if (!w) return
        const rect = (w as HTMLElement).getBoundingClientRect()
        setRightColHeight(Math.round(rect.height))
      } catch (e) {}
    }
    computeRight()
    window.addEventListener('resize', computeRight)
    const ro = new ResizeObserver(computeRight)
    if (shopWindowRef.current) ro.observe(shopWindowRef.current)
    return () => {
      try { window.removeEventListener('resize', computeRight) } catch (e) {}
      try { ro.disconnect() } catch (e) {}
    }
  }, [scale, shopWindowRef?.current])
  const { player, loading, startShop, setPlayer, call, appendHistory, kdr, delayTrainingUntil, addHistory, shopHistory, rerollLoot, lootExitPhase } = useShopContext()
  const router = useRouter()
  const [sellOpen, setSellOpen] = useState(false)
  const [classDetails, setClassDetails] = useState<any | null>(null)
  const defaults: any = { levelXpCurve: [0, 100, 300, 600, 1000], xpPerRound: 100, trainingCost: 50, trainingXp: 50 }
  const settings = kdr ? (kdr.settingsSnapshot ? { ...defaults, ...(kdr.settingsSnapshot || {}) } : (kdr.format && kdr.format.gameSettings ? { ...defaults, ...(kdr.format.gameSettings || {}) } : defaults)) : defaults

  const flow = useShopFlow({ player, setPlayer, startShop, settings, addHistory })

  // If flow is awaiting a skill offer, advance when server clears pendingSkillChoices
  // NOTE: skill offer finishing should be handled after exit animations complete
  const [classOverlayMounted, setClassOverlayMounted] = useState(false)
  const [overlayOpenTs, setOverlayOpenTs] = useState<number | null>(null)
  const [classOverlayActive, setClassOverlayActive] = useState(false)
  const [showIframe, setShowIframe] = useState(false)
  const [iframeActive, setIframeActive] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Stat chooser state and animation orchestration (ported from original shop)
  // Stat orchestration moved to StatPhase component

  // Prefetch minimal class details as soon as we know player's classId so
  // the small thumbnail in the shop button is ready before the user clicks.
  React.useEffect(() => {
    let mounted = true
    const cid = player?.classId
    if (!cid) return
    if (classDetails && classDetails.id === cid) return
    const fetchPreview = async () => {
      try {
        const res = await axios.get(`/api/classes/${encodeURIComponent(cid)}`)
        if (!mounted) return
        setClassDetails(res.data || null)
      } catch (e) {
        // ignore
      }
    }
    fetchPreview()
    return () => { mounted = false }
  }, [player?.classId])

  const openClassQuickView = () => {
    const ts = Date.now()
    setOverlayOpenTs(ts)
    setClassOverlayMounted(true)
    // allow mount, then animate in
    setTimeout(() => setClassOverlayActive(true), 20)
    setShowIframe(true)
  }

  const closeClassQuickView = () => {
    setClassOverlayActive(false)
    setShowIframe(false)
    setIframeActive(false)
    setIframeLoaded(false)
    setTimeout(() => { setClassOverlayMounted(false); setOverlayOpenTs(null) }, 420)
  }

  const onIframeLoad = () => {
    setIframeLoaded(true)
    setTimeout(() => setIframeActive(true), 60)
  }



  const stage = player?.shopState?.stage || 'START'
  const greeting = player?.shopState?.shopkeeperGreeting || player?.shopState?.shopkeeper?.name || null

  if (loading && !player) {
    return <div className="p-8">Loading shop…</div>
  }

  

  const displayedStats = ((player?.shopState && (player.shopState as any).stats) ? (player.shopState as any).stats : (player?.stats || {}))
  const statPoints = Number((player?.shopState && typeof player.shopState.statPoints !== 'undefined') ? player.shopState.statPoints : (player?.shopState?.statPoints ?? 0) || 0)
  const currentLevel = (player && typeof player.xp === 'number') ? computeLevel(Number(player.xp || 0), settings.levelXpCurve) : 0

  if (!player || stage === 'START') {
    return (
      <>
      <div
        ref={fullParentRef}
        className="p-6 min-h-screen w-full overflow-x-hidden bg-transparent flex flex-col items-center"
        style={{ height: scaledHeight ? `${scaledHeight}px` : undefined, overflow: 'hidden' }}
      >
        <div ref={fullChildRef} className="w-full shrink-0" style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: scale < 1 ? `${currentDesignWidth}px` : '100%', display: 'block' }}>
          <div className="w-full px-4">
            <div className="grid items-start gap-12" style={{ gridTemplateColumns: '260px 1fr 420px' }}>
              <div className="flex-none">
                <Shopkeeper />
                <LootTierUnlocks />
              </div>

              <div className="flex-1">
                <div style={{ transform: 'translateY(60px)' }}>
                  <ShopWindow ref={shopWindowRef}>
                  
                  <div className="absolute left-6 right-6 z-10" style={{ top: '44px' }}>
                    <ShopkeeperDialogue />
                  </div>
                  <div className="absolute left-0 right-0 z-20" style={{ top: '180px' }}>
                    <div className="flex justify-center">
                      <StartButton onClick={() => flow.handleStart()} loading={loading || flow.phase === 'IN_PROGRESS'} disabled={loading || flow.phase === 'IN_PROGRESS'} />
                    </div>
                  </div>
                  {flow.phase === 'SKILL_OFFER' ? (
                    <div style={{ marginTop: '84px' }}>
                      <SkillChoicePanel shopWindowRef={shopWindowRef} finishSkillOffer={flow.finishSkillOffer} />
                    </div>
                  ) : null}
                  {flow.phase === 'STAT_POINT' ? (
                    <div style={{ marginTop: '84px' }}>
                      <StatPhase
                        player={player}
                        displayedStats={displayedStats}
                        statPoints={statPoints}
                        loading={loading}
                        setPlayer={setPlayer}
                        call={call}
                        appendHistory={addHistory}
                        finishStatPoint={flow.finishStatPoint}
                        shopWindowRef={shopWindowRef}
                      />
                    </div>
                  ) : null}
                  </ShopWindow>
                </div>

                <div style={{ marginTop: '88px' }} className="flex items-center justify-between">
                  <div className="flex items-center">
                      <QuickClassButton ref={quickBtnRef} onClick={(e: any) => { e.stopPropagation(); openClassQuickView() }} classDetails={classDetails || player?.classDetails || player?.class} player={player} />
                  </div>
                  <div className="flex items-center space-x-4">
                    {(player?.shopState?.stage === 'LOOT') && (
                      <>
                        <button
                          onClick={() => setSellOpen(true)}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-4 rounded-xl shadow-lg flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-amber-500/10 min-w-[120px]"
                          style={{ transform: 'translateZ(0)' }}
                        >
                          <span className="text-xl leading-none font-black uppercase tracking-tighter">Sell</span>
                          <span className="text-[10px] font-bold text-black/70 mt-1">Treasures & Skills</span>
                        </button>
                        <RerollAllButton />
                        <FinishShopButton />
                      </>
                    )}
                  </div>
                </div>
              </div>

                      <div className="flex-none" style={ rightColHeight ? { height: `${rightColHeight}px` } : undefined }>
                        <div style={{ transform: 'translateY(60px)', height: '100%' }}>
                          <UserPanel statPoints={statPoints} displayedStats={displayedStats} currentLevel={currentLevel} player={player} shopHistory={(player?.shopState?.history || [])} selectedCard={null} />
                        </div>
                      </div>
            </div>
          </div>
        </div>
      </div>
      <ClassQuickView mounted={classOverlayMounted} overlayOpenTs={overlayOpenTs} classOverlayActive={classOverlayActive} showIframe={showIframe} iframeActive={iframeActive} iframeLoaded={iframeLoaded} id={kdrId} playerKey={player?.playerKey} classDetails={classDetails || player?.classDetails || player?.class} onClose={closeClassQuickView} onIframeLoad={onIframeLoad} />
      {flow.levelUpInfo && flow.showLevelUp ? <LevelUpAnimation info={flow.levelUpInfo} onDone={() => flow.finishLevelUp()} /> : null}
      <SellModal open={sellOpen} onClose={() => setSellOpen(false)} />
      </>
    )
  }

  // Render shop window once started: right user panel
  return (
    <div
      ref={fullParentRef}
      className="p-6 min-h-screen w-full overflow-x-hidden bg-transparent flex flex-col items-center"
      style={{ height: scaledHeight ? `${scaledHeight}px` : undefined, overflow: 'hidden' }}
    >
      <div ref={fullChildRef} className="w-full shrink-0" style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: scale < 1 ? `${currentDesignWidth}px` : '100%', display: 'block' }}>
        <div className="w-full px-4">
          <div className="grid items-start gap-12" style={{ gridTemplateColumns: '260px 1fr 420px' }}>
            <div className="flex-none">
              <Shopkeeper />
              <LootTierUnlocks />
            </div>

            <div className="flex-1">
                <div style={{ transform: 'translateY(60px)' }}>
                  <ShopWindow ref={shopWindowRef}>
                <div className="flex items-start justify-center">
                  {/* Loot pools are disabled in the v2 preview. */}
                </div>
                <div className="absolute left-6 right-6 z-10" style={{ top: '44px' }}>
                  <ShopkeeperDialogue />
                </div>
                {player?.shopState?.stage === 'DONE' && (
                  <div style={{ marginTop: '84px' }}>
                    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                      <div className="text-4xl">👋</div>
                      <h2 className="text-2xl font-bold text-white">Shop Complete!</h2>
                      <p className="text-gray-400 max-w-sm">
                        You've finished your shop session. You can now close this window or continue to review your gains.
                      </p>
                      <button
                        onClick={() => router.push(`/kdr/${kdrId}`)}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-8 py-3 rounded-lg shadow-lg"
                      >
                        Close Shop
                      </button>
                    </div>
                  </div>
                )}
                {flow.phase === 'SKILL_OFFER' ? (
                  <div style={{ marginTop: '84px' }}>
                    <SkillChoicePanel shopWindowRef={shopWindowRef} finishSkillOffer={flow.finishSkillOffer} />
                  </div>
                ) : null}
                {flow.phase === 'STAT_POINT' ? (
                  <div style={{ marginTop: '84px' }}>
                    <StatPhase
                      player={player}
                      displayedStats={displayedStats}
                      statPoints={statPoints}
                      loading={loading}
                      setPlayer={setPlayer}
                      call={call}
                      appendHistory={addHistory}
                      finishStatPoint={flow.finishStatPoint}
                      showStatOverlay={flow.showStatOverlay}
                      shopWindowRef={shopWindowRef}
                    />
                  </div>
                ) : null}
                {player?.shopState?.stage === 'TRAINING' && !(delayTrainingUntil && Date.now() < delayTrainingUntil) ? (
                  <div style={{ marginTop: '84px' }}>
                    <TrainingPhase player={player} loading={loading} setPlayer={setPlayer} call={call} appendHistory={addHistory} onTrainingResult={flow.handleTrainingResult} />
                  </div>
                ) : null}
                {((player?.shopState?.stage === 'TREASURES') || ((player?.shopState?.treasureOffers || []).length > 0)) ? (
                  <div style={{ marginTop: '84px' }}>
                    <TreasurePhase shopWindowRef={shopWindowRef} />
                  </div>
                ) : null}
                {player?.shopState?.stage === 'LOOT' ? (
                  <div style={{ marginTop: '84px' }}>
                    <LootPhase />
                  </div>
                ) : null}
                  </ShopWindow>
                </div>
              <div style={{ marginTop: '88px' }} className="flex items-center justify-between">
                <div className="flex items-center">
                  <QuickClassButton ref={quickBtnRef} onClick={(e: any) => { e.stopPropagation(); openClassQuickView() }} classDetails={classDetails || player?.classDetails || player?.class} player={player} />
                </div>
                <div className="flex items-center space-x-4">
                  {(player?.shopState?.stage === 'LOOT') && (
                    <>
                      <button
                        onClick={() => setSellOpen(true)}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-4 rounded-xl shadow-lg flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-amber-500/10 min-w-[120px]"
                        style={{ transform: 'translateZ(0)' }}
                      >
                        <span className="text-xl leading-none font-black uppercase tracking-tighter">Sell</span>
                        <span className="text-[10px] font-bold text-black/70 mt-1">Treasures & Skills</span>
                      </button>
                      {/* Reroll button: visible when player has CHA >= 2 (chaVal > 0) */}
                        <RerollAllButton />
                      <FinishShopButton />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-none" style={ rightColHeight ? { height: `${rightColHeight}px` } : undefined }>
                <div style={{ transform: 'translateY(60px)', height: '100%' }}>
                <UserPanel statPoints={statPoints} displayedStats={displayedStats} currentLevel={currentLevel} player={player} shopHistory={(shopHistory || [])} selectedCard={null} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClassQuickView mounted={classOverlayMounted} overlayOpenTs={overlayOpenTs} classOverlayActive={classOverlayActive} showIframe={showIframe} iframeActive={iframeActive} iframeLoaded={iframeLoaded} id={kdrId} playerKey={player?.playerKey} classDetails={player?.classDetails || player?.class} onClose={closeClassQuickView} onIframeLoad={onIframeLoad} />
      {flow.levelUpInfo && flow.showLevelUp ? <LevelUpAnimation info={flow.levelUpInfo} onDone={() => flow.finishLevelUp()} /> : null}
      <SellModal open={sellOpen} onClose={() => setSellOpen(false)} />
    </div>
  )
}

export default function ShopPage({ kdrId }: { kdrId: string }) {
  return (
    <ShopProvider kdrId={kdrId}>
      <Inner kdrId={kdrId} />
    </ShopProvider>
  )
}
