import React, { useRef } from 'react'
import AnimatedModal, { AnimatedModalHandle } from '../common/AnimatedModal'
import CardImage from '../common/CardImage'

type Props = {
  purchasedPoolsList: any[] | null
  player: any
  classDetails: any
  kdr: any
  purchasedModalContext: { tier: string, isClass: boolean } | null
  setPurchasedPoolsList: (val: any[] | null) => void
  setPurchasedModalContext: (val: { tier: string, isClass: boolean } | null) => void
  onClose: () => void
  openPoolViewer: (pool: any) => void
  ensureCardDetails?: (cardLike: any) => Promise<any>
}

export default function PurchasedSeenPoolsModal({ 
  purchasedPoolsList,
  player, 
  classDetails, 
  kdr, 
  purchasedModalContext, 
  setPurchasedPoolsList,
  setPurchasedModalContext,
  onClose, 
  openPoolViewer,
  ensureCardDetails
}: Props) {
  const [purchasedEntries, setPurchasedEntries] = React.useState<any[]>([])
  const [seenOnlyEntries, setSeenOnlyEntries] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  const seenIds = React.useMemo(() => {
    return Array.isArray(player?.shopState?.seen) ? player!.shopState.seen : []
  }, [player?.shopState?.seen])
  
  const poolsSource = React.useMemo(() => {
    return (classDetails?.lootPools || []).concat((kdr?.genericLootPools || []))
  }, [classDetails?.lootPools, kdr?.genericLootPools])

  const offersSource = React.useMemo(() => {
    return Array.isArray(player?.shopState?.lootOffers) ? player!.shopState.lootOffers : []
  }, [player?.shopState?.lootOffers])

  const enrichPool = React.useCallback(async (candidate: any) => {
    if (!candidate) return candidate
    let pool = candidate
    try {
      const found = poolsSource.find((lp: any) => String(lp.id) === String(candidate.id)) || 
                   offersSource.find((lp: any) => String(lp.id) === String(candidate.id))
      pool = { ...(found || candidate) }
      
      const cardsArr = Array.isArray(pool.cards) ? pool.cards : []
      if (cardsArr.length === 0 && Array.isArray(pool.items)) {
        const derived = pool.items.filter((it: any) => it.type === 'Card').map((it: any) => it.card).filter(Boolean)
        if (derived.length) pool.cards = derived
      }

      if (ensureCardDetails && Array.isArray(pool.cards)) {
        const results = await Promise.all(pool.cards.map(async (c: any) => {
          try {
            return await ensureCardDetails(c) || c
          } catch (e) { return c }
        }))
        pool.cards = results.filter(Boolean)
      }
    } catch (e) {}
    return pool
  }, [poolsSource, offersSource, ensureCardDetails])

  React.useEffect(() => {
    if (!purchasedModalContext) return
    
    let active = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const purchases = Array.isArray(player?.shopState?.purchases) ? player!.shopState.purchases : []
        const { tier, isClass } = purchasedModalContext

        // 1. Process Purchased
        const bought = await Promise.all(purchases
          .filter((p: any) => p && (p.lootPoolId || p.lootPoolId === 0))
          .map(async (p: any) => {
            const poolId = p.lootPoolId
            let poolBase = offersSource.find((lp: any) => String(lp.id) === String(poolId)) ||
                           poolsSource.find((lp: any) => String(lp.id) === String(poolId))
            if (!poolBase) return null
            if (poolBase.tier !== tier) return null
            if (isClass ? !!poolBase.isGeneric : !poolBase.isGeneric) return null
            
            const pool = await enrichPool(poolBase)
            const qty = (p.qty || (p.purchase && p.purchase.qty) || 1)
            return { pool, qty, purchase: p, __purchased: true }
          }))
        
        const filteredBought = bought.filter(Boolean)
        if (!active) return
        setPurchasedEntries(filteredBought)

        // 2. Process Seen
        const boughtIds = new Set(filteredBought.map((b: any) => String(b.pool.id)))
        const seen = await Promise.all(seenIds
          .filter((id: any) => !boughtIds.has(String(id)))
          .map(async (id: any) => {
            let poolBase = offersSource.find((lp: any) => String(lp.id) === String(id)) ||
                           poolsSource.find((lp: any) => String(lp.id) === String(id))
            if (!poolBase) return null
            if (poolBase.tier !== tier) return null
            if (isClass ? !!poolBase.isGeneric : !poolBase.isGeneric) return null

            const pool = await enrichPool(poolBase)
            return { pool, qty: 0, seen: true }
          }))
        
        if (!active) return
        setSeenOnlyEntries(seen.filter(Boolean))
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchData()
    return () => { active = false }
  }, [purchasedModalContext, player?.shopState?.purchases, seenIds, enrichPool, poolsSource, offersSource])

  const modalRef = useRef<AnimatedModalHandle | null>(null)
  const requestClose = () => { onClose() }

  return (
    <AnimatedModal 
      ref={modalRef} 
      open={!!purchasedModalContext} 
      onClose={onClose} 
      overlayClassName="bg-black/60" 
      className="bg-gray-900 border border-gray-700 rounded-lg p-8 w-full max-w-7xl max-h-[88vh] overflow-hidden mx-auto"
    >
        <button onClick={requestClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">×</button>
        <h3 className="text-2xl font-bold text-white mb-4">Pools - {purchasedModalContext?.tier} ({purchasedModalContext?.isClass ? 'Class' : 'Generic'})</h3>
        
        {loading ? (
          <div className="text-white">Loading pools...</div>
        ) : (
          <div className="w-full max-h-[92vh] overflow-hidden">
            <div className="flex flex-col h-[84vh]">
              <div className="flex-1 overflow-y-auto mb-4">
                <h4 className="text-lg font-semibold text-white mb-3">Purchased Pools</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 px-1">
                  {purchasedEntries.length === 0 ? (
                    <div className="text-sm text-gray-300">No purchased pools.</div>
                  ) : purchasedEntries.map((entry: any, i: number) => {
                    const poolObj = entry.pool || {}
                    const cardsArr = Array.isArray(poolObj.cards) ? poolObj.cards : []
                    const visibleCards = cardsArr.slice(0, 3)
                    return (
                      <div key={poolObj?.id || i} onClick={() => {
                          const isOffered = !!offersSource.find((lp: any) => String(lp.id) === String(poolObj?.id))
                          onClose()
                          setTimeout(() => {
                            openPoolViewer({ ...(poolObj || {}), __purchased: true, __purchaseQty: entry.qty || 0, __purchase: entry.purchase, __isOffered: isOffered })
                          }, 50)
                        }} className="relative border border-gray-700 rounded-lg p-3 bg-gray-800 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
                        <div className="mb-1">
                          <div className="font-medium text-white truncate">{poolObj?.name}</div>
                        </div>
                        <div className="text-sm text-gray-400 mb-2">{(poolObj.items ? poolObj.items.length : cardsArr.length) || 0} items</div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          {visibleCards.map((c: any, idx: number) => (
                            <div key={idx} className="w-10 rounded overflow-hidden border border-gray-600 bg-gray-900 flex items-center justify-center flex-shrink-0">
                                <CardImage card={c} useLootArt={true} className="w-full object-contain" />
                              </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pt-2 border-t border-gray-700">
                <h4 className="text-lg font-semibold text-white mb-3 mt-3">Seen Pools</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 px-1">
                    {seenOnlyEntries.length === 0 ? (
                      <div className="text-sm text-gray-300">No seen pools.</div>
                    ) : seenOnlyEntries.map((entry: any, i: number) => {
                      const poolObj = entry.pool || {}
                      const cardsArr = Array.isArray(poolObj.cards) ? poolObj.cards : []
                      const visibleCards = cardsArr.slice(0, 3)
                      return (
                        <div key={poolObj?.id || i} onClick={() => {
                            const isOffered = !!offersSource.find((lp: any) => String(lp.id) === String(poolObj?.id))
                            // Close this modal first so openPoolViewer (LootPoolDetailModal) can animate in alone
                            setPurchasedPoolsList(null)
                            setPurchasedModalContext(null)
                            // Small delay for React to clear this modal's backdrop if needed
                            setTimeout(() => {
                              openPoolViewer({ ...(poolObj || {}), __purchased: false, __purchaseQty: 0, __isOffered: isOffered })
                            }, 50)
                          }} className="relative border border-gray-700 rounded-lg p-3 bg-gray-800 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
                          <div className="mb-1">
                            <div className="font-medium text-white truncate">{poolObj?.name || 'Unnamed Pool'}</div>
                          </div>
                          <div className="text-sm text-gray-400 mb-2">{(poolObj.items ? poolObj.items.length : cardsArr.length) || 0} items</div>
                          <div className="flex items-center space-x-2 flex-wrap">
                            {visibleCards.map((c: any, idx: number) => (
                              <div key={idx} className="w-10 rounded overflow-hidden border border-gray-600 bg-gray-900 flex items-center justify-center flex-shrink-0">
                                  {c && (c.artworkUrl || c.image || c.imageUrl || c.artworks) ? (
                                    <CardImage card={c} useLootArt={true} className="w-full object-contain" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No Img</div>
                                  )}
                                </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        }
        <div className="mt-4 flex justify-end">
          <button onClick={() => { requestClose() }} className="px-4 py-2 bg-gray-700 text-white rounded">Close</button>
        </div>
      </AnimatedModal>
  )
}
