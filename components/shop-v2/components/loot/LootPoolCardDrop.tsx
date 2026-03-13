import React, { useState, useEffect } from 'react'
import CardImage from '../../../common/CardImage'

interface Card {
  id: string
  name: string
  konamiId?: number | null
}

interface LootPoolCardDropProps {
  pool: {
    id: string
    name: string
    tier: string
    isGeneric?: boolean
    tax: number
    cost: number
    cards: Card[]
  }
  /** Progress of the drop animation (0 to 1) */
  dropProgress: number
  /** Whether to start the card reveal animation */
  shouldAnimate?: boolean
  onPreview?: (card: Card) => void
  onSelect?: () => void
}

export default function LootPoolCardDrop({ 
  pool, 
  dropProgress, 
  shouldAnimate = false,
  onPreview, 
  onSelect 
}: LootPoolCardDropProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [revealProgress, setRevealProgress] = useState(0)
  
  const cards = pool.cards || []
  const displayCards = cards.slice(0, 3) // Show up to 3 cards
  
  // Start reveal animation when shouldAnimate becomes true
  useEffect(() => {
    if (!shouldAnimate) return
    
    const revealDuration = 800 // ms
    const steps = 40
    
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        setRevealProgress(i / steps)
      }, (i * revealDuration) / steps)
    }
  }, [shouldAnimate])
  
  // Calculate the drop distance - cards should appear to come from the line
  const cardHeight = 140 // approximate height of card in pixels
  const cardSpacing = 30 // spacing between cards
  
  return (
    <div
      className="relative cursor-pointer transition-transform"
      style={{
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect?.()}
    >
      {/* Container for the cards */}
      <div className="flex gap-2 items-start" style={{ minHeight: '160px' }}>
        {displayCards.map((card, index) => {
          // Stagger the drops slightly
          const staggerDelay = index * 0.1
          const adjustedProgress = Math.max(0, Math.min(1, (dropProgress - staggerDelay) / (1 - staggerDelay)))
          
          // Cards start at y = -cardHeight (fully above) and drop down
          const yPos = -cardHeight + (adjustedProgress * cardHeight)
          
          // Rotation effect for visual interest
          const rotation = (index - 1) * 5 * (1 - adjustedProgress)
          
          // Scale up slightly as they drop for emphasis
          const scale = 0.8 + (adjustedProgress * 0.2)
          
          return (
            <div
              key={card.id || index}
              className="relative"
              style={{
                transform: `translateY(${yPos}px) rotate(${rotation}deg) scale(${scale})`,
                opacity: adjustedProgress,
                transition: 'none',
                zIndex: displayCards.length - index, // Cards in front have higher z-index
              }}
              onMouseEnter={() => onPreview?.(card)}
            >
                  <CardImage
                    card={card}
                    alt={card.name}
                    className="w-24 h-auto rounded shadow-lg"
                    style={{
                      filter: `brightness(${1 + revealProgress * 0.3}) drop-shadow(0 0 ${revealProgress * 20}px rgba(255, 255, 255, ${revealProgress * 0.5}))`,
                    }}
                  />
            </div>
          )
        })}
        
        {cards.length > 3 && (
          <div
            className="flex items-center justify-center text-white font-bold text-sm bg-gray-800/80 rounded px-2 py-1"
            style={{
              transform: `translateY(${-cardHeight + (dropProgress * cardHeight)}px)`,
              opacity: dropProgress,
              transition: 'none',
            }}
          >
            +{cards.length - 3}
          </div>
        )}
      </div>
      
      {/* Pool info below the cards */}
      {dropProgress >= 0.5 && (
        <div 
          className="mt-2 text-center"
          style={{
            opacity: Math.max(0, (dropProgress - 0.5) * 2),
          }}
        >
          <div className="text-sm font-semibold text-white">{pool.name}</div>
          <div className="text-xs text-gray-400">{pool.cost} Gold</div>
        </div>
      )}
    </div>
  )
}
