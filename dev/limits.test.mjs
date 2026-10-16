import test from 'node:test';
import assert from 'node:assert/strict';
import { limitState, clampIndex, currentStep, advance, back, stepAfter, stepText } from '../src/limits.js';

const prog = (n = 3, extra = {}) => ({ id: 'p', name: 'Show', steps: Array.from({ length: n }, (_, i) => ({ name: `S${i + 1}`, sec: (i + 1) * 60 })), ...extra });

// ---- the colour of the figures ----
test('limitState: ok, warn 10 s before, over past the limit, flash 10 s later', () => {
  const o = { warnSec: 10, flashSec: 10 };
  assert.equal(limitState(0, 60, o), 'ok');
  assert.equal(limitState(49_999, 60, o), 'ok');
  assert.equal(limitState(50_000, 60, o), 'warn');
  assert.equal(limitState(60_000, 60, o), 'warn', 'the limit itself is not yet over');
  assert.equal(limitState(60_001, 60, o), 'over');
  assert.equal(limitState(70_000, 60, o), 'over');
  assert.equal(limitState(70_001, 60, o), 'flash');
});

test('limitState: no limit means no state; a warning longer than the limit warns from the start; zero values', () => {
  assert.equal(limitState(99_999, 0), 'none');
  assert.equal(limitState(99_999, undefined), 'none');
  assert.equal(limitState(0, 5, { warnSec: 10, flashSec: 10 }), 'warn');
  assert.equal(limitState(1_000, 60, { warnSec: 0, flashSec: 0 }), 'ok');
  assert.equal(limitState(60_000, 60, { warnSec: 0, flashSec: 0 }), 'warn');
  assert.equal(limitState(60_001, 60, { warnSec: 0, flashSec: 0 }), 'flash');
});

// ---- the steps ----
test('advance: step by step, then loop or free at the end', () => {
  const p = prog(3);
  assert.equal(advance(p, 0, 'loop'), 1);
  assert.equal(advance(p, 1, 'loop'), 2);
  assert.equal(advance(p, 2, 'loop'), 0, 'loop: back to the first step');
  assert.equal(advance(p, 2, 'free'), 3, 'free: past the end');
  assert.equal(currentStep(p, 3), null, 'past the end there is no step, so no limit');
  assert.equal(advance(p, 3, 'free'), 3);
  assert.equal(advance(p, 3, 'loop'), 0);
  assert.equal(advance(null, 5), 0);
  assert.equal(advance(prog(0), 0), 0);
});

test('back: one step back, never before the first, and from the end to the last step', () => {
  const p = prog(3);
  assert.equal(back(p, 2), 1);
  assert.equal(back(p, 0), 0);
  assert.equal(back(p, 3), 2);
});

test('stepAfter: the step the "Next:" line shows', () => {
  const p = prog(3);
  assert.equal(stepAfter(p, 0, 'loop').name, 'S2');
  assert.equal(stepAfter(p, 2, 'loop').name, 'S1');
  assert.equal(stepAfter(p, 2, 'free'), null);
  assert.equal(stepAfter(p, 3, 'loop').name, 'S1');
  assert.equal(stepAfter(null, 0), null);
});

test('clampIndex keeps the index inside the program, also after steps were removed', () => {
  const p = prog(3);
  assert.equal(clampIndex(p, 99), 3);
  assert.equal(clampIndex(p, -4), 0);
  assert.equal(clampIndex(p, 1.9), 1);
  assert.equal(clampIndex(p, NaN), 0);
  assert.equal(clampIndex(null, 4), 0);
  assert.equal(currentStep(p, 1).name, 'S2');
});

test('stepText: name, limit as mm:ss, or "free"', () => {
  assert.equal(stepText({ name: 'News', sec: 60 }), 'News · 01:00');
  assert.equal(stepText({ name: 'Chat', sec: 0 }, 'no limit'), 'Chat · no limit');
  assert.equal(stepText({ name: '', sec: 90 }), '01:30');
  assert.equal(stepText({ name: 'Long', sec: 3725 }), 'Long · 1:02:05');
  assert.equal(stepText(null), '');
});
