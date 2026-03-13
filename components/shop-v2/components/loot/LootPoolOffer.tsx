import React, { useState } from 'react'

interface Card {
  id: string
  name: string
  konamiId?: number | null
  imageUrlCropped?: string | null
  variant?: string
  artworks?: any
  primaryArtworkIndex?: number | null
}

interface LootPoolOfferProps {
  pool: {
    id: string
    name: string
    tier: string
    isGeneric?: boolean
    tax: number
    cost: number
    cards: Card[]
    items: any[]
  }
  shouldAnimate?: boolean
  flippedCards?: number[]
  onBuy: (itemId: string, qty: number) => void
  onPreview?: (card: Card) => void
  onSelect?: () => void
}

const LootPoolOffer: React.FC<LootPoolOfferProps> = ({ pool, shouldAnimate = false, flippedCards = [], onBuy, onPreview, onSelect }) => {
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  const cards = pool.cards || []

  return (
    <div 
      className="relative inline-block transition-transform cursor-pointer"
      style={{ 
        minWidth: '300px', 
        minHeight: '200px',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect?.()}
    >
      {/* Card Spread Display */}
      <div className="relative">
        {cards.length > 0 && (
          <div className="flex justify-center items-center" style={{ minHeight: '200px' }}>
          </div>
        )}
      </div>
    </div>
  )
}

export default LootPoolOffer
