// The inputs that start and stop the talk timer: MIDI, keys, audio level. Each one ends in the same call, onAction(action, source).
// The decisions (what a message means, debounce, the gate) are in src/trigger and are unit tested; this file only
// connects them to the browser APIs (Web MIDI, key events, Web Audio). Same code as the MicTime app.
import { parseMessage, learnBinding, resolveMidi, acceleratorFromEvent, resolveKey, createGate, rmsDb } from '../../src/trigger/index.js';

const GC = window.GC;

export function createSignals({ getSettings, onAction, onChange }) {
  // ---- MIDI ----
  const midi = { access: null, error: '', inputs: [], ports: [], monitor: [], showRaw: false, flashAt: 0, learn: null, learnTimer: null };
  // the monitor can be fed hundreds of messages a second (a fader, a clock): the screen is redrawn at most every 150 ms
  let redrawQueued = false;
  const redrawSoon = () => {
    if (redrawQueued) return;
    redrawQueued = true;
    setTimeout(() => { redrawQueued = false; onChange(); }, 150);
  };

  function attachMidi() {
    if (!midi.access) return;
    const s = getSettings().midi;
    const all = [...midi.access.inputs.values()];
    midi.inputs = all.map((i) => i.name || 'MIDI input');
    midi.ports = all.map((i) => ({ name: i.name || 'MIDI input', state: i.state, connection: i.connection })); // for the diagnostic list in Settings
    for (const input of all) {
      input.onmidimessage = s.enabled && (!s.input || s.input === input.name) ? onMidiMessage : null;
    }
    onChange();
  }

  async function startMidi() {
    if (midi.access || !navigator.requestMIDIAccess) {
      if (!navigator.requestMIDIAccess) midi.error = 'unsupported';
      return;
    }
    try {
      midi.access = await navigator.requestMIDIAccess({ sysex: false });
      midi.error = '';
      midi.access.onstatechange = () => attachMidi();
      window.api.app.log('info', `MIDI access granted, ${midi.access.inputs.size} input(s)`);
    } catch (err) {
      midi.error = err?.name === 'NotAllowedError' ? 'denied' : 'failed';
      window.api.app.log('warn', `MIDI access not available (${err?.name || 'error'})`);
    }
    attachMidi();
  }

  function onMidiMessage(ev) {
    const msg = parseMessage(ev.data);
    if (!msg) {
      // clock, active sensing, sysex…: only listed when "show all messages" is on (a diagnostic aid)
      if (midi.showRaw && ev.data?.length) {
        midi.monitor.unshift({ t: Date.now(), raw: Array.from(ev.data.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join(' ') });
        if (midi.monitor.length > 30) midi.monitor.length = 30;
        redrawSoon();
      }
      return;
    }
    midi.flashAt = performance.now();
    if (midi.learn) {
      const b = learnBinding(msg);
      if (!b) return;
      const done = midi.learn;
      stopLearn();
      done.cb(b);
      return;
    }
    const s = getSettings();
    const hit = s.midi.enabled ? resolveMidi(s.mode, s.midi.bindings, msg) : null;
    midi.monitor.unshift({ t: Date.now(), msg, action: hit?.action || '' });
    if (midi.monitor.length > 30) midi.monitor.length = 30;
    redrawSoon();
    if (hit) onAction(hit.action, 'midi');
  }

  function startLearn(name, cb, ms = 15000) {
    stopLearn();
    midi.learn = { name, cb };
    midi.learnTimer = setTimeout(() => { stopLearn(); onChange(); }, ms);
    onChange();
  }
  function stopLearn() {
    clearTimeout(midi.learnTimer);
    midi.learn = null;
    onChange();
  }

  // ---- keys pressed with the window in front (a key the system registered globally is handled by the main process) ----
  let capturing = false;
  document.addEventListener('keydown', (e) => {
    if (capturing || e.repeat) return;
    const tag = (e.target?.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const s = getSettings();
    if (!s.key.enabled) return;
    const accel = acceleratorFromEvent(e);
    if (!accel || GC.state.keyStatus?.global?.[accel]) return;
    const action = resolveKey(s.mode, s.key.keys, accel);
    if (action) {
      e.preventDefault();
      onAction(action, 'key');
    }
  });
  const setCapturing = (on) => { capturing = !!on; };

  // a shortcut registered with the system was pressed
  function onGlobalSignal(data) {
    const s = getSettings();
    if (!s.key.enabled || data?.source !== 'key') return;
    const action = resolveKey(s.mode, s.key.keys, data.accel);
    if (action) onAction(action, 'key');
  }

  // ---- audio level ----
  const audio = { status: 'off', db: -100, open: false, devices: [], stream: null, ctx: null, timer: null, gate: createGate() };

  async function listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      audio.devices = all.filter((d) => d.kind === 'audioinput').map((d) => ({ id: d.deviceId, label: d.label }));
    } catch {
      audio.devices = [];
    }
    onChange();
  }

  async function stopAudio(status = 'off') {
    clearInterval(audio.timer);
    audio.timer = null;
    audio.stream?.getTracks().forEach((t) => t.stop());
    audio.stream = null;
    if (audio.ctx) await audio.ctx.close().catch(() => {});
    audio.ctx = null;
    audio.gate.reset();
    audio.open = false;
    audio.db = -100;
    audio.status = status;
    onChange();
  }

  // Only the level is read: the analyser is never connected to an output and no sample is stored or sent anywhere.
  async function startAudio() {
    const s = getSettings().audio;
    await stopAudio('starting');
    await listDevices();
    audio.gate = createGate({ thresholdDb: s.thresholdDb, holdMs: s.holdMs });
    try {
      const wanted = audio.devices.find((d) => d.id === s.device) || audio.devices.find((d) => s.deviceLabel && d.label === s.deviceLabel);
      audio.stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...(wanted ? { deviceId: { exact: wanted.id } } : {}), echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (err) {
      window.api.app.log('warn', `audio input not available (${err?.name || 'error'})`);
      await stopAudio(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      return;
    }
    audio.ctx = new AudioContext();
    const source = audio.ctx.createMediaStreamSource(audio.stream);
    const analyser = audio.ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser); // no connection to ctx.destination: nothing is played, nothing is recorded
    const block = new Float32Array(analyser.fftSize);
    audio.status = 'listening';
    audio.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(block);
      audio.db = rmsDb(block);
      const change = audio.gate.feed(audio.db, performance.now());
      audio.open = audio.gate.isOpen();
      if (change) onAction(change === 'on' ? 'start' : 'stop', 'audio');
      onChange(true);
    }, 50);
    await listDevices(); // labels are only available once the permission is granted
    window.api.app.log('info', 'audio level input started');
  }

  // ---- apply the settings ----
  async function reconfigure() {
    const s = getSettings();
    attachMidi();
    if (s.midi.enabled) startMidi();
    audio.gate.configure({ thresholdDb: s.audio.thresholdDb, holdMs: s.audio.holdMs });
    if (!s.audio.enabled && audio.status !== 'off') await stopAudio('off');
    else if (s.audio.enabled && (audio.status === 'off' || audio.status === 'unavailable' || audio.status === 'denied') && !audio.timer && !audio._busy) {
      audio._busy = true;
      try { await startAudio(); } finally { audio._busy = false; }
    }
  }

  async function restartAudio() {
    if (!getSettings().audio.enabled) return;
    audio._busy = true;
    try { await startAudio(); } finally { audio._busy = false; }
  }

  return {
    midi, audio, handleMidi: onMidiMessage, reconfigure, restartAudio, startLearn, stopLearn, setCapturing, onGlobalSignal, listDevices,
    refreshMidi: attachMidi
  };
}
