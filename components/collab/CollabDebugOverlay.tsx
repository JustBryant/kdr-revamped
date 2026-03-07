import React from 'react'
import useCollaborative from './useCollaborative'

export default function CollabDebugOverlay() {
  // connect to a debug room so the overlay shows connection attempts on every page
  const { connected, clients, url, lastPayload } = useCollaborative('debug:overlay', () => {})

  return (
    <div className="fixed right-4 bottom-4 z-50 text-xs font-mono">
      <div className={`p-2 rounded shadow-lg ${connected ? 'bg-emerald-900/90 text-white' : 'bg-red-900/90 text-white'}`}>
        <div className="flex items-center space-x-2">
          <div className="font-bold">Collab</div>
          <div>{connected ? 'Connected' : 'Disconnected'}</div>
          <div className="text-gray-200 ml-2">({clients})</div>
        </div>
        <div className="mt-1 break-all text-[11px] opacity-90">{url || 'no-url'}</div>
        {lastPayload && <div className="mt-1 text-[11px] opacity-70">last: {JSON.stringify(lastPayload).slice(0,120)}</div>}
      </div>
    </div>
  )
}
