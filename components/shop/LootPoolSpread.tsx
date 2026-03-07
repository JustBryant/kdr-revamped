import React from 'react'
import CardImage from '../common/CardImage'

interface Card {
  id: string
  name: string
  konamiId?: number | null
}

interface LootPoolSpreadProps {
  cards: Card[]
  maxCards?: number
  className?: string
  onCardHover?: (card: Card | null) => void
  hasSkills?: boolean
}

/**
 * Displays cards in a spread/stacked layout where they overlap slightly
 * but are still visible. Great for showing loot pool contents.
 */
const LootPoolSpread: React.FC<LootPoolSpreadProps> = ({ 
  cards, 
  maxCards = 6,
  className = '',
  onCardHover,
  hasSkills = false
}) => {
  // HARD CAP at 6 cards maximum
  const displayCards = cards.slice(0, Math.min(6, maxCards))
  const remainingCount = Math.max(0, cards.length - 6)
  const [isFanned, setIsFanned] = React.useState(false)

  // Simple horizontal spread with even spacing when fanned
  const getCardStyle = (index: number, total: number, fanned: boolean): React.CSSProperties => {
    if (!fanned) {
      // Stacked: all cards overlaid with slight offset for depth
      return {
        position: 'absolute',
        left: '50%',
        bottom: '10px',
        transform: 'translateX(-50%) rotate(0deg)',
        zIndex: index,
        transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }
    } else {
      // Fanned: arc upward with rotation - consistent spacing
      const maxCards = 6
      const fanSpread = 60 // Total degrees of arc
      const fanRadius = 200
      
      // Always spread across the same arc positions
      const anglePerSlot = fanSpread / (maxCards - 1)
      const centerOffset = (maxCards - total) / 2
      const cardPosition = index + centerOffset
      const angle = (cardPosition * anglePerSlot - fanSpread / 2) * (Math.PI / 180)
      
      // Position along arc - outer cards progressively move down
      const x = Math.sin(angle) * fanRadius
      const y = (1 - Math.cos(angle)) * fanRadius * 1.2 // Increased multiplier for more downward movement
      
      // Rotation
      const rotation = angle * (180 / Math.PI)
      
      return {
        position: 'absolute',
        left: '50%',
        bottom: '10px',
        transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${rotation}deg)`,
        zIndex: index,
        transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }
    }
  }

  const totalWidth = 300 // Fixed width container

  return (
    <div 
      className={`relative ${className}`} 
      style={{ width: `${totalWidth}px`, height: '180px' }}
      onMouseEnter={() => setIsFanned(true)}
      onMouseLeave={() => setIsFanned(false)}
    >
      {displayCards.map((card, index) => (
        <div
          key={card.id}
          style={getCardStyle(index, displayCards.length, isFanned)}
          className="card-in-spread"
        >
          <CardImage
            konamiId={card.konamiId}
            card={card}
            alt={card.name}
            useLootArt={true}
            className="w-20 rounded shadow-lg border-2 border-gray-600 transition-all duration-200"
          />
        </div>
      ))}
      
      {/* Indicators overlaid on deck */}
      {remainingCount > 0 && (
        <div 
          className="absolute top-1 right-1 bg-gray-900/95 text-white px-2 py-1 rounded-md font-bold text-xs shadow-lg border border-gray-500"
          style={{ zIndex: 1000 }}
        >
          +{remainingCount}
        </div>
      )}
      
      {hasSkills && (
        <div 
          className="absolute top-1 left-1 bg-purple-600/95 text-white px-2 py-1 rounded-md font-bold text-xs shadow-lg border border-purple-400"
          style={{ zIndex: 1000 }}
          title="Contains skills"
        >
          ⚡ Skills
        </div>
      )}

      <style jsx>{`
        .card-in-spread {
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

export default LootPoolSpread
