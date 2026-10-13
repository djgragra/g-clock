import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaults, sanitizeSettings, sanitizeGrids, sanitizeEvents, LIMITS } from '../src/schema.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'renderer', 'js');
const ctx = vm.createContext({});
ctx.window = ctx;
vm.runInContext('window.GC = {};', ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'schedmath.js'), 'utf-8'), ctx);
const S = ctx.GC.schedMath;
const H = (h, m = 0, s = 0) => h * 3600 + m * 60 + s;
const MON = 1, TUE = 2, SAT = 6, SUN = 0;

const grid = (o) => sanitizeGrids([{ id: 'g', name: 'x', days: [1, 2, 3, 4, 5], from: 0, to: 1440, marks: [0, 30], ...o }])[0];

// ---- stopset grids --------------------------------------------------------------------------

test('no grids: the default minutes apply all the time, as in the older versions', () => {
  const b = defaults().breaks;
  assert.deepEqual(b.grids, []);
  assert.deepEqual(S.activeMarks(b, MON, H(10)).marks, [0, 30]);
  assert.equal(S.activeMarks(b, MON, H(10)).grid, null);
});

test('a grid applies on its days and hours, the end is excluded', () => {
  const b = { marks: [0, 30], grids: [grid({ from: 6 * 60, to: 12 * 60, marks: [5, 35] })] };
  assert.deepEqual(S.activeMarks(b, MON, H(6)).marks, [5, 35]);
  assert.deepEqual(S.activeMarks(b, MON, H(11, 59, 59)).marks, [5, 35]);
  assert.deepEqual(S.activeMarks(b, MON, H(12)).marks, [0, 30]);
  assert.deepEqual(S.activeMarks(b, MON, H(5, 59, 59)).marks, [0, 30]);
  assert.deepEqual(S.activeMarks(b, SAT, H(8)).marks, [0, 30], 'not on Saturday');
});

test('the first matching grid wins', () => {
  const b = { marks: [0], grids: [grid({ marks: [10], from: 8 * 60, to: 9 * 60 }), grid({ marks: [20] })] };
  assert.deepEqual(S.activeMarks(b, TUE, H(8, 30)).marks, [10]);
  assert.deepEqual(S.activeMarks(b, TUE, H(9, 30)).marks, [20]);
});

test('a grid past midnight belongs to the day it starts', () => {
  const night = grid({ days: [5], from: 22 * 60, to: 2 * 60, marks: [15, 45] }); // Friday 22:00 → Saturday 02:00
  const b = { marks: [0], grids: [night] };
  assert.deepEqual(S.activeMarks(b, 5, H(23)).marks, [15, 45]);
  assert.deepEqual(S.activeMarks(b, SAT, H(1, 59)).marks, [15, 45]);
  assert.deepEqual(S.activeMarks(b, SAT, H(2)).marks, [0]);
  assert.deepEqual(S.activeMarks(b, SAT, H(23)).marks, [0], 'Saturday evening is not Friday');
  assert.deepEqual(S.activeMarks(b, 5, H(1)).marks, [0], 'Friday early morning belongs to Thursday night');
  assert.deepEqual(S.activeMarks({ marks: [0], grids: [grid({ days: [SUN], from: 22 * 60, to: 60, marks: [7] })] }, SAT, H(23)).marks, [0]);
  assert.deepEqual(S.activeMarks({ marks: [0], grids: [grid({ days: [SAT], from: 22 * 60, to: 60, marks: [7] })] }, SUN, H(0, 30)).marks, [7], 'Saturday night runs into Sunday');
});

test('from = to means all day', () => {
  const b = { marks: [0], grids: [grid({ days: [SAT, SUN], from: 0, to: 0, marks: [20, 50] })] };
  assert.deepEqual(S.activeMarks(b, SUN, H(15)).marks, [20, 50]);
});

test('grids are validated: marks, days, times, limit; old settings without grids still load', () => {
  const g = sanitizeGrids([{ id: 'a', name: '  Morning  ', days: [1, 1, 9, 'x', 2], from: -5, to: 9999, marks: [30, 0, 0, 75, 'q'] }])[0];
  assert.deepEqual({ ...g }, { id: 'a', name: 'Morning', days: [1, 2], from: 0, to: 1440, marks: [0, 30] });
  assert.deepEqual(sanitizeGrids([{ marks: [5] }])[0].days, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(sanitizeGrids([{ name: 'no marks' }, null, 5]).length, 0);
  assert.equal(sanitizeGrids(Array.from({ length: 30 }, () => ({ marks: [1] }))).length, LIMITS.grids);
  const old = sanitizeSettings({ breaks: { marks: [10, 40] } });
  assert.deepEqual(old.breaks.marks, [10, 40]);
  assert.deepEqual(old.breaks.grids, []);
  const roundTrip = sanitizeSettings(sanitizeSettings({ breaks: { grids: [g] } }));
  assert.deepEqual(roundTrip.breaks.grids, [g]);
  assert.deepEqual(sanitizeSettings({ breaks: { marks: [3] } }, roundTrip).breaks.grids, [g], 'a partial update keeps the grids');
});

// ---- fixed events ---------------------------------------------------------------------------

const ev = (o) => ({ id: 'e', label: 'News', time: 18 * 60, days: [0, 1, 2, 3, 4, 5, 6], warnSec: 60, enabled: true, ...o });

test('next event: counts down to today, then to the next day it runs', () => {
  const events = { list: [ev({ time: 18 * 60 })] };
  assert.equal(S.nextEvent(events, MON, H(17, 59)).remaining, 60);
  assert.equal(S.nextEvent(events, MON, H(18, 0, 1)).remaining, DAY() - 1);
  const weekdays = { list: [ev({ days: [1, 2, 3, 4, 5] })] };
  assert.equal(S.nextEvent(weekdays, 5, H(19)).remaining, 3 * DAY() - H(1), 'Friday evening → Monday 18:00');
});

test('next event: the nearest of several, disabled ones ignored', () => {
  const events = { list: [ev({ id: 'a', label: 'A', time: 20 * 60 }), ev({ id: 'b', label: 'B', time: 18 * 60 + 20 }), ev({ id: 'c', label: 'C', time: 18 * 60 + 5, enabled: false })] };
  const n = S.nextEvent(events, MON, H(18));
  assert.equal(n.event.label, 'B');
  assert.equal(n.remaining, 20 * 60);
  assert.equal(S.nextEvent({ list: [] }, MON, 0), null);
  assert.equal(S.nextEvent({ list: [ev({ enabled: false })] }, MON, 0), null);
});

test('the event at this very second is "now", not "next"', () => {
  const events = { list: [ev({ time: 18 * 60 })] };
  assert.equal(S.activeEvent(events, MON, H(18))?.label, 'News');
  assert.equal(S.activeEvent(events, MON, H(18, 0, 9))?.label, 'News');
  assert.equal(S.activeEvent(events, MON, H(18, 0, 10)), null);
  assert.equal(S.activeEvent(events, MON, H(17, 59, 59)), null);
  assert.equal(S.nextEvent(events, MON, H(18)).remaining, DAY());
});

test('an event at 23:59 is "now" for ten seconds and does not leak into the next day', () => {
  const events = { list: [ev({ time: 23 * 60 + 59, days: [MON] })] };
  assert.equal(S.activeEvent(events, MON, H(23, 59, 4))?.label, 'News');
  assert.equal(S.activeEvent(events, TUE, 5), null);
  assert.equal(S.nextEvent(events, MON, H(23, 59, 30)).remaining, 7 * DAY() - 30);
});

test('warning: one visual warning, at the time chosen for the event', () => {
  assert.equal(S.eventState(ev({ warnSec: 60 }), 61), 'normal');
  assert.equal(S.eventState(ev({ warnSec: 60 }), 60), 'warn');
  assert.equal(S.eventState(ev({ warnSec: 300 }), 120), 'warn');
});

test('events are validated and old settings load with no events', () => {
  const e = sanitizeEvents([{ id: 'x', label: ' Ads ', time: 1500, days: [], warnSec: 1, enabled: 'yes' }, { label: 'no time' }, { time: 'abc' }]);
  assert.equal(e.length, 1);
  assert.deepEqual({ ...e[0] }, { id: 'x', label: 'Ads', time: 1439, days: [0, 1, 2, 3, 4, 5, 6], warnSec: 5, enabled: true });
  assert.equal(sanitizeEvents(Array.from({ length: 50 }, () => ({ time: 5 }))).length, LIMITS.events);
  const s = sanitizeSettings({ breaks: { marks: [1] } });
  assert.deepEqual(s.events, { enabled: true, list: [] });
  const d = defaults();
  assert.deepEqual(sanitizeSettings(d, d), d);
});

test('time text helpers', () => {
  assert.equal(S.hhmm(545), '09:05');
  assert.equal(S.hhmm(1439), '23:59');
  assert.equal(S.parseHHMM('9:05'), 545);
  assert.equal(S.parseHHMM('24:00'), 1440);
  for (const bad of ['', '25:00', '12:60', 'abc', '12', '12:5']) assert.equal(S.parseHHMM(bad), null, bad);
  assert.equal(S.countdown(59), '00:59');
  assert.equal(S.countdown(3725), '1:02:05');
  assert.equal(S.countdown(-4), '00:00');
});

function DAY() { return 86400; }
