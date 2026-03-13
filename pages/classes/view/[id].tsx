import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'
import Head from 'next/head'
import ClassImage from '../../../components/common/ClassImage'
import CardImage from '../../../components/common/CardImage'
import HoverTooltip from '../../../components/shop-v2/components/HoverTooltip'

const getCardKey = (it: any) => it?.id || it?.konamiId || (it?.name || it?.title || '').toString()

const getFrameHex = (it: any) => {
  const t = ((it?.type || it?.frame || it?.cardType || '') + '').toLowerCase()
  if (t.includes('spell')) return '#1D9E74'
  if (t.includes('trap')) return '#BC5A84'
  if (t.includes('fusion')) return '#A086B7'
  if (t.includes('link')) return '#006EAD'
  if (t.includes('synchro')) return '#CCCCCC'
  if (t.includes('xyz')) return '#000000'
  if (t.includes('ritual')) return '#4E71AF'
  if (t.includes('normal')) return '#FDE68A'
  return '#FF8B53'
}

const hexToRgba = (hex: string, alpha = 1) => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const bigint = parseInt(full, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")"
}

const CardPreview: React.FC<{ item: any; isHovered?: boolean }> = ({ item, isHovered }) => {
  if (!item) return <div className="text-sm text-gray-500">None</div>
  const name = item.name || item.title || 'Unnamed'
  const imgPx = 96
  const nameFontSize = 11
  const lineHeight = 1.25
  const lineHeightPx = Math.ceil(nameFontSize * lineHeight)
  const nameContainerHeight = lineHeightPx

  const frameHex = getFrameHex(item)
  const ringColor = hexToRgba(frameHex, 0.95)
  const outerBoxShadow = isHovered ? "0 0 0 6px " + ringColor + ", 0 8px 24px " + hexToRgba(frameHex, 0.25) : undefined
  const nameMarginTop = 4

  return (
    <div className="flex flex-col items-center text-center w-full max-w-[96px] overflow-visible box-border" style={{ width: imgPx + "px", height: (imgPx + nameContainerHeight + nameMarginTop) + "px" }}>
      <div style={{ position: 'relative', width: imgPx + "px", height: imgPx + "px", transition: 'box-shadow 160ms ease', borderRadius: 8, boxShadow: outerBoxShadow }}>
        {item && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <CardImage card={item} konamiId={item?.konamiId} alt={name} className="w-full h-full object-cover rounded" />
          </div>
        )}
      </div>
      <div style={{ height: nameContainerHeight + "px", marginTop: nameMarginTop, width: '100%', boxSizing: 'border-box' }}>
        <div className="font-medium" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: nameFontSize + "px", color: '#fff', textAlign: 'center' }}>{name}</div>
      </div>
    </div>
  )
}

const ScrollGrid: React.FC<{ 
  items: any[]; 
  renderItem: (item: any, i: number) => React.ReactNode; 
  maxRows?: number; 
  maxCols?: number;
  onHoverItem: (it: any, pos: {x: number, y: number} | null) => void;
}> = ({ items, renderItem, maxRows = 5, maxCols, onHoverItem }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [colsCount, setColsCount] = React.useState<number>(10)
  const tilePx = 96
  const rowGap = 12
  const colGap = 12

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const cw = el.clientWidth
      const c = Math.max(1, Math.floor(cw / (tilePx + colGap)))
      setColsCount(maxCols ? Math.min(c, maxCols) : c)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [maxCols])

  return (
    <div ref={containerRef}>
        <div style={{ display: 'grid', gridTemplateColumns: "repeat(" + colsCount + ", " + tilePx + "px)", gap: rowGap + "px " + colGap + "px", justifyContent: 'start', alignItems: 'start' }}>
          {items.map((it: any, i: number) => (
            <div
              key={i}
              style={{ width: tilePx + "px" }}
              onMouseEnter={(e) => onHoverItem(it, { x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => onHoverItem(it, { x: e.clientX, y: e.clientY })}
              onMouseLeave={() => onHoverItem(null, null)}
              className="flex items-center justify-center cursor-default"
            >
              {renderItem(it, i)}
            </div>
          ))}
        </div>
    </div>
  )
}

export default function PublicClassViewPage() {
  const router = useRouter()
  const { id } = router.query
  const [cls, setCls] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [hoverItem, setHoverItem] = useState<any>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const hoverItemKey = hoverItem ? getCardKey(hoverItem) : null
  const [hoverSkill, setHoverSkill] = useState<any>(null)
  const [hoverSkillPos, setHoverSkillPos] = useState({ x: 0, y: 0 })
  const cardDetailsCacheRef = React.useRef({})
  const tooltipScrollRef = React.useRef(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!id) return
    axios.get("/api/classes/" + id).then(res => {
      setCls(res.data)
      setLoading(false)
    })
  }, [id])

  const combinedSkills = useMemo(() => cls?.skills || [], [cls])

  const startingDeck = useMemo(() => {
    if (!cls) return []
    const base = (cls.startingCards || []).map((sc: any) => sc.card || sc)
    if (cls.legendaryMonsterCard) base.push(cls.legendaryMonsterCard)
    const provided = (combinedSkills || []).flatMap((s: any) => (s as any).providesCards || [])
    const all = [...base, ...provided]
    const map = new Map()
    all.forEach((c: any) => {
      if (!c) return
      const key = c.id || (c.konamiId || '') + "-" + (c.name || '')
      if (!map.has(key)) map.set(key, c)
    })
    return Array.from(map.values())
  }, [cls, combinedSkills])

  const getCardCategory = (type: string | undefined): any => {
    if (!type) return 'Monster'
    const lowerType = type.toLowerCase()
    if (lowerType.includes('fusion') || lowerType.includes('synchro') || lowerType.includes('xyz') || lowerType.includes('link')) return 'Extra'
    if (lowerType.includes('spell')) return 'Spell'
    if (lowerType.includes('trap')) return 'Trap'
    return 'Monster'
  }

  const filteredByCategory = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const deck = (startingDeck as any[]).filter(it => (it.name || '').toLowerCase().includes(q) || (it.desc || '').toLowerCase().includes(q))
    return {
      monsters: deck.filter((c: any) => getCardCategory(c.type) === 'Monster'),
      spells: deck.filter((c: any) => getCardCategory(c.type) === 'Spell'),
      traps: deck.filter((c: any) => getCardCategory(c.type) === 'Trap'),
      extra: deck.filter((c: any) => getCardCategory(c.type) === 'Extra')
    }
  }, [startingDeck, searchQuery])

  if (loading) return <div className="p-8 text-white bg-[#0b0f19] min-h-screen flex items-center justify-center font-bold text-2xl uppercase tracking-tighter">Loading...</div>

  const mainSkill = combinedSkills.find((s: any) => s.type === 'MAIN')

  const InfoBlock = ({ title, sub, colorClass = 'text-blue-400', borderClass = 'border-blue-500/30' }: any) => (
    <div className={`bg-black/40 p-6 rounded-2xl border-l-4 ${borderClass} backdrop-blur-sm transition-all hover:bg-black/50 hover:scale-[1.02] shadow-xl`}>
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${colorClass}`}>{title}</div>
      <div className="text-[14px] text-gray-100 leading-relaxed italic">{sub || 'None'}</div>
    </div>
  )

  const SkillBlock = ({ skill, colorClass, borderClass }: any) => (
    <div 
      className={`bg-black/40 p-6 rounded-2xl border-l-4 ${borderClass} backdrop-blur-sm transition-all hover:bg-black/50 hover:scale-[1.02] shadow-xl cursor-default group`}
    >
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${colorClass}`}>{skill?.name || 'No Skill'}</div>
      <div className="text-[14px] text-gray-100 leading-relaxed italic">{skill?.description || 'No description available.'}</div>
    </div>
  )

  return (
    <div className="bg-[#0b0f19] min-h-screen text-gray-100 p-6 md:p-12 font-sans selection:bg-indigo-500/30">
      <Head>
        <title>{cls.name} | KDR Revamped</title>
      </Head>
      
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Top: Large Centered Image & Name */}
        <section className="flex flex-col items-center justify-center text-center space-y-8 py-10">
          <div className="relative group">
            <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center p-4 relative">
              <ClassImage image={cls.image} className="max-h-full w-auto object-contain shopkeeper-float drop-shadow-[0_20px_50px_rgba(79,70,229,0.3)]" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
              {cls.name}
            </h1>
            <div className="flex items-center justify-center gap-4">
              <span className="h-px w-12 bg-indigo-500/30"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Class Profile</span>
              <span className="h-px w-12 bg-indigo-500/30"></span>
            </div>
          </div>
        </section>

        {/* Middle: Core Details Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SkillBlock 
            skill={mainSkill}
            colorClass="text-blue-400"
            borderClass="border-blue-500"
          />
          <InfoBlock 
            title="Legendary Quest"
            sub={cls.legendaryQuest}
            colorClass="text-yellow-500"
            borderClass="border-yellow-500"
          />
          <InfoBlock 
            title="Legendary Relic"
            sub={cls.legendaryRelic}
            colorClass="text-purple-500"
            borderClass="border-purple-500"
          />
          <div 
            className="bg-black/40 p-6 rounded-2xl border-l-4 border-orange-500 backdrop-blur-sm transition-all hover:bg-black/50 hover:scale-[1.02] shadow-xl flex flex-col items-center text-center group cursor-default"
            onMouseEnter={(e) => { 
              if (cls.legendaryMonsterCard) {
                setHoverItem(cls.legendaryMonsterCard); 
                setHoverPos({ x: (e as any).clientX, y: (e as any).clientY }) 
              }
            }}
            onMouseLeave={() => setHoverItem(null)}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-orange-500 w-full text-left">Legendary Monster</div>
            <div className="text-xl font-bold text-white mb-4">{cls.legendaryMonsterCard?.name || 'None'}</div>
            <div className="w-24 h-32 relative flex-shrink-0">
               <CardImage card={cls.legendaryMonsterCard} className="w-full h-full object-cover rounded shadow-lg group-hover:scale-110 transition-transform" />
            </div>
          </div>
        </section>

        {/* Bottom: Card Library */}
        <section className="space-y-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-4">
               Inventory <span className="text-sm text-gray-500 font-normal">({startingDeck.length} CARDS)</span>
            </h2>
            <div className="flex gap-4 w-full md:w-auto">
               <input 
                 className="flex-1 md:w-80 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white shadow-inner transition-all placeholder:text-gray-600"
                 placeholder="Search names or descriptions..."
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
               />
            </div>
          </div>

          <div className="space-y-12 min-h-[600px]">
            {filteredByCategory.monsters.length > 0 && (
              <div className="space-y-6 bg-white/[0.02] p-8 rounded-3xl border border-white/5 shadow-inner">
                <div className="flex items-center gap-4 mb-2">
                  <div className="h-8 w-1 bg-orange-500 rounded-full"></div>
                  <h3 className="text-sm font-black uppercase tracking-[0.4em] text-orange-500">Monsters</h3>
                </div>
                <ScrollGrid items={filteredByCategory.monsters} renderItem={(it) => <CardPreview item={it} isHovered={hoverItemKey === getCardKey(it)} />} onHoverItem={(it, pos) => { setHoverItem(it); if (pos) setHoverPos(pos) }} />
              </div>
            )}
            
            {filteredByCategory.extra.length > 0 && (
              <div className="space-y-6 bg-white/[0.02] p-8 rounded-3xl border border-white/5 shadow-inner">
                <div className="flex items-center gap-4 mb-2">
                  <div className="h-8 w-1 bg-purple-400 rounded-full"></div>
                  <h3 className="text-sm font-black uppercase tracking-[0.4em] text-purple-400">Extra Deck</h3>
                </div>
                <ScrollGrid items={filteredByCategory.extra} renderItem={(it) => <CardPreview item={it} isHovered={hoverItemKey === getCardKey(it)} />} onHoverItem={(it, pos) => { setHoverItem(it); if (pos) setHoverPos(pos) }} />
              </div>
            )}

            {filteredByCategory.spells.length > 0 && (
              <div className="space-y-6 bg-white/[0.02] p-8 rounded-3xl border border-white/5 shadow-inner">
                <div className="flex items-center gap-4 mb-2">
                  <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
                  <h3 className="text-sm font-black uppercase tracking-[0.4em] text-emerald-500">Spells</h3>
                </div>
                <ScrollGrid items={filteredByCategory.spells} renderItem={(it) => <CardPreview item={it} isHovered={hoverItemKey === getCardKey(it)} />} onHoverItem={(it, pos) => { setHoverItem(it); if (pos) setHoverPos(pos) }} />
              </div>
            )}

            {filteredByCategory.traps.length > 0 && (
              <div className="space-y-6 bg-white/[0.02] p-8 rounded-3xl border border-white/5 shadow-inner">
                <div className="flex items-center gap-4 mb-2">
                  <div className="h-8 w-1 bg-pink-500 rounded-full"></div>
                  <h3 className="text-sm font-black uppercase tracking-[0.4em] text-pink-500">Traps</h3>
                </div>
                <ScrollGrid items={filteredByCategory.traps} renderItem={(it) => <CardPreview item={it} isHovered={hoverItemKey === getCardKey(it)} />} onHoverItem={(it, pos) => { setHoverItem(it); if (pos) setHoverPos(pos) }} />
              </div>
            )}

            {searchQuery && Object.values(filteredByCategory).every(arr => arr.length === 0) && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500 space-y-4">
                <div className="text-4xl">🔍</div>
                <div className="text-lg font-bold">No cards match "{searchQuery}"</div>
                <button onClick={() => setSearchQuery('')} className="text-indigo-400 hover:text-indigo-300 transition-colors uppercase text-xs font-black tracking-widest">Clear Search</button>
              </div>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        .shopkeeper-float { transform-origin: center; animation: shopFloat 6s ease-in-out infinite; }
        @keyframes shopFloat { 0% { transform: translateY(0px) rotate(0deg) } 50% { transform: translateY(-20px) rotate(1deg) } 100% { transform: translateY(0px) rotate(0deg) } }
      `}</style>

      <HoverTooltip
        hoverTooltip={hoverItem ? { visible: true, cardLike: hoverItem, x: hoverPos.x, y: hoverPos.y, skills: combinedSkills } : { visible: false }}
        cardDetailsCacheRef={cardDetailsCacheRef}
        tooltipScrollRef={tooltipScrollRef}
      />
      {hoverSkill && (
         <HoverTooltip
            hoverTooltip={{ visible: true, cardLike: { name: hoverSkill.name, desc: hoverSkill.description || hoverSkill.desc || '' }, x: hoverSkillPos.x, y: hoverSkillPos.y, skills: [] }}
            cardDetailsCacheRef={cardDetailsCacheRef}
            tooltipScrollRef={tooltipScrollRef}
         />
      )}
    </div>
  )
}
