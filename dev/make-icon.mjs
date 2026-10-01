// Dev helper: draws the app icon (assets/icon.png, 1024x1024) with a canvas in the running app.
// Needs `npx electron . --remote-debugging-port=9222`. Run: node dev/make-icon.mjs
import fs from 'node:fs';

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const expression = `(() => {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  const rr = (px, py, w, h, r) => { x.beginPath(); x.roundRect(px, py, w, h, r); };
  rr(0, 0, 1024, 1024, 230); x.fillStyle = '#d8123a'; x.fill();
  x.strokeStyle = '#ffffff'; x.lineCap = 'round';
  x.lineWidth = 64; x.beginPath(); x.arc(512, 512, 338, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 56; // minute hand (up) and hour hand (towards 4 o'clock)
  x.beginPath(); x.moveTo(512, 512); x.lineTo(512, 250); x.stroke();
  x.beginPath(); x.moveTo(512, 512); x.lineTo(512 + 150, 512 + 86); x.stroke();
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(512, 512, 44, 0, Math.PI * 2); x.fill();
  return c.toDataURL('image/png');
})()`;
const data = await new Promise((resolve) => {
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) resolve(d.result.result.value); };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
});
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/icon.png', Buffer.from(data.split(',')[1], 'base64'));
console.log('assets/icon.png written');
ws.close();
