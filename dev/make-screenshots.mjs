#!/usr/bin/env node
// Renders the real interface (renderer/) in Chromium with a stand-in for the bridge to the main process and
// FICTITIOUS data only (fictitious publishers and headlines, a fixed clock), then writes docs/screenshots/*.png and
// checks a few things on the page. Used for the README and the site; it does not run Electron itself.
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM=/path/to/chrome node dev/make-screenshots.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaults, sanitizeSettings } from '../src/schema.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'docs', 'screenshots'));
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

const place = (id, name, detail, lat, lon) => ({ id, name, detail, lat, lon });
function demoSettings() {
  return sanitizeSettings({
    language: 'en',
    news: { feeds: [{ id: 'f1', name: 'Sample Wire', url: 'https://wire.example/rss', enabled: true }, { id: 'f2', name: 'Example Press', url: 'https://press.example/rss', enabled: true }] },
    weather: { enabled: true, unit: 'c', places: [place('w1', 'Rome', 'Italy', 41.9, 12.5), place('w2', 'Milan', 'Italy', 45.46, 9.19), place('w3', 'Naples', 'Italy', 40.85, 14.27)] },
    links: [{ id: 'l1', label: 'Guest link', url: 'https://example.com/guest', note: 'Remote guest room' }, { id: 'l2', label: 'Studio cam', url: 'https://example.com/cam', note: '' }],
    breaks: {
      marks: [0, 30], label: 'STOPSET', warnSec: 300,
      grids: [
        { id: 'g1', name: 'Afternoon', days: [1, 2, 3, 4, 5], from: 14 * 60, to: 19 * 60, marks: [0, 20, 40] },
        { id: 'g2', name: 'Weekend', days: [6, 0], from: 0, to: 1440, marks: [15, 45] }
      ]
    },
    events: { enabled: true, list: [
      { id: 'e1', label: 'News', time: 18 * 60, days: [0, 1, 2, 3, 4, 5, 6], warnSec: 60, enabled: true },
      { id: 'e2', label: 'Ad block', time: 18 * 60 + 20, days: [1, 2, 3, 4, 5], warnSec: 90, enabled: true },
      { id: 'e3', label: 'Guest on air', time: 17 * 60 + 40, days: [1, 2, 3, 4, 5], warnSec: 120, enabled: true }
    ] },
    programs: [{ id: 'p1', name: 'Morning show', blocks: [{ label: 'Opening', sec: 90 }, { label: 'Interview', sec: 420 }, { label: 'Closing', sec: 60 }] }]
  }, defaults());
}
const NEWS = {
  enabled: true,
  items: [
    ['Sample Wire', 'City council approves the new tram line after a long debate'],
    ['Example Press', 'Local bakery wins the regional bread festival for the third time'],
    ['Sample Wire', 'Heavy rain expected tonight; the evening commute may be slower'],
    ['Example Press', 'Library extends opening hours during the exam weeks'],
    ['Sample Wire', 'River festival returns this weekend with music on three stages'],
    ['Example Press', 'New cycle path links the station to the university campus']
  ].map(([src, title], i) => ({ src, title, link: `https://example.com/${i}`, ts: Date.UTC(2026, 9, 13, 15, 40) - i * 600_000 })),
  feeds: [{ id: 'f1', name: 'Sample Wire', enabled: true, error: null, fetchedAt: 1, count: 3 }, { id: 'f2', name: 'Example Press', enabled: true, error: null, fetchedAt: 1, count: 3 }]
};
const WEATHER = { enabled: true, unit: 'c', rows: [{ id: 'w1', temp: 21, code: 1 }, { id: 'w2', temp: 17, code: 3 }, { id: 'w3', temp: 23, code: 0 }], error: null };

const stub = `(() => {
  const call = (n, ...a) => window.__call(n, ...a);
  const listeners = {};
  window.__emit = (n, d) => (listeners[n] || []).forEach((f) => f(d));
  const on = (n) => (cb) => (listeners[n] = [...(listeners[n] || []), cb]);
  window.api = {
    platform: 'win32',
    settings: { get: () => call('get'), update: (p) => call('update', p), reset: () => call('get') },
    backup: { export: async () => ({ ok: true }), import: async () => ({ ok: false, canceled: true }) },
    programs: { export: async () => ({ ok: true }), import: async () => ({ ok: false, canceled: true }) },
    report: { save: async () => ({ ok: true }) }, clipboard: { write: async () => ({ ok: true }) },
    news: { get: () => call('news'), refresh: () => call('news') },
    weather: { get: () => call('weather'), geocode: async () => ({ ok: true, results: [] }) },
    window: { toggleFullscreen: async () => false },
    links: { open: async () => ({ ok: true }) },
    app: { info: async () => ({ name: 'G-Clock', version: '26.10.3', electron: '44.5.1', platform: 'win32', arch: 'x64' }), supportInfo: async () => 'G-Clock 26.10.3', openLogs: async () => ({ ok: true }) },
    updates: { status: () => call('upd'), check: () => call('upd'), download: async () => ({ ok: true }), cancel: async () => true, remind: () => call('upd'), skip: () => call('upd'), install: async () => ({ ok: true }) },
    whatsNew: { get: () => call('whatsnew'), seen: async () => true },
    on: { news: on('news'), weather: on('weather'), fullscreen: on('fs'), updateAvailable: on('upd'), updateProgress: on('prog') }
  };
})();`;

async function open({ time, settings, update = null, whatsnew = null }) {
  const ctx = await browser.newContext({ viewport: { width: 1240, height: 800 }, deviceScaleFactor: 2, timezoneId: 'Europe/Rome', locale: 'en-GB' });
  const page = await ctx.newPage();
  let cur = settings;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const payload = () => ({ settings: cur, lang: 'en', locale: 'en-GB', platform: 'win32', suggestedFeeds: [] });
  await page.exposeFunction('__call', (n, arg) => {
    if (n === 'get') return payload();
    if (n === 'update') { cur = sanitizeSettings(arg, cur); return payload(); }
    if (n === 'news') return cur.news.feeds.length ? NEWS : { enabled: true, items: [], feeds: [] };
    if (n === 'weather') return WEATHER;
    if (n === 'upd') return update || { info: { ok: true, current: '26.10.3', available: false }, banner: 'none', lastCheck: { at: Date.UTC(2026, 9, 13, 14, 0), ok: true, error: '' }, downloading: false, downloaded: null };
    if (n === 'whatsnew') return whatsnew;
    return null;
  });
  await page.addInitScript(stub);
  await page.clock.setFixedTime(new Date(time));
  await page.goto(pathToFileURL(path.join(root, 'renderer', 'index.html')).href);
  await page.waitForSelector('#dial path', { state: 'attached' });
  await page.waitForTimeout(700);
  return { page, ctx, errors, get settings() { return cur; } };
}

const shot = (page, name) => page.screenshot({ path: path.join(out, name) });
const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

// 1. On Air at 17:57:40 on a Tuesday: the afternoon grid (0, 20, 40) applies, the next event is the 18:00 news
{
  const s = await open({ time: '2026-10-13T17:57:40+02:00', settings: demoSettings() });
  check(await s.page.locator('#dial text.dial-mark').count() === 3, 'afternoon schedule should draw 3 stopset markers');
  check((await s.page.locator('#evLabel').textContent()) === 'News', 'next event should be News');
  check((await s.page.locator('#evCount').textContent()) === '02:20', 'countdown to 18:00 should be 02:20');
  check(await s.page.locator('#eventBar.warn').count() === 0, 'no warning yet (2:20 > 60 s)');
  await shot(s.page, '01-on-air.png');
  check(s.errors.length === 0, 'page errors: ' + s.errors.join(' | '));
  await s.ctx.close();
}
// 1b. the one warning, then NOW
{
  const s = await open({ time: '2026-10-13T17:59:30+02:00', settings: demoSettings() });
  check(await s.page.locator('#eventBar.warn').count() === 1, 'warning inside the last 60 s');
  await s.ctx.close();
  const n = await open({ time: '2026-10-13T18:00:03+02:00', settings: demoSettings() });
  check(await n.page.locator('#eventBar.now').count() === 1, 'NOW in the first 10 s');
  check((await n.page.locator('#evCount').textContent()) === 'NOW', 'NOW text');
  await n.ctx.close();
  const w = await open({ time: '2026-10-17T10:10:00+02:00', settings: demoSettings() }); // Saturday: weekend grid, 15 and 45
  check(await w.page.locator('#dial text.dial-mark').count() === 2, 'weekend grid draws 2 markers');
  check((await w.page.locator('#dial text.dial-mark').allTextContents()).join() === ':15,:45', 'weekend minutes');
  await w.ctx.close();
}
// 2. REC with a program
{
  const settings = sanitizeSettings({ airMode: 'rec', timer: { program: 'p1' } }, demoSettings());
  const s = await open({ time: '2026-10-13T17:57:40+02:00', settings });
  await s.page.click('#modeProgBtn');
  await s.page.waitForTimeout(400);
  await shot(s.page, '02-rec-timer.png');
  await s.ctx.close();
}
// 3. settings: schedules and events
for (const [section, file] of [['breaks', '03-settings-schedules.png'], ['events', '04-settings-events.png']]) {
  const s = await open({ time: '2026-10-13T17:57:40+02:00', settings: demoSettings() });
  await s.page.keyboard.press('s');
  await s.page.locator('#settingsNav .nav-item', { hasText: section === 'breaks' ? 'Stopsets' : 'Events' }).click();
  await s.page.waitForTimeout(300);
  if (section === 'breaks') await s.page.locator('#settingsContent').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await shot(s.page, file);
  check(s.errors.length === 0, `errors in ${section}: ` + s.errors.join(' | '));
  await s.ctx.close();
}
// 4. update strip, and its states
{
  const info = { ok: true, current: '26.10.3', latest: '26.10.4', available: true, url: 'https://github.com/djgragra/g-clock/releases/tag/v26.10.4', notes: 'Fixed: example\nAdded: example', canInstall: true, installerName: 'G-Clock-Setup-26.10.4.exe', error: '' };
  const s = await open({ time: '2026-10-13T12:10:00+02:00', settings: demoSettings(), update: { info, banner: 'show', lastCheck: { at: Date.UTC(2026, 9, 13, 10, 0), ok: true, error: '' }, downloading: false, downloaded: null } });
  check(await s.page.locator('#updateBanner:not([hidden])').count() === 1, 'update strip visible');
  await shot(s.page, '05-update.png');
  await s.page.evaluate(() => document.body.classList.add('fullscreen'));
  await s.page.waitForTimeout(1300);
  check(await s.page.locator('#updateBanner:not([hidden])').count() === 0, 'update strip hidden in full screen');
  await s.ctx.close();
}
// 5. what's new
{
  const s = await open({ time: '2026-10-13T12:10:00+02:00', settings: demoSettings(), whatsnew: { version: '26.10.3', date: '2026-10-13', bullets: ['**Fixed events**: a countdown to a time of day', 'Stopset schedules by day and hour'] } });
  check(await s.page.locator('#newOverlay:not([hidden])').count() === 1, "what's new window visible");
  await s.ctx.close();
}
// 6. the empty state with the logo: no feeds
{
  const s = await open({ time: '2026-10-13T12:10:00+02:00', settings: sanitizeSettings({ news: { feeds: [] }, weather: { enabled: false } }, demoSettings()) });
  check(await s.page.locator('.welcome-logo').count() === 1, 'welcome state with logo');
  await shot(s.page, '_welcome.png');
  await s.ctx.close();
}
await browser.close();
if (problems.length) {
  console.error('PROBLEMS:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('screenshots written to', out, 'and all page checks passed');
