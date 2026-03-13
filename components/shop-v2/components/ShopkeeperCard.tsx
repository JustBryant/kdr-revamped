import React from 'react'
import { useShopContext } from '../ShopContext'

export default function ShopkeeperCard() {
  const { player } = useShopContext()
  const sk = (player && player.shopState && player.shopState.shopkeeper) || null

  if (!sk) return null
  return (
    <div className="shopkeeper-card bg-white/5 p-3 rounded flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
        {sk.image ? <img src={sk.image} alt={sk.name || 'Shopkeeper'} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-600" />}
      </div>
      <div className="flex-1 text-sm">
        <div className="font-semibold">{sk.name || 'Shopkeeper'}</div>
        {sk.greeting || sk.description || (player && player.shopState && player.shopState.shopkeeperGreeting) ? (
          <div className="text-xs text-gray-300 truncate">{sk.greeting || sk.description || player.shopState.shopkeeperGreeting}</div>
        ) : null}
      </div>
    </div>
  )
}
