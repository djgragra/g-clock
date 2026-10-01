// Dev helper: talks to a running `electron . --remote-debugging-port=9222` over CDP.
//   node dev/cdp.mjs shot out.png [width height]   screenshot (optionally resize window first)
//   node dev/cdp.mjs eval "expression"             evaluate in the page, print the result
//   node dev/cdp.mjs reload                        reload ignoring the cache
//   node dev/cdp.mjs logs                          print console messages gathered for 1.5 s
import fs from 'node:fs';

const [cmd, ...args] = process.argv.slice(2);
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) pending.get(d.id)(d);
  else if (d.method === 'Runtime.consoleAPICalled') logs.push(`[${d.params.type}] ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  else if (d.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  else if (d.method === 'Log.entryAdded') logs.push(`[${d.params.entry.level}] ${d.params.entry.text} ${d.params.entry.url || ''}`);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Runtime.enable');
await send('Log.enable');
if (cmd === 'shot') {
  const [out, w, h] = args;
  if (w && h) await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 400));
  const { result } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(result.data, 'base64'));
  console.log('saved', out);
} else if (cmd === 'eval') {
  const r = await send('Runtime.evaluate', { expression: args[0], awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result.result?.value ?? r.result.exceptionDetails ?? r.result, null, 1));
} else if (cmd === 'reload') {
  await send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 2500));
} else if (cmd === 'logs') {
  await new Promise((r) => setTimeout(r, 1500));
}
if (logs.length) console.log(logs.join('\n'));
ws.close();
