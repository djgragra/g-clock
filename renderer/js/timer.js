'use strict';

// Recording timer: free countdown, quick times, visual pre-roll 3·2·1.
// Time is taken from Date.now(), so it stays right if the window is busy or the computer sleeps.
GC.timer = (() => {
  const WARN = 60; // seconds left: amber
  const DANGER = 10; // seconds left: red

  let mode = 'idle'; // idle | preroll | running | paused
  let target = 0; // seconds
  let startedAt = 0;
  let pausedElapsed = 0;
  let prerollTimer = null;
  let cfg = { sound: false, preroll: true, presets: [] };
  let beeped = false;
  let audio = null;
  let last = '';

  const $ = GC.$;

  // ---- sound (WebAudio, nothing to download) ----
  function beep(times, freq) {
    if (!cfg.sound) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime;
      for (let i = 0; i < times; i++) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const t = now + i * 0.28;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      }
    } catch {
      /* no audio device: stay silent */
    }
  }

  // ---- state ----
  const elapsed = () => (mode === 'running' ? (Date.now() - startedAt) / 1000 : pausedElapsed);
  const remaining = () => target - elapsed();

  function setTarget(sec) {
    target = Math.max(0, Math.min(99 * 60 + 59, Math.round(sec)));
    $('tMin').value = target ? String(Math.floor(target / 60)) : '';
    $('tSec').value = target ? GC.pad(target % 60) : '';
    render(true);
  }

  function readInputs() {
    const m = Math.max(0, parseInt($('tMin').value, 10) || 0);
    const s = Math.max(0, Math.min(59, parseInt($('tSec').value, 10) || 0));
    target = m * 60 + s;
    render(true);
  }

  function start() {
    if (mode === 'running' || mode === 'preroll') return;
    if (mode === 'paused') return resume();
    readInputs();
    if (target <= 0) {
      flash();
      return;
    }
    beeped = false;
    if (cfg.preroll) runPreroll();
    else begin();
  }

  function begin() {
    mode = 'running';
    startedAt = Date.now();
    pausedElapsed = 0;
    render(true);
  }

  function resume() {
    mode = 'running';
    startedAt = Date.now() - pausedElapsed * 1000;
    render(true);
  }

  function pause() {
    if (mode !== 'running') return;
    pausedElapsed = (Date.now() - startedAt) / 1000;
    mode = 'paused';
    render(true);
  }

  function reset() {
    cancelPreroll();
    mode = 'idle';
    pausedElapsed = 0;
    beeped = false;
    render(true);
  }

  function toggle() {
    if (mode === 'preroll') cancelPreroll();
    else if (mode === 'running') pause();
    else start();
  }

  function flash() {
    for (const id of ['tMin', 'tSec']) {
      $(id).classList.add('err');
      setTimeout(() => $(id).classList.remove('err'), 600);
    }
  }

  // ---- pre-roll ----
  function runPreroll() {
    mode = 'preroll';
    let n = 3;
    const num = $('prerollNum');
    const show = () => {
      num.textContent = n;
      num.classList.remove('pulse');
      void num.offsetWidth; // restart the animation
      num.classList.add('pulse');
    };
    $('preroll').hidden = false;
    show();
    beep(1, 660);
    clearInterval(prerollTimer);
    prerollTimer = setInterval(() => {
      n--;
      if (n > 0) {
        show();
        beep(1, n === 1 ? 990 : 660);
      } else {
        cancelPreroll(false);
        beep(1, 1320);
        begin();
      }
    }, 1000);
    render(true);
  }

  function cancelPreroll(back = true) {
    clearInterval(prerollTimer);
    $('preroll').hidden = true;
    if (back && mode === 'preroll') {
      mode = 'idle';
      render(true);
    }
  }

  // ---- display ----
  function level(rem) {
    if (rem <= 0) return 'over';
    if (rem <= DANGER) return 'danger';
    if (rem <= WARN) return 'warn';
    return 'ok';
  }

  function render(force) {
    const rem = remaining();
    const shown = Math.ceil(rem); // 00:00 lasts until one full second has run over
    const lvl = mode === 'idle' || mode === 'preroll' ? 'idle' : level(shown);
    if (mode === 'running' && shown <= 0 && !beeped) {
      beeped = true;
      beep(3, 880);
    }
    const text = (shown < 0 ? '−' : '') + GC.mmss(Math.abs(shown));
    const key = `${mode}|${lvl}|${text}|${target}`;
    if (!force && key === last) return;
    last = key;

    const display = $('timerDisplay');
    display.textContent = mode === 'idle' && !target ? '00:00' : text;
    display.className = 'timer-display lvl-' + lvl + (mode === 'running' && shown <= 0 ? ' blink' : '');

    let state = 'ready';
    if (mode === 'preroll') state = 'preroll';
    else if (mode === 'paused') state = 'paused';
    else if (mode === 'running') state = shown <= 0 ? 'over' : shown <= DANGER ? 'ending' : 'recording';
    $('timerStateText').textContent = GC.t('timer.state.' + state);
    $('timerState').className = 'timer-state lvl-' + lvl;

    const frac = target > 0 && mode !== 'idle' ? Math.max(0, Math.min(1, rem / target)) : mode === 'idle' && target ? 1 : 0;
    $('timerBarFill').style.width = frac * 100 + '%';
    $('timerBarFill').className = 'timer-bar-fill lvl-' + lvl;
    $('timerElapsed').textContent = mode === 'idle' ? '' : GC.t('timer.elapsed', { e: GC.mmss(Math.max(0, elapsed())), t: GC.mmss(Math.max(0, target)) });

    const running = mode === 'running';
    $('tStart').hidden = running || mode === 'preroll';
    $('tStart').textContent = GC.t(mode === 'paused' ? 'timer.resume' : 'timer.start');
    $('tPause').hidden = !running;
    $('tReset').disabled = mode === 'idle' && !target;
    $('timerSetup').hidden = mode !== 'idle';
    document.body.classList.toggle('timer-running', running);
  }

  function renderPresets() {
    const box = $('timerPresets');
    box.replaceChildren(...cfg.presets.map((sec) => GC.h('button', { class: 'chip', type: 'button', text: GC.mmss(sec), onclick: () => setTarget(sec) })));
  }

  function configure(timer) {
    cfg = timer;
    renderPresets();
    last = '';
    render(true);
  }

  function init() {
    $('tStart').addEventListener('click', start);
    $('tPause').addEventListener('click', pause);
    $('tReset').addEventListener('click', reset);
    for (const id of ['tMin', 'tSec']) {
      const input = $(id);
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '');
        readInputs();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') start();
      });
      input.addEventListener('blur', () => {
        if (id === 'tSec' && input.value) input.value = GC.pad(Math.min(59, Number(input.value)));
      });
    }
  }

  return {
    init,
    configure,
    render: () => render(false),
    toggle,
    reset,
    cancelPreroll: () => cancelPreroll(true),
    isBusy: () => mode === 'running' || mode === 'preroll' || mode === 'paused',
    isPreroll: () => mode === 'preroll',
    rerender: () => render(true)
  };
})();
