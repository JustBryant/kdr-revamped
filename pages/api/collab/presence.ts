import type { NextApiRequest, NextApiResponse } from 'next'
import { triggerPusher } from '../../../lib/pusher'

// Simple in-memory presence within the same Vercel deployment instance
// Larger scale apps would store in Redis (like upstash)
const globalUsers = new Map<string, { lastSeen: number, timeout: any }>()
const userIdsByRoom = new Map<string, Set<string>>()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })

  const { room = 'kdr-lobby', userId, action } = req.body
  if (!userId) return res.status(400).json({ message: 'User ID is required' })

  try {
    if (!userIdsByRoom.has(room)) userIdsByRoom.set(room, new Set())
    const roomUsers = userIdsByRoom.get(room)!

    if (action === 'join') {
      roomUsers.add(userId as string)
      // Cleanup after inactive (30s)
      if (globalUsers.has(userId)) clearTimeout(globalUsers.get(userId)!.timeout)
      const timeout = setTimeout(async () => {
        roomUsers.delete(userId as string)
        await triggerPusher(room, 'presence', { userIds: Array.from(roomUsers) })
        globalUsers.delete(userId as string)
      }, 30000)
      globalUsers.set(userId as string, { lastSeen: Date.now(), timeout })
    }

    // Broadcast the current list of online users in the room
    await triggerPusher(room, 'presence', { userIds: Array.from(roomUsers) })
    return res.status(200).json({ success: true, count: roomUsers.size })
  } catch (err: any) {
    console.error('Presence error:', err)
    return res.status(500).json({ error: err.message })
  }
}
