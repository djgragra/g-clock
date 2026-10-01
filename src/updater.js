import { app, net } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isNewer, pickInstaller } from './release.js';

// Guided update, same model as G-Downloader: ask GitHub for the latest release of the public
// repository, and on request download the installer for this system, verify it against the
// release's SHA256SUMS.txt and hand it to the user. Nothing installs by itself (builds are
// unsigned, so a silent self-update is not possible on macOS).
export const REPO = 'djgragra/g-clock';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const ASSET_PREFIX = `https://github.com/${REPO}/releases/download/`;

const userAgent = () => `G-Clock/${app.getVersion()}`;

export async function checkForUpdate() {
  const current = app.getVersion();
  try {
    const res = await net.fetch(API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': userAgent() },
      signal: AbortSignal.timeout(15000)
    });
    if (res.status === 404) return { ok: true, current, available: false };
    if (!res.ok) return { ok: false, current, error: `GitHub HTTP ${res.status}` };
    const rel = await res.json();
    const latest = String(rel.tag_name || '').replace(/^v/i, '');
    // only download URLs of this repository, never a URL taken as-is from the response
    const assets = (rel.assets || [])
      .filter((a) => typeof a.browser_download_url === 'string' && a.browser_download_url.startsWith(ASSET_PREFIX))
      .map((a) => ({ name: String(a.name), url: a.browser_download_url, size: a.size || 0 }));
    return {
      ok: true,
      current,
      latest,
      available: isNewer(latest, current),
      url: `https://github.com/${REPO}/releases/tag/${encodeURIComponent(rel.tag_name || '')}`,
      installer: pickInstaller(assets),
      sumsUrl: assets.find((a) => a.name === 'SHA256SUMS.txt')?.url || null
    };
  } catch (err) {
    return { ok: false, current, error: err.message };
  }
}

// Downloads into `dir` as "<name>.part"; it gets its real name only once the checksum matches.
export async function downloadInstaller(info, dir, onProgress) {
  if (!info?.installer) throw new Error('no-installer');
  if (!info.sumsUrl) throw new Error('no-checksums');
  const { name, url } = info.installer;
  const headers = { 'User-Agent': userAgent() };

  const sumsRes = await net.fetch(info.sumsUrl, { headers, signal: AbortSignal.timeout(30000) });
  if (!sumsRes.ok) throw new Error(`SHA256SUMS.txt: HTTP ${sumsRes.status}`);
  const line = (await sumsRes.text())
    .split('\n')
    .map((l) => l.trim().split(/\s+\*?/))
    .find((p) => p[1] === name);
  if (!line || !/^[0-9a-f]{64}$/i.test(line[0])) throw new Error('no-checksums');
  const expected = line[0].toLowerCase();

  const res = await net.fetch(url, { headers });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || info.installer.size || 0;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, path.basename(name));
  const partial = `${file}.part`;
  const out = fs.createWriteStream(partial);
  const hash = crypto.createHash('sha256');
  let received = 0;
  let lastReport = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      received += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
      const now = Date.now();
      if (onProgress && now - lastReport > 250) {
        lastReport = now;
        onProgress(received, total);
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  } catch (err) {
    out.destroy();
    fs.rmSync(partial, { force: true });
    throw err;
  }
  onProgress?.(received, total);
  if (hash.digest('hex') !== expected) {
    fs.rmSync(partial, { force: true });
    throw new Error('checksum-mismatch');
  }
  fs.renameSync(partial, file);
  return file;
}
