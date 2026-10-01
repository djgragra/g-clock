import { net } from 'electron';

// All outgoing requests go through Chromium's network stack (net.fetch): it trusts the
// operating system's certificates and follows the system proxy, like G-Downloader does.
//
// guardedFetch() is the only way the app reaches the network. It accepts https URLs only,
// follows redirects by hand so every hop is checked again, gives up after `timeoutMs`,
// and stops reading after `maxBytes`. It never reads local paths or other schemes.
const MAX_REDIRECTS = 4;

export async function guardedFetch(url, { timeoutMs = 10000, maxBytes = 2_000_000, headers = {} } = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!/^https:\/\//i.test(current)) throw new Error('only-https');
    const res = await net.fetch(current, { redirect: 'manual', signal, headers });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).href;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const declared = Number(res.headers.get('content-length'));
    if (declared > maxBytes) throw new Error('too-large');
    return { text: await readLimited(res, maxBytes), finalUrl: current };
  }
  throw new Error('too-many-redirects');
}

async function readLimited(res, maxBytes) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      reader.cancel().catch(() => {});
      throw new Error('too-large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
