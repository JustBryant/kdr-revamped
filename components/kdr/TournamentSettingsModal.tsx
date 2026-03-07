import React from 'react'
import AnimatedModal from '../common/AnimatedModal'

type Props = {
  isOpen: boolean
  onClose: () => void
  settings: any
  formatName?: string
  fallbackSettings?: any
}

export default function TournamentSettingsModal({ isOpen, onClose, settings, formatName, fallbackSettings }: Props) {
  const activeSettings = settings || fallbackSettings

  if (!activeSettings) {
    return (
      <AnimatedModal open={isOpen} onClose={onClose}>
        <div className="bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4 italic">No settings configuration found for this tournament.</div>
            <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Close</button>
          </div>
        </div>
      </AnimatedModal>
    )
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h4 className="text-sm font-black uppercase tracking-widest text-indigo-500 mb-3 border-b border-white/5 pb-1 flex justify-between">
        {title}
        {!settings && fallbackSettings && <span className="text-[10px] text-orange-500/50 normal-case font-normal">(Using current format defaults)</span>}
      </h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {children}
      </div>
    </div>
  )

  const Row = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  )

  const rarityLabels = ['Common', 'Rare', 'Super Rare', 'Ultra Rare']

  return (
    <AnimatedModal open={isOpen} onClose={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">
              Tournament Settings
            </h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
              Format: {formatName || 'Standard'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <Section title="Economy & Progression">
            <Row label="Gold per Round" value={`+${activeSettings.goldPerRound || 0}`} />
            <Row label="XP per Round" value={`+${activeSettings.xpPerRound || 0}`} />
            <Row label="Training Cost" value={`${activeSettings.trainingCost || 0} Gold`} />
            <Row label="Training XP" value={`${activeSettings.trainingXp || 0} XP`} />
          </Section>

          <Section title="Shop Availability">
            <Row label="Class Starters" value={`${activeSettings.classStarterCount || 0} (Lvl ${activeSettings.classStarterMinLevel || 1}+)`} />
            <Row label="Class Mid-Tier" value={`${activeSettings.classMidCount || 0} (Lvl ${activeSettings.classMidMinLevel || 3}+)`} />
            <Row label="Class High-Tier" value={`${activeSettings.classHighCount || 0} (Lvl ${activeSettings.classHighMinLevel || 5}+)`} />
            <Row label="Generic Starters" value={`${activeSettings.genericStarterCount || 0} (Lvl ${activeSettings.genericStarterMinLevel || 1}+)`} />
            <Row label="Generic Mid-Tier" value={`${activeSettings.genericMidCount || 0} (Lvl ${activeSettings.genericMidMinLevel || 3}+)`} />
            <Row label="Generic High-Tier" value={`${activeSettings.genericHighCount || 0} (Lvl ${activeSettings.genericHighMinLevel || 5}+)`} />
          </Section>

          <Section title="Skills & Leveling">
            <Row label="Skill Choices" value={activeSettings.skillSelectionCount || 3} />
            <Row label="Skill Unlocks" value={Array.isArray(activeSettings.skillUnlockLevels) ? activeSettings.skillUnlockLevels.join(', ') : 'None'} />
            <Row label="Max Level" value={Array.isArray(activeSettings.levelXpCurve) ? activeSettings.levelXpCurve.length - 1 : 'N/A'} />
          </Section>

          {activeSettings.treasureRarityWeights && (
            <Section title="Treasure Weights">
              {activeSettings.treasureRarityWeights.map((w: number, i: number) => (
                <Row key={i} label={rarityLabels[i] || `Rarity ${i}`} value={`${w}%`} />
              ))}
              <Row label="Offers per Round" value={activeSettings.treasureOfferCount || 1} />
            </Section>
          )}

          {(activeSettings.disabledClassIds?.length > 0 || activeSettings.disabledSkillIds?.length > 0) && (
            <Section title="Restrictions">
              {activeSettings.disabledClassIds?.length > 0 && (
                <div className="col-span-2 mt-1">
                  <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Disabled Classes</div>
                  <div className="flex flex-wrap gap-1">
                    {activeSettings.disabledClassIds.map((id: string) => (
                      <span key={id} className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20">{id}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>

        <button 
          onClick={onClose}
          className="mt-8 w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition border border-white/10 uppercase tracking-widest text-xs"
        >
          Close View
        </button>
      </div>
    </AnimatedModal>
  )
}
