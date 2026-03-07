#!/usr/bin/env node
// Simple WebSocket collaboration server for in-memory realtime sync.
// Usage: node scripts/collab-server.js

const WebSocket = require('ws');
const PORT = process.env.COLLAB_PORT || 4000;

// bind to 0.0.0.0 so localhost/hostnames resolve consistently from browsers
const wss = new WebSocket.Server({ port: PORT, host: '0.0.0.0' });
console.log(`Collab server listening on ws://0.0.0.0:${PORT}`);

// rooms: room -> Set of clients
const rooms = new Map();

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (e) { }
}

wss.on('connection', (ws) => {
  ws._rooms = new Set();
  // record remote address when available
  try { ws._remote = ws._socket && (ws._socket.remoteAddress || ws._socket.remoteAddress); } catch (e) { ws._remote = 'unknown' }
  console.log(`[collab-server] connection from=${ws._remote}`)

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch (e) { return }

    const { type, room, payload } = data;
    if (!type) return;

    if (type === 'join' && room) {
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);
      ws._rooms.add(room);
      // announce presence
        const clients = rooms.get(room).size;
        console.log(`[collab-server] join room=${room} clients=${clients} from=${ws._remote}`)
        for (const c of rooms.get(room)) {
          send(c, { type: 'presence', room, clients });
        }
      return;
    }

    if (type === 'leave' && room) {
      if (rooms.has(room)) {
        rooms.get(room).delete(ws);
        ws._rooms.delete(room);
      }
      return;
    }

    if (type === 'update' && room) {
      // Broadcast to other clients in room
      const set = rooms.get(room);
      if (!set) return;
      console.log(`[collab-server] update room=${room} from=${ws._id || ws._remote || 'unknown'}`)
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
        for (const c of set) send(c, { type: 'presence', room, clients: set.size });
      }
    }
  });
});
