import React from 'react'

type Props = {
  statButtonsExit: boolean
  statPoints: number
  displayedStats: any
  bumpedStat: string | null
  loading: boolean
  statAnimating: boolean
  onChooseStat: (key: string, e: React.MouseEvent) => void
}

const StatChooser: React.FC<Props> = ({ statButtonsExit, statPoints, displayedStats, bumpedStat, loading, statAnimating, onChooseStat }) => {
  const options = [
    { key: 'dex', label: 'DEX', bg: 'bg-amber-600' },
    { key: 'con', label: 'CON', bg: 'bg-emerald-600' },
    { key: 'str', label: 'STR', bg: 'bg-rose-600' },
    { key: 'int', label: 'INT', bg: 'bg-sky-600' },
    { key: 'cha', label: 'CHA', bg: 'bg-violet-600' }
  ]

  return (
    <div className="mt-6 w-full">
      <div className="w-full flex justify-center">
        <div style={{ transform: statButtonsExit ? 'translateX(-120%)' : 'translateX(0)', transition: 'transform 1200ms cubic-bezier(.2,.9,.2,1), opacity 500ms', opacity: statButtonsExit ? 0 : 1 }}>
          <div className="mb-2 font-semibold">Choose a stat to increase</div>
          <div className="inline-grid grid-cols-5 gap-3">
          {options.map((s, idx) => (
            <button
              key={s.key}
              disabled={statPoints <= 0 || loading || statAnimating}
                style={{ animationDelay: `${idx * 120}ms`, animationName: 'statEntrance', animationDuration: '360ms', animationTimingFunction: 'cubic-bezier(.2,.9,.2,1)', animationFillMode: 'forwards', minWidth: 'clamp(120px, 9vw, 160px)' }}
              onClick={(e) => onChooseStat(s.key, e)}
              className={`${s.bg} text-white p-4 rounded min-w-[160px] flex flex-col items-center justify-center ${statPoints <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 transform transition-shadow duration-150 cursor-pointer'} focus:outline-none relative ${bumpedStat === s.key ? 'stat-bump' : ''} stat-entrance`}
            >
              <div className="text-sm opacity-90">{s.label}</div>
              <div className={`font-bold text-lg mt-1 ${bumpedStat === s.key ? 'scale-110 transition-transform duration-500' : ''}`}>{displayedStats?.[s.key] ?? 0}</div>
            </button>
          ))}
          </div>
        <style jsx>{`
          .stat-entrance { transform: scale(0); opacity: 0; }
          @keyframes statEntrance {
            0% { transform: scale(0); opacity: 0 }
            60% { transform: scale(1.08); opacity: 1 }
            100% { transform: scale(1); opacity: 1 }
          }
        `}</style>
        </div>
      </div>
    </div>
  )
}

export default StatChooser
