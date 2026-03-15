import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Head from 'next/head';
import { RARITIES, RARITY_LABELS } from './treasures';
import { useRouter } from 'next/router';

interface GameSettings {
  id: string;
  levelXpCurve: number[];
  interest?: {
    requirement?: number;
    per?: number;
  };
  // legacy keys supported by some saved formats
  interestRequirement?: number;
  interestPer?: number;
  
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

export default function FormatSettings() {
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [snapshotKdrId, setSnapshotKdrId] = useState<string>('')
  const router = useRouter();
  const slug = Array.isArray(router.query.slug) ? router.query.slug[0] : router.query.slug as string | undefined;

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
      const res = await axios.get(`/api/admin/settings?format=${encodeURIComponent(slug || 'kdr')}`);
      setSettings(res.data);
      setXpCurve(res.data.levelXpCurve);
      setSkillLevels((res.data.skillUnlockLevels || []).sort((a: number, b: number) => a - b));
      const defaultWeights = [70, 20, 8, 2];
      const incomingWeights = Array.isArray(res.data.treasureRarityWeights) ? res.data.treasureRarityWeights : defaultWeights;
      const normalized = RARITIES.map((_: any, i: number) => {
        const raw = incomingWeights[i];
        if (raw === undefined || raw === null) return defaultWeights[i] || 0;
        const n = Number(raw);
        return Number.isFinite(n) ? n : (defaultWeights[i] || 0);
      });
      setTreasureWeights(normalized);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch settings', error);
      // If format missing, send user back to formats list
      // axios error shape: error.response.status
      // @ts-ignore
      if (error?.response?.status === 404) {
        router.replace('/admin/formats')
        return
      }
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
      const sortedSkillLevels = [...skillLevels].sort((a, b) => a - b);

      const payload = {
        ...settings,
        levelXpCurve: xpCurve,
        skillUnlockLevels: sortedSkillLevels,
        treasureRarityWeights: treasureWeights
      };
      console.debug('Saving settings payload:', payload);

      const res = await axios.put(`/api/admin/settings?format=${encodeURIComponent(slug || 'kdr')}`, payload);

      const saved = res.data;
      setSettings(saved);
      setXpCurve(saved.levelXpCurve || []);
      setSkillLevels((saved.skillUnlockLevels || []).slice().sort((a: number, b: number) => a - b));
      const incomingWeights = Array.isArray(saved.treasureRarityWeights) ? saved.treasureRarityWeights : [70,20,8,2];
      const normalized = RARITIES.map((_: any, i: number) => {
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
      const base = Math.floor(100 / n);
      const rem = 100 - base * n;
      const equal = RARITIES.map((_: any, i: number) => base + (i === 0 ? rem : 0));
      setTreasureWeights(equal);
      return;
    }

    const rawPerc = treasureWeights.map(w => ((Number(w) || 0) / total) * 100);
    const floored = rawPerc.map(p => Math.floor(p));
    let sum = floored.reduce((a, b) => a + b, 0);
    const out = [...floored];
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

  const RARITY_FILES = ['N.png', 'R.png', 'SR.png', 'UR.png'];

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
        <title>Format Settings | Admin</title>
      </Head>

      <div className="flex items-center mb-8">
        <Link href={`/admin/formats/${slug}`} className="text-blue-600 hover:underline mr-4">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Format Settings</h1>
        <div className="ml-auto flex items-center gap-3">
          <input
            type="text"
            placeholder="Optional KDR ID (leave blank for all live KDRs)"
            value={snapshotKdrId}
            onChange={(e) => setSnapshotKdrId(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64"
          />
          <button
            type="button"
            onClick={async () => {
              setMessage(null)
              const target = snapshotKdrId ? `KDR ${snapshotKdrId}` : `all live KDRs for format ${slug}`
              const ok = window.confirm(`Refresh snapshots for ${target}? This will overwrite existing snapshots.`)
              if (!ok) return
              try {
                setSaving(true)
                if (snapshotKdrId) {
                  await axios.post('/api/admin/kdr/snapshot', { kdrId: snapshotKdrId })
                  setMessage({ type: 'success', text: `Snapshot refreshed for KDR ${snapshotKdrId}.` })
                } else {
                  await axios.post('/api/admin/kdr/snapshot', { formatSlug: slug })
                  setMessage({ type: 'success', text: 'Snapshots refreshed for live KDRs.' })
                }
              } catch (err) {
                console.error('Failed to refresh snapshots', err)
                setMessage({ type: 'error', text: 'Failed to refresh snapshots.' })
              } finally { setSaving(false) }
            }}
            className="ml-0 inline-flex items-center gap-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm"
            disabled={saving}
          >
            Refresh Snapshots
          </button>
        </div>
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
            {/* Training moved to Shop Configuration - see Shop Configuration section */}
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
                  className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all w-24 h-[76px]"
                >
                  <span className="text-2xl text-gray-400 dark:text-gray-500">+</span>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Add Unlock</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Round Rewards */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🎁</span> Round Rewards
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">XP Per Round</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Base XP earned by each player at the end of a round.</p>
              <input
                type="number"
                value={settings?.xpPerRound ?? 100}
                onChange={(e) => setSettings(prev => prev ? ({ ...prev, xpPerRound: parseInt(e.target.value || '0') }) : null)}
                className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gold Per Round</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Base Gold earned by each player at the end of a round.</p>
              <input
                type="number"
                value={settings?.goldPerRound ?? 50}
                onChange={(e) => setSettings(prev => prev ? ({ ...prev, goldPerRound: parseInt(e.target.value || '0') }) : null)}
                className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interest Requirement</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">For every X gold you end the shop with, award interest.</p>
              <input
                type="number"
                min="0"
                value={(settings && settings.interest && Number(settings.interest.requirement)) ?? Number((settings && settings.interestRequirement) || 0)}
                onChange={(e) => setSettings(prev => {
                  if (!prev) return prev
                  const v = Number(e.target.value || 0)
                  const nextInterest = { ...(prev.interest || {}), requirement: v }
                  return { ...prev, interest: nextInterest }
                })}
                className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interest Awarded</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Amount of gold awarded per requirement met.</p>
              <input
                type="number"
                min="0"
                value={(settings && settings.interest && Number(settings.interest.per)) ?? Number((settings && settings.interestPer) || 0)}
                onChange={(e) => setSettings(prev => {
                  if (!prev) return prev
                  const v = Number(e.target.value || 0)
                  const nextInterest = { ...(prev.interest || {}), per: v }
                  return { ...prev, interest: nextInterest }
                })}
                className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Shop Configuration */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🛒</span> Shop Configuration
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Class Loot Pools</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Tier</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Count</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Cost</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Min Lvl</div>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-sm font-bold">Starter</div>
                  <input type="number" value={settings?.classStarterCount ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classStarterCount: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.classStarterCost ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classStarterCost: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.classStarterMinLevel ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classStarterMinLevel: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-sm text-blue-400 font-bold">Mid</div>
                  <input type="number" value={settings?.classMidCount ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classMidCount: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.classMidCost ?? 100} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classMidCost: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.classMidMinLevel ?? 3} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classMidMinLevel: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-sm text-purple-500 font-bold">High</div>
                  <input type="number" value={settings?.classHighCount ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classHighCount: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.classHighCost ?? 200} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classHighCost: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.classHighMinLevel ?? 5} onChange={(e) => setSettings(prev => prev ? ({ ...prev, classHighMinLevel: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Generic Loot Pools</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Category</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Count</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Cost</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Min Lvl</div>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-sm font-bold">Staples</div>
                  <input type="number" value={settings?.genericStarterCount ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericStarterCount: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.genericStarterCost ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericStarterCost: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.genericStarterMinLevel ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericStarterMinLevel: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-sm text-blue-400 font-bold">Removal/Disruption</div>
                  <input type="number" value={settings?.genericMidCount ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericMidCount: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.genericMidCost ?? 100} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericMidCost: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.genericMidMinLevel ?? 3} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericMidMinLevel: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-sm text-purple-500 font-bold">Engine</div>
                  <input type="number" value={settings?.genericHighCount ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericHighCount: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.genericHighCost ?? 200} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericHighCost: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                  <input type="number" value={settings?.genericHighMinLevel ?? 5} onChange={(e) => setSettings(prev => prev ? ({ ...prev, genericHighMinLevel: parseInt(e.target.value || '0') }) : null)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Training</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Training Cost (Gold)</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Cost to purchase a training session.</p>
                <input
                  type="number"
                  value={settings?.trainingCost ?? 50}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, trainingCost: parseInt(e.target.value || '0') }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Training XP Gain</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">XP gained from a single training session.</p>
                <input
                  type="number"
                  value={settings?.trainingXp ?? 100}
                  onChange={(e) => setSettings(prev => prev ? ({ ...prev, trainingXp: parseInt(e.target.value || '0') }) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Treasure Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">💰</span> Treasure Rarity Weights
          </h2>

          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Configure relative weights for treasure rarities. Use "Normalize" to make them sum to 100%.</p>

            <div className="flex flex-wrap gap-4 items-start">
              {treasureWeights.map((w, i) => {
                const label = (RARITY_LABELS as any)?.[RARITIES[i]] ?? RARITIES[i] ?? `Rarity ${i}`;
                const imgSrc = `/images/rarity/${RARITY_FILES[i] ?? RARITY_FILES[0]}`;
                return (
                  <div key={i} className="w-44 p-4 rounded-lg border border-gray-700 bg-gray-900/20 flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-2">
                      <img src={imgSrc} alt={label} className="w-6 h-6" />
                      <div className="text-sm font-semibold text-gray-200 dark:text-white">{label}</div>
                    </div>

                    <input
                      type="number"
                      value={w}
                      onChange={(e) => updateTreasureWeight(i, parseInt(e.target.value) || 0)}
                      className="w-20 text-center font-mono font-bold px-2 py-1 border border-gray-600 rounded-md bg-gray-800 text-white"
                    />

                    <div className="text-xs text-gray-400 mt-2">{getTreasurePercent(i)}%</div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">Total weight: {totalTreasureWeight}</div>
              <button type="button" onClick={normalizeTreasureWeights} className="px-3 py-2 bg-yellow-500 text-white rounded-md">Normalize to 100</button>
              <div className="ml-auto">
                <label className="text-sm text-gray-600 mr-2">Treasures Offered</label>
                <input type="number" value={settings?.treasureOfferCount ?? 1} onChange={(e) => setSettings(prev => prev ? ({ ...prev, treasureOfferCount: parseInt(e.target.value || '0') }) : null)} className="w-16 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

      </form>

    </div>
  )
}
