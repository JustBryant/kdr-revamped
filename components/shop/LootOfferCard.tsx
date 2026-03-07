import React from 'react'

type Props = {
  offer: any
  lootQty: number
  onQtyChange: (v: number) => void
  onBuy: () => void
  onPreview?: (card: any | null) => void
}

const LootOfferCard: React.FC<Props> = ({ offer, lootQty, onQtyChange, onBuy, onPreview }) => {
  const title = offer.card?.name || offer.skill?.name || offer.id
  const category = offer.category || 'Unknown'
  const tier = offer.tier || 'STARTER'
  
  return (
    <div className="p-3 border rounded bg-white dark:bg-white/5 border-gray-100 dark:border-transparent">
      <div className="font-bold text-lg mb-1">{title}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{category}</div>
      <div className="text-xs text-gray-600 dark:text-gray-500 mb-2">Tier: {tier}</div>
      <div className="mt-2 flex items-center gap-2">
        <input 
          type="number" 
          min={1} 
          value={lootQty} 
          onChange={(e) => onQtyChange(Number(e.target.value||1))} 
          className="w-20 border p-1 rounded bg-white dark:bg-gray-800 text-black dark:text-white" 
        />
        <button className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium" onClick={onBuy}>
          Buy
        </button>
        {typeof onPreview === 'function' && (
          <button className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded" onClick={() => onPreview(offer.card || null)}>
            Preview
          </button>
        )}
      </div>
    </div>
  )
}

export default LootOfferCard
