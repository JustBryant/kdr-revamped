import { useEffect, useState, useCallback, useRef } from 'react'
import Pusher from 'pusher-js'
import { useSession } from 'next-auth/react'

export interface CollaborativeMessage {
  type?: string
  action?: string
  [key: string]: any
}

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || ''
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2'

let pusherInstance: Pusher | null = null

const sanitizeRoom = (r: string) => {
  if (!r) return r
  let s = r.replace(/:/g, '-')
  s = s.replace(/[^A-Za-z0-9_\-=@,.;]/g, '-')
  return s
}

const getPusher = () => {
  if (typeof window === 'undefined') return null
  if (pusherInstance) return pusherInstance
  if (!pusherKey) {
    console.error('PUSHER_KEY is missing! Check your .env file.')
    return null
  }
  
  // Enable Pusher logging for debugging
  (window as any).Pusher = Pusher;
  Pusher.logToConsole = true;

  pusherInstance = new Pusher(pusherKey, {
    cluster: pusherCluster,
    enabledTransports: ['ws', 'wss'],
    forceTLS: true
  })
  return pusherInstance
}

export default function useCollaborative(
  room: string = 'global',
  onMessage?: (msg: CollaborativeMessage) => void
) {
  const { data: session } = useSession()
  const [userIds, setUserIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const onMessageRef = useRef(onMessage)
  const lastSentRef = useRef<Map<string, number>>(new Map())
  const THROTTLE_MS = 200 // minimum ms between identical outgoing messages

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    const pusher = getPusher()
    if (!pusher || !room) return

    const safeRoom = sanitizeRoom(room)
    const channel = pusher.subscribe(safeRoom)

    // Handle generic 'update' events
    channel.bind('update', async (data: CollaborativeMessage) => {
      try {
        if (data && (data as any).truncated && (data as any).refId) {
          const r = await fetch(`/api/collab/message/${encodeURIComponent((data as any).refId)}`)
          if (r.ok) {
            const full = await r.json()
            if (onMessageRef.current) onMessageRef.current(full)
            return
          }
        }
      } catch (e) {
        console.error('Failed to fetch truncated collab message:', e)
      }
      if (onMessageRef.current) onMessageRef.current(data)
    })

    // Handle match update events (legacy)
    channel.bind('match-update', async (data: CollaborativeMessage) => {
      try {
        if (data && (data as any).truncated && (data as any).refId) {
          const r = await fetch(`/api/collab/message/${encodeURIComponent((data as any).refId)}`)
          if (r.ok) {
            const full = await r.json()
            if (onMessageRef.current) onMessageRef.current({ type: 'match-update', ...full })
            return
          }
        }
      } catch (e) {
        console.error('Failed to fetch truncated collab match message:', e)
      }
      if (onMessageRef.current) onMessageRef.current({ type: 'match-update', ...data })
    })

    // Handle presence/user update events
    channel.bind('presence', (data: { userIds: string[] }) => {
      if (data.userIds) setUserIds(data.userIds)
    })

    return () => {
      try { pusher.unsubscribe(safeRoom) } catch (e) {}
    }
  }, [room])

  const trigger = async (msg: CollaborativeMessage) => {
    try {
      // Explicit allowlist for essential message types/sections. Everything else
      // is treated as UI/noise and ignored at the hook level to avoid floods.
      const allowedTypes = new Set(['update', 'refresh'])
      const allowedSections = new Set(['presence', 'control', 'kdr', 'match'])

      const bypass = msg?.force === true || allowedTypes.has(msg?.type || '') || allowedSections.has(msg?.section || '')

      // Build a stable key for throttling similar messages
      const keyParts = [sanitizeRoom(room), msg?.section || msg?.type || 'default']
      if (msg && (msg as any).data && (msg as any).data.itemId) keyParts.push(String((msg as any).data.itemId))
      const key = keyParts.join(':')

      const now = Date.now()
      const last = lastSentRef.current.get(key) || 0

      // Drop non-essential UI messages (no bypass and not allowed)
      if (!bypass) return

      if (!bypass && now - last < THROTTLE_MS) {
        // skip high-frequency duplicate messages
        return
      }

      lastSentRef.current.set(key, now)

      await fetch('/api/collab/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: sanitizeRoom(room), ...msg })
      })
    } catch (e) {
      console.error('Failed to trigger collab message:', e)
    }
  }

  // Identify functionality (for global presence)
  useEffect(() => {
    const activeUserId = userId || session?.user?.email || (session?.user as any)?.id
    if (activeUserId && room) {
      fetch('/api/collab/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: sanitizeRoom(room), userId: activeUserId, action: 'join' })
      }).catch(() => {})
    }
  }, [session, room, userId])

  return { 
    trigger, 
    send: trigger, // Alias for backward compatibility
    userIds, 
    setUserId,
    connected: true, // Legacy compatibility
    clients: userIds.length, // Legacy compatibility
    // Backwards-compatible fields expected by some callers
    url: typeof window !== 'undefined' ? window.location.href : null,
    lastPayload: null
  }
}