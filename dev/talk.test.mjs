import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, sanitizeSettings } from '../src/schema.js';
import { defaultsTalk, sanitizeTalk, sanitizeTalkPrograms } from '../src/talk.js';
import { buildBackup, prepareImport, applyImport } from '../src/backup.js';

// MicTime is the MicTime timer inside G-Clock: same options, same limits, off until switched on
test('defaults: MicTime is OFF, nothing assigned, no program, hold 5 s, warning 10 s, blink 10 s', () => {
  const d = defaultsTalk();
  assert.equal(d.enabled, false);
  assert.equal(d.mode, 'toggle');
  assert.equal(d.holdSeconds, 5);
  assert.equal(d.holdForever, false);
  assert.equal(d.limitSeconds, 0);
  assert.equal(d.debounceMs, 300);
  assert.equal(d.warnSeconds, 10);
  assert.equal(d.flashSeconds, 10);
  assert.deepEqual(d.programs, []);
  assert.equal(d.programEnd, 'loop');
  assert.deepEqual(d.colors, { normal: '', warn: '', over: '', idle: '' });
  assert.equal(d.audio.enabled, false, 'the microphone is never on by default');
  for (const n of ['toggle', 'start', 'stop', 'reset', 'next', 'prev', 'restart']) {
    assert.equal(d.midi.bindings[n], null, n);
    assert.equal(d.key.keys[n], '', n);
  }
  assert.deepEqual(sanitizeTalk(d), d);
  assert.equal(defaults().talk.enabled, false);
  assert.deepEqual(sanitizeSettings(defaults()).talk, d);
});

test('an older settings file without "talk" or "theme" gets the defaults', () => {
  const old = defaults();
  delete old.talk;
  delete old.theme;
  const s = sanitizeSettings(old, defaults());
  assert.equal(s.talk.enabled, false);
  assert.equal(s.theme, 'dark');
});

test('values are clamped and a patch keeps the other values', () => {
  assert.equal(sanitizeTalk({ holdSeconds: 0 }).holdSeconds, 1);
  assert.equal(sanitizeTalk({ holdSeconds: 99999 }).holdSeconds, 600);
  assert.equal(sanitizeTalk({ debounceMs: -5 }).debounceMs, 0);
  assert.equal(sanitizeTalk({ limitSeconds: 90 }).limitSeconds, 90);
  assert.equal(sanitizeTalk({ limitSeconds: 99_999_999 }).limitSeconds, 36000);
  assert.equal(sanitizeTalk({ limitSeconds: 'x' }).limitSeconds, 0);
  assert.equal(sanitizeTalk({ mode: 'weird' }).mode, 'toggle');
  assert.equal(sanitizeTalk({ enabled: 'yes' }).enabled, false);
  const base = sanitizeTalk({ enabled: true, limitSeconds: 60, holdSeconds: 9, audio: { enabled: true, thresholdDb: -30 } });
  const next = sanitizeTalk({ holdSeconds: 3 }, base);
  assert.equal(next.enabled, true);
  assert.equal(next.limitSeconds, 60);
  assert.equal(next.audio.enabled, true);
  assert.equal(next.audio.thresholdDb, -30);
  assert.equal(sanitizeTalk({ audio: { holdMs: 5 } }, base).audio.holdMs, 200);
  assert.equal(sanitizeTalk({ audio: { thresholdDb: 10 } }, base).audio.thresholdDb, -5);
});

test('inside the settings, a patch of "talk" only changes what it names', () => {
  const base = sanitizeSettings({ talk: { enabled: true, limitSeconds: 45 } });
  const next = sanitizeSettings({ talk: { colors: { warn: '#ff0000' } } }, base);
  assert.equal(next.talk.enabled, true);
  assert.equal(next.talk.limitSeconds, 45);
  assert.equal(next.talk.colors.warn, '#ff0000');
  assert.equal(sanitizeSettings({ talk: 'x' }, base).talk.enabled, true, 'garbage leaves it as it is');
  assert.equal(sanitizeSettings({ theme: 'light' }, base).theme, 'light');
  assert.equal(sanitizeSettings({ theme: 'pink' }, base).theme, 'dark');
});

test('programs: at most 8 of 40 steps, clean names, limits clamped, ids unique, active must exist', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, steps: [] }));
  assert.equal(sanitizeTalkPrograms(many).length, 8);
  const p = sanitizeTalkPrograms([{ id: 'a', name: '  Morning\u0007 show ', steps: Array.from({ length: 60 }, (_, i) => ({ name: `s${i}`, sec: -5 })) }, { id: 'a', name: '', steps: 'x' }, null, 5]);
  assert.equal(p.length, 2);
  assert.equal(p[0].name, 'Morning  show');
  assert.equal(p[0].steps.length, 40);
  assert.equal(p[0].steps[0].sec, 0);
  assert.notEqual(p[1].id, 'a', 'a repeated id gets a new one');
  assert.equal(p[1].name, 'Program');
  assert.deepEqual(p[1].steps, []);
  assert.equal(sanitizeTalkPrograms([{ id: 'x', name: 'n', steps: [{ name: 'a', sec: 99_999_999 }] }])[0].steps[0].sec, 36000);
  const s = sanitizeTalk({ programs: [{ id: 'a', name: 'A', steps: [] }], activeProgram: 'zzz' });
  assert.equal(s.activeProgram, '');
  const t = sanitizeTalk({ activeProgram: 'a' }, sanitizeTalk({ programs: [{ id: 'a', name: 'A', steps: [] }] }));
  assert.equal(t.activeProgram, 'a');
  assert.equal(sanitizeTalk({ programs: [] }, t).activeProgram, '', 'deleting the active program clears it');
});

test('colours: #rrggbb only (lower case), anything else means the default; warning and blink times are clamped', () => {
  const s = sanitizeTalk({ colors: { normal: '#FFFFFF', warn: 'yellow', over: '#12345', idle: ' #AbCdEf ' }, warnSeconds: -3, flashSeconds: 99999, holdForever: 'yes' });
  assert.deepEqual(s.colors, { normal: '#ffffff', warn: '', over: '', idle: '#abcdef' });
  assert.equal(s.warnSeconds, 0);
  assert.equal(s.flashSeconds, 3600);
  assert.equal(s.holdForever, false);
  assert.equal(sanitizeTalk({ holdForever: true }).holdForever, true);
  assert.equal(sanitizeTalk({ colors: { warn: '#ff0000' } }, sanitizeTalk({ colors: { over: '#00ff00' } })).colors.over, '#00ff00', 'a patch keeps the other colours');
});

test('MIDI and key bindings: all seven signals, checked', () => {
  const s = sanitizeTalk({ midi: { bindings: { next: { type: 'cc', channel: 0, number: 30 }, restart: { type: 'pc', channel: 1, number: 2 }, start: { type: 'bogus' } } }, key: { keys: { next: 'ctrl+alt+right', prev: 'F6', stop: 'not a key at all' } } });
  assert.deepEqual(s.midi.bindings.next, { type: 'cc', channel: 0, number: 30 });
  assert.equal(s.midi.bindings.prev, null);
  assert.equal(s.midi.bindings.start, null);
  assert.equal(s.key.keys.next, 'Ctrl+Alt+Right');
  assert.equal(s.key.keys.prev, 'F6');
  assert.equal(s.key.keys.stop, '');
});

// ---- backup ----
const withTalk = () => sanitizeSettings({
  talk: {
    enabled: true, mode: 'separate', holdForever: true, warnSeconds: 5, flashSeconds: 20, colors: { warn: '#ffaa00' },
    programs: [{ id: 'a', name: 'Morning', steps: [{ name: 'News', sec: 60 }, { name: 'Chat', sec: 0 }] }, { id: 'b', name: 'Evening', steps: [{ name: 'One', sec: 30 }] }],
    activeProgram: 'b', programEnd: 'free',
    midi: { bindings: { start: { type: 'note', channel: 1, number: 60 } } }, key: { keys: { reset: 'F9' } }
  }
});

test('the backup carries MicTime and imports it back; the step a program is at is not part of it', () => {
  const s = withTalk();
  const file = JSON.parse(JSON.stringify(buildBackup(s)));
  assert.equal(file.includesSecrets, false);
  assert.deepEqual(prepareImport(file), s);
  assert.equal(prepareImport(file).talk.activeProgram, 'b');
  assert.ok(!JSON.stringify(file).includes('programIndex'));
});

test('"add only the missing": the talk programs this computer lacks are added, settings stay as they are', () => {
  const current = sanitizeSettings({ talk: { enabled: false, programs: [{ id: 'a', name: 'My morning', steps: [{ name: 'X', sec: 10 }] }], activeProgram: 'a', colors: { over: '#111111' }, warnSeconds: 3 } });
  const merged = applyImport(current, withTalk(), 'add');
  assert.deepEqual(merged.talk.programs.map((p) => p.id), ['a', 'b']);
  assert.equal(merged.talk.programs[0].name, 'My morning', 'same id: this computer keeps its own');
  assert.equal(merged.talk.activeProgram, 'a');
  assert.equal(merged.talk.enabled, false, 'switching it on is not an item to add');
  assert.equal(merged.talk.colors.over, '#111111');
  assert.equal(merged.talk.warnSeconds, 3);
  assert.equal(merged.talk.midi.bindings.start, null);
});

test('replacing everything brings MicTime of the file', () => {
  const merged = applyImport(defaults(), withTalk(), 'replace');
  assert.equal(merged.talk.enabled, true);
  assert.equal(merged.talk.mode, 'separate');
});
