import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'

export default function LeaderboardPage() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchBoard() }, [])

  const fetchBoard = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/leaderboard')
      setList(res.data)
    } catch (e) {
      console.error('Failed to load leaderboard', e)
    } finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-white/5">
          <div className="px-10 py-10 border-b dark:border-white/5 bg-gradient-to-r from-blue-600/5 to-purple-600/5">
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-gray-900 dark:text-white">Rankings</h1>
          </div>

          <div className="px-6 py-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse">Filtering Ranks...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {list.map((u, idx) => (
                  <Link
                    key={u.id}
                    href={`/user/${u.id}`}
                    className={`block group bg-white dark:bg-white/5 border ${idx === 0 ? 'border-yellow-400/50 bg-yellow-400/[0.02]' : idx === 1 ? 'border-slate-400/50 bg-slate-400/[0.02]' : idx === 2 ? 'border-orange-400/50 bg-orange-400/[0.02]' : 'border-gray-100 dark:border-white/5'} rounded-2xl p-4 transition-all hover:scale-[1.01] hover:shadow-lg`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex-none w-12 text-center">
                        {idx === 0 ? (
                          <span className="text-2xl">🥇</span>
                        ) : idx === 1 ? (
                          <span className="text-2xl">🥈</span>
                        ) : idx === 2 ? (
                          <span className="text-2xl">🥉</span>
                        ) : (
                          <span className="text-lg font-black italic text-gray-300 dark:text-gray-700">#{idx + 1}</span>
                        )}
                      </div>

                      <div className="relative">
                        <img 
                          src={u.image || '/images/default-avatar.png'} 
                          alt="avatar" 
                          className={`h-16 w-16 rounded-xl object-cover border-2 ${
                            idx === 0 ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 
                            idx === 1 ? 'border-slate-400 shadow-[0_0_15px_rgba(148,163,184,0.3)]' : 
                            idx === 2 ? 'border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 
                            'border-gray-100 dark:border-white/10'
                          }`} 
                        />
                        {idx < 3 && (
                          <div className="absolute -top-2 -right-2 bg-black text-white text-[8px] font-black uppercase px-2 py-1 rounded-full border border-white/20">
                            Elite
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div className="truncate">
                            <div className="text-xl font-black uppercase italic tracking-tight text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                              {u.name}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.wl} W/L</span>
                              {u.wins + u.losses > 0 && (
                                <>
                                  <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Efficiency {Math.round((u.wins / (u.wins + u.losses)) * 100)}%</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Rank Rating</div>
                            <div className="text-3xl font-black italic tracking-tighter text-gray-900 dark:text-white">
                              {u.elo}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-none opacity-0 group-hover:opacity-100 transition-opacity">
                         <svg className="w-6 h-6 text-blue-500 translate-x-[-10px] group-hover:translate-x-0 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                         </svg>
                      </div>
                    </div>
                  </Link>
                ))}

                {list.length === 0 && (
                  <div className="py-20 text-center">
                    <p className="text-gray-400 font-bold uppercase tracking-widest italic animate-pulse">Loading rankings...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
