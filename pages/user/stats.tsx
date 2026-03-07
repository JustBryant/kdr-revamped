import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

export default function PlayerStatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [openClassId, setOpenClassId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated') fetchStats()
  }, [status, router])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/user/stats')
      setStats(res.data)
    } catch (e) {
      console.error('Failed to load stats', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading stats...</div>
  if (!stats) return <div>No stats available.</div>

  const winrate = stats.gamesPlayed > 0 ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1) + '%' : '—'
  const sortedClassStats = (stats.classStats || []).filter((c: any) => ((c.wins || 0) + (c.losses || 0)) > 0).slice().sort((a: any, b: any) => {
    const aTotal = (a.wins || 0) + (a.losses || 0)
    const bTotal = (b.wins || 0) + (b.losses || 0)
    const aRatio = aTotal > 0 ? (a.wins || 0) / aTotal : -1
    const bRatio = bTotal > 0 ? (b.wins || 0) / bTotal : -1
    if (bRatio !== aRatio) return bRatio - aRatio
    // fallback: more picks first
    return (b.picks || 0) - (a.picks || 0)
  })

  return (
    <div className="max-w-screen-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Player Stats</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <div className="text-sm text-gray-500">Winrate</div>
          <div className="text-lg font-medium">{winrate}</div>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <div className="text-sm text-gray-500">Elo</div>
          <div className="text-lg font-medium">{stats.elo ?? '—'}</div>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <div className="text-sm text-gray-500">Most Victorious</div>
          <div className="text-lg font-medium">{stats.mostBeatenPlayer?.name ?? '—'}</div>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <div className="text-sm text-gray-500">Most Defeated</div>
          <div className="text-lg font-medium">{stats.mostLostToPlayer?.name ?? '—'}</div>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <div className="text-sm text-gray-500">Favourite Card</div>
          {stats.mostPickedCard?.image ? (
            <img src={stats.mostPickedCard.image} alt="Favourite card" className="mx-auto h-20 w-20 object-contain my-2" />
          ) : (
            <div className="text-lg font-medium">—</div>
          )}
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <div className="text-sm text-gray-500">"Favourite" Class</div>
          <div className="text-lg font-medium">{stats.mostPickedClass?.name ?? '—'}</div>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded col-span-1 sm:col-span-2">
          <div className="text-sm text-gray-500">Games played</div>
          <div className="text-lg font-medium">{stats.gamesPlayed ?? 0}</div>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded col-span-1 sm:col-span-2">
          <div className="text-sm text-gray-500">Game Losses Granted</div>
          <div className="text-lg font-medium">{stats.givenLosses ?? 0}</div>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded col-span-1 sm:col-span-2">
          <div className="text-sm text-gray-500">Favourite Skill</div>
          <div className="text-lg font-medium">{stats.mostPickedSkillId ?? '—'}</div>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded col-span-1 sm:col-span-2">
          <div className="text-sm text-gray-500">Most picked treasure</div>
          <div className="text-lg font-medium">{stats.mostPickedTreasureId ?? '—'}</div>
        </div>
        <div className="col-span-1 sm:col-span-2">
          <h2 className="text-lg font-semibold mt-4 mb-2">Class breakdown</h2>
          {stats.classStats && stats.classStats.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5 gap-8 justify-items-center">
              {sortedClassStats.map((cs: any) => (
                <div key={cs.classId} className="flex flex-col items-center justify-center gap-0 leading-none">
                  <button onClick={() => setOpenClassId(openClassId === cs.classId ? null : cs.classId)} className="focus:outline-none">
                    <img
                      src={cs.classImage || '/default-class.png'}
                      alt={cs.className ?? cs.classId}
                      className="h-64 w-64 object-contain block"
                    />
                  </button>
                  <div className="-mt-6 transform -translate-y-3 text-sm leading-none">
                    <span className="text-green-500 font-semibold">{cs.wins ?? 0}W</span>
                    <span className="mx-2 text-gray-400">-</span>
                    <span className="text-red-500 font-semibold">{cs.losses ?? 0}L</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No class stats yet.</div>
          )}
        </div>
        {openClassId && (
          (() => {
            const cs = stats.classStats.find((c: any) => c.classId === openClassId)
            if (!cs) return null
            return (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                  <div className="p-4 border-b dark:border-gray-700 flex items-start">
                    <div className="flex-1">
                      <div className="text-lg font-bold">{cs.className}</div>
                    </div>
                    <button onClick={() => setOpenClassId(null)} className="text-gray-600 dark:text-gray-300">✕</button>
                  </div>
                  <div className="p-6 text-center">
                    <img src={cs.classImage || '/default-class.png'} alt={cs.className} className="mx-auto h-40 w-40 object-contain mb-4" />
                    <div className="text-sm text-gray-600 dark:text-gray-300">Wins: {cs.wins} — Losses: {cs.losses}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Picks: {cs.picks}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">W/L Ratio: {cs.wins + cs.losses > 0 ? ((cs.wins / (cs.wins + cs.losses)) * 100).toFixed(1) + '%' : '—'}</div>
                    {cs.classFavouriteCard && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-500 dark:text-gray-300 mb-2 font-medium">Favourite Card</div>
                        <div className="flex items-center justify-center gap-3">
                          {cs.classFavouriteCard.image ? (
                            <img src={cs.classFavouriteCard.image} alt="Favourite card" className="h-12 w-12 object-contain rounded" />
                          ) : (
                            <div className="text-sm text-gray-500">—</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}
