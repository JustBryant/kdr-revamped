import React from 'react'
import CardImage from '../common/CardImage'
import { CARD_BACK_URL } from '../../lib/constants'

interface Card {
  id: string
  name: string
  konamiId?: number | null
  imageUrlCropped?: string | null
  variant?: string
  artworks?: any
  primaryArtworkIndex?: number | null
}

interface LootPoolArcProps {
  cards: Card[]
  maxCards?: number
  className?: string
  onCardHover?: (card: Card | null) => void
  whiteOverlayOpacity?: number
  flippedCards?: number[]
}

/**
 * Displays cards in a static arc layout (no animation on hover)
 * Shows at most 3 cards arranged in an upward arc.
 */
const LootPoolArc: React.FC<LootPoolArcProps> = ({ 
  cards, 
  maxCards = 3,
  className = '',
  onCardHover,
  whiteOverlayOpacity = 0,
  flippedCards = [],
}) => {
  // Display up to maxCards (capped at 3)
  const displayCards = cards.slice(0, Math.min(3, maxCards))

  const getCardStyle = (index: number, total: number): React.CSSProperties => {
    const fanSpread = 40 // Total degrees of arc
    const fanRadius = 180
    
    // Calculate angle for this card
    const anglePerSlot = total > 1 ? fanSpread / (total - 1) : 0
    const angle = total > 1 
      ? (index * anglePerSlot - fanSpread / 2) * (Math.PI / 180)
      : 0
    
    // Position along arc
    const x = Math.sin(angle) * fanRadius
    const y = (1 - Math.cos(angle)) * fanRadius * 1.2
    
    // Rotation
    const rotation = angle * (180 / Math.PI)
    
    return {
      position: 'absolute',
      left: '50%',
      bottom: '40px',
      transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${rotation}deg)`,
      zIndex: index,
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    }
  }

  return (
    <div 
      className={`relative group/arc ${className}`} 
      style={{ width: '300px', height: '180px' }}
    >
      {displayCards.map((card, index) => {
        const isFlipped = flippedCards.includes(index)
        
        return (
          <div
            key={card.id}
            style={{
              ...getCardStyle(index, displayCards.length),
              width: '85px', // slightly larger
              height: '120px' 
            }}
            className="group/card-hover filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] hover:scale-110 hover:z-50 transition-all duration-300"
            onMouseEnter={() => onCardHover?.(card)}
            onMouseLeave={() => onCardHover?.(null)}
          >
            <div 
              className="relative w-full h-full rounded-md ring-1 ring-white/10 transition-all"
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Card Back (visible when not flipped) */}
              <div
                className="w-full h-full"
                style={{
                  position: 'absolute',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <CardImage
                  src={CARD_BACK_URL}
                  alt="Card Back"
                  className="w-full h-full rounded shadow-lg border-2 border-gray-600"
                />
              </div>

              {/* Card Front (visible when flipped) */}
              <div
                className="w-full h-full"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <CardImage
                  card={card}
                  alt={card.name}
                  useLootArt={true}
                  className="w-full h-full rounded shadow-lg border-2 border-gray-600"
                />
                {/* White overlay on this specific card */}
                {whiteOverlayOpacity > 0 && (
                  <div
                    className="absolute inset-0 rounded"
                    style={{
                      backgroundColor: `rgba(255, 255, 255, ${whiteOverlayOpacity})`,
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default LootPoolArc
