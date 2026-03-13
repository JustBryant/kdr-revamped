import React from 'react'
import AnimatedModal from '../../../common/AnimatedModal'
import CardImage from '../../../common/CardImage'
import { useShopContext } from '../../ShopContext'

export default function SellModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shop = useShopContext()
  const player = shop.player
  const call = shop.call
  const setPlayer = shop.setPlayer

  const [sellingId, setSellingId] = React.useState<string | null>(null)
  const [fetchedSkills, setFetchedSkills] = React.useState<any[]>([])
  const [fetchedInventory, setFetchedInventory] = React.useState<any[]>([])
  const [fetchedTreasures, setFetchedTreasures] = React.useState<any[]>([])
  const [initiallyFetched, setInitiallyFetched] = React.useState<boolean>(false)
  const [activeGoldPop, setActiveGoldPop] = React.useState<any | null>(null)

  const inventory = initiallyFetched ? fetchedInventory : (player?.inventory || player?.playerLoot || [])

  const treasures = [
    ...(Array.isArray(fetchedTreasures) ? fetchedTreasures.map((f: any) => ({ ...f, _from: 'treasures' })) : []),
    ...(Array.isArray(fetchedInventory) ? fetchedInventory.filter((f: any) => !!f.isTreasure && !f.skillId).map((f: any) => ({ ...f, _from: 'inventory' })) : [])
  ].filter((v, i, a) => {
    const vId = String(v.id || v.itemId || v.lootItemId || v.playerItemId)
    return a.findIndex(t => String(t.id || t.itemId || t.lootItemId || t.playerItemId) === vId) === i
  })

  const skills = fetchedSkills

  // `id` is the server id to send; `uiId` (optional) is the UI row id to hide immediately.
  const doSell = async (type: 'playerLoot' | 'playerSkill' | 'lootItem', id: string, uiId?: string) => {
    if (sellingId) return
    try {
      const uiTargetId = uiId ? String(uiId) : String(id)
      setSellingId(uiTargetId)
      const targetId = uiTargetId
      if (type === 'playerSkill') {
        setFetchedSkills(prev => prev.filter(s => String(s.playerSkillId || s.id) !== targetId))
      } else {
        setFetchedTreasures(prev => prev.filter(it => String(it.id || it.itemId || it.lootItemId || it.playerItemId) !== targetId))
        setFetchedInventory(prev => prev.filter(it => String(it.id || it.itemId || it.lootItemId || it.playerItemId) !== targetId))
      }

      const oldGold = player?.gold ?? 0
      const goldGainValue = 1
      const newGold = oldGold + goldGainValue
      setActiveGoldPop({ oldGold, newGold, showNew: false })
      window.setTimeout(() => setActiveGoldPop((p: any) => p ? ({ ...p, showNew: true }) : p), 300)
      window.setTimeout(() => setActiveGoldPop(null), 1200)

      try {
        const res = await call('sellItem', { type, id })
        if (res && res.player) {
          try { setPlayer(res.player) } catch (e) {}
          // After successful sell, refresh authoritative player inventory/treasures
          try {
            // Refresh authoritative player+inventory state and update global store so UI updates instantly
            const ref = await call('getPlayerSkills', {}, { autoSetPlayer: true })
            if (ref) {
              if (Array.isArray(ref.treasures)) setFetchedTreasures(ref.treasures)
              if (Array.isArray(ref.inventory)) setFetchedInventory(ref.inventory)
              if (Array.isArray(ref.playerSkills)) setFetchedSkills(ref.playerSkills.map((ps: any) => ({ ...ps, playerSkillId: ps.playerItemId || ps.playerSkillId || null })))
            }
          } catch (e) {
            // fallback: attempt best-effort local removal by sent id
            const sentId = String(id)
            setFetchedTreasures(prev => (prev || []).filter(it => String(it.id || it.itemId || it.lootItemId || it.playerItemId) !== sentId))
            setFetchedInventory(prev => (prev || []).filter(it => String(it.id || it.itemId || it.lootItemId || it.playerItemId) !== sentId))
          }
        }
      } catch (e) {
        console.error('Sell API error', e)
      }
    } catch (e) {
      console.error('Sell error', e)
    } finally {
      setSellingId(null)
    }
  }

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    if (typeof call === 'function') {
      ;(async () => {
        try {
          // Use shop-v2 `call` to fetch detailed PlayerSkill/PlayerItem rows
          const r = await call('getPlayerSkills', {}, { autoSetPlayer: false })
          if (cancelled) return
          if (r && Array.isArray(r.playerSkills)) {
            const normalized = r.playerSkills.map((ps: any) => {
              if (!ps) return null
              const base = ps.skill || ps
              return {
                ...base,
                id: base.id,
                name: base.name || ps.skillName || 'Skill',
                // ONLY treat this as a player-owned skill if there's a playerItem / playerSkill ID
                playerSkillId: ps.playerItemId || ps.playerSkillId || null,
                isSellable: ps.isSellable !== false
              }
            }).filter((s: any) => s && s.isSellable && (s.playerSkillId || s.playerSkillId === 0))
            setFetchedSkills(normalized)
          }
          if (r && Array.isArray(r.inventory)) {
            setFetchedInventory(r.inventory)
            // Also include any skills embedded in inventory rows (these are player-owned)
            try {
              const invSkills = (r.inventory || []).filter((it: any) => it && it.skill).map((it: any) => {
                const sk = it.skill
                return {
                  ...sk,
                  id: sk.id,
                  name: sk.name || sk.title || 'Skill',
                  playerSkillId: it.playerItemId || it.id || null,
                  isSellable: sk.isSellable !== false
                }
              }).filter((s: any) => s && s.isSellable && (s.playerSkillId || s.playerSkillId === 0))

              if (invSkills.length > 0) {
                // merge with any previously set fetchedSkills (dedupe by playerSkillId)
                setFetchedSkills(prev => {
                  const map: Record<string, any> = {}
                  for (const p of (prev || [])) {
                    if (p && p.playerSkillId) map[String(p.playerSkillId)] = p
                  }
                  for (const p of invSkills) {
                    if (p && p.playerSkillId) map[String(p.playerSkillId)] = { ...(map[String(p.playerSkillId)] || {}), ...p }
                  }
                  return Object.values(map)
                })
              }
            } catch (e) {
              // ignore
            }
          }
          if (r && Array.isArray(r.treasures)) setFetchedTreasures(r.treasures)
          setInitiallyFetched(true)
        } catch (e) {
          console.error('SellModal fetch error', e)
        }
      })()
    }
    return () => { cancelled = true }
  }, [open, shop.kdrId])

  return (
    <AnimatedModal open={open} onClose={onClose} overlayClassName="bg-black/40 dark:bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-white/10 rounded-2xl p-8 max-w-5xl w-full max-h-[90vh] flex flex-col mx-auto shadow-2xl overflow-hidden">
        <div className="relative flex items-center justify-between mb-8 pb-4 border-b border-gray-100 dark:border-white/5">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Sell Items</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Convert loot into currency</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/5">✕</button>
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
                const treasureId = String(it.id || it.itemId || it.lootItemId || it.playerItemId)
                const itemName = it.name || it.card?.name || it.skill?.name || it.lootName || 'Treasure'
                const isSelling = sellingId === treasureId
                return (
                  <div key={treasureId} className={`flex items-center justify-between bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 p-5 rounded-xl border border-gray-100 dark:border-white/10 transition-all ${isSelling ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex items-center space-x-6 min-w-0">
                      {it.card ? (
                        <div className="w-16 h-20 flex-shrink-0 bg-white dark:bg-black/40 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden relative shadow-md">
                          <CardImage card={it.card} konamiId={it.card.konamiId} style={{ width: '100%', height: '100%', objectFit: 'cover' }} useLootArt={true} />
                        </div>
                      ) : (
                        <div className="w-16 h-20 flex-shrink-0 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5 flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase text-center p-2">{it.skill ? 'Skill' : 'Item'}</div>
                      )}
                      <div className="flex flex-col space-y-1 min-w-0">
                        <div className="text-base font-black italic uppercase tracking-tighter text-gray-900 dark:text-white truncate">{itemName}</div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.15em]">{it.card ? (it.card.type || 'Card') : it.skill ? 'Skill' : 'Loot Item'}</div>
                      </div>
                    </div>
                    <div className="pl-4">
                      <button disabled={sellingId !== null} onClick={(e) => { 
                        e.stopPropagation(); 
                        const type = it._from === 'inventory' ? 'playerLoot' : 'lootItem';
                        // If we're selling a server-provided treasure (type 'lootItem'), send the Item id
                        const sellIdToUse = type === 'lootItem' ? String(it.itemId || it.lootItemId || it.id || '') : treasureId
                          // pass the UI row id (treasureId) so the UI hides the correct element immediately
                          doSell(type, sellIdToUse, treasureId)
                      }} className="px-6 py-2 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-all hover:bg-amber-500 shadow-lg active:scale-95 disabled:grayscale">{isSelling ? '...' : 'Sell'}</button>
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
                  <div key={sId} className={`flex items-center justify-between bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 p-5 rounded-xl border border-gray-100 dark:border-white/10 transition-all ${isSelling ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="text-base font-black italic uppercase tracking-tighter text-gray-900 dark:text-white truncate">{s.name || 'Skill'}</div>
                    </div>
                    <div className="pl-4">
                      <button disabled={sellingId !== null} onClick={(e) => { e.stopPropagation(); doSell('playerSkill', sId) }} className="px-6 py-2 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-all hover:bg-amber-500 shadow-lg active:scale-95 disabled:grayscale">{isSelling ? '...' : 'Sell'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {activeGoldPop && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center pointer-events-none">
          <div className="relative z-10 pointer-events-none flex items-center justify-center w-full h-full">
            <div className="stat-pop-root pointer-events-none flex items-center justify-center">
              <div className="stat-pop-text" style={{ fontSize: '3.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', opacity: 1, marginBottom: 12, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gold Gained</div>
                <div className={activeGoldPop.showNew ? 'stat-pop-new' : 'stat-pop-old'} style={{ fontWeight: 900, color: '#fbbf24', fontSize: '4.5rem' }}>{activeGoldPop.showNew ? activeGoldPop.newGold : activeGoldPop.oldGold}G</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AnimatedModal>
  )
}
