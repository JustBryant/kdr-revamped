import React from 'react'

export default function ItemCard({ item }: { item: any }) {
  if (!item) return null
  const title = item.name || item.card?.name || item.skill?.name || 'Item'
  const subtitle = item.rarity || item.skill?.description || ''
  return (
    <div className="bg-white dark:bg-gray-800 rounded shadow p-3">
      <div className="text-sm font-semibold">{title}</div>
      {subtitle ? <div className="text-xs text-gray-500">{subtitle}</div> : null}
    </div>
  )
}
