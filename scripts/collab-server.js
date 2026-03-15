#!/usr/bin/env node
// Simple WebSocket collaboration server for in-memory realtime sync.
// Usage: node scripts/collab-server.js

const WebSocket = require('ws');
const PORT = process.env.COLLAB_PORT || 4000;

// bind to 0.0.0.0 so localhost/hostnames resolve consistently from browsers
const wss = new WebSocket.Server({ port: PORT, host: '0.0.0.0' }, () => {
    console.log(`Collab server listening on ws://0.0.0.0:${PORT}`);
    // Performance: lower latency for gaming real-time updates
    wss._server.setNoDelay = true;
});

// rooms: room -> Set of clients
const rooms = new Map();

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (e) { }
}

wss.on('connection', (ws) => {
  ws._rooms = new Set();
  ws._userId = null;
  // record remote address when available
  try { ws._remote = ws._socket && (ws._socket.remoteAddress || ws._socket.remoteAddress); } catch (e) { ws._remote = 'unknown' }
  console.log(`[collab-server] connection from=${ws._remote}`)

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch (e) { return }

    const { type, room, payload, userId } = data;
    if (!type) return;

    if (type === 'join' && room) {
      if (!rooms.has(room)) rooms.set(room, new Set());
      const set = rooms.get(room);
      set.add(ws);
      ws._rooms.add(room);
      if (userId) {
        ws._userId = userId;
        console.log(`[collab-server] assigned userId=${userId} to ws`);
      }

      // announce presence
        const clients = set.size;
        const userIds = Array.from(set).map(c => c._userId).filter(id => !!id);

        console.log(`[collab-server] presence room=${room} count=${clients} users=[${userIds.join(', ')}]`)
        for (const c of set) {
          send(c, { type: 'presence', room, clients, userIds });
        }
      return;
    }

    if (type === 'leave' && room) {
      if (rooms.has(room)) {
        const set = rooms.get(room);
        set.delete(ws);
        ws._rooms.delete(room);
        const userIds = Array.from(set).map(c => c._userId).filter(id => !!id);
        for (const c of set) {
          send(c, { type: 'presence', room, clients: set.size, userIds });
        }
      }
      return;
    }

    if (type === 'update' && room) {
      // Broadcast to other clients in room
      const set = rooms.get(room);
      if (!set) return;
      console.log(`[collab-server] update room=${room} from=${ws._remote}`)
      for (const client of set) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          send(client, { type: 'update', room, payload });
        }
      }
      return;
    }

    if (type === 'ping') {
      send(ws, { type: 'pong' });
    }
  });

  ws.on('close', () => {
    for (const room of ws._rooms) {
      const set = rooms.get(room);
      if (!set) continue;
      set.delete(ws);
      if (set.size === 0) rooms.delete(room);
      else {
        const userIds = Array.from(set).map(c => c._userId).filter(id => !!id);
        for (const c of set) send(c, { type: 'presence', room, clients: set.size, userIds });
      }
    }
  });
});
