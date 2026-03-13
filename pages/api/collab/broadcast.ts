import type { NextApiRequest, NextApiResponse } from 'next'
import { triggerPusher } from '../../../lib/pusher'
import { setMessage } from '../../../lib/collabMessageStore'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })

  const { room, type, action, ...data } = req.body
  if (!room) return res.status(400).json({ message: 'Room/Channel is required' })

  try {
    // Clients standard events: 'update', 'match-update', etc.
    const eventName = type || 'update'
    const payload = { type: eventName, action, ...data }

    const str = JSON.stringify(payload || {})
    const bytes = Buffer.byteLength(str, 'utf8')
    // Pusher HTTP API limit is 10,240 bytes — keep a safety margin
    const LIMIT = 9000
    if (bytes > LIMIT) {
      // Store the full payload and send a lightweight ref to clients.
      const refId = `msg-${Date.now()}-${Math.random().toString(36).slice(2,10)}`
      setMessage(refId, payload)
      const small = { type: eventName, truncated: true, refId, meta: { action } }
      await triggerPusher(room, eventName, small)
      return res.status(200).json({ success: true, truncated: true, refId })
    }

    await triggerPusher(room, eventName, payload)
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Broadcast error:', err)
    return res.status(500).json({ error: err?.message || String(err) })
  }
}
