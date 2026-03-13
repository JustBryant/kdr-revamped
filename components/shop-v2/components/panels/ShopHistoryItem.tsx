import React from 'react'

type Props = {
  item: any
  player?: any
}

const ShopHistoryItem: React.FC<Props> = ({ item, player }) => {
  const label = (player && player.shopState && player.shopState.shopkeeper && player.shopState.shopkeeper.name) || 'Shopkeeper'
  return (
    <div className="p-2 rounded bg-white/2 border border-gray-200 dark:border-transparent">
      <div className="text-xs text-gray-400">{new Date(item.ts).toLocaleTimeString()}</div>
      <div className="text-sm mt-1">
        {item.type === 'award' ? (
          <><strong className="text-amber-300">Award:</strong> {item.text}</>
        ) : item.type === 'level' ? (
          <><strong className="text-amber-400">Level:</strong> {item.text}</>
        ) : item.type === 'skill' ? (
          <><strong className="text-emerald-300">Skill:</strong> {item.text}</>
        ) : item.type === 'train' ? (
          <><strong className="text-indigo-300">Train:</strong> {item.text}</>
        ) : (
          <><strong className="text-sky-300">{label}</strong>: {item.text}</>
        )}
      </div>
    </div>
  )
}

export default ShopHistoryItem
