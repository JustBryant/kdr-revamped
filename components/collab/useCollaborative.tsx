import { useEffect, useRef, useState, useCallback } from 'react'
import getCollabClient from './collabClient'

function buildUrl() {
  const envUrl = (process.env.NEXT_PUBLIC_COLLAB_URL && process.env.NEXT_PUBLIC_COLLAB_URL.length) ? process.env.NEXT_PUBLIC_COLLAB_URL : null
  const port = process.env.NEXT_PUBLIC_COLLAB_PORT || '4000'
  return envUrl || (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:${port}` : `ws://localhost:${port}`)
}

export default function useCollaborative(room: string | null, onRemote: (msg: any) => void) {
  const onRemoteRef = useRef(onRemote)
  useEffect(() => { onRemoteRef.current = onRemote }, [onRemote])

  const [clients, setClients] = useState<number>(0)
  const [connected, setConnected] = useState(false)
  const [lastPayload, setLastPayload] = useState<any>(null)
  const url = buildUrl()
  const clientRef = useRef<any>(null)

  useEffect(() => {
    if (!room) return
    const client = getCollabClient(url)
    clientRef.current = client
    const handlers = {
      onUpdate: (msg: any) => { console.debug('[collab hook] onUpdate', room, msg); setLastPayload(msg); onRemoteRef.current && onRemoteRef.current(msg) },
      onPresence: (c: number) => { console.debug('[collab hook] presence', room, c); setClients(c) },
    }
    const unsubscribe = client.subscribe(room, handlers)
    // best-effort connected state from the underlying ws; watch for changes
    setConnected(Boolean((client as any).ws && (client as any).ws.readyState === WebSocket.OPEN))
    const watcher = window.setInterval(() => {
      setConnected(Boolean((client as any).ws && (client as any).ws.readyState === WebSocket.OPEN))
    }, 1000)
    return () => { clearInterval(watcher); unsubscribe() }
  }, [room, url])

  const send = useCallback((payload: any) => {
    if (!room) return
    const client = clientRef.current || getCollabClient(url)
    client.broadcast(room, payload)
  }, [room, url])

  return { send, clients, connected, url, lastPayload }
}
