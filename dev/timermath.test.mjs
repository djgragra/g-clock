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
vm.runInContext(fs.readFileSync(path.join(root, 'timermath.js'), 'utf-8'), ctx);
const T = ctx.GC.timerMath;

const blocks = [{ label: 'Open', sec: 120 }, { label: 'Talk', sec: 600 }, { label: '', sec: 300 }];

test('clock and duration text', () => {
  assert.equal(T.clk(125), '02:05');
  assert.equal(T.clk(-5), '-00:05');
  assert.equal(T.clk(0), '00:00');
  assert.equal(T.clk(6000), '100:00');
  assert.equal(T.durStr(-3), '00:00');
  assert.equal(T.durStr(61), '01:01');
});

test('lenient duration parsing for the editor', () => {
  assert.equal(T.parseDur('5'), 300);
  assert.equal(T.parseDur('1:30'), 90);
  assert.equal(T.parseDur('1:90'), 119);
  assert.equal(T.parseDur(''), 0);
  assert.equal(T.parseDur('abc'), 0);
  assert.equal(T.parseDur('2.5'), 150);
});

test('dynamic timing carries the drift of recorded blocks to the next ones', () => {
  const actuals = [[130], [590]]; // +10 s, then -10 s
  assert.equal(T.effTarget(blocks, [], 0, true), 120);
  assert.equal(T.effTarget(blocks, actuals, 1, true), 600 - 10);
  assert.equal(T.effTarget(blocks, actuals, 2, true), 300 - 0);
  assert.equal(T.effTarget(blocks, actuals, 1, false), 600);
  assert.equal(T.cumDevBefore(blocks, actuals, 2), 0);
});

test('several takes of a block add up', () => {
  const actuals = [[50, 80]];
  assert.equal(T.totalTakes(actuals, 0), 130);
  assert.ok(T.hasTakes(actuals, 0));
  assert.ok(!T.hasTakes(actuals, 1));
  assert.ok(!T.hasTakes([[]], 0));
  assert.equal(T.effTarget(blocks, actuals, 1, true), 600 - 10);
});

test('a block that was skipped adds no drift', () => {
  const actuals = [undefined, [610]];
  assert.equal(T.cumDevBefore(blocks, actuals, 2), 10);
});

test('report totals and rows', () => {
  const r = T.buildReport(blocks, [[130], [30, 590]], (i) => 'Block ' + (i + 1));
  assert.equal(r.rows[2].label, 'Block 3');
  assert.equal(r.rows[2].actual, null);
  assert.equal(r.rows[1].actual, 620);
  assert.deepEqual(r.rows[1].takes, [30, 590]);
  assert.equal(r.rows[0].diff, 10);
  assert.equal(r.totPlanned, 1020);
  assert.equal(r.totActual, 750);
  assert.equal(r.drift, -270);
});

test('report text', () => {
  const r = T.buildReport(blocks, [[130], [600], [290]], (i) => 'Block ' + (i + 1));
  const L = { header: 'REPORT', block: 'Block', planned: 'Planned', actual: 'Actual', diff: 'Diff', totPlanned: 'Total planned', totActual: 'Total recorded', drift: 'Final drift' };
  const text = T.reportText(r, L, 'Morning', '1 Oct 2026');
  assert.match(text, /^REPORT — Morning\n1 Oct 2026\n/);
  assert.match(text, /Open\s+02:00\s+02:10\s+\+00:10/);
  assert.match(text, /Final drift:\s+\+00:00/);
});
