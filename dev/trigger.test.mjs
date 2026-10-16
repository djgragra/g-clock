import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage, learnBinding, matches, resolveMidi, bindingLabel, normalizeBinding, noteName, BINDING_NAMES, EXTRA_ACTIONS } from '../src/trigger/midi.js';
import { acceleratorFromEvent, normalizeAccelerator, globalAllowed, resolveKey, toElectron } from '../src/trigger/keys.js';
import { createGate, rmsDb } from '../src/trigger/level.js';
import { createStopwatch, formatDuration } from '../src/trigger/stopwatch.js';

// ---- MIDI -------------------------------------------------------------------------------------------------
test('parseMessage: note on/off, cc, program change; value > 0 is on, 0 is off', () => {
  assert.deepEqual(parseMessage([0x90, 60, 100]), { type: 'note', channel: 1, number: 60, value: 100, on: true });
  assert.equal(parseMessage([0x90, 60, 0]).on, false); // note on with velocity 0 = off
  assert.equal(parseMessage([0x83, 60, 64]).on, false); // note off, channel 4
  assert.equal(parseMessage([0x83, 60, 64]).channel, 4);
  assert.deepEqual(parseMessage([0xb1, 20, 127]), { type: 'cc', channel: 2, number: 20, value: 127, on: true });
  assert.equal(parseMessage([0xb1, 20, 0]).on, false);
  assert.deepEqual(parseMessage([0xcf, 5]), { type: 'pc', channel: 16, number: 5, value: 127, on: true });
});

test('parseMessage ignores clock, active sensing, sysex, pitch bend and malformed bytes', () => {
  for (const bytes of [[0xf8], [0xfe], [0xf0, 1, 0xf7], [0xe0, 0, 64], [0xd0, 10], [0x90, 200, 1], [0x90], null, [], [0x20, 1, 1]]) {
    assert.equal(parseMessage(bytes), null, JSON.stringify(bytes));
  }
});

test('MIDI learn takes note on, cc and program change; not a released note', () => {
  assert.deepEqual(learnBinding(parseMessage([0x90, 36, 90])), { type: 'note', channel: 1, number: 36 });
  assert.equal(learnBinding(parseMessage([0x80, 36, 0])), null);
  assert.equal(learnBinding(parseMessage([0x90, 36, 0])), null);
  assert.deepEqual(learnBinding(parseMessage([0xb2, 7, 0])), { type: 'cc', channel: 3, number: 7 });
  assert.deepEqual(learnBinding(parseMessage([0xc0, 0])), { type: 'pc', channel: 1, number: 0 });
  assert.equal(learnBinding(null), null);
});

test('matches: channel 0 = any channel; type and number must agree', () => {
  const m = parseMessage([0x93, 60, 100]);
  assert.ok(matches({ type: 'note', channel: 0, number: 60 }, m));
  assert.ok(matches({ type: 'note', channel: 4, number: 60 }, m));
  assert.ok(!matches({ type: 'note', channel: 1, number: 60 }, m));
  assert.ok(!matches({ type: 'cc', channel: 4, number: 60 }, m));
  assert.ok(!matches({ type: 'note', channel: 4, number: 61 }, m));
  assert.ok(!matches(null, m));
});

test('normalizeBinding rejects what is out of range', () => {
  assert.equal(normalizeBinding({ type: 'note', channel: 17, number: 1 }), null);
  assert.equal(normalizeBinding({ type: 'note', channel: 1, number: 128 }), null);
  assert.equal(normalizeBinding({ type: 'sysex', channel: 1, number: 1 }), null);
  assert.equal(normalizeBinding('x'), null);
  assert.deepEqual(normalizeBinding({ type: 'cc', number: '20' }), { type: 'cc', channel: 0, number: 20 });
});

test('toggle mode: the same message starts and stops; the off half does nothing', () => {
  const b = { toggle: { type: 'note', channel: 1, number: 60 } };
  assert.equal(resolveMidi('toggle', b, parseMessage([0x90, 60, 100])).action, 'toggle');
  assert.equal(resolveMidi('toggle', b, parseMessage([0x90, 60, 0])), null);
  assert.equal(resolveMidi('toggle', b, parseMessage([0x80, 60, 0])), null);
  assert.equal(resolveMidi('toggle', b, parseMessage([0x90, 61, 100])), null);
});

test('separate mode: start and stop are different messages', () => {
  const b = { start: { type: 'note', channel: 1, number: 60 }, stop: { type: 'note', channel: 1, number: 61 } };
  assert.equal(resolveMidi('separate', b, parseMessage([0x90, 60, 1])).action, 'start');
  assert.equal(resolveMidi('separate', b, parseMessage([0x90, 61, 1])).action, 'stop');
  assert.equal(resolveMidi('separate', b, parseMessage([0x90, 60, 0])), null);
  assert.equal(resolveMidi('separate', { ...b, toggle: b.start }, parseMessage([0x90, 60, 1])).action, 'start'); // toggle ignored here
});

test('separate mode, same message for start and stop: value > 0 starts, 0 stops (gate)', () => {
  const m = { type: 'cc', channel: 1, number: 20 };
  const b = { start: m, stop: m };
  assert.equal(resolveMidi('separate', b, parseMessage([0xb0, 20, 127])).action, 'start');
  assert.equal(resolveMidi('separate', b, parseMessage([0xb0, 20, 0])).action, 'stop');
  const n = { type: 'note', channel: 1, number: 5 };
  assert.equal(resolveMidi('separate', { start: n, stop: n }, parseMessage([0x80, 5, 0])).action, 'stop');
});

test('reset works in both modes and only on "on"', () => {
  const b = { toggle: { type: 'note', channel: 1, number: 60 }, reset: { type: 'pc', channel: 0, number: 9 } };
  assert.equal(resolveMidi('toggle', b, parseMessage([0xc5, 9])).action, 'reset');
  assert.equal(resolveMidi('separate', b, parseMessage([0xc5, 9])).action, 'reset');
  assert.equal(resolveMidi('toggle', { reset: { type: 'cc', channel: 1, number: 1 } }, parseMessage([0xb0, 1, 0])), null);
});

test('bindingLabel and noteName', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(0), 'C-1');
  assert.equal(bindingLabel({ type: 'note', channel: 1, number: 60 }), 'Note C4 (60) · ch 1');
  assert.equal(bindingLabel({ type: 'cc', channel: 0, number: 20 }), 'CC 20 · any channel');
  assert.equal(bindingLabel({ type: 'pc', channel: 2, number: 5 }, 'qualsiasi'), 'Program 5 · ch 2');
  assert.equal(bindingLabel(null), '');
});

// ---- keys -------------------------------------------------------------------------------------------------
test('acceleratorFromEvent builds the canonical string', () => {
  const ev = (code, o = {}) => ({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...o });
  assert.equal(acceleratorFromEvent(ev('KeyM', { ctrlKey: true, shiftKey: true })), 'Ctrl+Shift+M');
  assert.equal(acceleratorFromEvent(ev('F9')), 'F9');
  assert.equal(acceleratorFromEvent(ev('Numpad0')), 'num0');
  assert.equal(acceleratorFromEvent(ev('Digit5', { altKey: true, metaKey: true })), 'Alt+Meta+5');
  assert.equal(acceleratorFromEvent(ev('Space')), 'Space');
  assert.equal(acceleratorFromEvent(ev('ShiftLeft', { shiftKey: true })), null); // a modifier alone
});

test('normalizeAccelerator accepts valid ones in any case and rejects the rest', () => {
  assert.equal(normalizeAccelerator('ctrl+shift+m'), 'Ctrl+Shift+M');
  assert.equal(normalizeAccelerator('shift+ctrl+f9'), 'Ctrl+Shift+F9');
  assert.equal(normalizeAccelerator('Cmd+Space'), 'Meta+Space');
  for (const bad of ['', 'Ctrl', 'Ctrl+', 'Foo+M', 'Ctrl+Shift+Nope', null, 'M+N', 'Ctrl++']) assert.equal(normalizeAccelerator(bad), null, String(bad));
});

test('globalAllowed: a modifier, an F key, numpad or media key; not a bare letter', () => {
  assert.ok(globalAllowed('Ctrl+Alt+M'));
  assert.ok(globalAllowed('F9'));
  assert.ok(globalAllowed('num0'));
  assert.ok(globalAllowed('MediaPlayPause'));
  assert.ok(!globalAllowed('M'));
  assert.ok(!globalAllowed('Space'));
  assert.ok(!globalAllowed('nonsense'));
  assert.equal(toElectron('Ctrl+Shift+M'), 'Control+Shift+M');
});

test('resolveKey follows the mode', () => {
  const keys = { toggle: 'F9', start: 'F10', stop: 'F11', reset: 'F12' };
  assert.equal(resolveKey('toggle', keys, 'F9'), 'toggle');
  assert.equal(resolveKey('toggle', keys, 'F10'), null);
  assert.equal(resolveKey('separate', keys, 'F10'), 'start');
  assert.equal(resolveKey('separate', keys, 'F11'), 'stop');
  assert.equal(resolveKey('separate', keys, 'f12'), 'reset');
  assert.equal(resolveKey('separate', keys, 'F9'), null);
  assert.equal(resolveKey('separate', {}, 'F9'), null);
});

// ---- audio gate -------------------------------------------------------------------------------------------
test('rmsDb: full scale sine-ish, half scale and silence', () => {
  assert.ok(Math.abs(rmsDb([1, -1, 1, -1])) < 1e-9);
  assert.ok(Math.abs(rmsDb([0.5, -0.5]) - -6.0206) < 0.001);
  assert.equal(rmsDb([0, 0, 0]), -100);
  assert.equal(rmsDb([]), -100);
});

test('gate: opens at the threshold, closes only after the hold time below it', () => {
  const g = createGate({ thresholdDb: -40, holdMs: 1000 });
  assert.equal(g.feed(-60, 0), null);
  assert.equal(g.feed(-30, 100), 'on');
  assert.equal(g.feed(-20, 200), null); // already open
  assert.equal(g.feed(-50, 300), null); // below, hold starts
  assert.equal(g.feed(-50, 1200), null); // 900 ms: not yet
  assert.equal(g.feed(-30, 1250), null); // back above: hold restarts
  assert.equal(g.feed(-50, 1300), null);
  assert.equal(g.feed(-50, 2299), null);
  assert.equal(g.feed(-50, 2300), 'off');
  assert.equal(g.isOpen(), false);
  assert.equal(g.feed(-50, 2400), null);
  assert.equal(g.feed(-40, 2500), 'on'); // the threshold itself opens it
});

// ---- the timer --------------------------------------------------------------------------------------------
test('toggle: first signal starts, next stops, total stays, then back to zero', () => {
  const sw = createStopwatch({ holdMs: 5000, debounceMs: 0 });
  assert.deepEqual(sw.snapshot(0), { phase: 'idle', ms: 0 });
  assert.equal(sw.signal('toggle', 1000).accepted, true);
  assert.deepEqual(sw.snapshot(4500), { phase: 'running', ms: 3500 });
  assert.equal(sw.signal('toggle', 11000).phase, 'holding');
  assert.deepEqual(sw.snapshot(12000), { phase: 'holding', ms: 10000, holdLeftMs: 4000 });
  assert.deepEqual(sw.snapshot(15999), { phase: 'holding', ms: 10000, holdLeftMs: 1 });
  assert.deepEqual(sw.snapshot(16000), { phase: 'idle', ms: 0 });
  assert.deepEqual(sw.snapshot(99999), { phase: 'idle', ms: 0 });
});

test('a new signal while the total is shown starts a new count', () => {
  const sw = createStopwatch({ holdMs: 5000, debounceMs: 0 });
  sw.signal('start', 0);
  sw.signal('stop', 2000);
  assert.equal(sw.signal('toggle', 3000).phase, 'running');
  assert.deepEqual(sw.snapshot(4000), { phase: 'running', ms: 1000 });
});

test('separate: start while running and stop while idle or holding do nothing', () => {
  const sw = createStopwatch({ debounceMs: 0 });
  assert.equal(sw.signal('stop', 0).accepted, false);
  sw.signal('start', 100);
  assert.equal(sw.signal('start', 900).accepted, false);
  assert.deepEqual(sw.snapshot(1100), { phase: 'running', ms: 1000 }); // not restarted
  sw.signal('stop', 1100);
  assert.equal(sw.signal('stop', 1200).accepted, false);
  assert.equal(sw.snapshot(1300).ms, 1000);
});

test('debounce: a second signal right after the first is ignored, reset is not', () => {
  const sw = createStopwatch({ debounceMs: 300 });
  assert.equal(sw.signal('toggle', 1000).accepted, true);
  const dup = sw.signal('toggle', 1100);
  assert.equal(dup.accepted, false);
  assert.equal(dup.debounced, true);
  assert.equal(sw.signal('toggle', 1400).accepted, true); // 400 ms later is a real stop
  assert.equal(sw.signal('reset', 1450).accepted, true);
});

test('reset returns to zero at once from any phase', () => {
  const sw = createStopwatch({ debounceMs: 0 });
  sw.signal('start', 0);
  sw.signal('reset', 500);
  assert.deepEqual(sw.snapshot(600), { phase: 'idle', ms: 0 });
  sw.signal('start', 700);
  sw.signal('stop', 900);
  sw.signal('reset', 1000);
  assert.deepEqual(sw.snapshot(1000), { phase: 'idle', ms: 0 });
  assert.equal(sw.signal('reset', 1100).accepted, false); // nothing to reset
});

test('configure changes the hold time for the next stop', () => {
  const sw = createStopwatch({ holdMs: 1000, debounceMs: 0 });
  sw.configure({ holdMs: 2000 });
  sw.signal('start', 0);
  sw.signal('stop', 100);
  assert.equal(sw.snapshot(2000).phase, 'holding');
  assert.equal(sw.snapshot(2100).phase, 'idle');
});

test('formatDuration', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(999), '00:00');
  assert.equal(formatDuration(65_432), '01:05');
  assert.equal(formatDuration(3_599_999), '59:59');
  assert.equal(formatDuration(3_661_000), '1:01:01');
  assert.equal(formatDuration(-5), '00:00');
});

// ---- version 2: steps of a program, hold forever ------------------------------------------------------------
test('next, prev and restart act on "on" only, in both modes, and come before start/stop', () => {
  assert.deepEqual(EXTRA_ACTIONS, ['next', 'prev', 'restart']);
  assert.ok(BINDING_NAMES.includes('toggle') && BINDING_NAMES.includes('restart'));
  const note = (n) => ({ type: 'note', channel: 1, number: n });
  const b = { toggle: note(60), start: note(60), stop: note(61), next: { type: 'cc', channel: 0, number: 30 }, prev: { type: 'cc', channel: 0, number: 31 }, restart: { type: 'pc', channel: 0, number: 2 } };
  for (const mode of ['toggle', 'separate']) {
    assert.equal(resolveMidi(mode, b, parseMessage([0xb0, 30, 127])).action, 'next');
    assert.equal(resolveMidi(mode, b, parseMessage([0xb2, 31, 1])).action, 'prev');
    assert.equal(resolveMidi(mode, b, parseMessage([0xc3, 2])).action, 'restart');
    assert.equal(resolveMidi(mode, b, parseMessage([0xb0, 30, 0])), null);
  }
  const keys = { toggle: 'F9', next: 'F5', prev: 'F6', restart: 'F7', reset: 'F8' };
  assert.equal(resolveKey('toggle', keys, 'F5'), 'next');
  assert.equal(resolveKey('separate', keys, 'f6'), 'prev');
  assert.equal(resolveKey('toggle', keys, 'F7'), 'restart');
  assert.equal(resolveKey('toggle', keys, 'F9'), 'toggle');
});

test('hold forever: with an infinite hold time the total stays until the next start or a reset', () => {
  const sw = createStopwatch({ holdMs: Infinity, debounceMs: 0 });
  sw.signal('start', 0);
  sw.signal('stop', 4000);
  assert.deepEqual(sw.snapshot(10 * 3600_000), { phase: 'holding', ms: 4000, holdLeftMs: Infinity });
  assert.equal(sw.signal('start', 10 * 3600_000 + 1).phase, 'running');
  sw.signal('stop', 10 * 3600_000 + 2000);
  assert.equal(sw.signal('reset', 10 * 3600_000 + 3000).phase, 'idle');
  const sw2 = createStopwatch({ holdMs: 1000, debounceMs: 0 });
  sw2.configure({ holdMs: Infinity });
  sw2.signal('start', 0);
  sw2.signal('stop', 100);
  assert.equal(sw2.snapshot(999999).phase, 'holding');
  sw2.configure({ holdMs: 500 });
  sw2.signal('start', 1_000_000);
  sw2.signal('stop', 1_000_100);
  assert.equal(sw2.snapshot(1_000_700).phase, 'idle');
});
