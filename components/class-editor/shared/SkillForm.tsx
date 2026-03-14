import React, { useState, useEffect } from 'react'
import { Card, Skill, SkillModification } from '../../../types/class-editor'
import ModificationBuilder from './ModificationBuilder'
import CardDescription from './CardDescription'
import CardPreview from './CardPreview'
import CardImage, { selectArtworkUrl } from '../../common/CardImage'
import StatRequirementEditor from './StatRequirementEditor'
import { RichTextRenderer } from '../../RichText'

const getImageUrl = (konamiId: number) => selectArtworkUrl(undefined, konamiId) || undefined

interface SkillFormProps {
  isOpen: boolean
  onClose: () => void
  onSave: (skill: Skill) => void
  initialSkill?: Partial<Skill> | null
  title?: string
  formatVariant?: string | null
}

export default function SkillForm({ 
  isOpen, 
  onClose, 
  onSave, 
  initialSkill,
  title = 'Edit Skill',
  formatVariant
}: SkillFormProps) {
  const [skillForm, setSkillForm] = useState<Partial<Skill>>({
    name: '',
    description: '',
    isSellable: true,
    modifications: [],
    providesCards: []
  })

  // Modification Builder State
  const [isModBuilderOpen, setIsModBuilderOpen] = useState(false)
  const [editingModIndex, setEditingModIndex] = useState<number | null>(null)
  const [activeModification, setActiveModification] = useState<Partial<SkillModification> | null>(null)

  // Card Search State (for Provides Card)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Hover State
  const [hoveredCard, setHoveredCard] = useState<{ card: Card, modification?: SkillModification } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    if (isOpen) {
      setSkillForm({
        name: initialSkill?.name || '',
        description: initialSkill?.description || '',
        isSellable: initialSkill?.isSellable ?? true,
        modifications: initialSkill?.modifications || [],
        providesCards: initialSkill?.providesCards || [],
        statRequirements: initialSkill?.statRequirements || [],
        ...initialSkill
      })
    }
  }, [isOpen, initialSkill])

  // Debounce search for Provides Card
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true)
        try {
          const variantParam = formatVariant ? `&variant=${encodeURIComponent(formatVariant)}` : ''
          const res = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}${variantParam}`)
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
  }, [searchQuery, formatVariant])

  const handleSaveModification = (mod: SkillModification) => {
    setSkillForm(prev => {
      const newMods = [...(prev.modifications || [])]
      if (editingModIndex !== null) {
        newMods[editingModIndex] = mod
      } else {
        newMods.push(mod)
      }
      return { ...prev, modifications: newMods }
    })
    setIsModBuilderOpen(false)
  }

  const handleSave = () => {
    if (!skillForm.name) return
    
    console.log('[SkillForm] Saving skill. Current state:', skillForm)
    
    // Ensure we send the full skill form including statRequirements
    const finalSkill: Skill = {
      id: skillForm.id || '',
      name: skillForm.name || '',
      description: skillForm.description || '',
      isSellable: skillForm.isSellable ?? true,
      modifications: skillForm.modifications || [],
      providesCards: skillForm.providesCards || [],
      type: skillForm.type || 'MAIN',
      uniqueRound: skillForm.uniqueRound,
      statRequirements: skillForm.statRequirements || []
    }
    
    console.log('[SkillForm] Final object sent to onSave:', finalSkill)
    onSave(finalSkill)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400">Edit skill details and scaling effects</div>
            </div>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">✕</button>
          </div>
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skill Name</label>
              <input
                type="text"
                value={skillForm.name}
                onChange={e => setSkillForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. Bonus Draw"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={skillForm.description}
                onChange={e => setSkillForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                placeholder="Skill effect... Use [if DEX>=4]text[/if] for stat-based effects."
              />
              <p className="mt-1 text-[10px] text-gray-500">
                You can highlight text in the description above to mark it as a "Stat Locked" section.
              </p>
            </div>

              {/* Options */}
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Options</h4>
                
                {/* Sellable Toggle */}
              <button
                onClick={() => setSkillForm(prev => ({ ...prev, isSellable: !prev.isSellable }))}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-md border transition-colors ${
                  skillForm.isSellable 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30' 
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                }`}
              >
                <span className="font-medium">Sellable</span>
                <span className="text-sm">{skillForm.isSellable ? 'Yes' : 'No'}</span>
              </button>

              {/* Modifies Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Modifies Cards</label>
                  <button 
                    onClick={() => {
                      setActiveModification({})
                      setEditingModIndex(null)
                      setIsModBuilderOpen(true)
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  >
                    + Add Modification
                  </button>
                </div>
                
                {skillForm.modifications && skillForm.modifications.length > 0 ? (
                  <div className="space-y-2">
                    {skillForm.modifications.map((mod, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md group relative cursor-default transition-colors"
                        onClick={() => {
                          setActiveModification(mod)
                          setEditingModIndex(idx)
                          setIsModBuilderOpen(true)
                        }}
                      >
                        <div style={{ width: 36, marginRight: 12, flexShrink: 0 }}>
                          <CardImage konamiId={mod.card.konamiId} card={mod.card} alt={mod.card.name} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">{mod.card.name}</div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            {mod.type === 'NEGATE' && 'Negates Effect'}
                            {mod.type === 'ALTER' && 'Alters Effect'}
                            {mod.type === 'CONDITION' && 'Adds Condition'}
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            setSkillForm(prev => ({
                              ...prev,
                              modifications: prev.modifications?.filter((_, i) => i !== idx)
                            }))
                          }}
                          className="absolute top-2 right-2 text-blue-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
                    No card modifications added
                  </div>
                )}
              </div>
              {/* Unique Round (for UNIQUE skills) */}
              {((skillForm.type === 'UNIQUE') || title.toLowerCase().includes('unique')) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unique Round (optional)</label>
                  <input
                    type="number"
                    value={skillForm.uniqueRound ?? ''}
                    onChange={e => setSkillForm(prev => ({ ...prev, uniqueRound: e.target.value === '' ? undefined : Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. 3"
                  />
                </div>
              )}

              {/* Provides Cards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Provides Cards</label>
                </div>
                
                {skillForm.providesCards && skillForm.providesCards.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {skillForm.providesCards.map((card, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md relative group cursor-default"
                      >
                        <div style={{ width: 36, marginRight: 12, flexShrink: 0 }}>
                          <CardImage konamiId={card.konamiId} card={card} alt={card.name} />
                        </div>
                        <div className="text-sm font-medium text-purple-900 dark:text-purple-100 truncate">{card.name}</div>
                        <button 
                          onClick={() => setSkillForm(prev => ({
                            ...prev,
                            providesCards: prev.providesCards?.filter((_, i) => i !== idx)
                          }))}
                          className="absolute top-2 right-2 text-purple-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search card provided..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map(card => (
                        <button
                          key={card.id}
                          onClick={() => {
                            setSkillForm(prev => ({ 
                              ...prev, 
                              providesCards: [...(prev.providesCards || []), card] 
                            }))
                            setSearchQuery('')
                            setSearchResults([])
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center text-gray-900 dark:text-white"
                        >
                          <span className="truncate">{card.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stat Requirements */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stat Requirements</label>
                  <button 
                    type="button"
                    onClick={() => setSkillForm(prev => ({ 
                      ...prev, 
                      statRequirements: [...(prev.statRequirements || []), { stat: 'STR', divisor: 1, template: '' }] 
                    }))}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  >
                    + Add Scaling Effect
                  </button>
                </div>

                {skillForm.statRequirements && skillForm.statRequirements.length > 0 ? (
                  <div className="space-y-2">
                    {skillForm.statRequirements.map((req, idx) => (
                      <div key={idx}>
                        <StatRequirementEditor
                          req={req}
                          onChange={(next) => {
                            const newReqs = [...(skillForm.statRequirements || [])]
                            newReqs[idx] = { ...newReqs[idx], ...next }
                            setSkillForm(prev => ({ ...prev, statRequirements: newReqs }))
                          }}
                          onRemove={() => setSkillForm(prev => ({ ...prev, statRequirements: prev.statRequirements?.filter((_, i) => i !== idx) }))}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-400 italic text-center py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
                    No stat requirements
                  </div>
                )}
              </div>
                </div>
              </div>

              <div className="lg:col-span-1 space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="text-sm font-semibold mb-2">Live Preview</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 max-h-[40vh] overflow-y-auto">
                    <RichTextRenderer content={skillForm.description || ''} stats={undefined} requirements={skillForm.statRequirements as any} />
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="text-sm font-semibold mb-2">Provides</div>
                  {skillForm.providesCards && skillForm.providesCards.length > 0 ? (
                    <div className="space-y-2">
                      {skillForm.providesCards.map((card, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div style={{ width: 40 }}>
                            <CardImage konamiId={card.konamiId} card={card} alt={card.name} />
                          </div>
                          <div className="text-sm truncate">{card.name}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">No cards provided</div>
                  )}
                </div>

                <div className="p-3 flex items-center justify-end gap-2">
                  <button onClick={onClose} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800">Cancel</button>
                  <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700">Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModificationBuilder
        isOpen={isModBuilderOpen}
        onClose={() => setIsModBuilderOpen(false)}
        onSave={handleSaveModification}
        initialModification={activeModification}
        title={editingModIndex !== null ? 'Edit Modification' : 'Add Card Modification'}
        formatVariant={formatVariant}
      />

      {/* Tooltip */}
      {hoveredCard && (
        <div
          className="fixed z-[70] w-72 pointer-events-none"
          style={{
            top: Math.min(mousePos.y + 20, (typeof window !== 'undefined' ? window.innerHeight : 1000) - 450),
            left: Math.min(mousePos.x + 20, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 320)
          }}
        >
          <CardPreview card={hoveredCard} className="w-72" />
        </div>
      )}
    </>
  )
}
