import axios from 'axios'

export async function triggerCollabUpdate(room: string, payload: any = { action: 'refresh' }) {
  try {
    const url = process.env.NEXT_PUBLIC_COLLAB_URL || `http://localhost:${process.env.NEXT_PUBLIC_COLLAB_PORT || 4000}`
    // Since our collab server is WebSocket-only, and we are in a server-side context (Next.js API route),
    // we could either use a WebSocket client here or expose a small HTTP hook on the collab server.
    // However, the easiest and most consistent way is to let the dashboard client trigger it.
    // For "Recent Matches" which is a global lobby thing, we want a server-side trigger.
    
    // As a temporary clean solution that doesn't require adding `ws` dependency to the Next.js API:
    // We will just let the client who made the report broadcast the update, as they are already connected.
  } catch (e) {
    console.error('[collab-helper] Failed to trigger update', e)
  }
}
