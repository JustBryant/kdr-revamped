import React from 'react'

type StatEditorProps = {
  stats: {
    baseHp: number
    baseAtk: number
    baseDef: number
  }
  onChange: (key: string, value: number) => void
}

export default function StatEditor({ stats, onChange }: StatEditorProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Base Stats</h3>
      
      <div className="space-y-6">
        {/* HP Slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Base HP</label>
            <span className="text-sm font-bold text-blue-600">{stats.baseHp}</span>
          </div>
          <input
            type="range"
            min="1000"
            max="8000"
            step="100"
            value={stats.baseHp}
            onChange={(e) => onChange('baseHp', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1000</span>
            <span>8000</span>
          </div>
        </div>

        {/* ATK Slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Base ATK</label>
            <span className="text-sm font-bold text-red-600">{stats.baseAtk}</span>
          </div>
          <input
            type="range"
            min="0"
            max="4000"
            step="50"
            value={stats.baseAtk}
            onChange={(e) => onChange('baseAtk', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* DEF Slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Base DEF</label>
            <span className="text-sm font-bold text-green-600">{stats.baseDef}</span>
          </div>
          <input
            type="range"
            min="0"
            max="4000"
            step="50"
            value={stats.baseDef}
            onChange={(e) => onChange('baseDef', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}
