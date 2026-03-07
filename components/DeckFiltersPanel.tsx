import React from 'react'
import LocalIcon from './LocalIcon'
import { ATTRIBUTES, TYPES, ARROWS } from './class-editor/shared/CardFilters'

type Props = {
  isDark: boolean
  setFilterOpen: (v: boolean) => void
  // subtypes
  selectedSubtypes: string[]
  toggleSubtype: (s: string) => void
  // attributes
  selectedAttributes: string[]
  toggleAttribute: (a: string) => void
  // spell/trap subtypes
  // types
  TYPES: string[]
  selectedTypes: string[]
  toggleType: (t: string) => void
  // levels
  selectedLevels: number[]
  toggleLevel: (n: number) => void
  // link ratings/arrows
  selectedLinkRatings: number[]
  toggleLinkRating: (n: number) => void
  selectedLinkArrows: string[]
  toggleLinkArrow: (d: string) => void
  hoveredLinkArrow: string | null
  setHoveredLinkArrow: (d: string | null) => void
  linkArrowsMode: 'AND'|'OR'
  // pendulum
  selectedPendulumScales: number[]
  togglePendulumScale: (n: number) => void
  // atk/def sliders
  atkMin: number
  atkMax: number
  setAtkMinFromInput: (s: string) => void
  setAtkMaxFromInput: (s: string) => void
  sliderRef: React.RefObject<HTMLDivElement | null>
  startDrag: (h: 'min'|'max') => (e: any) => void
  defMin: number
  defMax: number
  setDefMinFromInput: (s: string) => void
  setDefMaxFromInput: (s: string) => void
  defSliderRef: React.RefObject<HTMLDivElement | null>
  defStartDrag: (h: 'min'|'max') => (e: any) => void
  // abilities
  selectedAbilities: string[]
  toggleAbility: (ab: string) => void
  // reset/cancel helpers
  resetAll: () => void
  onCancel: () => void
}

export default function DeckFiltersPanel(props: Props) {
  const p = props
  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center justify-between px-8 py-6 ${p.isDark ? 'border-b border-white/5 bg-white/5' : 'border-b border-slate-200'}`}>
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Filter Collection</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {p.selectedSubtypes && p.selectedSubtypes.length > 0 && (
              <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                Frames: {p.selectedSubtypes.length}
              </div>
            )}
            {p.selectedAttributes && p.selectedAttributes.length > 0 && (
              <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                Attributes: {p.selectedAttributes.length}
              </div>
            )}
            {p.selectedTypes && p.selectedTypes.length > 0 && (
              <div className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                Types: {p.selectedTypes.length}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black uppercase italic tracking-widest text-xs transition-all border border-white/10">Help</button>
          <button onClick={() => p.setFilterOpen(false)} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white hover:text-red-400 font-black uppercase italic tracking-widest text-xs transition-all border border-white/10">Close</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
        {/* Section: Card Frame */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              <img src="/icons/cardframeicon.png" alt="Card Frame" className="w-8 h-8 opacity-80" />
              <span className="font-black italic uppercase tracking-widest text-sm text-gray-400">Card Frame</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
              {['Normal','Effect','Fusion','Ritual','Synchro','Xyz','Pendulum','Link','Spell','Trap'].map((t:any) => {
                const sel = p.selectedSubtypes.includes(t)
                return (
                  <button 
                    key={t} 
                    onClick={() => p.toggleSubtype(t)} 
                    className={`px-4 py-3 rounded-xl border-2 font-black uppercase italic tracking-widest text-[11px] transition-all duration-200 
                      ${sel ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-[1.02]' : 'bg-black/40 text-gray-500 border-white/5 hover:border-emerald-500/50 hover:text-gray-300'}`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* Attribute */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
              <LocalIcon src="/icons/attribute.png" className="w-8 h-8 opacity-80" alt="Attribute" fallback={<div className="w-8 h-8 mx-auto rounded-full bg-yellow-300 flex items-center justify-center">◎</div>} />
              <div className="font-black italic uppercase tracking-widest text-sm text-gray-400">Attribute</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
              {['LIGHT','DARK','WATER','FIRE','EARTH','WIND','DIVINE'].map(a => {
                const sel = p.selectedAttributes.includes(a)
                return (
                  <button 
                    key={a} 
                    onClick={() => p.toggleAttribute(a)} 
                    className={`px-4 py-3 rounded-xl border-2 font-black uppercase italic tracking-widest text-[11px] transition-all duration-200 
                      ${sel ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-[1.02]' : 'bg-black/40 text-gray-500 border-white/5 hover:border-indigo-500/50 hover:text-gray-300'}`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* Types of Spell/Trap */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-pink-500 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>
              <LocalIcon src="/icons/spelltrap.png" className="w-8 h-8 opacity-80" alt="Types of Spell and Traps" fallback={<div className="w-8 h-8 bg-gray-400 rounded" />} />
              <span className="font-black italic uppercase tracking-widest text-sm text-gray-400">Spell/Trap Categories</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { key: 'Spell:Normal', label: 'Normal Spell' },
                { key: 'Spell:Field', label: 'Field Spell' },
                { key: 'Spell:Equip', label: 'Equip Spell' },
                { key: 'Spell:Continuous', label: 'Continuous Spell' },
                { key: 'Spell:Quick-Play', label: 'Quick-Play Spell' },
                { key: 'Spell:Ritual', label: 'Ritual Spell' },
                { key: 'Trap:Normal', label: 'Normal Trap' },
                { key: 'Trap:Continuous', label: 'Continuous Trap' },
                { key: 'Trap:Counter', label: 'Counter Trap' },
              ].map((it:any) => {
                const sel = p.selectedSubtypes.includes(it.key)
                return (
                  <button 
                    key={it.key} 
                    onClick={() => p.toggleSubtype(it.key)} 
                    className={`px-4 py-3 rounded-xl border-2 font-black uppercase italic tracking-widest text-[10px] transition-all duration-200 
                      ${sel ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.3)] scale-[1.02]' : 'bg-black/40 text-gray-500 border-white/5 hover:border-pink-500/50 hover:text-gray-300'}`}
                  >
                    {it.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* Type */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
              <LocalIcon src="/icons/type.png" className="w-8 h-8 opacity-80" alt="Type" fallback={<div className="w-8 h-8 bg-purple-600 rounded" />} />
              <span className="font-black italic uppercase tracking-widest text-sm text-gray-400">Monster Type</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-4 lg:grid-cols-6 gap-3">
              {p.TYPES.map(t => {
                const sel = p.selectedTypes.includes(t)
                return (
                  <button 
                    key={t} 
                    onClick={() => p.toggleType(t)} 
                    className={`px-4 py-3 rounded-xl border-2 font-black uppercase italic tracking-widest text-[10px] transition-all duration-200 
                      ${sel ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] scale-[1.02]' : 'bg-black/40 text-gray-500 border-white/5 hover:border-purple-500/50 hover:text-gray-300'}`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* Level / Rank */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
              <LocalIcon src="/icons/levelrank.png" className="w-8 h-8 opacity-80" alt="Level/Rank" fallback={<div className="w-8 h-8 bg-gray-400 rounded" />} />
              <div className="font-black italic uppercase tracking-widest text-sm text-gray-400">Level/Rank</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
              {Array.from({ length: 14 }).map((_, i) => {
                const sel = p.selectedLevels.includes(i)
                return (
                  <button 
                    key={i} 
                    onClick={() => p.toggleLevel(i)} 
                    className={`px-4 py-3 rounded-xl border-2 font-black uppercase italic tracking-widest text-[11px] transition-all duration-200 
                      ${sel ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-[1.02]' : 'bg-black/40 text-gray-500 border-white/5 hover:border-amber-500/50 hover:text-gray-300'}`}
                  >
                    {i}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* Link Rating */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
              <LocalIcon src="/icons/linkrating.png" className="w-8 h-8 opacity-80" alt="Link Rating" fallback={<div className="w-8 h-8 bg-gray-400 rounded" />} />
              <div className="font-black italic uppercase tracking-widest text-sm text-gray-400">Link Rating</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-6 lg:grid-cols-8 gap-3">
              {[1,2,3,4,5,6].map(n => {
                const sel = p.selectedLinkRatings.includes(n)
                return (
                  <button 
                    key={n} 
                    onClick={() => p.toggleLinkRating(n)} 
                    className={`px-4 py-3 rounded-xl border-2 font-black uppercase italic tracking-widest text-[11px] transition-all duration-200 
                      ${sel ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.3)] scale-[1.02]' : 'bg-black/40 text-gray-500 border-white/5 hover:border-sky-500/50 hover:text-gray-300'}`}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* Link Arrows */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
              <LocalIcon src="/icons/linkmarkers.png" className="w-8 h-8 opacity-80" alt="Link Arrows" fallback={<div className="w-8 h-8 bg-gray-400 rounded" />} />
              <div className="font-black italic uppercase tracking-widest text-sm text-gray-400">Link Arrows</div>
            </div>
          </div>
          <div className="flex-1 flex items-start justify-start">
            <div className="relative w-72 h-72 bg-black/60 rounded-3xl p-6 border border-white/5 shadow-2xl flex items-center justify-center">
              {/* The Base Hexagon Frame */}
              <div className="relative w-full h-full">
                <LocalIcon 
                  src="/icons/linkarrows.png" 
                  className="w-full h-full object-contain opacity-20 contrast-125 grayscale" 
                  alt="Link Arrows Base" 
                  fallback={<div className="w-full h-full bg-gray-800" />} 
                />

                {/* Overlays */}
                {(() => {
                  const map: Record<string,string> = {
                    NW: '/icons/tleftred.png',
                    N: '/icons/topred.png',
                    NE: '/icons/trightred.png',
                    W: '/icons/leftred.png',
                    E: '/icons/rightred.png',
                    SW: '/icons/bleftred.png',
                    S: '/icons/bottomred.png',
                    SE: '/icons/brightred.png',
                  }
                  return ARROWS.map(d => {
                    const isSel = p.selectedLinkArrows.includes(d)
                    const isHover = p.hoveredLinkArrow === d
                    const opacity = isSel ? 1 : (isHover ? 0.4 : 0)
                    return (
                      <img
                        key={`overlay-${d}`}
                        src={map[d]}
                        alt={`${d}-overlay`}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-all duration-200"
                        style={{ 
                          opacity,
                          filter: isSel ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))' : 'none'
                        }}
                      />
                    )
                  })
                })()}

                {/* Invisible Buttons for Interaction - Positioned carefully over the triangle areas */}
                {[
                  { d: 'NW', l: 15, t: 15 },
                  { d: 'N',  l: 50, t: 5 },
                  { d: 'NE', l: 85, t: 15 },
                  { d: 'W',  l: 5,  t: 50 },
                  { d: 'E',  l: 95, t: 50 },
                  { d: 'SW', l: 15, t: 85 },
                  { d: 'S',  l: 50, t: 95 },
                  { d: 'SE', l: 85, t: 85 },
                ].map(({ d, l, t }) => (
                  <div
                    key={d}
                    onClick={() => p.toggleLinkArrow(d)}
                    onMouseEnter={() => p.setHoveredLinkArrow(d)}
                    onMouseLeave={() => p.setHoveredLinkArrow(null)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-all z-10 bg-transparent cursor-pointer border-none outline-none select-none appearance-none"
                    style={{ left: `${l}%`, top: `${t}%`, width: '22%', height: '22%' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* Pendulum Scale */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-teal-500 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.5)]"></div>
              <LocalIcon src="/icons/pendulum.png" className="w-8 h-8 opacity-80" alt="Pendulum Scale" fallback={<div className="w-8 h-8 bg-pink-400 rounded" />} />
              <div className="font-black italic uppercase tracking-widest text-sm text-gray-400">Pendulum Scale</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
              {Array.from({ length: 14 }).map((_, i) => {
                const sel = p.selectedPendulumScales.includes(i)
                return (
                  <button 
                    key={i} 
                    onClick={() => p.togglePendulumScale(i)} 
                    className={`px-4 py-3 rounded-xl border-2 font-black uppercase italic tracking-widest text-[11px] transition-all duration-200 
                      ${sel ? 'bg-teal-500 text-white border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.3)] scale-[1.02]' : 'bg-black/40 text-gray-500 border-white/5 hover:border-teal-500/50 hover:text-gray-300'}`}
                  >
                    {i}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* ATK / DEF Sliders */}
        <div className="grid grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
              <LocalIcon src="/icons/atk.png" className="w-8 h-8 opacity-80" alt="ATK" fallback={<div className="w-8 h-8 bg-gray-400 rounded" />} />
              <div className="font-black italic uppercase tracking-widest text-sm text-gray-400">ATK Range</div>
            </div>
            
            <div className="bg-black/40 rounded-3xl p-8 border border-white/5 shadow-inner">
              <div className="flex items-center justify-between gap-4 mb-8">
                <input
                  type="text"
                  value={p.atkMin === 0 ? '0' : String(p.atkMin)}
                  onChange={e => p.setAtkMinFromInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-center focus:border-red-500/50 outline-none transition-all"
                />
                <div className="font-black text-gray-700">TO</div>
                <input
                  type="text"
                  value={p.atkMax === 5000 ? '5000' : String(p.atkMax)}
                  onChange={e => p.setAtkMaxFromInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-center focus:border-red-500/50 outline-none transition-all"
                />
              </div>

              <div className="relative h-10 flex items-center px-2" ref={p.sliderRef as any}>
                <div className="absolute left-0 right-0 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                    style={{ left: `${(p.atkMin / 5000) * 100}%`, right: `${100 - (p.atkMax / 5000) * 100}%` }}
                  />
                </div>

                <div
                  onMouseDown={p.startDrag('min')}
                  className="absolute top-1/2 w-6 h-6 rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-grab transform -translate-y-1/2 border-2 border-red-600"
                  style={{ left: `${(p.atkMin / 5000) * 100}%` }}
                />

                <div
                  onMouseDown={p.startDrag('max')}
                  className="absolute top-1/2 w-6 h-6 rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-grab transform -translate-y-1/2 border-2 border-red-600"
                  style={{ left: `${(p.atkMax / 5000) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
              <LocalIcon src="/icons/def.png" className="w-8 h-8 opacity-80" alt="DEF" fallback={<div className="w-8 h-8 bg-gray-400 rounded" />} />
              <div className="font-black italic uppercase tracking-widest text-sm text-gray-400">DEF Range</div>
            </div>

            <div className="bg-black/40 rounded-3xl p-8 border border-white/5 shadow-inner">
              <div className="flex items-center justify-between gap-4 mb-8">
                <input
                  type="text"
                  value={p.defMin === 0 ? '0' : String(p.defMin)}
                  onChange={e => p.setDefMinFromInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-center focus:border-blue-500/50 outline-none transition-all"
                />
                <div className="font-black text-gray-700">TO</div>
                <input
                  type="text"
                  value={p.defMax === 5000 ? '5000' : String(p.defMax)}
                  onChange={e => p.setDefMaxFromInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-center focus:border-blue-500/50 outline-none transition-all"
                />
              </div>

              <div className="relative h-10 flex items-center px-2" ref={p.defSliderRef as any}>
                <div className="absolute left-0 right-0 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                    style={{ left: `${(p.defMin / 5000) * 100}%`, right: `${100 - (p.defMax / 5000) * 100}%` }}
                  />
                </div>

                <div
                  onMouseDown={p.defStartDrag('min')}
                  className="absolute top-1/2 w-6 h-6 rounded-full bg-white shadow-[0_0_100px_rgba(0,0,0,0.5)] cursor-grab transform -translate-y-1/2 border-2 border-blue-600"
                  style={{ left: `${(p.defMin / 5000) * 100}%` }}
                />

                <div
                  onMouseDown={p.defStartDrag('max')}
                  className="absolute top-1/2 w-6 h-6 rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-grab transform -translate-y-1/2 border-2 border-blue-600"
                  style={{ left: `${(p.defMax / 5000) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-white/5 via-white/[0.02] to-transparent" />

        {/* Abilities/Other */}
        <div className="flex gap-10">
          <div className="w-48 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-lime-500 rounded-full shadow-[0_0_10px_rgba(132,204,22,0.5)]"></div>
              <LocalIcon src="/icons/abilities.png" className="w-8 h-8 opacity-80" alt="Abilities/Other" fallback={<div className="w-8 h-8 bg-green-400 rounded" />} />
              <div className="font-black italic uppercase tracking-widest text-sm text-gray-400">Abilities</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
              {['Toon','Gemini','Union','Spirit','Tuner','Flip','Special Summon'].map(ab => {
                const sel = p.selectedAbilities.includes(ab)
                return (
                  <button 
                    key={ab} 
                    onClick={() => p.toggleAbility(ab)} 
                    className={`px-4 py-3 rounded-xl border-2 font-black uppercase italic tracking-widest text-[10px] transition-all duration-200 
                      ${sel ? 'bg-lime-500 text-black border-lime-400 shadow-[0_0_20px_rgba(132,204,22,0.3)] scale-[1.02]' : 'bg-black/40 text-gray-500 border-white/5 hover:border-lime-500/50 hover:text-gray-300'}`}
                  >
                    {ab}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={`flex items-center justify-end px-8 py-6 gap-4 ${p.isDark ? 'border-t border-white/5 bg-white/5' : 'border-t border-slate-200'}`}>
        <button 
          onClick={p.resetAll} 
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 font-black uppercase italic tracking-widest text-xs transition-all border border-white/10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          Clear All
        </button>
        <button 
          onClick={p.onCancel} 
          className="px-10 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black uppercase italic tracking-widest text-sm transition-all border border-white/10"
        >
          Cancel
        </button>
        <button 
          onClick={() => p.setFilterOpen(false)} 
          className="px-12 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase italic tracking-widest text-sm transition-all shadow-lg shadow-emerald-500/20"
        >
          Apply Filters
        </button>
      </div>
    </div>
  )
}

function OldDeckFiltersPanel(props: Props) {
  const p = props
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => p.setFilterOpen(false)} />
      <div className={`relative z-60 w-[92%] max-w-3xl p-0 rounded-lg overflow-hidden ${p.isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
        <div className={`flex items-center justify-between px-6 py-3 ${p.isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}`}>
          <div>
            <div className="text-lg font-bold">Filter Menu</div>
            <div className="text-sm text-gray-400 mt-1">
              {p.selectedSubtypes && p.selectedSubtypes.length > 0 && (
                <span className="mr-2">Subtypes: {p.selectedSubtypes.join(', ')}</span>
              )}
              {p.selectedAttributes && p.selectedAttributes.length > 0 && (
                <span>Attributes: {p.selectedAttributes.join(', ')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className={`px-3 py-1 rounded ${p.isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-900'} border`}>Help</button>
            <button onClick={() => p.setFilterOpen(false)} className="text-sm px-3 py-1 rounded border">Close</button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-500">
          {/* Section: Card Frame */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <img src="/icons/cardframeicon.png" alt="Card Frame" className="w-6 h-6" />
                <span>Card Frame</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-4 gap-3">
                {['Normal','Effect','Fusion','Ritual','Synchro','Xyz','Pendulum','Link','Spell','Trap'].map((t:any) => {
                  const sel = p.selectedSubtypes.includes(t)
                  return (
                    <button key={t} onClick={() => p.toggleSubtype(t)} className={`px-4 py-2 rounded border transition-colors ${sel ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-black text-white border-gray-400 hover:border-emerald-400 hover:shadow-[0_0_6px_rgba(16,185,129,0.35)]'}`}>
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Attribute */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/attribute.png" className="w-6 h-6" alt="Attribute" fallback={<div className="w-10 h-10 mx-auto rounded-full bg-yellow-300 flex items-center justify-center">◎</div>} />
                <div>Attribute</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-4 gap-3">
                {['LIGHT','DARK','WATER','FIRE','EARTH','WIND','DIVINE'].map(a => {
                  const sel = p.selectedAttributes.includes(a)
                  return (
                    <button key={a} onClick={() => p.toggleAttribute(a)} className={`px-4 py-2 rounded border transition-colors ${sel ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-black text-white border-gray-400 hover:border-emerald-400 hover:shadow-[0_0_6px_rgba(16,185,129,0.35)]'}`}>
                      {a}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Types of Spell/Trap */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/spelltrap.png" className="w-6 h-6" alt="Types of Spell and Traps" fallback={<div className="w-6 h-6 bg-gray-400 rounded" />} />
                <span>Types of Spell and Traps</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'Spell:Normal', label: 'Normal Spell' },
                  { key: 'Spell:Field', label: 'Field Spell' },
                  { key: 'Spell:Equip', label: 'Equip Spell' },
                  { key: 'Spell:Continuous', label: 'Continuous Spell' },
                  { key: 'Spell:Quick-Play', label: 'Quick-Play Spell' },
                  { key: 'Spell:Ritual', label: 'Ritual Spell' },
                  { key: 'Trap:Normal', label: 'Normal Trap' },
                  { key: 'Trap:Continuous', label: 'Continuous Trap' },
                  { key: 'Trap:Counter', label: 'Counter Trap' },
                ].map((it:any) => {
                  const sel = p.selectedSubtypes.includes(it.key)
                  return (
                    <button key={it.key} onClick={() => p.toggleSubtype(it.key)} className={`px-4 py-2 rounded border transition-colors ${sel ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-black text-white border-gray-400 hover:border-emerald-400 hover:shadow-[0_0_6px_rgba(16,185,129,0.35)]'}`}>
                      {it.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Type */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/type.png" className="w-6 h-6" alt="Type" fallback={<div className="w-6 h-6 bg-purple-600 rounded" />} />
                <span>Type</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-4 gap-3">
                {p.TYPES.map(t => {
                  const sel = p.selectedTypes.includes(t)
                  return (
                    <button key={t} onClick={() => p.toggleType(t)} className={`px-4 py-2 rounded border transition-colors ${sel ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-black text-white border-gray-400 hover:border-emerald-400 hover:shadow-[0_0_6px_rgba(16,185,129,0.35)]'}`}>
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Level / Rank */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/levelrank.png" className="w-6 h-6" alt="Level/Rank" fallback={<div className="w-6 h-6 bg-gray-400 rounded" />} />
                <div>Level/Rank</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 14 }).map((_, i) => {
                  const sel = p.selectedLevels.includes(i)
                  return (
                    <button key={i} onClick={() => p.toggleLevel(i)} className={`px-4 py-2 rounded border transition-colors ${sel ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-black text-white border-gray-400 hover:border-emerald-400 hover:shadow-[0_0_6px_rgba(16,185,129,0.35)]'}`}>
                      {i}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Link Rating */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/linkrating.png" className="w-6 h-6" alt="Link Rating" fallback={<div className="w-6 h-6 bg-gray-400 rounded" />} />
                <div>Link Rating</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-6 gap-3">
                {[1,2,3,4,5,6].map(n => {
                  const sel = p.selectedLinkRatings.includes(n)
                  return (
                    <button key={n} onClick={() => p.toggleLinkRating(n)} className={`px-4 py-2 rounded border transition-colors ${sel ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-black text-white border-gray-400 hover:border-emerald-400 hover:shadow-[0_0_6px_rgba(16,185,129,0.35)]'}`}>
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Link Arrows */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/linkmarkers.png" className="w-6 h-6" alt="Link Arrows" fallback={<div className="w-6 h-6 bg-gray-400 rounded" />} />
                <div>Link Arrows</div>
              </div>
            </div>
            <div className="flex-1 flex items-start justify-start pl-6">
              <div className="relative w-52 h-52">
                <LocalIcon src="/icons/linkarrows.png" className="w-52 h-52 object-contain" alt="Link Arrows" fallback={<div className="w-52 h-52 bg-gray-800" />} />

                {(() => {
                  const map: Record<string,string> = {
                    NW: '/icons/tleftred.png',
                    N: '/icons/topred.png',
                    NE: '/icons/trightred.png',
                    W: '/icons/leftred.png',
                    E: '/icons/rightred.png',
                    SW: '/icons/bleftred.png',
                    S: '/icons/bottomred.png',
                    SE: '/icons/brightred.png',
                  }
                  return ARROWS.map(d => {
                    const isSel = p.selectedLinkArrows.includes(d)
                    const isHover = p.hoveredLinkArrow === d
                    const opacity = isSel ? 1 : (isHover ? 0.15 : 0)
                    const animation = isHover ? (isSel ? 'linkFadeSelected 900ms ease-in-out infinite alternate' : 'linkFade 900ms ease-in-out infinite alternate') : 'none'
                    return (
                      <img
                        key={`overlay-${d}`}
                        src={map[d]}
                        alt={`${d}-overlay`}
                        className="absolute left-0 top-0 w-full h-full object-contain pointer-events-none"
                        style={{ opacity, animation, transition: 'opacity 200ms linear' }}
                      />
                    )
                  })
                })()}

                {[
                  { d: 'NW', l: 12, t: 12 },
                  { d: 'N',  l: 50, t: 8 },
                  { d: 'NE', l: 88, t: 12 },
                  { d: 'W',  l: 8,  t: 50 },
                  { d: 'E',  l: 92, t: 50 },
                  { d: 'SW', l: 12, t: 88 },
                  { d: 'S',  l: 50, t: 92 },
                  { d: 'SE', l: 88, t: 88 },
                ].map(({ d, l, t }) => (
                  <button
                    key={d}
                    onClick={() => p.toggleLinkArrow(d)}
                    onMouseEnter={() => p.setHoveredLinkArrow(d)}
                    onMouseLeave={() => p.setHoveredLinkArrow(null)}
                    aria-label={d}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${l}%`, top: `${t}%`, width: '18%', height: '18%', padding: 0, border: 0, background: 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Pendulum Scale */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/pendulum.png" className="w-6 h-6" alt="Pendulum Scale" fallback={<div className="w-6 h-6 bg-pink-400 rounded" />} />
                <div>Pendulum Scale</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 14 }).map((_, i) => {
                  const sel = p.selectedPendulumScales.includes(i)
                  return (
                    <button key={i} onClick={() => p.togglePendulumScale(i)} className={`px-4 py-2 rounded border transition-colors ${sel ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-black text-white border-gray-400 hover;border-emerald-400 hover:shadow-[0_0_6px_rgba(16,185,129,0.35)]'}`}>
                      {i}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* ATK */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/atk.png" className="w-6 h-6" alt="ATK" fallback={<div className="w-6 h-6 bg-gray-400 rounded" />} />
                <div>ATK</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-3 flex items-center justify-between">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={p.atkMin === 0 ? '' : String(p.atkMin)}
                  onChange={e => p.setAtkMinFromInput(e.target.value)}
                  placeholder=""
                  className="w-28 px-3 py-2 rounded bg-black text-white border border-gray-600"
                />
                <div className="text-sm text-gray-400">-</div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={p.atkMax === 5000 ? '' : String(p.atkMax)}
                  onChange={e => p.setAtkMaxFromInput(e.target.value)}
                  placeholder=""
                  className="w-28 px-3 py-2 rounded bg-black text-white border border-gray-600"
                />
              </div>

              <div
                className="relative h-8 flex items-center"
                ref={p.sliderRef as any}
                onMouseDown={e => e.preventDefault()}
                onTouchStart={e => e.preventDefault()}
              >
                <div className="pointer-events-none absolute left-0 right-0 h-2 flex items-center">
                  <div
                    className="absolute h-2 bg-emerald-400"
                    style={{ left: `${(p.atkMin / 5000) * 100}%`, right: `${100 - (p.atkMax / 5000) * 100}%`, zIndex: 10 }}
                  />
                  <div className="absolute left-0 right-0 h-2 bg-gray-300/20" />
                </div>

                <div
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={5000}
                  aria-valuenow={p.atkMin}
                  onMouseDown={p.startDrag('min')}
                  onTouchStart={p.startDrag('min')}
                  className="absolute top-1/2 w-6 h-6 rounded-full bg-white border-4 border-gray-300 shadow-md cursor-grab"
                  style={{ left: `${(p.atkMin / 5000) * 100}%`, transform: 'translate(-50%, -50%)', zIndex: 30 }}
                />

                <div
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={5000}
                  aria-valuenow={p.atkMax}
                  onMouseDown={p.startDrag('max')}
                  onTouchStart={p.startDrag('max')}
                  className="absolute top-1/2 w-6 h-6 rounded-full bg-white border-4 shadow-md cursor-grab"
                  style={{ left: `${(p.atkMax / 5000) * 100}%`, transform: 'translate(-50%, -50%)', zIndex: 30, borderColor: '#c6f6d5' }}
                />
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* DEF (mirrors ATK) */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/def.png" className="w-6 h-6" alt="DEF" fallback={<div className="w-6 h-6 bg-gray-400 rounded" />} />
                <div>DEF</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-3 flex items-center justify-between">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={p.defMin === 0 ? '' : String(p.defMin)}
                  onChange={e => p.setDefMinFromInput(e.target.value)}
                  placeholder=""
                  className="w-28 px-3 py-2 rounded bg-black text-white border border-gray-600"
                />
                <div className="text-sm text-gray-400">-</div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={p.defMax === 5000 ? '' : String(p.defMax)}
                  onChange={e => p.setDefMaxFromInput(e.target.value)}
                  placeholder=""
                  className="w-28 px-3 py-2 rounded bg-black text-white border border-gray-600"
                />
              </div>

              <div
                className="relative h-8 flex items-center"
                ref={p.defSliderRef as any}
                onMouseDown={e => e.preventDefault()}
                onTouchStart={e => e.preventDefault()}
              >
                <div className="pointer-events-none absolute left-0 right-0 h-2 flex items-center">
                  <div
                    className="absolute h-2 bg-emerald-400"
                    style={{ left: `${(p.defMin / 5000) * 100}%`, right: `${100 - (p.defMax / 5000) * 100}%`, zIndex: 10 }}
                  />
                  <div className="absolute left-0 right-0 h-2 bg-gray-300/20" />
                </div>

                <div
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={5000}
                  aria-valuenow={p.defMin}
                  onMouseDown={p.defStartDrag('min')}
                  onTouchStart={p.defStartDrag('min')}
                  className="absolute top-1/2 w-6 h-6 rounded-full bg-white border-4 border-gray-300 shadow-md cursor-grab"
                  style={{ left: `${(p.defMin / 5000) * 100}%`, transform: 'translate(-50%, -50%)', zIndex: 30 }}
                />

                <div
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={5000}
                  aria-valuenow={p.defMax}
                  onMouseDown={p.defStartDrag('max')}
                  onTouchStart={p.defStartDrag('max')}
                  className="absolute top-1/2 w-6 h-6 rounded-full bg-white border-4 shadow-md cursor-grab"
                  style={{ left: `${(p.defMax / 5000) * 100}%`, transform: 'translate(-50%, -50%)', zIndex: 30, borderColor: '#c6f6d5' }}
                />
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Abilities/Other */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <div className="mb-2 flex items-center gap-2">
                <LocalIcon src="/icons/abilities.png" className="w-6 h-6" alt="Abilities/Other" fallback={<div className="w-6 h-6 bg-green-400 rounded" />} />
                <div>Abilities/Other</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-3 gap-3">
                {['Toon','Gemini','Union','Spirit','Tuner','Flip','Special Summon'].map(ab => {
                  const sel = p.selectedAbilities.includes(ab)
                  return (
                    <button key={ab} onClick={() => p.toggleAbility(ab)} className={`px-4 py-2 rounded border transition-colors ${sel ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-black text-white border-gray-400 hover:border-emerald-400 hover:shadow-[0_0_6px_rgba(16,185,129,0.35)]'}`}>
                      {ab}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

        </div>

        <div className={`px-6 py-4 border-t flex items-center justify-between ${p.isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <button className="px-3 py-2 rounded-md bg-black text-white border border-gray-400">🗑️</button>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={p.onCancel} className="px-6 py-3 rounded-md bg-black text-emerald-400 font-semibold">CANCEL</button>
            <button onClick={() => p.setFilterOpen(false)} className="px-6 py-3 rounded-md bg-black text-emerald-400 font-semibold border border-emerald-400 relative overflow-hidden">
              <span className="absolute left-0 top-0 h-full w-2 bg-emerald-400 transform -skew-x-12" />
              <span className="relative z-10">OK</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
