import React, { useState, useEffect } from 'react'
import { Card, DeckCard, Skill, SkillModification } from '../../types/class-editor'
import CardDescription from './shared/CardDescription'
import CardPreview from './shared/CardPreview'
import SkillForm from './shared/SkillForm'
import CardGallery from './CardGallery'
import CardImage, { selectArtworkUrl } from '../common/CardImage'
import HoverTooltip from '../shop-v2/components/HoverTooltip'
import { RichTextRenderer } from '../RichText'
import DeckFiltersPanel from '../DeckFiltersPanel'
import { CardFiltersState, matchCard } from './shared/CardFilters'

type CardFilterState = {
  category?: 'Any' | 'Monster' | 'Spell' | 'Trap' | 'Extra'
  attribute?: string | null
  race?: string | null
  levelMin?: number | null
  levelMax?: number | null
}

// Alias for backward compatibility if needed, but prefer Skill
export type StartingSkill = Skill

interface StartingCardsEditorProps {
  deck: DeckCard[]
  onChange: (deck: DeckCard[]) => void
  skills: Skill[]
  onSkillsChange: (skills: Skill[]) => void
  send?: (payload: any) => void
  me?: any
  peers?: Record<string, any>
  formatSlug?: string | null
  formatVariant?: string | null
}

export default function StartingCardsEditor({ deck, onChange, skills, onSkillsChange, send, me, peers, formatSlug, formatVariant }: StartingCardsEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'cards' | 'skills'>('cards')
  const [filterCategory, setFilterCategory] = useState<'Monster' | 'Spell' | 'Trap' | 'Extra' | null>(null)
  
  // Card Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null)
  const cardCache = React.useRef<Record<string, any>>({})
  const tooltipScrollRef = React.useRef<HTMLDivElement | null>(null)
  const [hoverTooltip, setHoverTooltip] = useState<any>({ visible: false })
  const [filters, setFilters] = useState<CardFilterState>({ category: 'Any' })
  const [filteredSearchResults, setFilteredSearchResults] = useState<Card[]>([])
  const [isEnrichingResults, setIsEnrichingResults] = useState(false)

  // Controlled filter state (lifted from DeckBuilderOverlay)
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([])
  const toggleSubtype = (s: string) => setSelectedSubtypes(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev,s])

  const TYPES = [
    'Spellcaster','Dragon','Zombie','Warrior','Beast-Warrior','Beast','Winged Beast','Machine',
    'Fiend','Fairy','Insect','Dinosaur','Reptile','Fish','Sea Serpent','Aqua',
    'Pyro','Thunder','Rock','Plant','Psychic','Wyrm','Cyberse','Divine-Beast','Illusion'
  ]

  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const toggleType = (t: string) => setSelectedTypes(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t])
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([])
  const toggleAttribute = (a: string) => setSelectedAttributes(prev => prev.includes(a) ? prev.filter(x=>x!==a) : [...prev, a])
  const [selectedLevels, setSelectedLevels] = useState<number[]>([])
  const toggleLevel = (lv: number) => setSelectedLevels(prev => prev.includes(lv) ? prev.filter(x=>x!==lv) : [...prev, lv])
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])
  const toggleAbility = (ab: string) => setSelectedAbilities(prev => prev.includes(ab) ? prev.filter(x=>x!==ab) : [...prev, ab])

  const [selectedPendulumScales, setSelectedPendulumScales] = useState<number[]>([])
  const togglePendulumScale = (n: number) => setSelectedPendulumScales(prev => prev.includes(n) ? prev.filter(x=>x!==n) : [...prev, n])

  const [selectedLinkRatings, setSelectedLinkRatings] = useState<number[]>([])
  const toggleLinkRating = (n: number) => setSelectedLinkRatings(prev => prev.includes(n) ? prev.filter(x=>x!==n) : [...prev, n])

  const ARROWS = ['NW','N','NE','W','E','SW','S','SE']
  const [selectedLinkArrows, setSelectedLinkArrows] = useState<string[]>([])
  const [linkArrowsMode, setLinkArrowsMode] = useState<'AND'|'OR'>('AND')
  const toggleLinkArrow = (d: string) => setSelectedLinkArrows(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d])
  const [hoveredLinkArrow, setHoveredLinkArrow] = useState<string | null>(null)

  // ATK/DEF sliders
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

  const sliderRef = React.useRef<HTMLDivElement | null>(null)
  const draggingRef = React.useRef<'min'|'max'|null>(null)

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

  React.useEffect(() => { return () => { endDrag() } }, [])

  // DEF
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

  const defSliderRef = React.useRef<HTMLDivElement | null>(null)
  const defDraggingRef = React.useRef<'min'|'max'|null>(null)

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

  React.useEffect(() => { return () => { defEndDrag() } }, [])

  const [filterOpen, setFilterOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)

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

  const resetAll = () => {
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
    setFilterOpen(false)
  }

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

  // Enrich and filter searchResults when they or the filters change
  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!searchResults || searchResults.length === 0) {
        if (mounted) setFilteredSearchResults([])
        return
      }
      setIsEnrichingResults(true)
      try {
        const currentFilters: CardFiltersState = {
          selectedAttributes: selectedAttributes,
          selectedTypes: selectedTypes,
          selectedSubtypes: selectedSubtypes,
          selectedLevels: selectedLevels,
          selectedLinkRatings: selectedLinkRatings,
          selectedLinkArrows: selectedLinkArrows,
          linkArrowsMode: linkArrowsMode,
          selectedAbilities: selectedAbilities,
          selectedPendulumScales: selectedPendulumScales,
          atkMin,
          atkMax,
          defMin,
          defMax,
        }

        const enriched = await Promise.all(searchResults.map(async (c) => {
          // If card already has attribute/type fields, trust it; otherwise fetch detail
          if ((c as any).attribute !== undefined && (c as any).type !== undefined) return c
          try {
            return await enrichCard(c)
          } catch (e) {
            return c
          }
        }))

        const filtered = enriched.filter(c => matchCard(c, currentFilters))
        if (mounted) setFilteredSearchResults(filtered)
      } catch (e) {
        if (mounted) setFilteredSearchResults([])
      } finally {
        if (mounted) setIsEnrichingResults(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [searchResults, selectedAttributes, selectedTypes, selectedSubtypes, selectedLevels, selectedLinkRatings, selectedLinkArrows, linkArrowsMode, selectedAbilities, selectedPendulumScales, atkMin, atkMax, defMin, defMax])

  // Skill Form State
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [isSkillFormOpen, setIsSkillFormOpen] = useState(false)
  
  // Helper to update deck
  const setDeck = (newDeck: DeckCard[] | ((prev: DeckCard[]) => DeckCard[])) => {
    if (typeof newDeck === 'function') {
      onChange(newDeck(deck))
    } else {
      onChange(newDeck)
    }
  }

  // Helper to update skills
  const setSkills = (newSkills: Skill[] | ((prev: Skill[]) => Skill[])) => {
    if (typeof newSkills === 'function') {
      onSkillsChange(newSkills(skills))
    } else {
      onSkillsChange(newSkills)
    }
  }

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true)
        try {
          // Prefer format-scoped search when formatSlug is available to avoid showing cards
          // from other variants (e.g., Rush) that the format doesn't include.
          if (formatSlug) {
            const base = `/api/cards/for-format?slug=${encodeURIComponent(formatSlug)}&q=${encodeURIComponent(searchQuery)}`
            const url = formatVariant ? `${base}&variant=${encodeURIComponent(formatVariant)}` : base
            try {
              let res = await fetch(url, { cache: 'no-store' })
              if (res.ok) {
                const data = await res.json()
                setSearchResults(Array.isArray(data) ? data : [])
              } else if (res.status === 304) {
                // Not modified: if we have no results yet, retry with cache-buster
                if (!searchResults || searchResults.length === 0) {
                  const retryUrl = `${url}&cb=${Date.now()}`
                  console.warn('StartingCardsEditor: 304 received, retrying', retryUrl)
                  const r2 = await fetch(retryUrl, { cache: 'no-store' })
                  if (r2.ok) {
                    const d2 = await r2.json()
                    setSearchResults(Array.isArray(d2) ? d2 : [])
                  } else {
                    console.warn('StartingCardsEditor retry failed', r2.status)
                    setSearchResults([])
                  }
                } else {
                  console.warn('StartingCardsEditor: 304 Not Modified for', url)
                }
              } else {
                console.warn('StartingCardsEditor search failed', res.status)
                setSearchResults([])
              }
            } catch (e) {
              console.error('Error searching cards (format):', e)
              setSearchResults([])
            }
          } else {
            try {
              const searchUrl = `/api/cards/search?q=${encodeURIComponent(searchQuery)}`
              let res = await fetch(searchUrl, { cache: 'no-store' })
              if (res.ok) {
                const data = await res.json()
                setSearchResults(Array.isArray(data) ? data : [])
              } else if (res.status === 304) {
                if (!searchResults || searchResults.length === 0) {
                  const retryUrl = `${searchUrl}&cb=${Date.now()}`
                  console.warn('StartingCardsEditor: 304 received on search, retrying', retryUrl)
                  const r2 = await fetch(retryUrl, { cache: 'no-store' })
                  if (r2.ok) {
                    const d2 = await r2.json()
                    setSearchResults(Array.isArray(d2) ? d2 : [])
                  } else {
                    console.warn('StartingCardsEditor search retry failed', r2.status)
                    setSearchResults([])
                  }
                } else {
                  console.warn('StartingCardsEditor: 304 Not Modified for search', searchUrl)
                }
              } else {
                console.warn('StartingCardsEditor search failed', res.status)
                setSearchResults([])
              }
            } catch (e) {
              console.error('Error searching cards:', e)
              setSearchResults([])
            }
          }
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
  }, [searchQuery])

  const handleAddSkill = () => {
    setEditingSkill(null)
    setIsSkillFormOpen(true)
  }

  const handleEditSkill = (skill: Skill) => {
    setEditingSkill(skill)
    setIsSkillFormOpen(true)
  }

  const handleSaveSkill = (skill: Skill) => {
    console.log('[StartingCardsEditor] Received skill for save:', skill)
    if (editingSkill) {
      setSkills(prev => {
        const updated = prev.map(s => s.id === editingSkill.id ? skill : s)
        console.log('[StartingCardsEditor] Updating existing skill. New array:', updated)
        return updated
      })
    } else {
      const newSkill = { ...skill, id: Date.now().toString() }
      console.log('[StartingCardsEditor] Adding new skill:', newSkill)
      setSkills(prev => [...prev, newSkill])
    }
    setIsSkillFormOpen(false)
  }

  const handleDeleteSkill = (id: string) => {
    setSkills(prev => prev.filter(s => s.id !== id))
  }

  const getCardCategory = (card: Card): 'Monster' | 'Spell' | 'Trap' | 'Extra' => {
    const typeStr = (card.type || '').toString().toLowerCase().trim()
    const descStr = (card.desc || '').toString().toLowerCase()

    const lowerType = typeStr || descStr

    if (lowerType.includes('fusion') || lowerType.includes('synchro') || lowerType.includes('xyz') || lowerType.includes('link')) {
      return 'Extra'
    }
    if (lowerType.includes('spell')) return 'Spell'
    if (lowerType.includes('trap')) return 'Trap'
    return 'Monster'
  }

  // Filter helper functions (copied/trimmed from DeckBuilderOverlay)
  const detectMainType = (c: any) => {
    const token = ((c.cardType || c.type || c.categories || '')).toString().toLowerCase()
    if (/\bspell\b/.test(token) || token.includes('spell card')) return 'Spell'
    if (/\btrap\b/.test(token) || token.includes('trap card')) return 'Trap'
    return 'Monster'
  }

  const cardHasSubtype = (c: any, subtype: string) => {
    const s = (subtype || '').toString().toLowerCase()
    const mt = detectMainType(c)

    if (s === 'spell' || s === 'trap') return mt === (s === 'spell' ? 'Spell' : 'Trap')

    if (s.includes(':')) {
      const [cat, sub] = s.split(':')
      if (cat && cat.toLowerCase() === 'spell' && mt !== 'Spell') return false
      if (cat && cat.toLowerCase() === 'trap' && mt !== 'Trap') return false
      const t = ((c.type || '') + ' ' + (c.subtype || '') + ' ' + (c.cardType || '') + ' ' + (c.race || '')).toString().toLowerCase()
      return t.includes((sub || '').toLowerCase().replace('quick-play','quick'))
    }

    if (s === 'normal') {
      if (mt !== 'Monster') return false
      const t = ((c.type || '') + ' ' + (c.subtype || '') + ' ' + (c.cardType || '') + ' ' + (c.race || '')).toString().toLowerCase()
      return /\bnormal\b/.test(t)
    }

    const monsterTokens = ['normal','effect','fusion','ritual','synchro','xyz','link','pendulum','toon','spirit','union','gemini','flip','tuner']
    if (monsterTokens.includes(s) && mt !== 'Monster') return false

    const t = ((c.type || '') + ' ' + (c.subtype || '') + ' ' + (c.cardType || '') + ' ' + (c.race || '')).toString().toLowerCase()
    return t.includes(s.replace('quick-play','quick'))
  }

  const cardHasType = (c: any, type: string) => {
    const raw = ((c.race || '') + ' ' + (c.type || '') + ' ' + (c.cardType || '') + ' ' + (c.categories || '')).toString()
    const normalizeToken = (s: string) => s.toString().toLowerCase().replace(/[^a-z0-9]/g, '')
    const cardTok = normalizeToken(raw)
    const selTok = normalizeToken(type)
    return cardTok.includes(selTok)
  }

  const cardHasLevel = (c: any, lv: number) => {
    const v = c.level ?? c.rank ?? null
    if (v == null) return false
    const n = parseInt(String(v), 10)
    return !Number.isNaN(n) && n === lv
  }

  const cardHasLinkRating = (c: any, n: number) => {
    const v = c.linkRating ?? c.link ?? c.linkval ?? null
    if (v == null) return false
    const num = parseInt(String(v), 10)
    return !Number.isNaN(num) && num === n
  }

  const cardHasLinkArrow = (c: any, dir: string) => {
    let arr = (c.linkArrows || c.arrows || c.link || '').toString().toLowerCase()
    arr = arr.replace(/top[\s-]*left/g, 'nw').replace(/top[\s-]*right/g, 'ne')
    arr = arr.replace(/bottom[\s-]*left/g, 'sw').replace(/bottom[\s-]*right/g, 'se')
    arr = arr.replace(/top/g, 'n').replace(/bottom/g, 's').replace(/left/g, 'w').replace(/right/g, 'e')
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

  const addCard = (card: Card) => {
    const category = getCardCategory(card)
    
    setDeck(prev => {
      if (prev.some(c => c.id === card.id)) return prev
      return [...prev, { ...card, quantity: 1, category }]
    })
    setSearchQuery('')
    setSearchResults([])
    // deck is broadcast by parent; no need to send action messages here
  }

  const removeCard = (cardId: string) => {
    setDeck(prev => prev.filter(c => c.id !== cardId))
    // deck is broadcast by parent; no need to send action messages here
  }


  const getImageUrl = (konamiId: number) => selectArtworkUrl(undefined, konamiId) || undefined

  // Calculate effective skills including the one currently being edited
  const effectiveSkills = React.useMemo(() => {
    // Since we are using a modal now, we don't have "live" editing in the main view
    // unless we pass the current form state up, which SkillForm doesn't do yet.
    // However, SkillForm is a modal, so the main view doesn't need to update until save.
    // BUT, the user liked the "live" update.
    // To support live update with the modal, we'd need SkillForm to report changes.
    // For now, let's stick to "update on save" for simplicity of refactor, 
    // OR we can make SkillForm call an onChange prop.
    // Given the complexity, let's stick to standard modal behavior first.
    return skills
  }, [skills])
  const renderCardList = (category: 'Monster' | 'Spell' | 'Trap' | 'Extra') => {
    if (filterCategory && filterCategory !== category) return null

    let cards = deck.filter(c => c.category === category)
    // apply advanced filters
    if (filters) {
      if (filters.attribute) {
        cards = cards.filter(c => String((c as any).attribute || '').toUpperCase() === String(filters.attribute).toUpperCase())
      }
      if (filters.race) {
        cards = cards.filter(c => String((c as any).race || '').toLowerCase().includes(String(filters.race).toLowerCase()))
      }
    }

    // Use centralized matchCard to evaluate lifted filters
    const liftedState: CardFiltersState = {
      selectedAttributes: selectedAttributes,
      selectedTypes: selectedTypes,
      selectedSubtypes: selectedSubtypes,
      selectedLevels: selectedLevels,
      selectedLinkRatings: selectedLinkRatings,
      selectedLinkArrows: selectedLinkArrows,
      linkArrowsMode: linkArrowsMode,
      selectedAbilities: selectedAbilities,
      selectedPendulumScales: selectedPendulumScales,
      atkMin,
      atkMax,
      defMin,
      defMax,
    }

    if (liftedState.selectedSubtypes && liftedState.selectedSubtypes.length > 0) {
      try {
        // Debug: use console.log so it's visible if console.debug is hidden
        console.log('CardFilters: selectedSubtypes=', liftedState.selectedSubtypes)
        for (let i = 0; i < Math.min(5, cards.length); i++) {
          const c = cards[i]
          console.log('CardFilters: sample', i, c.name, 'type=', c.type, 'match=', matchCard(c, liftedState))
        }
      } catch (e) {
        // ignore
      }
    }

    const filtered = cards.filter(c => matchCard(c, liftedState))

    if (filtered.length === 0) return null

    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            {category}s <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({filtered.length}/{cards.length})</span>
          </h4>
          {filterCategory && (
            <button 
              onClick={() => setFilterCategory(null)}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Show All Categories
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2">
            {filtered.map(card => (
            <div 
              key={card.id} 
              className="group relative flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-md hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                onMouseEnter={async (e) => { const enriched = await enrichCard(card); setHoveredCard(enriched); const key = String(card.id || card.konamiId || ''); setHoverTooltip({ visible: true, x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY, idKey: key, cardLike: enriched, skills: [] }); }}
                onMouseMove={(e) => { if (hoverTooltip?.visible) setHoverTooltip((h: any)=> ({ ...h, x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY })); }}
                onMouseLeave={() => { setHoveredCard(null); setHoverTooltip({ visible: false }); }}
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                    <div style={{ width: 40, flexShrink: 0 }}>
                      <CardImage card={card} konamiId={card.konamiId} alt={card.name} className="w-full h-full object-cover" />
                    </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">{card.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{card.type || getCardCategory(card)}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 ml-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); removeCard(card.id) }}
                  className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {/* show peer badges for this card if any */}
                {(peers ? Object.values(peers).filter((p:any)=>p.section==='startingCards' && p.itemId===card.id) : []).map((p:any, i:number)=> (
                  <div key={i} className="w-6 h-6 rounded-full overflow-hidden" style={{ background: (p.color || (()=>{let s=(p.user?.email||p.user?.name||''); let h=0; for(let ii=0;ii<s.length;ii++)h=(h*31+s.charCodeAt(ii))%360; return `hsl(${h} 70% 45%)`})()) || '#666' }} title={(p.user && p.user.name) || 'peer'}>
                    {p.user?.image ? <img src={p.user.image} className="w-full h-full object-cover" alt={p.user?.name||'P'} /> : <div className="text-white text-xs font-bold flex items-center justify-center">{((p.user && p.user.name) || '?')[0]}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Summary View Component
  if (!isModalOpen) {
    const monsterCount = deck.filter(c => c.category === 'Monster').length
    const spellCount = deck.filter(c => c.category === 'Spell').length
    const trapCount = deck.filter(c => c.category === 'Trap').length
    const extraCount = deck.filter(c => c.category === 'Extra').length
    const skillCount = skills.length
    const totalCards = deck.length

    const openCategory = (category: 'Monster' | 'Spell' | 'Trap' | 'Extra' | 'Skill') => {
      setIsModalOpen(true)
      if (category === 'Skill') {
        setActiveTab('skills')
        setFilterCategory(null)
      } else {
        setActiveTab('cards')
        setFilterCategory(category)
      }
    }

    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-all group">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Starting Loadout</h3>
          <button 
            onClick={() => { setIsModalOpen(true); setActiveTab('cards'); setFilterCategory(null); }}
            className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Edit All
          </button>
        </div>
        
        {totalCards === 0 && skillCount === 0 ? (
          <div 
            onClick={() => { setIsModalOpen(true); setActiveTab('cards'); setFilterCategory(null); }}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center bg-gray-50 dark:bg-gray-900 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500"
          >
            <p className="text-gray-500 dark:text-gray-400">No cards or skills added yet.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Click here to open the loadout editor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div 
              onClick={() => openCategory('Monster')}
              className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded border border-orange-100 dark:border-orange-800 cursor-pointer hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-sm transition-all"
            >
              <span className="block text-2xl font-bold text-orange-700 dark:text-orange-400">{monsterCount}</span>
              <span className="text-xs text-orange-600 dark:text-orange-300 uppercase font-semibold">Monsters</span>
            </div>
            <div 
              onClick={() => openCategory('Spell')}
              className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-100 dark:border-green-800 cursor-pointer hover:border-green-400 dark:hover:border-green-500 hover:shadow-sm transition-all"
            >
              <span className="block text-2xl font-bold text-green-700 dark:text-green-400">{spellCount}</span>
              <span className="text-xs text-green-600 dark:text-green-300 uppercase font-semibold">Spells</span>
            </div>
            <div 
              onClick={() => openCategory('Trap')}
              className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded border border-pink-100 dark:border-pink-800 cursor-pointer hover:border-pink-400 dark:hover:border-pink-500 hover:shadow-sm transition-all"
            >
              <span className="block text-2xl font-bold text-pink-700 dark:text-pink-400">{trapCount}</span>
              <span className="text-xs text-pink-600 dark:text-pink-300 uppercase font-semibold">Traps</span>
            </div>
            <div 
              onClick={() => openCategory('Extra')}
              className="bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all"
            >
              <span className="block text-2xl font-bold text-gray-700 dark:text-gray-300">{extraCount}</span>
              <span className="text-xs text-gray-600 dark:text-gray-400 uppercase font-semibold">Extra Deck</span>
            </div>
            <div 
              onClick={() => openCategory('Skill')}
              className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all"
            >
              <span className="block text-2xl font-bold text-blue-700 dark:text-blue-400">{skillCount}</span>
              <span className="text-xs text-blue-600 dark:text-blue-300 uppercase font-semibold">Skills</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Modal View
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden border border-gray-200 dark:border-gray-700">
        
        {/* Left Panel: Content */}
        <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {filterCategory ? `Edit Starting ${filterCategory}s` : 'Edit Loadout'}
              </h2>
              {!filterCategory && (
                <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab('cards')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'cards' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Cards
                  </button>
                  <button
                    onClick={() => setActiveTab('skills')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'skills' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Skills
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {activeTab === 'cards' ? (
            <>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for cards to add..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                  />
                  <div className="absolute left-3 top-3.5 text-gray-400 dark:text-gray-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Filters</div>
                    <button onClick={() => setFilterOpen(true)} className="text-sm px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">Open Filters</button>
                    {filterOpen && (
                      <DeckFiltersPanel
                        isDark={isDark}
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
                        resetAll={resetAll}
                        onCancel={() => setFilterOpen(false)}
                      />
                    )}
                  </div>
                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (() => {
                    return (
                      <div className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-[60vh] overflow-y-auto">
                        {(isEnrichingResults) && (
                          <div className="p-4 text-sm text-gray-500">Loading filtered results...</div>
                        )}
                        {!isEnrichingResults && filteredSearchResults.length === 0 && (
                          <div className="p-4 text-sm text-gray-500">No results</div>
                        )}
                        {filteredSearchResults.map(card => (
                          <button
                            key={card.id}
                            onClick={() => addCard(card)}
                            onMouseEnter={async (e) => { const enriched = await enrichCard(card); setHoveredCard(enriched); const key = String(card.id || card.konamiId || ''); setHoverTooltip({ visible: true, x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY, idKey: key, cardLike: enriched, skills: [] }) }}
                            onMouseMove={(e) => { if (hoverTooltip?.visible) setHoverTooltip((h: any)=> ({ ...h, x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY })); }}
                            onMouseLeave={() => { setHoveredCard(null); setHoverTooltip({ visible: false }); }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                          >
                            <div style={{ width: 40, flexShrink: 0 }}>
                              <CardImage src={(card as any).artworkUrl || (card as any).imageUrlCropped || getImageUrl(card.konamiId)} card={card} konamiId={card.konamiId} alt={card.name} />
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white">{card.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{card.type}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
                {deck.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-lg font-medium">Your list is empty</p>
                    <p className="text-sm">Search for cards above to add them.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {renderCardList('Monster')}
                    {renderCardList('Spell')}
                    {renderCardList('Trap')}
                    {renderCardList('Extra')}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 dark:text-gray-200">Starting Skills</h3>
                <button 
                  onClick={handleAddSkill}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  + Add Skill
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {skills.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <p className="text-lg font-medium">No skills added</p>
                    <p className="text-sm">Add bonus skills for this class.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {skills.map(skill => (
                      <div key={skill.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 transition-all group relative">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                          <button 
                            onClick={() => handleEditSkill(skill)}
                            className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
                          >
                            ✎
                          </button>
                          <button 
                            onClick={() => handleDeleteSkill(skill.id)}
                            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-1">{skill.name}</h4>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          <RichTextRenderer 
                            content={skill.description} 
                            requirements={skill.statRequirements as any}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Card Preview (Only visible in Cards tab) */}
        {activeTab === 'cards' && (
          <div className="w-96 md:w-1/3 bg-gray-100 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 w-full text-center">Card Preview</h3>
            {hoveredCard ? (
                  <div className="w-full flex-1 flex flex-col min-h-0">
                      <CardPreview card={hoveredCard} skills={effectiveSkills} className="w-full h-full" />
                    </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-center text-sm">
                Hover over a card to see details
              </div>
            )}
          </div>
        )}
      </div>

      {/* Skill Form Modal */}
      <SkillForm
        isOpen={isSkillFormOpen}
        onClose={() => setIsSkillFormOpen(false)}
        onSave={handleSaveSkill}
        initialSkill={editingSkill}
        formatVariant={formatVariant}
      />
      <HoverTooltip hoverTooltip={hoverTooltip} cardDetailsCacheRef={cardCache} tooltipScrollRef={tooltipScrollRef} onTooltipEnter={() => {}} onTooltipLeave={() => {}} />
    </div>
  )
}
