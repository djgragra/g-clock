// MicTime: the MicTime timer inside G-Clock. A signal (MIDI, a key, an audio level) starts the count, the next one stops
// it, the total stays on screen for a few seconds and the timer returns to zero. Off until it is switched on in Settings →
// MicTime. The timer itself (src/trigger/stopwatch.js) is plain logic; this file draws it. Same behaviour as the app.
import { createStopwatch, formatDuration } from '../../src/trigger/stopwatch.js';
import { limitState, clampIndex, currentStep, advance, back, stepAfter, stepText } from '../../src/limits.js';
import { createSignals } from './talk-signals.js';

const GC = window.GC;
const { $ } = GC;

const sw = createStopwatch();
const now = () => performance.now();
let talk = null; // the "talk" part of the settings
let lastPhase = '';
let lastText = '';
let lastLimitClass = '';
let lastStepKey = '';
let programIndex = null; // { programId: index }, remembered by the main process; read once from the first payload
let finished = null; // { step } while the total of the last speech is on screen: it is shown in that step's colour
let lastStepSignalAt = -Infinity;
let signals = null;

const program = () => (talk ? talk.programs.find((p) => p.id === talk.activeProgram) || null : null);
const indexOf = (p) => clampIndex(p, programIndex?.[p?.id] ?? 0);
const setIndex = (p, i) => {
  if (!p) return;
  programIndex[p.id] = i;
  window.api.talk.setProgramIndex(p.id, i);
};
// The step being timed: the current step of the active program, or, with no program, the single limit of the settings.
const activeStep = () => {
  const p = program();
  if (p) return currentStep(p, indexOf(p));
  return talk.limitSeconds > 0 ? { name: '', sec: talk.limitSeconds } : null;
};

// What the inputs see: nothing is listened to while MicTime is off.
const view = () => ({
  ...talk,
  midi: { ...talk.midi, enabled: talk.enabled && talk.midi.enabled },
  key: { ...talk.key, enabled: talk.enabled && talk.key.enabled },
  audio: { ...talk.audio, enabled: talk.enabled && talk.audio.enabled }
});

function onAction(action, source) {
  if (!talk?.enabled) return;
  const t = now();
  if (action === 'next' || action === 'prev' || action === 'restart') {
    // a console that sends two messages for one press must not skip a step
    if (t - lastStepSignalAt < talk.debounceMs) return;
    lastStepSignalAt = t;
    const p = program();
    if (!p) return;
    const i = indexOf(p);
    setIndex(p, action === 'restart' ? 0 : action === 'prev' ? back(p, i) : advance(p, i, talk.programEnd));
    window.api.app.log('info', `talk program ${action} via ${source}`);
    lastStepKey = '';
    draw();
    GC.talkSettings?.refresh();
    return;
  }
  const before = sw.snapshot(t).phase;
  const res = sw.signal(action, t);
  if (res.accepted) {
    window.api.app.log('info', `talk signal ${action} via ${source}`);
    const p = program();
    if (before === 'running' && res.phase === 'holding') {
      // the speech ended: remember its step for the colour of the total, and arm the next step
      finished = { step: activeStep() };
      if (p) setIndex(p, advance(p, indexOf(p), talk.programEnd));
    } else if (res.phase === 'running' || res.phase === 'idle') {
      finished = null;
    }
  }
  lastStepKey = '';
  draw();
}

// ---- drawing ----
function draw() {
  const on = !!talk?.enabled;
  const rec = document.body.classList.contains('mode-rec');
  $('talkPanel').hidden = !on || rec;
  $('talkChip').hidden = !on || !rec;
  document.body.classList.toggle('talk-on', on);
  if (!on) return;
  const snap = sw.snapshot(now());
  const text = formatDuration(snap.ms);
  if (text !== lastText) {
    $('talkDigits').textContent = text;
    $('talkChipDigits').textContent = text;
    lastText = text;
  }
  if (snap.phase === 'idle' && finished) finished = null; // the total went away by itself
  // the limit of the step being timed: while the total is shown it is the step that just ended
  const step = snap.phase === 'holding' ? finished?.step : activeStep();
  const state = snap.phase === 'idle' ? 'none' : limitState(snap.ms, step?.sec || 0, { warnSec: talk.warnSeconds, flashSec: talk.flashSeconds });
  const limitClass = `talk-lim-${state === 'flash' && snap.phase !== 'running' ? 'over' : state}`; // it never blinks while the total is shown
  if (limitClass !== lastLimitClass) {
    document.body.className = document.body.className.replace(/\btalk-lim-\w+/g, '').trim() + ` ${limitClass}`;
    lastLimitClass = limitClass;
  }
  if (snap.phase !== lastPhase) {
    lastPhase = snap.phase;
    document.body.className = document.body.className.replace(/\btalk-ph-\w+/g, '').trim() + ` talk-ph-${snap.phase}`;
    $('talkState').textContent = GC.t(`talk.phase.${snap.phase}`);
    $('talkChipState').textContent = GC.t('talk.label');
  }
  drawSteps(snap.phase, step);
  const hold = talk.holdSeconds * 1000;
  $('talkHold').style.width = snap.phase === 'holding' && Number.isFinite(snap.holdLeftMs) ? `${Math.max(0, Math.min(100, (snap.holdLeftMs / hold) * 100))}%` : '0%';
}

// the lines next to the figures: the step on screen, and the one after it
function drawSteps(phase, shown) {
  const p = program();
  const i = p ? indexOf(p) : 0;
  const key = `${phase}|${p?.id}|${i}|${shown?.name}|${shown?.sec}|${finished ? 1 : 0}|${GC.state.lang}|${talk.limitSeconds}`;
  if (key === lastStepKey) return;
  lastStepKey = key;
  const free = GC.t('talk.prog.free');
  let label = '';
  let next = '';
  if (p) {
    const ended = i >= p.steps.length;
    if (phase === 'holding' && finished?.step) {
      label = stepText(finished.step, free);
      const upcoming = currentStep(p, i);
      next = upcoming ? GC.t('talk.prog.nextStep', { s: stepText(upcoming, free) }) : GC.t('talk.prog.end');
    } else if (ended) {
      label = GC.t('talk.prog.end');
    } else {
      label = GC.t('talk.prog.step', { i: i + 1, n: p.steps.length }) + ' · ' + stepText(shown, free);
      const after = stepAfter(p, i, talk.programEnd);
      next = after ? GC.t('talk.prog.nextStep', { s: stepText(after, free) }) : GC.t('talk.prog.end');
    }
  }
  if (!p && talk.limitSeconds > 0) next = GC.t('talk.prog.limitOnly', { s: formatDuration(talk.limitSeconds * 1000) });
  $('talkStep').textContent = label;
  $('talkNext').textContent = next;
  for (const id of ['talkPrev', 'talkNextBtn', 'talkRestart']) $(id).disabled = !p;
}

// ---- pills: what each input is doing (small, under the figures) ----
function drawPills() {
  if (!talk?.enabled || !signals) return;
  const sig = signals;
  const pill = (cls, label, text) => GC.h('span', { class: `tpill ${cls}`, title: `${label}: ${text}` }, GC.h('span', { class: 'tpill-dot' }), GC.h('span', { text: label }));
  const flash = performance.now() - sig.midi.flashAt < 400;
  let midi;
  if (!talk.midi.enabled) midi = pill('off', 'MIDI', GC.t('talk.sig.off'));
  else if (sig.midi.error) midi = pill('bad', 'MIDI', GC.t('talk.sig.noAccess'));
  else if (!sig.midi.inputs.length) midi = pill('warn', 'MIDI', GC.t('talk.sig.noInput'));
  else midi = pill(flash ? 'hot' : 'ok', 'MIDI', GC.t('talk.sig.ready'));
  const anyKey = Object.values(talk.key.keys).some(Boolean);
  const failed = GC.state.keyStatus?.failed?.length;
  const key = !talk.key.enabled || !anyKey ? pill('off', GC.t('talk.pill.key'), GC.t(anyKey ? 'talk.sig.off' : 'talk.sig.none'))
    : pill(failed ? 'warn' : 'ok', GC.t('talk.pill.key'), GC.t(failed ? 'talk.sig.localOnly' : talk.key.global ? 'talk.sig.global' : 'talk.sig.window'));
  const a = sig.audio;
  const audio = !talk.audio.enabled ? pill('off', GC.t('talk.pill.audio'), GC.t('talk.sig.off'))
    : a.status === 'listening' ? pill(a.open ? 'hot' : 'ok', GC.t('talk.pill.audio'), GC.t('talk.sig.ready'))
    : pill('bad', GC.t('talk.pill.audio'), GC.t(a.status === 'denied' ? 'talk.sig.denied' : 'talk.sig.noInput'));
  $('talkPills').replaceChildren(midi, key, audio);
  const anySignal = Object.values(talk.midi.bindings).some(Boolean) || anyKey || talk.audio.enabled;
  $('talkHint').hidden = anySignal;
}

let pillsQueued = false;
function onSignalsChange(levelOnly) {
  GC.talkSettings?.refresh(levelOnly);
  if (levelOnly && pillsQueued) return;
  pillsQueued = true;
  setTimeout(() => { pillsQueued = false; drawPills(); }, levelOnly ? 250 : 0);
}

function fillProgramSelect() {
  const sel = $('talkProgram');
  sel.replaceChildren(
    GC.h('option', { value: '', text: GC.t('talk.prog.none'), selected: !talk.activeProgram }),
    ...talk.programs.map((p) => GC.h('option', { value: p.id, text: p.name, selected: p.id === talk.activeProgram }))
  );
  $('talkProgramWrap').hidden = !talk.programs.length;
}

// ---- settings applied (called by app.js every time the settings change) ----
function configure(settings, payload) {
  talk = settings.talk;
  if (programIndex === null) programIndex = { ...(payload?.talkProgramIndex || GC.state.talkProgramIndex || {}) };
  const root = document.documentElement;
  for (const k of ['normal', 'warn', 'over', 'idle']) {
    if (talk.colors[k]) root.style.setProperty(`--t-${k}`, talk.colors[k]);
    else root.style.removeProperty(`--t-${k}`);
  }
  sw.configure({ holdMs: talk.holdForever ? Infinity : talk.holdSeconds * 1000, debounceMs: talk.debounceMs });
  fillProgramSelect();
  const separate = talk.mode === 'separate';
  $('talkStop').hidden = !separate;
  $('talkStart').textContent = GC.t(separate ? 'talk.ctl.start' : 'talk.ctl.toggle');
  $('talkChip').title = GC.t('talk.chipTitle');
  $('talkHint').textContent = GC.t('talk.hint.noSignal');
  lastStepKey = '';
  lastPhase = '';
  signals.reconfigure();
  if (!talk.enabled) {
    // switched off: forget a count in progress
    sw.signal('reset', now());
    finished = null;
  }
  draw();
  drawPills();
}

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  signals = createSignals({ getSettings: () => (talk ? view() : { midi: { enabled: false, bindings: {} }, key: { enabled: false, keys: {} }, audio: { enabled: false }, mode: 'toggle' }), onAction, onChange: onSignalsChange });
  GC.talk.signals = signals;
  $('talkStart').addEventListener('click', () => onAction(talk.mode === 'separate' ? 'start' : 'toggle', 'button'));
  $('talkStop').addEventListener('click', () => onAction('stop', 'button'));
  $('talkReset').addEventListener('click', () => onAction('reset', 'button'));
  $('talkPrev').addEventListener('click', () => onAction('prev', 'button'));
  $('talkNextBtn').addEventListener('click', () => onAction('next', 'button'));
  $('talkRestart').addEventListener('click', () => onAction('restart', 'button'));
  $('talkChip').addEventListener('click', () => onAction(talk.mode === 'separate' ? (sw.snapshot(now()).phase === 'running' ? 'stop' : 'start') : 'toggle', 'button'));
  $('talkProgram').addEventListener('change', (e) => GC.talkSettings.save({ talk: { activeProgram: e.target.value } }));
  window.api.on.signal((d) => {
    if (!talk?.enabled || !talk.key.enabled || d?.source !== 'key') return;
    signals.onGlobalSignal(d);
  });
  window.api.on.keyStatus((st) => { GC.state.keyStatus = st; drawPills(); GC.talkSettings?.refresh(); });
  setInterval(draw, 100);
  setInterval(() => { if (signals.midi.flashAt && performance.now() - signals.midi.flashAt < 600) drawPills(); }, 400);
  GC.talk.ready = true;
}

GC.talk = {
  configure(settings, payload) {
    if (!booted) boot();
    configure(settings, payload);
  },
  isBusy: () => !!talk?.enabled && sw.snapshot(now()).phase === 'running',
  action: onAction,
  program: { current: program, index: () => indexOf(program()) },
  redraw: () => { lastLimitClass = ''; lastStepKey = ''; draw(); }
};

// the settings may already be there when this module has loaded (modules run after the classic scripts)
if (GC.state?.settings?.talk && $('talkPanel')) GC.talk.configure(GC.state.settings, GC.state);
