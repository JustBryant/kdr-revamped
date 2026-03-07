import React from 'react'
import AnimatedModal from '../common/AnimatedModal'
import CardImage from '../common/CardImage'

type SellModalProps = {
  open: boolean
  onClose: () => void
  player: any
  call: (action: string, payload?: any) => Promise<any>
  setPlayer: (p: any) => void
  showHover: (e: React.MouseEvent, card: any, options?: any) => void
  moveHover: (e: React.MouseEvent) => void
  hideHover: () => void
}

export default function SellModal({ open, onClose, player, call, setPlayer, showHover, moveHover, hideHover }: SellModalProps) {
  const [sellingId, setSellingId] = React.useState<string | null>(null)
  const [fetchedSkills, setFetchedSkills] = React.useState<any[]>([])
  const [fetchedInventory, setFetchedInventory] = React.useState<any[]>([])
  const [fetchedTreasures, setFetchedTreasures] = React.useState<any[]>([])
  const [goldGains, setGoldGains] = React.useState<any[]>([])
  const [initiallyFetched, setInitiallyFetched] = React.useState<boolean>(false)
  const [activeGoldPop, setActiveGoldPop] = React.useState<any | null>(null)

  const inventory = initiallyFetched ? fetchedInventory : (player?.inventory || player?.playerLoot || [])
  
  // Treasures & Card Packs
  // Prefer treasures explicitly returned by the server (`r.treasures`).
  // Fallback: include any inventory rows marked `isTreasure` for older responses.
  const treasures = initiallyFetched
    ? [
        ...(Array.isArray(fetchedTreasures) ? fetchedTreasures.map((f: any) => ({ ...f, _from: 'treasures' })) : []),
        ...fetchedInventory.filter((f: any) => !!f.isTreasure && !f.skillId).map((f: any) => ({ ...f, _from: 'inventory' }))
      ].filter((v, i, a) => a.findIndex(t => (t.id || t.itemId || t.lootItemId) === (v.id || v.itemId || v.lootItemId)) === i)
    : []

  // Skills: Prefer fetched results which already resolved names, sources, and class restrictions.
  const skills = fetchedSkills // NEVER fallback here, always use the filtered set

  const doSell = async (type: 'playerLoot' | 'playerSkill' | 'lootItem', id: string, e?: React.MouseEvent) => {
    if (sellingId) return
    try {
      setSellingId(id)
      
      // OPTIMISTICALLY REMOVE FROM UI IMMEDIATELY
      // This is the absolute fix to prevent double-selling
      if (type === 'playerSkill') {
        const sId = String(id)
        setFetchedSkills(prev => prev.filter(s => String(s.playerSkillId || s.id) !== sId))
      } else if (type === 'lootItem' || type === 'playerLoot') {
        const targetId = String(id)
        // Remove from ALL possible local storage arrays immediately
        setFetchedTreasures(prev => prev.filter(it => String(it.id || it.itemId || it.lootItemId) !== targetId))
        setFetchedInventory(prev => prev.filter(it => String(it.id || it.itemId || it.lootItemId) !== targetId))
      } else {
        const targetId = String(id)
        setFetchedInventory(prev => prev.filter(it => String(it.id || it.itemId || it.lootItemId) !== targetId))
      }

      // PREPARE GOLD POP ANIMATION
      const oldGold = player?.gold ?? 0
      const goldGainValue = 1
      const newGold = oldGold + goldGainValue
      setActiveGoldPop({ oldGold, newGold, showNew: false })
      window.setTimeout(() => setActiveGoldPop((p: any) => p ? ({ ...p, showNew: true }) : p), 300)
      window.setTimeout(() => setActiveGoldPop(null), 1200)

      const res = await call('sellItem', { type, id })
      if (res && res.player) {
        setPlayer(res.player)
        hideHover()
      }
      
      // DO NOT REFETCH IMMEDIATELY - it can bring back deleted items if db is slow
      // Just rely on our filtered state above.
    } catch (e) {
      console.error('Sell error', e)
    } finally {
      setSellingId(null)
    }
  }

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    try {
      // Attempt to fetch detailed PlayerSkill and PlayerItem (inventory) rows for this user
      if (typeof call === 'function') {
        ;(async () => {
          try {
            const r = await call('getPlayerSkills')
            if (cancelled) return
            if (r && Array.isArray(r.playerSkills)) {
              const normalized = r.playerSkills.map((ps: any) => {
                if (!ps) return null
                const base = ps.skill || ps
                return {
                  ...base,
                  id: base.id,
                  name: base.name || ps.skillName || 'Skill',
                  playerSkillId: ps.playerItemId || ps.playerSkillId || ps.id || null,
                  isSellable: ps.isSellable !== false
                }
              }).filter((s: any) => s && s.isSellable)
              setFetchedSkills(normalized)
            }
            if (r && Array.isArray(r.inventory)) {
              setFetchedInventory(r.inventory)
            }
            // Server may return a separate `treasures` array now
            if (r && Array.isArray(r.treasures)) {
              setFetchedTreasures(r.treasures)
            }
            setInitiallyFetched(true)
          } catch (e) {
            // ignore
          }
        })()
      }
    } catch (e) {
      console.error('SellModal fetch error', e)
    }
    return () => { cancelled = true }
  }, [open]) // ONLY fetch when modal first opens or is reset

  return (
    <AnimatedModal open={open} onClose={onClose} overlayClassName="bg-black/40 dark:bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-white/10 rounded-2xl p-8 max-w-5xl w-full max-h-[90vh] flex flex-col mx-auto shadow-2xl dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-600/5 dark:bg-amber-600/10 blur-[80px] pointer-events-none" />

        <div className="relative flex items-center justify-between mb-8 pb-4 border-b border-gray-100 dark:border-white/5">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Sell Items</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Convert loot into currency</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative space-y-10 overflow-y-auto flex-1 pr-2 custom-scrollbar">
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-500">Treasures</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent"></div>
            </div>
            {(!treasures || treasures.length === 0) && (
              <div className="py-10 bg-black/[0.02] dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">No treasures in inventory</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {treasures.map((it: any) => {
                const hoverObj = it.card || it.skill || it
                const itemName = it.name || it.card?.name || it.skill?.name || it.lootName || (it.itemId ? `Treasure ${String(it.itemId).slice(0,6)}` : (it.lootItemId ? `Treasure ${String(it.lootItemId).slice(0,6)}` : 'Unknown Treasure'))
                const isSelling = sellingId === String(it.id || it.itemId || it.lootItemId)
                
                return (
                  <div 
                    key={(it.id || it.itemId || it.lootItemId)} 
                    className={`flex items-center justify-between bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 p-5 rounded-xl border border-gray-100 dark:border-white/10 transition-all group hover:border-amber-500/30 ${isSelling ? 'opacity-0 scale-95 translate-x-4 pointer-events-none' : 'opacity-100'}`}
                    onMouseEnter={(e) => showHover(e, hoverObj)}
                    onMouseMove={(e) => moveHover(e)}
                    onMouseLeave={() => hideHover()}
                  >
                    <div className="flex items-center space-x-6 min-w-0">
                      {it.card ? (
                        <div className="w-16 h-20 flex-shrink-0 bg-white dark:bg-black/40 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden relative shadow-md">
                          <CardImage 
                            card={it.card} 
                            konamiId={it.card.konamiId} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            useLootArt={true}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-20 flex-shrink-0 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5 flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase text-center p-2">
                          {it.skill ? 'Skill' : 'Item'}
                        </div>
                      )}
                      <div className="flex flex-col space-y-1 min-w-0">
                        <div className="text-base font-black italic uppercase tracking-tighter text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                          {itemName}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.15em]">
                          {it.card ? (it.card.type || 'Card') : it.skill ? 'Skill' : 'Loot Item'}
                        </div>
                      </div>
                    </div>
                    <div className="pl-4">
                      {it._from === 'inventory' ? (
                        <button 
                          disabled={sellingId !== null} 
                          onClick={(e) => { e.stopPropagation(); hideHover(); doSell('playerLoot', String(it.id), e) }} 
                          className="px-6 py-2 bg-amber-600 dark:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-all hover:bg-amber-500 shadow-lg shadow-amber-900/10 dark:shadow-amber-900/20 active:scale-95 disabled:grayscale"
                        >
                          {isSelling ? '...' : 'Sell'}
                        </button>
                      ) : (
                        <button 
                          disabled={sellingId !== null} 
                          onClick={(e) => { e.stopPropagation(); hideHover(); doSell('lootItem', String(it.itemId || it.lootItemId), e) }} 
                          className="px-6 py-2 bg-amber-600 dark:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-all hover:bg-amber-500 shadow-lg shadow-amber-900/10 dark:shadow-amber-900/20 active:scale-95 disabled:grayscale"
                        >
                          {isSelling ? '...' : 'Sell'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-6">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-500">Skills</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent"></div>
            </div>
            {(!skills || skills.length === 0) && (
              <div className="py-10 bg-black/[0.02] dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">No sellable skills</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {skills.map((s: any) => {
                const sId = String(s.playerSkillId || s.id)
                const isSelling = sellingId === sId
                return (
                  <div 
                    key={sId} 
                    className={`flex items-center justify-between bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 p-5 rounded-xl border border-gray-100 dark:border-white/10 transition-all group hover:border-amber-500/30 ${isSelling ? 'opacity-0 scale-95 -translate-x-4 pointer-events-none' : 'opacity-100'}`}
                    onMouseEnter={(e) => showHover(e, s)}
                    onMouseMove={(e) => moveHover(e)}
                    onMouseLeave={() => hideHover()}
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="text-base font-black italic uppercase tracking-tighter text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">{s.name || 'Skill'}</div>
                    </div>
                    <div className="pl-4">
                      <button 
                        disabled={sellingId !== null} 
                        onClick={(e) => { e.stopPropagation(); hideHover(); doSell('playerSkill', sId, e) }} 
                        className="px-6 py-2 bg-amber-600 dark:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-all hover:bg-amber-500 shadow-lg shadow-amber-900/10 dark:shadow-amber-900/20 active:scale-95 disabled:grayscale"
                      >
                        {isSelling ? '...' : 'Sell'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
      
      {/* Gold Gaining Particles Layer */}
      <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
        {goldGains.map((gain: any) => (
          <div
            key={gain.id}
            className="absolute font-black text-2xl text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] animate-gold-float-up"
            style={{ left: gain.x, top: gain.y }}
          >
            +1G
          </div>
        ))}
      </div>

      {activeGoldPop && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center pointer-events-none">
          <div className="relative z-10 pointer-events-none flex items-center justify-center w-full h-full">
            <div className="stat-pop-root pointer-events-none flex items-center justify-center">
              <div className="stat-pop-text" style={{ fontSize: '3.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', opacity: 1, marginBottom: 12, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gold Gained</div>
                <div className={activeGoldPop.showNew ? 'stat-pop-new' : 'stat-pop-old'} style={{ fontWeight: 900, color: '#fbbf24', fontSize: '4.5rem' }}>
                  {activeGoldPop.showNew ? activeGoldPop.newGold : activeGoldPop.oldGold}G
                </div>
              </div>
              <div className="stat-pop-particles" aria-hidden>
                {[...Array(12)].map((_, i) => {
                  const angle = (i / 12) * Math.PI * 2
                  const dist = 100 + Math.round(Math.random() * 50)
                  const dx = Math.round(Math.cos(angle) * dist)
                  const dy = Math.round(Math.sin(angle) * dist)
                  return (
                    <span key={i} className="pop-particle" style={{ ['--dx' as any]: `${dx}px`, ['--dy' as any]: `${dy}px`, ['--delay' as any]: `${i * 40}ms`, }} />
                  )
                })}
              </div>
            </div>
          </div>
          <style jsx>{`
            .stat-pop-root { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
            .stat-pop-text { color: #fff; letter-spacing: 0.02em; text-shadow: 0 8px 24px rgba(0,0,0,0.8); transform-origin: center; animation: goldPop 1000ms cubic-bezier(.2,.9,.2,1) forwards; }
            @keyframes goldPop { 0% { transform: scale(0.2); opacity: 0 } 60% { transform: scale(1.2); opacity: 1 } 100% { transform: scale(1); opacity: 0 } }
            .stat-pop-particles { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
            .pop-particle { position: absolute; left: 0; top: 0; width: 12px; height: 12px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #fbbf24, #d97706); opacity: 0; transform: translate(-50%, -50%) scale(0.3); animation: popFly 900ms cubic-bezier(.2,.9,.2,1) forwards; animation-delay: var(--delay, 0ms); }
            @keyframes popFly { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.3); } 100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.5); } }
            .stat-pop-new { transform: scale(1.1); color: #fbbf24; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            .stat-pop-old { opacity: 0.9; }
          `}</style>
        </div>
      )}
    </AnimatedModal>
  )
}
