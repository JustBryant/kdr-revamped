import React from 'react'
import { useShopContext } from '../../ShopContext'

export default function FinishShopButton({ className }: { className?: string }) {
  const { player, loading, finishLootPhase, lootExitPhase } = useShopContext()

  const handleFinish = async () => {
    if (!player) return
    if (!finishLootPhase) return
    try {
      try { (window as any).__shopLootExitPhase = true } catch (e) {}
      await finishLootPhase()
      try { (window as any).__shopLootExitPhase = false } catch (e) {}
    } catch (e) {
      // noop
    }
  }

  // Only render when in LOOT stage
  const stage = player?.shopState?.stage || 'START'
  if (stage !== 'LOOT') return null

  return (
    <button
      onClick={handleFinish}
      disabled={loading || lootExitPhase}
      className={`${className || ''} bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-emerald-500/10 min-w-[160px]`}
      style={{ transform: 'translateZ(0)' }}
    >
      <span className="text-lg font-black uppercase tracking-tighter">{lootExitPhase || loading ? 'Finishing...' : 'Finish Shop'}</span>
    </button>
  )
}
