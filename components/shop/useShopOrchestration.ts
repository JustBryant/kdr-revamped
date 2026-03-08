import React from 'react'
import axios from 'axios'
import { TREASURE_POP_MS, TREASURE_STAGGER_GAP } from './constants'

type Params = {
  id?: string | null | string[]
  ensureCardDetails?: (card: any) => Promise<void>
  suppressStageEffectRef?: React.MutableRefObject<boolean>
}

export default function useShopOrchestration({ id, ensureCardDetails, suppressStageEffectRef }: Params) {
  const [player, setPlayer] = React.useState<any>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [autoStarted, setAutoStarted] = React.useState<boolean>(false)
  const [playerFetched, setPlayerFetched] = React.useState<boolean>(false)

  // Initialization: Always trigger 'start' on component mount to sync with the current session
  React.useEffect(() => {
    if (!id || playerFetched) return
    let mounted = true
    const init = async () => {
      console.log('[SHOP DEBUG] Initializing shop session for KDR:', id);
      try {
        const res = await axios.post('/api/kdr/shop', { kdrId: String(id), action: 'start' })
        if (!mounted) return
        console.log('[SHOP DEBUG] Start response:', res.data);
        if (res.data?.player) {
          setPlayer(res.data.player)
          setPlayerFetched(true)
          if (res.data.player.shopState?.stage) setAutoStarted(true)
        }
      } catch (err: any) {
        console.error('[SHOP DEBUG] Start failed:', err?.response?.data || err.message);
        // Fallback for 403 (Shop already completed)
        if (err?.response?.status === 403 && err.response.data?.player) {
          setPlayer(err.response.data.player)
          setPlayerFetched(true)
        }
        setMessage(err?.response?.data?.error || 'Failed to initialize shop')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [id, playerFetched])

  const [huginMessage, setHuginMessage] = React.useState<string | null>(null)
  const [shopkeeperDialogues, setShopkeeperDialogues] = React.useState<any[] | null>(null)
  const [shopkeeperGreeting, setShopkeeperGreeting] = React.useState<string | null>(null)
  const [shopTopMessage, setShopTopMessage] = React.useState<any>(null)
  const [awardMessage, setAwardMessage] = React.useState<string | null>(null)
  const [shopHistory, setShopHistory] = React.useState<any[]>([])
  const [recentGains, setRecentGains] = React.useState<{ gold: number; xp: number; visible: boolean } | null>(null)
  const [showLevelUp, setShowLevelUp] = React.useState<boolean>(false)
  const recentGainsTimeoutRef = React.useRef<number | null>(null)
  const levelUpTimeoutRef = React.useRef<number | null>(null)
  const statHideTimeoutRef = React.useRef<number | null>(null)
  const skillEntranceTimeoutRef = React.useRef<number | null>(null)
  const [levelUpMessage, setLevelUpMessage] = React.useState<string | null>(null)
  const [animateSkills, setAnimateSkills] = React.useState<boolean>(false)
  const [showStatChoices, setShowStatChoices] = React.useState<boolean>(false)
  const [statChooserActive, setStatChooserActive] = React.useState<boolean>(false)
  const [bumpedStat, setBumpedStat] = React.useState<string | null>(null)
  const [localPendingChoices, setLocalPendingChoices] = React.useState<any[] | null>(null)
  const [selectedCardModal, setSelectedCardModal] = React.useState<any | null>(null)
  const [displayedShopkeeper, setDisplayedShopkeeper] = React.useState<any | null>(null)
  const [classDetails, setClassDetails] = React.useState<any | null>(null)
  const [classLoading, setClassLoading] = React.useState<boolean>(false)
  const [showClassOverlay, setShowClassOverlay] = React.useState<boolean>(false)
  const [classOverlayMounted, setClassOverlayMounted] = React.useState<boolean>(false)
  const [classOverlayActive, setClassOverlayActive] = React.useState<boolean>(false)
  const [showIframe, setShowIframe] = React.useState<boolean>(false)
  const [iframeActive, setIframeActive] = React.useState<boolean>(false)
  const [iframeLoaded, setIframeLoaded] = React.useState<boolean>(false)
  const [skeletonVisible, setSkeletonVisible] = React.useState<boolean>(false)
  const [skeletonActive, setSkeletonActive] = React.useState<boolean>(false)
  const [overlayReady, setOverlayReady] = React.useState<boolean>(false)
  const [iframeForceShown, setIframeForceShown] = React.useState<boolean>(false)
  const iframeForceRef = React.useRef<number | null>(null)
  const animationTimeoutRef = React.useRef<number | null>(null)
  const iframePollRef = React.useRef<number | null>(null)
  const OVERLAY_ANIM_MS = 420
  const [overlayOpenTs, setOverlayOpenTs] = React.useState<number | null>(null)
  // Treasure sequencing state
  const [treasureAnimateIn, setTreasureAnimateIn] = React.useState<boolean>(false)
  const [chosenTreasureId, setChosenTreasureId] = React.useState<string | null>(null)
  const [exitPhase, setExitPhase] = React.useState<number>(0)
  const [treasureFlyDelta, setTreasureFlyDelta] = React.useState<{ x: number, y: number } | null>(null)
  const classButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const treasureRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const [selecting, setSelecting] = React.useState<boolean>(false)
  const selectingRef = React.useRef<boolean>(false)

  // Expose helper to register treasure DOM nodes
  const setTreasureRef = React.useCallback((id: string, el: HTMLDivElement | null) => {
    try { treasureRefs.current[id] = el } catch (e) {}
  }, [])

  // When treasure offers appear, trigger a staggered pop-in animation
  React.useEffect(() => {
    try {
      const offers = player?.shopState?.treasureOffers || []
      if (offers && offers.length > 0) {
        setTreasureAnimateIn(false)
        requestAnimationFrame(() => {
          try { window.setTimeout(() => setTreasureAnimateIn(true), 24) } catch (e) { setTreasureAnimateIn(true) }
        })
      } else {
        setTreasureAnimateIn(false)
      }
    } catch (e) {}
  }, [player?.shopState?.treasureOffers?.length])

  
  // Hover / preview state for offer card tooltips
  const [hoverTooltip, setHoverTooltip] = React.useState<any>({ visible: false, x: 0, y: 0, idKey: null, cardLike: null })
  const [hoveredOfferId, setHoveredOfferId] = React.useState<string | null>(null)
  const tooltipScrollRef = React.useRef<HTMLDivElement | null>(null)

  const showHover = React.useCallback((e: any, cardLike?: any, idKey?: any, skills?: any[]) => {
    try { if (cardLike && ensureCardDetails) { ensureCardDetails(cardLike).catch(() => {}) } } catch (err) {}
    const playerStats = (player?.shopState && player.shopState.stats) ? player.shopState.stats : (player?.stats || {})
    try { setHoverTooltip({ 
      visible: true, 
      x: (e as any)?.clientX || 0, 
      y: (e as any)?.clientY || 0, 
      idKey, 
      cardLike, 
      skills,
      stats: playerStats
    }) } catch (err) {}
    try { setHoveredOfferId(idKey || (cardLike && (cardLike.id || cardLike.konamiId) ? String(cardLike.id || cardLike.konamiId) : null)) } catch (err) {}
  }, [player, ensureCardDetails])

  const moveHover = React.useCallback((e: any) => {
    try { setHoverTooltip((prev: any) => ({ ...(prev || {}), x: (e as any)?.clientX || 0, y: (e as any)?.clientY || 0 })) } catch (err) {}
  }, [])

  const hideHover = React.useCallback(() => {
    try { setHoverTooltip({ visible: false, x: 0, y: 0, idKey: null, cardLike: null }) } catch (err) {}
    try { setHoveredOfferId(null) } catch (err) {}
  }, [])

  const onTooltipWheel = React.useCallback((e: any) => {
    try {
      if (tooltipScrollRef.current && hoverTooltip?.visible) {
        tooltipScrollRef.current.scrollTop += (e as any).deltaY / 3
        e.preventDefault()
      }
    } catch (err) {}
  }, [hoverTooltip])

  const previewCard = React.useCallback(async (cardLike: any, fallback?: any) => {
    try { if (cardLike && ensureCardDetails) await ensureCardDetails(cardLike) } catch (err) {}
    try { setSelectedCardModal(fallback || cardLike || null) } catch (err) { setSelectedCardModal(cardLike || null) }
  }, [ensureCardDetails])
  const statPointsRef = React.useRef<number>(0)
  const statPopQueueRef = React.useRef<any[]>([])
  const [activeStatPop, setActiveStatPop] = React.useState<any | null>(null)
  const [statAnimating, setStatAnimating] = React.useState<boolean>(false)
  const [statButtonsExit, setStatButtonsExit] = React.useState<boolean>(false)
  const [skillButtonsExit, setSkillButtonsExit] = React.useState<boolean>(false)
  const [trainingButtonsExit, setTrainingButtonsExit] = React.useState<boolean>(false)
  const [lootExitPhase, setLootExitPhase] = React.useState<boolean>(false)
  const trainingShownRef = React.useRef<boolean>(false)
  const lastStageRef = React.useRef<string | null>(null)
  const lastDialoguePhaseRef = React.useRef<string | null>(null)
  const statShownRef = React.useRef<boolean>(false)
  const lastDialogueTextRef = React.useRef<string | null>(null)

  const addHistory = React.useCallback((entry: any) => {
    const e = { ts: entry.ts || Date.now(), ...entry }
    if (e.type === 'dialogue') return
    setShopHistory((prev: any[]) => {
      const list = prev || []
      const last = list.length ? list[list.length - 1] : null
      try {
        if (last && last.type === e.type && last.text === e.text) return list
        if (last && last.text === e.text && Math.abs((e.ts || 0) - (last.ts || 0)) < 5000) return list
      } catch (err) {}
      return [...list, e]
    })

    try {
      if (id) {
        axios.post('/api/kdr/shop', { kdrId: String(id), action: 'appendHistory', payload: e }).catch(() => {})
      }
    } catch (err) {}
  }, [id])

  // Server call wrapper (centralized)
  const call = React.useCallback(async (action: string, payload?: any) => {
    if (!id) {
      console.error('[SHOP DEBUG] call failed: No KDR ID provided');
      return null
    }
    console.log(`[SHOP DEBUG] Requesting action: ${action}`, payload || '');
    setLoading(true)
    try {
      const res = await axios.post('/api/kdr/shop', { kdrId: String(id), action, payload })
      console.log(`[SHOP DEBUG] Response for ${action}:`, res.data);
      try {
        const suppressed = suppressStageEffectRef ? suppressStageEffectRef.current : false
        // CRITICAL FIX: The server sometimes returns `player: {}` in the response for 'start'
        // or other actions, while the necessary progression data is in top-level fields 
        // like `pendingSkillChoices`, `next`, etc.
        if (res?.data?.player && Object.keys(res.data.player).length > 0) {
          const updatedPlayer = res.data.player;
          console.log('[SHOP DEBUG] Updating player state with full object', updatedPlayer.shopState?.stage);
          
          setPlayer((prev: any) => {
            // If the server returns a player object that is missing its shopState stage
            // but we have one locally, merge them to prevent the UI from resetting.
            if (prev && updatedPlayer && !updatedPlayer.shopState?.stage && prev.shopState?.stage) {
              console.warn('[SHOP DEBUG] Server returned player without shopState stage, merging with local.');
              return {
                ...updatedPlayer,
                shopState: {
                  ...(updatedPlayer.shopState || {}),
                  ...prev.shopState
                }
              };
            }
            return updatedPlayer;
          });

          if (updatedPlayer.shopState?.stage) {
            setAutoStarted(true)
          }
        } else if (res?.data?.next || res?.data?.pendingSkillChoices) {
          // If player object is empty, manually assemble the next state from response fields
          console.log('[SHOP DEBUG] Player object empty, patching state from response fields');
          setPlayer((prev: any) => {
            const nextState = {
              ...(prev || {}),
              shopState: {
                ...(prev?.shopState || {}),
                stage: res.data.next || prev?.shopState?.stage,
                pendingSkillChoices: res.data.pendingSkillChoices || prev?.shopState?.pendingSkillChoices,
                shopkeeperGreeting: res.data.shopGreeting || prev?.shopState?.shopkeeperGreeting
              }
            };
            if (res.data.awarded) {
              nextState.gold = (nextState.gold || 0) + (res.data.awarded.gold || 0);
              nextState.xp = (nextState.xp || 0) + (res.data.awarded.xp || 0);
            }
            return nextState;
          });
          setAutoStarted(true);
        }
      } catch (e) {
        console.error('[SHOP DEBUG] Error updating state in call:', e);
      }
      setMessage(res.data.message || 'OK')
      return res.data
    } catch (err: any) {
      console.error(`[SHOP DEBUG] API Error during ${action}:`, err?.response?.data || err.message);
      setMessage(err?.response?.data?.error || err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [id, suppressStageEffectRef])

  // Selection flow: handles exit phases, fly delta calc, and server call
  const selectTreasure = React.useCallback(async (treasureId: string) => {
    if (selectingRef.current || exitPhase > 0) return null
    selectingRef.current = true
    setSelecting(true)

    // Phase 1: Icons vanish (pop then pixel-fade)
    setExitPhase(1)
    await new Promise(r => setTimeout(r, 600))

    // Phase 2: Animation Fly to class button
    if (treasureRefs.current[treasureId] && classButtonRef.current) {
      try {
        const wRect = treasureRefs.current[treasureId]!.getBoundingClientRect()
        const dRect = classButtonRef.current.getBoundingClientRect()
        const dx = (dRect.left + dRect.width / 2) - (wRect.left + wRect.width / 2)
        const dy = (dRect.top + dRect.height / 2) - (wRect.top + wRect.height / 2)
        setTreasureFlyDelta({ x: dx, y: dy })
        setChosenTreasureId(treasureId)

        setExitPhase(2)
        await new Promise(r => setTimeout(r, 500))

        // Phase 3: Others leave
        setExitPhase(3)
        await new Promise(r => setTimeout(r, 400))
      } catch (e) {}
    }

    try {
      const result = await call('chooseTreasure', { treasureId })
      // After animation completes and server responds, clear the treasure phase completely
      setExitPhase(0)
      setChosenTreasureId(null)
      setTreasureFlyDelta(null)
      setTreasureAnimateIn(false)
      
      // The server should have cleared treasureOffers, but update local state to reflect it
      if (result && result.player) {
        setPlayer(result.player)
      }

      // Start the LOOT phase - fetch loot pools immediately
      try {
        await call('lootOffers')
      } catch (err) {
        console.error('Failed to fetch loot offers:', err)
      }
    } catch (err) {
      setSelecting(false)
      selectingRef.current = false
      setExitPhase(0)
      setChosenTreasureId(null)
      setTreasureFlyDelta(null)
      return null
    }
    selectingRef.current = false
    setSelecting(false)
    return true
  }, [call])

  const finishLootPhase = React.useCallback(async () => {
    if (loading || selecting) return
    setLootExitPhase(true)
    // Wait for loot to animate off screen
    await new Promise(r => setTimeout(r, 900))
    const res = await call('finish')
    if (res && res.player) {
      setPlayer(res.player)
    }
    setLootExitPhase(false)
  }, [call, loading, selecting])

  // Safety net: Trigger lootOffers fetch automatically if player is in LOOT stage without offers
  React.useEffect(() => {
    const stage = player?.shopState?.stage
    const offers = player?.shopState?.lootOffers
    // Only fetch if lootOffers is actually undefined (never fetched) or null.
    // An empty array [] means it was fetched but might be empty.
    if (stage === 'LOOT' && (offers === undefined || offers === null) && !loading && !selecting && id) {
       call('lootOffers').catch(() => {})
    }
  }, [player?.shopState?.stage, player?.shopState?.lootOffers, loading, selecting, id, call])

  // Overlay lifecycle: mount/iframe sequencing (moved from page)
  React.useEffect(() => {
    let t: number | null = null
    let hideTimer: number | null = null
    if (showClassOverlay) {
      setClassOverlayMounted(true)
      setShowIframe(true)
      setIframeActive(false)
      setIframeLoaded(false)
      setOverlayReady(false)
      setClassOverlayActive(false)
      requestAnimationFrame(() => {
        try { void document.body.offsetHeight } catch (e) {}
        window.setTimeout(() => setClassOverlayActive(true), 24)
      })
      t = window.setTimeout(() => {
        setOverlayReady(true)
      }, OVERLAY_ANIM_MS)
      animationTimeoutRef.current = t
    } else {
      setIframeActive(false)
      setOverlayReady(false)
      const iframeTransformMs = Math.max(220, Math.round(OVERLAY_ANIM_MS * 0.6))
      hideTimer = window.setTimeout(() => {
        setIframeLoaded(false)
        setClassOverlayActive(false)
        try { window.setTimeout(() => setShowIframe(false), 60) } catch (e) {}
      }, iframeTransformMs)
      t = window.setTimeout(() => setClassOverlayMounted(false), iframeTransformMs + OVERLAY_ANIM_MS)
    }
    return () => {
      if (t) window.clearTimeout(t)
      if (animationTimeoutRef.current) { window.clearTimeout(animationTimeoutRef.current); animationTimeoutRef.current = null }
      if (hideTimer) { try { window.clearTimeout(hideTimer); hideTimer = null } catch (e) {} }
    }
  }, [showClassOverlay])

  // Sync iframe active state when both overlay is ready and iframe is loaded
  React.useEffect(() => {
    if (showClassOverlay && overlayReady && iframeLoaded) {
      setIframeActive(true)
    }
  }, [showClassOverlay, overlayReady, iframeLoaded])

  // Force show iframe as fallback if loading event missed (safety net)
  React.useEffect(() => {
    if (showClassOverlay && overlayReady && !iframeActive) {
      const timer = window.setTimeout(() => {
        if (showClassOverlay && overlayReady && !iframeActive) {
          setIframeLoaded(true) // assume loaded
          setIframeActive(true)
        }
      }, 2000)
      return () => window.clearTimeout(timer)
    }
  }, [showClassOverlay, overlayReady, iframeActive])

  // Ensure iframe reloads each time overlay opens
  React.useEffect(() => {
    if (showClassOverlay) setOverlayOpenTs(Date.now())
  }, [showClassOverlay])

  // Fetch class details when overlay opens
  React.useEffect(() => {
    let mounted = true
    if (!showClassOverlay) return
    const fetchClass = async () => {
      try {
        if (!player || !player.classId) return
        if (classDetails && classDetails.id === player.classId) return
        setClassLoading(true)
        const res = await axios.get(`/api/classes/${encodeURIComponent(player.classId)}`)
        if (!mounted) return
        setClassDetails(res.data || null)
      } catch (e) {
      } finally {
        if (mounted) setClassLoading(false)
      }
    }
    fetchClass()
    return () => { mounted = false }
  }, [showClassOverlay, player?.classId])

  // Persist displayedShopkeeper, shopHistory, and player's shopState to sessionStorage
  React.useEffect(() => {
    try {
      const storageKey = typeof window !== 'undefined' && typeof id === 'string' ? `shopkeeper:${id}` : null
      if (typeof window !== 'undefined' && storageKey && displayedShopkeeper) {
        window.sessionStorage.setItem(storageKey, JSON.stringify(displayedShopkeeper))
      }
    } catch (e) {}
  }, [displayedShopkeeper, id])

  React.useEffect(() => {
    try {
      const historyKey = typeof window !== 'undefined' && typeof id === 'string' ? `shopHistory:${id}` : null
      if (typeof window !== 'undefined' && historyKey) {
        window.sessionStorage.setItem(historyKey, JSON.stringify(shopHistory || []))
      }
    } catch (e) {}
  }, [shopHistory, id])

  React.useEffect(() => {
    try {
      const shopStateKey = typeof window !== 'undefined' && typeof id === 'string' ? `shopState:${id}` : null
      if (typeof window !== 'undefined' && shopStateKey && player?.shopState) {
        window.sessionStorage.setItem(shopStateKey, JSON.stringify(player.shopState))
      }
    } catch (e) {}
  }, [player?.shopState, id])

  // Broadcast player updates so other pages (e.g. class view) can refresh stats/level
  React.useEffect(() => {
    try {
      if (!player) return
      const key = typeof window !== 'undefined' && typeof id === 'string' ? `kdr:player:${id}` : null
      if (typeof window !== 'undefined' && key) {
        // store a tiny signal (avoid storing the whole player to limit size)
        window.sessionStorage.setItem(key, JSON.stringify({ ts: Date.now() }))
      }
      try {
        // dispatch a CustomEvent so same-tab listeners can react immediately
        const ev = new CustomEvent('kdr:shop:playerupdate', { detail: { kdrId: id, player } })
        window.dispatchEvent(ev)
      } catch (e) {}
    } catch (e) {}
  }, [player, id])

  return {
    player, setPlayer,
    loading, setLoading,
    message, setMessage,
    autoStarted, setAutoStarted,
    huginMessage, setHuginMessage,
    shopkeeperDialogues, setShopkeeperDialogues,
    shopkeeperGreeting, setShopkeeperGreeting,
    shopTopMessage, setShopTopMessage,
    awardMessage, setAwardMessage,
    shopHistory, setShopHistory,
    recentGains, setRecentGains,
    showLevelUp, setShowLevelUp,
    recentGainsTimeoutRef,
    levelUpTimeoutRef,
    statHideTimeoutRef,
    skillEntranceTimeoutRef,
    levelUpMessage, setLevelUpMessage,
    animateSkills, setAnimateSkills,
    showStatChoices, setShowStatChoices,
    statChooserActive, setStatChooserActive,
    bumpedStat, setBumpedStat,
    localPendingChoices, setLocalPendingChoices,
    selectedCardModal, setSelectedCardModal,
    playerFetched, setPlayerFetched,
    displayedShopkeeper, setDisplayedShopkeeper,
    classDetails, setClassDetails,
    classLoading, setClassLoading,
    showClassOverlay, setShowClassOverlay,
    classOverlayMounted, setClassOverlayMounted,
    classOverlayActive, setClassOverlayActive,
    showIframe, setShowIframe,
    iframeActive, setIframeActive,
    iframeLoaded, setIframeLoaded,
    overlayReady, setOverlayReady,
    iframeForceShown, setIframeForceShown,
    iframeForceRef, animationTimeoutRef, iframePollRef,
    OVERLAY_ANIM_MS, overlayOpenTs, setOverlayOpenTs,
    hoverTooltip, hoveredOfferId, tooltipScrollRef, showHover, moveHover, hideHover, onTooltipWheel, previewCard,
    TREASURE_POP_MS, TREASURE_STAGGER_GAP, treasureAnimateIn, chosenTreasureId, exitPhase, treasureFlyDelta, setTreasureRef, classButtonRef, selecting, selectTreasure,
    call,
    statPointsRef, statPopQueueRef, activeStatPop, setActiveStatPop,
    statAnimating, setStatAnimating,
    statButtonsExit, setStatButtonsExit,
    skillButtonsExit, setSkillButtonsExit,
    trainingButtonsExit, setTrainingButtonsExit,
    trainingShownRef, lastStageRef, lastDialoguePhaseRef, statShownRef, lastDialogueTextRef,
    addHistory,
    finishLootPhase,
    lootExitPhase,
    setLootExitPhase,
  }
}
