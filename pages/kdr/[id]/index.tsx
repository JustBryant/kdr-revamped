import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { useRouter } from 'next/router'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { CLASS_IMAGE_BASE_URL, getClassImageUrl } from '../../../lib/constants'
import { selectArtworkUrl } from '../../../components/common/CardImage'
import { RichTextRenderer } from '../../../components/RichText'
import useCollaborative from '../../../components/collab/useCollaborative'
import AnimatedModal from '../../../components/common/AnimatedModal'
import TournamentSettingsModal from '../../../components/kdr/TournamentSettingsModal'
import HoverTooltip from '../../../components/shop-v2/components/HoverTooltip'
import useShopCaches from '../../../components/shop-v2/utils/useShopCaches'

export default function KdrViewPage() {
  const router = useRouter()
  const { id } = router.query
  const { data: session } = useSession()
  const [kdr, setKdr] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [classes, setClasses] = useState<Array<any>>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lootOpen, setLootOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [selectedMatchForReport, setSelectedMatchForReport] = useState<any>(null)
  const [lootOptions, setLootOptions] = useState<{ skills: any[], packs: any[] } | null>(null)
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [selectedSkillItemId, setSelectedSkillItemId] = useState<string | null>(null)
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null)
  const [typedPassword, setTypedPassword] = useState('')
  const [matchScores, setMatchScores] = useState<Record<string, { scoreA: number | null; scoreB: number | null }>>({})
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; players?: any[] } | null>(null)

  const { cardDetailsCacheRef, ensureCardDetails } = useShopCaches()
  const [hoverTooltip, setHoverTooltip] = useState<any>({ visible: false, x: 0, y: 0, idKey: null, cardLike: null })
  const tooltipScrollRef = React.useRef<HTMLDivElement | null>(null)

  const fetchKdr = async () => {
    if (!id) return
    try {
      const res = await axios.get(`/api/kdr/${id}`)
      setKdr(res.data)
      // If we had an error before, clear it if fetch succeeds
      setMessage(prev => prev === 'Failed to load KDR' ? null : prev)
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Failed to load KDR')
    }
  }

  const { send: sendUpdate, userIds, setUserId } = useCollaborative(id ? `kdr-${id}` : null, (msg) => {
    // Only trigger a full fetch for important events to avoid thundering updates.
    try {
      const t = msg?.type
      const action = msg?.action || (msg?.meta && msg.meta.action) || null
      const importantActions = new Set([
        'join', 'leave', 'match-reported', 'start', 'kick', 'create', 'generate', 'round-generated', 'match-update'
      ])

      if (t === 'refresh') {
        console.log('[collab] Remote refresh requested', msg)
        fetchKdr()
        return
      }

      if (t === 'update' && action && importantActions.has(action)) {
        console.log('[collab] Remote important update', action, msg)
        fetchKdr()
      }
    } catch (e) {
      // ignore malformed messages
    }
  })

  // Hook into lobby too for cross-page refreshes
  const { send: sendLobbyUpdate, userIds: lobbyUserIds, setUserId: setLobbyUserId } = useCollaborative('kdr-lobby', (msg) => {
    // Listen for specific lobby actions that affect this view.
    try {
      const t = msg?.type
      const action = msg?.action || (msg?.meta && msg.meta.action) || null
      if (t === 'update' && (action === 'join' || action === 'leave' || action === 'create' || action === 'match-update')) {
        fetchKdr()
      }
    } catch (e) {}
  })

  const currentPlayer = (kdr?.players || []).find((p: any) => p.user?.id === session?.user?.id || p.user?.email === session?.user?.email)
  const amIJoined = !!currentPlayer

  useEffect(() => {
    if (currentPlayer?.id) {
      setUserId(currentPlayer.id)
      setLobbyUserId(currentPlayer.id)
    }
  }, [currentPlayer?.id, setUserId, setLobbyUserId])

  const triggerGlobalRefresh = () => {
    console.log('[collab] Triggering global refresh broadcast')
    sendUpdate({ type: 'update', action: 'refresh' })
    sendLobbyUpdate({ type: 'update', action: 'refresh' })
  }

  const triggerMatchUpdate = () => {
    console.log('[collab] Triggering global match-update broadcast')
    sendLobbyUpdate({ type: 'match-update' })
  }

  const showHover = React.useCallback((e: any, cardLike?: any, idKey?: any, skills?: any[]) => {
    try { if (cardLike && ensureCardDetails) { ensureCardDetails(cardLike).catch(() => {}) } } catch (err) {}
    try { setHoverTooltip({ 
      visible: true, 
      x: (e as any)?.clientX || 0, 
      y: (e as any)?.clientY || 0, 
      idKey, 
      cardLike, 
      skills,
      stats: {} // No stats in this view
    }) } catch (err) {}
  }, [ensureCardDetails])

  const moveHover = React.useCallback((e: any) => {
    try { setHoverTooltip((prev: any) => ({ ...(prev || {}), x: (e as any)?.clientX || 0, y: (e as any)?.clientY || 0 })) } catch (err) {}
  }, [])

  const hideHover = React.useCallback(() => {
    try { setHoverTooltip((prev: any) => ({ ...(prev || {}), visible: false })) } catch (err) {}
  }, [])

  // Responsive scaler: scale the full page content to fit smaller windows while preserving layout.
  const fullParentRef = React.useRef<HTMLDivElement | null>(null)
  const fullChildRef = React.useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = React.useState<number>(1)
  const [scaledHeight, setScaledHeight] = React.useState<number | undefined>(undefined)
  const [currentDesignWidth, setCurrentDesignWidth] = React.useState<number>(1280)

  React.useLayoutEffect(() => {
    const parent = fullParentRef.current
    const child = fullChildRef.current
    if (!parent || !child) return

    const compute = () => {
      const availW = Math.max(320, window.innerWidth - 24) // leave small margin
      // Target a stable design width for consistent scaling
      const dw = 1280 
      setCurrentDesignWidth(dw)
      const naturalH = child.getBoundingClientRect().height || 0
      const s = Math.min(1, availW / dw)
      // Avoid extremely small scales
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

  useEffect(() => {
    if (!id) return
    let mounted = true
    const fetch = async () => {
      try {
        const res = await axios.get(`/api/kdr/${id}`)
        if (mounted) {
          setKdr(res.data)
          // If we had an error before, clear it if fetch succeeds
          setMessage(prev => prev === 'Failed to load KDR' ? null : prev)
        }
      } catch (e: any) {
        if (mounted) setMessage(e?.response?.data?.error || 'Failed to load KDR')
      }
    }
    fetch()
    
    // Initial fetch only; live updates come via Pusher/collab
    return () => { 
      mounted = false 
    }
  }, [id])

  useEffect(() => {
    if (!pickOpen || !id) return
    let mounted = true
    axios.get(`/api/kdr/${id}/available-classes`).then((r) => { if (mounted) setClasses(r.data || []) }).catch(() => {})
    return () => { mounted = false }
  }, [pickOpen, id])

  useEffect(() => {
    // Detect dark mode from both prefers-color-scheme and a potential
    // `dark` class on the document root (Tailwind/class-based dark mode).
    try {
      const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
      const getPrefers = () => !!(mq && mq.matches)
      const getByClass = () => document?.documentElement?.classList?.contains('dark') || false
      const update = () => setIsDark(getPrefers() || getByClass())

      update()

      // Listen for prefers-color-scheme changes
      if (mq && mq.addEventListener) mq.addEventListener('change', update)
      else if (mq && mq.addListener) mq.addListener(update)

      // Observe class changes on <html> so toggling a 'dark' class is detected
      const obs = new MutationObserver(() => update())
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

      return () => {
        if (mq && mq.removeEventListener) mq.removeEventListener('change', update)
        else if (mq && mq.removeListener) mq.removeListener(update)
        obs.disconnect()
      }
    } catch (e) {
      setIsDark(false)
    }
  }, [])

  const isHost = (() => {
    if (!kdr || !session?.user) return false
    // prefer createdBy.email if present
    if (kdr.createdBy && session.user.email) return kdr.createdBy.email === session.user.email
    // fallback to createdById or matching user id
    if (kdr.createdById && session.user.id) return kdr.createdById === session.user.id
    return false
  })()

  const isAdmin = !!(session?.user && session.user.role === 'ADMIN')
  const canSeeHostControls = isHost || isAdmin

  const roundOngoing = (() => {
    if (!kdr || !kdr.rounds) return false
    return (kdr.rounds || []).some((r: any) => (r.matches || []).some((m: any) => m.status !== 'COMPLETED'))
  })()
  const copyInvite = () => {
    const url = `${window.location.origin}/kdr/${id}`
    navigator.clipboard?.writeText(url)
    setMessage('Invite link copied to clipboard')
  }

  const joinKdr = async (password?: string) => {
    if (!id) return
    setLoading(true)

    try {
      await axios.post('/api/kdr/join', { kdrId: id, password })
      // Trigger a global refresh which will cause us (and everyone else) to fetch the full KDR object
      triggerGlobalRefresh()
      // Also fetch locally immediately just in case
      await fetchKdr()
      
      setMessage('Joined KDR')
      setPasswordOpen(false)
      setTypedPassword('')
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Failed to join KDR')
    } finally { 
      setLoading(false) 
    }
  }

  const handleJoinClick = () => {
    if (kdr?.hasPassword) {
      setPasswordOpen(true)
    } else {
      joinKdr()
    }
  }

  // Auto-dismiss temporary messages after 5s
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(t)
  }, [message])

  // Shared button classes for hover/active feedback
  const btnBase = 'px-3 py-2 rounded transition transform duration-150 ease-in-out hover:scale-105 active:scale-95 hover:shadow-md'
  const btnSmall = 'px-2 py-1 rounded transition transform duration-150 ease-in-out hover:scale-105 active:scale-95 hover:shadow-sm'
  const startKdr = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await axios.post(`/api/kdr/${id}/start`)
      setKdr(res.data)
      setMessage('KDR started')
      triggerGlobalRefresh()
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Failed to start')
    } finally {
      setLoading(false)
    }
  }

  const deleteKdr = async () => {
    if (!id) return
    setConfirmModal({
      open: true,
      title: 'TERMINATE KDR',
      message: 'Are you absolutely sure? This action will permanently dissolve this session. All player data, match history, and records will be lost forever.',
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          await axios.post('/api/kdr/delete', { kdrId: id })
          setMessage('KDR deleted')
          triggerGlobalRefresh()
          router.push('/kdr')
        } catch (e: any) {
          setMessage(e?.response?.data?.error || 'Failed to delete KDR')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const leaveKdr = async () => {
    if (!id) return
    
    setConfirmModal({
      open: true,
      title: 'Leave KDR',
      message: 'Are you sure you want to leave?',
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          await axios.post('/api/kdr/leave', { kdrId: id })
          setMessage('You have left the KDR')
          // Refetch for the one leaving to clear their view
          const res = await axios.get(`/api/kdr/${id}`)
          setKdr(res.data)
          triggerGlobalRefresh()
        } catch (e: any) {
          // Revert if it failed
          const refresh = await axios.get(`/api/kdr/${id}`)
          setKdr(refresh.data)
          setMessage(e?.response?.data?.error || 'Failed to leave')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const kickPlayer = async (p: any) => {
    const identifier = p.playerKey || p.id
    if (!id || !identifier) return setMessage('Missing player id')
    setLoading(true)
    try {
      await axios.post(`/api/kdr/kick`, { kdrId: id, playerKey: p.playerKey, playerId: p.id })
      setMessage(`Kicked ${p.user?.name || 'player'}`)
      const res = await axios.get(`/api/kdr/${id}`)
      setKdr(res.data)
      triggerGlobalRefresh()
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Failed to kick')
    } finally {
      setLoading(false)
    }
  }

  const visiblePlayers = (kdr?.players || []).filter((p: any) => p?.status === 'ACTIVE')

  const hasClaimedStartingLoot = !!(currentPlayer?.startingLootClaimed || (currentPlayer?.shopState as any)?.startingLoot);

  const openLootModal = async () => {
    if (!id) return
    setLoading(true)
    try {
      const lootRes = await axios.get(`/api/kdr/player/starting-loot-options?kdrId=${id}`)
      setLootOptions(lootRes.data)
      setLootOpen(true)
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Failed to fetch loot options')
    } finally { setLoading(false) }
  }

  // If we haven't fetched yet and there's no error message, show loader
  if (!kdr && !message) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className={`p-8 rounded-lg ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 shadow-lg'}`}>
          <div className="flex items-center gap-3">
             <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
             <div className="font-semibold">Loading KDR details...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="p-6 min-h-screen w-full overflow-x-hidden bg-gray-100 dark:bg-[#080c14] text-gray-900 dark:text-gray-100"
      ref={fullParentRef}
      style={{
        height: scaledHeight ? `${scaledHeight}px` : undefined,
        overflow: 'hidden'
      }}
    >
      <div className="w-full" ref={fullChildRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: scale < 1 ? `${currentDesignWidth}px` : '100%', display: 'block', margin: '0 auto' }}>
        <div className="container mx-auto p-4 max-w-6xl">
          
          {/* Header Section */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 dark:border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${kdr?.status === 'OPEN' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {kdr?.status || 'UNKNOWN'}
                </div>
                {kdr?.slug && (
                  <div className="text-[10px] text-gray-500 font-mono select-all bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">
                    ID: {kdr.slug}
                  </div>
                )}
              </div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-indigo-600 dark:text-indigo-400 leading-none">
                {kdr?.name || id}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className={`${btnBase} bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold flex items-center gap-2`} onClick={() => setSettingsOpen(true)}>
                <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Settings
              </button>
              <button className={`${btnBase} bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold flex items-center gap-2`} onClick={copyInvite}>
                <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                Invite
              </button>
              <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-1 hidden sm:block" />
              {!amIJoined && (kdr?.status === 'OPEN' || (canSeeHostControls && kdr?.status === 'STARTED')) && (kdr?.playerCount == null || visiblePlayers.length < Number(kdr?.playerCount)) && (
                <button className={`${btnBase} bg-indigo-600 text-white font-bold px-6 shadow-lg shadow-indigo-600/20`} onClick={handleJoinClick} disabled={loading}>Join KDR</button>
              )}
              {amIJoined && (
                <button className={`${btnBase} bg-red-600/10 text-red-600 border border-red-600/20 text-sm font-bold`} onClick={leaveKdr} disabled={loading}>Leave KDR</button>
              )}
            </div>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-xl border flex justify-between items-center animate-in slide-in-from-top-2 duration-300 ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                {message}
              </div>
              <button onClick={() => setMessage(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          {kdr && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Stats & Participants */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Stats Summary */}
                <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#0f1724] border-white/5 shadow-2xl' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 tracking-widest">Format</div>
                      <div className="text-lg font-bold truncate leading-tight">{kdr.format?.name || 'Standard'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 tracking-widest">Joined</div>
                      <div className="text-lg font-bold leading-tight">{visiblePlayers.length} / {kdr.playerCount || '∞'}</div>
                    </div>
                  </div>
                </div>

                {/* Participants Card */}
                <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f1724] border-white/5 shadow-2xl' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'bg-white/2 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                      <span className="font-black uppercase tracking-widest text-[10px] opacity-70">Participants ({visiblePlayers.length}/8)</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    {Array.from({ length: 8 }).map((_, idx) => {
                      const p = visiblePlayers[idx]
                      if (!p) {
                        return (
                          <div key={`empty-${idx}`} className={`flex items-center gap-3 p-2 rounded-xl border border-dashed ${isDark ? 'border-white/5 bg-white/2' : 'border-gray-200 bg-gray-50'} opacity-30`}>
                            <div className="w-10 h-10 rounded-lg bg-gray-300 dark:bg-gray-800" />
                            <div className="text-[10px] font-black uppercase tracking-widest italic">Slot {idx + 1} Empty</div>
                          </div>
                        )
                      }
                      const displayName = p?.user?.name || p?.user?.email || p.displayName || 'Anon Player'
                      const avatarUrl = p?.user?.image || null
                      const isMe = p.user?.id === session?.user?.id || p.user?.email === session?.user?.email || (currentPlayer && p.id === currentPlayer.id)

                      // Logic for participant background colors based on progress
                      let statusBg = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                      let statusIcon = null
                      
                      const currentRound = (kdr?.rounds || []).filter((r: any) => r.isCurrent)[0] || (kdr?.rounds || []).sort((a: any, b: any) => (b.number || 0) - (a.number || 0))[0]
                      const hasStarted = kdr?.status === 'STARTED'
                      const isPreFirstRound = hasStarted && (!kdr?.rounds || kdr.rounds.length === 0)
                      
                      if (hasStarted && !isPreFirstRound && currentRound) {
                        const myMatch = (currentRound.matches || []).find((m: any) => m.playerAId === p.id || m.playerBId === p.id)
                        const hasReported = myMatch?.status === 'COMPLETED'
                        const isShopDone = !!p.shopComplete
                        
                        if (hasReported && isShopDone) {
                          statusBg = isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'
                          statusIcon = <div className="w-2 h-2 rounded-full bg-emerald-500" title="Ready" />
                        } else if (hasReported) {
                          statusBg = isDark ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'
                          statusIcon = <div className="w-2 h-2 rounded-full bg-orange-500" title="Shop Pending" />
                        } else {
                          statusBg = isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'
                          statusIcon = <div className="w-2 h-2 rounded-full bg-red-500" title="Match & Shop Pending" />
                        }
                      } else if (!hasStarted || isPreFirstRound) {
                        const hasPickedClass = !!p.classId
                        const hasPickedLoot = !!(p.startingLootClaimed || (p.shopState as any)?.startingLoot)

                        if (hasPickedClass && hasPickedLoot) {
                          statusBg = isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'
                          statusIcon = <div className="w-2 h-2 rounded-full bg-emerald-500" title="Ready" />
                        } else if (hasPickedClass) {
                          statusBg = isDark ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'
                          statusIcon = <div className="w-2 h-2 rounded-full bg-orange-500" title="Loot Pending" />
                        } else {
                          statusBg = isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'
                          statusIcon = <div className="w-2 h-2 rounded-full bg-red-500" title="Class Pending" />
                        }
                      }

                        return (
                          <div
                            key={p.id}
                            onClick={() => p.playerKey && router.push(`/kdr/${id}/class?playerKey=${p.playerKey}`)}
                            className={`flex items-center justify-between p-2 rounded-xl transition-all duration-200 cursor-pointer ${isMe && !hasStarted ? (isDark ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200') : statusBg}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="relative shrink-0 w-10 h-10">
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={displayName} className="w-full h-full rounded-lg object-cover shadow-sm" />
                                ) : (
                                  <div className={`w-full h-full rounded-lg flex items-center justify-center text-sm font-black ${isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                                    {displayName[0]}
                                  </div>
                                )}
                                {isMe && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white dark:border-[#0f1724] rounded-full z-20" />}
                                {!isMe && (userIds.includes(p.id) || lobbyUserIds.includes(p.id) || lobbyUserIds.includes(p.user?.email) || lobbyUserIds.includes(p.user?.id)) && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0f1724] rounded-full z-20 animate-pulse" title="Online" />}
                              </div>
                              <div className="truncate font-bold text-sm tracking-tight flex-1">{displayName}</div>
                            </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                             {statusIcon}
                             {canSeeHostControls && !isMe && (
                               <button onClick={(e) => { e.stopPropagation(); kickPlayer(p); }} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                               </button>
                             )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Host Controls */}
                {canSeeHostControls && (
                  <div className={`p-6 rounded-2xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                    <h3 className="text-[10px] font-black uppercase text-indigo-500 mb-4 tracking-widest flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                       Host Control
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {kdr?.status === 'OPEN' && (
                        <button className={`${btnBase} bg-green-600 text-white font-black text-sm uppercase py-3`} onClick={startKdr} disabled={loading}>Begin Tournament</button>
                      )}
                      {kdr?.status === 'STARTED' && (
                        <button
                          className={`${btnBase} ${loading || roundOngoing ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-emerald-600'} text-white font-black text-sm uppercase py-3`}
                          onClick={async () => {
                            if (!id || loading || roundOngoing) return

                            // Safety check: verify all players have finished shop
                            const pendingShop = visiblePlayers.filter((p: any) => !p.shopComplete)
                            if (pendingShop.length > 0) {
                              const isRoundZero = (kdr?.rounds?.length || 0) === 0;
                              setConfirmModal({
                                open: true,
                                title: isRoundZero ? 'Players Still Picking Class' : 'Players Still Shopping',
                                message: isRoundZero 
                                  ? `The following participants have not yet picked their class. This will force them to start with a random class.`
                                  : `The following participants have not finished shopping. This will end their shopping phase immediately.`,
                                players: pendingShop,
                                onConfirm: async () => {
                                  setConfirmModal(null)
                                  setLoading(true)
                                  try {
                                    const res = await axios.post(`/api/kdr/generate`, { kdrId: id })
                                    setKdr(res.data)
                                    setMessage('Round generated')
                                    triggerGlobalRefresh()
                                  } catch (e: any) {
                                    setMessage(e?.response?.data?.error || 'Failed to generate round')
                                  } finally { setLoading(false) }
                                }
                              })
                              return
                            }

                            setLoading(true)
                            try {
                              const res = await axios.post(`/api/kdr/generate`, { kdrId: id })
                              setKdr(res.data)
                              setMessage('Round generated')
                              triggerGlobalRefresh()
                            } catch (e: any) {
                              setMessage(e?.response?.data?.error || 'Failed to generate round')
                            } finally { setLoading(false) }
                          }}
                          disabled={loading || roundOngoing}
                        >
                          Next Round
                        </button>
                      )}
                      {kdr?.status === 'OPEN' && (
                        <button className={`${btnBase} bg-white dark:bg-white/5 border border-indigo-500/20 text-indigo-500 text-xs font-black uppercase`} onClick={async () => {
                          if (!id) return
                          setLoading(true)
                          try {
                            await axios.post('/api/kdr/fill-dummy', { kdrId: id })
                            const res = await axios.get(`/api/kdr/${id}`)
                            setKdr(res.data)
                            triggerGlobalRefresh()
                            setMessage('Success: Dummy slots filled.')
                          } catch (e: any) { setMessage(e?.response?.data?.error || 'Failed to fill dummy') }
                          finally { setLoading(false) }
                        }}>Fill Empty Slots</button>
                      )}
                      <div className="pt-2">
                        <button className="text-[10px] font-black uppercase text-red-500 hover:underline opacity-50 hover:opacity-100 transition-all w-full text-center" onClick={deleteKdr} disabled={loading}>Terminate KDR</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Active Phase & Matchups */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Attention Grabber for Loot/Class Selection */}
                {amIJoined && (
                  <>
                    {!currentPlayer?.classId && kdr?.status !== 'OPEN' && (
                      <div className="p-1 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 animate-pulse-slow">
                        <div className={`p-6 rounded-[14px] flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-[#080c14]' : 'bg-white'}`}>
                          <div>
                            <div className="text-orange-500 text-2xl font-black uppercase tracking-widest mb-1 italic">Required Action</div>
                            <div className="text-sm opacity-50 font-bold uppercase tracking-widest">You have not yet claimed your Class.</div>
                          </div>
                          <button className="px-8 py-3 bg-white dark:bg-white/5 text-orange-500 dark:text-orange-400 border-2 border-orange-500 rounded-xl font-black italic shadow-xl shadow-orange-500/20 active:scale-95 transition-all text-lg" onClick={() => setPickOpen(true)}>PICK CLASS</button>
                        </div>
                      </div>
                    )}

                    {currentPlayer?.classId && !hasClaimedStartingLoot && (
                      <div className="p-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 animate-pulse-slow">
                        <div className={`p-6 rounded-[14px] flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-[#080c14]' : 'bg-white'}`}>
                          <div>
                            <div className="text-emerald-500 text-2xl font-black uppercase tracking-widest mb-1 italic">Loot Awaiting</div>
                            <div className="text-sm opacity-50 font-bold uppercase tracking-widest">Your starting skills and packs are ready.</div>
                          </div>
                          <button className="px-8 py-3 bg-white dark:bg-white/5 text-emerald-500 dark:text-emerald-400 border-2 border-emerald-500 rounded-xl font-black italic shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-lg" onClick={openLootModal}>CLAIM LOOT</button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Matchups / Rounds View */}
                {kdr && kdr.rounds && kdr.rounds.length > 0 ? (() => {
                  const rounds = kdr.rounds || []
                  let current = rounds.find((r: any) => (r.matches || []).some((m: any) => m.status !== 'COMPLETED')) || rounds[rounds.length - 1]
                  if (!current) return null
                  const matches = current.matches || []
                  const mePlayer = (kdr.players || []).find((p: any) => p.user?.id === session?.user?.id || p.user?.email === session?.user?.email) || null
                  const meId = mePlayer?.id || null

                  const myMatch = matches.find((m: any) => m.playerAId === meId || m.playerBId === meId)
                  const isMyMatchCompleted = myMatch && myMatch.status === 'COMPLETED'
                  
                    const latestRoundNumber = rounds[rounds.length - 1]?.number || 0;
                    const lastShopRound = Number((currentPlayer as any)?.lastShopRound || 0);
                    const isShopLocked = !!currentPlayer?.shopComplete && latestRoundNumber <= lastShopRound;

                    return (
                      <div className="space-y-6">
                        {isMyMatchCompleted && !isShopLocked && (
                          <div className="p-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse-slow">
                            <div className={`p-6 rounded-[14px] flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-[#080c14]' : 'bg-white'}`}>
                              <div>
                                <div className="text-indigo-500 text-2xl font-black uppercase tracking-widest mb-1 italic">Match Concluded</div>
                                <div className="text-sm opacity-50 font-bold uppercase tracking-widest">You have completed your matches for this round.</div>
                              </div>
                              <button 
                                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black italic shadow-xl shadow-indigo-500/20 active:scale-95 transition-all text-lg"
                                onClick={() => router.push(`/kdr/${id}/shop-v2?playerKey=${currentPlayer?.playerKey}`)}
                              >
                                ENTER SHOP
                              </button>
                            </div>
                          </div>
                        )}

                      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f1724] border-white/5 shadow-2xl' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'bg-white/2 border-white/5' : 'bg-gray-50 border-gray-100 shadow-inner'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black italic shadow-lg shadow-indigo-600/30 transform -rotate-1 skew-x-[-10deg]">
                              {current.number}
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase text-indigo-500 tracking-widest leading-none mb-1">Current Active Phase</div>
                              <h2 className="text-2xl font-black uppercase tracking-tighter italic leading-none">Round {current.number}</h2>
                            </div>
                          </div>
                          <div className="hidden sm:block text-right">
                            <div className="text-[10px] font-black uppercase opacity-40 tracking-widest">Match Progress</div>
                            <div className="font-mono text-sm font-bold">{matches.filter((m: any) => m.status === 'COMPLETED').length} / {matches.length} Done</div>
                          </div>
                        </div>

                        <div className="p-4 space-y-4">
                          {matches.length === 0 && <div className="py-20 text-center opacity-30 italic text-sm">No encounters charted for this phase.</div>}
                          {matches.map((m: any) => {
                            const pA = (kdr.players || []).find((pp: any) => pp.id === (m.playerA?.id || m.playerAId)) || m.playerA || null
                            const pB = (kdr.players || []).find((pp: any) => pp.id === (m.playerB?.id || m.playerBId)) || m.playerB || null
                            const isMe = (meId === pA?.id || meId === pB?.id)
                            const isWinnerA = m.status === 'COMPLETED' && m.scoreA > m.scoreB
                            const isWinnerB = m.status === 'COMPLETED' && m.scoreB > m.scoreA

                            return (
                              <div 
                                key={m.id} 
                                onClick={() => {
                                  if ((isMe || canSeeHostControls) && pB && m.status !== 'COMPLETED') {
                                    setSelectedMatchForReport({ ...m, pA, pB });
                                    setReportOpen(true);
                                  }
                                }}
                                className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${(isMe || canSeeHostControls) && pB && m.status !== 'COMPLETED' ? 'cursor-pointer active:scale-[0.98]' : ''} ${isMe ? (isDark ? 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_30px_rgba(79,70,229,0.1)]' : 'bg-indigo-50 border-indigo-200 shadow-lg') : (isDark ? 'bg-white/2 border-white/5 hover:bg-white/5' : 'bg-white border-gray-100 hover:shadow-xl')}`}
                              >
                                {isMe && <div className="absolute top-0 right-0 px-4 py-1.5 bg-indigo-600 text-[10px] font-black text-white uppercase tracking-widest rounded-bl-xl shadow-lg">Your Match</div>}
                                
                                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                  
                                  <div className="flex items-center gap-6 flex-1 w-full md:w-auto">
                                    {/* Player A Info */}
                                    <div className="flex flex-col items-center gap-3 w-28 sm:w-32 text-center cursor-pointer group/pa" onClick={(e) => { e.stopPropagation(); pA?.playerKey && router.push(`/kdr/${id}/class?playerKey=${pA.playerKey}`); }}>
                                      <div className="relative">
                                        {pA?.user?.image ? (
                                          <img src={pA.user.image} alt="A" className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[2rem] object-cover shadow-2xl transition-all duration-500 group-hover/pa:scale-110 group-hover/pa:rotate-2 ${isWinnerA ? 'ring-4 ring-yellow-400 shadow-yellow-400/20' : 'ring-2 ring-white/10'}`} />
                                        ) : (
                                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2rem] bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-black text-2xl shadow-inner border-2 border-white/5">A</div>
                                        )}
                                        {isWinnerA && <div className="absolute -top-4 -right-4 text-3xl drop-shadow-2xl animate-bounce-slow">👑</div>}
                                      </div>
<div className={`text-xs font-black truncate w-full uppercase tracking-widest ${isWinnerA ? 'text-yellow-500' : 'opacity-60 group-hover/pa:opacity-100 transition-opacity'}`}>{pA?.name || pA?.user?.name || 'Player A'}</div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center flex-1 py-4">
                                      <div className="text-[10px] font-black uppercase opacity-20 mb-3 tracking-[0.2em]">Versus</div>
                                      <div className={`text-4xl sm:text-6xl font-black italic tracking-tighter tabular-nums leading-none ${m.status === 'COMPLETED' ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'text-gray-200 dark:text-white/5'}`}>
                                        {m.scoreA} <span className="mx-1 opacity-20">:</span> {m.scoreB}
                                      </div>
                                      <div className={`mt-4 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border transition-all ${m.status === 'COMPLETED' ? 'bg-green-500/10 border-green-500/20 text-green-500' : m.status === 'DISPUTED' ? 'bg-red-500 border-red-400 text-white animate-pulse shadow-lg shadow-red-500/40' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                                        {m.status}
                                      </div>
                                      {(isMe || canSeeHostControls) && pB && m.status !== 'COMPLETED' && (
                                        <div className="mt-4 text-[10px] font-black text-indigo-500 uppercase animate-pulse">Click to Report</div>
                                      )}
                                    </div>

                                    {/* Player B Info */}
                                    <div className="flex flex-col items-center gap-3 w-28 sm:w-32 text-center cursor-pointer group/pb" onClick={(e) => { e.stopPropagation(); pB?.playerKey && router.push(`/kdr/${id}/class?playerKey=${pB.playerKey}`); }}>
                                      <div className="relative">
                                        {pB ? (
                                          <>
                                            {pB.user?.image ? (
                                              <img src={pB.user.image} alt="B" className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[2rem] object-cover shadow-2xl transition-all duration-500 group-hover/pb:scale-110 group-hover/pb:rotate-[-2deg] ${isWinnerB ? 'ring-4 ring-yellow-400 shadow-yellow-400/20' : 'ring-2 ring-white/10'}`} />
                                            ) : (
                                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2rem] bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-black text-2xl shadow-inner border-2 border-white/5">B</div>
                                            )}
                                            {isWinnerB && <div className="absolute -top-4 -right-4 text-3xl drop-shadow-2xl animate-bounce-slow">👑</div>}
                                          </>
                                        ) : (
                                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2rem] border-2 border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center opacity-20 overflow-hidden">
                                            <span className="text-xs font-black uppercase tracking-widest rotate-[-45deg] scale-150">BYE</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className={`text-xs font-black truncate w-full uppercase tracking-widest ${isWinnerB ? 'text-yellow-500' : 'opacity-60 group-hover/pb:opacity-100 transition-opacity'}`}>{pB?.name || pB?.user?.name || (pB ? 'Player B' : 'OPEN SLOT')}</div>
                                    </div>
                                  </div>

                                  {canSeeHostControls && pB && (m.status === 'COMPLETED' || m.status === 'DISPUTED') && (
                                    <button onClick={async (e) => {
                                      e.stopPropagation();
                                      setLoading(true)
                                      try {
                                        await axios.post('/api/kdr/match/reopen', { matchId: m.id })
                                        const res = await axios.get(`/api/kdr/${id}`)
                                        setKdr(res.data)
                                        triggerGlobalRefresh()
                                        setMessage('Match Reopened')
                                      } catch (err: any) { setMessage('Failed') }
                                      finally { setLoading(false) }
                                    }} className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-400 bg-indigo-500/5 px-3 py-2 rounded-lg border border-indigo-500/10 transition-all">Unlock Edit</button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })() : (
                  <div className={`p-20 rounded-2xl border flex flex-col items-center justify-center text-center ${isDark ? 'bg-[#0f1724] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter opacity-70 mb-2">Tournament Pending</h3>
                    <p className="max-w-xs text-sm opacity-40 leading-relaxed font-medium">As soon as the host initiates the tournament, the first phase and matchups will manifest here.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {passwordOpen && (

        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPasswordOpen(false)} />
          <div className={`relative z-10 ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded p-4 w-full max-w-sm`}>
            <h3 className="font-semibold mb-3">Join Password Required</h3>
            <input
              type="password"
              className={`w-full p-2 rounded border mb-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
              placeholder="Enter password..."
              value={typedPassword}
              onChange={(e) => setTypedPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') joinKdr(typedPassword)
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={() => setPasswordOpen(false)}>Cancel</button>
              <button
                className={`px-3 py-1 rounded ${isDark ? 'bg-indigo-600' : 'bg-indigo-600'} text-white`}
                onClick={() => joinKdr(typedPassword)}
                disabled={loading}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      {pickOpen && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setPickOpen(false)} />
          <div className={`relative z-10 ${isDark ? 'bg-[#0b1220] border-white/10' : 'bg-white border-gray-200'} rounded-3xl shadow-2xl border p-6 w-full max-w-2xl transform transition-all overflow-hidden flex flex-col max-h-[85vh] min-h-0`}> 
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-4xl font-black italic uppercase tracking-tighter text-indigo-500">Select your Class</h3>
                <p className="text-sm opacity-50 font-medium uppercase tracking-widest">Select one of the available classes to begin your journey.</p>
              </div>
              <button className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/10" onClick={() => setPickOpen(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 min-h-0 pr-3">
              <div className="max-h-[56vh] overflow-y-auto custom-scrollbar pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 text-sm">
                  {classes.length === 0 && (
                <div className="col-span-full py-20 text-center">
                   <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                   <div className="text-lg font-bold opacity-30 uppercase tracking-tighter italic">Loading available identities...</div>
                </div>
                  )}
                  {classes.map((c: any) => {
                const imgSource = c.image 
                ? (c.image.includes('/') ? c.image : `${CLASS_IMAGE_BASE_URL}/${c.image}`)
                : getClassImageUrl(c.name)
                
                return (
                  <div key={c.id} className={`group relative p-4 rounded-2xl border-2 transition-all duration-500 flex flex-col justify-between items-center text-center overflow-hidden h-full ${isDark ? 'border-white/5 bg-white/2 hover:border-indigo-500/50 hover:bg-indigo-500/5' : 'border-gray-100 bg-gray-50 hover:border-indigo-500/50 hover:bg-white hover:shadow-2xl'}`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="w-36 h-36 mb-4 relative transition-all duration-400 transform group-hover:scale-105 group-hover:rotate-1">
                      <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <img 
                        src={imgSource} 
                        alt={c.name} 
                        className="w-full h-full object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.3)] relative z-10"
                        onError={(e: any) => {
                          e.target.style.display = 'none'
                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                      <div className="hidden absolute inset-0 rounded-xl bg-gray-200 dark:bg-gray-800 items-center justify-center">
                        <span className="text-4xl font-bold opacity-30">{c.name?.[0]}</span>
                      </div>
                    </div>

                    <div className="mb-2 flex-1 min-h-0 flex flex-col justify-start">
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1 group-hover:text-indigo-400 transition-colors leading-none">{c.name}</h4>
                      <div className="h-0.5 w-12 bg-indigo-500/30 mx-auto rounded-full mb-2 group-hover:w-20 transition-all duration-500" />
                      <p className="text-xs opacity-40 font-medium leading-relaxed max-w-[200px] mx-auto line-clamp-3 mb-2">
                        {c.description || 'No description available for this class.'}
                      </p>
                    </div>

                    <button 
                      disabled={loading}
                      className={`w-full py-2 rounded-lg font-black uppercase italic tracking-widest text-sm transition-all duration-200 relative overflow-hidden active:scale-95 ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/16' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20'}`}
                      onClick={async (e) => { 
                        e.stopPropagation(); 
                        setLoading(true);
                        try {
                          const pickRes = await axios.post('/api/kdr/player/pick-class', { kdrId: id, newClassId: c.id })
                          const res = await axios.get(`/api/kdr/${id}`)
                          setKdr(res.data)
                          triggerGlobalRefresh()
                          setMessage(`Class selected! Now choose your Starting Loot.`)
                          setPickOpen(false)
                          
                          // Fetch loot options
                          setLoading(true)
                          const lootRes = await axios.get(`/api/kdr/player/starting-loot-options?kdrId=${id}`)
                          setLootOptions(lootRes.data)
                          setLootOpen(true)
                          
                          // Get playerKey for later redirection
                          const pk = pickRes.data?.player?.playerKey || res.data?.currentPlayer?.playerKey || ''
                          // Force kdr update with current player info
                          if (pk) setKdr((prev: any) => ({ ...prev, currentPlayer: { ...prev.currentPlayer, playerKey: pk } }))
                        } catch (e: any) {
                          setMessage(e?.response?.data?.error || 'Failed to pick class')
                        } finally { setLoading(false) }
                      }}
                    >
                      {loading ? 'Processing...' : 'CHOOSE'}
                    </button>
                  </div>
                )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {kdr && (
        <TournamentSettingsModal 
          isOpen={settingsOpen} 
          onClose={() => setSettingsOpen(false)} 
          settings={kdr.settingsSnapshot}
          fallbackSettings={kdr.format?.settings}
          formatName={kdr.format?.name}
        />
      )}

      {lootOpen && lootOptions && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
          <div className={`relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[2.5rem] p-8 md:p-12 border border-white/10 ${isDark ? 'bg-[#080c14] shadow-[0_0_100px_rgba(79,70,229,0.2)]' : 'bg-white shadow-2xl'}`}>
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-5xl font-black italic uppercase tracking-tighter text-indigo-500 mb-2 drop-shadow-sm">Starting Loot</h2>
                <p className="text-sm opacity-50 font-black uppercase tracking-[0.3em] italic">Choose 1 Skill and 1 Starter Pack to Begin</p>
              </div>
              <button 
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-white" 
                onClick={() => setLootOpen(false)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Skills Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-indigo-500/30" />
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-indigo-400">Generic Skills (Choose 1)</h3>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-indigo-500/30" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {lootOptions.skills.map((s: any) => (
                    <div 
                      key={s.id} 
                      onClick={() => {
                        setSelectedSkillId(s.id);
                        setSelectedSkillItemId(s.itemId);
                      }}
                      className={`group p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer relative overflow-hidden ${selectedSkillId === s.id ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(79,70,229,0.2)] ring-4 ring-indigo-500/20' : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-500 text-white uppercase tracking-widest">
                              {s.rarity || 'TREASURE'}
                            </span>
                          </div>
                          <h4 className={`text-xl font-black uppercase italic tracking-tighter transition-colors ${selectedSkillId === s.id ? 'text-indigo-400' : 'text-white'}`}>{s.name}</h4>
                        </div>
                        {selectedSkillId === s.id && <div className="text-indigo-500 animate-bounce">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        </div>}
                      </div>
                      <div className="text-sm opacity-60 leading-relaxed font-medium">
                        <RichTextRenderer content={s.description} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Packs Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-500/30" />
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-emerald-400">Starter Packs (Choose 1)</h3>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-500/30" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {lootOptions.packs.map((p: any) => (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedPackId(p.id)}
                      className={`group p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer relative overflow-hidden ${selectedPackId === p.id ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-4 ring-emerald-500/20' : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className={`text-xl font-black uppercase italic tracking-tighter transition-colors ${selectedPackId === p.id ? 'text-emerald-400' : 'text-white'}`}>{p.name}</h4>
                        {selectedPackId === p.id && <div className="text-emerald-500 animate-bounce">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        </div>}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {p.items?.map((item: any, idx: number) => {
                          const card = item.card || item.skill
                          const art = card ? selectArtworkUrl(card, null, { useLootArt: true }) : null
                          if (!art) return null
                          return (
                            <div 
                              key={idx} 
                              className="relative group/item inline-flex flex-col items-center"
                              onMouseEnter={(e) => showHover(e, card)}
                              onMouseMove={moveHover}
                              onMouseLeave={hideHover}
                            >
                              <div className="relative h-24 w-auto group-hover/item:scale-105 transition-transform duration-300">
                                <img 
                                  src={art} 
                                  alt="" 
                                  className="h-full w-auto block rounded shadow-lg border border-white/10 group-hover/item:border-emerald-500/50 group-hover/item:ring-2 group-hover/item:ring-emerald-500/40" 
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 flex justify-center">
              <button 
                disabled={!selectedSkillId || !selectedPackId || loading}
                className={`px-12 py-4 rounded-2xl font-black uppercase italic tracking-widest text-xl transition-all duration-300 shadow-2xl active:scale-95 ${(!selectedSkillId || !selectedPackId || loading) ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/30'}`}
                onClick={async () => {
                  setLoading(true)
                  try {
                    await axios.post('/api/kdr/player/claim-starting-loot', {
                      kdrId: id,
                      skillId: selectedSkillId,
                      itemId: selectedSkillItemId,
                      packId: selectedPackId
                    })
                    setLootOpen(false)
                    // Refresh KDR/player state so updated shopState (purchases/seen) is available client-side
                    try {
                      const res = await axios.get(`/api/kdr/${id}`)
                      setKdr(res.data)
                      triggerGlobalRefresh()
                    } catch (err) {
                      // ignore - we'll still redirect
                    }
                    // Redirect after claim
                    const pk = kdr?.currentPlayer?.playerKey || ''
                    router.push(`/kdr/${id}/class` + (pk ? `?playerKey=${pk}` : ''))
                  } catch (e: any) {
                    setMessage(e?.response?.data?.error || 'Failed to claim loot')
                  } finally { setLoading(false) }
                }}
              >
                {loading ? 'Manifesting Loot...' : 'CLAIM REWARDS'}
              </button>
            </div>
          </div>
          <HoverTooltip hoverTooltip={hoverTooltip} cardDetailsCacheRef={cardDetailsCacheRef} tooltipScrollRef={tooltipScrollRef} />
        </div>
      )}

      {reportOpen && selectedMatchForReport && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" />
          <div className={`relative z-10 w-full max-w-4xl rounded-[2.5rem] p-10 border border-white/20 ${isDark ? 'bg-[#0a0f1a] shadow-[0_0_100px_rgba(79,70,229,0.3)]' : 'bg-white shadow-2xl'}`}>
            
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-5xl font-black italic uppercase tracking-tighter text-indigo-500 mb-2">Report Match</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black uppercase tracking-[0.3em] text-white/40">Match ID: {selectedMatchForReport.id}</span>
                  <div className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">Round {selectedMatchForReport.round}</span>
                </div>
              </div>
              <button 
                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-white group" 
                onClick={() => setReportOpen(false)}
              >
                <svg className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              {/* Player A */}
              <div className={`p-8 rounded-3xl border-2 transition-all duration-500 ${selectedMatchForReport.scoreA > selectedMatchForReport.scoreB ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/5'}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl">
                    {selectedMatchForReport.pA?.user?.image ? (
                      <img src={selectedMatchForReport.pA.user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl font-black uppercase text-gray-500">
                        {selectedMatchForReport.pA?.user?.name?.[0] || 'A'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white truncate">{selectedMatchForReport.pA?.name || selectedMatchForReport.pA?.user?.name || 'Player 1'}</h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">{selectedMatchForReport.pA?.playerClass?.name || 'Class Pending'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/80 mb-1">Games Won</label>
                  <div className="flex gap-3">
                    {[0, 1, 2].map(val => (
                      <button
                        key={val}
                        onClick={() => setSelectedMatchForReport({...selectedMatchForReport, scoreA: val})}
                        className={`flex-1 py-4 rounded-xl font-black text-2xl transition-all duration-300 ${selectedMatchForReport.scoreA === val ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Player B */}
              <div className={`p-8 rounded-3xl border-2 transition-all duration-500 ${selectedMatchForReport.scoreB > selectedMatchForReport.scoreA ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/5'}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl">
                    {selectedMatchForReport.pB?.user?.image ? (
                      <img src={selectedMatchForReport.pB.user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl font-black uppercase text-gray-500">
                        {selectedMatchForReport.pB?.user?.name?.[0] || 'B'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white truncate">{selectedMatchForReport.pB?.name || selectedMatchForReport.pB?.user?.name || 'Player 2'}</h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">{selectedMatchForReport.pB?.playerClass?.name || 'Class Pending'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/80 mb-1">Games Won</label>
                  <div className="flex gap-3">
                    {[0, 1, 2].map(val => (
                      <button
                        key={val}
                        onClick={() => setSelectedMatchForReport({...selectedMatchForReport, scoreB: val})}
                        className={`flex-1 py-4 rounded-xl font-black text-2xl transition-all duration-300 ${selectedMatchForReport.scoreB === val ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="relative group">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-3 ml-2">DuelingBook Replay URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  </div>
                  <input
                    type="text"
                    placeholder="https://www.duelingbook.com/replay?id=..."
                    className="w-full bg-white/5 border-2 border-white/5 focus:border-indigo-500/50 focus:bg-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-medium transition-all outline-none placeholder:text-white/10"
                    value={selectedMatchForReport.replayUrl || ''}
                    onChange={(e) => setSelectedMatchForReport({...selectedMatchForReport, replayUrl: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  disabled={loading}
                  onClick={() => setReportOpen(false)}
                  className="flex-1 py-5 rounded-2xl font-black uppercase italic tracking-widest text-white/40 bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  disabled={loading}
                  onClick={async () => {
                    const replayUrl = selectedMatchForReport.replayUrl || ''
                    if (!replayUrl.startsWith('https://www.duelingbook.com/replay?id=')) {
                      alert('Please enter a valid DuelingBook replay link starting with https://www.duelingbook.com/replay?id=')
                      return
                    }

                    setLoading(true);
                    try {
                      const res = await axios.post('/api/kdr/match/report', {
                        matchId: selectedMatchForReport.id,
                        scoreA: selectedMatchForReport.scoreA,
                        scoreB: selectedMatchForReport.scoreB,
                        replayUrl: selectedMatchForReport.replayUrl
                      });
                      setKdr(res.data);
                      setReportOpen(false);
                      triggerGlobalRefresh();
                      triggerMatchUpdate();
                    } catch (e: any) {
                      alert(e?.response?.data?.error || 'Failed to report score');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="flex-[2] py-5 rounded-2xl font-black uppercase italic tracking-widest text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'Transmitting Data...' : 'Submit Final Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setConfirmModal(null)} />
          <div className={`relative z-10 w-full max-w-lg rounded-[2.5rem] p-10 border border-white/20 ${isDark ? 'bg-[#0a0f1a] shadow-[0_0_100px_rgba(239,68,68,0.2)]' : 'bg-white shadow-2xl'}`}>
            <div className="w-20 h-20 rounded-3xl bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center mb-8 mx-auto">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-2 text-center">{confirmModal.title}</h2>
            <p className="text-sm opacity-50 font-medium leading-relaxed text-center mb-8">{confirmModal.message}</p>
            
            {confirmModal.players && confirmModal.players.length > 0 && (
              <div className="space-y-2 mb-10 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {confirmModal.players.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      {p.user?.image ? (
                        <img src={p.user.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs font-black uppercase text-gray-500">
                          {p.user?.name?.[0] || 'P'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-black uppercase italic tracking-tighter truncate">{p.name || p.user?.name || 'Unknown'}</div>
                      <div className="text-[10px] text-red-400 font-bold uppercase tracking-widest">{p.playerClass?.name || 'Inventory Pending'}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-4">
              <button 
                className="flex-1 py-4 rounded-xl font-black uppercase italic tracking-widest text-white/40 bg-white/5 hover:bg-white/10 transition-all border border-white/5" 
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button 
                className={`flex-1 py-4 rounded-xl font-black uppercase italic tracking-widest text-white transition-all shadow-xl ${confirmModal.players ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'}`} 
                onClick={confirmModal.onConfirm}
              >
                PROCEED
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
