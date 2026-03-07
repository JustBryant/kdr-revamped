export const toInt = (v: any) => {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isNaN(n) ? null : n
}

export const normalizeCard = (c: any) => {
  if (!c) return c
  const out: any = { ...c }
  out.atk = toInt(out.atk ?? out.atkValue ?? out.attack ?? out.atkValue)
  out.def = toInt(out.def ?? out.defValue ?? out.defence ?? out.defense)
  out.level = toInt(out.level ?? out.rank ?? out.lv)
  out.linkRating = toInt(out.linkRating ?? out.link ?? out.linkval)
  out.linkArrows = (out.linkArrows || out.arrows || out.link || '').toString()
  out.attribute = out.attribute || out.attr || out.element || ''

  const rawType = (out.type || out.cardType || out.typeName || out.categories || '').toString()
  const rawRace = (out.race || out.raceName || out.race_name || '').toString()
  out.type = rawType
  out.cardType = rawType
  out.race = rawRace

  out.abilities = [out.abilities, out.categories, out.desc, out.description].filter(Boolean).join(' ')
  out.pendulum = out.pendulum ?? out.pendulumScale ?? out.scale ?? null
  return out
}

// Merge enriched results into previous results preserving order and only replacing when meaningful
export const mergeEnrichedResults = (prev: any[], enriched: any[]) => {
  if (!prev || !Array.isArray(prev)) return prev
  if (!enriched || !Array.isArray(enriched) || enriched.length === 0) return prev
  const byId = new Map(prev.map(p => [p.id, p]))
  let changed = false
  enriched.forEach((en: any) => {
    if (!en) return
    const existing = byId.get(en.id) || Array.from(byId.values()).find(v => (v.konamiId && en.konamiId && Number(v.konamiId) === Number(en.konamiId)))
    if (existing) {
      const merged = { ...existing, ...en }
      if (merged.attribute !== existing.attribute || merged.race !== existing.race || merged.type !== existing.type) {
        byId.set(merged.id, merged)
        changed = true
      }
    }
  })
  return changed ? Array.from(byId.values()) : prev
}
