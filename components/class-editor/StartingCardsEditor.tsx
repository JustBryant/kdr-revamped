import React, { useState, useEffect } from 'react'
import { Card, DeckCard, Skill, SkillModification } from '../../types/class-editor'
import CardDescription from './shared/CardDescription'
import SkillForm from './shared/SkillForm'
import { CARD_IMAGE_BASE_URL } from '../../lib/constants'

// Alias for backward compatibility if needed, but prefer Skill
export type StartingSkill = Skill

interface StartingCardsEditorProps {
  deck: DeckCard[]
  onChange: (deck: DeckCard[]) => void
  skills: Skill[]
  onSkillsChange: (skills: Skill[]) => void
}

export default function StartingCardsEditor({ deck, onChange, skills, onSkillsChange }: StartingCardsEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'cards' | 'skills'>('cards')
  const [filterCategory, setFilterCategory] = useState<'Monster' | 'Spell' | 'Trap' | 'Extra' | null>(null)
  
  // Card Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null)

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

  const handleAddSkill = () => {
    setEditingSkill(null)
    setIsSkillFormOpen(true)
  }

  const handleEditSkill = (skill: Skill) => {
    setEditingSkill(skill)
    setIsSkillFormOpen(true)
  }

  const handleSaveSkill = (skill: Skill) => {
    if (editingSkill) {
      setSkills(prev => prev.map(s => s.id === editingSkill.id ? skill : s))
    } else {
      setSkills(prev => [...prev, { ...skill, id: Date.now().toString() }])
    }
    setIsSkillFormOpen(false)
  }

  const handleDeleteSkill = (id: string) => {
    setSkills(prev => prev.filter(s => s.id !== id))
  }

  const getCardCategory = (type: string): 'Monster' | 'Spell' | 'Trap' | 'Extra' => {
    const lowerType = type.toLowerCase()
    if (lowerType.includes('fusion') || lowerType.includes('synchro') || lowerType.includes('xyz') || lowerType.includes('link')) {
      return 'Extra'
    }
    if (lowerType.includes('spell')) return 'Spell'
    if (lowerType.includes('trap')) return 'Trap'
    return 'Monster'
  }

  const addCard = (card: Card) => {
    const category = getCardCategory(card.type)
    
    setDeck(prev => {
      if (prev.some(c => c.id === card.id)) return prev
      return [...prev, { ...card, quantity: 1, category }]
    })
    setSearchQuery('')
    setSearchResults([])
  }

  const removeCard = (cardId: string) => {
    setDeck(prev => prev.filter(c => c.id !== cardId))
  }


  const getImageUrl = (konamiId: number) => `${CARD_IMAGE_BASE_URL}/${konamiId}.jpg`

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
    
    const cards = deck.filter(c => c.category === category)
    
    if (cards.length === 0) return null

    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            {category}s
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
          {cards.map(card => (
            <div 
              key={card.id} 
              className="group relative flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-md hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              onMouseEnter={() => setHoveredCard(card)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-12 h-16 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                  <img 
                    src={getImageUrl(card.konamiId)} 
                    alt={card.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/card-back.jpg' }} 
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">{card.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{card.type}</div>
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
                  
                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-[60vh] overflow-y-auto">
                      {searchResults.map(card => (
                        <button
                          key={card.id}
                          onClick={() => addCard(card)}
                          onMouseEnter={() => setHoveredCard(card)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                        >
                          <div className="w-10 h-14 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                            <img 
                              src={getImageUrl(card.konamiId)} 
                              alt={card.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/card-back.jpg' }}
                            />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">{card.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{card.type}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{skill.description}</p>
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
          <div className="w-64 bg-gray-100 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 w-full text-center">Card Preview</h3>
            {hoveredCard ? (
              <div className="w-full">
                <img 
                  src={getImageUrl(hoveredCard.konamiId)} 
                  alt={hoveredCard.name} 
                  className="w-full rounded-lg shadow-lg mb-4"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/card-back.jpg' }}
                />
                <div className="space-y-2 text-sm">
                  <div className="font-bold text-gray-900 dark:text-white">{hoveredCard.name}</div>
                  <div className="text-gray-600 dark:text-gray-400">{hoveredCard.type}</div>
                  {hoveredCard.atk !== undefined && (
                    <div className="flex justify-between text-gray-700 dark:text-gray-300 font-mono">
                      <span>ATK/{hoveredCard.atk === -1 ? '?' : hoveredCard.atk}</span>
                      {hoveredCard.def !== undefined && <span>DEF/{hoveredCard.def === -1 ? '?' : hoveredCard.def}</span>}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-h-60 overflow-y-auto">
                    <CardDescription card={hoveredCard} skills={effectiveSkills} />
                  </div>
                  
                  {(() => {
                    const modifyingSkill = effectiveSkills.find(s => s.modifications?.some(m => m.card.id === hoveredCard.id));
                    if (modifyingSkill) {
                      return (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-blue-600 dark:text-blue-400">
                          Modified by: <span className="font-bold">{modifyingSkill.name || 'Current Skill'}</span>
                        </div>
                      )
                    }
                    return null;
                  })()}
                </div>
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
      />
    </div>
  )
}
