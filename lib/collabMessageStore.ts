// Simple in-memory store for oversized collab messages.
// NOTE: This is transient (process memory). For production across multiple
// instances use Redis or another shared store.

type Stored = { data: any; expires: number }
const STORE = new Map<string, Stored>()
const TTL_MS = 1000 * 60 * 5 // 5 minutes

export function setMessage(id: string, data: any) {
  STORE.set(id, { data, expires: Date.now() + TTL_MS })
}

export function getMessage(id: string) {
  const v = STORE.get(id)
  if (!v) return null
  if (v.expires < Date.now()) {
    STORE.delete(id)
    return null
  }
  return v.data
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of Array.from(STORE.entries())) {
    if (v.expires < now) STORE.delete(k)
  }
}, 60 * 1000).unref()

export function listKeys() {
  return Array.from(STORE.keys())
}
