const WebSocket = require('ws');
const url = process.env.NP_TEST_URL || 'ws://localhost:4000';
const room = process.argv[2] || 'debug:test';
const ws = new WebSocket(url);
ws.on('open', () => {
  console.log('open -> joining', room);
  ws.send(JSON.stringify({ type: 'join', room }));
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'update', room, payload: { hello: 'world', ts: Date.now() } }));
  }, 500);
  setTimeout(() => ws.close(), 2000);
});
ws.on('message', (m) => console.log('msg', m.toString()));
ws.on('close', () => console.log('closed'));
ws.on('error', (e) => console.error('err', e.message));
