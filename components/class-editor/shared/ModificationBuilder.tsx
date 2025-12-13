import React, { useState, useEffect } from 'react'
import { Card, SkillModification } from '../../../types/class-editor'
import CardDescription from './CardDescription'
import { CARD_IMAGE_BASE_URL } from '../../../lib/constants'

const getImageUrl = (konamiId: number) => `${CARD_IMAGE_BASE_URL}/${konamiId}.jpg`

interface ModificationBuilderProps {
  isOpen: boolean
  onClose: () => void
  onSave: (mod: SkillModification) => void
  initialModification?: Partial<SkillModification> | null
  title?: string
}

export default function ModificationBuilder({ 
  isOpen, 
  onClose, 
  onSave, 
  initialModification,
  title = 'Add Card Modification'
}: ModificationBuilderProps) {
  const [activeModification, setActiveModification] = useState<Partial<SkillModification>>({})
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setActiveModification(initialModification || {})
      setSearchQuery('')
      setSearchResults([])
    }
  }, [isOpen, initialModification])

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true)
        try {
          const res = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}`)
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
  }, [searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {!activeModification.card ? (
            <div className="space-y-4">
              <div className="text-center space-y-2 mb-8">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Select a Card to Modify</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Search for the card you want to apply modifications to.</p>
              </div>

              <div className="relative max-w-md mx-auto">
                <input
                  type="text"
                  placeholder="Search card name..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-11 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {isSearching ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Searching...</div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 max-w-md mx-auto mt-4">
                  {searchResults.map(card => (
                    <button
                      key={card.id}
                      onClick={() => setActiveModification({ card })}
                      className="flex items-center p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all text-left group"
                    >
                      <div className="w-10 h-14 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 mr-3 shadow-sm">
                        <img src={getImageUrl(card.konamiId)} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">{card.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{card.type}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No cards found</div>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left: Card Preview */}
              <div>
                <div className="sticky top-0">
                  <img 
                    src={getImageUrl(activeModification.card.konamiId)} 
                    alt={activeModification.card.name} 
                    className="w-48 rounded-lg shadow-md mb-4"
                  />
                  <div className="w-full space-y-2 text-sm">
                    <div className="font-bold text-gray-900 dark:text-white text-lg">{activeModification.card.name}</div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400 font-mono text-xs">
                      <span>{activeModification.card.type}</span>
                      {activeModification.card.level && <span>Level {activeModification.card.level}</span>}
                    </div>
                    {activeModification.card.atk !== undefined && (
                      <div className="flex justify-between text-gray-700 dark:text-gray-300 font-mono font-bold">
                        <span>ATK/{activeModification.card.atk === -1 ? '?' : activeModification.card.atk}</span>
                        {activeModification.card.def !== undefined && <span>DEF/{activeModification.card.def === -1 ? '?' : activeModification.card.def}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setActiveModification({})}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline mt-2"
                >
                  Change Card
                </button>
              </div>

              {/* Right: Modification Settings */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modification Type</label>
                  <div className="grid grid-cols-1 gap-2">
                    {['NEGATE', 'ALTER', 'CONDITION'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setActiveModification(prev => ({ ...prev, type: type as any }))}
                        className={`px-4 py-3 rounded-lg border text-left transition-all ${
                          activeModification.type === type 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500 ring-1 ring-blue-500 dark:ring-blue-500' 
                            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-400'
                        }`}
                      >
                        <div className="font-bold text-gray-900 dark:text-white">
                          {type === 'NEGATE' && 'Negates Effect'}
                          {type === 'ALTER' && 'Alters Effect'}
                          {type === 'CONDITION' && 'Adds Condition'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {type === 'NEGATE' && 'Select text to negate specific parts of the effect.'}
                          {type === 'ALTER' && 'Select text to change how the effect works.'}
                          {type === 'CONDITION' && 'Add a condition or requirement to the card.'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {activeModification.type && (
                  <div className="space-y-2">
                    {activeModification.type === 'CONDITION' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Condition Description</label>
                        <textarea
                          value={activeModification.note || ''}
                          onChange={(e) => setActiveModification(prev => ({ ...prev, note: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g. Must include in your Deck"
                          rows={3}
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          This text will be displayed with a yellow exclamation mark on the card.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Select Text to Modify
                          </label>
                          {activeModification.highlightedText && (
                            <button 
                              onClick={() => setActiveModification(prev => ({ ...prev, highlightedText: undefined }))}
                              className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                            >
                              Clear Selection
                            </button>
                          )}
                        </div>
                        
                        <div 
                          className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-sm leading-relaxed cursor-text select-text relative"
                          onMouseUp={() => {
                            const selection = window.getSelection()
                            if (selection && selection.toString().trim().length > 0) {
                              setActiveModification(prev => ({ ...prev, highlightedText: selection.toString() }))
                            }
                          }}
                        >
                          {/* Use CardDescription for preview, but we need to construct a temporary skill/mod object */}
                          <CardDescription 
                            card={activeModification.card} 
                            modifications={[activeModification as SkillModification]} 
                          />
                        </div>
                        
                        {activeModification.highlightedText && (
                          <div className="space-y-3">
                            <div className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Text selected!
                            </div>

                            {activeModification.type === 'ALTER' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Replacement Text</label>
                                <textarea
                                  value={activeModification.alteredText || ''}
                                  onChange={(e) => setActiveModification(prev => ({ ...prev, alteredText: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  placeholder="Type the new text here..."
                                  rows={3}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800">Cancel</button>
          <button 
            disabled={!activeModification?.card || !activeModification?.type}
            onClick={() => {
              if (activeModification?.card && activeModification?.type) {
                onSave(activeModification as SkillModification)
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Modification
          </button>
        </div>
      </div>
    </div>
  )
}
