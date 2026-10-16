// garage-common: trigger 2
// Keyboard shortcuts for the trigger module. Pure code: the accelerator syntax is Electron's, so the same string is
// used for the global shortcut (main process) and for the key pressed while the window has the focus.

const MODS = ['Ctrl', 'Alt', 'Shift', 'Meta']; // canonical order in a stored string

const NAMED = {
  Space: 'Space', Enter: 'Return', NumpadEnter: 'Return', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace',
  Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Minus: '-', Equal: '=', Comma: ',',
  Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`', BracketLeft: '[', BracketRight: ']',
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
  MediaPlayPause: 'MediaPlayPause', MediaStop: 'MediaStop', MediaTrackNext: 'MediaNextTrack', MediaTrackPrevious: 'MediaPreviousTrack',
  PrintScreen: 'PrintScreen', ScrollLock: 'Scrolllock', Pause: 'Pause'
};

// KeyboardEvent.code -> the key part of an accelerator, or null for keys that cannot be one (modifiers alone, unknown).
export function keyFromCode(code) {
  const c = String(code || '');
  if (NAMED[c]) return NAMED[c];
  let m = /^Key([A-Z])$/.exec(c);
  if (m) return m[1];
  m = /^Digit([0-9])$/.exec(c);
  if (m) return m[1];
  m = /^F([1-9]|1[0-9]|2[0-4])$/.exec(c);
  if (m) return `F${m[1]}`;
  m = /^Numpad([0-9])$/.exec(c);
  if (m) return `num${m[1]}`;
  return null;
}

// KeyboardEvent-like { code, ctrlKey, altKey, shiftKey, metaKey } -> "Ctrl+Shift+M", or null while only modifiers are down.
export function acceleratorFromEvent(e) {
  const key = keyFromCode(e?.code);
  if (!key) return null;
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta'].filter(Boolean);
  return [...mods, key].join('+');
}

const KEY_TOKENS = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''), ...Object.values(NAMED),
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`), ...Array.from({ length: 10 }, (_, i) => `num${i}`)
]);

// -> canonical string ("ctrl+m" becomes "Ctrl+M") or null when it is not a valid accelerator.
export function normalizeAccelerator(text) {
  const parts = String(text || '').split('+').map((s) => s.trim());
  if (parts.length < 1 || parts.length > 5 || parts.some((p) => !p)) {
    // a literal "+" key cannot be told from the separator: not supported, the user picks another key
    return null;
  }
  const key = parts.pop();
  const found = new Set();
  for (const p of parts) {
    const mod = { ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift', meta: 'Meta', cmd: 'Meta', command: 'Meta', super: 'Meta' }[p.toLowerCase()];
    if (!mod) return null;
    found.add(mod);
  }
  const k = [...KEY_TOKENS].find((t) => t.toLowerCase() === key.toLowerCase());
  if (!k) return null;
  return [...MODS.filter((m) => found.has(m)), k].join('+');
}

// Electron's own spelling of a canonical string ("Meta" is Cmd on macOS, the Windows key elsewhere).
export const toElectron = (accel) => String(accel).replace(/\bCtrl\b/, 'Control');

// A plain letter, digit, Space or Enter as a global shortcut would steal normal typing everywhere: global shortcuts
// need a modifier, or be an F key, a numpad key or a media key. Others work only with the window in front.
export function globalAllowed(accel) {
  const n = normalizeAccelerator(accel);
  if (!n) return false;
  const parts = n.split('+');
  const key = parts.pop();
  return parts.length > 0 || /^F\d+$/.test(key) || /^num/.test(key) || /^Media/.test(key) || key === 'PrintScreen' || key === 'Pause' || key === 'Scrolllock';
}

// Which action a pressed accelerator means. mode as in midi.js; `reset`, `next`, `prev` and `restart` always.
// -> 'toggle'|'start'|'stop'|'reset'|'next'|'prev'|'restart'|null
export function resolveKey(mode, keys, accel) {
  const a = normalizeAccelerator(accel);
  if (!a || !keys) return null;
  const same = (name) => keys[name] && normalizeAccelerator(keys[name]) === a;
  if (same('reset')) return 'reset';
  for (const name of ['next', 'prev', 'restart']) if (same(name)) return name;
  if (mode === 'toggle') return same('toggle') ? 'toggle' : null;
  if (same('start')) return 'start';
  if (same('stop')) return 'stop';
  return null;
}
