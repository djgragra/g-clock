// Starts the real app (Electron, under Xvfb when there is no display) with a throw-away profile and talks to its
// window over the DevTools protocol. Used by dev/e2e.mjs and dev/make-screenshots.mjs. Linux as written.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ extraArgs = [] } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gclock-e2e-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const electron = path.join(root, 'node_modules', '.bin', 'electron');
  const args = ['--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...extraArgs, root];
  const cmd = process.env.DISPLAY ? [electron, args] : ['xvfb-run', ['-a', '-s', '-screen 0 1280x800x24', electron, ...args]];
  const child = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' });
  const errors = [];
  let ws;
  let id = 0;
  const pending = new Map();

  const close = () => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
    fs.rmSync(profile, { recursive: true, force: true });
  };
  process.on('exit', close);

  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
      }
    } catch { /* not up yet */ }
    if (!ws) await sleep(500);
  }
  if (!ws) { close(); throw new Error('Electron did not start'); }
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) pending.get(d.id)(d);
    else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  async function ev(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
    return r.result.result.value;
  }
  await send('Runtime.enable');
  return { ev, send, errors, close, profile };
}
