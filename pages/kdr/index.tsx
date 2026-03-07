import { GetServerSideProps } from 'next'
import Link from 'next/link'
import { prisma } from '../../lib/prisma'
import type { Tournament } from '@prisma/client'
import React, { useEffect, useState } from 'react'
import CreateKdrModal from '../../components/kdr/CreateKdrModal'
import MyKdrsModal from '../../components/kdr/MyKdrsModal'

type Props = {
  openTournaments: any[]
  ongoingTournaments: any[]
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString()
  } catch (e) {
    return d
  }
}

export default function Lobby({ openTournaments, ongoingTournaments }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [myKdrsOpen, setMyKdrsOpen] = useState(false)
  
  // RecentMatches component (client-side live-updating)
  function RecentMatches() {
    const [matches, setMatches] = useState<any[]>([])

    useEffect(() => {
      let mounted = true
      async function fetchRecent() {
        try {
          const r = await fetch('/api/kdr/matches/recent')
          const j = await r.json()
          if (mounted && j?.matches) setMatches(j.matches)
        } catch (e) {
          // ignore
        }
      }

      fetchRecent()
      const iv = setInterval(fetchRecent, 3000)
      return () => { mounted = false; clearInterval(iv) }
    }, [])

    return (
      <section className="bg-white/5 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-black/5 dark:border-white/10 shadow-xl dark:shadow-2xl p-8 mb-6 overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-50"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter italic">Recent Matches</h2>
            <span className="animate-pulse w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
          </div>
          <ul className="space-y-3 max-h-64 overflow-auto pr-2 custom-scrollbar">
            {matches.length === 0 && (
              <li className="py-8 text-center bg-black/5 dark:bg-white/5 rounded-xl border border-dashed border-black/10 dark:border-white/10">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">No Recent Matches</p>
              </li>
            )}
            {matches.map(m => (
              <li key={m.id} className="group/item bg-black/[0.02] dark:bg-white/5 hover:bg-black/[0.05] dark:hover:bg-white/10 border border-black/5 dark:border-white/5 rounded-xl p-4 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="truncate">
                    <div className="font-black text-gray-800 dark:text-gray-100 truncate text-sm uppercase tracking-tight group-hover/item:text-blue-500 dark:group-hover/item:text-blue-400 transition-colors">
                      {m.playerAName || '???'} <span className="text-gray-400 dark:text-gray-600 italic px-1">VS</span> {m.playerBName || '???'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black uppercase bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded tracking-widest leading-none">
                        {m.scoreA} - {m.scoreB}
                      </span>
                      <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest">
                        {m.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-tighter ml-4 whitespace-nowrap">
                    {new Date(m.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f19] text-gray-900 dark:text-gray-100 flex flex-col md:flex-row">
      <main className="flex-1 p-8 md:p-12 lg:p-16 relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 dark:bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-[100px] animate-pulse delay-700"></div>
        </div>

        <div className="relative z-10 max-w-4xl">
          <header className="mb-12">
            <h1 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic leading-none mb-2">
              Lobby
            </h1>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            <button 
              onClick={() => setModalOpen(true)} 
              className="group relative bg-blue-600 hover:bg-blue-500 text-white p-8 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(37,99,235,0.3)] overflow-hidden"
            >
              <div className="relative z-10 flex flex-col items-start text-left">
                <span className="text-3xl font-black uppercase tracking-tighter mb-1 italic">Create KDR</span>
                <span className="text-xs font-bold text-blue-100 dark:text-blue-200 uppercase tracking-widest opacity-80">Start your own game</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-[-10px] bottom-[-10px] h-32 w-32 text-white/10 group-hover:text-white/20 transition-all group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>

            <button 
              onClick={() => setMyKdrsOpen(true)}
              className="group relative bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white p-8 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl dark:hover:shadow-2xl overflow-hidden"
            >
              <div className="relative z-10 flex flex-col items-start text-left">
                <span className="text-3xl font-black uppercase tracking-tighter mb-1 italic">My Games</span>
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest opacity-80">View Joined KDR's</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-[-10px] bottom-[-10px] h-32 w-32 text-black/5 dark:text-white/5 group-hover:text-black/10 dark:group-hover:text-white/10 transition-all group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>
          </div>

          <div className="w-full">
            <RecentMatches />
          </div>
        </div>

        <CreateKdrModal open={modalOpen} onClose={() => setModalOpen(false)} />
        <MyKdrsModal open={myKdrsOpen} onClose={() => setMyKdrsOpen(false)} />
      </main>

      <aside className="w-full md:w-[450px] bg-white dark:bg-black/40 backdrop-blur-3xl border-l border-gray-200 dark:border-white/5 p-8 lg:p-12 overflow-y-auto h-screen sticky top-0">
        <div className="space-y-12">
          <section>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Open Tournaments</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-blue-500/50 to-transparent"></div>
            </div>
            <ul className="grid gap-4">
              {openTournaments.length === 0 && (
                <li className="py-12 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center">
                  <p className="text-xs font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest">No open tournaments</p>
                </li>
              )}
              {openTournaments.map(t => (
                <li key={t.id}>
                  <Link href={`/kdr/${t.slug || t.id}`} className="group block bg-gray-50 dark:bg-white/5 hover:bg-blue-600/10 dark:hover:bg-blue-600/20 border border-gray-200 dark:border-white/10 p-6 rounded-2xl transition-all duration-300 hover:translate-x-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase italic truncate max-w-[200px]">
                          {t.name}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-[10px] font-black uppercase bg-gray-200 dark:bg-gray-900 text-gray-600 dark:text-gray-400 px-2 py-1 rounded tracking-widest">
                            {t.format?.name || 'KDR'}
                          </span>
                          {t.isRanked && (
                            <span className="text-[10px] font-black uppercase bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 px-2 py-1 rounded tracking-widest border border-amber-500/10 dark:border-amber-500/20">
                              RANKED
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white leading-none">
                          {t._count?.players ?? 0}<span className="text-gray-400 dark:text-gray-600">/{t.playerCount || '∞'}</span>
                        </div>
                        <div className="text-[10px] uppercase text-gray-400 dark:text-gray-500 font-black tracking-widest mt-1">Summoned</div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Started Tournaments</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/50 to-transparent"></div>
            </div>
            <ul className="grid gap-4">
              {ongoingTournaments.length === 0 && (
                <li className="py-12 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center">
                  <p className="text-xs font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest">No ongoing tournaments</p>
                </li>
              )}
              {ongoingTournaments.map(t => (
                <li key={t.id}>
                  <Link href={`/kdr/${t.slug || t.id}`} className="group block bg-gray-50 dark:bg-white/5 hover:bg-emerald-600/10 dark:hover:bg-emerald-600/20 border border-gray-200 dark:border-white/10 p-6 rounded-2xl transition-all duration-300 hover:translate-x-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors uppercase italic truncate max-w-[200px]">
                          {t.name}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-[10px] font-black uppercase bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 px-2 py-1 rounded tracking-widest border border-emerald-500/10 dark:border-emerald-500/20">
                            ROUND {t.currentRound}
                          </span>
                          <span className="text-[10px] font-black uppercase bg-gray-200 dark:bg-gray-900 text-gray-600 dark:text-gray-400 px-2 py-1 rounded tracking-widest">
                            {t.format?.name || 'KDR'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white leading-none">
                          {t._count?.players ?? 0}<span className="text-gray-400 dark:text-gray-600">/{t.playerCount || '∞'}</span>
                        </div>
                        <div className="text-[10px] uppercase text-gray-400 dark:text-gray-500 font-black tracking-widest mt-1">Soul-Count</div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const openTournaments = await prisma.kDR.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    include: { 
      _count: { select: { players: true } },
      format: { select: { name: true } }
    },
  })

  const ongoingTournaments = await prisma.kDR.findMany({
    where: {
      status: 'STARTED',
    },
    orderBy: { createdAt: 'desc' },
    include: { 
      _count: { select: { players: true } },
      format: { select: { name: true } }
    },
  })

  // Serialize dates
  const ser = (t: any) => ({ 
    ...t, 
    createdAt: t.createdAt?.toISOString(),
    updatedAt: t.updatedAt?.toISOString()
  })

  return { props: { openTournaments: JSON.parse(JSON.stringify(openTournaments.map(ser))), ongoingTournaments: JSON.parse(JSON.stringify(ongoingTournaments.map(ser))) } }
}
