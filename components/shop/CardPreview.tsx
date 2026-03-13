import React from 'react'

type Props = {
  card?: any | null
}

const CardPreview: React.FC<Props> = ({ card }) => {
  if (!card) return null
  const img = card.imageUrl || card.imageUrlSmall || card.image || null
  return (
    <div className="p-3 border rounded bg-white dark:bg-white/5 border-gray-100 dark:border-transparent">
      <div className="font-bold mb-2">{card.name || 'Card'}</div>
      {img ? <img src={img} alt={card.name || 'Card'} className="w-full h-auto object-cover" /> : <div className="text-sm text-gray-400">No image</div>}
      {card.rarity && <div className="text-xs text-gray-500 mt-2">Rarity: {card.rarity}</div>}
    </div>
  )
}

export default CardPreview
