import React from 'react'
import LootPoolTile from './LootPoolTile'
import LootPoolPurchaseButton from './LootPoolPurchaseButton'
import RandomPurchaseButton from './RandomPurchaseButton'

interface Props {
  keyId: string
  tier: string
  isGeneric: boolean
  poolsInGroup: any[]
  player: any
  openPoolViewer?: (pool: any) => void
  animatingOutGroups: Set<string>
  frozenPools: Record<string, any[]>
  groupNodeRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  loading: boolean
  lootExitPhase: boolean
  call: (action: string, data?: any, opts?: any) => Promise<any>
  setPlayer: (p: any) => void
  setFrozenPools: React.Dispatch<React.SetStateAction<Record<string, any[]>>>
  setAnimatingOutGroups: React.Dispatch<React.SetStateAction<Set<string>>>
  suppressStageEffectRef: React.MutableRefObject<boolean>
}

export default function LootPoolGroup({
  keyId,
  tier,
  isGeneric,
  poolsInGroup,
  player,
  openPoolViewer,
  animatingOutGroups,
  frozenPools,
  groupNodeRefs,
  loading,
  lootExitPhase,
  call,
  setPlayer,
  setFrozenPools,
  setAnimatingOutGroups,
  suppressStageEffectRef,
}: Props) {
  const tierLabel = isGeneric
    ? ({ STARTER: 'Staples', MID: 'Removal/Disruption', HIGH: 'Engine' } as any)[tier] || tier
    : ({ STARTER: 'Starter Packs', MID: 'Mid Quality', HIGH: 'High Quality' } as any)[tier] || tier

  const purchases = player?.shopState?.purchases || []
  const categoryStock = (poolsInGroup || []).filter((p: any) => !purchases.some((pur: any) => String(pur.lootPoolId) === String(p.id))).length
  // Show the group header even if all pools in the category have been purchased
  // (this allows the UI to display Starter Packs headers and empty/refill slots).
  // Previously we hid the whole group when categoryStock === 0 which made
  // starter-class groups disappear entirely.

  const isRefilled = (poolsInGroup || []).some(
    (p: any) => !p.__seen && !purchases.some((pur: any) => String(pur.lootPoolId) === String(p.id))
  )

  const animationName = animatingOutGroups.has(keyId) ? 'fadeOut' : isRefilled ? 'slideInFromRight' : 'flyUp'

  return (
    <div
      className="mb-14"
      style={{
        animation: `${animationName} 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
        animationDelay: animatingOutGroups.has(keyId) ? '0s' : `${0.1 * (tier === 'STARTER' ? 0 : tier === 'MID' ? 1 : 2)}s`,
        opacity: 0,
        pointerEvents: animatingOutGroups.has(keyId) ? 'none' : 'auto',
      }}
    >
      <div
        className={`flex items-center justify-between mb-4 border-b-2 ${
          tier === 'STARTER' ? 'border-blue-500/30' : tier === 'MID' ? 'border-purple-500/30' : 'border-amber-500/30'
        } pb-2`}
      >
        <h3
          className={`text-2xl font-black ${
            tier === 'STARTER' ? 'text-blue-400' : tier === 'MID' ? 'text-purple-400' : 'text-amber-400'
          } tracking-tight uppercase`}
        >
          {tierLabel}
        </h3>

              <div className="flex items-center gap-2">
                <LootPoolPurchaseButton
          tier={tier}
          isGeneric={isGeneric}
          poolsInGroup={poolsInGroup}
          groupKey={keyId}
          loading={loading}
          lootExitPhase={lootExitPhase}
          call={call}
          setPlayer={setPlayer}
          setFrozenPools={setFrozenPools}
          setAnimatingOutGroups={setAnimatingOutGroups}
          groupNodeRefs={groupNodeRefs}
          player={player}
          suppressStageEffectRef={suppressStageEffectRef}
        />
                <RandomPurchaseButton
                  tier={tier}
                  isGeneric={isGeneric}
                  poolsInGroup={poolsInGroup}
                  groupKey={keyId}
                  loading={loading}
                  lootExitPhase={lootExitPhase}
                  call={call}
                  setPlayer={setPlayer}
                  setFrozenPools={setFrozenPools}
                  setAnimatingOutGroups={setAnimatingOutGroups}
                  groupNodeRefs={groupNodeRefs}
                  player={player}
                  suppressStageEffectRef={suppressStageEffectRef}
                />
              </div>
      </div>

      <div
        ref={(el) => {
          try { groupNodeRefs.current[keyId] = el } catch (e) {}
        }}
        className="relative"
      >
        {lootExitPhase && (
          <div
            className="flex flex-wrap gap-4 absolute inset-0 z-10 transition-all duration-700 ease-in"
            style={{ transform: 'translateX(-120vw)', opacity: 0 }}
          >
            {poolsInGroup.map((pool: any) => (
              <div key={`exit-${pool.id}`} className="opacity-60 grayscale scale-95">
                <LootPoolTile pool={pool} onSelect={() => {}} isPurchased={true} />
              </div>
            ))}
          </div>
        )}

        <div className={`flex flex-wrap gap-4 transition-opacity duration-300 ${lootExitPhase ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {(() => {
            const basePools = animatingOutGroups.has(keyId) ? (frozenPools[keyId] || []) : poolsInGroup
            const purchasedList = Array.isArray(player?.shopState?.purchases) ? player.shopState.purchases : []
            const isPurchasedId = (id: any) => purchasedList.some((p: any) => String(p.lootPoolId) === String(id))

            // If the group is animating out, show the frozen pools as-is (for animation continuity).
            // Otherwise, show all pools (including ones already purchased) but mark them as purchased
            // so the UI can render a claimed/disabled state instead of hiding the group entirely.
            const displayPools = basePools

            return displayPools.map((pool: any) => {
              const isPurchased = animatingOutGroups.has(keyId) ? false : isPurchasedId(pool.id)
              return (
                <LootPoolTile
                  key={pool.id}
                  pool={pool}
                  isPurchased={isPurchased}
                  loading={loading}
                  onSelect={() => {
                    try { console.debug('[SHOP DEBUG] LootPoolGroup invoking openPoolViewer', { poolId: pool?.id, keyId, hasHandler: typeof openPoolViewer === 'function' }) } catch (e) {}
                    try {
                      if (typeof openPoolViewer === 'function') {
                        try { console.trace('[SHOP DEBUG] calling openPoolViewer') } catch (e) {}
                        openPoolViewer(pool)
                      } else {
                        try { console.warn('[SHOP DEBUG] openPoolViewer is not a function', { typeof: typeof openPoolViewer }) } catch (e) {}
                      }
                    } catch (e) {
                      try { console.error('[SHOP DEBUG] openPoolViewer call failed', e) } catch (err) {}
                    }
                  }}
                />
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}
