export type ShopStage = 'TRAINING' | 'TREASURE' | 'LOOT' | 'TIP' | 'DONE'

export function computeLevel(xp: number, xpCurve: number[] | undefined) {
  if (!Array.isArray(xpCurve) || xpCurve.length === 0) return 0
  let level = 0
  for (let i = 0; i < xpCurve.length; i++) {
    if (xp >= xpCurve[i]) level = i
    else break
  }
  return level
}

export function sampleArray<T>(arr: T[], count: number) {
  const copy = [...arr]
  const out: T[] = []
  while (out.length < count && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

export function weightedPickIndex(weights: number[]) {
  const total = weights.reduce((s, w) => s + (w > 0 ? w : 0), 0)
  if (total <= 0) return -1
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0
    if (r < w) return i
    r -= w
  }
  return weights.length - 1
}

export function weightedSampleArray<T>(items: T[], weightFn: (t: T) => number, count: number) {
  const copy = [...items]
  const out: T[] = []
  while (out.length < count && copy.length > 0) {
    const weights = copy.map(weightFn)
    const idx = weightedPickIndex(weights)
    if (idx < 0 || idx >= copy.length) break
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}
