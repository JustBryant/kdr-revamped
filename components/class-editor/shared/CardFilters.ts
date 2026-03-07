// Centralized filter logic and option lists for card filtering.
export const ATTRIBUTES = ['LIGHT','DARK','WATER','FIRE','EARTH','WIND','DIVINE'] as const
export const TYPES = [
  'Spellcaster','Dragon','Zombie','Warrior','Beast-Warrior','Beast','Winged Beast','Machine',
  'Fiend','Fairy','Insect','Dinosaur','Reptile','Fish','Sea Serpent','Aqua',
  'Pyro','Thunder','Rock','Plant','Psychic','Wyrm','Cyberse','Divine-Beast','Illusion'
] as const
export const ARROWS = ['NW','N','NE','W','E','SW','S','SE'] as const

export type LinkArrow = typeof ARROWS[number]

export type CardFiltersState = {
  selectedSubtypes?: string[]
  selectedAttributes?: string[]
  selectedTypes?: string[]
  selectedLevels?: number[]
  selectedAbilities?: string[]
  selectedPendulumScales?: number[]
  selectedLinkRatings?: number[]
  selectedLinkArrows?: string[]
  linkArrowsMode?: 'AND'|'OR'
  atkMin?: number
  atkMax?: number
  defMin?: number
  defMax?: number
}

const normalizeToken = (s: string) => s.toString().toLowerCase().replace(/[^a-z0-9]/g, '')

const detectMainType = (c: any) => {
  const token = ((c.cardType || c.type || c.categories || '')).toString().toLowerCase()
  if (/\bspell\b/.test(token) || token.includes('spell card')) return 'Spell'
  if (/\btrap\b/.test(token) || token.includes('trap card')) return 'Trap'
  return 'Monster'
}

export const cardHasType = (c: any, type: string) => {
  const raw = ((c.race || '') + ' ' + (c.type || '') + ' ' + (c.cardType || '') + ' ' + (c.categories || '')).toString()
  const cardTok = normalizeToken(raw)
  const selTok = normalizeToken(type)
  return cardTok.includes(selTok)
}

export const cardHasLevel = (c: any, lv: number) => {
  const v = c.level ?? c.rank ?? null
  if (v == null) return false
  const n = parseInt(String(v), 10)
  return !Number.isNaN(n) && n === lv
}

export const cardHasLinkRating = (c: any, n: number) => {
  const v = c.linkRating ?? c.link ?? c.linkval ?? null
  if (v == null) return false
  const num = parseInt(String(v), 10)
  return !Number.isNaN(num) && num === n
}

export const cardHasLinkArrow = (c: any, dir: string) => {
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

export const cardHasAbility = (c: any, ability: string) => {
  const txt = ((c.abilities || c.categories || c.type || c.desc || c.description || '')).toString().toLowerCase()
  return txt.includes(ability.toLowerCase().replace(' ', '-')) || txt.includes(ability.toLowerCase())
}

export const cardHasSubtype = (c: any, subtype: string) => {
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

export const matchCard = (c: any, s: CardFiltersState) => {
  if (!c) return false
  if (!s) return true

  if (s.selectedAttributes && s.selectedAttributes.length > 0) {
    const attr = (c.attribute || '').toString().trim().toUpperCase()
    if (!s.selectedAttributes.some(a => String(a).toString().trim().toUpperCase() === attr)) return false
  }

  if (s.selectedTypes && s.selectedTypes.length > 0) {
    if (!s.selectedTypes.some((t) => cardHasType(c, t))) return false
  }

  if (s.selectedSubtypes && s.selectedSubtypes.length > 0) {
    if (!s.selectedSubtypes.some(st => cardHasSubtype(c, st))) return false
  }

  if (s.selectedLevels && s.selectedLevels.length > 0) {
    if (!s.selectedLevels.some(lv => cardHasLevel(c, lv))) return false
  }

  if (s.selectedLinkRatings && s.selectedLinkRatings.length > 0) {
    if (!s.selectedLinkRatings.some(r => cardHasLinkRating(c, r))) return false
  }

  if (s.selectedLinkArrows && s.selectedLinkArrows.length > 0) {
    if (s.linkArrowsMode === 'AND') {
      if (!s.selectedLinkArrows.every(a => cardHasLinkArrow(c, a))) return false
    } else {
      if (!s.selectedLinkArrows.some(a => cardHasLinkArrow(c, a))) return false
    }
  }

  if (s.selectedAbilities && s.selectedAbilities.length > 0) {
    if (!s.selectedAbilities.some(a => cardHasAbility(c, a))) return false
  }

  if (s.selectedPendulumScales && s.selectedPendulumScales.length > 0) {
    const ps = (c as any).pendulumScale ?? (c as any).scale ?? (c as any).pendulum ?? null
    if (ps == null) return false
    const n = parseInt(String(ps), 10)
    if (Number.isNaN(n)) return false
    if (!s.selectedPendulumScales.includes(n)) return false
  }

  if ((s.atkMin && s.atkMin > 0) || (s.atkMax && s.atkMax < 5000)) {
    const min = s.atkMin ?? 0
    const max = s.atkMax ?? 5000
    const v = c.atk ?? c.atkValue ?? null
    if (v == null) return false
    const n = parseInt(String(v), 10)
    if (Number.isNaN(n)) return false
    if (n < min || n > max) return false
  }

  if ((s.defMin && s.defMin > 0) || (s.defMax && s.defMax < 5000)) {
    const min = s.defMin ?? 0
    const max = s.defMax ?? 5000
    const v = c.def ?? c.defValue ?? null
    if (v == null) return false
    const n = parseInt(String(v), 10)
    if (Number.isNaN(n)) return false
    if (n < min || n > max) return false
  }

  return true
}

export const filterCards = (cards: any[], s: CardFiltersState) => cards.filter(c => matchCard(c, s))
