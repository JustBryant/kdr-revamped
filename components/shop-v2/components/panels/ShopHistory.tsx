import React from 'react'
import ShopHistoryItem from './ShopHistoryItem'

type Props = {
  history?: any[]
  player?: any
}

const ShopHistory: React.FC<Props> = ({ history = [], player }) => {
  // sort by timestamp ascending and dedupe similar consecutive entries
  const sorted = Array.isArray(history) ? [...history].sort((a: any, b: any) => (Number(a.ts || 0) - Number(b.ts || 0))) : []
  const deduped: any[] = []
  for (const item of sorted) {
    const last = deduped.length ? deduped[deduped.length - 1] : null
    try {
      if (last) {
        if (last.type === item.type && last.text === item.text) continue
        if (last.text === item.text && Math.abs((Number(item.ts || 0) - Number(last.ts || 0))) < 5000) continue
      }
    } catch (e) {}
    deduped.push(item)
  }

  if (deduped.length === 0) return <div className="text-sm text-gray-400">No shop events yet.</div>

  return (
    <div className="space-y-3">
      {deduped.map((h: any, i: number) => (
        <ShopHistoryItem key={`${h.ts || 0}-${i}-${h.type}-${String(h.text).slice(0,40)}`} item={h} player={player} />
      ))}
    </div>
  )
}

export default ShopHistory
