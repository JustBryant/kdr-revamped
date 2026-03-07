import React, { useState, useEffect } from 'react'
import CardImage, { selectArtworkUrl } from '../common/CardImage'

interface Card {
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

interface LegendaryMonsterPickerProps {
  selectedCard: Card | null
  onChange: (card: Card | null) => void
}

export default function LegendaryMonsterPicker({ selectedCard, onChange }: LegendaryMonsterPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const setSelectedCard = (card: Card | null) => {
    onChange(card)
  }

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true)
        try {
          const res = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}`)
          const data = await res.json()
          // Filter for monsters only? The user said "Legendary Monster", but maybe they want any card? 
          // Usually "Monster" implies type Monster. I'll stick to generic search for now but maybe filter in UI if needed.
          setSearchResults(data)
          setShowResults(true)
        } catch (error) {
          console.error('Error searching cards:', error)
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults([])
        setShowResults(false)
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const selectCard = (card: Card) => {
    setSelectedCard(card)
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
  }

  const getImageUrl = (konamiId: number) => selectArtworkUrl(undefined, konamiId) || undefined

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-fit sticky top-8">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Legendary Monster</h2>
      
      {!selectedCard ? (
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search monster..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map(card => (
                <button
                  key={card.id}
                  onClick={() => selectCard(card)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center space-x-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                    <CardImage card={card} konamiId={card.konamiId} alt={card.name} className="w-full object-cover" />
                  </div>
                  <div className="truncate">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{card.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{card.type}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          <div className="mt-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center bg-gray-50 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">No Legendary Monster selected</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="relative w-full mb-4 rounded-lg overflow-hidden shadow-md group">
            <CardImage card={selectedCard} konamiId={selectedCard.konamiId} alt={selectedCard.name} className="w-full h-auto block" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button 
                onClick={() => setSelectedCard(null)}
                className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium"
              >
                Change
              </button>
            </div>
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-center mb-1">{selectedCard.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">{selectedCard.type}</p>
          {selectedCard.atk !== undefined && (
             <div className="flex space-x-3 text-sm font-mono font-bold mb-3">
                <span className="text-red-700 dark:text-red-400">ATK/{selectedCard.atk === -1 ? '?' : selectedCard.atk}</span>
                {selectedCard.def !== undefined && <span className="text-blue-700 dark:text-blue-400">DEF/{selectedCard.def === -1 ? '?' : selectedCard.def}</span>}
             </div>
          )}
          
          <div className="w-full text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-serif bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-100 dark:border-gray-700 text-left max-h-60 overflow-y-auto">
            {selectedCard.desc}
          </div>
        </div>
      )}
    </div>
  )
}
