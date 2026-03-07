export interface Card {
  id: string
  konamiId: number
  name: string
  type: string
  desc: string
  atk?: number
  def?: number
  level?: number
  race?: string
  attribute?: string
}

export interface DeckCard extends Card {
  quantity: number
  category: 'Monster' | 'Spell' | 'Trap' | 'Extra'
}

export interface SkillModification {
  id: string
  card: Card
  type: 'NEGATE' | 'ALTER' | 'CONDITION'
  highlightedText?: string
  alteredText?: string
  note?: string
}

export interface Skill {
  id: string
  name: string
  description: string
  isSellable: boolean
  modifications: SkillModification[]
  providesCards?: Card[]
  type: 'MAIN' | 'TIP' | 'GENERIC' | 'UNIQUE'
  uniqueRound?: number
}

export type Tier = 'STARTER' | 'MID' | 'HIGH'

export interface LootPoolItem {
  id: string
  type: 'Card' | 'Skill'
  card?: Card
  skill?: Skill
}

export interface LootPool {
  id: string
  name: string
  tier: Tier
  items: LootPoolItem[]
  tax?: number
}
