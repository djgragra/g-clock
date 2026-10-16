// MicTime settings (the same timer as the MicTime app). Pure code, unit tested.
// A signal (MIDI, a key or an audio level) starts the count, the next one stops it, the total stays on screen for a few
// seconds and the timer returns to zero. The whole feature is off until the user switches it on in Settings → MicTime.
import { normalizeBinding, BINDING_NAMES } from './trigger/midi.js';
import { normalizeAccelerator } from './trigger/keys.js';

export const TALK_LIMITS = {
  holdSeconds: [1, 600],
  debounceMs: [0, 2000],
  thresholdDb: [-80, -5],
  audioHoldMs: [200, 60000],
  warnSeconds: [0, 3600],
  flashSeconds: [0, 3600],
  stepSeconds: [0, 36000], // 0 = no limit
  limitSeconds: [0, 36000], // the single limit used when no program is active; 0 = no limit
  programs: 8,
  steps: 40,
  programName: 60,
  nameLen: 200
};

export function defaultsTalk() {
  return {
    enabled: false, // MicTime is an option: nothing is listened to and nothing is shown until it is switched on
    mode: 'toggle', // toggle: one signal starts and the next stops | separate: start and stop are different signals
    holdSeconds: 5, // the total stays on screen this long, then back to zero
    holdForever: false, // true: the total stays until the next start or a reset
    limitSeconds: 0, // the time limit when no program is active (a program has a limit for each step); 0 = no limit
    debounceMs: 300, // a second start/stop within this time is taken as the same press
    warnSeconds: 10, // the figures turn to the warning colour this many seconds before the limit
    flashSeconds: 10, // and blink slowly when the limit is passed by this many seconds
    // Colours of the figures: '#rrggbb', or '' for the default.
    colors: { normal: '', warn: '', over: '', idle: '' },
    // Programs: lists of steps { name, sec } (sec 0 = no limit). The active one arms the limit of the current step and
    // moves on after every speech. '' = no program, no limit. At the end: 'loop' (back to the first step) or 'free'.
    programs: [],
    activeProgram: '',
    programEnd: 'loop',
    midi: {
      enabled: true,
      input: '', // name of the input port; '' = all inputs
      bindings: Object.fromEntries(BINDING_NAMES.map((n) => [n, null]))
    },
    key: {
      enabled: true,
      global: true, // works with another program in front (where the system allows it)
      keys: Object.fromEntries(BINDING_NAMES.map((n) => [n, '']))
    },
    audio: {
      enabled: false, // off until the user chooses an input: needs the microphone permission of the system
      device: '', // deviceId of the input; '' = system default
      deviceLabel: '',
      thresholdDb: -40,
      holdMs: 3000 // the level must stay below the threshold this long to stop
    }
  };
}

const clampInt = (v, [lo, hi], fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const text = (v, max = TALK_LIMITS.nameLen) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const hexColor = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : '');

// -> a clean list of programs: at most 8, each with at most 40 steps, ids unique, names and limits checked.
export function sanitizeTalkPrograms(input) {
  const out = [];
  const seen = new Set();
  for (const p of Array.isArray(input) ? input : []) {
    if (!p || typeof p !== 'object' || out.length >= TALK_LIMITS.programs) continue;
    let id = text(p.id, 40);
    if (!id || seen.has(id)) id = `p${out.length + 1}-${Math.random().toString(36).slice(2, 7)}`;
    seen.add(id);
    const steps = (Array.isArray(p.steps) ? p.steps : []).slice(0, TALK_LIMITS.steps).filter((x) => x && typeof x === 'object')
      .map((x) => ({ name: text(x.name, TALK_LIMITS.programName), sec: clampInt(x.sec, TALK_LIMITS.stepSeconds, 0) }));
    out.push({ id, name: text(p.name, TALK_LIMITS.programName) || 'Program', steps });
  }
  return out;
}

// `input` is a whole or partial talk object (a patch, an imported file); `cur` is what is kept where `input` says nothing.
export function sanitizeTalk(input, cur = defaultsTalk()) {
  const i = input && typeof input === 'object' ? input : {};
  const def = defaultsTalk();
  const c = { ...def, ...(cur && typeof cur === 'object' ? cur : {}) };
  const m = { ...def.midi, ...(c.midi || {}), ...(i.midi || {}) };
  const k = { ...def.key, ...(c.key || {}), ...(i.key || {}) };
  const a = { ...def.audio, ...(c.audio || {}), ...(i.audio || {}) };
  const mb = { ...(c.midi?.bindings || {}), ...(i.midi?.bindings || {}) };
  const kk = { ...(c.key?.keys || {}), ...(i.key?.keys || {}) };
  const col = { ...(c.colors || {}), ...(i.colors || {}) };
  const programs = sanitizeTalkPrograms(Object.hasOwn(i, 'programs') ? i.programs : c.programs);
  const active = Object.hasOwn(i, 'activeProgram') ? i.activeProgram : c.activeProgram;
  const pick = (key) => (Object.hasOwn(i, key) ? i[key] : c[key]);
  return {
    enabled: bool(pick('enabled'), false),
    mode: oneOf(pick('mode'), ['toggle', 'separate'], 'toggle'),
    holdSeconds: clampInt(pick('holdSeconds'), TALK_LIMITS.holdSeconds, def.holdSeconds),
    holdForever: bool(pick('holdForever'), false),
    limitSeconds: clampInt(pick('limitSeconds'), TALK_LIMITS.limitSeconds, 0),
    debounceMs: clampInt(pick('debounceMs'), TALK_LIMITS.debounceMs, def.debounceMs),
    warnSeconds: clampInt(pick('warnSeconds'), TALK_LIMITS.warnSeconds, def.warnSeconds),
    flashSeconds: clampInt(pick('flashSeconds'), TALK_LIMITS.flashSeconds, def.flashSeconds),
    colors: { normal: hexColor(col.normal), warn: hexColor(col.warn), over: hexColor(col.over), idle: hexColor(col.idle) },
    programs,
    activeProgram: programs.some((p) => p.id === active) ? active : '',
    programEnd: oneOf(pick('programEnd'), ['loop', 'free'], 'loop'),
    midi: {
      enabled: bool(m.enabled, true),
      input: text(m.input),
      bindings: Object.fromEntries(BINDING_NAMES.map((n) => [n, normalizeBinding(mb[n])]))
    },
    key: {
      enabled: bool(k.enabled, true),
      global: bool(k.global, true),
      keys: Object.fromEntries(BINDING_NAMES.map((n) => [n, normalizeAccelerator(kk[n]) || '']))
    },
    audio: {
      enabled: bool(a.enabled, false),
      device: text(a.device),
      deviceLabel: text(a.deviceLabel),
      thresholdDb: clampInt(a.thresholdDb, TALK_LIMITS.thresholdDb, def.audio.thresholdDb),
      holdMs: clampInt(a.holdMs, TALK_LIMITS.audioHoldMs, def.audio.holdMs)
    }
  };
}
