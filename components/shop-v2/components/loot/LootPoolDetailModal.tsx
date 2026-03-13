import React, { useRef } from 'react'
import CardImage from '../../../common/CardImage'
import HoverTooltip from '../HoverTooltip'
import AnimatedModal, { AnimatedModalHandle } from '../../../common/AnimatedModal'

 interface Card {
  id: string
  name: string
  konamiId?: number | null
  imageUrlCropped?: string | null
  variant?: string
  artworks?: any
  primaryArtworkIndex?: number | null
}

interface LootPool {
  id: string
  name: string
  tier: string
  isGeneric?: boolean
  tax: number
  cost: number
  cards: Card[]
  items: any[]
}

interface LootPoolDetailModalProps {
  pool: LootPool
  onClose: () => void
  showHover?: (e: any, cardLike?: any, idKey?: any, skills?: any[]) => void
  moveHover?: (e: any) => void
  hideHover?: () => void
  onTooltipWheel?: (e: any) => void
  hoverTooltip?: any
  cardDetailsCacheRef?: React.MutableRefObject<Record<string, any>>
  tooltipScrollRef?: React.RefObject<HTMLDivElement | null>
  ensureCardDetails?: (cardLike: any) => Promise<any>
  onPurchase?: (pool: any) => Promise<void>
  loading?: boolean
  onNext?: () => void
  onPrev?: () => void
}

const LootPoolDetailModal: React.FC<LootPoolDetailModalProps> = ({ 
  pool, 
  onClose,
  showHover,
  moveHover,
  hideHover,
  onTooltipWheel,
  hoverTooltip,
  cardDetailsCacheRef,
  tooltipScrollRef,
  ensureCardDetails
  , onPurchase, loading,
  onNext,
  onPrev
}) => {
  // Pre-fetch all card details when modal opens
  React.useEffect(() => {
    const cards = Array.isArray(pool?.cards) ? pool.cards : []
    if (ensureCardDetails && cards.length) {
      cards.forEach(card => {
        ensureCardDetails(card).catch(() => {})
      })
    }
  }, [pool.cards, ensureCardDetails])
  
  // DEBUG: Log what we receive
  console.log('=== MODAL RECEIVED POOL ===')
  console.log('Pool name:', pool.name)
  console.log('Pool items:', pool.items)
  console.log('Skills found:', pool.items?.filter((item: any) => item.type === 'Skill'))
  console.log('Full pool object:', pool)
  
  const cards = Array.isArray(pool?.cards) ? pool.cards : []
  const skills = pool.items?.filter((item: any) => item.type === 'Skill') || []
  const goldRewards = pool.items?.filter((item: any) => item.type === 'Gold') || []
  const isBought = !!(pool as any).__purchased
  const getTierLabel = (tier: string, isGeneric?: boolean) => {
    if (isGeneric) {
      const genericLabels: Record<string, string> = {
        'STARTER': 'Staples',
        'MID': 'Removal/Disruption',
        'HIGH': 'Engine'
      }
      return genericLabels[tier] || tier
    } else {
      const classLabels: Record<string, string> = {
        'STARTER': 'Starter Packs',
        'MID': 'Mid Quality',
        'HIGH': 'High Quality'
      }
      return classLabels[tier] || tier
    }
  }
  const tierLabel = getTierLabel(String(pool?.tier || '').toUpperCase(), !!pool?.isGeneric)
  
  // Convert skill items to proper Skill type with modifications
  const skillsForModifications = skills.map((skillItem: any) => {
    const skill = skillItem.skill // Full skill object from API
    if (skill && skill.id) {
      // We have a full skill with modifications
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        isSellable: skill.isSellable ?? true,
        modifications: skill.modifications || []
      }
    } else {
      // Legacy: only skillName and skillDescription
      return {
        id: skillItem.id,
        name: skillItem.skillName,
        description: skillItem.skillDescription,
        isSellable: true,
        modifications: []
      }
    }
  })

  const modalRef = useRef<AnimatedModalHandle>(null)
  const EXIT_MS = 380
  const requestClose = () => { 
    onClose()
  }

  return (
    <AnimatedModal 
      ref={modalRef} 
      onClose={onClose} 
      overlayClassName="bg-black/40 dark:bg-black/90 backdrop-blur-sm" 
      className="relative bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-white/10 rounded-2xl p-8 max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden mx-auto shadow-2xl dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] z-[10001]"
    >

        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/5 dark:bg-blue-600/10 blur-[80px] pointer-events-none" />

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => { 
            e.stopPropagation(); 
            requestClose();
          }}
          className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-black/10 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/20 dark:hover:bg-white/20 transition-all border border-black/10 dark:border-white/10 z-[200]"
          aria-label="Close Modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="relative mb-8">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white mb-2">{pool.name}</h2>
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
            <span className="text-blue-600 dark:text-blue-400">{tierLabel}</span>
            <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />
            {!isBought ? (
              <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <span className="text-[10px]">COST:</span> {pool.cost}G
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                PURCHASED
              </span>
            )}
            {pool.tax > 0 && (
              <span className="text-red-500 flex items-center gap-1">
                <span className="text-[10px]">TAX:</span> +{pool.tax}
              </span>
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="relative mb-10">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Cards ({cards.length})</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-200 dark:from-white/10 to-transparent"></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {cards.map((card) => {
              const idKey = card.id || (card.konamiId ? String(card.konamiId) : null)
              return (
                <div 
                  key={card.id || idKey}
                  className="flex flex-col items-center group cursor-pointer"
                  onMouseEnter={(e) => showHover?.(e, card, idKey, skillsForModifications)}
                  onMouseMove={(e) => moveHover?.(e)}
                  onMouseLeave={() => hideHover?.()}
                >
                  <div className="relative w-full aspect-[2/3] overflow-hidden rounded-lg shadow-lg group-hover:ring-2 group-hover:ring-blue-500/50 transition-all bg-black/20">
                    <CardImage
                      card={card}
                      alt={card.name}
                      useLootArt={true}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-2 text-center uppercase tracking-tight line-clamp-1 w-full group-hover:text-white transition-colors">{card.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Skills & Rewards */}
        {(skills.length > 0 || goldRewards.length > 0) && (
          <div className="relative mb-10">
            <div className="flex items-center gap-4 mb-6">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Skills</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-gray-200 dark:from-white/10 to-transparent"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {skills.map((skill: any, index: number) => (
                <div key={index} className="bg-purple-500/5 dark:bg-purple-500/10 rounded-xl p-5 border border-purple-500/20 dark:border-purple-500/30">
                  <div className="font-black italic uppercase tracking-tighter text-purple-700 dark:text-purple-300 text-base mb-2">{skill.skillName || skill.name}</div>
                  {(skill.skillDescription || skill.description) && (
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 leading-relaxed uppercase tracking-wide">{skill.skillDescription || skill.description}</div>
                  )}
                </div>
              ))}
              {goldRewards.map((gold: any, index: number) => (
                <div key={index} className="bg-yellow-500/5 dark:bg-yellow-500/10 rounded-xl p-5 border border-yellow-500/20 dark:border-yellow-500/30 flex items-center justify-between">
                  <span className="text-sm font-black italic uppercase tracking-tighter text-yellow-700 dark:text-yellow-400">Currency Reward</span>
                  <span className="text-lg font-black text-yellow-600 dark:text-yellow-400">+{gold.amount}G</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Buttons - Below content */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-gray-100 dark:border-white/5">
          <div className="flex-1" />

          <div className="flex-1 flex justify-end gap-3">
            {onPrev && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                className="p-4 px-6 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all group active:scale-95 flex items-center gap-3 font-black uppercase tracking-[0.2em] text-[10px]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Previous</span>
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                className="p-4 px-6 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all group active:scale-95 flex items-center gap-3 font-black uppercase tracking-[0.2em] text-[10px]"
              >
                <span>Next</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Hover Tooltip */}
      {hoverTooltip && cardDetailsCacheRef && tooltipScrollRef && (
        <HoverTooltip
          hoverTooltip={hoverTooltip}
          cardDetailsCacheRef={cardDetailsCacheRef}
          tooltipScrollRef={tooltipScrollRef}
        />
      )}
    </AnimatedModal>
  )
}

export default LootPoolDetailModal
