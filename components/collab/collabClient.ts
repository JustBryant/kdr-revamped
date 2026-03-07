type Message = { type: string; room?: string; payload?: any; clients?: number; sender?: string; ts?: number }

type Handlers = {
  onUpdate?: (msg: Message) => void
  onPresence?: (count: number) => void
}

class CollabClient {
  url: string
  ws: WebSocket | null = null
  subs: Map<string, Set<Handlers>> = new Map() // room -> handlers
  clientId: string
  reconnectAttempts = 0
  reconnectTimer: number | null = null
  lastAttemptTs: number | null = null
  pendingSends: any[] = []

  constructor(url: string) {
    this.url = url
    this.clientId = Math.random().toString(36).slice(2, 10)
    this.connect()
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    try {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.lastAttemptTs = Date.now()
        // rejoin rooms
        for (const room of this.subs.keys()) {
          this.safeSend({ type: 'join', room })
        }
        // flush pending sends
        for (const p of this.pendingSends) this.safeSend(p)
        this.pendingSends = []
      }
      this.ws.onmessage = (evt) => {
        try {
          const msg: Message = JSON.parse(evt.data)
          if (!msg.room) return
          // ignore messages we originally sent (best-effort)
          if ((msg as any).sender && (msg as any).sender === this.clientId) return
          console.debug('[collab] recv', this.url, msg.type, msg.room, msg)
          const handlers = this.subs.get(msg.room)
          if (!handlers) return
          for (const h of handlers) {
            if (msg.type === 'update' && h.onUpdate) h.onUpdate(msg)
            if (msg.type === 'presence' && h.onPresence) h.onPresence(msg.clients || 0)
          }
        } catch (e) {
          console.warn('collab: invalid message', e)
        }
      }
      this.ws.onclose = () => {
        this.ws = null
        this.scheduleReconnect()
      }
      this.ws.onerror = () => {
        // will trigger onclose eventually
      }
    } catch (e) {
      this.scheduleReconnect()
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer != null) return
    this.reconnectAttempts += 1
    const attempt = this.reconnectAttempts
    const delay = Math.min(30000, 500 * Math.pow(1.6, Math.min(attempt, 12)))
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  safeSend(obj: any) {
    // attach sender id for debugging / de-duplication
    try {
      obj = Object.assign({}, obj, { sender: this.clientId })
    } catch (e) { }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingSends.push(obj)
      console.debug('[collab] queued send', this.url, obj.type, obj.room)
      return
    }
    try { this.ws.send(JSON.stringify(obj)); console.debug('[collab] send', this.url, obj.type, obj.room) } catch (e) { this.pendingSends.push(obj) }
  }

  subscribe(room: string, handlers: Handlers) {
    let set = this.subs.get(room)
    if (!set) {
      set = new Set()
      this.subs.set(room, set)
    }
    set.add(handlers)
    // ensure connection
    this.connect()
    // tell server we joined if already open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.safeSend({ type: 'join', room })

    return () => {
      const s = this.subs.get(room)
      if (!s) return
      s.delete(handlers)
      if (s.size === 0) {
        this.subs.delete(room)
        this.safeSend({ type: 'leave', room })
      }
    }
  }

  broadcast(room: string, payload: any) {
    this.safeSend({ type: 'update', room, payload })
  }
}

const clients = new Map<string, CollabClient>()

export function getCollabClient(url: string) {
  let c = clients.get(url)
  if (!c) {
    c = new CollabClient(url)
    clients.set(url, c)
  }
  return c
}

export default getCollabClient
