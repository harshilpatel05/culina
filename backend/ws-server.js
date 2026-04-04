// Minimal WebSocket server for live order/table updates
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    // Broadcast received message to all clients
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
  ws.send(JSON.stringify({ type: 'connected' }));
});

console.log('WebSocket server running on ws://localhost:8080');
