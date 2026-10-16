// garage-common: trigger 2
// MIDI input for the trigger module: parse a raw message, describe it, learn a binding from it and decide which
// action a message means. Pure code (no Electron, no Web MIDI), so MicTime and G-Clock share it and it is unit tested.
//
// The rule for every message type is the one published in docs/MIDI-SPEC.md:
//   value > 0 = on, value 0 = off.  Note On with velocity 0 and Note Off both count as "off";
//   Program Change has no value and always counts as "on".

export const TYPES = ['note', 'cc', 'pc'];
export const ACTIONS = ['toggle', 'start', 'stop', 'reset'];
// Actions for a sequence of steps (a program): they act on the app, not on the timer. Like reset they fire on "on" only.
export const EXTRA_ACTIONS = ['next', 'prev', 'restart'];
export const BINDING_NAMES = [...ACTIONS, ...EXTRA_ACTIONS];

// -> { type: 'note'|'cc'|'pc', channel: 1-16, number: 0-127, value: 0-127, on: boolean } or null for anything else
// (system messages, clock, active sensing, pitch bend, aftertouch, malformed bytes).
export function parseMessage(bytes) {
  if (!bytes || bytes.length < 2) return null;
  const [status, d1, d2 = 0] = bytes;
  if (!(status >= 0x80 && status <= 0xef) || d1 > 127 || d2 > 127) return null;
  const kind = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (kind === 0x90 && bytes.length >= 3) return { type: 'note', channel, number: d1, value: d2, on: d2 > 0 };
  if (kind === 0x80 && bytes.length >= 3) return { type: 'note', channel, number: d1, value: 0, on: false };
  if (kind === 0xb0 && bytes.length >= 3) return { type: 'cc', channel, number: d1, value: d2, on: d2 > 0 };
  if (kind === 0xc0) return { type: 'pc', channel, number: d1, value: 127, on: true };
  return null;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// 60 -> "C4" (middle C = C4; some devices call it C3: the number is what matters)
export const noteName = (n) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

// A binding is { type, channel (0 = any, 1-16), number } or null. Anything else becomes null.
export function normalizeBinding(b) {
  if (!b || typeof b !== 'object' || !TYPES.includes(b.type)) return null;
  const number = Number(b.number);
  const channel = Number(b.channel ?? 0);
  if (!Number.isInteger(number) || number < 0 || number > 127) return null;
  if (!Number.isInteger(channel) || channel < 0 || channel > 16) return null;
  return { type: b.type, channel, number };
}

// Text for a binding: "Note C4 (60) · ch 1", "CC 20 · any channel", "Program 5 · ch 2".
export function bindingLabel(b, anyChannel = 'any channel') {
  const n = normalizeBinding(b);
  if (!n) return '';
  const what = n.type === 'note' ? `Note ${noteName(n.number)} (${n.number})` : n.type === 'cc' ? `CC ${n.number}` : `Program ${n.number}`;
  return `${what} · ${n.channel ? `ch ${n.channel}` : anyChannel}`;
}

export const sameBinding = (a, b) => !!a && !!b && a.type === b.type && a.number === b.number && a.channel === b.channel;

// "MIDI learn": the binding a message would create, or null when it is not a good candidate (a note released, a
// controller that is not a message the user can repeat). The channel is the message's own; the user may set "any".
export function learnBinding(msg) {
  if (!msg) return null;
  if (msg.type === 'note' && !msg.on) return null;
  return { type: msg.type, channel: msg.channel, number: msg.number };
}

export function matches(binding, msg) {
  const b = normalizeBinding(binding);
  return !!b && !!msg && b.type === msg.type && b.number === msg.number && (b.channel === 0 || b.channel === msg.channel);
}

// What a message means, given the mode and the bindings. -> { action, name } or null.
//   mode 'toggle':   `toggle` fires on "on" only; `reset`, `next`, `prev` and `restart` fire on "on" only, in both modes.
//   mode 'separate': `start` and `stop` fire on "on" only; if start and stop are the SAME message, "on" starts and
//                    "off" stops (a gate: a mic fader, a note held while the mic is open).
// Note Off / value 0 never fires anything else, so a button that sends on and off does not act twice.
export function resolveMidi(mode, bindings, msg) {
  if (!msg || !bindings) return null;
  const hit = (name) => matches(bindings[name], msg);
  if (hit('reset') && msg.on) return { action: 'reset', name: 'reset' };
  for (const name of EXTRA_ACTIONS) if (hit(name) && msg.on) return { action: name, name };
  if (mode === 'toggle') return hit('toggle') && msg.on ? { action: 'toggle', name: 'toggle' } : null;
  const start = hit('start');
  const stop = hit('stop');
  if (start && stop && sameBinding(normalizeBinding(bindings.start), normalizeBinding(bindings.stop))) {
    return { action: msg.on ? 'start' : 'stop', name: 'start' };
  }
  if (start && msg.on) return { action: 'start', name: 'start' };
  if (stop && msg.on) return { action: 'stop', name: 'stop' };
  return null;
}
