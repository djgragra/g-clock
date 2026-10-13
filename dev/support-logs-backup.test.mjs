import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLogger, logFileRe, MAX_LOG_BYTES } from '../src/logs.js';
import { buildSupportInfo, tidy } from '../src/support.js';
import { buildBackup, prepareImport, missingItems, applyImport, backupFileName, missingSecrets } from '../src/backup.js';
import { defaults, sanitizeSettings, buildExport } from '../src/schema.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gclock-t-'));

// ---- logs ---------------------------------------------------------------------------------------------

test('log file names: one file per day, g-clock prefix', async () => {
  const dir = tmp();
  const log = createLogger({ dir, now: () => new Date(2026, 9, 13, 21, 5, 9) });
  log.log('info', 'started', 'app');
  await log.flush();
  assert.deepEqual(fs.readdirSync(dir), ['g-clock_13-10-2026.log']);
  assert.match(fs.readFileSync(path.join(dir, 'g-clock_13-10-2026.log'), 'utf8'), /^2026-10-13 21:05:09 \| INFO  \| app \| started\n$/);
  assert.equal(MAX_LOG_BYTES, 5 * 1024 * 1024);
});

test('a file that reaches the limit is closed and a new one starts; at most 4 files for one day', async () => {
  const dir = tmp();
  const log = createLogger({ dir, maxBytes: 200, now: () => new Date(2026, 9, 13, 12, 0, 0) });
  for (let i = 0; i < 40; i++) log.log('info', 'x'.repeat(60) + i);
  await log.flush();
  const files = fs.readdirSync(dir);
  assert.ok(files.length > 1 && files.length <= 4, files.join());
  for (const f of files) assert.ok(fs.statSync(path.join(dir, f)).size <= 300, f);
  assert.ok(files.every((f) => logFileRe('g-clock').test(f)));
});

test('logs older than the retention are removed, other files are not touched', () => {
  const dir = tmp();
  for (const n of ['g-clock_01-10-2026.log', 'g-clock_12-10-2026.log', 'other.log', 'g-clock_05-10-2026_1.log']) fs.writeFileSync(path.join(dir, n), 'x');
  const log = createLogger({ dir, retentionDays: 7, now: () => new Date(2026, 9, 13, 12, 0, 0) });
  assert.equal(log.prune(), 2);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['g-clock_12-10-2026.log', 'other.log']);
});

// ---- support info ---------------------------------------------------------------------------------------

test('support info has version, system and last check/error, with the home folder as ~ and no settings', () => {
  const text = buildSupportInfo({
    app: 'G-Clock', version: '26.10.3', electron: '44.5.1', chrome: '140.0', platform: 'win32', arch: 'x64', osRelease: '10.0.19045', language: 'it',
    lastCheck: { at: Date.UTC(2026, 9, 13, 8, 0, 0), ok: false, error: 'ENOENT C:\\Users\\Mario Rossi\\Downloads\\x' },
    lastError: { t: Date.UTC(2026, 9, 13, 9, 0, 0), message: 'failed at /home/mario/clock/feeds.txt' },
    home: ''
  });
  assert.match(text, /^G-Clock 26\.10\.3\nElectron 44\.5\.1 \(Chrome 140\.0\)\nSystem: win32 x64 10\.0\.19045\nLanguage: it\n/);
  assert.match(text, /Last update check: 2026-10-13T08:00:00\.000Z \(ENOENT ~\\Downloads\\x\)/);
  assert.match(text, /Last error: .* failed at ~\/clock\/feeds\.txt/);
  assert.ok(!/Rossi|mario/.test(text));
  assert.match(buildSupportInfo({ app: 'G-Clock', version: '1', electron: '2', platform: 'linux', arch: 'x64', language: 'en' }), /Last update check: never\nLast error: none$/);
  assert.equal(tidy('open /root/secret/a.txt', '/root'), 'open ~/secret/a.txt');
});

// ---- backup ---------------------------------------------------------------------------------------------

const program = (id) => ({ id, name: 'P ' + id, blocks: [{ label: 'a', sec: 60 }], updated: 1 });
const sample = () => sanitizeSettings({
  language: 'it', timeZone: 'Europe/Rome',
  programs: [program('p1'), program('p2')],
  links: [{ id: 'l1', label: 'Cam', url: 'https://example.com/cam', note: 'n' }],
  breaks: { marks: [10, 40], grids: [{ id: 'g1', name: 'Morning', days: [1], from: 360, to: 720, marks: [5] }] },
  events: { list: [{ id: 'e1', label: 'News', time: 1080, days: [1, 2], warnSec: 90 }] }
});

test('file name and shape: app slug, version 1, no secrets, programs beside the settings', () => {
  assert.equal(backupFileName(new Date(2026, 9, 3)), 'g-clock-backup-2026-10-03.json');
  const b = buildBackup(sample(), new Date(Date.UTC(2026, 9, 13)));
  assert.equal(b.app, 'g-clock');
  assert.equal(b.version, 1);
  assert.equal(b.includesSecrets, false);
  assert.equal(b.exportedAt, '2026-10-13T00:00:00.000Z');
  assert.equal(b.programs.length, 2);
  assert.equal(b.settings.programs, undefined);
  assert.equal(b.emptiedSecrets, undefined);
  assert.deepEqual(missingSecrets(), []);
});

test('export then import gives back the same settings (grids and events included)', () => {
  const s = sample();
  const back = prepareImport(JSON.parse(JSON.stringify(buildBackup(s))));
  assert.deepEqual(back, s);
});

test('no key looks like a password or token', () => {
  const text = JSON.stringify(buildBackup(sample()));
  assert.ok(!/pass|token|secret|apikey/i.test(text.replace(/includesSecrets/, '')));
});

test('older files import: the settings export of 26.10.2 (app id, programs inside the settings) and a bare settings object', () => {
  const s = sample();
  assert.deepEqual(prepareImport(JSON.parse(JSON.stringify(buildExport(s)))), s);
  assert.deepEqual(prepareImport({ language: 'es', programs: [program('x')] }).programs.map((p) => p.id), ['x']);
});

test('another app\'s file and rubbish are refused; what the file lacks keeps its default', () => {
  assert.throws(() => prepareImport({ app: 'tag-fixer', settings: {} }), /foreign/);
  assert.throws(() => prepareImport({ app: 'com.other.app', settings: { language: 'it' } }), /foreign/);
  for (const bad of [null, [], 'x', 5, {}]) assert.throws(() => prepareImport(bad), /invalid/);
  const minimal = prepareImport({ app: 'g-clock', version: 1, settings: { language: 'it' } });
  assert.equal(minimal.language, 'it');
  assert.deepEqual(minimal.breaks.marks, [0, 30]);
});

test('hostile content in a file is cleaned like saved settings', () => {
  const b = buildBackup(sample());
  b.settings.links = [{ label: 'x', url: 'javascript:alert(1)' }, { label: 'ok', url: 'https://ok.example/' }];
  b.settings.news = { feeds: [{ name: 'f', url: 'http://plain.example/rss' }, { name: 'g', url: 'https://user:pw@x.example/rss' }] };
  const s = prepareImport(b);
  assert.deepEqual(s.links.map((l) => l.label), ['ok']);
  assert.deepEqual(s.news.feeds, []);
});

test('"replace everything" takes the file; "add only the missing" keeps this computer\'s settings', () => {
  const current = sanitizeSettings({ language: 'en', programs: [program('p1')], links: [{ id: 'l9', label: 'Mine', url: 'https://mine.example/' }], breaks: { marks: [15] } });
  const incoming = sample();
  assert.deepEqual(applyImport(current, incoming, 'replace'), incoming);
  const merged = applyImport(current, incoming, 'add');
  assert.equal(merged.language, 'en', 'settings untouched');
  assert.deepEqual(merged.breaks.marks, [15]);
  assert.deepEqual(merged.programs.map((p) => p.id), ['p1', 'p2']);
  assert.deepEqual(merged.links.map((l) => l.id), ['l9', 'l1']);
  assert.deepEqual(merged.breaks.grids.map((g) => g.id), ['g1']);
  assert.deepEqual(merged.events.list.map((e) => e.id), ['e1']);
  assert.throws(() => applyImport(current, incoming, 'other'), /invalid-mode/);
  assert.deepEqual(missingItems(current, current).programs, current.programs);
});

test('the keys the app saves apart from the settings are not in a backup', () => {
  const text = JSON.stringify(buildBackup(defaults()));
  for (const k of ['updateState', 'lastSeenVersion', 'newsCache', 'windowBounds', 'remindUntil']) assert.ok(!text.includes(k), k);
});
