const WebSocket = require('ws');
const URL = 'ws://localhost:4000';

function client(name) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => {
      console.log(`${name} open`);
      ws.send(JSON.stringify({ type: 'join', room: 'test-room' }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'update', room: 'test-room', payload: { from: name, text: `hello from ${name}` } }));
      }, 200);
    });
    ws.on('message', (msg) => {
      console.log(`${name} received:`, msg.toString());
    });
    ws.on('close', () => console.log(`${name} closed`));
    ws.on('error', (e) => console.error(`${name} error`, e));
    // resolve when we've received something
    setTimeout(() => resolve(), 1000);
  });
}

(async () => {
  await Promise.all([client('A'), client('B')]);
  console.log('Test finished');
  process.exit(0);
})();
