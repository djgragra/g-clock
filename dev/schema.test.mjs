import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, sanitizeSettings, parseImport, buildExport, parseWebUrl, isValidTimeZone, LIMITS } from '../src/schema.js';

test('defaults survive their own validation unchanged', () => {
  const d = defaults();
  const again = sanitizeSettings(d, d);
  assert.deepEqual(again, d);
});

test('weather is off by default, news has three neutral international feeds', () => {
  const d = defaults();
  assert.equal(d.weather.enabled, false);
  assert.equal(d.news.feeds.length, 3);
  assert.ok(d.news.feeds.every((f) => f.url.startsWith('https://')));
});

test('URLs: buttons accept http(s) only, feeds https only, no credentials, no other schemes', () => {
  assert.equal(parseWebUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(parseWebUrl('http://192.168.1.20/cam'), 'http://192.168.1.20/cam');
  assert.equal(parseWebUrl('http://x.com', { httpsOnly: true }), null);
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'ftp://x.com', 'https://user:pw@x.com', 'not a url', '', null]) {
    assert.equal(parseWebUrl(bad), null, String(bad));
  }
});

test('links and feeds with bad URLs are dropped', () => {
  const s = sanitizeSettings({
    links: [{ label: 'ok', url: 'https://a.com' }, { label: 'bad', url: 'javascript:1' }, { label: 'file', url: 'file:///x' }],
    news: { feeds: [{ name: 'a', url: 'https://a.com/rss' }, { name: 'b', url: 'http://b.com/rss' }, { name: 'c', url: 'file:///etc/passwd' }] }
  });
  assert.deepEqual(s.links.map((l) => l.label), ['ok']);
  assert.deepEqual(s.news.feeds.map((f) => f.name), ['a']);
});

test('limits are enforced', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ label: 'l' + i, url: 'https://a.com/' + i }));
  assert.equal(sanitizeSettings({ links: many }).links.length, LIMITS.links);
  const cities = Array.from({ length: 50 }, () => ({ name: 'x', tz: 'UTC' }));
  assert.equal(sanitizeSettings({ cities }).cities.length, LIMITS.cities);
});

test('time zones are checked', () => {
  assert.ok(isValidTimeZone('Europe/Rome'));
  assert.ok(!isValidTimeZone('Mars/Olympus'));
  assert.equal(sanitizeSettings({ timeZone: 'Mars/Olympus' }).timeZone, 'system');
  assert.equal(sanitizeSettings({ timeZone: 'Asia/Tokyo' }).timeZone, 'Asia/Tokyo');
  assert.equal(sanitizeSettings({ cities: [{ name: 'x', tz: 'Nope/Nope' }] }).cities.length, 0);
});

test('logo: only raster data URLs from the resize step', () => {
  assert.equal(sanitizeSettings({ logo: 'data:image/png;base64,iVBORw0KGgo=' }).logo, 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(sanitizeSettings({ logo: 'data:image/svg+xml;base64,PHN2Zz4=' }).logo, null);
  assert.equal(sanitizeSettings({ logo: 'https://x.com/a.png' }).logo, null);
  assert.equal(sanitizeSettings({ logo: 'data:image/png;base64,' + 'A'.repeat(1_100_000) }).logo, null);
  const withLogo = sanitizeSettings({ logo: 'data:image/png;base64,iVBORw0KGgo=' });
  assert.equal(sanitizeSettings({ logo: null }, withLogo).logo, null);
});

test('partial patches keep the other values', () => {
  const base = sanitizeSettings({ breaks: { enabled: true, marks: [10, 40], label: 'ADS', warnSec: 30 } });
  const next = sanitizeSettings({ breaks: { enabled: false } }, base);
  assert.deepEqual(next.breaks, { enabled: false, marks: [10, 40], label: 'ADS', warnSec: 30 });
});

test('break marks: integers 0-59, unique, sorted', () => {
  assert.deepEqual(sanitizeSettings({ breaks: { marks: [30, 0, 30, 61, -1, 1.5, 'x', 15] } }).breaks.marks, [0, 15, 30]);
});

test('timer presets and ranges', () => {
  assert.deepEqual(sanitizeSettings({ timer: { presets: [300, 60, 60, 0, -5, 'a'] } }).timer.presets, [60, 300]);
  assert.equal(sanitizeSettings({ news: { intervalMin: 0 } }).news.intervalMin, 2);
  assert.equal(sanitizeSettings({ news: { intervalMin: 9999 } }).news.intervalMin, 120);
  assert.equal(sanitizeSettings({ news: { rotateSec: 1 } }).news.rotateSec, 4);
});

test('unknown keys and wrong types are ignored', () => {
  const s = sanitizeSettings({ hour12: 'yes', evil: 1, language: 'fr', airMode: 'x', __proto__: { x: 1 } });
  assert.equal(s.hour12, false);
  assert.equal(s.language, 'auto');
  assert.equal(s.airMode, 'onair');
  assert.equal(s.evil, undefined);
});

test('export holds no secrets and imports back', () => {
  const s = sanitizeSettings({ hour12: true, links: [{ label: 'Cam', url: 'https://cam.local/x', note: 'n' }] });
  const file = JSON.parse(JSON.stringify(buildExport(s)));
  assert.equal(file.app, 'com.onairgarage.gclock');
  assert.doesNotMatch(JSON.stringify(file), /password|token|apikey|secret/i);
  const back = parseImport(file);
  assert.equal(back.hour12, true);
  assert.equal(back.links[0].label, 'Cam');
});

test('import rejects foreign and empty files', () => {
  assert.throws(() => parseImport({ app: 'com.other.app', settings: {} }), /foreign/);
  assert.throws(() => parseImport({}), /invalid/);
  assert.throws(() => parseImport([]), /invalid/);
  assert.throws(() => parseImport(null), /invalid/);
});
