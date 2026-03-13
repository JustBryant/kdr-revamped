import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import ClassImage from '../../../components/common/ClassImage'
import CardImage from '../../../components/common/CardImage'
import HoverTooltip from '../../../components/shop-v2/components/HoverTooltip'
import DeckBuilderOverlay from '../../../components/DeckBuilderOverlay'
import { ShatterfoilOverlay } from '../../../components/ShatterfoilOverlay'
import { UltraRareGlow } from '../../../components/UltraRareGlow'
import { SuperRareGlow } from '../../../components/SuperRareGlow'
import { computeLevel } from '../../../lib/shopHelpers'
import StatBox from '../../../components/common/StatBox'
import Icon from '../../../components/Icon'

// Small canonical preview used for cards/treasures/legendary items
// Helpers for hover ring: compute a stable key for a card-like item and map
// a detected type/frame to the requested palette hex.
const getCardKey = (it: any) => it?.id || it?.konamiId || (it?.name || it?.title || '').toString()

const getFrameHex = (it: any) => {
  const t = ((it?.type || it?.frame || it?.cardType || '') + '').toLowerCase()
  if (t.includes('spell')) return '#1D9E74'
  if (t.includes('trap')) return '#BC5A84'
  if (t.includes('fusion')) return '#A086B7'
  if (t.includes('link')) return '#006EAD'
  if (t.includes('synchro')) return '#CCCCCC'
  if (t.includes('xyz')) return '#000000'
  if (t.includes('ritual')) return '#4E71AF'
  if (t.includes('normal')) return '#FDE68A'
  // default to Effect/monster orange
  return '#FF8B53'
}

const hexToRgba = (hex: string, alpha = 1) => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const bigint = parseInt(full, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const CardPreview: React.FC<{ item: any; isHovered?: boolean }> = ({ item, isHovered }) => {
  if (!item) return <div className="text-sm text-gray-500">None</div>
  const name = item.name || item.title || 'Unnamed'
  // Stable, simple layout: fixed image and tile sizes, consistent font
  const imgPx = 96
  const nameFontSize = 11
  const lineHeight = 1.25
  const lineHeightPx = Math.ceil(nameFontSize * lineHeight)
  const nameContainerHeight = lineHeightPx

  const frameHex = getFrameHex(item)
  const ringColor = hexToRgba(frameHex, 0.95)
  const outerBoxShadow = isHovered ? `0 0 0 6px ${ringColor}, 0 8px 24px ${hexToRgba(frameHex, 0.25)}` : undefined
  const nameMarginTop = 4

  return (
    <div className="flex flex-col items-center text-center w-full max-w-[96px] overflow-visible box-border" style={{ width: `${imgPx}px` }}>
      <div style={{ position: 'relative', width: '84px', height: '84px', transition: 'box-shadow 160ms ease', borderRadius: 6, boxShadow: outerBoxShadow }}>
        {item && (
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
            <CardImage card={item} konamiId={item?.konamiId} alt={name} className="w-full h-full object-cover" />
          </div>
        )}
        {item._qty && item._qty > 1 && (
          <div className="absolute -top-1 -right-1 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-black shadow-lg z-10">
            {item._qty}
          </div>
        )}
      </div>
      <div style={{ marginTop: nameMarginTop, width: '100%', boxSizing: 'border-box' }}>
        <div className="font-medium" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: `${nameFontSize}px`, color: '#fff', textAlign: 'center', paddingLeft: '6px', paddingRight: '6px' }}>{name}</div>
      </div>
    </div>
  )
}

const SkillPreview: React.FC<{ skill: any }> = ({ skill }) => (
  <div className="text-sm">
    <div className="font-medium">{skill?.name || skill}</div>
    {skill?.desc && <div className="text-xs text-gray-400">{String(skill.desc).slice(0, 120)}</div>}
  </div>
)

// ScrollGrid: renders a fixed-width tile grid and only enables scrolling
// when the number of rows exceeds `maxRows` (default 5). It measures
// tile sizes and container width to determine columns/rows.
const ScrollGrid: React.FC<{ 
  items: any[]; 
  renderItem: (item: any, i: number) => React.ReactNode; 
  maxRows?: number; 
  maxCols?: number;
  onHoverItem: (it: any, pos: {x: number, y: number} | null) => void;
  layoutDebug?: boolean;
}> = ({ items, renderItem, maxRows = 5, maxCols, onHoverItem, layoutDebug }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [useScroll, setUseScroll] = React.useState(false)
  const [colsCount, setColsCount] = React.useState<number>(1)
  const [tilePxState, setTilePxState] = React.useState<number>(96)

  React.useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const tile = el.querySelector('[data-tile]') as HTMLElement | null
    const containerWidth = el.clientWidth
    if (!tile || !containerWidth) {
      setUseScroll(false)
      return
    }
    const tileStyle = window.getComputedStyle(tile)
    const tileWidth = tile.getBoundingClientRect().width + parseFloat(tileStyle.marginRight || '0')
    setTilePxState(Math.max(48, Math.round(tileWidth)))
    const measuredCols = Math.max(1, Math.floor(containerWidth / tileWidth))
    const cols = maxCols ? Math.min(measuredCols, maxCols) : measuredCols
    const rows = Math.ceil(items.length / cols)
    setUseScroll(rows > maxRows)
    setColsCount(cols)

    const onResize = () => {
      const cw = el.clientWidth
      const measured = Math.max(1, Math.floor(cw / tileWidth))
      const c = maxCols ? Math.min(measured, maxCols) : measured
      const r = Math.ceil(items.length / c)
      setUseScroll(r > maxRows)
      setColsCount(c)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [items, maxRows, maxCols])

  const rowGap = 12
  const colGap = 12
  const tilePx = tilePxState
  const gridWidth = colsCount * tilePx + Math.max(0, colsCount - 1) * colGap
  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colsCount}, ${tilePx}px)`, gap: `${rowGap}px ${colGap}px`, justifyContent: 'start', alignItems: 'start' }}>
      {items.map((it: any, i: number) => (
        <div
          data-tile
          key={i}
          style={{ width: `${tilePx}px`, ...(layoutDebug ? { outline: '1px dashed rgba(0,255,128,0.7)' } : {}) }}
          onMouseEnter={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            onHoverItem(it, { x: e.clientX, y: e.clientY })
          }}
          onMouseMove={(e) => {
            onHoverItem(it, { x: e.clientX, y: e.clientY })
          }}
          onMouseLeave={() => { onHoverItem(null, null) }}
          className="flex items-center justify-center"
        >
          {renderItem(it, i)}
        </div>
      ))}
    </div>
  )

  const centered = (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ width: `${gridWidth}px`, ...(layoutDebug ? { outline: '1px dashed rgba(255,128,0,0.6)' } : {}) }}>{grid}</div>
    </div>
  )

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
      {useScroll ? (
        <div 
          className="custom-scrollbar" 
          style={{ 
            maxHeight: `${(tilePx + rowGap) * maxRows + 20}px`, 
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '6px',
            paddingBottom: '24px'
          }}
        >
          {centered}
        </div>
      ) : centered}
    </div>
  )
}

// Transient layout debug flag: outlines boxes/tiles to locate spacing issues
const LAYOUT_DEBUG = false

export default function KdrClassPage() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const isEmbedded = Boolean((router.query as any)?.embed)
  const embeddedPlayKey = (router.query as any)?.embedTs || (router.query as any)?.embedPlay
  const [pageMounted, setPageMounted] = useState<boolean>(false)
  const [pageActive, setPageActive] = useState<boolean>(false)
  const PAGE_ANIM_MS = 420
  // Tile/grid sizing constants used to force category box widths to fit 10 cards
  const TILE_PX = 96
  const COL_GAP_PX = 12
  const BOX_PL_PX = 16 // pl-4
  const BOX_PR_PX = 16 // pr-4
  const CARDS_PER_ROW = 10
  const requiredMinWidth = (TILE_PX * CARDS_PER_ROW) + (COL_GAP_PX * (CARDS_PER_ROW - 1)) + BOX_PL_PX + BOX_PR_PX

  // When embedded, force the document background transparent to avoid
  // white flashes while the parent animates an iframe overlay.
  useEffect(() => {
    if (!isEmbedded) return
    const prevHtmlBg = document.documentElement.style.background
    const prevBodyBg = document.body.style.background
    try {
      document.documentElement.style.background = 'transparent'
      document.body.style.background = 'transparent'
    } catch (e) {}
    return () => {
      try { document.documentElement.style.background = prevHtmlBg } catch (e) {}
      try { document.body.style.background = prevBodyBg } catch (e) {}
    }
  }, [isEmbedded])

  useEffect(() => {
    // When embedded, only play the page-level grow animation if the parent
    // supplied an `embedTs`/`embedPlay` query param. Otherwise keep the
    // embedded page static (no transition) so the parent overlay is the only
    // visible animation.
    const embedShouldAnimate = isEmbedded && Boolean(embeddedPlayKey)
    setPageMounted(true)
    if (embedShouldAnimate) {
      // Play the page grow animation on next frame so it occurs after the
      // parent overlay completed and mounted the iframe.
      requestAnimationFrame(() => setPageActive(true))
      try { console.debug('class: embedded — will animate page grow, key=', embeddedPlayKey) } catch (e) {}
      return () => { setPageActive(false) }
    }
    // Not animating: ensure page is active immediately and transitions disabled
    setPageActive(true)
    try { if (isEmbedded) console.debug('class: embedded — no page animation') } catch (e) {}
    return () => { setPageActive(false) }
  }, [isEmbedded, embeddedPlayKey])
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [kdr, setKdr] = useState<any>(null)
  const [cls, setCls] = useState<any>(null)
  const [player, setPlayer] = useState<any>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  const [currentDeckData, setCurrentDeckData] = useState<{main:any[], extra:any[], side:any[]}>({main:[], extra:[], side:[]})
  
  useEffect(() => {
    if (player?.deck?.id) {
       axios.get(`/api/decks/${player.deck.id}`).then(res => {
          const main: any[] = []
          const extra: any[] = []
          const side: any[] = []
          if (res.data.cards) {
            res.data.cards.forEach((dc: any) => {
              const entry = { card: dc.card, qty: dc.quantity }
              if (dc.location === 'EXTRA') extra.push(entry)
              else if (dc.location === 'SIDE') side.push(entry)
              else main.push(entry)
            })
          }
          setCurrentDeckData({ main, extra, side })
       }).catch(e => console.error("Failed to load deck", e))
    }
  }, [player?.deck?.id])

  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)
    // Clear transient messages when switching players/classes
    setMessage(null)
    const q = router.query as { playerIndex?: string; playerKey?: string }
    const requestedPlayerKey = q.playerKey as string | undefined
    const requestedPlayerIndex = (typeof q.playerIndex === 'string') ? (isNaN(parseInt(q.playerIndex, 10)) ? undefined : parseInt(q.playerIndex, 10)) : undefined

    const url = `/api/kdr/${id}/classview` + (requestedPlayerKey ? `?playerKey=${requestedPlayerKey}` : '')
    axios.get(url)
      .then(async (res) => {
        if (!mounted) return
        setKdr(res.data)

        // Determine which player to show: requested playerKey (preferred), requested playerIndex (back-compat), requested playerId (kdrPlayer id or user id), or currentPlayer
        const players = res.data.players || []
        let targetPlayer = null
        if (requestedPlayerKey) {
          targetPlayer = players.find((p: any) => p.playerKey === requestedPlayerKey) || null
        }
        if (!targetPlayer && requestedPlayerIndex !== undefined) {
          targetPlayer = players[requestedPlayerIndex] || null
        }
        // Note: no fallback to raw DB player id; prefer `playerKey` for privacy
        if (!targetPlayer) targetPlayer = res.data.currentPlayer || null

        if (!targetPlayer) {
          setMessage('Player not found or you are not a player in this KDR')
          setLoading(false)
          return
        }

        if (!targetPlayer.classId) {
          // allow viewing other players even if they haven't picked a class
          setPlayer(targetPlayer)
          setMessage('Player has not picked a class yet')
          setLoading(false)
          return
        }

        setPlayer(targetPlayer)

        // fetch class details (detailed endpoint)
        try {
          const classRes = await axios.get(`/api/classes/${targetPlayer.classId}`)
          // API returns full class data; admin/editor expects legendaryMonsterCard key
          setCls(classRes.data || null)
        } catch (e) {
          // ignore
        } finally {
          setLoading(false)
        }
      })
      .catch((e) => {
        setMessage('Failed to load KDR resource. Please contact host if this persists.')
        setLoading(false)
      })
      .finally(() => setLoading(false))

    return () => { mounted = false }
  }, [id, router.query])

  // Listen for shop updates (other pages/components emit this) and refresh class/player snapshot
  React.useEffect(() => {
    const handler = async (e: any) => {
      try {
        // If the event provides a different KDR id, ignore
        const kdrId = e?.detail?.kdrId || null
        if (kdrId && id && String(kdrId) !== String(id)) return
        const res = await axios.get(`/api/kdr/${id}/classview`)
        if (!res || !res.data) return
        setKdr(res.data)
        // keep the currently-selected player selection consistent
        const players = res.data.players || []
        // Prefer matching by KDRPlayer id when possible, then playerKey, then user id, then currentPlayer
        const currentPlayerId = player?.id || null
        const currentKey = player?.playerKey || null
        let updatedPlayer = null
        if (currentPlayerId) {
          updatedPlayer = players.find((p: any) => String(p.id) === String(currentPlayerId)) || null
        }
        if (!updatedPlayer && currentKey) {
          updatedPlayer = players.find((p: any) => p.playerKey === currentKey) || null
        }
        if (!updatedPlayer && player?.user?.id) {
          updatedPlayer = players.find((p: any) => p.user?.id === player.user.id) || null
        }
        if (!updatedPlayer) updatedPlayer = res.data.currentPlayer || null
        if (updatedPlayer) setPlayer(updatedPlayer)
        // refresh class details if necessary
        try {
          if (updatedPlayer?.classId) {
            const classRes = await axios.get(`/api/classes/${updatedPlayer.classId}`)
            setCls(classRes.data || null)
          }
        } catch (ex) {}
      } catch (err) {}
    }

    try {
      window.addEventListener('kdr:shop:playerupdate', handler)
    } catch (e) {}
    // also react to sessionStorage changes from other tabs
    const storageHandler = (ev: StorageEvent) => {
      try {
        const key = typeof id === 'string' ? `kdr:player:${id}` : null
        if (ev.key === key) {
          handler({ detail: { kdrId: id } })
        }
      } catch (e) {}
    }
    window.addEventListener('storage', storageHandler)

    return () => {
      try { window.removeEventListener('kdr:shop:playerupdate', handler) } catch (e) {}
      try { window.removeEventListener('storage', storageHandler) } catch (e) {}
    }
  }, [id, player?.playerKey, player?.user?.id])

  // Hover state for card popups (tiles inside ScrollGrid will update these)
  const [hoverItem, setHoverItem] = useState<any>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const hoverItemKey = hoverItem ? getCardKey(hoverItem) : null
  const [hoverSkill, setHoverSkill] = useState<any>(null)
  const [hoverSkillPos, setHoverSkillPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const cardDetailsCacheRef = React.useRef<Record<string, any>>({})
  const tooltipScrollRef = React.useRef<HTMLDivElement | null>(null)
  const [deckBuilderOpen, setDeckBuilderOpen] = useState(false)
  const [matchScores, setMatchScores] = useState<Record<string, { scoreA: number | null; scoreB: number | null }>>({})

  // Responsive scaler: scale the full page content to fit smaller windows while preserving layout.
  const fullParentRef = React.useRef<HTMLDivElement | null>(null)
  const fullChildRef = React.useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = React.useState<number>(1)
  const [scaledHeight, setScaledHeight] = React.useState<number | undefined>(undefined)
  const [currentDesignWidth, setCurrentDesignWidth] = React.useState<number>(1400)

  React.useLayoutEffect(() => {
    const parent = fullParentRef.current
    const child = fullChildRef.current
    if (!parent || !child) return

    const compute = () => {
      const availW = Math.max(320, window.innerWidth - 24) // leave small margin
      // Force a stable design width so the page scales uniformly.
      // This should be the target 'desktop' layout width to fit on smaller screens.
      const dw = Math.max(1400, (requiredMinWidth || 1100) + 360)
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
  }, [requiredMinWidth])

  // Combine class-level skills (including main/relic) with player skills for display (dedupe by name)
  // Raw inventory (as returned by the server). We'll derive a "sanitized"
  // inventory that excludes treasures so treasures don't leak into the
  // general card/category views. Prefer server-returned `player.treasures`
  // when present to determine what's a treasure.
  const rawInventory = (player?.inventory || []) as any[]
  const serverTreasures = Array.isArray(player?.treasures) ? player.treasures as any[] : null
  const serverTreasureIds = React.useMemo(() => new Set((serverTreasures || []).map((t: any) => t.id)), [serverTreasures])

  const sanitizedInventory = React.useMemo(() => {
    return rawInventory.filter((it: any) => {
      if (!it) return false
      // If the row explicitly marks `isTreasure`, treat as treasure and exclude
      if (it.isTreasure) return false
      // If the server returned treasures separately, exclude items whose ids match
      if (serverTreasures && serverTreasureIds.has(it.id)) return false
      // Back-compat: if server did NOT return treasures, treat UR/SR rarity as treasures
      if (!serverTreasures) {
        const rarity = String(it.rarity || it.card?.rarity || '').toUpperCase()
        if (rarity === 'UR' || rarity === 'SR') return false
      }
      return true
    })
  }, [rawInventory, serverTreasures, serverTreasureIds])

  const combinedSkills = React.useMemo(() => {
    // Only surface player skills that were explicitly granted/purchased (shop/inventory).
    const fromPlayer = (player?.skills || []).filter((s: any) => {
      if (!s) return false
      const src = s._source || s.source || null
      // Always allow inventory-derived skills. Also allow shop/loot-pool/tip
      // skills surfaced by the server; server enforces KDR-scoped filters.
      return src === 'INVENTORY' || src === 'SHOP' || src === 'LOOT_POOL' || src === 'TIP'
    }).map((s: any) => (typeof s === 'string' ? { name: s } : s))
    const fromInventory = (sanitizedInventory || []).flatMap((it: any) => {
      if (!it) return []
      if ((it.type || '').toString().toLowerCase() === 'skill') {
        if (it.skill) return [{ id: it.skill.id, name: it.skill.name, description: it.skill.description || it.skill.desc || '', _source: 'INVENTORY' }]
        // fallback: represent generic purchased skill (no linked Skill model)
        return [{ id: `loot-${it.id}`, name: (it.lootName || it.skillName || 'Purchased Skill'), description: '', _source: 'INVENTORY' }]
      }
      return []
    })

    const map = new Map<string, any>()

    // Add ONLY starting/main class skills from the class definition itself.
    // Loot-pool-destined skills should not be innate.
    ;(cls?.skills || []).forEach((s: any) => {
      if (s.type === 'MAIN' || s.type === 'INNATE' || s.type === 'STARTING') {
          const key = (s?.name || '').toString()
          if (key) map.set(key, s)
      }
    })

    // Add player skills if they don't conflict by name
    ;[...fromPlayer, ...fromInventory].forEach((s: any) => { 
      const name = (s?.name || s || '').toString()
      if (!name) return

      // Sanity check: if this skill is in the class's loot pool but isn't a starting type,
      // it should only be included if it has an explicit SHOP source or matches a confirmed inventory row
      // that isn't just a leftover from a previous buggy pick-class run.
      const matchInClass = (cls?.skills || []).find((cs: any) => (cs.id === s.id) || (cs.name === name))
      if (matchInClass && matchInClass.type !== 'MAIN' && matchInClass.type !== 'INNATE' && matchInClass.type !== 'STARTING') {
          // If the player "owns" it in their item list but it's a loot skill, 
          // we only trust it if it was clearly purchased or added from external source.
          if (s._source === 'LOOT_POOL' || s._source === 'INVENTORY') {
              // This is likely a legacy artifact from the previous pick-class (where it was awarded by default).
              // We'll skip it unless it survives the check.
              return
          }
      }

      if (!map.has(name)) map.set(name, s) 
    })
    return Array.from(map.values())
  }, [cls?.skills, player?.skills, sanitizedInventory])

  // Skills to actually display in the "Skills" area should exclude class-owned skills (MAIN, etc).
  const displaySkills = React.useMemo(() => {
    // Only surface player skills that were explicitly granted/purchased (shop/inventory).
    const fromPlayer = (player?.skills || []).filter((s: any) => {
      if (!s) return false
      const src = s._source || s.source || null
      return src === 'INVENTORY' || src === 'SHOP' || src === 'LOOT_POOL' || src === 'TIP'
    }).map((s: any) => (typeof s === 'string' ? { name: s } : s))
    const fromInventory = (sanitizedInventory || []).flatMap((it: any) => {
      if (!it) return []
      if ((it.type || '').toString().toLowerCase() === 'skill') {
        if (it.skill) return [{ id: it.skill.id, name: it.skill.name, description: it.skill.description || it.skill.desc || '', _source: 'INVENTORY' }]
        return [{ id: `loot-${it.id}`, name: (it.lootName || it.skillName || 'Purchased Skill'), description: '', _source: 'INVENTORY' }]
      }
      return []
    })

    const map = new Map<string, any>()
    const mainId = cls?.skills?.find((s: any) => s.type === 'MAIN')?.id

    ;[...fromPlayer, ...fromInventory].forEach((s: any) => {
      // Exclude the "MAIN" skill from the list as it's already accounted for in the sidebar.
      if (s.id === mainId) return

      // Sanity check: ensure we don't accidentally display loot pool skills as "owned".
      // If a skill is in the class's linked list but is NOT one of the innate types, 
      // we only show it if it has an explicit SHOP source or matches a confirmed inventory row.
      const matchInClass = (cls?.skills || []).find((cs: any) => (cs.id === s.id) || (cs.name === s.name))
      if (matchInClass && matchInClass.type !== 'MAIN' && matchInClass.type !== 'INNATE' && matchInClass.type !== 'STARTING') {
         if (s._source === 'LOOT_POOL' || s._source === 'INVENTORY') {
            // These sources are approximated from the PlayerItem table.
            // If they are class skills but not starting ones, the pick-class fix prevents them
            // for new users. For existing users, we'll exclude them here to clean up the UI.
            return
         }
      }

      const key = (s?.id) ? s.id : (s?.name || '').toString()
      if (!key) return
      if (!map.has(key)) map.set(key, s)
    })
    return Array.from(map.values())
  }, [player?.skills, sanitizedInventory, cls?.skills])

  // Loot skills: skills explicitly earned from loot pools or present in inventory
  const lootSkills = React.useMemo(() => {
    // Collect candidate skills from player rows and inventory, but only
    // include those that are defined in the class's loot skill list.
    const byPlayer = (player?.skills || []).filter((s: any) => {
      if (!s) return false
      const src = (s._source || s.source || '').toString().toUpperCase()
      return src === 'LOOT_POOL' || src === 'INVENTORY'
    }).map((s: any) => (typeof s === 'string' ? { name: s } : s))

    const fromInv = (sanitizedInventory || []).flatMap((it: any) => {
      if (!it) return []
      if ((it.type || '').toString().toLowerCase() === 'skill') {
        if (it.skill) return [{ id: it.skill.id, name: it.skill.name, description: it.skill.description || it.skill.desc || '', _source: 'INVENTORY' }]
        return [{ id: `loot-${it.id}`, name: (it.lootName || it.skillName || 'Purchased Skill'), description: '', _source: 'INVENTORY' }]
      }
      return []
    })

    // Build a set of class loot skill identifiers (id or name) — exclude MAIN/INNATE/STARTING
    const classLootSet = new Set<string>()
    ;(cls?.skills || []).forEach((cs: any) => {
      if (!cs) return
      const t = (cs.type || '').toString().toUpperCase()
      if (t === 'MAIN' || t === 'INNATE' || t === 'STARTING') return
      if (cs.id) classLootSet.add(String(cs.id))
      if (cs.name) classLootSet.add(String(cs.name))
    })

    const map = new Map<string, any>()
    ;[...byPlayer, ...fromInv].forEach((s: any) => {
      const key = s.id ? String(s.id) : (s.name || '').toString()
      if (!key) return
      // Only include if this skill exists in the class's loot set
      const inClassLoot = classLootSet.has(key) || classLootSet.has(s.name)
      if (!inClassLoot) return
      if (!map.has(key)) map.set(key, s)
    })
    return Array.from(map.values())
  }, [player?.skills, sanitizedInventory, cls?.skills])

  // Normalize starting cards from the class payload into a flat card array
  const getCardCategory = (type: string | undefined): 'Monster' | 'Spell' | 'Trap' | 'Extra' => {
    if (!type) return 'Monster'
    const lowerType = type.toLowerCase()
    if (lowerType.includes('fusion') || lowerType.includes('synchro') || lowerType.includes('xyz') || lowerType.includes('link')) return 'Extra'
    if (lowerType.includes('spell')) return 'Spell'
    if (lowerType.includes('trap')) return 'Trap'
    return 'Monster'
  }

  const startingDeck = React.useMemo(() => {
    if (!cls?.startingCards && (!combinedSkills || !combinedSkills.length) && !cls?.legendaryMonsterCard && !(player?.inventory && player.inventory.length)) return []
    const base = (cls?.startingCards || []).map((sc: any) => (sc.card ? sc.card : sc))
    if (cls?.legendaryMonsterCard) {
        base.push(cls.legendaryMonsterCard)
    }
    const provided = (combinedSkills || []).flatMap((s: any) => s.providesCards || [])
    // Include any purchased/inventory cards for the currently viewed player
        // Exclude treasures (pickedAs === 'treasure' or high rarity) from the starting cards.
        const treasureLootIds = new Set<string>(((player?.shopState?.purchases || []) as any[]).filter((p: any) => p && p.pickedAs === 'treasure').map((p: any) => String(p.lootItemId)))
        const inventoryCards = (player?.inventory || []).flatMap((it: any) => {
          if (!it || !it.card) return []
          if (it.lootItemId && treasureLootIds.has(String(it.lootItemId))) return []
          const rarity = String(it.rarity || it.card?.rarity || '').toUpperCase()
          if (rarity === 'UR' || rarity === 'SR') return []
          return [{ ...it.card, _qty: it.qty || 1, _source: 'INVENTORY' }]
        })
    const all = [...base, ...provided, ...inventoryCards]
    const map = new Map<string, any>()
    all.forEach((c: any) => {
      if (!c) return
      const key = c.id || `${c.konamiId || ''}-${(c.name || c.title || '').toString()}`
      if (!map.has(key)) map.set(key, c)
    })
    // Note: Legendary monster is now included in result so it appears in Deck Builder
    
    // Apply Modifications to card descriptions
    // We can reuse the logic from CardDescription via a helper or just manually apply here
    // Modifications are found in `combinedSkills`.
    const allModifications = (combinedSkills || []).flatMap((s: any) => s.modifications || [])
    
    // Process map to update descriptions
    for (const [key, card] of map.entries()) {
        const mods = allModifications.filter((m: any) => m.card?.id === card.id || m.cardId === card.id)
        if (mods.length > 0) {
            // Apply modifications
            // 1. Condition
            const cond = mods.find((m: any) => m.type === 'CONDITION')
            // 2. Text replacement/highlight (usually not a full replacement but we can append conditions)
            
            // Pass modifications so CardDescription can render them properly
            // Ensure card.id is present on the modification so CardDescription filter works
            const safeMods = mods.map((m: any) => ({ ...m, card: { ...(m.card || {}), id: card.id } }))
            const ensureDesc = card.desc || card.description || ''
            map.set(key, { ...card, desc: ensureDesc, description: ensureDesc, modifications: safeMods })
        }
    }

    return Array.from(map.values())
  }, [cls, combinedSkills])

  

  const startingByCategory = React.useMemo(() => {
    return {
      monsters: startingDeck.filter((c: any) => getCardCategory(c?.type) === 'Monster'),
      spells: startingDeck.filter((c: any) => getCardCategory(c?.type) === 'Spell'),
      traps: startingDeck.filter((c: any) => getCardCategory(c?.type) === 'Trap'),
      extra: startingDeck.filter((c: any) => getCardCategory(c?.type) === 'Extra')
    }
  }, [startingDeck])

  // Filter and sort cards by name/description when searchQuery is present.
  const filteredByCategory = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    const match = (it: any) => {
      if (!q) return true
      const name = (it?.name || it?.title || '').toString().toLowerCase()
      const desc = (it?.desc || it?.description || it?.text || '').toString().toLowerCase()
      return name.includes(q) || desc.includes(q)
    }
    const sortFn = (a: any, b: any) => {
      const an = (a?.name || a?.title || '').toString()
      const bn = (b?.name || b?.title || '').toString()
      return an.localeCompare(bn)
    }
    return {
      monsters: (startingByCategory.monsters || []).filter(match).sort(sortFn),
      spells: (startingByCategory.spells || []).filter(match).sort(sortFn),
      traps: (startingByCategory.traps || []).filter(match).sort(sortFn),
      extra: (startingByCategory.extra || []).filter(match).sort(sortFn)
    }
  }, [startingByCategory, searchQuery])

  const mainSkill = cls?.skills?.find((s: any) => s?.type === 'MAIN') || null

  // Whether this player has reported their current-round match (used to gate shop access)
  const hasReportedThisRound = (() => {
    try {
      if (!kdr || !kdr.rounds || !player) return false
      const rounds = kdr.rounds || []
      const current = rounds.find((r: any) => (r.matches || []).some((m: any) => m.status !== 'COMPLETED')) || rounds[rounds.length - 1]
      if (!current) return false
      const match = (current.matches || []).find((m: any) => {
        const aId = m.playerA?.id || m.playerAId
        const bId = m.playerB?.id || m.playerBId
        return aId === player.id || bId === player.id
      })
      if (!match) return false
      // If this is a BYE match (no opponent), treat it as implicitly reported so the player may open their shop
      const isBye = !match.playerBId && !match.playerB
      if (isBye) return true
      return match.reportedById === player.user?.id
    } catch (e) {
      return false
    }
  })()

  

  if (loading) return <div className="p-4">Loading...</div>

  if (!kdr) return <div className="p-4">Failed to load KDR</div>
  if (!player) return <div className="p-4">{message || 'Player not available'}</div>

  return (
    <div
      className="p-6 min-h-screen w-full overflow-x-hidden"
      ref={fullParentRef}
      style={{
        transformOrigin: 'center',
        transform: pageActive ? 'scaleX(1)' : 'scaleX(0)',
        transition: (isEmbedded && !embeddedPlayKey) ? 'none' : `transform ${PAGE_ANIM_MS}ms cubic-bezier(.2,.9,.2,1)`,
        height: scaledHeight ? `${scaledHeight}px` : undefined,
        overflow: 'hidden'
      }}
    >
      <style jsx>{`
        .scrollable {
          overflow-y: auto;
          scrollbar-width: none; /* Firefox */
        }
        .scrollable::-webkit-scrollbar { width: 0; height: 0; }
        .scrollable:hover { scrollbar-width: thin; }
        .scrollable:hover::-webkit-scrollbar { width: 8px; }
        .scrollable::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 6px; }
      `}</style>
      <div className="w-full" ref={fullChildRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: '100%', maxWidth: scale < 1 ? `${currentDesignWidth}px` : undefined, display: 'block', margin: '0 auto' }}>
        <div className="px-6 lg:px-12 pt-4">
          {!isEmbedded && (
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => router.push(`/kdr/${id}`)}
                className="flex items-center gap-2 text-indigo-500 hover:text-indigo-400 font-bold transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Tournament Dashboard
              </button>
              
              <div className="flex items-center gap-3">
                <label className="text-sm mr-2 text-gray-400">View player:</label>
                <select
                  value={(player?.playerKey) || (() => {
                    try { const key = (kdr?.players || []).find((p: any) => p.playerKey === player?.playerKey)?.playerKey; return key || '' } catch (e) { return '' }
                  })()}
                  onChange={(e) => {
                    const key = e.target.value
                    const q = { ...(router.query || {}), playerKey: key || undefined }
                    // Keep backwards compatibility: do not include playerId here to avoid exposing long ids in the URL
                    router.push({ pathname: router.pathname, query: q }, undefined, { shallow: true })
                  }}
                  className="rounded px-3 py-1 bg-white/5 text-sm text-gray-100 border border-transparent focus:border-gray-400 focus:outline-none"
                >
                  {kdr.players?.map((p: any, i: number) => (
                    <option key={p.playerKey || i} value={p.playerKey}>{p.user?.name || p.user?.email}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          
          {message && (
            <div className="mb-4 p-3 bg-yellow-100 text-yellow-900 rounded">{message}</div>
          )}
        </div>

        {/* top legendary boxes removed: class summary shows quest/relic in left card */}

        <div className="grid grid-cols-12 gap-6 px-6 lg:px-12 relative">
          {/* Class Image: Pulsed out of the flow so it doesn't push the columns down */}
          <div className="absolute left-1/2 -top-20 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50">
            <div className="w-80 h-48 flex items-center justify-center overflow-visible">
              {cls?.image ? (
                <ClassImage image={cls.image} alt={cls.name} className="h-full w-auto object-contain drop-shadow-2xl brightness-110" />
              ) : (
                <div className="text-gray-400 text-[10px] uppercase tracking-widest font-bold opacity-30">Class Image</div>
              )}
            </div>
          </div>

          <aside className={`col-span-12 lg:col-span-3 ml-0 ${scale === 1 ? 'lg:-ml-[72px]' : ''}`}>
            <div className="bg-gray-50 dark:bg-slate-50/5 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-white/10">
                
                {/* Legendary Monster (High Detail Display) */}
                {cls?.legendaryMonsterCard && (
                  <div className="mb-6 rounded-lg overflow-hidden border border-indigo-500/30 bg-indigo-500/5 backdrop-blur-sm shadow-lg">
                    <div className="p-2 bg-indigo-600/20 border-b border-indigo-500/30 text-center">
                      <div className="font-black italic uppercase tracking-[0.2em] text-indigo-400 text-[10px]">Legendary Monster</div>
                    </div>
                    <div className="p-4 flex flex-col items-center">
                      <div className="w-48 aspect-[11/16] relative group ring-2 ring-indigo-500/20 rounded-lg overflow-hidden transition-all hover:ring-indigo-500/40 shadow-2xl">
                        {(cls.legendaryMonsterCard.konamiId || cls.legendaryMonsterCard.imageUrl || cls.legendaryMonsterCard.image) ? (
                          <CardImage 
                            card={cls.legendaryMonsterCard} 
                            konamiId={cls.legendaryMonsterCard.konamiId} 
                            alt={cls.legendaryMonsterCard.name} 
                            useLootArt={true}
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 font-bold">MISSING ART</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}


                <div className="mt-4 space-y-3">
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-md border-l-4 border-teal-400">
                      <div className="font-semibold">{mainSkill?.name || 'Class Skill'}</div>
                        {mainSkill ? (
                          <div className="text-sm text-gray-400 mt-1">
                            <div className="mt-1">{mainSkill.desc || mainSkill.description || 'No description'}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 mt-1">None</div>
                        )}
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-md border-l-4 border-amber-500">
                      <div className="font-semibold">Legendary Quest</div>
                      <div className="text-sm text-gray-400 mt-1">{cls?.legendaryQuest || 'None'}</div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-md border-l-4 border-violet-600">
                      <div className="font-semibold">Legendary Relic</div>
                      <div className="text-sm text-gray-400 mt-1">{cls?.legendaryRelic || 'None'}</div>
                    </div>
                  </div>

                    <div className="mt-6">
                    <div className="text-sm text-gray-500 mb-2">Stats</div>
                      {(() => {
                        const displayedStats = (player?.shopState && player.shopState.stats) ? player.shopState.stats : (player?.stats || {})
                        return (
                          <div className="grid grid-cols-5 gap-2">
                            <StatBox
                              label="DEX"
                              value={displayedStats?.dex ?? 0}
                              color="#d97706"
                              description={`(Once per Duel) (Quick Effect): You can draw 1 card. You can activate this effect one time per every 4 DEX you have.`}
                            />
                            <StatBox
                              label="CON"
                              value={displayedStats?.con ?? 0}
                              color="#10b981"
                              description={`Each point in CON adds 500LP to your starting LP. (Once per turn): If a monster you control would be destroyed by battle, it is not (this is a mandatory effect). You can activate this effect one time per every 3 CON you have.`}
                            />
                            <StatBox
                              label="STR"
                              value={displayedStats?.str ?? 0}
                              color="#fb7185"
                              description={`(Once per turn): Your monsters gain 100 ATK for every two STR you have.`}
                            />
                            <StatBox
                              label="INT"
                              value={displayedStats?.int ?? 0}
                              color="#0ea5e9"
                              description={`Your minimum Deck size is reduced by 1 per INT you have.`}
                            />
                            <StatBox
                              label="CHA"
                              value={displayedStats?.cha ?? 0}
                              color="#8b5cf6"
                              description={`You can re-roll all your shown Loot Pools in your Shop one time per every 2 CHA you have.`}
                            />
                          </div>
                        )
                      })()}
                    <div className="mt-4">
                        <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-white dark:bg-white/5 rounded text-center border-t-4 border-yellow-400">
                          <div className="text-sm text-yellow-300">Gold</div>
                                <div className="font-bold text-lg">{player.gold ?? 0}</div>
                        </div>
                              <div className="p-3 bg-white dark:bg-white/5 rounded text-center border-t-4 border-pink-400">
                          <div className="text-sm text-pink-300">Level</div>
                          {(() => {
                            const xp = player?.xp ?? 0
                            const snapshotCurve = (kdr?.settingsSnapshot && Array.isArray(kdr.settingsSnapshot.levelXpCurve)) ? kdr.settingsSnapshot.levelXpCurve : null
                            const lvlIndex = computeLevel(xp, snapshotCurve || undefined)
                            const displayedLevel = (Number(lvlIndex) || 0) + 1
                            const nextTarget = snapshotCurve ? (snapshotCurve[displayedLevel] ?? (displayedLevel * 100)) : (displayedLevel * 100)
                            const toNext = Math.max(0, nextTarget - xp)
                            return (
                              <>
                                <div className="font-bold text-lg">{displayedLevel}</div>
                                <div className="text-xs text-gray-400 mt-1">{`${toNext} XP to next level`}</div>
                              </>
                            )
                          })()}
                        </div>
                      </div>

                      {/* Per-player Shop button: only visible to the player themself, after they've reported, and while shop is not complete */}
                      {session?.user?.id === player.user?.id && !player?.shopComplete && hasReportedThisRound && !isEmbedded && (
                        <div className="mt-3">
                          <button
                            onClick={() => { if (!id) return; router.push(`/kdr/${id}/shop`) }}
                            className="px-4 py-2 rounded bg-amber-500 text-white shadow-lg ring-2 ring-amber-300 animate-pulse"
                          >
                            Open Shop
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
              {/* Right area: 2x2 grid for Monsters / Spells / Traps / Extra Deck */}
              <main className="col-span-12 lg:col-span-9 mt-16">
                <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-end">
                  <button 
                    onClick={() => setDeckBuilderOpen(true)} 
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 transition-colors shadow-lg font-bold"
                  >
                    Modify Deck
                  </button>

                  <div className="relative w-full md:w-80">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search cards..."
                      className="w-full pl-4 pr-10 py-2 bg-gray-100 border border-gray-200 dark:bg-white/5 dark:border-transparent text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-10" style={{ marginTop: '0px' }}>
                    <div className="bg-gray-50 dark:bg-slate-50/5 rounded border border-gray-100 dark:border-transparent mt-10" style={{ position: 'relative', padding: `${BOX_PL_PX}px`, width: '100%', maxWidth: `${requiredMinWidth}px`, boxSizing: 'border-box', ...(LAYOUT_DEBUG ? { outline: '2px solid rgba(0,128,255,0.12)' } : {}) }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-100%)', zIndex: 20 }} className="text-center">
                        <h3 className="font-semibold text-3xl" style={{ color: '#FF8B53' }}>
                          Monsters <span className="text-sm" style={{ color: '#FF8B53', opacity: 0.85 }}>({filteredByCategory.monsters.length ?? 0})</span>
                        </h3>
                      </div>
                    <div>
                        {(filteredByCategory.monsters && filteredByCategory.monsters.length) ? (
                        <ScrollGrid items={filteredByCategory.monsters} renderItem={(m: any, i: number) => <CardPreview key={i} item={m} isHovered={hoverItemKey === getCardKey(m)} />} maxRows={2} maxCols={10} onHoverItem={(it, pos) => { setHoverItem(it); if (pos) setHoverPos(pos) }} />
                      ) : (<div className="text-sm text-gray-600">No monsters</div>)}
                    </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-50/5 rounded border border-gray-100 dark:border-transparent" style={{ position: 'relative', padding: `${BOX_PL_PX}px`, width: '100%', maxWidth: `${requiredMinWidth}px`, boxSizing: 'border-box', ...(LAYOUT_DEBUG ? { outline: '2px solid rgba(0,128,255,0.12)' } : {}) }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-100%)', zIndex: 20 }} className="text-center">
                        <h3 className="font-semibold text-3xl" style={{ color: '#1D9E74' }}>
                          Spells <span className="text-sm" style={{ color: '#1D9E74', opacity: 0.85 }}>({filteredByCategory.spells.length ?? 0})</span>
                        </h3>
                      </div>
                    <div>
                          {(filteredByCategory.spells && filteredByCategory.spells.length) ? (
                          <ScrollGrid items={filteredByCategory.spells} renderItem={(s: any, i: number) => <CardPreview key={i} item={s} isHovered={hoverItemKey === getCardKey(s)} />} maxRows={2} maxCols={10} onHoverItem={(it, pos) => { setHoverItem(it); if (pos) setHoverPos(pos) }} />
                        ) : (<div className="text-sm text-gray-600">No spells</div>)}
                    </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-50/5 rounded border border-gray-100 dark:border-transparent" style={{ position: 'relative', padding: `${BOX_PL_PX}px`, width: '100%', maxWidth: `${requiredMinWidth}px`, boxSizing: 'border-box', ...(LAYOUT_DEBUG ? { outline: '2px solid rgba(0,128,255,0.12)' } : {}) }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-100%)', zIndex: 20 }} className="text-center">
                        <h3 className="font-semibold text-3xl" style={{ color: '#BC5A84' }}>
                          Traps <span className="text-sm" style={{ color: '#BC5A84', opacity: 0.85 }}>({filteredByCategory.traps.length ?? 0})</span>
                        </h3>
                      </div>
                    <div>
                          {(filteredByCategory.traps && filteredByCategory.traps.length) ? (
                          <ScrollGrid items={filteredByCategory.traps} renderItem={(t: any, i: number) => <CardPreview key={i} item={t} isHovered={hoverItemKey === getCardKey(t)} />} maxRows={2} maxCols={10} onHoverItem={(it, pos) => { setHoverItem(it); if (pos) setHoverPos(pos) }} />
                        ) : (<div className="text-sm text-gray-600">No traps</div>)}
                    </div>
                    </div>

                    {/* Extra Deck moved below Traps and uses same box/grid behavior */}
                    <div className="bg-gray-50 dark:bg-slate-50/5 rounded border border-gray-100 dark:border-transparent" style={{ position: 'relative', padding: `${BOX_PL_PX}px`, width: '100%', maxWidth: `${requiredMinWidth}px`, boxSizing: 'border-box', ...(LAYOUT_DEBUG ? { outline: '2px solid rgba(0,128,255,0.12)' } : {}) }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-100%)', zIndex: 20 }} className="text-center">
                        <h3 className="font-semibold text-3xl" style={{ color: '#A086B7' }}>
                          Extra Deck <span className="text-sm" style={{ color: '#A086B7', opacity: 0.85 }}>({filteredByCategory.extra.length ?? 0})</span>
                        </h3>
                      </div>
                    <div>
                          {(filteredByCategory.extra && filteredByCategory.extra.length) ? (
                          <ScrollGrid items={filteredByCategory.extra} renderItem={(d: any, i: number) => <CardPreview key={i} item={d} isHovered={hoverItemKey === getCardKey(d)} />} maxRows={2} maxCols={10} onHoverItem={(it, pos) => { setHoverItem(it); if (pos) setHoverPos(pos) }} />
                        ) : (<div className="text-sm text-gray-600">No extra deck cards</div>)}
                    </div>
                    </div>
                  </div>

                  <div className="lg:col-span-1 flex flex-col gap-8 mr-0 lg:-mr-[72px] mt-10">
                    <div className="px-2 lg:px-4">
                      <div className="p-2 bg-gray-50 dark:bg-slate-50/5 rounded border border-gray-100 dark:border-transparent mt-8" style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-100%)', zIndex: 20 }} className="text-center w-full">
                          <h3 className="font-semibold text-2xl whitespace-nowrap" style={{ color: '#F59E0B' }}>
                            Treasures <span className="text-sm opacity-80">({Array.isArray(serverTreasures) ? serverTreasures.length : 0})</span>
                          </h3>
                        </div>
                      <div className="mt-2">
                        {/* Render treasures as full-card images with rarity visual treatment. */}
                        {(() => {
                          const inventory = rawInventory
                          // Prefer server-returned treasures; fall back to legacy rarity-based
                          const rawTreasures = Array.isArray(serverTreasures) ? serverTreasures : inventory.filter((it: any) => {
                             if (!it) return false
                             if (it.isTreasure) return true
                             const rarity = String(it.rarity || it.card?.rarity || '').toUpperCase()
                             return rarity === 'UR' || rarity === 'SR'
                          })

                          const treasures = rawTreasures

                          if (!treasures || treasures.length === 0) return <div className="text-sm text-gray-500 italic ml-2 mb-2">No treasures yet...</div>

                          return (
                            <div className="scrollable flex flex-wrap gap-3 p-1" style={{ maxHeight: '420px', paddingRight: '6px' }}>
                              {treasures.map((it: any, i: number) => {
                                const card = it.card || null
                                const konami = card?.konamiId
                                // stable key and card-like item for hover
                                const cardLike = card ? { ...card, rarity: it.rarity, _qty: it.qty } : { name: it.lootName || it.title || 'Treasure', rarity: it.rarity }
                                const rarity = (it.rarity || card?.rarity || 'C').toString().toUpperCase()
                                const isUR = rarity === 'UR'
                                return (
                                  <div key={i} className="w-24 flex-shrink-0 flex flex-col items-center treasure-wrapper" style={{ position: 'relative' }}>
                                    <div className="w-full flex flex-col items-center treasure-item"
                                      onMouseEnter={(e: any) => { setHoverItem(cardLike); setHoverPos({ x: e.clientX, y: e.clientY }) }}
                                      onMouseMove={(e: any) => { setHoverPos({ x: e.clientX, y: e.clientY }); if (!hoverItem) setHoverItem(cardLike) }}
                                      onMouseLeave={() => { setHoverItem(null) }}
                                    >
                                      <div
                                        className="treasure-img-wrap rounded-md cursor-pointer"
                                        style={{ position: 'relative' }}
                                      >
                                        {/* Replaced complex glow overlays with a simple rarity ring for class view */}
                                        {(() => {
                                          const rarityKey = (it.rarity || card?.rarity || 'C').toString().toUpperCase()
                                          let ringStyle: any = {}
                                          if (rarityKey === 'SR') {
                                            ringStyle = { boxShadow: '0 0 0 4px rgba(245,158,11,0.12), 0 0 20px 6px rgba(245,158,11,0.16)' }
                                          } else if (rarityKey === 'UR') {
                                            ringStyle = { boxShadow: '0 0 0 4px rgba(139,92,246,0.12), 0 0 24px 8px rgba(6,182,212,0.12)' }
                                          } else {
                                            ringStyle = { boxShadow: 'none' }
                                          }
                                          return (
                                            <div className="treasure-img-clip" style={{ position: 'relative', transition: 'box-shadow 220ms ease', ...ringStyle, width: '84px', height: '122px' }}>
                                              {card ? (
                                                <div style={{ width: '100%', height: '100%' }}>
                                                  <CardImage card={card} konamiId={konami} alt={card?.name || 'treasure'} useLootArt={true} className="w-full h-full object-contain shadow-md" />
                                                </div>
                                              ) : (
                                                <div className="w-full h-full bg-gray-700 rounded-md flex items-center justify-center text-[10px] text-gray-300">No image</div>
                                              )}
                                              {isUR && <ShatterfoilOverlay />}
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>
                                    <div className="mt-2 w-full flex items-center justify-center" style={{ minHeight: '32px' }}>
                                      {it.rarity && (() => {
                                        const r = String(it.rarity || '').toUpperCase();
                                        const mapped = r === 'C' || r === 'COMMON' ? 'N' : r;
                                        return (
                                          <img
                                            src={`/images/rarity/${mapped}.png`}
                                            alt={String(it.rarity || '')}
                                            className="w-10 h-10 object-contain"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                          />
                                        )
                                      })()}
                                    </div>
                                    {Number(it.qty || 1) > 1 && (
                                      <div className="absolute right-1 bottom-1 text-xs bg-white/90 text-gray-900 px-1 rounded">x{it.qty}</div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                      </div>
                    </div>

                    <div className="px-2 lg:px-4">
                      <div className="p-2 bg-gray-50 dark:bg-slate-50/5 rounded border border-gray-100 dark:border-transparent mt-8" style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-100%)', zIndex: 20 }} className="text-center w-full">
                          <h3 className="font-semibold text-2xl whitespace-nowrap" style={{ color: '#0EA5E9' }}>
                            Skills <span className="text-sm opacity-80">({displaySkills?.length || 0})</span>
                          </h3>
                        </div>
                      <div className="mt-2">
                        {(displaySkills && displaySkills.length) ? (
                          <div className="flex flex-wrap gap-2">
                            {displaySkills.map((s: any, i: number) => {
                              const isHover = hoverSkill === s
                              return (
                                <div
                                  key={i}
                                  onMouseEnter={(e) => { setHoverSkill(s); setHoverSkillPos({ x: (e as any).clientX, y: (e as any).clientY }) }}
                                  onMouseMove={(e) => setHoverSkillPos({ x: (e as any).clientX, y: (e as any).clientY })}
                                  onMouseLeave={() => setHoverSkill(null)}
                                  className={`flex flex-col items-center gap-1 cursor-default text-gray-200`} 
                                  style={{ width: '72px' }}
                                >
                                  <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center transition-all ${isHover ? 'ring-2 ring-emerald-400 ring-offset-0' : ''}`}>
                                    <img src="/icons/skill_icon.png" alt="skill" className="w-full h-full object-cover rounded-full" />
                                  </div>
                                  <div className={`text-xs font-semibold text-center truncate ${isHover ? 'text-white' : ''}`} style={{ maxWidth: '64px' }}>{s.name || s}</div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">No skills yet.</div>
                        )}
                      </div>
                      </div>
                      {/* Loot Skills: skills earned from loot pools or added to inventory */}
                      <div className="mt-8">
                        <div className="p-2 bg-gray-50 dark:bg-slate-50/5 rounded border border-gray-100 dark:border-transparent w-full" style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-100%)', zIndex: 20 }} className="text-center w-full">
                            <h3 className="font-semibold text-2xl whitespace-nowrap" style={{ color: '#8B5CF6' }}>
                              Loot Skills <span className="text-sm opacity-80">({lootSkills?.length || 0})</span>
                            </h3>
                          </div>
                          <div className="mt-2">
                            {(!lootSkills || lootSkills.length === 0) ? (
                              <div className="text-sm text-gray-600">No loot-derived skills yet.</div>
                            ) : (
                              <div className="flex flex-wrap gap-2 w-full">
                                {lootSkills.map((s: any, i: number) => {
                                  const isHover = hoverSkill === s
                                  return (
                                    <div
                                      key={i}
                                      onMouseEnter={(e) => { setHoverSkill(s); setHoverSkillPos({ x: (e as any).clientX, y: (e as any).clientY }) }}
                                      onMouseMove={(e) => setHoverSkillPos({ x: (e as any).clientX, y: (e as any).clientY })}
                                      onMouseLeave={() => setHoverSkill(null)}
                                      className={`flex flex-col items-center gap-1 cursor-default text-gray-200`}
                                      style={{ width: '72px' }}
                                    >
                                      <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center transition-all ${isHover ? 'ring-2 ring-emerald-400 ring-offset-0' : ''}`}>
                                        <img src="/icons/skill_icon.png" alt="skill" className="w-full h-full object-cover rounded-full" />
                                      </div>
                                      <div className={`text-xs font-semibold text-center truncate ${isHover ? 'text-white' : ''}`} style={{ maxWidth: '64px' }}>{s.name || s}</div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Removed duplicate Treasures area - treasures are shown in the right column above */}
              </main>
          </div>

          {/* Hover popup for cards (positioned near mouse) */}
          {/* Deck Builder overlay */}
          <DeckBuilderOverlay
            open={deckBuilderOpen}
            initialDeckName={player?.deck?.name}
            initialMain={currentDeckData.main}
            initialExtra={currentDeckData.extra}
            initialSide={currentDeckData.side}
            onClose={() => setDeckBuilderOpen(false)}
            onSave={async (data) => {
              setMessage('Saving deck...')
              try {
                // If we have an existing deck for this player, update it. Otherwise create new.
                const payload = {
                  name: data.name,
                  main: data.main,
                  extra: data.extra,
                  side: data.side,
                  classId: player.classId, // Required for new decks
                  deckId: player.deck?.id
                }
                const res = await axios.post('/api/decks/save', payload)
                const savedId = res.data.id

                // If this is a new deck, or different from current, we might want to reload or link it?
                // For now, just notify success
                const sumQty = (list: any[]) => list.reduce((s,e) => s + e.qty, 0)
                const total = sumQty(data.main) + sumQty(data.extra) + sumQty(data.side)
                setMessage(`Saved deck "${data.name}" (${total} cards)!`)
                // Do not close on save
                // setDeckBuilderOpen(false)
                
                // Refresh KDR data to reflect changes (e.g. name change or if we decide to auto-equip)
                // router.replace(router.asPath) 
              } catch (e: any) {
                const errMsg = e.response?.data?.error || e.response?.data?.message || e.message
                setMessage('Error saving deck: ' + errMsg)
              }
            }}
            initialDeck={[]}
            availableCards={startingDeck.map((c: any) => ({
              id: c.id || `${c.konamiId||''}-${c.name||c.title||''}`,
              name: c.name || c.title || 'Unnamed',
              desc: c.desc || c.description,
              konamiId: c.konamiId,
              atk: c.atk,
              def: c.def,
              level: c.level,
              race: c.race,
              attribute: c.attribute,
              type: c.type,
              imageUrl: c.imageUrl || c.image,
              modifications: c.modifications
            }))}
          />
          {/* Hover tooltip (uses shared HoverTooltip component for consistent UI with shop) */}
          {(() => {
            const playerStats = (player?.shopState && player.shopState.stats) ? player.shopState.stats : (player?.stats || {})
            const hoverTooltip = hoverItem ? { 
              visible: true, 
              cardLike: hoverItem, 
              x: hoverPos.x, 
              y: hoverPos.y, 
              skills: combinedSkills,
              stats: playerStats
            } : { visible: false }

            return (
              <HoverTooltip
                hoverTooltip={hoverTooltip}
                cardDetailsCacheRef={cardDetailsCacheRef}
                tooltipScrollRef={tooltipScrollRef}
              />
            )
          })()}
          {/* Hover popup for skills: reuse HoverTooltip for identical cursor placement */}
          {hoverSkill && (() => {
            const playerStats = (player?.shopState && player.shopState.stats) ? player.shopState.stats : (player?.stats || {})
            const hoverTooltip = hoverSkill ? { 
              visible: true, 
              cardLike: { 
                name: hoverSkill.name || 'Skill', 
                desc: hoverSkill.description || hoverSkill.desc || '',
                statRequirements: hoverSkill.statRequirements
              }, 
              x: hoverSkillPos.x, 
              y: hoverSkillPos.y, 
              skills: [],
              stats: playerStats
            } : { visible: false }

            return (
              <HoverTooltip
                hoverTooltip={hoverTooltip}
                cardDetailsCacheRef={cardDetailsCacheRef}
                tooltipScrollRef={tooltipScrollRef}
              />
            )
          })()}
      </div>
    </div>
  )
}
