import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'renderer', 'js');
const ctx = vm.createContext({});
ctx.window = ctx;
vm.runInContext('window.GC = {};', ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'dialmath.js'), 'utf-8'), ctx);
const M = ctx.GC.dialMath;

test('next stopset: counts to the nearest mark, wraps over the hour', () => {
  assert.deepEqual({ ...M.nextStopset(0 * 60 + 30, [0, 30]) }, { remaining: 29 * 60 + 30, mark: 30 });
  assert.deepEqual({ ...M.nextStopset(31 * 60, [0, 30]) }, { remaining: 29 * 60, mark: 0 });
  assert.deepEqual({ ...M.nextStopset(59 * 60 + 59, [0, 30]) }, { remaining: 1, mark: 0 });
  assert.equal(M.nextStopset(100, []), null);
});

test('at the exact second of a mark the next one is a full lap or the next mark away', () => {
  assert.equal(M.nextStopset(30 * 60, [30]).remaining, 3600);
  assert.equal(M.nextStopset(30 * 60, [0, 30]).remaining, 30 * 60);
});

test('on stopset during the whole minute of a mark', () => {
  assert.ok(M.onStopset(30 * 60, [0, 30]));
  assert.ok(M.onStopset(30 * 60 + 59, [0, 30]));
  assert.ok(!M.onStopset(31 * 60, [0, 30]));
  assert.ok(!M.onStopset(30 * 60 - 1, [0, 30]));
  assert.ok(M.onStopset(5, [0, 30]));
  assert.ok(!M.onStopset(100, []));
});

test('flash lasts 10 seconds from the start of the stopset minute', () => {
  assert.ok(M.flashing(30 * 60, [30]));
  assert.ok(M.flashing(30 * 60 + 9, [30]));
  assert.ok(!M.flashing(30 * 60 + 10, [30]));
  assert.ok(!M.flashing(30 * 60 - 1, [30]));
});

test('marker states', () => {
  assert.equal(M.markerState(30, 30 * 60 + 20, 300), 'active');
  assert.equal(M.markerState(30, 26 * 60, 300), 'near');
  assert.equal(M.markerState(30, 25 * 60 - 1, 300), 'upcoming');
  assert.equal(M.markerState(0, 45 * 60, 300), 'passed');
  assert.equal(M.markerState(0, 56 * 60, 300), 'near'); // the next hour change counts as close
  assert.equal(M.markerState(0, 10, 300), 'active');
  assert.equal(M.markerState(45, 10 * 60, 300), 'upcoming');
});

test('colours run from green through orange to red, like Studio Clock', () => {
  assert.equal(M.colorFP(0), 'rgb(34,197,94)');
  assert.equal(M.colorFP(0.5), 'rgb(245,166,35)');
  assert.equal(M.colorFP(0.85), 'rgb(232,74,43)');
  assert.equal(M.colorFP(1), 'rgb(232,43,43)');
  assert.equal(M.colorFP(2), 'rgb(232,43,43)');
  assert.equal(M.colorFP(-1), 'rgb(34,197,94)');
});

test('arc: valid path, minute 0 centred at 12 o clock', () => {
  const d = M.arc(350, 350, 270, 318, M.angle(0), M.angle(1));
  assert.match(d, /^M[\d. -]+A270 270 0 0 1 [\d. -]+L[\d. -]+A318 318 0 0 0 [\d. -]+Z$/);
  assert.ok(Math.abs(M.angle(0) + M.SEG / 2 + Math.PI / 2) < 1e-9, 'segment 0 is centred on the top');
  assert.ok(Math.abs(M.angle(60) - M.angle(0) - 2 * Math.PI) < 1e-9);
});
