import React, { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ClassImage from '../common/ClassImage'
import CardImage from '../common/CardImage'
import CardPreview from '../class-editor/shared/CardPreview'

type Props = {
  settings: any
  onChange: (s: any) => void
  onSave: (s: any) => Promise<void>
  saving?: boolean
  classes?: any[]
  skills?: any[]
}

export default function SettingsEditor({ settings, onChange, onSave, saving, classes, skills }: Props) {
  const [activeTab, setActiveTab] = useState<'general' | 'classes' | 'skills' | 'modifiers'>('general')
  const [hoveredSkill, setHoveredSkill] = useState<any>(null)
  const [hoveredCard, setHoveredCard] = useState<{ card: any, skill: any } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const initial = useMemo(() => ({
    levelXpCurve: (Array.isArray(settings?.levelXpCurve) && settings.levelXpCurve.length > 0) ? settings.levelXpCurve.slice() : [0],
    trainingCost: settings?.trainingCost ?? 50,
    trainingXp: settings?.trainingXp ?? 100,
    treasureRarityWeights: Array.isArray(settings?.treasureRarityWeights) ? settings.treasureRarityWeights.slice(0,4) : [70,20,8,2],
    treasureOfferCount: settings?.treasureOfferCount ?? 1,
    xpPerRound: settings?.xpPerRound ?? 100,
    goldPerRound: settings?.goldPerRound ?? 50,
    classStarterCount: settings?.classStarterCount ?? 1,
    classStarterCost: settings?.classStarterCost ?? 1,
    classStarterMinLevel: settings?.classStarterMinLevel ?? 1,
    classMidCount: settings?.classMidCount ?? 1,
    classMidCost: settings?.classMidCost ?? 100,
    classMidMinLevel: settings?.classMidMinLevel ?? 3,
    classHighCount: settings?.classHighCount ?? 1,
    classHighCost: settings?.classHighCost ?? 200,
    classHighMinLevel: settings?.classHighMinLevel ?? 5,

    genericStarterCount: settings?.genericStarterCount ?? 1,
    genericStarterCost: settings?.genericStarterCost ?? 1,
    genericStarterMinLevel: settings?.genericStarterMinLevel ?? 1,
    genericMidCount: settings?.genericMidCount ?? 1,
    genericMidCost: settings?.genericMidCost ?? 100,
    genericMidMinLevel: settings?.genericMidMinLevel ?? 3,
    genericHighCount: settings?.genericHighCount ?? 1,
    genericHighCost: settings?.genericHighCost ?? 200,
    genericHighMinLevel: settings?.genericHighMinLevel ?? 5,
    skillUnlockLevels: settings?.skillUnlockLevels || [],
    skillSelectionCount: settings?.skillSelectionCount ?? 3,
    classChoices: settings?.classChoices ?? 3,
    allowDuplicateClasses: settings?.allowDuplicateClasses ?? true,
    disabledClassIds: settings?.disabledClassIds || [],
    disabledSkillIds: settings?.disabledSkillIds || []
  }), [settings])

  const [local, setLocal] = useState<any>(initial)
  React.useEffect(() => setLocal(initial), [initial])

  const commit = (next: any) => {
    // enforce first level exists and is 0
    const nextCopy = { ...next }
    nextCopy.levelXpCurve = (nextCopy.levelXpCurve && nextCopy.levelXpCurve.length > 0) ? nextCopy.levelXpCurve.slice() : [0]
    nextCopy.levelXpCurve[0] = 0
    setLocal(nextCopy)
    onChange(nextCopy)
  }

  const toggleClass = (classId: string) => {
    const arr = [...(local.disabledClassIds || [])]
    const idx = arr.indexOf(classId)
    if (idx >= 0) {
      arr.splice(idx, 1)
    } else {
      // enforce at least 1 pickable class
      const totalClasses = classes?.length || 0
      if (arr.length >= totalClasses - 1) {
        return // do nothing, don't allow disabling last class
      }
      arr.push(classId)
    }
    commit({ ...local, disabledClassIds: arr })
  }

  const toggleSkill = (skillId: string) => {
    const arr = [...(local.disabledSkillIds || [])]
    const idx = arr.indexOf(skillId)
    if (idx >= 0) arr.splice(idx, 1)
    else arr.push(skillId)
    commit({ ...local, disabledSkillIds: arr })
  }

  const setLevelXp = (idx: number, val: number) => {
    if (idx === 0) return // level 0 must always be 0
    const next = { ...local, levelXpCurve: (local.levelXpCurve || []).slice() }
    next.levelXpCurve[idx] = Number(val || 0)
    commit(next)
  }
  const addLevel = () => commit({ ...local, levelXpCurve: [...(local.levelXpCurve || []), 100] })
  const removeLevel = (idx: number) => {
    const arr = (local.levelXpCurve || []).slice()
    if (arr.length <= 1) return // never remove the last level
    if (idx === 0) return // never remove level 0
    arr.splice(idx,1)
    commit({ ...local, levelXpCurve: arr })
  }

  const setTreasureWeight = (idx: number, val: number) => { const arr = (local.treasureRarityWeights || [0,0,0,0]).slice(); arr[idx] = Number(val || 0); commit({ ...local, treasureRarityWeights: arr }) }
  const addTreasureWeight = () => commit({ ...local, treasureRarityWeights: [...(local.treasureRarityWeights || []), 0] })
  const removeTreasureWeight = (idx: number) => { const arr = (local.treasureRarityWeights || []).slice(); arr.splice(idx,1); commit({ ...local, treasureRarityWeights: arr }) }
  const normalizeWeights = () => {
    const arr = (local.treasureRarityWeights || []).slice()
    const total = arr.reduce((s:number, v:number) => s + Number(v || 0), 0) || 1
    const normalized = arr.map((v: number) => Math.round((Number(v||0) / total) * 100))
    commit({ ...local, treasureRarityWeights: normalized })
  }

  const setSkillUnlock = (idx: number, val: number) => { const arr = (local.skillUnlockLevels || []).slice(); arr[idx] = Number(val || 0); commit({ ...local, skillUnlockLevels: arr }) }
  const addSkillUnlock = () => commit({ ...local, skillUnlockLevels: [...(local.skillUnlockLevels || []), 2] })
  const removeSkillUnlock = (idx: number) => { const arr = (local.skillUnlockLevels || []).slice(); arr.splice(idx,1); commit({ ...local, skillUnlockLevels: arr }) }

  const totalWeight = (local.treasureRarityWeights || []).reduce((s:number,v:number)=>s+Number(v||0),0) || 0

  return (
    <div className="space-y-6 text-base text-gray-200">
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-2 font-semibold transition-colors ${activeTab === 'general' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
        >
          General Settings
        </button>
        {classes && classes.length > 0 && (
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-6 py-2 font-semibold transition-colors ${activeTab === 'classes' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
          >
            Allowed Classes
          </button>
        )}
        {skills && skills.length > 0 && (
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-6 py-2 font-semibold transition-colors ${activeTab === 'skills' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
          >
            Allowed Generic Skills
          </button>
        )}
        <button
          onClick={() => setActiveTab('modifiers')}
          className={`px-6 py-2 font-semibold transition-colors ${activeTab === 'modifiers' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
        >
          Game Modifiers
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {activeTab === 'general' ? (
          <div className="space-y-8">
            {/* Leveling System */}
            <section className="p-6 bg-gray-800 rounded border border-gray-700">
              <div className="mb-4">
                <div className="text-2xl font-semibold">Leveling System</div>
                <div className="text-sm text-gray-400 mt-1">Configure the XP required to reach each level. Click a value to edit it. Red boxes indicate that the XP requirement is lower than the previous level (which shouldn't happen).</div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                {(local.levelXpCurve || []).map((xp:number, i:number) => (
                  <div key={i} className="p-4 bg-gray-700 border border-gray-600 rounded flex flex-col items-center">
                    <div className="text-xs text-gray-300 mb-2">LVL {i+1}</div>
                    <div className="w-full">
                      <input
                        type="number"
                        value={xp}
                        onChange={(e) => setLevelXp(i, Number(e.target.value))}
                        className={`w-full text-center text-lg font-semibold bg-transparent text-white outline-none py-2 ${i === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                        disabled={i === 0}
                      />
                    </div>
                    {i !== 0 && (
                      <button onClick={() => removeLevel(i)} className="mt-3 text-xs text-rose-400">Remove</button>
                    )}
                  </div>
                ))}

                <button onClick={addLevel} className="flex items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded text-gray-400">
                  <div className="text-center">
                    <div className="text-3xl">+</div>
                    <div className="text-sm">Add Level</div>
                  </div>
                </button>
              </div>
            </section>

            {/* Round Rewards */}
            <section className="p-6 bg-gray-800 rounded border border-gray-700">
              <div className="mb-3">
                <div className="text-2xl font-semibold text-white">Round Rewards</div>
                <div className="text-sm text-gray-400 mt-1">Base rewards given at the end of each round.</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold mb-1">XP Per Round</div>
                  <input type="number" value={local.xpPerRound} onChange={(e) => commit({ ...local, xpPerRound: Number(e.target.value) })} className="w-full p-2 rounded bg-gray-700 text-white text-sm text-center" />
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1">Gold Per Round</div>
                  <input type="number" value={local.goldPerRound} onChange={(e) => commit({ ...local, goldPerRound: Number(e.target.value) })} className="w-full p-2 rounded bg-gray-700 text-white text-sm text-center" />
                </div>
              </div>
            </section>

            {/* Shop Configuration */}
            <section className="p-6 bg-gray-800 rounded border border-gray-700">
              <div className="mb-4">
                <div className="text-2xl font-semibold text-white">Shop Configuration</div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Class Loot Pools</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="text-sm font-bold">Starter</div>
                      <input type="number" value={local.classStarterCount} onChange={(e) => commit({ ...local, classStarterCount: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.classStarterCost} onChange={(e) => commit({ ...local, classStarterCost: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.classStarterMinLevel} onChange={(e) => commit({ ...local, classStarterMinLevel: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                    </div>
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="text-sm text-blue-300 font-bold">Mid</div>
                      <input type="number" value={local.classMidCount} onChange={(e) => commit({ ...local, classMidCount: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.classMidCost} onChange={(e) => commit({ ...local, classMidCost: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.classMidMinLevel} onChange={(e) => commit({ ...local, classMidMinLevel: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                    </div>
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="text-sm text-purple-400 font-bold">High</div>
                      <input type="number" value={local.classHighCount} onChange={(e) => commit({ ...local, classHighCount: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.classHighCost} onChange={(e) => commit({ ...local, classHighCost: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.classHighMinLevel} onChange={(e) => commit({ ...local, classHighMinLevel: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Generic Loot Pools</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="text-sm font-bold">Staples</div>
                      <input type="number" value={local.genericStarterCount} onChange={(e) => commit({ ...local, genericStarterCount: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.genericStarterCost} onChange={(e) => commit({ ...local, genericStarterCost: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.genericStarterMinLevel} onChange={(e) => commit({ ...local, genericStarterMinLevel: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                    </div>
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="text-sm text-blue-300 font-bold">Removal</div>
                      <input type="number" value={local.genericMidCount} onChange={(e) => commit({ ...local, genericMidCount: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.genericMidCost} onChange={(e) => commit({ ...local, genericMidCost: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.genericMidMinLevel} onChange={(e) => commit({ ...local, genericMidMinLevel: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                    </div>
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="text-sm text-purple-400 font-bold">Engine</div>
                      <input type="number" value={local.genericHighCount} onChange={(e) => commit({ ...local, genericHighCount: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.genericHighCost} onChange={(e) => commit({ ...local, genericHighCost: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                      <input type="number" value={local.genericHighMinLevel} onChange={(e) => commit({ ...local, genericHighMinLevel: Number(e.target.value) })} className="w-full px-2 py-1 border rounded bg-gray-700" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-700 pt-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Training</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-semibold mb-1">Training Cost (Gold)</div>
                    <input type="number" value={local.trainingCost} onChange={(e) => commit({ ...local, trainingCost: Number(e.target.value) })} className="w-full p-2 rounded bg-gray-700 text-white text-sm text-center" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">Training XP Gain</div>
                    <input type="number" value={local.trainingXp} onChange={(e) => commit({ ...local, trainingXp: Number(e.target.value) })} className="w-full p-2 rounded bg-gray-700 text-white text-sm text-center" />
                  </div>
                </div>
              </div>
            </section>

            {/* Skill System */}
            <section className="p-6 bg-gray-800 rounded border border-gray-700">
              <div className="mb-3">
                <div className="text-2xl font-semibold text-white">Skill System</div>
                <div className="text-sm text-gray-400 mt-1">Skill Selection Count</div>
                <div className="text-xs text-gray-500 mt-1">How many random skills are offered to the player when they unlock a skill choice.</div>
              </div>
              <div className="mb-4">
                <input type="number" value={local.skillSelectionCount} onChange={(e) => commit({ ...local, skillSelectionCount: Number(e.target.value) })} className="w-20 p-2 rounded bg-gray-700 text-white text-sm text-center" />
              </div>

              <div className="mb-3 border-t border-gray-700 pt-4">
                <div className="text-lg font-semibold text-white">Class Pick System</div>
                <div className="text-sm text-gray-400 mt-1">Class Option Count</div>
                <div className="text-xs text-gray-500 mt-1">How many random classes are offered at the start (limited by total available classes).</div>
              </div>
              <div className="mb-4">
                <input type="number" value={local.classChoices} onChange={(e) => commit({ ...local, classChoices: Number(e.target.value) })} className="w-20 p-2 rounded bg-gray-700 text-white text-sm text-center" />
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="text-sm font-semibold mb-2">Skill Unlock Levels</div>
                <div className="flex gap-3 flex-wrap">
                  {(local.skillUnlockLevels || []).map((lv:number,i:number) => (
                    <div key={i} className="p-3 bg-gray-700 border border-gray-600 rounded w-36 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-400">UNLOCK</div>
                        <input type="number" value={lv} onChange={(e) => setSkillUnlock(i, Number(e.target.value))} className="w-20 p-2 rounded bg-gray-800 text-white text-sm text-center mt-1" />
                      </div>
                      <button onClick={() => removeSkillUnlock(i)} className="text-rose-400 text-sm">×</button>
                    </div>
                  ))}
                  <button onClick={addSkillUnlock} className="p-3 border-2 border-dashed border-gray-600 rounded text-gray-400">+ Add Unlock</button>
                </div>
              </div>
            </section>

            {/* Treasure Rarity Weights */}
            <section className="p-6 bg-gray-800 rounded border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-2xl font-semibold">Treasure</div>
                  <div className="text-sm text-gray-400 mt-1">Configure relative weights for treasure rarities. Use "Normalize" to make them sum to 100%.</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={normalizeWeights} className="px-3 py-1 bg-blue-600 rounded text-sm">Normalize</button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {(local.treasureRarityWeights || []).map((w:number,i:number) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-gray-700 border border-gray-600 rounded">
                      <div className="flex items-center gap-3 w-28 text-gray-300">
                        {(() => {
                          const files = ['N.png','R.png','SR.png','UR.png']
                          const file = files[i] || ''
                          return <img src={`/images/rarity/${file}`} alt={['Normal','Rare','Super Rare','Ultra Rare'][i] || `Tier ${i+1}`} className="w-5 h-5 object-contain" onError={(e:any)=>{e.currentTarget.src=''}} />
                        })()}
                        <div>{['Normal','Rare','Super Rare','Ultra Rare'][i] || `Tier ${i+1}`}</div>
                      </div>
                      <input type="number" value={w} onChange={(e) => setTreasureWeight(i, Number(e.target.value))} className="w-24 p-2 rounded bg-gray-800 text-white text-base text-center" />
                      <div className="text-sm text-gray-400">{totalWeight ? Math.round((Number(w||0)/totalWeight)*100) : 0}%</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="text-sm text-gray-400">Total weight: {totalWeight}</div>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-sm text-gray-300 mr-2">Treasures Offered</label>
                    <input type="number" value={local.treasureOfferCount} onChange={(e) => commit({ ...local, treasureOfferCount: Number(e.target.value) })} className="w-16 px-2 py-1 border rounded bg-gray-700 text-white text-center" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : activeTab === 'classes' ? (
          <div className="p-6 bg-gray-800 rounded border border-gray-700">
            <div className="mb-6">
              <div className="text-2xl font-semibold text-white">Allowed Classes</div>
              <div className="text-sm text-gray-400 mt-1">Select classes that are allowed to be picked in this KDR. Red overlays indicate the class is disabled.</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {classes?.map((c: any) => {
                const isDisabled = local.disabledClassIds?.includes(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleClass(c.id)}
                    className={`relative group flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      isDisabled 
                        ? 'border-rose-900 bg-rose-950/20 opacity-60 grayscale' 
                        : 'border-gray-700 bg-gray-900/40 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                    }`}
                  >
                    <div className="relative w-full aspect-square mb-2 overflow-hidden rounded bg-black/20">
                      {c.image || c.img ? (
                        <ClassImage image={c.image || c.img} alt={c.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500 italic">No Image</div>
                      )}
                      {isDisabled && (
                        <div className="absolute inset-0 bg-rose-900/40 flex items-center justify-center">
                          <div className="px-2 py-1 bg-black/80 rounded text-[10px] font-bold text-white uppercase tracking-wider">Disabled</div>
                        </div>
                      )}
                    </div>
                    <div className={`text-sm font-bold text-center ${isDisabled ? 'text-rose-400' : 'text-white'}`}>
                      {c.name}
                    </div>
                    {!isDisabled && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 border border-black flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : activeTab === 'skills' ? (
          <div className="p-6 bg-gray-800 rounded border border-gray-700">
            <div className="mb-6">
              <div className="text-2xl font-semibold text-white">Allowed Generic Skills</div>
              <div className="text-sm text-gray-400 mt-1">Select generic skills that are allowed to appear in this KDR. Red items indicate the skill is disabled.</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills?.filter((s: any) => !s.name.toLowerCase().includes(' (copy)') && !s.name.toLowerCase().includes(' copy')).map((s: any) => {
                const isDisabled = local.disabledSkillIds?.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSkill(s.id)}
                    onMouseMove={(e) => {
                      setHoveredSkill(s)
                      setMousePos({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseLeave={() => setHoveredSkill(null)}
                    className={`relative flex flex-col p-4 rounded-lg border-2 text-left transition-all ${
                      isDisabled 
                        ? 'border-rose-900 bg-rose-950/20 opacity-60' 
                        : 'border-gray-700 bg-gray-900/40 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <img src="/icons/skill_icon.png" alt="skill" className="w-6 h-6 object-contain" />
                        <div className={`font-bold ${isDisabled ? 'text-rose-400' : 'text-white'}`}>{s.name}</div>
                      </div>
                      {!isDisabled && (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 border border-black flex items-center justify-center scale-75">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                      {isDisabled && (
                        <div className="px-1.5 py-0.5 bg-rose-900 rounded text-[8px] font-bold text-white uppercase">Disabled</div>
                      )}
                    </div>
                    
                    {s.providesCards && s.providesCards.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {s.providesCards.map((card: any) => (
                          <div 
                            key={card.id} 
                            className="w-14 relative group/card cursor-help z-10"
                            onMouseEnter={(e) => {
                              e.stopPropagation()
                              setHoveredCard({ card, skill: s })
                              setMousePos({ x: e.clientX, y: e.clientY })
                            }}
                            onMouseMove={(e) => {
                              e.stopPropagation()
                              setMousePos({ x: e.clientX, y: e.clientY })
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation()
                              setHoveredCard(null)
                            }}
                          >
                            <CardImage card={card} konamiId={card.konamiId} alt={card.name} className="w-full h-full object-contain rounded shadow-md border border-gray-700" />
                          </div>
                        ))}
                      </div>
                    )}

                    {s.cost > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] text-amber-400 font-bold px-1.5 py-0.5 bg-amber-400/10 rounded">{s.cost} Gold</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gray-800 rounded border border-gray-700">
            <div className="mb-6">
              <div className="text-2xl font-semibold text-white">Game Modifiers</div>
              <div className="text-sm text-gray-400 mt-1">Enable or disable global modifiers for this KDR.</div>
            </div>
            
            <div className="space-y-4">
              <button 
                onClick={() => commit({ ...local, allowDuplicateClasses: !local.allowDuplicateClasses })}
                className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  local.allowDuplicateClasses 
                    ? 'border-emerald-500 bg-emerald-500/10' 
                    : 'border-gray-700 bg-gray-900/40 opacity-60'
                }`}
              >
                <div className="flex flex-col text-left">
                  <div className={`font-bold ${local.allowDuplicateClasses ? 'text-emerald-400' : 'text-gray-400'}`}>Allow Duplicate Classes</div>
                  <div className="text-sm text-gray-400 mt-0.5">Multiple players can pick the same class. If disabled, picking a class locks it for everyone else.</div>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors ${local.allowDuplicateClasses ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${local.allowDuplicateClasses ? 'right-1' : 'left-1'}`} />
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {hoveredSkill && !hoveredCard && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[999999] pointer-events-none max-w-sm bg-gray-900 border-2 border-emerald-500/50 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.8)] p-5"
          style={{ 
            top: mousePos.y + 15,
            left: mousePos.x + 15,
            transform: (mousePos.x + 400 > window.innerWidth) ? 'translateX(-100%)' : 'none'
          }}
        >
          <div className="relative flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <div className="flex items-center gap-2">
                <img src="/icons/skill_icon.png" alt="skill" className="w-5 h-5 object-contain" />
                <div className="text-xl font-bold text-white tracking-wide">{hoveredSkill.name}</div>
              </div>
              {hoveredSkill.cost > 0 && (
                <div className="px-2 py-1 bg-amber-400/20 text-amber-400 rounded-md text-xs font-bold border border-amber-400/30">
                  {hoveredSkill.cost} Gold
                </div>
              )}
            </div>
            
            <div className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap italic overflow-auto max-h-[40vh]">
              {hoveredSkill.description}
            </div>

            {hoveredSkill.providesCards && hoveredSkill.providesCards.length > 0 && (
              <div className="mt-2 pt-3 border-t border-gray-800">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Provides {hoveredSkill.providesCards.length} Card(s)</div>
                <div className="flex flex-wrap gap-1.5">
                  {hoveredSkill.providesCards.map((c: any) => (
                    <div 
                      key={c.id} 
                      className="w-14 cursor-help"
                      onMouseEnter={(e) => {
                        e.stopPropagation()
                        setHoveredCard({ card: c, skill: hoveredSkill })
                        setMousePos({ x: e.clientX, y: e.clientY })
                      }}
                      onMouseMove={(e) => {
                        e.stopPropagation()
                        setMousePos({ x: e.clientX, y: e.clientY })
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation()
                        setHoveredCard(null)
                      }}
                    >
                      <CardImage card={c} konamiId={c.konamiId} alt={c.name} className="w-full h-full object-contain rounded shadow-md border border-gray-700" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {hoveredCard && typeof document !== 'undefined' && createPortal(
         <div 
            className="fixed z-[9999999] pointer-events-none origin-top-left"
            style={{ 
              top: Math.max(10, Math.min(mousePos.y + 15, window.innerHeight - (650 * 0.85))),
              left: Math.max(10, Math.min(mousePos.x + 15, window.innerWidth - (320 * 0.85) - 20)),
              transform: 'scale(0.85)'
            }}
          >
            <CardPreview card={hoveredCard.card} skills={[hoveredCard.skill]} className="w-80 shadow-[0_0_60px_rgba(0,0,0,1)]" />
          </div>,
        document.body
      )}

      <div className="flex items-center justify-end">
        <button onClick={() => onSave(local)} disabled={saving} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-lg">{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>
    </div>
  )
}
