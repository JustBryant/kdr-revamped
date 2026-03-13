import React from 'react'
import { selectArtworkUrl } from '../../../common/CardImage'

interface LootPoolTileProps {
  pool: any
  onSelect: () => void
  isPurchased?: boolean
  loading?: boolean
}

const LootPoolTile: React.FC<LootPoolTileProps> = ({ pool, onSelect, isPurchased = false, loading = false }) => {
  const isGeneric = !!pool.isGeneric
  const tier = (pool.tier || 'STARTER').toUpperCase()
  const genericTierMap: Record<string, string> = { 'STARTER': 'STAPLES', 'MID': 'REMOVAL/DISRUPTION', 'HIGH': 'ENGINE' }
  const displayTier = isGeneric ? genericTierMap[tier] : tier

  const tierColors: Record<string, any> = {
    'STARTER': { border: 'border-blue-500/40', bg: 'bg-blue-500/5', text: 'text-blue-400', glow: 'shadow-blue-500/20', accent: 'bg-blue-500' },
    'MID': { border: 'border-purple-500/40', bg: 'bg-purple-500/5', text: 'text-purple-400', glow: 'shadow-purple-500/20', accent: 'bg-purple-500' },
    'HIGH': { border: 'border-amber-500/40', bg: 'bg-amber-500/5', text: 'text-amber-400', glow: 'shadow-amber-500/20', accent: 'bg-amber-500' },
    'REMOVAL/DISRUPTION': { border: 'border-purple-500/40', bg: 'bg-purple-500/5', text: 'text-purple-400', glow: 'shadow-purple-500/20', accent: 'bg-purple-500' },
    'STAPLES': { border: 'border-blue-500/40', bg: 'bg-blue-500/5', text: 'text-blue-400', glow: 'shadow-blue-500/20', accent: 'bg-blue-500' },
    'ENGINE': { border: 'border-amber-500/40', bg: 'bg-amber-500/5', text: 'text-amber-400', glow: 'shadow-amber-500/20', accent: 'bg-amber-500' }
  }

  const style = tierColors[displayTier] || tierColors['STARTER']
  const cardCount = Array.isArray(pool.cards) ? pool.cards.length : 0
  const skillCount = Array.isArray(pool.items) ? pool.items.filter((i: any) => i.type === 'Skill').length : 0
  const goldValue = Array.isArray(pool.items) ? pool.items.reduce((acc: number, i: any) => acc + (i.type === 'Gold' ? (i.amount || 0) : 0), 0) : 0
  const sampleCards = Array.isArray(pool.cards) ? pool.cards.slice(0, 3) : []

  return (
    <div
      onClick={onSelect}
      className={`relative group cursor-pointer w-[340px] h-[160px] rounded-xl border-2 ${isPurchased ? 'border-emerald-500/40 opacity-80' : style.border} bg-[#0a0a0c] overflow-hidden flex flex-col p-0 transition-all hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] shadow-2xl ${style.glow}`}
    >
      <div className={`h-1.5 w-full ${isPurchased ? 'bg-emerald-500' : style.accent} opacity-80`} />
      <div className="flex-1 p-3 flex flex-col overflow-hidden">
        <div className="flex items-start justify-between mb-2">
          <div className="flex flex-col">
            <h4 className="text-white font-bold text-base leading-tight group-hover:text-amber-200 transition-colors truncate max-w-[200px]">
              {pool.name || (isGeneric ? 'Generic Loot' : 'Class Loot')}
            </h4>
          </div>
          {isPurchased && (
            <div className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border border-emerald-500/30">
              Claimed
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 my-2">
          {sampleCards.length > 0 ? (
            sampleCards.map((card: any, idx: number) => {
              const imgSrc = selectArtworkUrl(card, null, { useLootArt: false }) || card.imageUrlCropped || card.image || card.imageUrl
              return (
                <div key={card.id || idx} className="w-16 h-20 rounded bg-black border border-white/10 overflow-hidden flex flex-col items-center justify-center relative group/card shadow-lg">
                  {imgSrc ? (
                    <img src={imgSrc} alt={card.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="p-1 text-[8px] text-white/40 text-center leading-tight">{card.name}</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <p className="text-[6px] text-white text-center truncate px-0.5">{card.name}</p>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="w-full h-20 rounded border border-dashed border-white/5 flex items-center justify-center text-[10px] text-white/10 uppercase font-bold italic">Contains Random Content</div>
          )}
          {cardCount > 3 && (
            <div className="w-8 h-20 rounded bg-black/60 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/40 shadow-inner">+{cardCount - 3}</div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1 mt-auto pt-2 border-t border-white/5">
          <div className="flex items-center justify-center gap-1.5"><span className="text-[10px] font-bold text-white/60">{cardCount} Cards</span></div>
          <div className="flex items-center justify-center gap-1.5 border-x border-white/5"><span className="text-[10px] font-bold text-white/60">{skillCount} Skills</span></div>
          <div className="flex items-center justify-center gap-1.5"><span className="text-[10px] font-bold text-white/60">{goldValue > 0 ? `${goldValue}G` : '-'}</span></div>
        </div>
      </div>

      <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {loading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-xl z-20"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white" /></div>
      )}
    </div>
  )
}

export default LootPoolTile
