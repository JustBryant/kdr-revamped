import React from 'react'
import CardPreview from './CardPreview'
import ShopHistoryItem from './ShopHistoryItem'
import StatBox from '../common/StatBox'

type Props = {
  statPoints: number
  displayedStats: Record<string, number> | null
  currentLevel: number
  player: any
  shopHistory: any[]
  selectedCard?: any | null
  call?: (action: string, payload?: any) => Promise<any>
  setPlayer?: (p: any) => void
}

const UserPanel: React.FC<Props> = ({ statPoints, displayedStats, currentLevel, player, shopHistory, selectedCard }) => {

  return (
    <>
      <div className="col-span-12 lg:col-span-3 space-y-6 p-6">
      <div className="p-4 bg-white/6 dark:bg-white/6 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg">
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
        <div className="mt-3 text-sm text-gray-500">Level {currentLevel + 1} — {player?.xp ?? 0} XP</div>
        <div className="text-sm text-gray-500">Gold: {player?.gold ?? 0}</div>
      </div>

      <div className="p-4 bg-white/6 dark:bg-white/6 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg h-[48vh] overflow-auto">
        <div className="text-sm text-gray-500 mb-2">Shop History</div>
        <div className="w-full h-[calc(100%-28px)] overflow-auto pr-2">
          {shopHistory.length === 0 ? (
            <div className="text-sm text-gray-400">No shop events yet.</div>
          ) : (
            <div className="space-y-3">
              {shopHistory.map((h: any, i: number) => (
                <ShopHistoryItem key={h.ts + '-' + i} item={h} player={player} />
              ))}
            </div>
          )}
        </div>
      </div>

        {/* Card preview removed - use hover tooltips instead */}
      </div>
      {/* SellModal now rendered at page level */}
    </>
  )
}

export default UserPanel
