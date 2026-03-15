import type { NextApiRequest, NextApiResponse } from 'next'
import { triggerPusher } from '../../../lib/pusher'
import { setMessage } from '../../../lib/collabMessageStore'

// In-memory coalescing buffer for debouncing frequent collab broadcasts.
// Keyed by `${room}:${sectionOrType}`. This is suitable for single-node
// deployments and reduces Pusher and DB churn by coalescing bursts.
type BufEntry = { timer?: NodeJS.Timeout | null; lastPayload?: any; created: number }
const BUFFERS = new Map<string, BufEntry>()

// Debounce windows (ms) by section/type. Zero or absent means immediate/bypass.
const DEBOUNCE_MS_BY_SECTION: Record<string, number> = {
  presence: 200,
  control: 200,
  kdr: 500,
  match: 0, // match-level events are important; send immediately
  default: 300
}

const LIMIT = 9000 // safe Pusher payload size limit

async function flushKey(key: string) {
  const entry = BUFFERS.get(key)
  if (!entry || !entry.lastPayload) return

  const { lastPayload } = entry
  // Clean up buffer first to allow new messages to be queued
  try { if (entry.timer) clearTimeout(entry.timer) } catch (e) {}
  BUFFERS.delete(key)

  const room = lastPayload.__room_for_broadcast || lastPayload.room
  const eventName = lastPayload.type || 'update'

  // Remove internal helper keys before sending
  const payload = { ...lastPayload }
  delete payload.__room_for_broadcast

  try {
    const str = JSON.stringify(payload || {})
    const bytes = Buffer.byteLength(str, 'utf8')
    if (bytes > LIMIT) {
      const refId = `msg-${Date.now()}-${Math.random().toString(36).slice(2,10)}`
      setMessage(refId, payload)
      const small = { type: eventName, truncated: true, refId, meta: { action: payload.action } }
      await triggerPusher(room, eventName, small)
      return
    }

    await triggerPusher(room, eventName, payload)
  } catch (err: any) {
    console.error('flushKey broadcast error:', err)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })

  const incoming = req.body || {}
  const { room, type, section, action, force, ...data } = incoming
  if (!room) return res.status(400).json({ message: 'Room/Channel is required' })

  // Normalize event name
  const eventName = type || 'update'

  // decide debounce window
  const keySection = section || type || 'default'
  const debounceMs = DEBOUNCE_MS_BY_SECTION.hasOwnProperty(keySection)
    ? DEBOUNCE_MS_BY_SECTION[keySection]
    : DEBOUNCE_MS_BY_SECTION.default

  // Bypass conditions: explicit force, or debounceMs == 0
  const bypass = force === true || debounceMs === 0

  // Build payload and stash internal helper room marker so flushKey can extract it
  const payload = { type: eventName, section: keySection, action, room, ...data, __room_for_broadcast: room }

  try {
    if (bypass) {
      // Send immediately (respect existing truncation behavior)
      const str = JSON.stringify(payload || {})
      const bytes = Buffer.byteLength(str, 'utf8')
      if (bytes > LIMIT) {
        const refId = `msg-${Date.now()}-${Math.random().toString(36).slice(2,10)}`
        setMessage(refId, payload)
        const small = { type: eventName, truncated: true, refId, meta: { action } }
        await triggerPusher(room, eventName, small)
        return res.status(200).json({ success: true, truncated: true, refId })
      }

      await triggerPusher(room, eventName, payload)
      return res.status(200).json({ success: true })
    }

    // Coalesce into buffer keyed by room+section
    const key = `${room}:${keySection}`
    const existing = BUFFERS.get(key)
    if (existing) {
      // replace lastPayload with the most recent one
      existing.lastPayload = payload
      // refresh timer
      if (existing.timer) clearTimeout(existing.timer)
      existing.timer = setTimeout(() => flushKey(key), debounceMs)
      BUFFERS.set(key, existing)
    } else {
      const timer = setTimeout(() => flushKey(key), debounceMs)
      BUFFERS.set(key, { timer, lastPayload: payload, created: Date.now() })
    }

    return res.status(200).json({ success: true, queued: true })
  } catch (err: any) {
    console.error('Broadcast error:', err)
    return res.status(500).json({ error: err?.message || String(err) })
  }
}
