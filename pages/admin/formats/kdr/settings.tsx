import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Head from 'next/head';
import { RARITIES, RARITY_LABELS } from './treasures';

interface GameSettings {
  id: string;
  levelXpCurve: number[];
  
  classStarterCount: number;
  classStarterCost: number;
  classStarterMinLevel: number;
  classMidCount: number;
  classMidCost: number;
  classMidMinLevel: number;
  classHighCount: number;
  classHighCost: number;
  classHighMinLevel: number;
  
  genericStarterCount: number;
  genericStarterCost: number;
  genericStarterMinLevel: number;
  genericMidCount: number;
  genericMidCost: number;
  genericMidMinLevel: number;
  genericHighCount: number;
  genericHighCost: number;
  genericHighMinLevel: number;

  trainingCost: number;
  trainingXp: number;

  xpPerRound: number;
  goldPerRound: number;

  skillUnlockLevels: number[];
  skillSelectionCount: number;
  treasureRarityWeights: number[];
  treasureOfferCount: number;
}

export default function KDRSettings() {
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form state
  const [xpCurve, setXpCurve] = useState<number[]>([]);
  const [skillLevels, setSkillLevels] = useState<number[]>([]);
  const [treasureWeights, setTreasureWeights] = useState<number[]>([]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSettings();
    }
  }, [status]);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/admin/settings');
      setSettings(res.data);
      setXpCurve(res.data.levelXpCurve);
      setSkillLevels((res.data.skillUnlockLevels || []).sort((a: number, b: number) => a - b));
      const defaultWeights = [70, 20, 8, 2];
      const incomingWeights = Array.isArray(res.data.treasureRarityWeights) ? res.data.treasureRarityWeights : defaultWeights;
      const normalized = RARITIES.map((_, i) => {
        const raw = incomingWeights[i];
        if (raw === undefined || raw === null) return defaultWeights[i] || 0;
        const n = Number(raw);
        return Number.isFinite(n) ? n : (defaultWeights[i] || 0);
      });
      setTreasureWeights(normalized);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch settings', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      // Sort skill levels before saving
      const sortedSkillLevels = [...skillLevels].sort((a, b) => a - b);

      const payload = {
        ...settings,
        levelXpCurve: xpCurve,
        skillUnlockLevels: sortedSkillLevels,
        treasureRarityWeights: treasureWeights
      };
      console.debug('Saving settings payload:', payload);

      const res = await axios.put('/api/admin/settings', payload);

      // Update UI state immediately from returned object to avoid mismatch
      const saved = res.data;
      setSettings(saved);
      setXpCurve(saved.levelXpCurve || []);
      setSkillLevels((saved.skillUnlockLevels || []).slice().sort((a: number, b: number) => a - b));
      const incomingWeights = Array.isArray(saved.treasureRarityWeights) ? saved.treasureRarityWeights : [70,20,8,2];
      const normalized = RARITIES.map((_, i) => {
        const raw = incomingWeights[i];
        if (raw === undefined || raw === null) return [70,20,8,2][i] || 0;
        const n = Number(raw);
        return Number.isFinite(n) ? n : ([70,20,8,2][i] || 0);
      });
      setTreasureWeights(normalized);

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save settings', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateXpLevel = (index: number, value: number) => {
    const newCurve = [...xpCurve];
    newCurve[index] = value;
    setXpCurve(newCurve);
  };

  const addLevel = () => {
    const lastXp = xpCurve.length > 0 ? xpCurve[xpCurve.length - 1] : 0;
    setXpCurve([...xpCurve, lastXp + 1000]);
  };

  const removeLevel = (index: number) => {
    const newCurve = xpCurve.filter((_, i) => i !== index);
    setXpCurve(newCurve);
  };

  const updateSkillLevel = (index: number, value: number) => {
    const newLevels = [...skillLevels];
    newLevels[index] = value;
    setSkillLevels(newLevels);
  };

  const addSkillLevel = () => {
    const lastLevel = skillLevels.length > 0 ? Math.max(...skillLevels) : 1;
    setSkillLevels([...skillLevels, lastLevel + 1]);
  };

  const removeSkillLevel = (index: number) => {
    const newLevels = skillLevels.filter((_, i) => i !== index);
    setSkillLevels(newLevels);
  };

  const updateTreasureWeight = (index: number, value: number) => {
    const newWeights = [...treasureWeights];
    newWeights[index] = value;
    setTreasureWeights(newWeights);
  };

  const addTreasureWeight = () => {
    setTreasureWeights(prev => [...prev, 0]);
  };

  const removeTreasureWeight = (index: number) => {
    setTreasureWeights(prev => prev.filter((_, i) => i !== index));
  };

  const totalTreasureWeight = treasureWeights.reduce((acc, w) => acc + (Number(w) || 0), 0);
  const getTreasurePercent = (index: number) => {
    const w = Number(treasureWeights[index]) || 0;
    if (totalTreasureWeight <= 0) return 0;
    return Math.round((w / totalTreasureWeight) * 1000) / 10; // one decimal place
  };

  const normalizeTreasureWeights = () => {
    const n = RARITIES.length;
    const total = totalTreasureWeight;
    if (total <= 0) {
      // distribute equally when total is zero
      const base = Math.floor(100 / n);
      const rem = 100 - base * n;
      const equal = RARITIES.map((_, i) => base + (i === 0 ? rem : 0));
      setTreasureWeights(equal);
      return;
    }

    // scale to sum = 100 and keep integers
    const rawPerc = treasureWeights.map(w => ((Number(w) || 0) / total) * 100);
    const floored = rawPerc.map(p => Math.floor(p));
    let sum = floored.reduce((a, b) => a + b, 0);
    const out = [...floored];
    // distribute remainder starting from largest fractional parts
    const fractions = rawPerc.map((p, i) => ({ i, frac: p - Math.floor(p) }));
    fractions.sort((a, b) => b.frac - a.frac);
    let idx = 0;
    while (sum < 100) {
      out[fractions[idx % n].i] += 1;
      sum += 1;
      idx += 1;
    }
    setTreasureWeights(out);
  };

  if (status === 'loading' || loading) return <div className="p-8 text-center">Loading...</div>;

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Head>
        <title>KDR Settings | Admin</title>
      </Head>

      <div className="flex items-center mb-8">
        <Link href="/admin/formats/kdr" className="text-blue-600 hover:underline mr-4">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">KDR Settings</h1>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* Level Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">📈</span> Leveling System
          </h2>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Configure the XP required to reach each level. Click on a value to edit it.
              Red boxes indicate that the XP requirement is lower than the previous level (which shouldn't happen).
            </p>

            <div className="flex flex-wrap gap-3">
              {xpCurve.map((xp, idx) => {
                const isInvalid = idx > 0 && xp < xpCurve[idx - 1];
                return (
                  <div key={idx} className={`relative group flex items-center`}>
                    <div className={`
                      flex flex-col items-center p-3 rounded-lg border-2 transition-all
                      ${isInvalid 
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500'}
                    `}>
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Lvl {idx + 1}
                      </span>
                      <input
                        type="number"
                        value={xp}
                        onChange={(e) => updateXpLevel(idx, parseInt(e.target.value) || 0)}
                        className={`
                          w-20 text-center font-mono font-bold bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none
                          ${isInvalid ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}
                        `}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLevel(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="Remove Level"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              
              <button
                type="button"
                onClick={addLevel}
                className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all w-24 h-[76px]"
              >
                <span className="text-2xl text-gray-400 dark:text-gray-500">+</span>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Add Level</span>
              </button>
            </div>
          </div>
        </div>

        {/* Skill Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">⚡</span> Skill System
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skill Selection Count
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                How many random skills are offered to the player when they unlock a skill choice.
              </p>
              <input
                type="number"
                min="1"
                max="10"
                value={settings?.skillSelectionCount || 3}
                onChange={(e) => setSettings(prev => prev ? ({ ...prev, skillSelectionCount: parseInt(e.target.value) }) : null)}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Skill Unlock Levels
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                At which levels do players get to choose a new skill?
              </p>
              
              <div className="flex flex-wrap gap-3">
                {skillLevels.map((level, idx) => (
                  <div key={idx} className="relative group flex items-center">
                    <div className="flex flex-col items-center p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-purple-400 dark:hover:border-purple-500 transition-all">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Unlock
                      </span>
                      <div className="flex items-center">
                        <span className="text-gray-500 dark:text-gray-400 mr-1">Lvl</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={level}
                          onChange={(e) => updateSkillLevel(idx, parseInt(e.target.value) || 0)}
                          className="w-12 text-center font-mono font-bold bg-transparent border-b border-transparent focus:border-purple-500 focus:outline-none text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSkillLevel(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="Remove Unlock"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addSkillLevel}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all w-24 h-[76px]"
                >
                  <span className="text-2xl text-gray-400 dark:text-gray-500">+</span>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Add Unlock</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rewards Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🎁</span> Round Rewards
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                XP Per Round
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Base XP earned by each player at the end of a round.
              </p>
              <input
                type="number"
                min="0"
                value={settings?.xpPerRound || 0}
                onChange={(e) => setSettings(prev => prev ? ({ ...prev, xpPerRound: parseInt(e.target.value) }) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gold Per Round
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Base Gold earned by each player at the end of a round.
              </p>
              <input
                type="number"
                min="0"
                value={settings?.goldPerRound || 0}
                onChange={(e) => setSettings(prev => prev ? ({ ...prev, goldPerRound: parseInt(e.target.value) }) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Shop Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <span className="mr-2">🛒</span> Shop Configuration
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Class Pools Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                Class Loot Pools
              </h3>
              <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                <div>Tier</div>
                <div>Count</div>
                <div>Cost</div>
                <div>Min Lvl</div>
              </div>
              
              {/* Starter */}
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="font-bold text-gray-700 dark:text-gray-300">Starter</div>
                <input
                  type="number"
                  min="0"
                  value={settings?.classStarterCount || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classStarterCount: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="0"
                  value={settings?.classStarterCost || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classStarterCost: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="1"
                  value={settings?.classStarterMinLevel || 1}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classStarterMinLevel: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Mid */}
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="font-bold text-blue-600 dark:text-blue-400">Mid</div>
                <input
                  type="number"
                  min="0"
                  value={settings?.classMidCount || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classMidCount: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="0"
                  value={settings?.classMidCost || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classMidCost: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="1"
                  value={settings?.classMidMinLevel || 1}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classMidMinLevel: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* High */}
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="font-bold text-purple-600 dark:text-purple-400">High</div>
                <input
                  type="number"
                  min="0"
                  value={settings?.classHighCount || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classHighCount: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="0"
                  value={settings?.classHighCost || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classHighCost: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="1"
                  value={settings?.classHighMinLevel || 1}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, classHighMinLevel: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Generic Pools Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                Generic Loot Pools
              </h3>
              <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                <div>Category</div>
                <div>Count</div>
                <div>Cost</div>
                <div>Min Lvl</div>
              </div>
              
              {/* Staples (Starter) */}
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="font-bold text-gray-700 dark:text-gray-300">Staples</div>
                <input
                  type="number"
                  min="0"
                  value={settings?.genericStarterCount || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericStarterCount: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="0"
                  value={settings?.genericStarterCost || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericStarterCost: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="1"
                  value={settings?.genericStarterMinLevel || 1}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericStarterMinLevel: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Removal/Disruption (Mid) */}
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="font-bold text-blue-600 dark:text-blue-400">Removal/Disruption</div>
                <input
                  type="number"
                  min="0"
                  value={settings?.genericMidCount || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericMidCount: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="0"
                  value={settings?.genericMidCost || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericMidCost: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="1"
                  value={settings?.genericMidMinLevel || 1}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericMidMinLevel: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Engine (High) */}
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="font-bold text-purple-600 dark:text-purple-400">Engine</div>
                <input
                  type="number"
                  min="0"
                  value={settings?.genericHighCount || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericHighCount: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="0"
                  value={settings?.genericHighCost || 0}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericHighCost: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="1"
                  value={settings?.genericHighMinLevel || 1}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericHighMinLevel: parseInt(e.target.value) }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Training Section */}
            <div className="space-y-4 lg:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-6 mt-2">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                Training
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Training Cost (Gold)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Cost to purchase a training session.
                  </p>
                  <input
                    type="number"
                    min="0"
                    value={settings?.trainingCost || 0}
                    onChange={(e) => setSettings(prev => prev ? ({ ...prev, trainingCost: parseInt(e.target.value) }) : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Training XP Gain
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    XP gained from a single training session.
                  </p>
                  <input
                    type="number"
                    min="0"
                    value={settings?.trainingXp || 0}
                    onChange={(e) => setSettings(prev => prev ? ({ ...prev, trainingXp: parseInt(e.target.value) }) : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Treasures Settings */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700 mt-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="mr-2">💎</span> Treasure Rarity Odds
            </h2>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Configure the relative weights for treasure rarities. These are treated as weights when rolling treasure rarity.
            </p>

            <div className="flex items-center justify-between mb-3">
              <div>
                {totalTreasureWeight <= 0 ? (
                  <span className="text-sm text-red-600 dark:text-red-400">Total weight is 0 — rolls will fallback. Set weights or normalize.</span>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total weight: {totalTreasureWeight}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={normalizeTreasureWeights}
                  className="px-3 py-1 text-sm rounded-md bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm"
                >
                  Normalize to 100
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {RARITIES.map((rarity, idx) => (
                <div key={rarity} className="flex flex-col items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{RARITY_LABELS[rarity]} ({rarity})</span>
                  <input
                    type="number"
                    min={0}
                    value={treasureWeights[idx] ?? 0}
                    onChange={(e) => updateTreasureWeight(idx, parseInt(e.target.value) || 0)}
                    className="w-20 text-center font-mono font-bold bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">{getTreasurePercent(idx)}%</span>
                </div>
              ))}
            </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Treasures Offered</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">How many treasure items are shown/offered when a treasure roll happens.</p>
                <input
                  type="number"
                  min={0}
                  value={settings?.treasureOfferCount ?? 1}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, treasureOfferCount: parseInt(e.target.value) || 0 }) : null)}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-3 rounded-md text-white font-bold shadow-sm transition-colors ${
              saving 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
