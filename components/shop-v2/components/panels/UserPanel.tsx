import ShopHistory from './ShopHistory'
import StatBox from '../panels/StatBox'
import { useShopContext } from '../../ShopContext'
import React, { useRef, useEffect } from 'react'
import { computeLevel } from '../../../../lib/shopHelpers'

type Props = {
  statPoints?: number
  displayedStats?: Record<string, number> | null
  currentLevel?: number
  player?: any
  shopHistory?: any[]
  selectedCard?: any | null
}

export default function UserPanel(props?: Props) {
  const ctx = useShopContext()
  const player = props?.player ?? ctx.player
  const kdr = (ctx as any).kdr
  const defaults: any = { levelXpCurve: [0, 100, 300, 600, 1000] }
  const settings = kdr ? (kdr.settingsSnapshot ? { ...defaults, ...(kdr.settingsSnapshot || {}) } : (kdr.format && kdr.format.gameSettings ? { ...defaults, ...(kdr.format.gameSettings || {}) } : defaults)) : defaults

  const statPoints = Number(typeof props?.statPoints !== 'undefined' ? props!.statPoints : ((player?.shopState && typeof player.shopState.statPoints !== 'undefined') ? player.shopState.statPoints : (player?.shopState?.statPoints ?? 0) || 0))
  const displayedStats = props?.displayedStats ?? ((player?.shopState && (player.shopState as any).stats) ? (player.shopState as any).stats : (player?.stats || {}))
  const currentLevel = typeof props?.currentLevel !== 'undefined' ? props.currentLevel : ((player && typeof player.xp === 'number') ? computeLevel(Number(player.xp || 0), settings.levelXpCurve) : 0)
  const shopHistory = props?.shopHistory ?? (player?.shopState?.history || [])
  const historyRef = useRef<HTMLDivElement | null>(null)

  // auto-scroll to bottom when history updates
  useEffect(() => {
    try {
      const el = historyRef.current
      if (!el) return
      // small timeout to allow DOM updates
      window.setTimeout(() => {
        try { el.scrollTop = el.scrollHeight } catch (e) {}
      }, 50)
    } catch (e) {}
  }, [shopHistory?.length])

  const xp = Number(player?.xp || 0)
  const currentLevelXp = (settings.levelXpCurve && settings.levelXpCurve.length > currentLevel) ? settings.levelXpCurve[currentLevel] : 0
  const nextLevelXp = (settings.levelXpCurve && settings.levelXpCurve.length > (currentLevel + 1)) ? settings.levelXpCurve[currentLevel + 1] : (currentLevelXp + 100)
  const xpInLevel = Math.max(0, xp - currentLevelXp)
  const xpToNext = Math.max(0, nextLevelXp - xp)
  const xpPercent = nextLevelXp === currentLevelXp ? 100 : Math.round((xpInLevel / Math.max(1, nextLevelXp - currentLevelXp)) * 100)

  return (
    <>
      <div className="col-span-12 lg:col-span-3 p-6 h-full flex flex-col">
        <div className="p-4 bg-white/6 dark:bg-white/6 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg" style={{ transform: 'translateY(0)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">User Stats</div>
            <div className="ml-3 flex items-center space-x-2">
              <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-semibold ${statPoints > 0 ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-200'}`}>
                Stat Points: {statPoints}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            <StatBox
              label="DEX"
              value={displayedStats?.dex ?? 0}
              color="#d97706"
              description={`(Once per Duel) (Quick Effect): You can draw 1 card. You can activate this effect one time per every 4 DEX you have.`}
            />
            <StatBox
              label="CON"
              value={displayedStats?.con ?? 0}
              color="#10b981"
              description={`Each point in CON adds 500LP to your starting LP. (Once per turn): If a monster you control would be destroyed by battle, it is not (this is a mandatory effect). You can activate this effect one time per every 3 CON you have.`}
            />
            <StatBox
              label="STR"
              value={displayedStats?.str ?? 0}
              color="#fb7185"
              description={`(Once per turn): Your monsters gain 100 ATK for every two STR you have.`}
            />
            <StatBox
              label="INT"
              value={displayedStats?.int ?? 0}
              color="#0ea5e9"
              description={`Your minimum Deck size is reduced by 1 per INT you have.`}
            />
            <StatBox
              label="CHA"
              value={displayedStats?.cha ?? 0}
              color="#8b5cf6"
              description={`You can re-roll all your shown Loot Pools in your Shop one time per every 2 CHA you have.`}
            />
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 text-white shadow-sm">
                  Level {currentLevel + 1}
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-400 mr-2">XP</div>
                  <div className="w-40 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                    <div className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" style={{ width: `${xpPercent}%`, transition: 'width 420ms cubic-bezier(.2,.9,.2,1)' }} />
                  </div>
                  <div className="text-xs text-gray-300 ml-2 font-mono">{xp}/{nextLevelXp}</div>
                </div>
              </div>
              </div>
              <div className="mt-2 flex items-center justify-start gap-3">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-400 text-black font-bold shadow-md">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                  <circle cx="12" cy="12" r="10" fill="#f59e0b" />
                  <path d="M12 7v10M7 12h10" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm">{player?.gold ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white/6 dark:bg-white/6 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg overflow-auto flex-1" style={{ marginTop: '12px' }}>
          <div className="text-sm text-gray-500 mb-2">Shop History</div>
          <div className="w-full h-[calc(100%-28px)] overflow-auto pr-2" ref={historyRef}>
            <div style={{ minHeight: '60px' }}>
              {/* Use dedicated ShopHistory component to handle sorting/deduping */}
              <ShopHistory history={shopHistory} player={player} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
