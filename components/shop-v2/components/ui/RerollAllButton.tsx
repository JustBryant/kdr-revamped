import React from 'react'
import { useShopContext } from '../../ShopContext'

type Props = {
  onRerollAll?: (e?: any) => Promise<void> | void
  className?: string
}

export default function RerollAllButton({ onRerollAll, className }: Props) {
  const { player, call, setPlayer, addHistory, rerollLoot, lootExitPhase, loading } = useShopContext()

  const handleClick = async (e: any) => {
    try {
      e && e.stopPropagation()
      if (loading || lootExitPhase) return
      const used = Number(player?.shopState?.rerollsUsed || 0)
      const cha = Math.floor(Number(player?.shopState?.stats?.cha || player?.stats?.cha || 0) / 2)
      if (used >= cha) {
        try { alert(`No rerolls remaining! (Used ${used}/${cha})`) } catch (err) {}
        return
      }

      // Allow parent hook to override full flow
      if (onRerollAll) {
        try {
          await onRerollAll(e)
        } catch (err) {}
        return
      }

      // Call server (use context helper which runs the exit animation)
      try {
        if (rerollLoot) {
          await rerollLoot()
        } else if (call) {
          const res = await call('rerollLoot')
          if (res && res.player) {
            try { setPlayer(res.player) } catch (err) {}
          }
        }

        try { addHistory && addHistory({ ts: Date.now(), type: 'reroll', text: 'You rerolled ALL shop offers.' }) } catch (e) {}
      } catch (e) {
        // noop
      }
    } catch (err) {
      // ignore
    }
  }

  const chaVal = Math.floor(Number(player?.shopState?.stats?.cha || player?.stats?.cha || 0) / 2)
  const used = Number(player?.shopState?.rerollsUsed || 0)
  if (!player || player?.shopState?.stage !== 'LOOT' || chaVal <= 0) return null

  return (
    <button
      onClick={handleClick}
      disabled={loading || lootExitPhase || used >= chaVal}
      className={className || "bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-black uppercase italic tracking-widest text-[10px] py-2 px-4 rounded-full flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all transform hover:scale-105 active:scale-95"}
    >
      <span className="text-sm">🎲</span>
      <span>Reroll All ({used}/{chaVal})</span>
    </button>
  )
}
