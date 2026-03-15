import React, { useState, useEffect } from 'react'
import { Card, LootPool, LootPoolItem, Skill, Tier } from '../../types/class-editor'
import SkillForm from './shared/SkillForm'
import CardDescription from './shared/CardDescription'
import CardPreview from './shared/CardPreview'
import CardImage, { selectArtworkUrl } from '../common/CardImage'

// Stable HoverPreview (module scope) to avoid remounting on parent re-renders
const HoverPreview: React.FC<{ card: any, modification?: any, mousePos: { x: number, y: number }, skills?: any[], onTooltipEnter?: () => void, onTooltipLeave?: () => void }> = React.memo(({ card, modification, mousePos, skills, onTooltipEnter, onTooltipLeave }) => {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = React.useState<{ top: number, left: number }>({ top: 20, left: 20 })

  const updatePos = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth || 320
    const h = el.offsetHeight || 400
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800

    let left = Math.min(Math.max(8, mousePos.x + 20), winW - 8)
    let top = Math.min(Math.max(8, mousePos.y + 20), winH - 8)

    if (left + w > winW) left = Math.max(8, mousePos.x - 20 - w)
    if (top + h > winH) top = Math.max(8, mousePos.y - 20 - h)

    setPos({ left, top })
  }, [mousePos.x, mousePos.y])

  React.useEffect(() => {
    updatePos()
    const onResize = () => updatePos()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [updatePos])

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => updatePos())
    return () => cancelAnimationFrame(raf)
  }, [mousePos.x, mousePos.y, card, modification, updatePos])

  return (
    <div
      ref={ref}
      onMouseEnter={() => onTooltipEnter && onTooltipEnter()}
      onMouseLeave={() => onTooltipLeave && onTooltipLeave()}
      className="fixed z-[70] w-80 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 pointer-events-auto"
      style={{ top: pos.top, left: pos.left }}
    >
      <CardPreview card={{ card, modification }} skills={skills || []} className="w-full h-full" />
    </div>
  )
})

const AspectImage: React.FC<{ card?: any, konamiId?: number | null, src?: string | null, alt?: string, className?: string, clampToCard?: boolean }> = React.memo(({ card, konamiId, src, alt, className, clampToCard }) => {
  const resolved = src ?? selectArtworkUrl(card, konamiId) ?? ''
  // default pad matches a typical card-ish ratio; when clampToCard is true we force a canonical card box
  const DEFAULT_PAD = '100%'
  const [pad, setPad] = React.useState<string>(clampToCard ? DEFAULT_PAD : '35%')
  React.useEffect(() => {
    if (clampToCard) {
      setPad(DEFAULT_PAD)
      return
    }
    let mounted = true
    if (!resolved) return
    const img = new Image()
    img.onload = () => {
      if (!mounted) return
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      if (w && h && w > 1) {
        // clamp pad to reasonable range so extremely tall or wide artworks don't produce odd boxes
        const raw = (h / w) * 100
        const clamped = Math.max(70, Math.min(140, Math.round(raw)))
        setPad(`${clamped}%`)
      }
    }
    img.onerror = () => {
      /* ignore */
    }
    img.src = resolved
    return () => { mounted = false }
  }, [resolved, clampToCard])

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <div style={{ width: '100%' }} className={`aspect-image-wrapper ${className || ''}`}>
      <div style={{ width: '100%', position: 'relative', paddingTop: pad, overflow: 'hidden' }}>
        <img
          src={resolved || ''}
          alt={alt || 'img'}
          className={"absolute top-0 left-0 w-full h-full block " + (clampToCard ? 'object-cover object-top' : 'object-contain')}
        />
      </div>
    </div>
  )
})

interface LootPoolEditorProps {
  pools: LootPool[]
  onChange: (pools: LootPool[]) => void
  tierLabels?: Record<Tier, string>
  send?: (payload: any) => void
  me?: any
  peers?: Record<string, any>
  formatVariant?: string | null
}
export default function LootPoolEditor({ pools, onChange, tierLabels, send, me, peers, formatVariant }: LootPoolEditorProps) {
  const [activeTier, setActiveTier] = useState<Tier>('STARTER')
  const [activePoolId, setActivePoolId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const getTierLabel = (tier: Tier) => {
    if (tierLabels && tierLabels[tier]) return tierLabels[tier]
    return tier === 'STARTER' ? 'Starter Packs' : tier === 'MID' ? 'Mid Quality' : 'High Quality'
  }

  // Helper to update pools
  const setPools = (newPools: LootPool[] | ((prev: LootPool[]) => LootPool[])) => {
    if (typeof newPools === 'function') {
      onChange(newPools(pools))
    } else {
      onChange(newPools)
    }
  }

  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Skill Form State
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [isSkillFormOpen, setIsSkillFormOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Hover Preview
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null)
  const cardCache = React.useRef<Record<string, any>>({})

  const enrichCard = async (c: any) => {
    const key = String(c.id || c.konamiId || c.konami_id || '')
    if (!key) return c
    if (cardCache.current[key]) return { ...c, ...cardCache.current[key] }
    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(key)}`)
      if (!res.ok) return c
      const data = await res.json()
      cardCache.current[key] = data
      return { ...c, ...data }
    } catch (e) {
      return c
    }
  }
  const [pinnedCard, setPinnedCard] = useState<Card | null>(null)
  const [hoverTooltip, setHoverTooltip] = useState<{ card: Card, modification?: any } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const hoverHideTimeout = React.useRef<number | null>(null)

  // Throttle mouse move updates via requestAnimationFrame to avoid excessive re-renders
  const mouseRafRef = React.useRef<number | null>(null)
  const lastMouseRef = React.useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  const handleMouseMove = (e: React.MouseEvent) => {
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
    if (mouseRafRef.current == null) {
      mouseRafRef.current = requestAnimationFrame(() => {
        setMousePos({ x: lastMouseRef.current.x, y: lastMouseRef.current.y })
        if (mouseRafRef.current != null) { cancelAnimationFrame(mouseRafRef.current); mouseRafRef.current = null }
      })
    }
  }

  // Helpers to manage the hover hide timeout so tooltip can stay visible
  const cancelHoverHide = () => {
    if (hoverHideTimeout.current) {
      window.clearTimeout(hoverHideTimeout.current)
      hoverHideTimeout.current = null
    }
  }

  const scheduleHoverHide = (delay = 140) => {
    if (hoverHideTimeout.current) window.clearTimeout(hoverHideTimeout.current)
    hoverHideTimeout.current = window.setTimeout(() => { setHoverTooltip(null); hoverHideTimeout.current = null }, delay)
  }

  const activePool = pools.find(p => p.id === activePoolId)
  const activePoolSkills = activePool ? activePool.items.filter(i => i.type === 'Skill').map(i => i.skill).filter(Boolean) : []

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true)
        try {
          const variantParam = formatVariant ? `&variant=${encodeURIComponent(formatVariant)}` : ''
          const res = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}${variantParam}`)
          const data = await res.json()
          setSearchResults(data)
        } catch (error) {
          console.error('Error searching cards:', error)
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults([])
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, formatVariant])

  const createPool = () => {
    const newPool: LootPool = {
      id: Math.random().toString(36).substr(2, 9),
      name: `New ${getTierLabel(activeTier)} Pool`,
      tier: activeTier,
      items: []
    }
    setPools([...pools, newPool])
    setActivePoolId(newPool.id)
    setIsModalOpen(true)
  }

  const deletePool = (id: string) => {
    setPools(pools.filter(p => p.id !== id))
  }

  const updatePoolName = (name: string) => {
    if (!activePoolId) return
    setPools(pools.map(p => p.id === activePoolId ? { ...p, name } : p))
  }

  const updatePoolTax = (tax: number) => {
    if (!activePoolId) return
    setPools(pools.map(p => p.id === activePoolId ? { ...p, tax } : p))
  }

  const addCardToPool = (card: Card) => {
    if (!activePoolId) return
    const newItem: LootPoolItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Card',
      card: card
    }
    setPools(pools.map(p => {
      if (p.id === activePoolId) {
        if (p.items.some(i => i.card?.id === card.id)) return p
        return { ...p, items: [...p.items, newItem] }
      }
      return p
    }))
    // Keep the search query and results so admin can add multiple cards quickly
  }

  const handleAddSkillClick = () => {
    setEditingSkill(null)
    setEditingItemId(null)
    setIsSkillFormOpen(true)
  }

  const handleEditSkillClick = (item: LootPoolItem) => {
    if (item.type === 'Skill' && item.skill) {
      setEditingSkill(item.skill)
      setEditingItemId(item.id)
      setIsSkillFormOpen(true)
    }
  }

  const handleSaveSkill = (skill: Skill) => {
    if (!activePoolId) return

    if (editingItemId) {
      setPools(pools.map(p => {
        if (p.id === activePoolId) {
          return {
            ...p,
            items: p.items.map(i => i.id === editingItemId ? { ...i, skill: skill } : i)
          }
        }
        return p
      }))
    } else {
      const newItem: LootPoolItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'Skill',
        skill: skill
      }
      setPools(pools.map(p => {
        if (p.id === activePoolId) {
          return { ...p, items: [...p.items, newItem] }
        }
        return p
      }))
    }
    setIsSkillFormOpen(false)
  }

  const removeItem = (itemId: string) => {
    if (!activePoolId) return
    setPools(pools.map(p => {
      if (p.id === activePoolId) {
        return { ...p, items: p.items.filter(i => i.id !== itemId) }
      }
      return p
    }))
  }

  const getModsForCard = (card: Card | null) => {
    if (!card || !activePool) return undefined
    const modsFromSkills = activePool.items
      .filter(i => i.type === 'Skill')
      .flatMap((s: any) => s.skill?.modifications || [])
    const matching = modsFromSkills.filter((m: any) => m.card?.id === card.id)
    return matching.length ? matching : undefined
  }

  const getPoolsContainingCard = (card: Card | null) => {
    if (!card) return []
    return pools.filter(p => p.items.some(i => i.type === 'Card' && i.card?.id === card.id))
  }

  const [inspectPoolsCard, setInspectPoolsCard] = useState<Card | null>(null)

  

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Loot Pools</h2>
      </div>

      {/* Tier Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6 w-fit">
        {(['STARTER', 'MID', 'HIGH'] as Tier[]).map((tier) => (
          <button
            key={tier}
            onClick={() => setActiveTier(tier)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTier === tier 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {getTierLabel(tier)}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
          {getTierLabel(activeTier)}
        </h3>
        <button 
          onClick={createPool}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
        >
          + Create Pool
        </button>
      </div>

      {/* Pool List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.filter(p => p.tier === activeTier).map(pool => (
          <div key={pool.id} className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-800">
            <div className="flex">
                <div className="flex-1 min-h-[56px]">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-800 dark:text-gray-200">{pool.name}</h3>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => { setActivePoolId(pool.id); setIsModalOpen(true) }}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => deletePool(pool.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="relative mb-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {pool.items.length} items ({pool.items.filter(i => i.type === 'Card').length} Cards, {pool.items.filter(i => i.type === 'Skill').length} Skills)
                  </p>
                  {pool.tax !== undefined && pool.tax > 0 && (
                    <div className="absolute top-0 right-0 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">
                      Tax: +{pool.tax}
                    </div>
                  )}
                </div>

                {/* Thumbnails moved below metadata, left-aligned; +N more moved to right */}
                <div className="mt-3 relative">
                  <div className="flex items-center space-x-2 flex-wrap">
                    {pool.items.filter(i => i.type === 'Card').slice(0, 6).map((item) => {
                      const modsFromSkills = pool.items
                        .filter(i => i.type === 'Skill')
                        .flatMap((s: any) => s.skill?.modifications || [])
                      const matchingMod = item.card ? modsFromSkills.find((m: any) => m.card?.id === item.card?.id) : null
                      return (
                        <div
                          key={item.id}
                          className="relative"
                        >
                          <div
                            onMouseEnter={async (e) => {
                              if (!item.card) return
                              // prevent hide action if scheduled
                              cancelHoverHide()
                              setMousePos({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY })
                              try {
                                const full = await enrichCard(item.card)
                                setHoverTooltip({ card: full, modification: matchingMod })
                              } catch (ex) {
                                setHoverTooltip({ card: item.card, modification: matchingMod })
                              }
                            }}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => {
                              // delay hiding slightly to avoid flicker when moving toward the tooltip
                              scheduleHoverHide()
                            }}
                            className="w-12 rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer flex-shrink-0"
                          >
                            {item.card ? (
                              <AspectImage
                                konamiId={item.card.konamiId}
                                card={item.card}
                                src={undefined}
                                alt={item.card.name}
                                className="w-full"
                                clampToCard={true}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No Image</div>
                            )}
                          </div>
                          {matchingMod && (
                            <div className="absolute -bottom-1 left-0 transform translate-y-1 bg-purple-600 text-white text-xs px-1 rounded-tr-md rounded-bl-md">
                              {matchingMod.type === 'NEGATE' ? 'Negate' : matchingMod.type === 'ALTER' ? 'Alter' : 'Condition'}
                            </div>
                          )}
                          {(peers ? Object.values(peers).filter((p:any)=>p.section==='lootPools' && p.poolId===pool.id && p.itemId===item.id) : []).map((p:any,i:number)=> (
                            <div key={i} className="absolute -top-2 -left-2 w-6 h-6 rounded-full overflow-hidden border-2" style={{ background: (p.color || (()=>{let s=(p.user?.email||p.user?.name||''); let h=0; for(let ii=0;ii<s.length;ii++)h=(h*31+s.charCodeAt(ii))%360; return `hsl(${h} 70% 45%)`})()) || '#666' }} title={(p.user && p.user.name) || 'peer'}>
                              {p.user?.image ? <img src={p.user.image} className="w-full h-full object-cover" alt={p.user?.name||'P'} /> : <div className="text-white text-xs font-bold flex items-center justify-center">{((p.user && p.user.name) || '?')[0]}</div>}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                  
                </div>
              </div>

              
            </div>
            {pool.items.filter(i => i.type === 'Card').length > 6 && (
              <div className="absolute bottom-3 right-3 text-sm text-gray-200 dark:text-gray-300 bg-black/20 dark:bg-white/5 px-1 py-0.5 rounded">+{pool.items.filter(i => i.type === 'Card').length - 6}</div>
            )}
          </div>
        ))}
        
        {pools.filter(p => p.tier === activeTier).length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
            No {activeTier.toLowerCase()} pools created yet. Click "Create Pool" to get started.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && activePool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[88vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center space-x-4 flex-1">
                <input 
                  type="text" 
                  value={activePool.name}
                  onChange={(e) => updatePoolName(e.target.value)}
                  className="text-2xl font-bold bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 w-full"
                  placeholder="Pool Name"
                />
                <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-3 py-1 rounded border border-gray-300 dark:border-gray-600">
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">Tax:</label>
                  <input
                    type="number"
                    min="0"
                    value={activePool.tax || 0}
                    onChange={(e) => updatePoolTax(parseInt(e.target.value) || 0)}
                    className="w-16 text-sm border-none focus:ring-0 p-0 text-right font-mono bg-transparent text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 ml-4"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left: Search & Add */}
              <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-900">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-2 mb-4">
                    <button 
                      className={`flex-1 py-2 text-sm font-medium rounded-md bg-blue-600 text-white`}
                    >
                      Add Cards
                    </button>
                    <button 
                      onClick={handleAddSkillClick}
                      className={`flex-1 py-2 text-sm font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700`}
                    >
                      Add Skill
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search cards..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      autoFocus
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {isSearching && <div className="text-center text-gray-500 dark:text-gray-400 py-4">Searching...</div>}
                  
                  <div className="space-y-2">
                    {searchResults.map(card => (
                      <div 
                        key={card.id}
                        className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer flex items-center space-x-3 group"
                        onClick={() => addCardToPool(card)}
                        onMouseEnter={async () => setHoveredCard(await enrichCard(card))}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                                  <AspectImage konamiId={card.konamiId} card={card} src={undefined} alt={card.name} className="w-full" clampToCard={true} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 dark:text-white">{card.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{card.type}</div>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 text-blue-600 dark:text-blue-400 font-bold px-2">
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle: Pool Content */}
              <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                  <h3 className="font-bold text-gray-700 dark:text-gray-200">Pool Contents</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{activePool.items.length} Items</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  {activePool.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                      <p>This pool is empty.</p>
                      <p className="text-sm">Add cards or skills from the left panel.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Cards Section */}
                      {activePool.items.some(i => i.type === 'Card') && (
                        <div className="col-span-full">
                          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Cards</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activePool.items.filter(i => i.type === 'Card').map(item => (
                              <div
                                key={item.id}
                                onMouseEnter={async () => item.card && setHoveredCard(await enrichCard(item.card))}
                                onMouseLeave={() => setHoveredCard(null)}
                                className="relative flex flex-col items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-sm group hover:bg-gray-50 dark:hover:bg-gray-900/40 hover:border-blue-300 dark:hover:border-blue-600 transition-colors hover:shadow-md cursor-pointer"
                              >
                                <button 
                                  onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
                                  className="absolute top-2 right-2 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ✕
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPinnedCard(item.card || null) }}
                                  title="Pin preview"
                                  className="absolute top-2 left-2 text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  📌
                                </button>
                                {item.card && getPoolsContainingCard(item.card).length > 1 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setInspectPoolsCard(item.card!) }}
                                    title={`In ${getPoolsContainingCard(item.card).length} pools`}
                                    aria-label={`Show ${getPoolsContainingCard(item.card).length} pools containing this card`}
                                    role="button"
                                    className="absolute top-2 right-10 bg-yellow-600 text-white text-xs px-1 py-0.5 rounded opacity-95 z-10 hover:bg-yellow-500 hover:scale-110 transform transition-transform duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                  >
                                    ⚠
                                  </button>
                                )}
                                <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 cursor-help">
                                  {item.card && (
                                      <AspectImage konamiId={item.card.konamiId} card={item.card} src={undefined} alt={item.card.name} className="w-full" />
                                    )}
                                </div>
                                <div className="mt-2 text-center">
                                  <div className="font-medium text-sm text-gray-900 dark:text-white">{item.card?.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.card?.type}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Skills Section */}
                      {activePool.items.some(i => i.type === 'Skill') && (
                        <div className="col-span-full mt-4">
                          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Skills</h4>
                          <div className="space-y-3">
                            {activePool.items.filter(i => i.type === 'Skill').map(item => (
                              <div key={item.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 relative group hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                                <div className="font-bold text-blue-900 dark:text-blue-100 text-sm">{item.skill?.name}</div>
                                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 whitespace-pre-wrap">{item.skill?.description}</div>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                  <button 
                                    onClick={() => handleEditSkillClick(item)}
                                    className="text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                                  >
                                    ✎
                                  </button>
                                  <button 
                                    onClick={() => removeItem(item.id)}
                                    className="text-blue-300 hover:text-red-600 dark:text-blue-500 dark:hover:text-red-400 p-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Preview */}
              <div className="w-80 bg-gray-100 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center min-h-0"
                onMouseEnter={() => { /* keep preview visible while interacting */ }}
                onMouseLeave={() => { /* noop; pinnedCard preserves preview */ }}
              >
                <div className="w-full flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Card Preview</h3>
                  {pinnedCard && (
                    <button onClick={() => setPinnedCard(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white px-2 py-1 rounded bg-gray-50 dark:bg-gray-800">Unpin ✕</button>
                  )}
                </div>
                {inspectPoolsCard ? (
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-bold text-lg text-gray-900 dark:text-white">Pools containing "{inspectPoolsCard.name}"</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Click a pool to open it in the editor</div>
                      </div>
                      <div>
                        <button onClick={() => setInspectPoolsCard(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white px-2 py-1 rounded">Back</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {getPoolsContainingCard(inspectPoolsCard).map(p => (
                        <div key={p.id} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-900/40 cursor-pointer" onClick={() => { setActivePoolId(p.id); setIsModalOpen(true); setInspectPoolsCard(null) }}>
                          <div className="font-medium text-sm text-gray-900 dark:text-white">{p.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{p.items.length} items</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : pinnedCard || hoveredCard ? (
                  <div className="w-full flex-1 flex flex-col min-h-0">
                    <CardPreview card={(pinnedCard || hoveredCard)!} skills={activePoolSkills} className="w-full h-full" />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-center text-sm">
                    Hover over a card to see details (or click a card to pin)
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Skill Form Modal */}
      <SkillForm
        isOpen={isSkillFormOpen}
        onClose={() => setIsSkillFormOpen(false)}
        onSave={handleSaveSkill}
        initialSkill={editingSkill}
        formatVariant={formatVariant}
      />
      {/* Tooltip like SkillForm (moved outside modal so it works anywhere) */}
      {hoverTooltip && (
        <HoverPreview card={hoverTooltip.card} modification={hoverTooltip.modification} skills={activePoolSkills} mousePos={mousePos} />
      )}
    </div>
  )
}
