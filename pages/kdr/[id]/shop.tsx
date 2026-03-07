import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { computeLevel } from '../../../lib/shopHelpers'
import CardDescription from '../../../components/class-editor/shared/CardDescription'
import { ShatterfoilOverlay } from '../../../components/ShatterfoilOverlay'
import { UltraRareGlow } from '../../../components/UltraRareGlow'
import { SuperRareGlow } from '../../../components/SuperRareGlow'
import FitName from '../../../components/common/FitName'
import LootPoolArc from '../../../components/shop/LootPoolArc'
import TreasureOfferCard from '../../../components/shop/TreasureOfferCard'
import HoverTooltip from '../../../components/shop/HoverTooltip'
import SkillChoiceCard from '../../../components/shop/SkillChoiceCard'
import SkillChoicesContainer from '../../../components/shop/SkillChoicesContainer'
import StatChooser from '../../../components/shop/StatChooser'
import TrainingChoices from '../../../components/shop/TrainingChoices'
import ClassQuickView from '../../../components/shop/ClassQuickView'
import LevelUpOverlay from '../../../components/shop/LevelUpOverlay'
import LootOfferCard from '../../../components/shop/LootOfferCard'
import LootPoolOffer from '../../../components/shop/LootPoolOffer'
import LootPoolDetailModal from '../../../components/shop/LootPoolDetailModal'
import PoolPurchasedBanner from '../../../components/shop/PoolPurchasedBanner'
import SellModal from '../../../components/shop/SellModal'
import StartShopButton from '../../../components/shop/StartShopButton'
import QuickClassButton from '../../../components/shop/QuickClassButton'
import TopMessage from '../../../components/shop/TopMessage'
import useShopCaches from '../../../components/shop/useShopCaches'
import LootPoolTile from '../../../components/shop/LootPoolTile'
import PurchasedSeenPoolsModal from '../../../components/shop/PurchasedSeenPoolsModal'
import PurchaseFlyPile, { PurchaseFlyPileHandle } from '../../../components/shop/PurchaseFlyPile'
import useTyping from '../../../components/shop/useTyping'
import UserPanel from '../../../components/shop/UserPanel'
import useSkillChoices from '../../../components/shop/useSkillChoices'
import useShopOrchestration from '../../../components/shop/useShopOrchestration'
import Icon from '../../../components/Icon'
import { R_SHIMMER_START_RATIO, R_SHIMMER_SPEED_RATIO, SR_LIGHT_START_RATIO, SR_LIGHT_COUNT, SR_LIGHT_SPACING_MS } from '../../../components/shop/constants'

export default function KdrShopPage() {

  const router = useRouter()
  const { id } = router.query
  const { data: session } = useSession()
  const [kdr, setKdr] = useState<any>(null)
  
  // Responsive scaler: scale the full page content to fit smaller windows while preserving layout.
  const fullParentRef = React.useRef<HTMLDivElement | null>(null)
  const fullChildRef = React.useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = React.useState<number>(1)
  const [scaledHeight, setScaledHeight] = React.useState<number | undefined>(undefined)
  const [currentDesignWidth, setCurrentDesignWidth] = React.useState<number>(1600) // Shop usually needs more width

  React.useLayoutEffect(() => {
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
  
  
  
  const TYPING_SPEED = 12
  const [showStatChoices, setShowStatChoices] = useState<boolean>(false)
  const [bumpedStat, setBumpedStat] = useState<string | null>(null)
  const [statChooserActive, setStatChooserActive] = useState<boolean>(false)
  
  const shopWindowRef = React.useRef<HTMLDivElement | null>(null)
  const groupNodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const poolNodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const suppressStageEffectRef = React.useRef<boolean>(false)
  const purchasedBannerGroupKeyRef = React.useRef<string | null>(null)
  const animatedPoolsRef = React.useRef<Set<string>>(new Set())
  const prevOfferIdsRef = React.useRef<string | null>(null)
  const initialEntranceRef = React.useRef<boolean>(true)
  const [statCenter, setStatCenter] = useState<any | null>(null)
  
  const [selectedPoolModalUI, setSelectedPoolModalUI] = useState<any | null>(null)
  const [animatingOutGroups, setAnimatingOutGroups] = useState<Set<string>>(new Set())
  const [frozenPools, setFrozenPools] = useState<Record<string, any[]>>({})

  const { cardDetailsCacheRef, ensureCardDetails, dialoguesCacheRef, ensureDialoguesForShopkeeper } = useShopCaches()
  // Orchestration hook: holds shared non-UI state and helpers
  const {
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
    recentGainsTimeoutRef, levelUpTimeoutRef, statHideTimeoutRef, skillEntranceTimeoutRef,
    levelUpMessage, setLevelUpMessage,
    animateSkills, setAnimateSkills,
    localPendingChoices, setLocalPendingChoices,
    selectedCardModal, setSelectedCardModal,
    playerFetched, setPlayerFetched,
    displayedShopkeeper, setDisplayedShopkeeper,
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
    call
  } = useShopOrchestration({ id, ensureCardDetails, suppressStageEffectRef })

  const [selectedPool, setSelectedPool] = useState<any | null>(null)
  const [trainingDialogue, setTrainingDialogue] = useState<string | null>(null)
  const [showTrainingChoices, setShowTrainingChoices] = useState<boolean>(false)
  const [lootQuantities, setLootQuantities] = useState<Record<string, number>>({})

  const allAvailablePools = React.useMemo(() => {
    if (!player?.shopState?.lootOffers) return []
    return player.shopState.lootOffers
  }, [player?.shopState?.lootOffers])

  const handleNextPool = () => {
    if (!selectedPool || allAvailablePools.length <= 1) return
    const idx = allAvailablePools.findIndex((p: any) => String(p.id) === String(selectedPool.id))
    if (idx === -1) return
    const nextIdx = (idx + 1) % allAvailablePools.length
    setSelectedPool(allAvailablePools[nextIdx])
  }

  const handlePrevPool = () => {
    if (!selectedPool || allAvailablePools.length <= 1) return
    const idx = allAvailablePools.findIndex((p: any) => String(p.id) === String(selectedPool.id))
    if (idx === -1) return
    const prevIdx = (idx - 1 + allAvailablePools.length) % allAvailablePools.length
    setSelectedPool(allAvailablePools[prevIdx])
  }

  // Open pool viewer and mark pool as "seen" server-side (fire-and-forget)
  const openPoolViewer = (pool: any) => {
    try {
      if (pool && pool.id) {
        try {
          // mark seen asynchronously; if server returns updated player, apply it
          call('markSeen', { poolId: pool.id }).then((res: any) => {
            try { if (res && res.player) setPlayer(res.player) } catch (e) {}
          }).catch(() => {})
        } catch (e) {}
      }
    } catch (e) {}
    setSelectedPool(pool)
  }

  // Open purchased pools modal for a specific tier/type and ensure pools are enriched
  const openPurchasedModal = async (tier: string, isClass: boolean) => {
    try {
      const purchases = Array.isArray(player?.shopState?.purchases) ? player!.shopState.purchases : []
      const poolsSource = isClass ? (classDetails?.lootPools || []) : (kdr?.genericLootPools || [])
      const offersSource = Array.isArray(player?.shopState?.lootOffers) ? player!.shopState.lootOffers : []

      const bought = purchases
        .filter((p: any) => p && (p.lootPoolId || p.lootPoolId === 0))
        .map((p: any) => {
          const poolId = p.lootPoolId
          let pool = offersSource.find((lp: any) => String(lp.id) === String(poolId))
          if (!pool) pool = poolsSource.find((lp: any) => String(lp.id) === String(poolId))
          if (!pool) return null
          const qty = (p.qty || (p.purchase && p.purchase.qty) || 1)
          return { pool, qty, purchase: p }
        })
        .filter(Boolean)
        .filter((entry: any) => (entry.pool && entry.pool.tier === tier))

      // Enrich pools: ensure `cards` entries have full details (konamiId/image)
      for (const entry of bought) {
        try {
          const poolObj = entry.pool
          // prefer the canonical definition from poolsSource if available
          const canonical = poolsSource.find((lp: any) => String(lp.id) === String(poolObj.id)) || poolObj
          entry.pool = { ...(canonical || poolObj) }
          const cardsArr = Array.isArray(entry.pool.cards) ? entry.pool.cards : []
          if (cardsArr.length === 0 && Array.isArray(entry.pool.items)) {
            // try to extract card objects from items if present
            const derived = entry.pool.items.filter((it: any) => it.type === 'Card').map((it: any) => it.card).filter(Boolean)
            if (derived.length) entry.pool.cards = derived
          }

          // Ensure card details via ensureCardDetails (if available)
          if (ensureCardDetails && Array.isArray(entry.pool.cards)) {
            const results = await Promise.all(entry.pool.cards.map(async (c: any) => {
              try {
                const detailed = await ensureCardDetails(c)
                return detailed || c
              } catch (e) { return c }
            }))
            entry.pool.cards = results.filter(Boolean)
          }
        } catch (e) { /* ignore per-entry errors */ }
      }

      setPurchasedPoolsList(bought)
      setPurchasedModalContext({ tier, isClass })
    } catch (e) {
      setPurchasedPoolsList([])
      setPurchasedModalContext(null)
    }
  }
  
  const [lootTierTyping, setLootTierTyping] = useState<Record<string, number>>({})
  const [lootLineProgress, setLootLineProgress] = useState<Record<string, number>>({})
  const [lootPoolDropProgress, setLootPoolDropProgress] = useState<Record<string, number>>({})
  const [lootPoolDropProgressPool, setLootPoolDropProgressPool] = useState<Record<string, number>>({})
  const [lootCardFlips, setLootCardFlips] = useState<Record<string, number[]>>({})

  // TRACKER TO PREVENT MULTIPLE CALLS FOR THE SAME POOL ID IN A SINGLE RENDER/SESSION
  const processedPoolsRef = React.useRef<Set<string>>(new Set())

  // Automatically mark all current loot offers as "seen" immediately when they appear in the player state.
  // This ensures they show up in history/modals without requiring an animation or a click.
  React.useEffect(() => {
    const offers = player?.shopState?.lootOffers
    if (!Array.isArray(offers) || offers.length === 0) return

    const seenArr = Array.isArray(player?.shopState?.seen) ? player!.shopState.seen : []
    const unseen = offers.filter(pool => {
      const id = String(pool.id)
      return !seenArr.some((s: any) => String(s) === id) && !processedPoolsRef.current.has(id)
    })

    if (unseen.length === 0) return

    // Mark each unseen pool as seen both locally and on the server
    unseen.forEach(pool => {
      try {
        const poolId = String(pool.id)
        processedPoolsRef.current.add(poolId)

        // Optimistically update local player state so UI reflects it immediately
        setPlayer((prev: any) => {
          if (!prev) return prev
          try {
            const ss = JSON.parse(JSON.stringify(prev.shopState || {}))
            const cur = Array.isArray(ss.seen) ? ss.seen : []
            if (!cur.some((s: any) => String(s) === poolId)) {
              cur.push(pool.id)
              ss.seen = cur
              return { ...prev, shopState: ss }
            }
            return prev
          } catch (e) { return prev }
        })
        // Fire-and-forget server sync
        call('markSeen', { poolId: pool.id }).then((res: any) => {
          try { if (res && res.player) setPlayer(res.player) } catch (e) {}
        }).catch(() => {})
      } catch (e) {}
    })
  }, [player?.shopState?.lootOffers, player?.shopState?.seen])

  const getTierLabel = (tier: string, isGeneric: boolean) => {
    if (isGeneric) {
      const labels: Record<string, string> = { 'STARTER': 'Staples', 'MID': 'Removal/Disruption', 'HIGH': 'Engine' }
      return labels[tier] || tier
    } else {
      const labels: Record<string, string> = { 'STARTER': 'Starter Packs', 'MID': 'Mid Quality', 'HIGH': 'High Quality' }
      return labels[tier] || tier
    }
  }

  const [resyncKey, setResyncKey] = useState<number>(0)
  // Banner shown when a pool is purchased (covers pools area)
  const [showPoolPurchasedBanner, setShowPoolPurchasedBanner] = useState<boolean>(false)
  const [purchasedBannerPoolId, setPurchasedBannerPoolId] = useState<string | null>(null)
  const [poolBannerRect, setPoolBannerRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const POOL_PURCHASE_BANNER_MS = 900
  const pendingPlayerUpdateRef = React.useRef<any | null>(null)
  // timings must match PoolPurchasedBanner constants
  const BANNER_SLIDE_IN_MS = 360
  const BANNER_TEXT_MS = 260
  const BANNER_HOLD_MS = 360
  const BANNER_OUT_MS = 360
  const BANNER_OUT_DELAY = BANNER_SLIDE_IN_MS + BANNER_TEXT_MS + BANNER_HOLD_MS
  const [startLootPoolAnimation, setStartLootPoolAnimation] = useState<boolean>(false)
  const [showSell, setShowSell] = useState<boolean>(false)


  // Coordinated Loot Animation Sequence
  React.useEffect(() => {
    if (player?.shopState?.stage !== 'LOOT' || lootExitPhase) return

    const offers = player?.shopState?.lootOffers || []
    if (offers.length === 0) return

    // Immediately mark everything as animated/flipped to bypass complex sequences
    offers.forEach((pool: any) => {
      const pid = String(pool.id)
      if (!animatedPoolsRef.current.has(pid)) {
        animatedPoolsRef.current.add(pid)
        setLootCardFlips(prev => ({ ...prev, [pool.id]: [0, 1, 2] }))
      }
    })

    // Set all progress tracking to 100% immediately
    const groupKey = (pool: any) => `${pool.tier}_${pool.isGeneric ? 'generic' : 'class'}`
    const keys = Array.from(new Set(offers.map(groupKey)))
    
    setLootTierTyping(prev => {
      const next = { ...prev }
      keys.forEach(k => {
        const keyStr = k as string
        const [tier, type] = keyStr.split('_')
        next[keyStr] = getTierLabel(tier, type === 'generic').length
      })
      return next
    })
    setLootLineProgress(prev => {
      const next = { ...prev }
      keys.forEach(k => { next[k as string] = 1 })
      return next
    })
    setLootPoolDropProgress(prev => {
      const next = { ...prev }
      keys.forEach(k => { next[k as string] = 1 })
      return next
    })

    setStartLootPoolAnimation(true)
  }, [player?.shopState?.stage, lootExitPhase, resyncKey, player?.shopState?.lootOffers])

  // Skill card measuring/ref helpers (depends on `player` from orchestration)
  const { setCardRef: setSkillCardRef, skillCardFromY } = useSkillChoices({ shopWindowRef, choices: player?.shopState?.pendingSkillChoices, localPendingChoices, skillButtonsExit })
  
  const [/* overlay state moved to orchestration hook */ , ] = [null, null]
  // Shimmer timing and SR light settings imported from constants

  const storageKey = typeof window !== 'undefined' && typeof id === 'string' ? `shopkeeper:${id}` : null
  const historyKey = typeof window !== 'undefined' && typeof id === 'string' ? `shopHistory:${id}` : null
  const shopStateKey = typeof window !== 'undefined' && typeof id === 'string' ? `shopState:${id}` : null

  // Prefetch/enrich card details for visible treasure offers to avoid first-hover delay
  React.useEffect(() => {
    const offers = (player?.shopState?.treasureOffers && Array.isArray(player.shopState.treasureOffers)) ? player.shopState.treasureOffers : []
    if (!offers || offers.length === 0) return
    let mounted = true
    ;(async () => {
      try {
        await Promise.all(offers.map(async (t: any) => {
          try {
            const card = t.card || {}
            if (!card) return
            const idKey = card.id || (card.konamiId ? String(card.konamiId) : null)
            // Only prefetch when not present or when type looks generic
            const cached = idKey ? cardDetailsCacheRef.current[idKey] : null
            const isGeneric = (d: any) => !d || !d.type || /^(spell|trap|monster)$/i.test(String(d.type).trim())
            if (!idKey) return
            if (cached && !isGeneric(cached)) return
            await ensureCardDetails(card)
          } catch (e) {}
        }))
      } catch (e) {}
    })()
    return () => { mounted = false }
  }, [player?.shopState?.treasureOffers])

  const defaults = {
    goldPerRound: 50,
    xpPerRound: 100,
    levelXpCurve: [0, 100, 300, 600, 1000],
    trainingCost: 10,
    trainingXp: 50
  }
  

  

  

  // Prefetch minimal class details as soon as we know player's classId so
  // the small thumbnail in the shop button is ready before the user clicks.
  useEffect(() => {
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

  const settingsFor = (kdrObj: any) => {
    if (!kdrObj) return defaults
    if (kdrObj.settingsSnapshot) return { ...defaults, ...(kdrObj.settingsSnapshot || {}) }
    if (kdrObj.format && kdrObj.format.gameSettings) return { ...defaults, ...(kdrObj.format.gameSettings || {}) }
    return defaults
  }

  
  useEffect(() => {
    // Fetch full KDR and attach currentPlayer for logged-in user.
    if (!id) return
    let mounted = true
    const fetch = async () => {
      // Rehydrate persisted history and shopState from sessionStorage so the UI
      // resumes where the user left off across reloads.
      try {
        if (typeof window !== 'undefined' && historyKey) {
          const raw = window.sessionStorage.getItem(historyKey)
          if (raw) {
            try {
              const parsed = JSON.parse(raw) || []
              setShopHistory(parsed)
                  // Do not use persisted history to set the top shopkeeper message on load.
                  // The top message will be chosen randomly based on the current phase when
                  // dialogues are loaded for the shopkeeper.
            } catch (e) {}
          }
        }
      } catch (e) {}
      try {
        const res = await axios.get(`/api/kdr/${id}`)
        if (mounted) setKdr(res.data)
        const current = res.data.currentPlayer || null
        if (current) {
          // If server has a persisted history for this player's shopState, prefer it
          try {
            const serverHist = Array.isArray(current?.shopState?.history) ? (current.shopState.history || []) : []
            if (serverHist && serverHist.length > 0) {
              setShopHistory(serverHist)
              // Do not set the top message from server history. We will choose a
              // phase-appropriate dialogue once dialogues for the shopkeeper are loaded.
            }
          } catch (e) {}
          // only update player state if something meaningful changed to avoid
          // triggering the dialogues/greeting effects repeatedly
          setPlayer((prev: any) => {
            try {
              if (!prev) return current
              if (prev.id === current.id && prev.gold === current.gold && prev.xp === current.xp && JSON.stringify(prev.shopState) === JSON.stringify(current.shopState)) return prev
            } catch (e) {}
            return current
          })
          // Initialize a stable displayed shopkeeper so the UI doesn't flicker when
          // React re-renders or tab visibility changes. Prefer persisted shopState.shopkeeper
          // if present.
          try {
            // Check sessionStorage for a previously displayed shopkeeper (survives dev remounts)
            let initialSk = null
            try {
              if (typeof window !== 'undefined' && storageKey) {
                const raw = window.sessionStorage.getItem(storageKey)
                if (raw) initialSk = JSON.parse(raw)
              }
            } catch (e) { /* ignore */ }
            if (!initialSk) initialSk = current?.shopState?.shopkeeper || null
            if (initialSk) setDisplayedShopkeeper((prev: any) => prev || initialSk)
          } catch (e) {}

          // If a persisted shopkeeper greeting exists, show it immediately (use managed expiration)
          try {
            const persistedGreeting = current?.shopState?.shopkeeperGreeting || null
              if (persistedGreeting && persistedGreeting !== shopkeeperGreeting) {
              // Avoid re-adding the same greeting if it's already present in persisted history
              let already = false
              try {
                // Prefer locally persisted history snapshot if available
                if (typeof window !== 'undefined' && historyKey) {
                  const raw = window.sessionStorage.getItem(historyKey)
                  if (raw) {
                    const parsed = JSON.parse(raw || '[]') || []
                    const last = parsed && parsed.length ? parsed[parsed.length - 1] : null
                    if (last && last.type === 'dialogue' && last.text === persistedGreeting) already = true
                  }
                }
                // Fallback: check server-provided player's shopState.history if available
                if (!already && Array.isArray(current?.shopState?.history)) {
                  const h = current.shopState.history
                  const last = h && h.length ? h[h.length - 1] : null
                  if (last && last.type === 'dialogue' && last.text === persistedGreeting) already = true
                }
              } catch (e) {}

              // Always set the greeting in the UI, but only add to history when there is no other history present
              setShopkeeperGreeting(persistedGreeting)
              setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeperGreeting: persistedGreeting } }) : prev)
              try {
                // Do not append greetings to history or display them automatically on load.
                // Persist the greeting in `player.shopState` but do not use it as a UI fallback.
                let hasExistingHistory = false
                if (typeof window !== 'undefined' && historyKey) {
                  const raw2 = window.sessionStorage.getItem(historyKey)
                  if (raw2) {
                    const parsed2 = JSON.parse(raw2 || '[]') || []
                    if (parsed2 && parsed2.length) hasExistingHistory = true
                  }
                }
                if (!hasExistingHistory && Array.isArray(current?.shopState?.history) && current.shopState.history.length) hasExistingHistory = true
              } catch (e) {}
            }
          } catch (e) {}

          // If player's persisted shopState references a shopkeeper id but lacks an image,
          // fetch the shopkeeper row (from admin table) to obtain the stored image URL
          try {
            const skId = current?.shopState?.shopkeeper?.id
            const skImgPresent = !!(current?.shopState?.shopkeeper?.image)
            if (skId && !skImgPresent) {
              try {
                const det = await axios.get(`/api/shopkeepers/${skId}`)
                const data = det.data || null
                if (data && data.image) {
                  setPlayer((prev: any) => {
                    if (!prev) return prev
                    const ss = { ...(prev.shopState || {}), shopkeeper: { ...(prev.shopState?.shopkeeper || {}), image: data.image } }
                    return { ...prev, shopState: ss }
                  })
                  // update the stable displayed shopkeeper image but only if not set yet
                  setDisplayedShopkeeper((prev: any) => (prev && prev.image) ? prev : ({ ...(prev || {}), image: data.image }))
                }
              } catch (e) {
                // ignore fetch errors
              }
            }
          } catch (e) {}

          // If no shopkeeper is persisted at all for this player, fetch a canonical default
          // (preferably Hugin) so the UI can display an image and greeting before Start.
          try {
            const skIdExists = !!current?.shopState?.shopkeeper?.id
            if (!skIdExists) {
              try {
                const def = await axios.get(`/api/shopkeepers/default`)
                if (def && def.data) {
                  const sk = def.data
                  // set local player so subsequent actions have a shopkeeper
                  setPlayer((prev: any) => ({ ...(prev || {}), shopState: { ...(prev?.shopState || {}), shopkeeper: sk } }))
                  // set displayed shopkeeper only if not already set to avoid overwriting
                  setDisplayedShopkeeper((prev: any) => prev || sk)
                }
              } catch (e) {
                // ignore
              }
            }
          } catch (e) {}
        } else setPlayer(null)
        // After pulling server state, try to merge any locally persisted shopState
        try {
          if (typeof window !== 'undefined' && shopStateKey) {
            const raw = window.sessionStorage.getItem(shopStateKey)
            if (raw) {
              try {
                const persisted = JSON.parse(raw)
                if (persisted) {
                  setPlayer((prev: any) => {
                    if (!prev) {
                      // ensure history falls back to server-provided current history when available
                      const merged = { ...(persisted || {}) }
                      if ((!merged.history || merged.history.length === 0) && current?.shopState?.history && current.shopState.history.length) {
                        merged.history = current.shopState.history
                      }
                      // Do not set top message from merged history when a stage is active.
                      // If no active stage, prefer any merged shopkeeperGreeting for pre-start.
                      try {
                        // Do not auto-display merged greetings or history items as the top message.
                        // Keep merged shopState intact but do not set a top UI message here.
                      } catch (e) {}
                      return { shopState: merged }
                    }
                    const prevShop = (prev.shopState || {})
                    const merged = { ...prevShop, ...(persisted || {}) }
                    // prefer server history when available to avoid overwriting with stale local state
                    const serverHist = current?.shopState?.history
                    if ((!merged.history || merged.history.length === 0) && serverHist && serverHist.length) merged.history = serverHist
                    // Do not set top message from merged history when a stage is active.
                    try {
                      const stage = (current?.shopState?.stage) || merged.stage || (player?.shopState?.stage)
                      if (!stage) {
                        // Do not auto-display merged greetings or history items as the top message.
                        // UI will only display explicit `shopTopMessage` values set by interactive flows.
                      }
                    } catch (e) {}
                    return { ...prev, shopState: merged }
                  })
                  // if persisted contains shopkeeper data, ensure displayedShopkeeper is set
                  if (persisted.shopkeeper) setDisplayedShopkeeper((prev: any) => prev || persisted.shopkeeper)
                  if (persisted.shopkeeperGreeting) setShopkeeperGreeting(prev => prev || persisted.shopkeeperGreeting)
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
        // if server persisted shop award, show it so users can look back
        try {
          const skAward = (res.data?.currentPlayer?.shopState?.shopAward) || null
          if (skAward) {
            const cp = res.data?.currentPlayer || current
            const label = (cp && session && cp.user && session.user && cp.user.id === session.user.id) ? 'You' : (cp?.user?.name || cp?.displayName || 'Player')
            setAwardMessage(`${label} gained ${skAward.gold} gold and ${skAward.xp} XP this round.`)
          }
        } catch (e) {}
      } catch (e) {
        // ignore errors here
      }
      if (mounted) setPlayerFetched(true)
    }
    fetch()
    return () => { mounted = false }
  }, [id])

  

  // Treasure pop-in animation handled by orchestration hook

  // Fetch dialogues for chosen shopkeeper (if any)
  useEffect(() => {
    const fetchDialogues = async () => {
      try {
        const sk = displayedShopkeeper || player?.shopState?.shopkeeper
        if (!sk || !sk.id) { setShopkeeperDialogues(null); return }
        const resData = await ensureDialoguesForShopkeeper(sk.id)
        setShopkeeperDialogues(resData)
        // If no explicit greeting is set yet, populate it from dialogues (first GREETING)
        try {
          // If a shop stage is active, prefer choosing a random dialogue appropriate
          // to that phase (SKILL/STATS/TRAINING/etc.). Otherwise populate a GREETING
          // for the pre-start state.
          const stageNow = player?.shopState?.stage || null
          if (stageNow) {
            const map: Record<string, string> = { SKILL: 'SKILL_OFFER', STATS: 'STATS', TRAINING: 'TRAINING', TREASURE: 'TREASURE', LOOT: 'LOOT' }
            const want = map[stageNow] || 'GREETING'
            const candidates = (resData || []).filter((d: any) => d.type === want)
            if (candidates && candidates.length) {
              const pick = candidates[Math.floor(Math.random() * candidates.length)]
              if (pick && pick.text) {
                  // Only set a phase dialogue when entering that phase (avoid duplicates)
                  if (lastDialoguePhaseRef.current !== stageNow) {
                    setShopkeeperGreeting(pick.text)
                    setShopTopMessage({ type: 'dialogue', text: pick.text, label: (displayedShopkeeper?.name || 'Shopkeeper') })
                    lastDialoguePhaseRef.current = stageNow
                  }
              }
            }
          } else {
            if (!shopkeeperGreeting) {
              const greetingLine = (resData || []).find((d: any) => d.type === 'GREETING')
              if (greetingLine && greetingLine.text) {
                setShopkeeperGreeting(greetingLine.text)
                setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeperGreeting: greetingLine.text } }) : prev)
                // show greeting in pre-start state
                setShopTopMessage({ type: 'dialogue', text: greetingLine.text, label: (displayedShopkeeper?.name || 'Shopkeeper') })
              }
            }
          }
        } catch (e) {}
      } catch (e) {
        setShopkeeperDialogues(null)
      }
    }
    fetchDialogues()
  }, [displayedShopkeeper?.id])

  // When pending skill choices appear, play a random SKILL_OFFER dialogue then animate skills in
  useEffect(() => {
    const choices = player?.shopState?.pendingSkillChoices || null
    // If training buttons are currently sliding off, don't show skills yet.
    // This ensures Train/Don't Train can slide fully out of the Shop Window
    // before the skill cards appear.
    if (trainingButtonsExit) return

    // If we've initiated a slide-out exit for the skill buttons, don't
    // immediately clear `animateSkills` when server state removes pending
    // choices — allow the container translate animation to complete first.
    if (!choices || choices.length === 0) {
      if (skillButtonsExit) return
      setAnimateSkills(false)
      return
    }

    // Keep a local copy so rapid server responses don't remove the choices
    // from the DOM before the slide-out animation can run.
    try { if (choices && choices.length) setLocalPendingChoices(choices) } catch (e) {}

    let mounted = true
    ;(async () => {
      try {
        const sk = displayedShopkeeper || player?.shopState?.shopkeeper
        if (!sk || !sk.id) return

        // Ensure we have dialogues cached
        let dlgList = dialoguesCacheRef.current[sk.id]
        if (!dlgList) {
          try {
            const res = await axios.get(`/api/shopkeepers/${sk.id}/dialogues`)
            dlgList = res.data || []
            dialoguesCacheRef.current[sk.id] = dlgList
          } catch (e) {
            dlgList = []
          }
        }

        const skillLines = (dlgList || []).filter((d: any) => d.type === 'SKILL_OFFER')
        if (skillLines.length > 0) {
          const pick = skillLines[Math.floor(Math.random() * skillLines.length)]
          if (mounted && pick && pick.text) {
            // Only show a SKILL dialogue on first entry to the SKILL phase
            if (lastDialoguePhaseRef.current !== 'SKILL') {
              setShopkeeperGreeting(pick.text)
              setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeperGreeting: pick.text } }) : prev)
              // Show the skill offer dialogue in the top box (typing) but do not persist to history.
              setShopTopMessage({ type: 'dialogue', text: pick.text, label: (displayedShopkeeper?.name || 'Shopkeeper') })
              lastDialoguePhaseRef.current = 'SKILL'
            }
          }
        }

        // small delay so dialogue appears before skills fly in
        await new Promise(r => setTimeout(r, 300))
        if (mounted) setAnimateSkills(true)
      } catch (e) {}
    })()

    return () => { mounted = false }
  }, [player?.shopState?.pendingSkillChoices?.length, displayedShopkeeper?.id, skillButtonsExit, trainingButtonsExit])

  // Skill card measuring is handled by `useSkillChoices` hook.

  // When stat chooser appears, play a random STATS dialogue then show the chooser
  useEffect(() => {
    if (!statChooserActive || !showStatChoices) return

    let mounted = true
    ;(async () => {
      try {
        const sk = displayedShopkeeper || player?.shopState?.shopkeeper
        if (!sk || !sk.id) return

        // Ensure dialogues are cached
        let dlgList = dialoguesCacheRef.current[sk.id]
        if (!dlgList) {
          try {
            const res = await axios.get(`/api/shopkeepers/${sk.id}/dialogues`)
            dlgList = res.data || []
            dialoguesCacheRef.current[sk.id] = dlgList
          } catch (e) {
            dlgList = []
          }
        }

        const statLines = (dlgList || []).filter((d: any) => d.type === 'STATS')
        if (statLines.length > 0) {
          const pick = statLines[Math.floor(Math.random() * statLines.length)]
          if (mounted && pick && pick.text) {
            // Only show a STATS dialogue on first entry to the STATS phase
            if (!statShownRef.current && lastDialoguePhaseRef.current !== 'STATS') {
              setShopkeeperGreeting(pick.text)
              setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeperGreeting: pick.text } }) : prev)
              setShopTopMessage({ type: 'dialogue', text: pick.text, label: (displayedShopkeeper?.name || 'Shopkeeper') })
              lastDialoguePhaseRef.current = 'STATS'
              statShownRef.current = true
            }
          }
        }
      } catch (e) {}
    })()

    return () => { mounted = false }
  }, [statChooserActive, showStatChoices, displayedShopkeeper?.id, player?.shopState?.shopkeeper])

  // When treasure offers appear, play a random TREASURES dialogue
  useEffect(() => {
    // Check if treasure offers are being shown
    const hasTreasures = player?.shopState?.treasureOffers && player.shopState.treasureOffers.length > 0
    if (!hasTreasures) return

    let mounted = true
    ;(async () => {
      try {
        const sk = displayedShopkeeper || player?.shopState?.shopkeeper
        if (!sk || !sk.id) return

        // Ensure dialogues are cached
        let dlgList = dialoguesCacheRef.current[sk.id]
        if (!dlgList) {
          try {
            const res = await axios.get(`/api/shopkeepers/${sk.id}/dialogues`)
            dlgList = res.data || []
            dialoguesCacheRef.current[sk.id] = dlgList
          } catch (e) {
            dlgList = []
          }
        }

        // Filter for TREASURES type
        const treasureLines = (dlgList || []).filter((d: any) => d.type === 'TREASURES')
        if (treasureLines.length > 0) {
          const pick = treasureLines[Math.floor(Math.random() * treasureLines.length)]
          if (mounted && pick && pick.text) {
             // Avoid repeating if we already showed a treasure dialogue (or phase mismatch)
             if (lastDialoguePhaseRef.current !== 'TREASURES') {
               setShopkeeperGreeting(pick.text)
               // update player state so it persists in session
               setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeperGreeting: pick.text } }) : prev)
               setShopTopMessage({ type: 'dialogue', text: pick.text, label: (displayedShopkeeper?.name || 'Shopkeeper') })
               lastDialoguePhaseRef.current = 'TREASURES'
             }
          }
        }
      } catch (e) {}
    })()
    return () => { mounted = false }
  }, [player?.shopState?.treasureOffers, displayedShopkeeper?.id, player?.shopState?.shopkeeper])

  // When loot offers appear, play a random LOOT_OFFER dialogue
  useEffect(() => {
    const hasLoot = player?.shopState?.lootOffers && player.shopState.lootOffers.length > 0
    if (!hasLoot) return

    let mounted = true
    ;(async () => {
      try {
        const sk = displayedShopkeeper || player?.shopState?.shopkeeper
        if (!sk || !sk.id) return

        // Ensure dialogues are cached
        let dlgList = dialoguesCacheRef.current[sk.id]
        if (!dlgList) {
          try {
            const res = await axios.get(`/api/shopkeepers/${sk.id}/dialogues`)
            dlgList = res.data || []
            dialoguesCacheRef.current[sk.id] = dlgList
          } catch (e) {
            dlgList = []
          }
        }

        // Filter for LOOT_OFFER type
        const lootLines = (dlgList || []).filter((d: any) => d.type === 'LOOT_OFFER')
        if (lootLines.length > 0) {
          const pick = lootLines[Math.floor(Math.random() * lootLines.length)]
          if (mounted && pick && pick.text) {
             // Avoid repeating if we already showed a loot dialogue
             if (lastDialoguePhaseRef.current !== 'LOOT') {
               setShopkeeperGreeting(pick.text)
               setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeperGreeting: pick.text } }) : prev)
               setShopTopMessage({ type: 'dialogue', text: pick.text, label: (displayedShopkeeper?.name || 'Shopkeeper') })
               lastDialoguePhaseRef.current = 'LOOT'
             }
          }
        }
      } catch (e) {}
    })()
    return () => { mounted = false }
  }, [player?.shopState?.lootOffers, displayedShopkeeper?.id, player?.shopState?.shopkeeper])

  // Loot pool entrance animation: typing headings, drawing lines, pools drop down from headings
  useEffect(() => {
    if (!player?.shopState?.lootOffers || player.shopState.lootOffers.length === 0) return
    // Only re-run the animation/reset if the set of offer IDs actually changed.
    // This prevents opening overlays (which may cause unrelated re-renders) from
    // clearing animation state and flipping cards back down.
    const offerIds = (player.shopState.lootOffers || []).map((p: any) => String(p.id)).join(',')
    const prevIdsStr = prevOfferIdsRef.current

    // Trigger animation if we just entered LOOT stage (prevIdsStr was null/empty)
    // or if the set of offers changed.
    if ((prevIdsStr || '') === offerIds && prevIdsStr !== null) {
      return
    }
    prevOfferIdsRef.current = offerIds
    
    // Group pools by tier AND type (generic vs class) - same logic as rendering
    const groupKey = (pool: any) => `${pool.tier}_${pool.isGeneric ? 'generic' : 'class'}`
    const groups: Record<string, any[]> = {}
    player.shopState.lootOffers.forEach((pool: any) => {
      const key = groupKey(pool)
      if (!groups[key]) groups[key] = []
      groups[key].push(pool)
    })
    
    const groupKeys = Object.keys(groups)
    const typingSpeed = 30 // ms per character
    const lineSpeed = 250 // ms for line to draw
    const poolDropDuration = 600 // ms for pools to drop down from heading
    const poolDropDelay = 200 // ms after line completes before pools drop
    
    // If this is the first time we see offers, run the full entrance animation.
    // Otherwise only animate pools that were added and keep animation state
    // for pools that remain so they don't flip back when one pool is bought.
    if (!prevIdsStr) {
      setLootTierTyping({})
      setLootLineProgress({})
      setLootPoolDropProgress({})
      setLootCardFlips({})
      setStartLootPoolAnimation(false)
    } else {
      // Compute which pools were added/removed
      const prevIds = new Set<string>(((prevIdsStr || '').split(',').filter(Boolean) as unknown) as string[])
      const newIds = new Set<string>((player.shopState.lootOffers || []).map((p: any) => String(p.id)))
      const removed = Array.from(prevIds).filter(id => !newIds.has(id))
      const added = Array.from(newIds).filter(id => !prevIds.has(id))

      // For removed pools, clear their flip state and animated marker
      if (removed.length) {
        setLootCardFlips(prev => {
          const copy: Record<string, number[]> = { ...(prev || {}) }
          for (const r of removed) delete copy[r]
          return copy
        })
        try { for (const r of removed) animatedPoolsRef.current.delete(String(r)) } catch (e) {}
      }

      // For added pools, we will trigger drop/flip for just those pools below.
      // Leave existing `lootTierTyping`, `lootLineProgress`, and `lootPoolDropProgress` alone
    }
    
    const getTierLabel = (tier: string, isGeneric: boolean) => {
      const t = (tier || '').toUpperCase()
      if (isGeneric) {
        return { 'STARTER': 'Staples', 'MID': 'Removal/Disruption', 'HIGH': 'Engine' }[t] || t
      } else {
        return { 'STARTER': 'Starter Packs', 'MID': 'Mid Quality', 'HIGH': 'High Quality' }[t] || t
      }
    }
    
    // Find unique keys and their labels
    const uniqueGroups = Array.from(new Set(player.shopState.lootOffers.map((p: any) => groupKey(p))))
    
    uniqueGroups.forEach((key: any) => {
      const [tier, type] = String(key).split('_')
      const isGeneric = type === 'generic'
      const label = getTierLabel(tier, isGeneric)
      const charCount = label.length

      // Type headings: characters typed out (left to right)
      for (let i = 0; i <= charCount; i++) {
        setTimeout(() => {
          setLootTierTyping(prev => ({ ...prev, [String(key)]: i }))
        }, i * typingSpeed)
      }

      // Draw lines: from left to right (after heading starts typing)
      const lineSteps = 20
      const lineStartDelay = (charCount / 2) * typingSpeed // Start drawing line midway through typing
      for (let i = 0; i <= lineSteps; i++) {
        setTimeout(() => {
          setLootLineProgress(prev => ({ ...prev, [String(key)]: i / lineSteps }))
        }, lineStartDelay + (i * (lineSpeed / lineSteps)))
      }

      // Pools drop down: after line finishes
      const dropStartDelay = lineStartDelay + lineSpeed + poolDropDelay
      const dropSteps = 30
      for (let i = 0; i <= dropSteps; i++) {
        setTimeout(() => {
          const progress = i / dropSteps
          const eased = Math.sin((progress * Math.PI) / 2) // Sine ease out for smooth drop
          setLootPoolDropProgress(prev => ({ ...prev, [String(key)]: eased }))
        }, dropStartDelay + (i * poolDropDuration) / dropSteps)
      }

      // Mark pools in this group as seen once everything (heading/lines/drop) finishes
      const groupPools = player.shopState.lootOffers.filter((p: any) => groupKey(p) === key)
      const groupFinishDelay = dropStartDelay + poolDropDuration + 200
      // Redundant markSeen removed - handled by instant useEffect now
    })

    // Start box opening animation after all drops complete
    const totalHeadingDelay = (uniqueGroups.length > 0) 
      ? (getTierLabel((uniqueGroups[0] as string).split('_')[0], (uniqueGroups[0] as string).split('_')[1] === 'generic').length * typingSpeed)
      : 0
    const allDropsCompleteDelay = (totalHeadingDelay / 2) + lineSpeed + poolDropDelay + poolDropDuration + 100

    // Temporarily lock the shop window height to prevent vertical reflow
    // while the new pool entrance animation runs. We'll release it shortly
    // after the animations complete.
    let _removeHeightTimeout: any = null
    try {
      if (shopWindowRef && shopWindowRef.current) {
        const rect = shopWindowRef.current.getBoundingClientRect()
        shopWindowRef.current.style.minHeight = `${Math.ceil(rect.height)}px`
        _removeHeightTimeout = setTimeout(() => {
          try { if (shopWindowRef.current) shopWindowRef.current.style.minHeight = '' } catch (e) {}
        }, allDropsCompleteDelay + 800)
      }
    } catch (e) {}

    setTimeout(() => {
      setStartLootPoolAnimation(true)

      // After pools drop, flip cards for pools that haven't animated yet
      groupKeys.forEach((key) => {
        const poolsInGroup = groups[key]
        poolsInGroup.forEach((pool: any) => {
          try {
            const poolIdKey = String(pool.id)
            if (animatedPoolsRef.current.has(poolIdKey)) return
            // If this pool is newly added (we have a prevIdsStr), animate per-pool drop
            if (prevIdsStr && !initialEntranceRef.current) {
              // initialize per-pool progress immediately so render uses 0
              setLootPoolDropProgressPool(prev => ({ ...prev, [pool.id]: 0 }))
              const dropSteps = 30
              const purchaseDropDelay = 400 // WAIT FOR STATE UPDATE BEFORE STARTING DROP
              for (let di = 0; di <= dropSteps; di++) {
                setTimeout(() => {
                  const progress = di / dropSteps
                  const eased = Math.sin((progress * Math.PI) / 2) // Match the sine ease used in main drop
                  setLootPoolDropProgressPool(prev => ({ ...prev, [pool.id]: eased }))
                }, purchaseDropDelay + (di * (poolDropDuration / dropSteps)))
              }
            }
            const cardCount = Math.min((pool.cards || []).length, 3)
            const cardFlipDelay = 250 // ms between each card flip in a pool
            const flipStartOffset = (prevIdsStr && !initialEntranceRef.current) ? (poolDropDuration + 500) : 300 // wait slightly after drop before flipping

            for (let i = 0; i < cardCount; i++) {
              setTimeout(() => {
                setLootCardFlips(prev => {
                  const currentFlips = prev[pool.id] || []
                  if (currentFlips.includes(i)) return prev
                  return { ...prev, [pool.id]: [...currentFlips, i] }
                })
              }, i * cardFlipDelay + flipStartOffset)
            }

            // Mark this pool as animated only after its drop+flip animation completes
            try {
              const markDelay = flipStartOffset + (cardCount * cardFlipDelay) + 120
              setTimeout(() => {
                try {
                  animatedPoolsRef.current.add(poolIdKey)
                } catch (e) {}
              }, markDelay)
            } catch (e) {}
          } catch (e) {}
        })
      })
    }, allDropsCompleteDelay)
    try {
      setTimeout(() => {
        try { initialEntranceRef.current = false } catch (e) {}
      }, allDropsCompleteDelay + poolDropDuration + 120)
    } catch (e) {}
    return () => { try { if (_removeHeightTimeout) clearTimeout(_removeHeightTimeout) } catch (e) {} }
  }, [player?.shopState?.lootOffers])

  // Typing for shopkeeper/dialogue messages extracted to `useTyping`.
  const _stageForTyping = player?.shopState?.stage || null
  const _dialogueForTyping = (shopTopMessage && shopTopMessage.type === 'dialogue')
    ? (shopTopMessage.text || '')
    : (!shopTopMessage && !_stageForTyping
        ? (shopkeeperGreeting || (Array.isArray(shopkeeperDialogues) ? (shopkeeperDialogues.find((d: any) => d.type === 'GREETING')?.text || '') : ''))
        : '')
  const _exitActiveForTyping = statButtonsExit || skillButtonsExit || trainingButtonsExit || statAnimating
  const shopkeeperTyped = useTyping(_dialogueForTyping, { speed: TYPING_SPEED, pause: _exitActiveForTyping })

  // trigger effect when level-up appears
  useEffect(() => {
    if (!showLevelUp) return
  }, [showLevelUp])

  

  // Player must click to start the shop (respond to Hugin). This prevents
  // auto-awarding without the user's explicit action.
  const startShop = async () => {
    if (!player) return
    setLoading(true)
    try {
      setAutoStarted(true)
      const beforeGold = Number(player.gold || 0)
      const beforeXp = Number(player.xp || 0)
      const prevLevel = computeLevel((player?.xp || 0), settings.levelXpCurve)
      const res = await call('start')
      if (!res) return
      const updated = res.player
      const afterGold = Number(updated?.gold || 0)
      const afterXp = Number(updated?.xp || 0)
      const gainedGold = (res.awarded && typeof res.awarded.gold === 'number') ? res.awarded.gold : Math.max(0, afterGold - beforeGold)
      const gainedXp = (res.awarded && typeof res.awarded.xp === 'number') ? res.awarded.xp : Math.max(0, afterXp - beforeXp)

      if (res.shopGreeting) {
        setShopkeeperGreeting(res.shopGreeting)
        setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeperGreeting: res.shopGreeting } }) : prev)
        // Display the start greeting in the top message but do not append to history.
        setShopTopMessage({ type: 'dialogue', text: res.shopGreeting, label: (displayedShopkeeper?.name || 'Shopkeeper') })
      }

      if (gainedGold > 0 || gainedXp > 0) {
        const upd = updated || res.player
        const label = (upd && session && upd.user && session.user && upd.user.id === session.user.id) ? 'You' : (upd?.user?.name || upd?.displayName || 'Player')
        const text = `${label} gained ${gainedGold} gold and ${gainedXp} XP this round.`
        // keep award message persistent until dismissed by user
        addHistory({ ts: Date.now(), type: 'award', text, gold: gainedGold, xp: gainedXp })
        // show animated gains
        try {
          if (recentGainsTimeoutRef.current) window.clearTimeout(recentGainsTimeoutRef.current)
        } catch (e) {}
        setRecentGains({ gold: gainedGold, xp: gainedXp, visible: true })
        recentGainsTimeoutRef.current = window.setTimeout(() => {
          setRecentGains(prev => prev ? { ...prev, visible: false } : null)
            // Detect returning visits: if sessionStorage previously visited this shop, notify server to append a RETURNING dialogue
            try {
              if (typeof window !== 'undefined' && storageKey) {
                const visited = window.sessionStorage.getItem(storageKey + ':visited')
                if (visited) {
                  // fire-and-forget
                  axios.post('/api/kdr/shop', { kdrId: String(id), action: 'markReturned' }).catch(() => {})
                } else {
                  window.sessionStorage.setItem(storageKey + ':visited', '1')
                }
              }
            } catch (e) {}
          recentGainsTimeoutRef.current = null
        }, 3000)
        // check for level up
        try {
          const newLevel = computeLevel((updated?.xp || 0), settings.levelXpCurve)
          if (newLevel > prevLevel) {
            // show level up popup briefly and set a persistent level message
            if (levelUpTimeoutRef.current) {
              try { window.clearTimeout(levelUpTimeoutRef.current) } catch (e) {}
            }
            setShowLevelUp(true)
            // message for the new level (display human-friendly 1-based level)
            const lvlMsg = `Level ${newLevel + 1} Reached!`
            setLevelUpMessage(lvlMsg)
            addHistory({ ts: Date.now(), type: 'level', text: lvlMsg, level: newLevel + 1 })
            levelUpTimeoutRef.current = window.setTimeout(() => {
              setShowLevelUp(false)
              levelUpTimeoutRef.current = null
            }, 3000)
          }
        } catch (e) {}
      }
    } catch (e) {
      // ignore errors here; call() already surfaces messages
    } finally {
      setLoading(false)
    }
  }

  const joinKdr = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await axios.post('/api/kdr/join', { kdrId: String(id) })
      setPlayer(res.data || null)
      setMessage('Joined KDR')
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const settings = settingsFor(kdr)
  const currentLevel = computeLevel((player?.xp || 0), settings.levelXpCurve)
  const nextLevelXp = (settings.levelXpCurve && settings.levelXpCurve.length > (currentLevel + 1)) ? settings.levelXpCurve[currentLevel + 1] : (settings.levelXpCurve ? settings.levelXpCurve[settings.levelXpCurve.length - 1] : (player?.xp || 0))
  const currentLevelXp = (settings.levelXpCurve && settings.levelXpCurve.length > currentLevel) ? settings.levelXpCurve[currentLevel] : 0
  const xpToNext = Math.max(0, nextLevelXp - (player?.xp || 0))
  const pct = nextLevelXp === currentLevelXp ? 100 : Math.min(100, Math.round(((player?.xp || 0) - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp) * 100))
  const willLevelOnStart = computeLevel((player?.xp || 0) + (settings.xpPerRound || defaults.xpPerRound), settings.levelXpCurve) > currentLevel

  // Training cost and how many training sessions are needed to reach next level
  const trainingCost = Number(settings.trainingCost || defaults.trainingCost || 0)
  const trainingXp = Number(settings.trainingXp || defaults.trainingXp || 0)
  const sessionsToNext = Math.max(1, Math.ceil(xpToNext > 0 ? (xpToNext / Math.max(1, trainingXp)) : 1))

  // Prefer stats stored in player's shopState (persisted during shop) but fall back
  // to top-level `player.stats` if present. This ensures stat changes from the
  // shop (which are persisted into shopState) are reflected immediately.
  const displayedStats = ((player?.shopState && (player.shopState as any).stats) ? (player.shopState as any).stats : (player?.stats || {}))

  // Available stat points the player can spend in the shop. Prefer persisted
  // value in `player.shopState.statPoints` and fall back to 0.
  const statPoints = Number((player?.shopState && typeof player.shopState.statPoints !== 'undefined') ? player.shopState.statPoints : (player?.shopState?.statPoints ?? 0) || 0)

  // keep a ref to the latest statPoints so timeout callbacks can read the
  // current value (closures capture stale values otherwise)
  useEffect(() => { statPointsRef.current = Number(statPoints || 0) }, [statPoints])

  const [hoveredLoot, setHoveredLoot] = useState<{ section: string, tier: string } | null>(null)
  const [purchasedPoolsList, setPurchasedPoolsList] = useState<any[] | null>(null)
  const [purchasedModalContext, setPurchasedModalContext] = useState<{ tier: string, isClass: boolean } | null>(null)

  const purchaseFlyRef = React.useRef<PurchaseFlyPileHandle | null>(null)

  // When entering TRAINING stage (and no pendingSkillChoices), pick a random
  // TRAINING dialogue for the shopkeeper and show Train / Don't Train choices.
  useEffect(() => {
    if (suppressStageEffectRef.current) return
    const stage = player?.shopState?.stage || null
    const pending = player?.shopState?.pendingSkillChoices || null
    // Only act when in TRAINING and there are no pending skill choices
    if (stage !== 'TRAINING') return
    if (Array.isArray(pending) && pending.length > 0) return
    // Do not show training while the stat chooser is active or visible
    if (statChooserActive || showStatChoices || statPoints > 0) return

    // If we've already shown training for this session, ensure choices are visible
    if (trainingShownRef.current) {
      setShowTrainingChoices(true)
      return
    }

    let mounted = true
    ;(async () => {
      try {
        const sk = displayedShopkeeper || player?.shopState?.shopkeeper
        // If no explicit shopkeeper, still show choices but no dialogue
        if (!sk || !sk.id) {
          trainingShownRef.current = true
          if (mounted) setShowTrainingChoices(true)
          return
        }

        // Use cached dialogues if present
        let dlgList = dialoguesCacheRef.current[sk.id]
        if (!dlgList) {
          try {
            const res = await axios.get(`/api/shopkeepers/${sk.id}/dialogues`)
            dlgList = res.data || []
            dialoguesCacheRef.current[sk.id] = dlgList
          } catch (e) {
            dlgList = []
          }
        }

        const trainingLines = (dlgList || []).filter((d: any) => d.type === 'TRAINING')
        let pick = null
        if (trainingLines.length > 0) pick = trainingLines[Math.floor(Math.random() * trainingLines.length)]
        if (mounted) {
          trainingShownRef.current = true
          if (pick && pick.text) {
            // Only show a TRAINING dialogue on first entry to the TRAINING phase
            if (lastDialoguePhaseRef.current !== 'TRAINING') {
              setTrainingDialogue(pick.text)
              // Show training dialogue in top box but do not append to history.
              setShopkeeperGreeting(pick.text)
              setShopTopMessage({ type: 'dialogue', text: pick.text, label: (displayedShopkeeper?.name || 'Shopkeeper') })
              lastDialoguePhaseRef.current = 'TRAINING'
            }
          }
          setShowTrainingChoices(true)
        }
      } catch (e) {
        trainingShownRef.current = true
        if (mounted) setShowTrainingChoices(true)
      }
    })()

    return () => { mounted = false }
  }, [player?.shopState?.stage, player?.shopState?.pendingSkillChoices, displayedShopkeeper?.id, statChooserActive, showStatChoices, statPoints])

  // Ensure client UI follows server-authoritative shop stage.
  useEffect(() => {
    const stage = player?.shopState?.stage || null
    // reset per-stage dialogue tracking whenever the authoritative stage changes
    if (stage !== lastStageRef.current) {
      // leaving TRAINING should allow training dialogue to appear again later
      if (lastStageRef.current === 'TRAINING') trainingShownRef.current = false
      // reset per-phase shown flags when authoritative stage changes
      lastDialoguePhaseRef.current = null
      statShownRef.current = false
      lastStageRef.current = stage
    }
    // SKILL stage -> ensure skill choices animate in
    if (stage === 'SKILL') {
      // If we are already animating or already have choices displayed, don't retrigger
      if (animateSkills && localPendingChoices && localPendingChoices.length > 0) return

      // retrigger entrance robustly: clear previous timeout, ensure training
      // buttons are reset, populate local choices...
      try { if (skillEntranceTimeoutRef.current) { window.clearTimeout(skillEntranceTimeoutRef.current); skillEntranceTimeoutRef.current = null } } catch (e) {}
      setAnimateSkills(false)
      try { setLocalPendingChoices(player?.shopState?.pendingSkillChoices || []) } catch (e) {}
      setSkillButtonsExit(false)
      // If training buttons are mid-exit, wait for that animation to finish
      if (trainingButtonsExit) {
        const wait = 700 + 80
        skillEntranceTimeoutRef.current = window.setTimeout(() => {
          try { if (shopWindowRef.current) { shopWindowRef.current.getBoundingClientRect() } } catch (e) {}
          setAnimateSkills(true)
          skillEntranceTimeoutRef.current = null
        }, wait)
      } else {
        skillEntranceTimeoutRef.current = window.setTimeout(() => {
          try { if (shopWindowRef.current) { shopWindowRef.current.getBoundingClientRect() } } catch (e) {}
          setAnimateSkills(true)
          skillEntranceTimeoutRef.current = null
        }, 120)
      }
      return
    }
    // STATS stage -> ensure stat chooser is visible
    if (stage === 'STATS') {
      // If skill choices are still visible or animating exit, wait for them
      if (animateSkills || skillButtonsExit || localPendingChoices) {
        setSkillButtonsExit(true)
        const wait = 700 + 100 // Wait for skill exit animation
        const t = window.setTimeout(() => {
          setAnimateSkills(false)
          setLocalPendingChoices(null)
          setStatChooserActive(true)
          setShowStatChoices(true)
          setSkillButtonsExit(false)
        }, wait)
        return () => { try { window.clearTimeout(t) } catch (e) {} }
      }
      setStatChooserActive(true)
      setShowStatChoices(true)
      return
    }
    // TRAINING stage -> show training choices, but wait for any stat-exit animation to finish
    if (stage === 'TRAINING') {
      // If stat chooser is active / visible, trigger its exit and wait for its CSS animation
      if (statChooserActive || showStatChoices || (statPoints > 0)) {
        if (!statButtonsExit && showStatChoices) setStatButtonsExit(true)
        // wait for the stat exit animation to complete (700ms) plus a small buffer
        const wait = 700 + 80
        const t = window.setTimeout(() => {
          setShowTrainingChoices(true)
          setStatChooserActive(false)
          setShowStatChoices(false)
          setStatButtonsExit(false)
        }, wait)
        return () => { try { window.clearTimeout(t) } catch (e) {} }
      }
      // otherwise immediately show training choices
      setShowTrainingChoices(true)
      setStatChooserActive(false)
      setShowStatChoices(false)
      return
    }
    // other stages: hide transient UIs
    setAnimateSkills(false)
    setLocalPendingChoices(null)
    setStatChooserActive(false)
    setShowStatChoices(false)
    setShowTrainingChoices(false)
  }, [player?.shopState?.stage, player?.shopState?.pendingSkillChoices, statChooserActive, showStatChoices, statButtonsExit, statPoints])

  // Determine current round number (best-effort)
  const currentRoundNumber = (() => {
    try {
      if (!kdr || !kdr.rounds || kdr.rounds.length === 0) return null
      const rounds = kdr.rounds || []
      const current = rounds.find((r: any) => (r.matches || []).some((m: any) => m.status !== 'COMPLETED')) || rounds[rounds.length - 1]
      return current ? current.number : null
    } catch (e) {
      return null
    }
  })()

  // shopkeeper image (use the stable displayedShopkeeper when available)
  const skImg = (displayedShopkeeper && displayedShopkeeper.image) ? displayedShopkeeper.image : ((player?.shopState?.shopkeeper && player.shopState.shopkeeper.image) ? player.shopState.shopkeeper.image : null)

  return (
    <div
      className="p-6 min-h-screen w-full overflow-x-hidden bg-gray-100 dark:bg-gray-900 flex flex-col items-center"
      ref={fullParentRef}
      style={{
        height: scaledHeight ? `${scaledHeight}px` : undefined,
        overflow: 'hidden'
      }}
    >
      <div className="w-full shrink-0" ref={fullChildRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: scale < 1 ? `${currentDesignWidth}px` : '100%', display: 'block' }}>
        <h1 className="text-2xl font-bold mb-4 text-left">Shop — KDR {String(id)}{currentRoundNumber ? ` — Round ${currentRoundNumber}` : ''}</h1>

      {!player ? (
        !playerFetched ? (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded border border-gray-100 dark:border-transparent">
            <div className="text-sm text-gray-400 mb-3">Loading...</div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded border border-gray-100 dark:border-transparent">
            <div className="text-sm text-gray-400 mb-3">You are not joined to this KDR.</div>
            <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={joinKdr} disabled={loading}>Join KDR</button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Left: Shopkeeper image only (no box, no labels) */}
          <div className="col-span-12 lg:col-span-2 p-6 flex items-start flex-col">
            {skImg ? (
              <img src={skImg} alt={(displayedShopkeeper?.name || player?.shopState?.shopkeeper?.name) || 'Shopkeeper'} className="w-full h-auto object-contain shopkeeper-float" />
            ) : (
              <div className="w-full h-48 flex items-center justify-center text-sm text-gray-400">No image</div>
            )}

            {/* Loot tier unlock indicator beneath shopkeeper image: larger cards with hover affordance */}
            <div className="mt-4 w-full">
              <div className="grid grid-cols-1 gap-3">
                {['Class','Generic'].map((type) => {
                  const isClass = type === 'Class'
                  const sectionKey = isClass ? 'class' : 'generic'
                  return (
                    <div key={type} className="p-3 rounded-lg bg-gradient-to-br from-gray-900/30 to-transparent border border-gray-800 hover:scale-102 hover:shadow-xl transition-transform duration-150 ease-out">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-base font-bold text-white">{type} Loot</div>
                        <div className="text-xs text-gray-400">Hover for details</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {['STARTER','MID','HIGH'].map((tier) => {
                          const classLabels: Record<string, string> = { 'STARTER': 'Starter Packs', 'MID': 'Mid Quality', 'HIGH': 'High Quality' }
                          const genericLabels: Record<string, string> = { 'STARTER': 'Staples', 'MID': 'Removal/Disruption', 'HIGH': 'Engine' }
                          const tierLabel = isClass ? classLabels[tier] : genericLabels[tier]
                          const shortLabel = (tier === 'STARTER' ? 'Starter' : (tier === 'MID' ? 'Mid' : 'High'))
                          const minKey = `${sectionKey}${shortLabel}MinLevel`
                          const fallbackKey = `${sectionKey}StarterMinLevel`
                          const minLevel = Number(settings?.[minKey] ?? settings?.[fallbackKey] ?? 1)
                          const unlocked = ((currentLevel + 1) >= minLevel)

                          // Pools present for this tier/type (current offers)
                          const poolsAll = Array.isArray(player?.shopState?.lootOffers) ? (player!.shopState.lootOffers as any[]) : []
                          const offersForTier = poolsAll.filter((p: any) => (p.tier === tier) && (isClass ? !p.isGeneric : !!p.isGeneric))

                          // Exclude pools the player already purchased (don't show purchased pools)
                          const purchasesList = Array.isArray(player?.shopState?.purchases) ? player!.shopState.purchases : []
                          const purchasedIds = purchasesList
                            .filter((p: any) => p && (p.lootPoolId || p.lootPoolId === 0))
                            .map((p: any) => String(p.lootPoolId))

                          let displayPools = offersForTier.filter((p: any) => !purchasedIds.includes(String(p.id)))

                          // If there are fewer visible offers than originally offered, pick replacements
                          try {
                            const poolsSourceAll = isClass ? (classDetails?.lootPools || []) : (kdr?.genericLootPools || [])
                            const desiredCount = offersForTier.length || 0
                            const offeredIds = new Set((displayPools || []).map((p: any) => String(p.id)))
                            const need = Math.max(0, desiredCount - (displayPools.length || 0))
                            if (need > 0) {
                              const candidates = (poolsSourceAll || []).filter((lp: any) => !purchasedIds.includes(String(lp.id)) && !offeredIds.has(String(lp.id)))
                              for (let i = 0; i < Math.min(need, candidates.length); i++) {
                                displayPools.push(candidates[i])
                                offeredIds.add(String(candidates[i].id))
                              }
                            }
                          } catch (e) {}

                          let poolsCount = displayPools.length

                          // Determine total pools available from the class definition (for Class)
                          // or from the KDR's genericLootPools (for Generic).
                          let totalPools = 0
                          try {
                            if (isClass) {
                              totalPools = Array.isArray(classDetails?.lootPools) ? (classDetails.lootPools.filter((lp: any) => lp.tier === tier).length) : 0
                            } else {
                              totalPools = Array.isArray(kdr?.genericLootPools) ? (kdr.genericLootPools.filter((lp: any) => lp.tier === tier).length) : 0
                            }
                          } catch (e) {
                            totalPools = 0
                          }

                          // Fallback to settings count if we couldn't locate pools from class/generic data
                          if (!totalPools) {
                            const countKey = `${sectionKey}${shortLabel}Count`
                            const fallbackCountKey = `${sectionKey}StarterCount`
                            totalPools = Number(settings?.[countKey] ?? settings?.[fallbackCountKey] ?? 0)
                          }

                          // XP required for the minimum level (settings.levelXpCurve is an array of XP thresholds)
                          const xpCurve = settings?.levelXpCurve || []
                          const xpForMinLevel = (minLevel > 0 && xpCurve && xpCurve.length >= minLevel) ? xpCurve[minLevel - 1] : (xpCurve && xpCurve.length ? xpCurve[xpCurve.length - 1] : 0)
                          const xpToUnlock = Math.max(0, Number(xpForMinLevel || 0) - Number(player?.xp || 0))

                          const isHovered = hoveredLoot && hoveredLoot.section === sectionKey && hoveredLoot.tier === tier

                          // purchases for counts
                          const purchases = Array.isArray(player?.shopState?.purchases) ? player!.shopState.purchases : []
                          const poolsSourceLocal = isClass ? (classDetails?.lootPools || []) : (kdr?.genericLootPools || [])
                          const offersSourceLocal = Array.isArray(player?.shopState?.lootOffers) ? player!.shopState.lootOffers : []
                          // Recompute "seen" count for this tier/type from persisted shopState.seen
                          try {
                            const seenIds = Array.isArray(player?.shopState?.seen) ? (player!.shopState.seen || []).map((s: any) => String(s)) : []
                            const seenSet = new Set<string>()
                            for (const sid of seenIds) {
                              let pool = offersSourceLocal.find((lp: any) => String(lp.id) === String(sid))
                              if (!pool) pool = poolsSourceLocal.find((lp: any) => String(lp.id) === String(sid))
                              if (!pool) continue
                              const matchesTier = (pool.tier === tier)
                              const matchesType = isClass ? !pool.isGeneric : !!pool.isGeneric
                              if (matchesTier && matchesType) seenSet.add(String(pool.id))
                            }
                            poolsCount = seenSet.size
                          } catch (e) {}
                          const purchasedCount = purchases
                            .filter((p: any) => p && (p.lootPoolId || p.lootPoolId === 0))
                            .map((p: any) => {
                              const pid = p.lootPoolId
                              let pool = offersSourceLocal.find((lp: any) => String(lp.id) === String(pid))
                              if (!pool) pool = poolsSourceLocal.find((lp: any) => String(lp.id) === String(pid))
                              return pool
                            })
                            .filter(Boolean)
                            .filter((pl: any) => (pl.tier === tier) && (isClass ? !pl.isGeneric : !!pl.isGeneric)).length

                          return (
                            <div
                              key={tier}
                              onMouseEnter={() => setHoveredLoot({ section: sectionKey, tier })}
                              onMouseLeave={() => setHoveredLoot(null)}
                              onClick={() => { try { openPurchasedModal(tier, isClass) } catch (e) { setPurchasedPoolsList([]); setPurchasedModalContext(null) } }}
                              className="flex items-center justify-between p-3.5 bg-gray-900/40 rounded-lg hover:bg-gray-800/40 hover:translate-x-1 transition-all duration-150 cursor-pointer"
                            >
                              <div>
                                <div className="text-base text-white font-medium">{tierLabel}</div>
                                {isHovered ? (
                                  <div className="text-xs text-gray-300">{xpToUnlock} XP away • Seen: {poolsCount} • Pools: {purchasedCount} / {totalPools}</div>
                                ) : (
                                  <div className="text-xs text-gray-400">Requires Lvl {minLevel}</div>
                                )}
                              </div>
                              <div className={"px-2 py-0.5 rounded-full text-xs font-medium " + (unlocked ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300')}>{unlocked ? 'UNLOCKED' : 'LOCKED'}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <style jsx global>{`
              .shopkeeper-float { transform-origin: center; animation: shopFloat 4200ms ease-in-out infinite; }
              @keyframes shopFloat { 0% { transform: translateY(0px) } 50% { transform: translateY(-22px) } 100% { transform: translateY(0px) } }
              
              @keyframes flyUp {
                0% {
                  transform: translateY(600px);
                  opacity: 0;
                }
                100% {
                  transform: translateY(0);
                  opacity: 1;
                }
              }

              @keyframes slideInFromRight {
                0% {
                  transform: translateX(120%);
                  opacity: 0;
                }
                100% {
                  transform: translateX(0);
                  opacity: 1;
                }
              }

              @keyframes slideOutToLeft {
                0% {
                  transform: translateX(0);
                  opacity: 1;
                }
                100% {
                  transform: translateX(-120%);
                  opacity: 0;
                }
              }

              @keyframes fadeOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(-100px); }
              }
              
              .pool-purchase-slide-out {
                 animation: slideOutToLeft 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
              }
            `}</style>
          </div>

          {/* Center: Big Shop Window using most vertical space */}
          <div className="col-span-12 lg:col-span-7 p-6">
            <div ref={shopWindowRef} className="relative min-h-[72vh] max-h-[72vh] bg-white/6 dark:bg-white/6 border-2 border-gray-200 dark:border-gray-700 rounded-lg flex flex-col p-6 overflow-y-auto shadow-lg custom-scrollbar overflow-x-hidden" style={{ boxShadow: '0 10px 40px rgba(2,6,23,0.6)' }}>
              {/* Pool purchased banner must be rendered inside the shop window so absolute coords line up */}
              <PoolPurchasedBanner rect={poolBannerRect} visible={showPoolPurchasedBanner} onDone={() => {
                try {
                  setShowPoolPurchasedBanner(false)
                  
                  // apply pending server update so new offers appear
                  if (pendingPlayerUpdateRef.current) {
                    setPlayer(pendingPlayerUpdateRef.current)
                    pendingPlayerUpdateRef.current = null
                  }
                  
                  setPurchasedBannerPoolId(null)
                  setPoolBannerRect(null)
                  purchasedBannerGroupKeyRef.current = null
                } catch (e) {}
              }} />
              {/* pool-purchase-slide-out styles moved to global CSS to avoid nested styled-jsx issues */}
              <div className="text-xl font-semibold mb-4">Shop Window</div>
              {huginMessage && (
                <div className="mb-4 p-3 bg-amber-600 text-black rounded">{huginMessage}</div>
              )}

              {/* Top message: animate shopkeeper dialogue with a typing effect for dialogue lines */}
              <div className="flex items-center justify-between mb-2">
                <TopMessage shopTopMessage={shopTopMessage} shopkeeperTyped={shopkeeperTyped} player={player} />
                
                {/* Global Reroll Button (Replaced per-tier rerolls) */}
                {player?.shopState?.stage === 'LOOT' && (Math.floor(Number(player?.shopState?.stats?.cha || player?.stats?.cha || 0) / 2) > 0) && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (loading || lootExitPhase) return
                      const used = Number(player?.shopState?.rerollsUsed || 0)
                      const cha = Number(player?.shopState?.stats?.cha || player?.stats?.cha || 0)
                      const max = Math.floor(cha / 2)
                      if (used >= max) {
                        alert(`No rerolls remaining! (Used ${used}/${max})`)
                        return
                      }
                      
                      // Phase 1: Exit current pools
                      setLootExitPhase(true)
                      await new Promise(r => setTimeout(r, 600))
                      
                      setLoading(true)
                      try {
                        const res = await call('rerollLoot')
                        if (res && res.player) {
                          // FORCE a complete reset of the animation state so the 
                          // entry animation plays exactly as it did when the shop opened.
                          try {
                            prevOfferIdsRef.current = null 
                            animatedPoolsRef.current = new Set()
                            initialEntranceRef.current = true
                            setLootTierTyping({})
                            setLootLineProgress({})
                            setLootPoolDropProgress({})
                            setLootCardFlips({})
                            setStartLootPoolAnimation(false)
                            // Bump resync key to flip the key on the wrapper divs
                            setResyncKey(prev => prev + 1)
                          } catch (e) {}

                          setPlayer(res.player)
                          
                          // Phase 2: Switch off exit phase to allow new pools to drop in
                          setLootExitPhase(false)
                        } else {
                          setLootExitPhase(false)
                        }
                        addHistory({ ts: Date.now(), type: 'reroll', text: `You rerolled ALL shop offers.` })
                      } finally { 
                        setLoading(false) 
                      }
                    }}
                    disabled={loading || lootExitPhase || Number(player?.shopState?.rerollsUsed || 0) >= Math.floor(Number(player?.shopState?.stats?.cha || player?.stats?.cha || 0) / 2)}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-black uppercase italic tracking-widest text-[10px] py-2 px-4 rounded-full flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all transform hover:scale-105 active:scale-95"
                  >
                    <span className="text-sm">🎲</span>
                    <span>Reroll All ({Number(player?.shopState?.rerollsUsed || 0)}/{Math.floor(Number(player?.shopState?.stats?.cha || player?.stats?.cha || 0) / 2)})</span>
                  </button>
                )}
              </div>

              {/* Skill choices: appear directly under the shopkeeper's skill offer dialogue */}
              {(!trainingButtonsExit && ((player?.shopState?.pendingSkillChoices && player.shopState.pendingSkillChoices.length > 0) || (localPendingChoices && localPendingChoices.length > 0 && (animateSkills || skillButtonsExit)))) && (
                <SkillChoicesContainer
                  choices={player?.shopState?.pendingSkillChoices || []}
                  localPendingChoices={localPendingChoices}
                  animateSkills={animateSkills}
                  skillButtonsExit={skillButtonsExit}
                  skillCardFromY={skillCardFromY}
                  setCardRef={(id: string, el: HTMLDivElement | null) => { try { setSkillCardRef(id, el) } catch (e) {} }}
                  onCardClick={async (c: any, idx: number) => {
                    if (loading || skillButtonsExit) return
                    setLoading(true)
                    try {
                      try { if (player?.shopState?.pendingSkillChoices && player.shopState.pendingSkillChoices.length) setLocalPendingChoices(player.shopState.pendingSkillChoices) } catch (e) {}
                      try { suppressStageEffectRef.current = true } catch (e) {}
                      const res = await call('chooseSkill', { skillId: c.id })
                      try {
                        const upd = res?.player || player
                        const label = (upd && session && upd.user && session.user && upd.user.id === session.user.id) ? 'You' : (upd?.user?.name || upd?.displayName || 'Player')
                        addHistory({ ts: Date.now(), type: 'skill', text: `${label} chose skill: ${c.name}`, skillId: c.id, skillName: c.name })
                      } catch (e) {}
                      try {
                        setSkillButtonsExit(true)
                        const choicesLen = (player?.shopState?.pendingSkillChoices && player.shopState.pendingSkillChoices.length) || (localPendingChoices && localPendingChoices.length) || 1
                        const perCardDelay = 120
                        const containerDuration = 700
                        const stagger = Math.max(0, (choicesLen - 1) * perCardDelay)
                        // Only wait for the container animation plus a small buffer —
                        // don't wait for the full per-card stagger so stats appear sooner.
                        const totalWait = containerDuration + 80
                        window.setTimeout(() => {
                          setAnimateSkills(false)
                          if (res && res.player) setPlayer(res.player)
                          setSkillButtonsExit(false)
                          setStatChooserActive(true)
                          setShowStatChoices(true)
                          setLocalPendingChoices(null)
                          suppressStageEffectRef.current = false
                        }, totalWait)
                      } catch (e) {
                        if (res && res.player) setPlayer(res.player)
                        setAnimateSkills(false)
                        setStatChooserActive(true)
                        setShowStatChoices(true)
                        setLocalPendingChoices(null)
                        suppressStageEffectRef.current = false
                      }
                    } finally { setLoading(false) }
                  }}
                />
              )}

              {/* Stat choice UI: appears after skill selection; remain visible while player has stat points */}
              {(statChooserActive && (showStatChoices || statPoints > 0)) && (
                <StatChooser
                  statButtonsExit={statButtonsExit}
                  statPoints={statPoints}
                  displayedStats={displayedStats}
                  bumpedStat={bumpedStat}
                  loading={loading}
                  statAnimating={statAnimating}
                  onChooseStat={async (key: string, e: React.MouseEvent) => {
                    // Wrap original click logic into a handler passed to the component
                    if (statPoints <= 0) return
                    try {
                      setStatAnimating(true)
                      const el = (e && (e.currentTarget as HTMLElement)) || null
                      if (el && typeof window !== 'undefined') {
                        const rect = el.getBoundingClientRect()
                        const oldVal = Number(displayedStats?.[key] ?? 0)
                        const newVal = oldVal + 1
                        const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
                        const colorMap: Record<string, string> = { dex: '#d97706', con: '#10b981', str: '#fb7185', int: '#0ea5e9', cha: '#8b5cf6' }
                        const chosenColor = colorMap[key] || '#fff'
                        const pop = { id, key, label: key.toUpperCase(), rect, color: chosenColor, oldValue: oldVal, newValue: newVal, showNew: false }
                        if (activeStatPop) {
                          statPopQueueRef.current.push(pop)
                        } else {
                          const startPop = (p: any) => {
                            setActiveStatPop(p)
                            requestAnimationFrame(() => {
                              window.setTimeout(() => {
                                setActiveStatPop((prev: any) => prev && prev.id === p.id ? ({ ...prev, showNew: true }) : prev)
                              }, 320)
                              window.setTimeout(() => {
                                setActiveStatPop((prev: any) => prev && prev.id === p.id ? null : prev)
                                const next = statPopQueueRef.current.shift()
                                if (next) {
                                  window.setTimeout(() => startPop(next), 60)
                                } else {
                                  setStatAnimating(false)
                                }
                              }, 920)
                            })
                          }
                          startPop(pop)
                        }
                      }
                    } catch (err) {}

                    setBumpedStat(key)
                    try {
                      const oldVal = Number(displayedStats?.[key] ?? 0)
                      const newVal = oldVal + 1
                      const colorMap: Record<string, string> = { dex: '#d97706', con: '#10b981', str: '#fb7185', int: '#0ea5e9', cha: '#8b5cf6' }
                      const chosenColor = colorMap[key] || '#fff'
                      setStatCenter({ label: key.toUpperCase(), oldValue: oldVal, newValue: newVal, showNew: false, color: chosenColor })
                      window.setTimeout(() => setStatCenter((p: any) => p ? ({ ...p, showNew: true }) : p), 300)
                      window.setTimeout(() => setStatCenter(null), 1200)
                    } catch (e) {}

                    setPlayer((prev: any) => {
                      if (!prev) return prev
                      const cur = (prev.shopState && (prev.shopState as any).stats) ? (prev.shopState as any).stats : (prev.stats || {})
                      const next = { ...(cur || {}), [key]: (Number(cur?.[key] || 0) + 1) }
                      const ss = { ...(prev.shopState || {}), stats: next }
                      return { ...prev, shopState: ss }
                    })
                    window.setTimeout(() => setBumpedStat(null), 1500)

                    setLoading(true)
                    try {
                      const res = await call('chooseStat', { stat: key })
                      if (res && res.player) setPlayer(res.player)
                      try {
                        const upd = res?.player || player
                        const label = (upd && session && upd.user && session.user && upd.user.id === session.user.id) ? 'You' : (upd?.user?.name || upd?.displayName || 'Player')
                        const newVal = (res?.player?.shopState?.stats?.[key] ?? res?.player?.stats?.[key] ?? ((player?.stats?.[key] ?? 0) + 1))
                        addHistory({ ts: Date.now(), type: 'stat', text: `${label} increased ${key.toUpperCase()} to ${newVal}`, stat: key, value: newVal, actor: label })
                      } catch (e) {}

                      try {
                        const remaining = Number(res?.player?.shopState?.statPoints ?? res?.player?.statPoints ?? player?.shopState?.statPoints ?? player?.statPoints ?? 0)
                        if (remaining > 0) {
                          if (statHideTimeoutRef.current) { try { window.clearTimeout(statHideTimeoutRef.current) } catch (e) {} ; statHideTimeoutRef.current = null }
                          setShowStatChoices(true)
                        } else {
                          if (statHideTimeoutRef.current) { try { window.clearTimeout(statHideTimeoutRef.current) } catch (e) {} }
                          setStatButtonsExit(true)
                          window.setTimeout(() => {
                            try { if (statPointsRef.current > 0) { setStatButtonsExit(false); return } } catch (e) {}
                            setShowStatChoices(false); setStatChooserActive(false); setStatButtonsExit(false); statHideTimeoutRef.current = null
                          }, 700)
                        }
                      } catch (e) {
                        if (statHideTimeoutRef.current) { try { window.clearTimeout(statHideTimeoutRef.current) } catch (e) {} }
                        statHideTimeoutRef.current = window.setTimeout(() => {
                          try { if (statPointsRef.current > 0) { statHideTimeoutRef.current = null; return } } catch (e) {}
                          setShowStatChoices(false); setStatChooserActive(false); statHideTimeoutRef.current = null
                        }, 3000)
                      }
                    } finally {
                      setLoading(false)
                    }
                  }}
                />
              )}

              {/* Training choice UI: render when shop is in TRAINING stage */}
              {showTrainingChoices && (
                <TrainingChoices
                  trainingButtonsExit={trainingButtonsExit}
                  loading={loading}
                  playerGold={player?.gold ?? 0}
                  trainingCost={trainingCost}
                  sessionsToNext={sessionsToNext}
                  cha={Number(player?.shopState?.stats?.cha || player?.stats?.cha || 0)}
                  rerollsUsed={player?.shopState?.rerollsUsed || 0}
                  onTrain={async () => {
                    setLoading(true)
                    try {
                      const prevLvl = computeLevel((player?.xp || 0), settings.levelXpCurve)
                      const res = await call('train')
                      if (!res) return
                      if (res.player) setPlayer(res.player)

                      const prevLevel = typeof res.prevLevel === 'number' ? res.prevLevel : prevLvl
                      const newLevel = typeof res.newLevel === 'number' ? res.newLevel : computeLevel((res.player?.xp || player?.xp || 0), settings.levelXpCurve)
                      
                      if (newLevel > prevLevel) {
                        try {
                          setTrainingButtonsExit(true)
                          window.setTimeout(() => {
                            setShowTrainingChoices(false)
                            setTrainingButtonsExit(false)
                          }, 700)
                        } catch (e) { setShowTrainingChoices(false) }

                        try { if (levelUpTimeoutRef.current) { try { window.clearTimeout(levelUpTimeoutRef.current) } catch (e) {} } } catch (e) {}
                        setShowLevelUp(true)
                        const lvlMsg = `Level ${newLevel + 1} Reached!`
                        setLevelUpMessage(lvlMsg)
                        addHistory({ ts: Date.now(), type: 'level', text: lvlMsg, level: newLevel + 1 })
                        levelUpTimeoutRef.current = window.setTimeout(() => {
                          setShowLevelUp(false)
                          levelUpTimeoutRef.current = null
                        }, 3000)
                      }
                    } finally { setLoading(false) }
                  }}
                  onDontTrain={async () => {
                    setLoading(true)
                    try {
                      // Trigger exit animation immediately
                      setTrainingButtonsExit(true)
                      // After the CSS exit duration, hide the choices and clear the exit flag
                      window.setTimeout(() => {
                        try { setShowTrainingChoices(false) } catch (e) {}
                        try { setTrainingButtonsExit(false) } catch (e) {}
                      }, 700)

                      // Fire the skipTraining RPC without awaiting it so next UI animations
                      // can proceed as soon as the exit animation finishes.
                      call('skipTraining', { offerCount: 3 }).then((res: any) => {
                        try { 
                          if (res && res.player) {
                            setPlayer(res.player)
                            // Safety net: if no treasures exist, backend skips to 'LOOT' stage.
                            // We need to trigger the loot offers call manually here.
                            if (res.skippedToLoot) {
                               call('lootOffers').catch(err => console.error('Loot fetch failed after treasure skip', err))
                            }
                          }
                        } catch (e) {}
                      }).catch(() => {})
                    } finally { setLoading(false) }
                  }}
                />
              )}

              {/* Start Shop button: show below greeting/dialogues, right-aligned in the Shop Window */}
              {(!player?.shopState || !player.shopState.stage) && !autoStarted && (
                <StartShopButton onStart={startShop} disabled={loading} />
              )}

              {/* Award and level messages moved to Shop History on the right */}
              {/* recentGains popup removed per user request */}

              {/* Level Up / Stat Center overlays */}
              {/* Gold sarcophagus reveal removed */}
              <LevelUpOverlay showLevelUp={showLevelUp} levelUpMessage={levelUpMessage} statCenter={statCenter} />
              {/* Treasure offers (free picks) - show card images inline (no inner window). Hide completely once exitPhase resets after server clears offers. */}
              {!trainingButtonsExit && player?.shopState?.treasureOffers && player.shopState.treasureOffers.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-16 items-start justify-center">
                    {player.shopState.treasureOffers.map((t: any, idx: number) => {
                      const card = t.card || {}
                      const idKey = card && (card.id || (card.konamiId ? String(card.konamiId) : null))

                      const isThirdParty = (url?: string | null) => {
                        if (!url) return false
                        try {
                          const u = new URL(String(url))
                          const host = u.hostname.toLowerCase()
                          if (host.includes('ygoprodeck.com') || host.includes('db.ygoprodeck.com') || host.includes('yugiohapi.com')) return true
                        } catch (e) {}
                        return false
                      }

                      const chooseLocal = (u?: string | null) => {
                        if (!u) return null
                        if (isThirdParty(u)) return null
                        return u
                      }

                      const rarityStr = String(t.rarity || t.card?.rarity || t.card?.rarityStr || '').toLowerCase().trim()
                      const isRare = (rarityStr === 'r' || rarityStr === 'rare' || rarityStr === 'r_rare')
                      const isSuperRare = (rarityStr === 'sr' || rarityStr === 'super rare' || rarityStr === 'super_rare')
                      const isUltraRare = (rarityStr === 'ur' || rarityStr === 'ultra rare' || rarityStr === 'ultra_rare')
                      const delayMs = Math.round(idx * (TREASURE_POP_MS + TREASURE_STAGGER_GAP))

                      return (
                        <TreasureOfferCard
                          key={t.id}
                          t={t}
                          idx={idx}
                          cardObj={card}
                          isRare={isRare}
                          isSuperRare={isSuperRare}
                          isUltraRare={isUltraRare}
                          delayMs={delayMs}
                          treasureAnimateIn={treasureAnimateIn}
                          exitPhase={exitPhase}
                          chosenTreasureId={chosenTreasureId}
                          treasureFlyDelta={treasureFlyDelta}
                          useLootArt={true}
                          treasureRef={(el) => { try { setTreasureRef(t.id, el) } catch (e) {} }}
                          onMouseEnter={(e: any) => { try { showHover(e, card, idKey) } catch (err) {} }}
                          onMouseMove={(e: any) => { try { moveHover(e) } catch (err) {} }}
                          onMouseLeave={() => { try { hideHover() } catch (err) {} }}
                          onWheel={(e: any) => { try { onTooltipWheel(e) } catch (err) {} }}
                          onClick={async (e: any) => { e.stopPropagation(); if (selecting || exitPhase > 0) return; try { await selectTreasure(t.id) } catch (err) {} }}
                          onPreview={(cardLike: any) => { try { previewCard(card || cardLike, card || cardLike) } catch (e) {} }}
                        />
                      )
                    })}
                  </div>

                  {/* treasure styles moved to global CSS to avoid nested styled-jsx */}

                  {/* removed modal: replaced with hover-info for performance and UX */}

                </div>
              )}

              {/* Case: Stage is DONE, player has finished everything */}
              {player?.shopState?.stage === 'DONE' && (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <div className="text-4xl">👋</div>
                  <h2 className="text-2xl font-bold text-white">Shop Complete!</h2>
                  <p className="text-gray-400 max-w-sm">
                    You've finished your shop session. You can now close this window or continue to review your gains.
                  </p>
                  <button
                    onClick={() => router.push(`/kdr/${id}`)}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-8 py-3 rounded-lg shadow-lg"
                  >
                    Close Shop
                  </button>
                </div>
              )}

              {/* Loot offers (purchasable pools) */}
              {(player?.shopState?.stage === 'LOOT' || (player?.shopState?.stage === 'DONE' && lootExitPhase)) && player?.shopState?.lootOffers && player.shopState.lootOffers.length > 0 && (() => {
                console.log('=== RENDERING LOOT POOLS ===', player.shopState.lootOffers.length, 'pools')
                
                const getTierLabel = (tier: string, isGeneric: boolean) => {
                  if (isGeneric) {
                    const genericLabels: Record<string, string> = {
                      'STARTER': 'Staples',
                      'MID': 'Removal/Disruption',
                      'HIGH': 'Engine'
                    }
                    return genericLabels[tier] || tier
                  } else {
                    const classLabels: Record<string, string> = {
                      'STARTER': 'Starter Packs',
                      'MID': 'Mid Quality',
                      'HIGH': 'High Quality'
                    }
                    return classLabels[tier] || tier
                  }
                }
                
              // Group pools by tier AND type (generic vs class)
              const groupKeyFunc = (pool: any) => `${pool.tier}_${pool.isGeneric ? 'generic' : 'class'}`
              const groups: Record<string, any[]> = {}
              const displayedGroups: Record<string, any[]> = {}
              
              // We want to calculate the total stock for each category
              const categoryStock: Record<string, number> = {}

              player.shopState.lootOffers.forEach((pool: any) => {
                const key = groupKeyFunc(pool)
                if (!groups[key]) {
                  groups[key] = []
                  categoryStock[key] = 0
                }
                groups[key].push(pool)
                
                // If this specific pool ID hasn't been bought, it counts as stock
                const hasBeenBought = (player?.shopState?.purchases || []).some((p: any) => String(p.lootPoolId) === String(pool.id))
                if (!hasBeenBought) {
                  categoryStock[key]++
                }
              })

              const sortedKeys = Object.keys(groups).sort((a, b) => {
                const tierOrderMap: Record<string, number> = { 'STARTER': 0, 'MID': 1, 'HIGH': 2 }
                const [tierA, typeA] = a.split('_')
                const [tierB, typeB] = b.split('_')
                if (typeA !== typeB) return typeA === 'class' ? -1 : 1
                return (tierOrderMap[tierA] ?? 99) - (tierOrderMap[tierB] ?? 99)
              })

              sortedKeys.forEach(key => {
                displayedGroups[key] = animatingOutGroups.has(key) ? (frozenPools[key] || groups[key]) : groups[key]
              })
              
              const tierOrderMap: Record<string, number> = { 'STARTER': 0, 'MID': 1, 'HIGH': 2 }
              
              return (
                <div className="mb-4 space-y-6 relative" key={player.shopState?.lootOffers?.[0]?.id ?? 'loot-container'}>
                  <div className="transition-opacity duration-300">
                  {sortedKeys.map((key) => {
                    const [tier, type] = key.split('_')
                    const poolsInGroup = displayedGroups[key]
                    const isGeneric = type === 'generic'
                    const tierLabel = getTierLabel(tier, isGeneric)
                    
                    const purchases = player?.shopState?.purchases || []
                    
                    // A tier should only be hidden if EVERYTHING in it is purchased
                    // and there are NO available pools in the lootOffers for this group.
                    // Actually, if it's in lootOffers, it's either available or purchased.
                    // If we have 0 stock, we hide it.
                    const remainingStock = categoryStock[key] || 0
                    if (remainingStock === 0 && !animatingOutGroups.has(key)) return null;
                    
                    const isRefilled = poolsInGroup.some(p => !p.__seen && !purchases.some((pur: any) => String(pur.lootPoolId) === String(p.id)));
                    const animationName = animatingOutGroups.has(key) ? 'fadeOut' : (isRefilled ? 'slideInFromRight' : 'flyUp');

                    return (
                        <div key={key} className="mb-14" style={{ 
                          animation: `${animationName} 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards`, 
                          animationDelay: animatingOutGroups.has(key) ? '0s' : `${(tierOrderMap[tier] ?? 0) * 0.1}s`, 
                          opacity: 0,
                          pointerEvents: animatingOutGroups.has(key) ? 'none' : 'auto'
                        }}>
                          <div className={`flex items-center justify-between mb-4 border-b-2 ${
                            tier === 'STARTER' ? 'border-blue-500/30' :
                            tier === 'MID' ? 'border-purple-500/30' :
                            'border-amber-500/30'
                          } pb-2`}>
                             <h3 className={`text-2xl font-black ${
                               tier === 'STARTER' ? 'text-blue-400' :
                               tier === 'MID' ? 'text-purple-400' :
                               'text-amber-400'
                             } tracking-tight uppercase`}>
                               {tierLabel}
                             </h3>

                            {/* Group Buy Button */}
                            {(() => {
                              const qualityCost = poolsInGroup[0]?.cost || 0
                              
                              return (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    if (loading || lootExitPhase) return
                                    
                                    setLoading(true)
                                      try {
                                        suppressStageEffectRef.current = true
                                        // Call handles the 'tier' logic to buy the whole quality
                                        const res = await call('purchaseLootPool', { tier, isGeneric })
                                        
                                        if (res && res.error) {
                                          alert(`Purchase failed: ${res.error}`)
                                        } else if (res && res.player) {
                                          // START PURCHASE ANIMATION
                                          // 1. FREEZE the current pools in place so they don't vanish when state updates
                                          setFrozenPools(prev => ({ ...prev, [key]: poolsInGroup }));
                                          setAnimatingOutGroups(prev => new Set(prev).add(key));

                                          // 2. Trigger the visual exit on the frozen elements
                                          const groupEl = groupNodeRefs.current[key];
                                          if (groupEl) {
                                            groupEl.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 1, 1)';
                                            groupEl.style.transform = 'translateX(-120vw)';
                                            groupEl.style.opacity = '0';
                                            groupEl.style.filter = 'blur(10px) grayscale(1)';
                                          }

                                          // 3. Wait for the exit animation to finish before swapping to new pools
                                          setTimeout(() => {
                                            // Update the player state (this brings in the new pools from server)
                                            setPlayer(res.player);
                                            pendingPlayerUpdateRef.current = null;

                                            // Unfreeze and cleanup
                                            setAnimatingOutGroups(prev => {
                                              const next = new Set(prev);
                                              next.delete(key);
                                              return next;
                                            });
                                            setFrozenPools(prev => {
                                              const next = { ...prev };
                                              delete next[key];
                                              return next;
                                            });

                                            // Reset container for the new "Fly Up" entrance
                                            if (groupEl) {
                                              groupEl.style.transition = '';
                                              groupEl.style.transform = '';
                                              groupEl.style.opacity = '';
                                              groupEl.style.filter = '';
                                            }
                                          }, 600);
                                        }
                                      } finally {
                                        setLoading(false)
                                        suppressStageEffectRef.current = false
                                      }
                                  }}
                                  disabled={loading || player.gold < qualityCost}
                                  className={`group relative flex items-center justify-center bg-neutral-900 border-2 ${
                                    tier === 'STARTER' ? 'border-blue-500/40 hover:border-blue-400 shadow-blue-500/10' :
                                    tier === 'MID' ? 'border-purple-500/40 hover:border-purple-400 shadow-purple-500/10' :
                                    tier === 'STAPLES' ? 'border-blue-500/40 hover:border-blue-400 shadow-blue-500/10' :
                                    tier === 'REMOVAL' ? 'border-purple-500/40 hover:border-purple-400 shadow-purple-500/10' :
                                    'border-amber-500/40 hover:border-amber-400 shadow-amber-500/10'
                                  } px-8 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl`}
                                >
                                  <div className="flex flex-col items-center">
                                    <span className={`text-[10px] ${
                                      tier === 'STARTER' ? 'text-blue-400' :
                                      tier === 'MID' ? 'text-purple-400' :
                                      tier === 'STAPLES' ? 'text-blue-400' :
                                      tier === 'REMOVAL' ? 'text-purple-400' :
                                      'text-amber-400'
                                    } font-black uppercase tracking-widest leading-none mb-1`}>
                                      Purchase {tierLabel}
                                    </span>
                                    <span className="text-xl font-black text-white leading-none whitespace-nowrap">{qualityCost}G</span>
                                  </div>
                                </button>
                              )
                            })()}
                          </div>
                        <div ref={(el) => { try { groupNodeRefs.current[key] = el } catch (e) {} }} className="relative">
                           {/* Exit Layer: Slides away current pools */}
                           {lootExitPhase && (
                              <div className="flex flex-wrap gap-4 absolute inset-0 z-10 transition-all duration-700 ease-in" style={{ transform: 'translateX(-120vw)', opacity: 0 }}>
                                {poolsInGroup.map((pool: any) => (
                                  <div key={`exit-${pool.id}`} className="opacity-60 grayscale scale-95">
                                    <LootPoolTile 
                                      pool={pool} 
                                      onSelect={() => {}}
                                      isPurchased={true}
                                    />
                                  </div>
                                ))}
                              </div>
                           )}

                           {/* Entrance Layer: Tiles layout */}
                           <div className={`flex flex-wrap gap-4 transition-opacity duration-300 ${lootExitPhase ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                              {(animatingOutGroups.has(key) ? (frozenPools[key] || []) : poolsInGroup).map((pool: any) => {
                                const isPurchased = (player?.shopState?.purchases || []).some((p: any) => String(p.lootPoolId) === String(pool.id))
                                
                                return (
                                  <LootPoolTile
                                    key={pool.id}
                                    pool={pool}
                                    isPurchased={isPurchased || animatingOutGroups.has(key)}
                                    loading={loading}
                                    onSelect={() => openPoolViewer(pool)}
                                  />
                                )
                              })}
                           </div>
                        </div>
                        
                        {/* Summary of what they got if they already bought it */}
                        {false && (
                          <div className="mt-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center gap-4">
                            <span className="font-bold flex items-center gap-1">
                              <Icon name="check-circle-2" /> Tier Contents Acquired
                            </span>
                            <div className="h-4 w-px bg-emerald-500/20" />
                            <span className="flex items-center gap-1 opacity-80">
                              <Icon name="layers" /> {poolsInGroup.reduce((acc, p) => acc + (p.cards?.length || 0), 0)} Cards
                            </span>
                            <span className="flex items-center gap-1 opacity-80">
                              <Icon name="zap" /> {poolsInGroup.reduce((acc, p) => acc + (p.items?.filter((i:any) => i.type === 'Skill').length || 0), 0)} Skills
                            </span>
                            <span className="flex items-center gap-1 opacity-80 font-bold">
                              <Icon name="circle-dollar-sign" /> {poolsInGroup.reduce((acc, p) => acc + (p.items?.reduce((a:number, i:any) => a + (i.type === 'Gold' ? (i.amount || 0) : 0), 0) || 0), 0)}G Total
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  </div>
                </div>
                )
              })()}

                <div className="flex-1">
              </div>

              
              {/* Quick class overlay button moves to the action bar below */}

            </div>

            {/* Action Bar (Sell, Finish Shop, and Quick Inventory) */}
            <div className="mt-4 flex items-center justify-between">
              {/* Left: Quick Inventory Button */}
              <div className="flex items-center">
                <QuickClassButton 
                  ref={classButtonRef} 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    const ts = Date.now(); 
                    setOverlayOpenTs(ts); 
                    setShowClassOverlay(true) 
                  }} 
                  classDetails={classDetails} 
                  player={player} 
                />
              </div>

              {/* Right: Sell and Finish Shop Buttons */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowSell(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-4 rounded-xl shadow-lg flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-amber-500/10 min-w-[120px]"
                  style={{ transform: 'translateZ(0)' }}
                >
                  <span className="text-xl leading-none font-black uppercase tracking-tighter">Sell</span>
                  <span className="text-[10px] font-bold opacity-60 mt-1 uppercase">1G each</span>
                </button>

                {player?.shopState?.stage === 'LOOT' && (
                  <button
                    onClick={() => finishLootPhase()}
                    disabled={loading || selecting || lootExitPhase}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-10 py-4 rounded-xl shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-emerald-500/10 min-w-[200px]"
                    style={{ transform: 'translateZ(0)' }}
                  >
                    <span className="text-xl font-black uppercase tracking-tighter">
                      {loading && !lootExitPhase ? 'Finishing...' : 'Finish Shop'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: User Stats and Card Preview (taller) */}
          <UserPanel statPoints={statPoints} displayedStats={displayedStats} currentLevel={currentLevel} player={player} shopHistory={shopHistory} selectedCard={selectedCardModal} call={call} setPlayer={setPlayer} />
        </div>
      )}

      </div>

      <HoverTooltip hoverTooltip={hoverTooltip} cardDetailsCacheRef={cardDetailsCacheRef} tooltipScrollRef={tooltipScrollRef} />
      <SellModal 
        open={showSell} 
        onClose={() => setShowSell(false)} 
        player={player} 
        call={call} 
        setPlayer={setPlayer}
        showHover={showHover}
        moveHover={moveHover}
        hideHover={hideHover}
      />

      {/* Class quick-view overlay */}
      <ClassQuickView
        mounted={classOverlayMounted}
        overlayOpenTs={overlayOpenTs}
        classOverlayActive={classOverlayActive}
        showIframe={showIframe}
        iframeActive={iframeActive}
        iframeLoaded={iframeLoaded}
        id={id}
        playerKey={player?.playerKey}
        classDetails={classDetails}
        onClose={() => setShowClassOverlay(false)}
        onIframeLoad={() => { try { console.debug('shop: iframe onLoad', Date.now()) } catch (e) {} ; setIframeLoaded(true); if (overlayReady) setIframeActive(true) }}
      />

      {/* Loot Pool Detail Modal */}
      {selectedPool && (() => {
        const isBoughtFlag = !!selectedPool.__purchased || ((player?.shopState?.purchases || []).some((p: any) => String(p.lootPoolId) === String(selectedPool.id)))
        return (
          <LootPoolDetailModal
            pool={selectedPool}
            onClose={() => setSelectedPool(null)}
            onNext={allAvailablePools.length > 1 ? handleNextPool : undefined}
            onPrev={allAvailablePools.length > 1 ? handlePrevPool : undefined}
            showHover={showHover}
            moveHover={moveHover}
            hideHover={hideHover}
            onTooltipWheel={onTooltipWheel}
            hoverTooltip={hoverTooltip}
            cardDetailsCacheRef={cardDetailsCacheRef}
            tooltipScrollRef={tooltipScrollRef}
            ensureCardDetails={ensureCardDetails}
            onPurchase={!isBoughtFlag ? async () => {
              try {
                if (loading) return
                // Close the modal immediately (capture selected pool for animation)
                const poolToBuy = selectedPool
                setSelectedPool(null)
                setLoading(true)
                try {
                  // Prevent the centralized `call` helper from auto-applying player updates
                  try { suppressStageEffectRef.current = true } catch (e) {}
                  const res = await call('purchaseLootPool', { lootPoolId: poolToBuy.id })
                  if (res && res.error) {
                    alert(`Purchase failed: ${res.error}${res.have !== undefined ? ` (have ${res.have}G, need ${res.required}G)` : ''}`)
                  } else {
                      try {
                        const groupKey = `${poolToBuy.tier}_${poolToBuy.isGeneric ? 'generic' : 'class'}`
                        let targetEl = groupNodeRefs.current[groupKey]
                        if (!targetEl) targetEl = poolNodeRefs.current[String(poolToBuy.id)]
                        if (targetEl) {
                        try {
                          const gRect = (targetEl as HTMLElement).getBoundingClientRect()
                          if (shopWindowRef && shopWindowRef.current) {
                            const containerRect = shopWindowRef.current.getBoundingClientRect()
                            const relative = {
                              left: Math.round(gRect.left - containerRect.left),
                              top: Math.round(gRect.top - containerRect.top),
                              width: Math.round(gRect.width),
                              height: Math.round(gRect.height),
                              containerWidth: Math.round(containerRect.width),
                              containerHeight: Math.round(containerRect.height)
                            }
                            setPoolBannerRect(relative)
                          } else {
                            const relative = { left: Math.round(gRect.left), top: Math.round(gRect.top), width: Math.round(gRect.width), height: Math.round(gRect.height) }
                            setPoolBannerRect(relative)
                          }
                        } catch (e) { setPoolBannerRect(null) }
                        } else {
                          setPoolBannerRect(null)
                        }
                        setPurchasedBannerPoolId(String(poolToBuy.id))
                        setShowPoolPurchasedBanner(true)
                        if (res && res.player) pendingPlayerUpdateRef.current = res.player
                        try {
                          const groupKey2 = `${poolToBuy.tier}_${poolToBuy.isGeneric ? 'generic' : 'class'}`
                          const targetGroup = groupNodeRefs.current[groupKey2]
                          if (targetGroup) {
                            purchasedBannerGroupKeyRef.current = groupKey2
                            window.setTimeout(() => {
                              try { targetGroup.classList.add('pool-purchase-slide-out') } catch (e) {}
                            }, BANNER_OUT_DELAY)
                          }
                        } catch (e) {}
                      } catch (e) {}
                  }
                } catch (err: any) {
                  alert('Purchase failed; see console for details')
                }
                finally {
                  try { suppressStageEffectRef.current = false } catch (e) {}
                }
              } catch (e) {}
              finally { try { setLoading(false) } catch (e) {} }
            } : undefined}
            loading={loading}
          />
        )
      })()}

      {purchasedPoolsList && (
        <PurchasedSeenPoolsModal
          purchasedPoolsList={purchasedPoolsList}
          player={player}
          classDetails={classDetails}
          kdr={kdr}
          purchasedModalContext={purchasedModalContext}
          setPurchasedPoolsList={setPurchasedPoolsList}
          setPurchasedModalContext={setPurchasedModalContext}
          onClose={() => {
            setPurchasedPoolsList(null)
            setPurchasedModalContext(null)
          }}
          openPoolViewer={openPoolViewer}
        />
      )}
      <PurchaseFlyPile ref={purchaseFlyRef} />
    </div>
  )
}
