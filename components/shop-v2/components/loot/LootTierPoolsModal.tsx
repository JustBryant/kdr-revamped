import React, { useMemo, useState } from 'react'
import AnimatedModal from '../../../common/AnimatedModal'
import LootPoolTile from './LootPoolTile'
import LootPoolDetailModal from './LootPoolDetailModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  purchasedPools?: any[]
  seenPools?: any[]
  title?: string
}

export default function LootTierPoolsModal({ isOpen, onClose, purchasedPools, seenPools, title }: Props) {
  const [selectedPool, setSelectedPool] = useState<any | null>(null)

  const bought = useMemo(() => Array.isArray(purchasedPools) ? purchasedPools : [], [purchasedPools])
  const seen = useMemo(() => Array.isArray(seenPools) ? seenPools : [], [seenPools])

  if (!isOpen) return null

  return (
    <AnimatedModal onClose={onClose} overlayClassName="bg-black/40" className="max-w-5xl p-6">
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-xl font-black text-white">{title || 'Pools'}</h3>
        <button className="text-sm text-gray-400" onClick={(e) => { e.stopPropagation(); onClose(); }}>Close</button>
      </div>

      {bought.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-black text-white mb-2">Purchased</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bought.map((pool: any) => (
              <div key={pool.id} className="p-2">
                <div onClick={() => setSelectedPool(pool)}>
                  <LootPoolTile pool={pool} onSelect={() => setSelectedPool(pool)} isPurchased={true} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {seen.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-black text-white mb-2">Seen</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seen.map((pool: any) => (
              <div key={pool.id} className="p-2">
                <div onClick={() => setSelectedPool(pool)}>
                  <LootPoolTile pool={pool} onSelect={() => setSelectedPool(pool)} isPurchased={!!pool.__purchased} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bought.length === 0 && seen.length === 0 && (
        <div className="text-gray-400">No pools to show</div>
      )}

      {selectedPool && (
        <LootPoolDetailModal
          pool={selectedPool}
          onClose={() => setSelectedPool(null)}
        />
      )}
    </AnimatedModal>
  )
}
