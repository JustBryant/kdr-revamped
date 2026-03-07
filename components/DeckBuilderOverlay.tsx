import React, { useEffect, useMemo, useRef, useState } from 'react'
import CardImage, { selectArtworkUrl } from './common/CardImage'
import LocalIcon from './LocalIcon'
import DeckFiltersPanel from './DeckFiltersPanel'
import CardDescription from './class-editor/shared/CardDescription'
import { normalizeCard } from '../lib/card-utils'

export type CardItem = {
  id: string
  name: string
  desc?: string
  konamiId?: number
  imageUrl?: string
  modifications?: any[]
}

type DeckEntry = { card: CardItem; qty: number }

type DeckItem = { uniqueId: string; card: CardItem }

export type SavedDeckData = {
  name: string
  main: DeckEntry[]
  extra: DeckEntry[]
  side: DeckEntry[]
}

type DeckType = 'main' | 'extra' | 'side'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (data: SavedDeckData) => void
  initialDeck?: DeckEntry[]
  initialMain?: DeckEntry[]
  initialExtra?: DeckEntry[]
  initialSide?: DeckEntry[]
  initialDeckName?: string
  availableCards?: CardItem[]
  fetchCards?: (q: string) => Promise<CardItem[]>
}

export default function DeckBuilderOverlay({ open, onClose, onSave, initialDeck = [], initialMain=[], initialExtra=[], initialSide=[], initialDeckName = '', availableCards = [], fetchCards }: Props) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CardItem[]>(availableCards || [])
  const [mainType, setMainType] = useState<'Any'|'Monster'|'Spell'|'Trap'>('Any')
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [deckName, setDeckName] = useState(initialDeckName)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [userDecks, setUserDecks] = useState<any[]>([])
  const [loadingDecks, setLoadingDecks] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null)

  const loadUserDecks = async () => {
    setLoadingDecks(true)
    try {
        const res = await fetch('/api/decks/list').then(r => r.json())
        if (Array.isArray(res)) setUserDecks(res)
    } catch (e) {
        console.error(e)
    } finally {
        setLoadingDecks(false)
    }
  }

  useEffect(() => {
    if (showLoadModal) loadUserDecks()
  }, [showLoadModal])

  const loadDeck = async (id: string, name: string) => {
     // Fetch full deck
     try {
        const res = await fetch(`/api/decks/${id}`).then(r => r.json())
        // Clear
        setMainDeck([])
        setExtraDeck([])
        setSideDeck([])
        
        // Parse
        const main: DeckItem[] = []
        const extra: DeckItem[] = []
        const side: DeckItem[] = []
        
        attemptedEnrichment.current.clear()

        if (res.cards) {
            const flatten = (card: CardItem, qty: number) => {
                for(let i=0; i<qty; i++) {
                    const nc = normalizeCard(card)
                    const item = { uniqueId: generateId(), card: nc }
                   return item
                }
            }
            res.cards.forEach((dc: any) => {
                 const nc = normalizeCard(dc.card)
                 for(let i=0; i<dc.quantity; i++) {
                     const item = { uniqueId: generateId(), card: nc }
                     if (dc.location === 'EXTRA') extra.push(item)
                     else if (dc.location === 'SIDE') side.push(item)
                     else main.push(item)
                 }
            })
        }
        setMainDeck(main)
        setExtraDeck(extra)
        setSideDeck(side)
        setDeckName(name || res.name)
        setShowLoadModal(false)
     } catch(e) {
         console.error("Failed to load deck", e)
         alert("Failed to load deck")
     }
  }
  
  const deleteDeck = async (e: React.MouseEvent, id: string, name: string) => {
      e.stopPropagation()
      setDeleteTarget({ id, name })
  }

  const confirmDelete = async () => {
      if (!deleteTarget) return
      
      try {
          const res = await fetch(`/api/decks/${deleteTarget.id}`, { method: 'DELETE' })
          if (res.ok) {
              await loadUserDecks() // refresh list
              setDeleteTarget(null)
          } else {
              const data = await res.json()
              alert(data.message || 'Failed to delete deck')
          }
      } catch (err) {
          console.error(err)
          alert('Error deleting deck')
      }
  }

  // Sync deckName
  useEffect(() => { setDeckName(initialDeckName) }, [initialDeckName])
  
  // Internal State: flattened list of unique items for easier DND reordering
  const [mainDeck, setMainDeck] = useState<DeckItem[]>([])
  const [extraDeck, setExtraDeck] = useState<DeckItem[]>([])
  const [sideDeck, setSideDeck] = useState<DeckItem[]>([])
  
  const [loading, setLoading] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null)
  const [activeTab, setActiveTab] = useState<'main' | 'extra' | 'side'>('main')
  const attemptedEnrichment = useRef<Set<string>>(new Set())

  const generateId = () => Math.random().toString(36).substring(2, 9)

  useEffect(() => { 
    const flatten = (entries: DeckEntry[]) => 
      entries.flatMap(e => Array.from({length: e.qty}).map(() => ({ uniqueId: generateId(), card: e.card })))
    
    // Support legacy initialDeck (treat as Main) or new explicit props
    if (initialMain.length > 0 || initialExtra.length > 0 || initialSide.length > 0) {
        setMainDeck(flatten(initialMain))
        setExtraDeck(flatten(initialExtra))
        setSideDeck(flatten(initialSide))
    } else if (initialDeck.length > 0) {
        setMainDeck(flatten(initialDeck)) 
        setExtraDeck([]) 
        setSideDeck([]) 
    }
  }, [initialDeck, initialMain, initialExtra, initialSide])
  

  const sortCards = (cards: any[]) => {
      return cards.sort((a, b) => {
          const getPriority = (c: any) => {
              const t = (c.type || c.cardType || '').toLowerCase()
              if (t.includes('spell')) return 8
              if (t.includes('trap')) return 9
              
              if (t.includes('link')) return 7
              if (t.includes('xyz')) return 6
              if (t.includes('synchro')) return 5
              if (t.includes('fusion')) return 4
              
              if (t.includes('ritual')) return 3
              if (t.includes('normal')) return 1
              
              // Default to Effect (2) for everything else (Effect, Tuner, Toon, Spirit, etc)
              return 2
          }
          const pa = getPriority(a)
          const pb = getPriority(b)
          if (pa !== pb) return pa - pb
          return (a.name || '').localeCompare(b.name || '')
      })
  }

  useEffect(() => { 
    setSearchResults(sortCards((availableCards || []).map(normalizeCard)))
    attemptedEnrichment.current.clear()
  }, [availableCards])

  useEffect(() => {
    let mounted = true
    const doSearch = async () => {
      if (fetchCards) {
        try {
          setLoading(true)
          const res = await fetchCards(query)
          if (!mounted) return
          setSearchResults(sortCards((res || []).map(normalizeCard)))
        } catch (e) {
          // ignore
        } finally { setLoading(false) }
      } else {
        const q = query.trim().toLowerCase()
        const mapped = (availableCards || []).map(normalizeCard)
        const filtered = mapped.filter(c => !q || (c.name || '').toLowerCase().includes(q) || (c.desc || c.description || '').toLowerCase().includes(q))
        setSearchResults(sortCards(filtered))
      }
    }
    doSearch()
    return () => { mounted = false }
  }, [query, fetchCards, availableCards])

  // Debug: print first few normalized search results to help diagnose missing fields
  // useEffect(() => {
  //   try {
  //     if ((searchResults || []).length > 0) {
  //       // print a concise summary
  //       // console.debug('DeckBuilder normalized sample:', (searchResults || []).slice(0, 6).map((s: any) => ({ id: s.id, name: s.name, attribute: s.attribute, type: s.type, race: s.race, atk: s.atk, def: s.def })))
  //     }
  //   } catch (e) { /* ignore */ }
  // }, [searchResults])

  // Enrich partial card objects by querying the cards search API when important fields are missing
  useEffect(() => {
    if (!open) return
    let mounted = true
    const needsEnrich = (c: any) => {
      // If attribute or race or type is missing, we try to fetch fuller data
      return (!c.attribute || String(c.attribute).trim() === '') || (!c.race || String(c.race).trim() === '') || (!c.type || String(c.type).trim() === '')
    }

    const candidates = Array.isArray(searchResults) ? searchResults : []
    const toEnrich = candidates.filter((c:any) => c && c.id && needsEnrich(c) && (c.konamiId || c.name) && !attemptedEnrichment.current.has(c.id))
    
    if (!toEnrich || toEnrich.length === 0) return

    // Mark as attempted immediately to prevent loop
    toEnrich.forEach(c => attemptedEnrichment.current.add(c.id));

    (async () => {
      try {
        const enrichedPromises = toEnrich.map(async (c: any) => {
          const q = encodeURIComponent(c.name || String(c.konamiId || ''))
          try {
            const resp = await fetch(`/api/cards/search?q=${q}`)
            if (!resp.ok) return null
            const items = await resp.json()
            if (!Array.isArray(items) || items.length === 0) return null
            // prefer exact konamiId match, then exact name, then first
            let found = null
            if (c.konamiId) found = items.find((i: any) => Number(i.konamiId) === Number(c.konamiId))
            if (!found) found = items.find((i: any) => (i.name || '').toString().toLowerCase() === (c.name || '').toString().toLowerCase())
            if (!found) found = items[0]
            return found ? normalizeCard(found) : null
          } catch (e) { return null }
        })

        const results = await Promise.all(enrichedPromises)
        if (!mounted) return
        // Merge enriched fields back into searchResults
        setSearchResults((prev: any[]) => {
          if (!prev) return prev
          const byId = new Map(prev.map(p => [p.id, p]))
          let changed = false
          results.forEach((en: any) => {
            if (!en) return
            const existing = byId.get(en.id) || Array.from(byId.values()).find(v => (v.konamiId && en.konamiId && Number(v.konamiId) === Number(en.konamiId)))
            if (existing) {
              const merged = { ...existing, ...en }
              // Only update if we actually gained new info
              if (merged.attribute !== existing.attribute || merged.race !== existing.race || merged.type !== existing.type) {
                 byId.set(merged.id, merged)
                 changed = true
              }
            } else {
              // This case shouldn't happen often as we are enriching existing cards
            }
          })
          return changed ? Array.from(byId.values()) : prev
        })
      } catch (e) {
        // ignore
      }
    })()

    return () => { mounted = false }
  }, [searchResults])

  const MAIN_TYPES = ['Any','Monster','Spell','Trap'] as const
  const SUBTYPES: Record<string,string[]> = {
    Monster: ['Normal','Effect','Fusion','Ritual','Synchro','Xyz','Link'],
    Spell: ['Normal','Equip','Ritual','Continuous','Quick-Play','Field'],
    Trap: ['Normal','Continuous','Counter']
  }

  const TYPES = [
    'Spellcaster','Dragon','Zombie','Warrior','Beast-Warrior','Beast','Winged Beast','Machine',
    'Fiend','Fairy','Insect','Dinosaur','Reptile','Fish','Sea Serpent','Aqua',
    'Pyro','Thunder','Rock','Plant','Psychic','Wyrm','Cyberse','Divine-Beast','Illusion'
  ]

  const toggleSubtype = (s: string) => setSelectedSubtypes(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev,s])

  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const toggleType = (t: string) => setSelectedTypes(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t])
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([])
  const toggleAttribute = (a: string) => setSelectedAttributes(prev => prev.includes(a) ? prev.filter(x=>x!==a) : [...prev, a])
  const [selectedLevels, setSelectedLevels] = useState<number[]>([])
  const toggleLevel = (lv: number) => setSelectedLevels(prev => prev.includes(lv) ? prev.filter(x=>x!==lv) : [...prev, lv])
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])
  const toggleAbility = (ab: string) => setSelectedAbilities(prev => prev.includes(ab) ? prev.filter(x=>x!==ab) : [...prev, ab])

  // Pendulum Scale
  const [selectedPendulumScales, setSelectedPendulumScales] = useState<number[]>([])
  const togglePendulumScale = (n: number) => setSelectedPendulumScales(prev => prev.includes(n) ? prev.filter(x=>x!==n) : [...prev, n])

  const getSubtypesForMain = (mt: string) => {
    if (mt === 'Any') return Array.from(new Set(Object.values(SUBTYPES).flat()))
    return SUBTYPES[mt] || []
  }
  const detectMainType = (c: any) => {
    const token = ((c.cardType || c.type || c.categories || '')).toString().toLowerCase()
    // Match whole-word 'spell' and 'trap' or explicit 'spell card' / 'trap card'
    if (/\bspell\b/.test(token) || token.includes('spell card')) return 'Spell'
    if (/\btrap\b/.test(token) || token.includes('trap card')) return 'Trap'
    return 'Monster'
  }

  const cardHasSubtype = (c: any, subtype: string) => {
    const s = (subtype || '').toString().toLowerCase()
    const mt = detectMainType(c)

    // If the subtype explicitly refers to the frame (e.g., 'Spell' or 'Trap'), require the frame
    if (s === 'spell' || s === 'trap') return mt === (s === 'spell' ? 'Spell' : 'Trap')

    // If subtype includes a category like 'Spell:Normal' or 'Trap:Normal', ensure frame matches first
    if (s.includes(':')) {
      const [cat, sub] = s.split(':')
      if (cat && cat.toLowerCase() === 'spell' && mt !== 'Spell') return false
      if (cat && cat.toLowerCase() === 'trap' && mt !== 'Trap') return false
      const t = ((c.type || '') + ' ' + (c.subtype || '') + ' ' + (c.cardType || '') + ' ' + (c.race || '')).toString().toLowerCase()
      return t.includes((sub || '').toLowerCase().replace('quick-play','quick'))
    }

    // Plain 'Normal' should be Monster-only (card frame 'Normal' refers to Normal Monster)
    if (s === 'normal') {
      if (mt !== 'Monster') return false
      const t = ((c.type || '') + ' ' + (c.subtype || '') + ' ' + (c.cardType || '') + ' ' + (c.race || '')).toString().toLowerCase()
      // Require explicit 'normal' token on the monster frame. Do not infer Normal by absence.
      return /\bnormal\b/.test(t)
    }

    // For monster-specific subtypes, ensure card is a Monster frame
    const monsterTokens = (SUBTYPES['Monster'] || []).map(x => x.toLowerCase())
    if (monsterTokens.includes(s) && mt !== 'Monster') return false

    // Fallback: substring match across type/subtype/cardType/race
    const t = ((c.type || '') + ' ' + (c.subtype || '') + ' ' + (c.cardType || '') + ' ' + (c.race || '')).toString().toLowerCase()
    return t.includes(s.replace('quick-play','quick'))
  }

  const isExtraDeckCard = (c: any) => {
    if (detectMainType(c) !== 'Monster') return false
    return ['Fusion', 'Synchro', 'Xyz', 'Link'].some(type => cardHasSubtype(c, type))
  }

  const cardHasType = (c: any, type: string) => {
    // Check both race and type fields to ensure we catch the monster type (e.g. Zombie) even if type is 'Effect Monster'
    const raw = ((c.race || '') + ' ' + (c.type || '') + ' ' + (c.cardType || '') + ' ' + (c.categories || '')).toString()
    const normalizeToken = (s: string) => s.toString().toLowerCase().replace(/[^a-z0-9]/g, '')
    const cardTok = normalizeToken(raw)
    const selTok = normalizeToken(type)
    return cardTok.includes(selTok)
  }

  const getMonsterSubtypes = (c: any) => {
    if (detectMainType(c) !== 'Monster') return ''
    
    const subtypes = [
      'Fusion', 'Synchro', 'Xyz', 'Link', 'Ritual', 'Pendulum', 
      'Toon', 'Spirit', 'Union', 'Gemini', 'Flip', 'Tuner', 'Effect', 'Normal'
    ]
    
    // Check normal explicitly if needed, but usually data has it
    // If no effects, and no other special types, it's Normal?
    // Let's stick to what cardHasSubtype says or data
    
    let found = subtypes.filter(s => cardHasSubtype(c, s))
    
    // Cleanup: If 'Effect' is present, 'Normal' should not be, usually.
    if (found.includes('Effect')) found = found.filter(f => f !== 'Normal')
      
    return found.join(' / ')
  }

  const getCardTypeLabel = (c: any) => {
    const main = detectMainType(c)
    if (main === 'Monster') return c.race || 'Monster'
    // Spell/Trap
    const r = c.race || 'Normal'
    return `${r} ${main}`
  }

  const cardHasLevel = (c: any, lv: number) => {
    const v = c.level ?? c.rank ?? null
    if (v == null) return false
    const n = parseInt(String(v), 10)
    return !Number.isNaN(n) && n === lv
  }

  // Link Rating / Link Arrows
  const [selectedLinkRatings, setSelectedLinkRatings] = useState<number[]>([])
  const toggleLinkRating = (n: number) => setSelectedLinkRatings(prev => prev.includes(n) ? prev.filter(x=>x!==n) : [...prev, n])

  const ARROWS = ['NW','N','NE','W','E','SW','S','SE']
  const [selectedLinkArrows, setSelectedLinkArrows] = useState<string[]>([])
  const [linkArrowsMode, setLinkArrowsMode] = useState<'AND'|'OR'>('AND')
  const toggleLinkArrow = (d: string) => setSelectedLinkArrows(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d])
  const [hoveredLinkArrow, setHoveredLinkArrow] = useState<string | null>(null)

  // Dragging State for Ghost
  const [draggingCard, setDraggingCard] = useState<CardItem | null>(null)
  const [dragTarget, setDragTarget] = useState<'main' | 'extra' | 'side' | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [draggingUniqueId, setDraggingUniqueId] = useState<string | null>(null)

  // ATK filter (min / max). Slider increments 100 up to 5000.
  const [atkMin, setAtkMin] = useState<number>(0)
  const [atkMax, setAtkMax] = useState<number>(5000)
  const setAtkMinFromInput = (s: string) => {
    if (!s || s.trim() === '') { setAtkMin(0); return }
    const n = Math.max(0, Math.min(5000, Math.round(parseInt(s || '0', 10) / 100) * 100))
    setAtkMin(Math.min(n, atkMax))
  }
  const setAtkMaxFromInput = (s: string) => {
    if (!s || s.trim() === '') { setAtkMax(5000); return }
    const n = Math.max(0, Math.min(5000, Math.round(parseInt(s || '0', 10) / 100) * 100))
    setAtkMax(Math.max(n, atkMin))
  }

  // Slider refs & drag handling for custom two-thumb slider
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef<'min'|'max'|null>(null)

  const clientXFromEvent = (e: MouseEvent | TouchEvent) => {
    if ((e as TouchEvent).touches && (e as TouchEvent).touches.length) return (e as TouchEvent).touches[0].clientX
    if ((e as TouchEvent).changedTouches && (e as TouchEvent).changedTouches.length) return (e as TouchEvent).changedTouches[0].clientX
    return (e as MouseEvent).clientX
  }

  const onDragMove = (e: MouseEvent | TouchEvent) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const clientX = clientXFromEvent(e)
    if (clientX == null) return
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = Math.round((pct * 5000) / 100) * 100
    if (draggingRef.current === 'min') {
      const val = Math.min(raw, atkMax)
      setAtkMin(val)
    } else if (draggingRef.current === 'max') {
      const val = Math.max(raw, atkMin)
      setAtkMax(val)
    }
  }

  const endDrag = () => {
    draggingRef.current = null
    window.removeEventListener('mousemove', onDragMove as any)
    window.removeEventListener('mouseup', endDrag)
    window.removeEventListener('touchmove', onDragMove as any)
    window.removeEventListener('touchend', endDrag)
  }

  const startDrag = (handle: 'min'|'max') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = handle
    window.addEventListener('mousemove', onDragMove as any)
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('touchmove', onDragMove as any, { passive: false } as any)
    window.addEventListener('touchend', endDrag)
  }

  useEffect(() => {
    return () => { endDrag() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // DEF filter (min / max). Slider increments 100 up to 5000.
  const [defMin, setDefMin] = useState<number>(0)
  const [defMax, setDefMax] = useState<number>(5000)
  const setDefMinFromInput = (s: string) => {
    if (!s || s.trim() === '') { setDefMin(0); return }
    const n = Math.max(0, Math.min(5000, Math.round(parseInt(s || '0', 10) / 100) * 100))
    setDefMin(Math.min(n, defMax))
  }
  const setDefMaxFromInput = (s: string) => {
    if (!s || s.trim() === '') { setDefMax(5000); return }
    const n = Math.max(0, Math.min(5000, Math.round(parseInt(s || '0', 10) / 100) * 100))
    setDefMax(Math.max(n, defMin))
  }

  // Slider refs & drag handling for DEF slider (separate from ATK)
  const defSliderRef = useRef<HTMLDivElement | null>(null)
  const defDraggingRef = useRef<'min'|'max'|null>(null)

  const defOnDragMove = (e: MouseEvent | TouchEvent) => {
    if (!defSliderRef.current) return
    const rect = defSliderRef.current.getBoundingClientRect()
    const clientX = clientXFromEvent(e)
    if (clientX == null) return
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = Math.round((pct * 5000) / 100) * 100
    if (defDraggingRef.current === 'min') {
      const val = Math.min(raw, defMax)
      setDefMin(val)
    } else if (defDraggingRef.current === 'max') {
      const val = Math.max(raw, defMin)
      setDefMax(val)
    }
  }

  const defEndDrag = () => {
    defDraggingRef.current = null
    window.removeEventListener('mousemove', defOnDragMove as any)
    window.removeEventListener('mouseup', defEndDrag)
    window.removeEventListener('touchmove', defOnDragMove as any)
    window.removeEventListener('touchend', defEndDrag)
  }

  const defStartDrag = (handle: 'min'|'max') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    defDraggingRef.current = handle
    window.addEventListener('mousemove', defOnDragMove as any)
    window.addEventListener('mouseup', defEndDrag)
    window.addEventListener('touchmove', defOnDragMove as any, { passive: false } as any)
    window.addEventListener('touchend', defEndDrag)
  }

  useEffect(() => {
    return () => { defEndDrag() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cardHasLinkRating = (c: any, n: number) => {
    const v = c.linkRating ?? c.link ?? c.linkval ?? null
    if (v == null) return false
    const num = parseInt(String(v), 10)
    return !Number.isNaN(num) && num === n
  }

  const cardHasLinkArrow = (c: any, dir: string) => {
    let arr = (c.linkArrows || c.arrows || c.link || '').toString().toLowerCase()
    // Normalize verbose directions to short codes (order matters: compound first)
    arr = arr.replace(/top[\s-]*left/g, 'nw').replace(/top[\s-]*right/g, 'ne')
    arr = arr.replace(/bottom[\s-]*left/g, 'sw').replace(/bottom[\s-]*right/g, 'se')
    arr = arr.replace(/top/g, 'n').replace(/bottom/g, 's').replace(/left/g, 'w').replace(/right/g, 'e')
    // Normalize short codes if they are standalone
    arr = arr.replace(/\btl\b/g, 'nw').replace(/\btr\b/g, 'ne').replace(/\bbl\b/g, 'sw').replace(/\bbr\b/g, 'se')
    
    const tokens = arr.split(/[^a-z0-9]+/)
    const map: Record<string,string> = { NW: 'nw', N: 'n', NE: 'ne', W: 'w', E: 'e', SW: 'sw', S: 's', SE: 'se' }
    const key = map[dir as keyof typeof map] || dir.toLowerCase()
    return tokens.includes(key)
  }

  const cardHasAbility = (c: any, ability: string) => {
    const txt = ((c.abilities || c.categories || c.type || c.desc || c.description || '')).toString().toLowerCase()
    return txt.includes(ability.toLowerCase().replace(' ', '-')) || txt.includes(ability.toLowerCase())
  }

  const filteredResults = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    const base = searchResults || []
    return base.filter((c:any) => {
      // name/desc match already handled by searchResults generation; still guard
      if (q) {
        const name = (c.name||'').toString().toLowerCase()
        const desc = (c.desc||c.description||'').toString().toLowerCase()
        if (!name.includes(q) && !desc.includes(q)) return false
      }
      const mt = detectMainType(c)
      if (mainType !== 'Any' && mt !== mainType) return false
      if (selectedSubtypes.length > 0) {
        // require at least one selected subtype to match
        if (!selectedSubtypes.some(st => cardHasSubtype(c, st))) return false
      }
      if (selectedTypes.length > 0) {
        // require at least one selected type to match
        if (!selectedTypes.some(t => cardHasType(c, t))) return false
      }
      if (selectedAttributes.length > 0) {
        const attr = (c.attribute || '').toString().trim().toUpperCase()
        if (!selectedAttributes.some(a => (a || '').toString().trim().toUpperCase() === attr)) return false
      }
      if (selectedLevels.length > 0) {
        if (!selectedLevels.some(lv => cardHasLevel(c, lv))) return false
      }
      if (selectedLinkRatings.length > 0) {
        if (!selectedLinkRatings.some(r => cardHasLinkRating(c, r))) return false
      }
      if (selectedLinkArrows.length > 0) {
        if (linkArrowsMode === 'AND') {
          // all selected arrows must be present
          if (!selectedLinkArrows.every(a => cardHasLinkArrow(c, a))) return false
        } else {
          // any selected arrow
          if (!selectedLinkArrows.some(a => cardHasLinkArrow(c, a))) return false
        }
      }
      if (selectedAbilities.length > 0) {
        if (!selectedAbilities.some(a => cardHasAbility(c, a))) return false
      }
      // ATK filtering: only apply when user moves either notch off the extremes
      if (atkMin > 0 || atkMax < 5000) {
        const v = c.atk ?? c.atkValue ?? null
        if (v == null) return false
        const n = parseInt(String(v), 10)
        if (Number.isNaN(n)) return false
        if (n < atkMin || n > atkMax) return false
      }

      // DEF filtering: mirror ATK behavior
      if (defMin > 0 || defMax < 5000) {
        const v = c.def ?? c.defValue ?? null
        if (v == null) return false
        const n = parseInt(String(v), 10)
        if (Number.isNaN(n)) return false
        if (n < defMin || n > defMax) return false
      }
      return true
    })
  }, [searchResults, query, mainType, selectedSubtypes, selectedTypes, selectedLevels, selectedLinkRatings, selectedLinkArrows, linkArrowsMode, atkMin, atkMax, defMin, defMax, selectedAbilities])

  // dark detection
  useEffect(() => {
    try {
      const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
      const getPrefers = () => !!(mq && mq.matches)
      const getByClass = () => document?.documentElement?.classList?.contains('dark') || false
      const update = () => setIsDark(getPrefers() || getByClass())
      update()
      if (mq && mq.addEventListener) mq.addEventListener('change', update)
      else if (mq && mq.addListener) mq.addListener(update)
      const obs = new MutationObserver(() => update())
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => { if (mq && mq.removeEventListener) mq.removeEventListener('change', update); else if (mq && mq.removeListener) mq.removeListener(update); obs.disconnect() }
    } catch (e) { setIsDark(false) }
  }, [])

  const countCopies = (deck: DeckItem[], cardId: string) => deck.filter(e => e.card.id === cardId).length

  // Helper to re-group for saving
  const exportEnds = (arr: DeckItem[]) => {
      const map = new Map<string, { card: CardItem; qty: number }>()
      for (const item of arr) {
          if (map.has(item.card.id)) {
              map.get(item.card.id)!.qty++
          } else {
              map.set(item.card.id, { card: item.card, qty: 1 })
          }
      }
      return Array.from(map.values())
  }

  const getDeckCount = (deck: DeckItem[]) => deck.length
  const MAX_MAIN = 60
  const MAX_EXTRA = 15
  const MAX_SIDE = 15
  const MAX_COPIES = 3

  const addCardTo = (card: CardItem, to: DeckType = 'main', index?: number, isMove: boolean = false) => {
    setSelectedCard(card)
    // Validate Deck Type
    const isExtra = isExtraDeckCard(card)
    if (to === 'main' && isExtra) return
    if (to === 'extra' && !isExtra) return

    // Check limits
    if (to === 'main' && mainDeck.length >= MAX_MAIN) return
    if (to === 'extra' && extraDeck.length >= MAX_EXTRA) return
    if (to === 'side' && sideDeck.length >= MAX_SIDE) return
    
    // Check copy limit
    const currentCopies = countCopies(mainDeck, card.id) + countCopies(extraDeck, card.id) + countCopies(sideDeck, card.id)
    if (!isMove && currentCopies >= MAX_COPIES) return

    // Create new item
    const newItem: DeckItem = { uniqueId: generateId(), card }
    
    const updater = (prev: DeckItem[]) => {
        if (typeof index === 'number' && index >= 0 && index <= prev.length) {
            const next = [...prev]
            next.splice(index, 0, newItem)
            return next
        }
        return [...prev, newItem]
    }

    if (to === 'main') setMainDeck(updater)
    else if (to === 'extra') setExtraDeck(updater)
    else setSideDeck(updater)
  }

  const removeUnique = (uniqueId: string, from: DeckType) => {
      const filter = (d: DeckItem[]) => d.filter(x => x.uniqueId !== uniqueId)
      if (from === 'main') setMainDeck(filter)
      if (from === 'extra') setExtraDeck(filter)
      if (from === 'side') setSideDeck(filter)
  }

  // Legacy behavior: remove one copy of cardId
  const decOn = (cardId: string, on: DeckType = 'main') => {
      const updater = (prev: DeckItem[]) => {
          const idx = prev.findIndex(x => x.card.id === cardId)
          if (idx === -1) return prev
          return prev.filter((_, i) => i !== idx)
      }
      if (on === 'main') setMainDeck(updater)
      else if (on === 'extra') setExtraDeck(updater)
      else setSideDeck(updater)
  }
  
  const incOn = (cardId: string, on: DeckType = 'main') => {
      // Find card object
      const all = [...mainDeck, ...extraDeck, ...sideDeck]
      const card = all.find(x => x.card.id === cardId)?.card || searchResults.find(c => c.id === cardId)
      if (card) addCardTo(card, on)
  }

  if (!open) return null

  const imgArt = (c: CardItem) => selectArtworkUrl(c) || ''
  const imgFull = (c: CardItem) => selectArtworkUrl(c) || ''

  const handleDragStart = (e: React.DragEvent, card: CardItem, from: 'search' | 'main' | 'extra' | 'side', uniqueId?: string) => {
    setDraggingCard(card)
    setDraggingUniqueId(uniqueId || null)
    e.dataTransfer.setData('application/json', JSON.stringify({ cardId: card.id, from, uniqueId }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetDeck: 'main' | 'extra' | 'side') => {
    e.preventDefault()
    const targetIdx = dropIndex
    
    setDraggingCard(null)
    setDragTarget(null)
    setDropIndex(null)
    setDraggingUniqueId(null)

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (!data || !data.cardId) return

      const { cardId, from, uniqueId } = data

      // Check capacity of target
      const limit = targetDeck === 'main' ? MAX_MAIN : (targetDeck === 'extra' ? MAX_EXTRA : MAX_SIDE)
      const currentDeckArr = targetDeck === 'main' ? mainDeck : (targetDeck === 'extra' ? extraDeck : sideDeck)
      
      // If moving within same deck, count doesn't change
      if (from !== targetDeck && currentDeckArr.length >= limit) return
      
      // Find the card object
      let card: CardItem | undefined
      if (from === 'search') {
        const found = searchResults.find(c => c.id === cardId)
        if (found) card = found
      } else {
        const sourceDeckArr = from === 'main' ? mainDeck : from === 'extra' ? extraDeck : sideDeck
        if (uniqueId) card = sourceDeckArr.find((x: DeckItem) => x.uniqueId === uniqueId)?.card
        if (!card) card = sourceDeckArr.find((x: DeckItem) => x.card.id === cardId)?.card
      }

      if (!card) return

      if (from === targetDeck) {
        // Reordering
        if (!uniqueId) return 
        
        const oldIndex = currentDeckArr.findIndex((x: DeckItem) => x.uniqueId === uniqueId)
        if (oldIndex === -1) return
        
        let newIndex = targetIdx !== null ? targetIdx : currentDeckArr.length
        
        const reorder = (prev: DeckItem[]) => {
            const next = [...prev]
            const [moved] = next.splice(oldIndex, 1)
            // Adjust index if we removed an item before the insertion point
            if (targetIdx !== null && oldIndex < targetIdx) {
                 newIndex = targetIdx - 1
            }
            if (newIndex < 0) newIndex = 0
            if (newIndex > next.length) newIndex = next.length
            
            next.splice(newIndex, 0, moved)
            return next
        }
        
        if (targetDeck === 'main') setMainDeck(reorder)
        if (targetDeck === 'extra') setExtraDeck(reorder)
        if (targetDeck === 'side') setSideDeck(reorder)
        return
      }

      // Moving between decks
      if (from !== 'search') {
        if (uniqueId) removeUnique(uniqueId, from)
        else decOn(cardId, from)
        
        // Add to target (isMove = true)
        const finalIndex = targetIdx !== null ? targetIdx : currentDeckArr.length
        addCardTo(card, targetDeck, finalIndex, true)
      } else {
        // From search (isMove = false default)
        const finalIndex = targetIdx !== null ? targetIdx : currentDeckArr.length
        addCardTo(card, targetDeck, finalIndex)
      }

    } catch (err) {
      console.error('Drop failed', err)
    }
  }

  const handleDragEnd = () => {
    setDraggingCard(null)
    setDraggingUniqueId(null)
    setDragTarget(null)
    setDropIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, target?: 'main' | 'extra' | 'side') => {
    e.preventDefault()
    if (target) {
       e.stopPropagation()
       if (target !== dragTarget) setDragTarget(target)
    }
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragTarget(null)
    setDropIndex(null)
  }

  const handleRemoveDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDraggingCard(null)
    setDragTarget(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (!data || !data.cardId || data.from === 'search') return
      
      const { uniqueId, from } = data
      if (uniqueId) removeUnique(uniqueId, from)
      else decOn(data.cardId, data.from)
    } catch (err) { /* ignore */ }
  }

  const handleAuxClick = (e: React.MouseEvent, cardId: string, deck: DeckType) => {
    if (e.button === 1) { // Middle click
      e.preventDefault()
      e.stopPropagation()
      incOn(cardId, deck)
    }
  }

  // Updated to handle uniqueId if passed, though standard click usually doesn't carry it unless we bind it
  // We'll update the bind in render to pass (ev, uniqueId, deck)
  const handleContextMenu = (e: React.MouseEvent, idOrUniqueId: string, deck: DeckType, isUnique = false) => {
    e.preventDefault()
    e.stopPropagation()

    // Find the card
    const sourceArr = deck === 'main' ? mainDeck : deck === 'extra' ? extraDeck : sideDeck
    let item: DeckItem | undefined
    if (isUnique) item = sourceArr.find(x => x.uniqueId === idOrUniqueId)
    else item = sourceArr.find(x => x.card.id === idOrUniqueId)
    
    if (!item) return

    if (e.ctrlKey || e.metaKey) {
      let target: DeckType = 'side'
      if (deck === 'side') {
        target = isExtraDeckCard(item.card) ? 'extra' : 'main'
      }

      if (isUnique) removeUnique(item.uniqueId, deck)
      else decOn(item.card.id, deck)
      
      addCardTo(item.card, target, undefined, true)
      return
    }

    if (isUnique) removeUnique(item.uniqueId, deck)
    else decOn(item.card.id, deck)
  }

  const handleSearchContextMenu = (e: React.MouseEvent, card: CardItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      addCardTo(card, 'side')
      return
    }
    const isExtra = isExtraDeckCard(card)
    addCardTo(card, isExtra ? 'extra' : 'main')
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center`}>
      <style jsx>{`
        @keyframes linkFade {
          from { opacity: 0.15; }
          to { opacity: 0.92; }
        }
        @keyframes linkFadeSelected {
          from { opacity: 1; }
          to { opacity: 0.15; }
        }
      `}</style>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className={`relative z-60 w-[96%] max-w-[1400px] h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex border border-gray-800 backdrop-blur-md ${isDark ? 'bg-slate-900/90 text-slate-100' : 'bg-white/95 text-slate-900'}`}>

        {/* Left: preview */}
        <div className="w-80 p-6 border-r flex-shrink-0 flex flex-col gap-4 bg-black/20" style={{ borderColor: isDark ? '#1e293b' : '#eef2f7' }}>
          <div className="flex items-center justify-between">
            <div className="font-black italic uppercase tracking-widest text-indigo-400 text-sm">Card Preview</div>
          </div>

          <div className="flex-1 rounded-xl p-0 flex flex-col items-center justify-start bg-gray-900/40 border border-white/5 shadow-inner min-h-0">
            {selectedCard ? (
              <div className="flex flex-col h-full w-full p-4 min-h-0">
                <div className="w-full flex-shrink-0 mb-6 mx-auto rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-gray-700/50 bg-gray-900 group relative">
                  <div className="w-full aspect-[59/86]">
                     <CardImage card={selectedCard} konamiId={selectedCard.konamiId} alt={selectedCard.name} className="w-full h-full object-contain" useLootArt={true} />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar-mini">
                    <div className="font-bold text-xl leading-tight mb-3 text-white drop-shadow-sm">{selectedCard.name}</div>
                    
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4 text-[11px] font-medium tracking-wide">
                        {(selectedCard as any).attribute && (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-gray-500 uppercase text-[9px] font-black">Attribute</span> 
                                <span className="text-indigo-300 uppercase">{String((selectedCard as any).attribute)}</span>
                            </div>
                        )}
                        {(selectedCard as any).level != null ? (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-gray-500 uppercase text-[9px] font-black">{cardHasSubtype(selectedCard, 'Xyz') ? 'Rank' : 'Level'}</span> 
                                <span className="text-amber-400">★ {(selectedCard as any).level}</span>
                            </div>
                        ) : (selectedCard as any).linkRating != null ? (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-gray-500 uppercase text-[9px] font-black">Link</span> 
                                <span className="text-sky-400">LINK-{(selectedCard as any).linkRating}</span>
                            </div>
                        ) : null}

                         {(selectedCard as any).race && (
                            <div className={detectMainType(selectedCard) === 'Monster' ? "flex flex-col gap-0.5" : "col-span-2 flex flex-col gap-0.5"}>
                                <span className="text-gray-500 uppercase text-[9px] font-black">Type</span> 
                                <span className="text-gray-200">{getCardTypeLabel(selectedCard)}</span>
                            </div>
                        )}
                        
                        {(detectMainType(selectedCard) === 'Monster') && (
                            <div className="col-span-2 flex flex-col gap-0.5 mt-1">
                                <span className="text-gray-500 uppercase text-[9px] font-black">Subtypes</span>
                                <div className="text-indigo-400/80 italic text-[10px]">
                                   [ {getMonsterSubtypes(selectedCard)} ]
                                </div>
                            </div>
                        )}
                        
                        {(detectMainType(selectedCard) === 'Monster') && (
                            <>
                            {(selectedCard as any).atk != null && (
                                <div className="flex flex-col gap-0.5 mt-2">
                                    <span className="text-gray-500 uppercase text-[9px] font-black">ATK</span> 
                                    <span className="text-white font-mono text-sm border-l-2 border-red-500/50 pl-2">{(selectedCard as any).atk}</span>
                                </div>
                            )}
                            {!cardHasSubtype(selectedCard, 'Link') && (selectedCard as any).def != null && (
                                <div className="flex flex-col gap-0.5 mt-2">
                                    <span className="text-gray-500 uppercase text-[9px] font-black">DEF</span> 
                                    <span className="text-white font-mono text-sm border-l-2 border-blue-500/50 pl-2">{(selectedCard as any).def}</span>
                                </div>
                            )}
                            </>
                        )}
                    </div>
                    
                    <div className="text-xs text-gray-300 dark:text-gray-400 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5">
                        <CardDescription card={selectedCard as any} modifications={selectedCard.modifications} />
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                     <span className="text-[10px] uppercase font-black text-gray-500 tracking-tighter">
                        Deck Copies: <span className="text-indigo-400">{(countCopies(mainDeck, selectedCard.id) + countCopies(extraDeck, selectedCard.id) + countCopies(sideDeck, selectedCard.id))} / 3</span>
                     </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => addCardTo(selectedCard, 'main')} className="flex-1 py-1.5 rounded-md bg-indigo-600/80 hover:bg-indigo-600 text-white text-[10px] uppercase font-bold transition-all border border-indigo-500/30">Main</button>
                    <button onClick={() => addCardTo(selectedCard, 'extra')} className="flex-1 py-1.5 rounded-md bg-amber-600/80 hover:bg-amber-600 text-white text-[10px] uppercase font-bold transition-all border border-amber-500/30">Extra</button>
                    <button onClick={() => addCardTo(selectedCard, 'side')} className="flex-1 py-1.5 rounded-md bg-slate-700/80 hover:bg-slate-700 text-white text-[10px] uppercase font-bold transition-all border border-white/10">Side</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="text-sm text-gray-400 font-medium font-mono uppercase tracking-tighter">Select a card<br/>to preview</div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <input 
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              placeholder="Deck Name (Required)"
              className={`w-full px-3 py-2 rounded border outline-none transition-colors ${isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500' : 'bg-white border-gray-300 text-black focus:border-emerald-500'}`}
            />
            <div className="flex gap-2">
              <button 
                  onClick={onClose} 
                  className={`flex-1 px-3 py-2 rounded border transition-colors ${
                      isDark 
                      ? 'border-slate-700 text-gray-400 hover:bg-slate-800 hover:text-white' 
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-black'
                  }`}
              >
                  Close
              </button>
              <button
                  onClick={() => setShowLoadModal(true)}
                  className="px-3 py-2 rounded font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
              >
                  Load
              </button>
              <button 
                  disabled={!deckName.trim()}
                  onClick={() => { 
                      onSave({
                          name: deckName,
                          main: exportEnds(mainDeck),
                          extra: exportEnds(extraDeck),
                          side: exportEnds(sideDeck)
                      })
                      // Do not close on save
                  }} 
                  className={`flex-1 px-3 py-2 rounded font-semibold text-white transition-all ${!deckName.trim() ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-emerald-500 hover:bg-emerald-600 shadow-md'}`}>
                  Save
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col gap-6 overflow-auto bg-slate-950/20 shadow-inner">
          <div className="grid grid-cols-1 gap-8">
            <section 
              onDragOver={(e) => handleDragOver(e, 'main')} 
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'main')}
              className={`transition-all duration-300 rounded-2xl group ${dragTarget === 'main' ? 'bg-emerald-500/10 ring-2 ring-emerald-500/50 scale-[1.01]' : 'bg-black/10'}`}
            >
              <div className="flex items-center justify-between mb-3 px-4 pt-4">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                    <div className="font-black italic uppercase tracking-widest text-lg drop-shadow-sm">Main Deck</div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-[10px] font-black uppercase text-gray-500 bg-black/40 px-3 py-1 rounded-full border border-white/5">Distinct: <span className="text-emerald-400">{new Set(mainDeck.map(x=>x.card.id)).size}</span></div>
                    <div className="text-[10px] font-black uppercase text-gray-500 bg-black/40 px-3 py-1 rounded-full border border-white/5">Total: <span className="text-emerald-400">{mainDeck.length}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-10 gap-x-2 gap-y-3 min-h-[500px] content-start bg-black/20 rounded-xl p-4 m-2 border border-white/[0.03]">
                {mainDeck.map((item, i) => (
                  <div 
                    key={item.uniqueId} 
                    className={`relative group cursor-grab active:cursor-grabbing hover:z-10 transition-all duration-200 ${draggingUniqueId === item.uniqueId ? 'opacity-20' : 'hover:-translate-y-1'}`}
                    draggable
                    onDragStart={(ev) => handleDragStart(ev, item.card, 'main', item.uniqueId)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(ev) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        if (dragTarget !== 'main') setDragTarget('main')
                        if (dropIndex !== i) setDropIndex(i)
                    }}
                    onContextMenu={(ev) => handleContextMenu(ev, item.uniqueId, 'main', true)}
                    onMouseDown={(ev) => handleAuxClick(ev, item.card.id, 'main')}
                  >
                    <div className={`w-full aspect-[59/86] rounded-md overflow-hidden shadow-lg border border-gray-800 transition-all duration-300
                        ${dragTarget === 'main' && dropIndex === i && draggingUniqueId !== item.uniqueId ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 translate-x-1' : 'group-hover:border-emerald-500/50 group-hover:shadow-emerald-500/20'}`}>
                      <CardImage card={item.card} konamiId={item.card.konamiId} alt={item.card.name} className="w-full h-full object-cover" useLootArt={true} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-6">
                <section 
                onDragOver={(e) => handleDragOver(e, 'extra')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'extra')}
                className={`transition-all duration-300 rounded-2xl group ${dragTarget === 'extra' ? 'bg-indigo-500/10 ring-2 ring-indigo-500/50 scale-[1.01]' : 'bg-black/10'}`}
                >
                <div className="flex items-center justify-between mb-3 px-4 pt-4">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                        <div className="font-black italic uppercase tracking-widest text-sm drop-shadow-sm">Extra Deck</div>
                    </div>
                    <div className="text-xs font-black text-indigo-400 pr-2">{extraDeck.length} <span className="text-gray-600">/ 15</span></div>
                </div>
                <div className="grid grid-cols-5 gap-x-2 gap-y-3 min-h-[160px] content-start bg-black/20 rounded-xl p-4 m-2 border border-white/[0.03]">
                    {extraDeck.map((item, i) => (
                    <div 
                        key={item.uniqueId} 
                        className={`relative group cursor-grab active:cursor-grabbing hover:z-10 transition-all duration-200 ${draggingUniqueId === item.uniqueId ? 'opacity-20' : 'hover:-translate-y-1'}`}
                        draggable
                        onDragStart={(ev) => handleDragStart(ev, item.card, 'extra', item.uniqueId)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(ev) => {
                            ev.preventDefault()
                            ev.stopPropagation()
                            if (dragTarget !== 'extra') setDragTarget('extra')
                            if (dropIndex !== i) setDropIndex(i)
                        }}
                        onContextMenu={(ev) => handleContextMenu(ev, item.uniqueId, 'extra', true)}
                        onMouseDown={(ev) => handleAuxClick(ev, item.card.id, 'extra')}
                    >
                        <div className={`w-full aspect-[59/86] rounded-md overflow-hidden shadow-lg border border-gray-800 transition-all duration-300
                            ${dragTarget === 'extra' && dropIndex === i && draggingUniqueId !== item.uniqueId ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 translate-x-1' : 'group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/20'}`}>
                        <CardImage card={item.card} konamiId={item.card.konamiId} alt={item.card.name} className="w-full h-full object-cover" useLootArt={true} />
                        </div>
                    </div>
                    ))}
                </div>
                </section>

                <section 
                onDragOver={(e) => handleDragOver(e, 'side')} 
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'side')}
                className={`transition-all duration-300 rounded-2xl group ${dragTarget === 'side' ? 'bg-amber-500/10 ring-2 ring-amber-500/50 scale-[1.01]' : 'bg-black/10'}`}
                >
                <div className="flex items-center justify-between mb-3 px-4 pt-4">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                        <div className="font-black italic uppercase tracking-widest text-sm drop-shadow-sm">Side Deck</div>
                    </div>
                    <div className="text-xs font-black text-amber-400 pr-2">{sideDeck.length} <span className="text-gray-600">/ 15</span></div>
                </div>
                <div className="grid grid-cols-5 gap-x-2 gap-y-3 min-h-[160px] content-start bg-black/20 rounded-xl p-4 m-2 border border-white/[0.03]">
                    {sideDeck.map((item, i) => (
                    <div 
                        key={item.uniqueId} 
                        className={`relative group cursor-grab active:cursor-grabbing hover:z-10 transition-all duration-200 ${draggingUniqueId === item.uniqueId ? 'opacity-20' : 'hover:-translate-y-1'}`}
                        draggable
                        onDragStart={(ev) => handleDragStart(ev, item.card, 'side', item.uniqueId)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(ev) => {
                            ev.preventDefault()
                            ev.stopPropagation()
                            if (dragTarget !== 'side') setDragTarget('side')
                            if (dropIndex !== i) setDropIndex(i)
                        }}
                        onContextMenu={(ev) => handleContextMenu(ev, item.uniqueId, 'side', true)}
                        onMouseDown={(ev) => handleAuxClick(ev, item.card.id, 'side')}
                    >
                        <div className={`w-full aspect-[59/86] rounded-md overflow-hidden shadow-lg border border-gray-800 transition-all duration-300
                            ${dragTarget === 'side' && dropIndex === i && draggingUniqueId !== item.uniqueId ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 translate-x-1' : 'group-hover:border-amber-500/50 group-hover:shadow-amber-500/20'}`}>
                        <CardImage card={item.card} konamiId={item.card.konamiId} alt={item.card.name} className="w-full h-full object-cover" useLootArt={true} />
                        </div>
                    </div>
                    ))}
                </div>
                </section>
            </div>
          </div>
        </div>

        {/* Right: card list and search */}
        <div className="w-96 flex-shrink-0 flex flex-col bg-black/20 border-l border-white/5 backdrop-blur-sm relative">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
                <div className="font-black italic uppercase tracking-widest text-[10px] text-emerald-400">Search DB</div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setFilterOpen(true) }} 
                  className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black transition-all border border-emerald-500/20 uppercase italic"
                >
                  Filter
                </button>
                <button 
                  onClick={() => { setMainType('Any'); setSelectedSubtypes([]); setSelectedTypes([]); setSelectedLevels([]); setSelectedLinkRatings([]); setSelectedLinkArrows([]); setSelectedAttributes([]); setSelectedAbilities([]) }} 
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] font-black transition-all border border-white/5 uppercase italic"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="relative mb-6 group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-emerald-500 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                placeholder="Find a card..." 
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-black/40 border border-white/5 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all font-bold text-xs text-white placeholder:text-gray-700 shadow-inner"
              />
              {query && (
                <button 
                  onClick={() => setQuery('')} 
                  className="absolute inset-y-0 right-3 flex items-center text-gray-600 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0"
              onDragOver={(e) => { handleDragOver(e); if(dragTarget) setDragTarget(null); }}
              onDrop={handleRemoveDrop}
            >
              <div className="grid grid-cols-3 gap-3 content-start">
                {loading ? (
                  <div className="col-span-3 py-20 flex flex-col items-center justify-center gap-4">
                    <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500/40">Searching...</div>
                  </div>
                ) : (
                  filteredResults.length ? filteredResults.map(c => (
                    <div 
                      key={c.id} 
                      className="relative group cursor-grab active:cursor-grabbing hover:z-10 transition-all duration-200 hover:-translate-y-1" 
                      onClick={() => { setSelectedCard(c) }}
                      onContextMenu={(ev) => handleSearchContextMenu(ev, c)}
                      onMouseDown={(ev) => {
                         if (ev.button === 0 && !ev.shiftKey) {
                             // Regular left click select handled by onClick
                         } else if (ev.button === 0 && ev.shiftKey) {
                             // Alt way to add
                             addCardTo(c, activeTab)
                         }
                      }}
                      draggable
                      onDragStart={(ev) => handleDragStart(ev, c, 'search')}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="w-full aspect-[59/86] rounded-lg overflow-hidden shadow-lg border border-white/5 group-hover:border-emerald-500/50 group-hover:shadow-[0_0_15px_rgba(52,211,153,0.2)] transition-all">
                        <CardImage card={c} konamiId={c.konamiId} alt={c.name} className="w-full h-full object-cover" useLootArt={true} />
                      </div>
                      <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 pointer-events-none transition-colors duration-300"></div>
                      <div className="absolute -top-1 -right-1 bg-emerald-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        +
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-3 py-20 flex flex-col items-center justify-center text-center opacity-20">
                       <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                       <div className="text-[10px] font-black uppercase tracking-widest">Empty Search</div>
                    </div>
                  )
                )}
              </div>
            </div>

      </div>
    </div>
    {filterOpen && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-8 bg-black/95 backdrop-blur-2xl">
        <div className="w-[85vw] max-w-6xl max-h-[90vh] overflow-y-auto rounded-[3rem] bg-slate-900 border-4 border-emerald-500/30 shadow-[0_0_100px_rgba(16,185,129,0.2)] p-12 custom-scrollbar relative">
            <div className="absolute top-8 right-8 z-[10000]">
              <button 
                onClick={() => setFilterOpen(false)}
                className="p-4 rounded-2xl bg-white/5 hover:bg-red-500/20 text-white hover:text-red-400 transition-all border border-white/10 group shadow-2xl"
              >
              <svg className="w-8 h-8 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mb-10 flex items-center gap-4">
            <div className="w-3 h-10 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Advanced Search Filters</h2>
          </div>

          <DeckFiltersPanel
            isDark={true}
            setFilterOpen={setFilterOpen}
            selectedSubtypes={selectedSubtypes}
            toggleSubtype={toggleSubtype}
            selectedAttributes={selectedAttributes}
            toggleAttribute={toggleAttribute}
            TYPES={TYPES}
            selectedTypes={selectedTypes}
            toggleType={toggleType}
            selectedLevels={selectedLevels}
            toggleLevel={toggleLevel}
            selectedLinkRatings={selectedLinkRatings}
            toggleLinkRating={toggleLinkRating}
            selectedLinkArrows={selectedLinkArrows}
            toggleLinkArrow={toggleLinkArrow}
            hoveredLinkArrow={hoveredLinkArrow}
            setHoveredLinkArrow={setHoveredLinkArrow}
            linkArrowsMode={linkArrowsMode}
            selectedPendulumScales={selectedPendulumScales}
            togglePendulumScale={togglePendulumScale}
            atkMin={atkMin}
            atkMax={atkMax}
            setAtkMinFromInput={setAtkMinFromInput}
            setAtkMaxFromInput={setAtkMaxFromInput}
            sliderRef={sliderRef}
            startDrag={startDrag}
            defMin={defMin}
            defMax={defMax}
            setDefMinFromInput={setDefMinFromInput}
            setDefMaxFromInput={setDefMaxFromInput}
            defSliderRef={defSliderRef}
            defStartDrag={defStartDrag}
            selectedAbilities={selectedAbilities}
            toggleAbility={toggleAbility}
            resetAll={() => {
                setMainType('Monster')
                setSelectedSubtypes([])
                setSelectedTypes([])
                setSelectedAttributes([])
                setSelectedLevels([])
                setSelectedAbilities([])
                setSelectedPendulumScales([])
                setSelectedLinkRatings([])
                setSelectedLinkArrows([])
                setAtkMin(0)
                setAtkMax(5000)
                setDefMin(0)
                setDefMax(5000)
            }}
            onCancel={() => { 
                setFilterOpen(false)
            }}
          />
        </div>
      </div>
    )}

        {/* Load Deck Modal */}
        {showLoadModal && (
            <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-3xl shadow-2xl p-8 border border-white/10 bg-slate-900/90 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
                    
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                        Load Deck
                    </h2>
                    
                    {loadingDecks ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                            <div className="text-xs font-bold uppercase tracking-widest text-emerald-500/40">Accessing Data...</div>
                        </div>
                    ) : (
                        <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-8 pr-2 custom-scrollbar">
                             {userDecks.length === 0 ? (
                                 <div className="text-center py-20 opacity-30 flex flex-col items-center">
                                     <div className="text-4xl mb-2">📁</div>
                                     <div className="font-bold uppercase tracking-widest text-xs">No saved decks</div>
                                 </div>
                             ) : (
                                 userDecks.map(d => (
                                     <div 
                                        key={d.id}
                                        onClick={() => loadDeck(d.id, d.name)}
                                        className="w-full text-left p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all flex justify-between items-center group cursor-pointer"
                                     >
                                        <div>
                                            <div className="font-black text-lg group-hover:text-emerald-400 transition-colors uppercase italic tracking-tight">{d.name}</div>
                                            <div className="text-xs font-bold text-gray-500 mt-0.5">
                                                {d.class?.name || 'No Class'} <span className="mx-2 opacity-20">|</span> {(d._count?.cards || 0)} Cards
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                                                {new Date(d.updatedAt).toLocaleDateString()}
                                            </div>
                                            <button 
                                                onClick={(e) => deleteDeck(e, d.id, d.name)}
                                                className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Delete Deck"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                     </div>
                                 ))
                             )}
                        </div>
                    )}
                    
                    <button 
                        onClick={() => setShowLoadModal(false)}
                        className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black uppercase italic tracking-widest text-sm transition-all border border-white/5"
                    >
                        Back to Editor
                    </button>
                </div>
            </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
            <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-[2rem] shadow-2xl p-8 border border-red-500/20 bg-slate-900 shadow-red-500/10">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 mx-auto">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h3 className="text-xl font-black italic uppercase tracking-widest text-center mb-2 text-white">Delete Deck?</h3>
                    <p className="mb-8 text-sm text-center text-gray-500 font-bold leading-relaxed px-4">
                        Are you sure you want to delete <span className="text-red-400">"{deleteTarget.name}"</span>? 
                        This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setDeleteTarget(null)}
                            className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-black uppercase italic tracking-widest text-xs hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black uppercase italic tracking-widest text-xs transition-all shadow-lg shadow-red-500/20"
                        >
                            Confirm Delete
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  )
}


