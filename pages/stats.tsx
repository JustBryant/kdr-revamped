import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function StatsSearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [openClassId, setOpenClassId] = useState<string | null>(null)

  useEffect(() => {
    if (query.length < 2) return setResults([])
    const t = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const doSearch = async (q: string) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/stats/search?q=${encodeURIComponent(q)}`)
      setResults(res.data)
    } catch (e) {
      console.error('Search error', e)
      setResults([])
    } finally { setLoading(false) }
  }

  const openUser = async (id: string) => {
    setSelected(null)
    try {
      const res = await axios.get(`/api/stats/${id}`)
      setSelected(res.data)
    } catch (e) {
      console.error('Failed to load user stats', e)
    }
  }

  const sortedSelectedClassStats = selected ? (selected.classStats || []).filter((c: any) => ((c.wins || 0) + (c.losses || 0)) > 0).slice().sort((a: any, b: any) => {
    const aTotal = (a.wins || 0) + (a.losses || 0)
    const bTotal = (b.wins || 0) + (b.losses || 0)
    const aRatio = aTotal > 0 ? (a.wins || 0) / aTotal : -1
    const bRatio = bTotal > 0 ? (b.wins || 0) / bTotal : -1
    if (bRatio !== aRatio) return bRatio - aRatio
    return (b.picks || 0) - (a.picks || 0)
  }) : []

  return (
    <div className="max-w-screen-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Player Stats Lookup</h1>

      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players by name..."
          className="w-full p-2 border rounded"
        />
        {loading && <div className="text-sm text-gray-500 mt-2">Searching...</div>}
        {results.length > 0 && (
          <div className="mt-2 border rounded max-h-64 overflow-auto">
            {results.map((r) => (
              <div key={r.id} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center" onClick={() => openUser(r.id)}>
                <img src={r.image || '/default-avatar.png'} className="h-8 w-8 rounded-full mr-3" />
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-gray-500">Elo: {r.elo} — W/L: {r.wins}/{r.losses}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

  

      {selected && (
        <div className="bg-white dark:bg-gray-800 border rounded p-4">
          <div className="flex items-center gap-4 mb-4">
            <img src={selected.user.image || '/default-avatar.png'} className="h-16 w-16 rounded-full" />
            <div>
              <div className="text-xl font-semibold">{selected.user.name}</div>
              <div className="text-sm text-gray-500">Elo: {selected.stats.elo} — W/L: {selected.stats.wins}/{selected.stats.losses}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Most Victorious</div>
              <div className="font-medium">{selected.stats.mostBeatenPlayer?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Most Defeated</div>
              <div className="font-medium">{selected.stats.mostLostToPlayer?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Favourite Card</div>
                  {selected.stats.mostPickedCard?.image ? (
                    <img src={selected.stats.mostPickedCard.image} alt="Favourite card" className="mx-auto h-20 w-20 object-contain my-2" />
                  ) : (
                    <div className="font-medium">—</div>
                  )}
            </div>
            <div>
              <div className="text-sm text-gray-500">"Favourite" Class</div>
              <div className="font-medium">{selected.stats.mostPickedClass?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Favourite Skill</div>
              <div className="font-medium">{selected.stats.mostPickedSkill?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Game Losses Granted</div>
              <div className="font-medium">{selected.stats.givenLosses ?? 0}</div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-2">Class breakdown</h3>
                {selected.classStats && selected.classStats.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5 gap-8 justify-items-center">
                {sortedSelectedClassStats.map((cs: any) => (
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
                const cs = selected.classStats.find((c: any) => c.classId === openClassId)
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
      )}
    </div>
  )
}
