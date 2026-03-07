import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import AnimatedModal from '../common/AnimatedModal'

type Props = {
  open: boolean
  onClose: () => void
}

interface MyKdr {
  id: string
  name: string
  slug: string | null
  status: string
  createdAt: string
  playerCount: number | null
}

interface JoinedKdr {
  kdrId: string
  name: string | null
  slug: string | null
  kdrStatus: string | null
  playerKey: string | null
  playerStatus: string
}

export default function MyKdrsModal({ open, onClose }: Props) {
  const [hosting, setHosting] = useState<MyKdr[]>([])
  const [joined, setJoined] = useState<JoinedKdr[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let mounted = true
    setLoading(true)

    async function fetchData() {
      try {
        const [resMy, resJoined] = await Promise.all([
          fetch('/api/kdr/my'),
          fetch('/api/kdr/joined')
        ])
        if (!mounted) return
        const [myJson, joinedJson] = await Promise.all([
          resMy.json(),
          resJoined.json()
        ])
        if (Array.isArray(myJson)) setHosting(myJson)
        if (Array.isArray(joinedJson)) setJoined(joinedJson)
      } catch (err) {
        console.error('Failed to load my KDRs', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    return () => { mounted = false }
  }, [open])

  return (
    <AnimatedModal open={open} onClose={onClose} overlayClassName="bg-black/40 dark:bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-white/10 rounded-2xl p-8 max-w-4xl w-full text-gray-900 dark:text-white shadow-2xl dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] mx-auto overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/5 dark:bg-blue-600/10 blur-[80px] pointer-events-none" />
        
        <div className="relative flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">My Games</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Tournament overview</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative space-y-8 max-h-[70vh] overflow-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-20 text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest animate-pulse">Loading tournaments...</div>
          ) : (
            <>
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-500">Hosting</h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent"></div>
                </div>
                {hosting.length === 0 ? (
                  <div className="py-10 bg-black/[0.02] dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">No active hostings</p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hosting.map(h => (
                      <li key={h.id} className="group bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl p-5 flex items-center justify-between hover:border-blue-500/30 transition-all">
                        <div className="truncate">
                          <Link 
                            href={`/kdr/${h.slug || h.id}`} 
                            className="font-black text-lg text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase italic block truncate max-w-[180px]"
                            onClick={onClose}
                          >
                            {h.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded tracking-widest leading-none">
                              {h.status}
                            </span>
                          </div>
                        </div>
                        <Link 
                          href={`/kdr/${h.slug || h.id}`}
                          className="text-[10px] font-black uppercase bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all tracking-widest border border-gray-200 dark:border-white/5"
                          onClick={onClose}
                        >
                          Manage
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <div className="flex items-center gap-4 mb-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500">Joined</h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent"></div>
                </div>
                {joined.length === 0 ? (
                  <div className="py-10 bg-black/[0.02] dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">No joined games</p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {joined.map(j => (
                      <li key={j.kdrId} className="group bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl p-5 flex items-center justify-between hover:border-emerald-500/30 transition-all">
                        <div className="truncate">
                          <Link 
                            href={`/kdr/${j.slug || j.kdrId}`} 
                            className="font-black text-lg text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors uppercase italic block truncate max-w-[180px]"
                            onClick={onClose}
                          >
                            {j.name || 'Unknown Tournament'}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 px-2 py-0.5 rounded tracking-widest leading-none">
                              {j.kdrStatus || 'Unknown'}
                            </span>
                            <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest">
                              {j.playerStatus}
                            </span>
                          </div>
                        </div>
                        <Link 
                          href={j.playerKey ? `/kdr/${j.slug || j.kdrId}/player/${j.playerKey}` : `/kdr/${j.slug || j.kdrId}`}
                          className="text-[10px] font-black uppercase bg-emerald-600 dark:bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition-all tracking-widest shadow-lg shadow-emerald-900/10 dark:shadow-emerald-900/20"
                          onClick={onClose}
                        >
                          {j.playerKey ? 'Play' : 'View'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </AnimatedModal>
  )
}
