import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import AnimatedModal from '../common/AnimatedModal'
import SettingsEditor from './SettingsEditor'
import { useRouter } from 'next/router'

type Props = {
  open: boolean
  onClose: () => void
}

export default function CreateKdrModal({ open, onClose }: Props) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isAdmin = !!(status === 'authenticated' && session && (session as any).user && (session as any).user.role === 'ADMIN')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [formatSlug, setFormatSlug] = useState<string | null>(null)
  const [playerCount, setPlayerCount] = useState<number | ''>(8)
  const [ranked, setRanked] = useState(false)
  const [formats, setFormats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<any | null>(null)
  const [formatClasses, setFormatClasses] = useState<any[]>([])
  const [formatSkills, setFormatSkills] = useState<any[]>([])
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const r = await fetch('/api/formats')
        if (!mounted) return
        if (!r.ok) return
        const j = await r.json()
        if (Array.isArray(j)) {
          setFormats(j)
          if (!formatSlug && j.length > 0) setFormatSlug(j[0].slug)
        }
      } catch (e) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!formatSlug) return
    let mounted = true
    ;(async () => {
      try {
        const r = await fetch(`/api/formats/${encodeURIComponent(formatSlug)}`)
        if (!mounted) return
        if (!r.ok) return
        const j = await r.json()
        setSettings(j?.format?.settings || null)
        setFormatClasses(j?.format?.formatClasses || [])
        
        const gSkills = j?.genericSkills || []
        const allSkills: any[] = []
        const skillIds = new Set()
        gSkills.forEach((sk: any) => {
          if (sk && !skillIds.has(sk.id)) {
            skillIds.add(sk.id)
            allSkills.push(sk)
          }
        })
        setFormatSkills(allSkills)
      } catch (e) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [formatSlug])

  const submit = async () => {
    setError(null)
    if (!name || name.trim().length === 0) return setError('Name is required')
    setLoading(true)
    try {
    const payload: any = { name: name.trim() }
      if (password) payload.password = password
      if (formatSlug) payload.formatSlug = formatSlug
      if (playerCount && typeof playerCount === 'number') payload.playerCount = playerCount
      if (ranked && isAdmin) payload.ranked = true
    if (settings) payload.settingsSnapshot = settings

      const res = await fetch('/api/kdr/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Server returned ${res.status}`)
      }
      const created = await res.json()
      onClose()
      // navigate to new KDR page
      if (created && created.id) router.push(`/kdr/${created.id}`)
  } catch (e: any) {
      console.error('Create KDR error', e)
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatedModal open={open} onClose={onClose} overlayClassName="bg-black/40 dark:bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-white/10 rounded-2xl p-8 max-w-xl w-full mx-auto shadow-2xl dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/5 dark:bg-blue-600/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-600/5 dark:bg-indigo-600/10 blur-[80px] pointer-events-none" />

        <div className="relative flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Create KDR</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Configure your tournament</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="relative space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 ml-1">Tournament Name</label>
              <input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Enter a name..."
                className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 ml-1">Format</label>
                <div className="relative">
                  <select 
                    value={formatSlug || ''} 
                    onChange={(e) => setFormatSlug(e.target.value || null)} 
                    className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  >
                    {formats.map(f => <option key={f.slug} value={f.slug} className="bg-white dark:bg-gray-900">{f.name}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 ml-1">Player Count</label>
                <input 
                  type="number" 
                  value={playerCount as any} 
                  min={2} 
                  onChange={(e) => setPlayerCount(e.target.value === '' ? '' : Number(e.target.value))} 
                  className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 ml-1">Join Password (Optional)</label>
              <input 
                type="text" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Leave empty for public access" 
                className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" 
              />
            </div>
          </div>

          {isAdmin && (
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={ranked} 
                    onChange={(e) => setRanked(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-widest">Ranked KDR Tournament</span>
              </label>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <div className="pt-2">
            <button 
              disabled={!formatSlug || loadingSettings} 
              onClick={() => setShowSettings(true)} 
              className="w-full group px-4 py-3 bg-black/[0.02] dark:bg-white/5 hover:bg-black/[0.05] dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-white/10 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-500 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              <span className="text-xs font-black uppercase tracking-[0.2em]">Adjust Tournament Settings</span>
            </button>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
            <button 
              onClick={onClose} 
              className="flex-1 px-4 py-4 bg-black/[0.02] dark:bg-white/5 hover:bg-black/[0.05] dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl border border-gray-200 dark:border-white/5 transition-all"
            >
              Cancel
            </button>
            <button 
              disabled={loading} 
              onClick={submit} 
              className="flex-[2] px-4 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-blue-900/10 dark:shadow-blue-900/20 disabled:opacity-50 transition-all transform active:scale-[0.98]"
            >
              {loading ? 'Creating...' : 'Create & Start'}
            </button>
          </div>
        </div>

        {showSettings && (
          <AnimatedModal open={showSettings} onClose={() => setShowSettings(false)} overlayClassName="bg-black/90 backdrop-blur-md z-[11000]">
            <div className="relative bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-white/10 rounded-2xl p-8 w-[95vw] max-w-[1400px] mx-auto max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Tournament Settings</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Fine-tune the experience</p>
                </div>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="px-6 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Close & Apply
                </button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar pr-2">
                {loadingSettings && <div className="text-center py-20 text-gray-500 font-bold uppercase tracking-widest animate-pulse">Loading settings...</div>}
                {!loadingSettings && (
                  <SettingsEditor 
                    settings={settings} 
                    onChange={setSettings} 
                    saving={savingSettings} 
                    classes={formatClasses.map(fc => fc.class)}
                    skills={formatSkills}
                    onSave={async (s: any) => {
                      setSettings(s)
                      setShowSettings(false)
                    }} 
                  />
                )}
              </div>
            </div>
          </AnimatedModal>
        )}
      </div>
    </AnimatedModal>
  )
}
