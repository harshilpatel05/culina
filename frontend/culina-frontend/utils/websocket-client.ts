// Minimal WebSocket client utility for frontend
let ws: WebSocket | null = null;
let listeners: ((msg: any) => void)[] = [];

export function connectWebSocket(url: string) {
  if (ws) return;
  ws = new WebSocket(url);
  ws.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      data = event.data;
    }
    listeners.forEach((cb) => cb(data));
  };
}

export function onWebSocketMessage(cb: (msg: any) => void) {
  listeners.push(cb);
}

export function sendWebSocketMessage(msg: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
}
