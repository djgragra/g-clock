// Settings → MicTime: the switch, the timer, programs with time limits, colours and the signals (MIDI, keys, audio level).
// Same options as the MicTime app. Built with the same small helpers as the other pages of the settings panel.
import { bindingLabel, acceleratorFromEvent, globalAllowed } from '../../src/trigger/index.js';

const GC = window.GC;
const { h } = GC;
const t = (k, p) => GC.t(k, p);

let keyCapture = null; // { name, fn, timer }
let learning = ''; // binding name being learned
let confirmDelete = false;
const meter = { fill: null, mark: null, text: null, pending: null };

const S = () => GC.state.settings.talk;
const save = (patch) => GC.settingsUI.save({ talk: patch }, true);
const redraw = () => GC.settingsUI.render();

// ---- small builders ----
const row = (label, control, hint) => h('div', { class: 'field' }, h('div', { class: 'field-label', text: label }), h('div', { class: 'field-control' }, control, hint ? h('div', { class: 'hint', text: hint }) : null));
const check = (label, value, onchange) => {
  const input = h('input', { type: 'checkbox', checked: !!value });
  input.addEventListener('change', () => onchange(input.checked));
  return h('label', { class: 'switch' }, input, h('span', { class: 'switch-track' }), label ? h('span', { class: 'switch-text', text: label }) : null);
};
const select = (options, value, onchange) => {
  const el = h('select', {}, options.map(([v, l]) => h('option', { value: v, text: l, selected: v === value })));
  el.addEventListener('change', () => onchange(el.value));
  return el;
};
const number = (value, min, max, step, onchange) => {
  const el = h('input', { type: 'number', value, min, max, step, class: 'num' });
  el.addEventListener('change', () => { const n = Number(el.value); if (Number.isFinite(n)) onchange(Math.min(max, Math.max(min, n))); });
  return el;
};
const sub = (title) => h('h2', { class: 'sub', text: title });
const btn = (key, onclick, extra = {}) => h('button', { class: 'btn small', type: 'button', text: t(key), onclick, ...extra });

// ---- timer ----
function timerBlock() {
  const s = S();
  return [
    sub(t('talk.subTimer')),
    row(t('talk.gen.mode'), select([['toggle', t('talk.gen.modeToggle')], ['separate', t('talk.gen.modeSeparate')]], s.mode, (v) => save({ mode: v })), t('talk.gen.modeHint')),
    row(t('talk.gen.holdForever'), check('', s.holdForever, (v) => save({ holdForever: v })), t('talk.gen.holdForeverHint')),
    row(t('talk.gen.hold'), Object.assign(number(s.holdSeconds, 1, 600, 1, (n) => save({ holdSeconds: n })), { disabled: s.holdForever }), t('talk.gen.holdHint')),
    row(t('talk.gen.debounce'), number(s.debounceMs, 0, 2000, 50, (n) => save({ debounceMs: n })), t('talk.gen.debounceHint'))
  ];
}

// ---- signals ----
const NAMES = (mode) => [...(mode === 'separate' ? ['start', 'stop'] : ['toggle']), 'reset', 'next', 'prev', 'restart'];
const nameLabel = (n) => t(`talk.sig.name.${n}`);

function midiBlock() {
  const s = S();
  const sig = GC.talk.signals;
  const status = sig.midi.error ? t({ unsupported: 'talk.midi.unsupported', failed: 'talk.midi.failed' }[sig.midi.error] || 'talk.midi.denied') : !sig.midi.inputs.length ? t('talk.midi.noInputs') : t('talk.midi.inputsFound', { n: sig.midi.inputs.length });
  const inputs = [['', t('talk.midi.allInputs')], ...[...new Set(sig.midi.inputs)].map((n) => [n, n])];
  if (s.midi.input && !inputs.some(([v]) => v === s.midi.input)) inputs.push([s.midi.input, `${s.midi.input} (${t('talk.midi.missing')})`]);
  const rows = NAMES(s.mode).map((name) => {
    const b = s.midi.bindings[name];
    const isLearning = learning === name && sig.midi.learn;
    return h('div', { class: 'bind' },
      h('div', { class: 'bind-name', text: nameLabel(name) }),
      h('div', { class: 'bind-val' + (b ? '' : ' empty'), text: isLearning ? t('talk.midi.listening') : b ? bindingLabel(b, t('talk.midi.anyChannel')) : t('talk.midi.unassigned') }),
      isLearning
        ? btn('talk.midi.cancel', () => { sig.stopLearn(); learning = ''; redraw(); })
        : btn('talk.midi.learn', () => { learning = name; sig.startLearn(name, (nb) => { learning = ''; save({ midi: { bindings: { [name]: { ...nb } } } }); }); redraw(); }),
      b ? h('select', { class: 'ch', title: t('talk.midi.channel'), onchange: (e) => save({ midi: { bindings: { [name]: { ...b, channel: Number(e.target.value) } } } }) },
        [h('option', { value: 0, text: t('talk.midi.anyChannel'), selected: b.channel === 0 }), ...Array.from({ length: 16 }, (_, i) => h('option', { value: i + 1, text: `ch ${i + 1}`, selected: b.channel === i + 1 }))]) : h('span'),
      b ? btn('talk.common.clear', () => save({ midi: { bindings: { [name]: null } } })) : h('span')
    );
  });
  const mon = sig.midi.monitor.slice(0, 12).map((m) => h('tr', {},
    h('td', { text: new Date(m.t).toLocaleTimeString(GC.state.locale, { hour12: false }) }),
    m.raw !== undefined
      ? [h('td', { text: t('talk.midi.raw') }), h('td', { text: '' }), h('td', { text: '' }), h('td', { text: m.raw }), h('td', { class: 'act', text: '' })]
      : [h('td', { text: m.msg.type === 'note' ? 'Note' : m.msg.type === 'cc' ? 'CC' : 'PC' }),
        h('td', { text: String(m.msg.channel) }),
        h('td', { text: String(m.msg.number) }),
        h('td', { text: m.msg.type === 'pc' ? '–' : String(m.msg.value) }),
        h('td', { class: 'act', text: m.action ? t(`talk.act.${m.action}`) : '' })]));
  return h('div', { class: 'talk-card' },
    h('h3', { text: 'MIDI' }),
    check(t('talk.midi.enable'), s.midi.enabled, (v) => save({ midi: { enabled: v } })),
    row(t('talk.midi.input'), h('div', { class: 'inline-row' }, select(inputs, s.midi.input, (v) => save({ midi: { input: v } })), btn('talk.midi.refresh', () => { sig.refreshMidi(); redraw(); })), status),
    h('p', { class: 'hint', text: t(s.mode === 'separate' ? 'talk.midi.helpSeparate' : 'talk.midi.helpToggle') }),
    h('p', { class: 'hint', text: t('talk.midi.helpProgram') }),
    ...rows,
    h('div', { class: 'monitor' }, h('div', { class: 'monitor-title', text: t('talk.midi.monitor') }),
      check(t('talk.midi.showAll'), sig.midi.showRaw, (v) => { sig.midi.showRaw = v; redraw(); }),
      mon.length ? h('table', {}, h('thead', {}, h('tr', {}, ['colTime', 'colType', 'colCh', 'colNum', 'colVal', 'colAction'].map((k) => h('th', { text: t(`talk.midi.${k}`) })))), h('tbody', {}, mon)) : h('div', { class: 'hint', text: t('talk.midi.monitorEmpty') })),
    h('div', { class: 'ports' }, h('div', { class: 'monitor-title', text: t('talk.midi.ports') }),
      sig.midi.ports.length
        ? h('table', {}, h('thead', {}, h('tr', {}, ['colName', 'colState', 'colConn'].map((k) => h('th', { text: t(`talk.midi.${k}`) })))),
          h('tbody', {}, sig.midi.ports.map((p) => h('tr', {}, h('td', { text: p.name }), h('td', { text: String(p.state) }), h('td', { text: String(p.connection) })))))
        : h('div', { class: 'hint', text: t('talk.midi.noInputs') }),
      h('p', { class: 'hint', text: t('talk.midi.portsHint') })),
    h('p', { class: 'hint', text: t('talk.specHint') }),
    btn('talk.midi.openSpec', () => window.api.links.open('https://github.com/djgragra/mictime/blob/main/docs/MIDI-SPEC.md'))
  );
}

function stopKeyCapture() {
  if (!keyCapture) return;
  clearTimeout(keyCapture.timer);
  document.removeEventListener('keydown', keyCapture.fn, true);
  keyCapture = null;
  GC.talk.signals.setCapturing(false);
  window.api.keys.capture(false);
}

function startKeyCapture(name) {
  stopKeyCapture();
  GC.talk.signals.setCapturing(true);
  window.api.keys.capture(true); // the system shortcuts are released while the new key is chosen
  const fn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) { stopKeyCapture(); redraw(); return; }
    const accel = acceleratorFromEvent(e);
    if (!accel) return; // only a modifier so far
    stopKeyCapture();
    save({ key: { keys: { [name]: accel } } });
  };
  document.addEventListener('keydown', fn, true);
  keyCapture = { name, fn, timer: setTimeout(() => { stopKeyCapture(); redraw(); }, 15000) };
}

function keyBlock() {
  const s = S();
  const rows = NAMES(s.mode).map((name) => {
    const accel = s.key.keys[name];
    const capturing = keyCapture?.name === name;
    const dup = accel && Object.entries(s.key.keys).some(([n, a]) => n !== name && a === accel && NAMES(s.mode).includes(n));
    let status = '';
    if (accel && s.key.global) status = GC.state.keyStatus.failed.includes(accel) ? t('talk.key.refused') : !globalAllowed(accel) ? t('talk.key.windowOnly') : GC.state.keyStatus.global[accel] ? t('talk.key.isGlobal') : '';
    return h('div', { class: 'bind' },
      h('div', { class: 'bind-name', text: nameLabel(name) }),
      h('div', { class: 'bind-val' + (accel ? '' : ' empty'), text: capturing ? t('talk.key.press') : accel || t('talk.midi.unassigned') }),
      capturing ? btn('talk.midi.cancel', () => { stopKeyCapture(); redraw(); }) : btn('talk.key.set', () => { startKeyCapture(name); redraw(); }),
      accel ? btn('talk.common.clear', () => save({ key: { keys: { [name]: '' } } })) : h('span'),
      h('span'),
      h('div', { class: 'bind-note' + (dup || (accel && s.key.global && (GC.state.keyStatus.failed.includes(accel) || !globalAllowed(accel))) ? ' warn' : ''), text: dup ? t('talk.key.duplicate') : status })
    );
  });
  return h('div', { class: 'talk-card' },
    h('h3', { text: t('talk.key.title') }),
    check(t('talk.key.enable'), s.key.enabled, (v) => save({ key: { enabled: v } })),
    check(t('talk.key.global'), s.key.global, (v) => save({ key: { global: v } })),
    h('p', { class: 'hint', text: t('talk.key.globalHint') }),
    ...rows,
    h('p', { class: 'hint', text: t('talk.key.limits') })
  );
}

function audioBlock() {
  const s = S();
  const a = GC.talk.signals.audio;
  const devices = [['', t('talk.audio.default')], ...a.devices.filter((d) => d.id && d.id !== 'default').map((d) => [d.id, d.label || t('talk.audio.unnamed')])];
  if (s.audio.device && !devices.some(([v]) => v === s.audio.device)) devices.push([s.audio.device, `${s.audio.deviceLabel || s.audio.device} (${t('talk.midi.missing')})`]);
  const statusKey = { off: 'stOff', starting: 'stStarting', listening: 'stListening', denied: 'stDenied', unavailable: 'stUnavailable' }[a.status] || 'stOff';
  const fill = h('div', { class: 'meter-fill' });
  const mark = h('div', { class: 'meter-mark' });
  const text = h('span', { class: 'meter-text' });
  Object.assign(meter, { fill, mark, text, pending: null });
  paintMeter();
  return h('div', { class: 'talk-card' },
    h('h3', { text: t('talk.audio.title') }),
    check(t('talk.audio.enable'), s.audio.enabled, (v) => save({ audio: { enabled: v } })),
    row(t('talk.audio.input'), select(devices, s.audio.device, (v) => { const d = a.devices.find((x) => x.id === v); save({ audio: { device: v, deviceLabel: d?.label || '' } }).then(() => GC.talk.signals.restartAudio()); })),
    row(t('talk.audio.threshold'), h('div', { class: 'inline-row' }, h('input', { type: 'range', min: -80, max: -5, step: 1, value: s.audio.thresholdDb, oninput: (e) => { meter.pending = Number(e.target.value); paintMeter(); }, onchange: (e) => save({ audio: { thresholdDb: Number(e.target.value) } }) }), h('span', { class: 'mono', text: `${s.audio.thresholdDb} dB` })), t('talk.audio.thresholdHint')),
    row(t('talk.audio.hold'), number(s.audio.holdMs / 1000, 0.2, 60, 0.1, (n) => save({ audio: { holdMs: Math.round(n * 1000) } })), t('talk.audio.holdHint')),
    h('div', { class: 'field' }, h('div', { class: 'field-label' }), h('div', { class: 'field-control' }, h('div', { class: 'meter' }, fill, mark), text)),
    h('div', { class: 'msg ' + (a.status === 'listening' ? 'ok' : a.status === 'denied' || a.status === 'unavailable' ? 'err' : ''), text: t(`talk.audio.${statusKey}`) }),
    h('p', { class: 'hint', text: t('talk.audio.privacy') })
  );
}

function paintMeter() {
  if (!meter.fill?.isConnected) return;
  const a = GC.talk.signals.audio;
  const pct = (db) => Math.max(0, Math.min(100, ((db + 80) / 80) * 100));
  meter.fill.style.width = `${pct(a.db)}%`;
  meter.fill.classList.toggle('open', a.open);
  meter.mark.style.left = `${pct(meter.pending ?? S().audio.thresholdDb)}%`;
  meter.text.textContent = a.status === 'listening' ? `${Math.round(Math.max(-80, a.db))} dB` : '';
}

// ---- programs, limits, colours ----
const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const defaultHex = () => (document.documentElement.dataset.theme === 'light'
  ? { normal: '#111827', warn: '#a16207', over: '#c2260c', idle: '#a9b4c8' }
  : { normal: '#ffffff', warn: '#facc15', over: '#ff4d3a', idle: '#3d5070' });

function programBlock() {
  const s = S();
  const progs = s.programs;
  const cur = progs.find((p) => p.id === s.activeProgram) || null;
  const edit = (fn) => { const all = structuredClone(S().programs); const p = all.find((x) => x.id === S().activeProgram); if (p) fn(p); return save({ programs: all }); };
  const options = [['', t('talk.prog.none')], ...progs.map((p) => [p.id, p.name])];
  const hex = defaultHex();
  const colorRows = ['normal', 'warn', 'over', 'idle'].map((k) => {
    const sample = h('span', { class: 'swatch', text: '01:30' });
    sample.style.color = s.colors[k] || hex[k];
    return h('div', { class: 'color-row' },
      h('div', { text: t(`talk.col.${k}`) }),
      h('input', { type: 'color', value: s.colors[k] || hex[k], title: t(`talk.col.${k}`), onchange: (e) => save({ colors: { [k]: e.target.value } }) }),
      btn('talk.col.default', () => save({ colors: { [k]: '' } }), { disabled: !s.colors[k] }),
      sample);
  });
  return [
    sub(t('talk.subProgram')),
    h('p', { class: 'hint', text: t('talk.prog.intro') }),
    row(t('talk.prog.active'), h('div', { class: 'inline-row' },
      select(options, s.activeProgram, (v) => { confirmDelete = false; save({ activeProgram: v }); }),
      btn('talk.prog.new', () => { const id = newId(); save({ programs: [...structuredClone(progs), { id, name: t('talk.prog.defaultName', { n: progs.length + 1 }), steps: [{ name: t('talk.prog.defaultStep', { n: 1 }), sec: 60 }] }], activeProgram: id }); }, { disabled: progs.length >= 8 }),
      cur ? btn(confirmDelete ? 'talk.prog.deleteSure' : 'talk.prog.delete', () => { if (!confirmDelete) { confirmDelete = true; redraw(); return; } confirmDelete = false; save({ programs: structuredClone(progs).filter((p) => p.id !== cur.id), activeProgram: '' }); }) : null)),
    row(t('talk.prog.endLabel'), select([['loop', t('talk.prog.endLoop')], ['free', t('talk.prog.endFree')]], s.programEnd, (v) => save({ programEnd: v })), t('talk.prog.endHint')),
    cur ? row(t('talk.prog.name'), (() => { const el = h('input', { type: 'text', value: cur.name, maxLength: 60 }); el.addEventListener('change', () => edit((p) => { p.name = el.value.trim() || p.name; })); return el; })()) : null,
    cur ? stepsEditor(cur, edit) : h('p', { class: 'hint', text: t('talk.prog.noneHint') }),
    sub(t('talk.col.title')),
    h('p', { class: 'hint', text: t('talk.col.intro') }),
    row(t('talk.lim.single'), h('div', { class: 'inline-row' },
      h('input', { type: 'number', class: 'num', min: 0, max: 600, step: 1, value: Math.floor(s.limitSeconds / 60), title: t('talk.prog.minutes'), 'aria-label': t('talk.prog.minutes'), onchange: (e) => save({ limitSeconds: Math.max(0, Math.round(Number(e.target.value)) || 0) * 60 + (S().limitSeconds % 60) }) }),
      h('span', { class: 'mono', text: ':' }),
      h('input', { type: 'number', class: 'num', min: 0, max: 59, step: 1, value: s.limitSeconds % 60, title: t('talk.prog.seconds'), 'aria-label': t('talk.prog.seconds'), onchange: (e) => save({ limitSeconds: Math.floor(S().limitSeconds / 60) * 60 + Math.min(59, Math.max(0, Math.round(Number(e.target.value)) || 0)) }) }),
      h('span', { class: 'hint', text: t('talk.lim.minSec') })), t('talk.lim.singleHint')),
    row(t('talk.col.warnSec'), number(s.warnSeconds, 0, 3600, 1, (n) => save({ warnSeconds: n })), t('talk.col.warnSecHint')),
    row(t('talk.col.flashSec'), number(s.flashSeconds, 0, 3600, 1, (n) => save({ flashSeconds: n })), t('talk.col.flashSecHint')),
    ...colorRows,
    h('p', { class: 'hint', text: t('talk.col.hint') })
  ];
}

function stepsEditor(cur, edit) {
  const idx = GC.talk.program.index();
  const wrap = h('div', { class: 'steps' });
  wrap.append(h('div', { class: 'step-row head' }, h('span'), h('span', { text: t('talk.prog.stepName') }), h('span', { text: t('talk.prog.minutes') }), h('span', { text: t('talk.prog.seconds') }), h('span'), h('span'), h('span')));
  cur.steps.forEach((st, i) => {
    const mins = Math.floor(st.sec / 60);
    const secs = st.sec % 60;
    const setTime = (m, sec) => edit((p) => { p.steps[i].sec = Math.max(0, Math.min(36000, m * 60 + sec)); });
    wrap.append(h('div', { class: 'step-row' + (i === idx ? ' current' : '') },
      h('span', { class: 'idx', text: String(i + 1) }),
      h('input', { type: 'text', value: st.name, maxLength: 60, placeholder: t('talk.prog.stepName'), 'aria-label': t('talk.prog.stepName'), onchange: (e) => edit((p) => { p.steps[i].name = e.target.value.trim(); }) }),
      h('input', { type: 'number', min: 0, max: 600, step: 1, value: mins, title: t('talk.prog.minutes'), 'aria-label': t('talk.prog.minutes'), onchange: (e) => setTime(Math.max(0, Math.round(Number(e.target.value)) || 0), secs) }),
      h('input', { type: 'number', min: 0, max: 59, step: 1, value: secs, title: t('talk.prog.seconds'), 'aria-label': t('talk.prog.seconds'), onchange: (e) => setTime(mins, Math.min(59, Math.max(0, Math.round(Number(e.target.value)) || 0))) }),
      h('button', { class: 'btn small', type: 'button', text: '↑', title: t('talk.prog.up'), disabled: i === 0, onclick: () => edit((p) => { [p.steps[i - 1], p.steps[i]] = [p.steps[i], p.steps[i - 1]]; }) }),
      h('button', { class: 'btn small', type: 'button', text: '↓', title: t('talk.prog.down'), disabled: i === cur.steps.length - 1, onclick: () => edit((p) => { [p.steps[i + 1], p.steps[i]] = [p.steps[i], p.steps[i + 1]]; }) }),
      h('button', { class: 'btn small', type: 'button', text: '✕', title: t('talk.prog.remove'), onclick: () => edit((p) => { p.steps.splice(i, 1); }) })));
  });
  wrap.append(
    h('div', { class: 'btn-row' },
      btn('talk.prog.addStep', () => edit((p) => { p.steps.push({ name: t('talk.prog.defaultStep', { n: p.steps.length + 1 }), sec: 60 }); }), { disabled: cur.steps.length >= 40 }),
      btn('talk.prog.prev', () => GC.talk.action('prev', 'settings')), btn('talk.prog.next', () => GC.talk.action('next', 'settings')), btn('talk.prog.restart', () => GC.talk.action('restart', 'settings'))),
    h('p', { class: 'hint', text: t('talk.prog.stepsHint') }));
  return wrap;
}

// ---- the page ----
function build() {
  const s = S();
  const parts = [
    h('h2', { text: t('talk.sec') }),
    h('p', { class: 'intro', text: t('talk.intro') }),
    row(t('talk.enable'), check('', s.enabled, (v) => save({ enabled: v })), t('talk.enableHint'))
  ];
  if (s.enabled) {
    parts.push(...timerBlock(), ...programBlock(), sub(t('talk.subSignals')), midiBlock(), keyBlock(), audioBlock(), h('p', { class: 'hint', text: t('talk.privacy') }));
  }
  return h('section', {}, ...parts);
}

function close() {
  stopKeyCapture();
  GC.talk?.signals?.stopLearn();
  learning = '';
}

GC.talkSettings = {
  build,
  close,
  save: (patch) => GC.settingsUI.save(patch, false),
  // called when MIDI messages arrive, the audio level changes or the key status changes while the page is open
  refresh(levelOnly) {
    if (!GC.settingsUI?.isOpen() || GC.settingsUI.current() !== 'talk' || !S().enabled) return;
    if (levelOnly) return paintMeter();
    if (document.activeElement && document.activeElement.matches?.('input, select, textarea')) return;
    redraw();
  }
};
