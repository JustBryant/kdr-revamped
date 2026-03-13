// Lightweight helper to merge an incoming player snapshot into the existing
// player state without clobbering important fields like `shopState.purchases`.
export function mergePlayerWithIncoming(prev: any, incomingRaw: any) {
  const incoming = incomingRaw || {}
  if (!prev) return { ...(incoming || {}) }

  try {
    const merged: any = { ...(prev || {}), ...(incoming || {}) }
    merged.shopState = { ...(prev?.shopState || {}), ...(incoming?.shopState || {}) }

    // Preserve purchases when incoming doesn't include them
    const prevPurchases = Array.isArray(prev?.shopState?.purchases) ? prev.shopState.purchases : []
    const incPurchases = Array.isArray(incoming?.shopState?.purchases) ? incoming.shopState.purchases : []
    merged.shopState.purchases = (incPurchases && incPurchases.length) ? incPurchases : prevPurchases

    // Merge 'seen' deduped
    try {
      const prevSeen = Array.isArray(prev?.shopState?.seen) ? prev.shopState.seen : []
      const incSeen = Array.isArray(incoming?.shopState?.seen) ? incoming.shopState.seen : []
      const combined = [...prevSeen, ...incSeen]
      merged.shopState.seen = Array.from(new Set(combined))
    } catch (e) {}

    // Defensive: avoid regressing to START when client has progressed
    try {
      const prevStage = prev?.shopState?.stage
      const incStage = incoming?.shopState?.stage
      if (prevStage && prevStage !== 'START' && (!incStage || incStage === 'START')) {
        merged.shopState.stage = prevStage
      }
    } catch (e) {}

    return merged
  } catch (e) {
    return incoming
  }
}

export default mergePlayerWithIncoming
