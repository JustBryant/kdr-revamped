import React, { useRef, useState } from 'react'

export default function CollabTestPage() {
  const [url, setUrl] = useState<string>(process.env.NEXT_PUBLIC_COLLAB_URL || `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${process.env.NEXT_PUBLIC_COLLAB_PORT || 4000}`)
  const [logs, setLogs] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  const log = (line: string) => setLogs(l => [...l, `${new Date().toISOString()} ${line}`])

  const handleConnect = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      log('Already connected or connecting')
      return
    }
    try {
      const ws = new WebSocket(url)
      wsRef.current = ws
      log(`connecting -> ${url}`)
      ws.onopen = () => log('open')
      ws.onmessage = (m) => log('message: ' + m.data)
      ws.onerror = (e) => log('error: ' + String(e))
      ws.onclose = (c) => log('close: ' + c.reason)
    } catch (e) {
      log('exception: ' + String(e))
    }
  }

  const handleClose = () => {
    if (!wsRef.current) return log('no socket')
    try {
      wsRef.current.close()
      wsRef.current = null
      log('closed socket')
    } catch (e) { log('close exception: ' + String(e)) }
  }

  const handleSend = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return log('socket not open')
    const payload = { type: 'update', room: 'test-room', payload: { from: 'browser', text: 'hello' } }
    wsRef.current.send(JSON.stringify(payload))
    log('sent update payload')
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Collab Test</h1>
      <div className="mb-4">
        <label className="block text-sm mb-1">WebSocket URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full p-2 border rounded" />
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={handleConnect} className="px-3 py-2 bg-green-600 text-white rounded">Connect</button>
        <button onClick={handleClose} className="px-3 py-2 bg-yellow-600 text-white rounded">Close</button>
        <button onClick={handleSend} className="px-3 py-2 bg-blue-600 text-white rounded">Send Test Update</button>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-2">Logs</h2>
        <div style={{ whiteSpace: 'pre-wrap', maxHeight: '50vh', overflow: 'auto', background: '#0f172a', color: '#d1d5db', padding: 12, borderRadius: 6 }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  )
}
