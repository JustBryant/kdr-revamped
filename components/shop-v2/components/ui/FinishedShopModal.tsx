import React from 'react'
import AnimatedModal from '../../../common/AnimatedModal'
import { useShopContext } from '../../ShopContext'

type Props = {
  open: boolean
  onClose: () => void
}

export default function FinishedShopModal({ open, onClose }: Props) {
  const { player } = useShopContext()
  const award = (player?.shopState as any)?.shopAward || null
  const purchases = Array.isArray((player?.shopState as any)?.purchases) ? (player!.shopState as any).purchases : []
  const interestAmount = Number((player?.shopState as any)?.interestAmount || 0)

  return (
    <AnimatedModal open={open} onClose={onClose} className="max-w-lg p-6">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6 w-full text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-black italic uppercase tracking-tighter">Shop Finished</h3>
          <button onClick={onClose} className="text-sm text-gray-300 hover:text-white">Close</button>
        </div>

        {award ? (
          <div className="mb-4">
            <div className="text-sm text-gray-300">Round Reward</div>
            <div className="mt-2 text-lg font-bold">+{award.gold || 0} gold{award.xp ? ` • +${award.xp} XP` : ''}</div>
          </div>
        ) : null}

        {interestAmount > 0 ? (
          <div className="mb-4">
            <div className="text-sm text-gray-300">Interest</div>
            <div className="mt-2 text-lg font-bold">+{interestAmount} gold</div>
          </div>
        ) : null}

        {purchases.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-300">Purchases</div>
            <ul className="mt-2 space-y-2">
              {purchases.map((p: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm text-gray-200">
                  <span>{p.name || p.itemName || p.id || 'Purchase'}</span>
                  <span className="text-gray-400">-{p.cost ?? p.gold ?? p.price ?? 0}g</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md font-bold">Continue</button>
        </div>
      </div>
    </AnimatedModal>
  )
}
