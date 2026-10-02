'use strict';

// Recording timer, as in Studio Clock: free time with quick times, or a program made of
// blocks (an intro, an interview, a closing…) each with its own time. 3·2·1 pre-roll, pause,
// "end block" / redo / back, dynamic timing (the drift of a block is carried over to the next
// ones), several takes per block, and a report at the end of the program.
// Elapsed time is read from a monotonic clock, so a change of the system clock cannot shift it.
GC.timer = (() => {
  const T = GC.timerMath;
  const $ = GC.$;
  const t = (k, p) => GC.t(k, p);
  const WARN = 60; // seconds left: yellow
  const DANGER = 10; // seconds left: red
  const REPORT_KEY = 'com.onairgarage.gclock.lastReport';

  let mode = 'free'; // 'free' | 'prog'
  let blocks = []; // working copy: [{ label, sec }]
  let idx = 0;
  let actuals = []; // takes per block: actuals[i] = [sec, sec, …]
  let targetSec = 0;
  let startMark = 0; // monotonic mark (ms) of the start, shifted by the time already elapsed on resume
  let pausedElapsed = 0; // seconds frozen while paused (> 0: can resume)
  let running = false;
  let finished = false;
  let prerolling = false;
  let prerollTimer = null;
  let jumped = false; // the user jumped to a block from the side list
  let beeped = false;
  let currentProgram = null;
  let lastReport = null;
  let cfg = { sound: false, preroll: true, dynamic: true, program: null, presets: [] };
  let audio = null;

  const mono = () => performance.now();
  const programs = () => GC.state.settings?.programs ?? [];
  const blockName = (i) => `${t('block')} ${i + 1}`;
  const elapsed = () => (running ? (mono() - startMark) / 1000 : pausedElapsed);
  const effTarget = (i) => T.effTarget(blocks, actuals, i, cfg.dynamic);

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
        const at = now + i * 0.28;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        osc.connect(gain).connect(audio.destination);
        osc.start(at);
        osc.stop(at + 0.24);
      }
    } catch {
      /* no audio device: stay silent */
    }
  }

  // ---- display ----
  function paint(remaining, el, opts = {}) {
    let cls = '';
    let label = opts.badge || '';
    if (opts.text) cls = opts.cls || '';
    else if (opts.idle) label ||= t('timer.state.ready');
    else if (remaining < 0) {
      cls = 'over';
      label ||= t('timer.state.over');
    } else if (remaining <= DANGER) {
      cls = 'danger';
      label ||= t('timer.state.ending');
    } else if (remaining <= WARN) {
      cls = 'warn';
      label ||= t('timer.state.warn');
    } else label ||= t('timer.state.recording');

    const disp = $('timerDisplay');
    disp.textContent = opts.text || T.clk(Math.ceil(remaining));
    disp.className = 'rec-display' + (cls ? ' ' + cls : '') + (opts.text && cls ? ' expired' : '') + (!opts.text && cls === 'over' ? ' blink-red' : '');
    $('timerBarFill').className = 'progress-bar' + (cls ? ' ' + cls : '');
    $('timerState').className = 'state-badge' + (cls ? ' ' + cls : '');
    const frac = targetSec > 0 ? Math.max(0, Math.min(1, remaining / targetSec)) : 0;
    $('timerBarFill').style.width = frac * 100 + '%';
    $('timerElapsed').textContent = t('timer.elapsed', { e: T.clk(Math.max(0, el)), t: T.clk(targetSec) });
    $('timerStateText').textContent = label;
  }

  function renderIdle() {
    if (mode === 'prog' && !blocks.length) {
      const disp = $('timerDisplay');
      disp.textContent = '00:00';
      disp.className = 'rec-display';
      $('timerBarFill').className = 'progress-bar';
      $('timerBarFill').style.width = '0%';
      $('timerState').className = 'state-badge';
      $('timerStateText').textContent = t('timer.state.noProg');
      $('timerElapsed').textContent = '—';
      renderMeta();
      return;
    }
    paint(targetSec, 0, { idle: true });
    renderMeta();
  }

  function renderMeta() {
    $('bmProg').textContent = currentProgram ? currentProgram.name : '—';
    $('bmPos').textContent = t('block.pos', { i: Math.min(idx, Math.max(0, blocks.length - 1)) + 1, n: blocks.length || 1 });
    $('bmLabel').textContent = (blocks[idx] && blocks[idx].label) || blockName(idx);
  }

  // Repaint whatever state we are in (after a language change or a settings change)
  function repaint() {
    if (running) paint(targetSec - elapsed(), elapsed());
    else if (finished) paint(0, 0, { text: t('timer.state.end'), cls: 'over', badge: t('timer.state.endProg') });
    else if (pausedElapsed > 0) paint(targetSec - pausedElapsed, pausedElapsed, { badge: t('timer.state.paused') });
    else if (prerolling) renderIdle();
    else renderIdle();
    renderBlockList();
    setButtons();
  }

  // ---- engine ----
  function start() {
    if (running || finished || prerolling) return;
    if (pausedElapsed > 0) return beginRun(false); // resume
    if (mode === 'free') {
      const s = readInputs();
      if (s <= 0) return flashInputs();
      blocks = [{ label: '', sec: s }];
      idx = 0;
      actuals = [];
      targetSec = s;
    } else {
      if (!blocks.length) return;
      targetSec = jumped ? Math.max(0, blocks[idx].sec - T.totalTakes(actuals, idx)) : effTarget(idx);
      jumped = false;
    }
    beeped = false;
    if (cfg.preroll) runPreroll(() => beginRun(true));
    else beginRun(true);
  }

  function beginRun(fresh) {
    if (fresh) {
      pausedElapsed = 0;
      startMark = mono();
    } else {
      startMark = mono() - pausedElapsed * 1000;
      pausedElapsed = 0;
    }
    running = true;
    document.body.classList.remove('paused');
    if (audio && audio.state === 'suspended') audio.resume();
    document.body.classList.add('timer-running');
    setButtons();
    renderBlockList();
    render(true);
  }

  // called on every tick of the app
  function render(force) {
    if (!running) return;
    const el = elapsed();
    const remaining = targetSec - el;
    if (remaining <= 0 && !beeped) {
      beeped = true;
      beep(3, 880);
    }
    paint(remaining, el);
    updateNextProj(remaining);
  }

  // Live projection of the next block: gains or loses what is left of the current one
  function updateNextProj(remaining) {
    const el = $('brProj');
    const nb = blocks[idx + 1];
    if (!el || !nb) return;
    const proj = cfg.dynamic ? nb.sec + remaining : nb.sec;
    el.textContent = '→ ' + T.clk(proj);
    el.className = 'br-proj' + (proj < nb.sec ? ' over' : proj > nb.sec ? ' under' : '');
  }

  function pause() {
    if (!running) return;
    pausedElapsed = elapsed();
    running = false;
    document.body.classList.add('paused');
    document.body.classList.remove('timer-running');
    setButtons();
    paint(targetSec - pausedElapsed, pausedElapsed, { badge: t('timer.state.paused') });
  }

  function stopClock() {
    running = false;
    pausedElapsed = 0;
    document.body.classList.remove('paused', 'timer-running');
  }

  function next() {
    if (mode !== 'prog' || !blocks.length || finished) return;
    const el = elapsed();
    if (el > 0) {
      if (!Array.isArray(actuals[idx])) actuals[idx] = [];
      actuals[idx].push(Math.round(el));
    }
    jumped = false;
    stopClock();
    beep(2, 660);
    if (idx >= blocks.length - 1) {
      finished = true;
      snapshotReport();
      paint(0, 0, { text: t('timer.state.end'), cls: 'over', badge: t('timer.state.endProg') });
      renderMeta();
      renderBlockList();
      setButtons();
      GC.programs.openReport();
      return;
    }
    idx++;
    targetSec = effTarget(idx);
    renderIdle();
    renderBlockList();
    setButtons();
  }

  // Redo the current block: discard its takes
  function redo() {
    if (mode !== 'prog' || !blocks.length) return;
    finished = false;
    stopClock();
    jumped = false;
    actuals[idx] = [];
    targetSec = effTarget(idx);
    renderIdle();
    renderBlockList();
    setButtons();
  }

  // Go back to the previous block (or reopen the last one when finished) to redo it
  function back() {
    if (mode !== 'prog' || !blocks.length) return;
    stopClock();
    jumped = false;
    if (finished) finished = false;
    else if (idx > 0) idx--;
    else return;
    actuals[idx] = [];
    targetSec = effTarget(idx);
    renderIdle();
    renderBlockList();
    setButtons();
  }

  // Jump to any block by clicking it in the list (recording out of order)
  function jumpToBlock(i) {
    if (running || finished || prerolling || !blocks[i]) return;
    if (pausedElapsed > 0 && mode === 'prog') {
      const el = Math.round(pausedElapsed);
      if (el > 0) {
        if (!Array.isArray(actuals[idx])) actuals[idx] = [];
        actuals[idx].push(el); // keep the partial take
      }
    }
    pausedElapsed = 0;
    document.body.classList.remove('paused');
    if (cfg.dynamic) persist({ dynamic: false }); // dynamic timing makes no sense out of order
    idx = i;
    jumped = true;
    targetSec = Math.max(0, blocks[i].sec - T.totalTakes(actuals, i));
    renderIdle();
    renderBlockList();
    setButtons();
    paintOptions();
  }

  function reset() {
    cancelPreroll(false);
    finished = false;
    idx = 0;
    actuals = [];
    jumped = false;
    stopClock();
    if (mode === 'free') {
      blocks = [];
      targetSec = readInputs();
    } else targetSec = effTarget(0);
    renderIdle();
    renderBlockList();
    setButtons();
  }

  function toggle() {
    if (prerolling) cancelPreroll(true);
    else if (running) pause();
    else start();
  }

  function setButtons() {
    const prog = mode === 'prog';
    $('tStart').hidden = running || prerolling;
    $('tStart').textContent = t(pausedElapsed > 0 ? 'timer.resume' : 'timer.start');
    $('tStart').disabled = finished || (prog && !blocks.length);
    $('tPause').hidden = !running;
    $('tNext').disabled = !prog || finished || !blocks.length;
    $('tRedo').disabled = !prog || !blocks.length;
    $('tBack').disabled = !prog || !blocks.length || (!finished && idx === 0);
    $('optReport').disabled = !lastReport;
    $('optReport').classList.toggle('on', !!lastReport);
  }

  function readInputs() {
    const m = Math.max(0, parseInt($('tMin').value, 10) || 0);
    const s = Math.max(0, Math.min(59, parseInt($('tSec').value, 10) || 0));
    return m * 60 + s;
  }

  function setFree(sec) {
    $('tMin').value = sec ? String(Math.floor(sec / 60)) : '';
    $('tSec').value = sec ? GC.pad(sec % 60) : '';
    previewFree();
  }

  // Show the entered time on the display (free mode, not started)
  function previewFree() {
    if (mode !== 'free' || running || finished || prerolling || pausedElapsed > 0) return;
    targetSec = readInputs();
    renderIdle();
  }

  function flashInputs() {
    for (const id of ['tMin', 'tSec']) {
      $(id).classList.add('err');
      setTimeout(() => $(id).classList.remove('err'), 600);
    }
  }

  // ---- pre-roll 3·2·1 ----
  function runPreroll(cb) {
    prerolling = true;
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
        cb();
      }
    }, 1000);
    setButtons();
  }

  function cancelPreroll(refresh) {
    clearInterval(prerollTimer);
    prerolling = false;
    $('preroll').hidden = true;
    if (refresh) {
      renderIdle();
      setButtons();
    }
  }

  // ---- block list ----
  function renderBlockList() {
    const list = $('blocksList');
    if (mode !== 'prog') {
      list.replaceChildren();
      return;
    }
    list.replaceChildren(
      ...blocks.map((b, i) => {
        const isCurrent = i === idx && !finished;
        const taken = T.hasTakes(actuals, i);
        const editable = !running && !prerolling && !finished && i === idx;
        let sub = null;
        if (taken) {
          const total = T.totalTakes(actuals, i);
          const diff = total - b.sec;
          const detail = diff < 0 ? `${t('br.rec')} ${T.durStr(total)} · ${t('br.rem')} ${T.durStr(b.sec - total)}` : `${t('br.rec')} ${T.durStr(total)} ${diff > 0 ? '+' : '±'}${T.durStr(Math.abs(diff))}`;
          const badge = actuals[i].length > 1 ? GC.h('span', { class: 'br-take-badge', text: `${actuals[i].length}× (${actuals[i].map(T.durStr).join('+')})` }) : null;
          sub = GC.h('div', { class: 'br-actual ' + (diff > 0 ? 'over' : diff < 0 ? 'under' : '') }, detail, badge && ' ', badge);
        } else if (isCurrent && cfg.dynamic && T.cumDevBefore(blocks, actuals, i) !== 0) {
          sub = GC.h('div', { class: 'br-recalc', text: `${t('br.recalc')} ${T.clk(effTarget(i))}` });
        } else if (i === idx + 1 && !finished) {
          sub = GC.h('div', { class: 'br-proj', id: 'brProj', text: '→ ' + T.clk(b.sec) });
        }
        const input = GC.h('input', { class: 'br-dur', value: T.durStr(b.sec), disabled: !editable, 'aria-label': t('block') + ' ' + (i + 1) });
        input.addEventListener('change', () => {
          blocks[i].sec = Math.max(1, T.parseDur(input.value));
          input.value = T.durStr(blocks[i].sec);
          if (i === idx && !running && !finished) {
            targetSec = jumped ? Math.max(0, blocks[i].sec - T.totalTakes(actuals, i)) : effTarget(i);
            renderIdle();
          }
          renderFoot();
        });
        const row = GC.h('div', { class: 'block-row' + (isCurrent ? ' current' : '') + (taken && !isCurrent ? ' done' : '') + (!running && !finished ? ' selectable' : '') },
          GC.h('span', { class: 'br-idx', text: taken && !isCurrent ? '✓' : String(i + 1) }),
          GC.h('div', { class: 'br-main' }, GC.h('div', { class: 'br-label', text: b.label || blockName(i) }), sub),
          input);
        row.addEventListener('click', (e) => {
          if (e.target === input) return;
          jumpToBlock(i);
        });
        return row;
      })
    );
    renderFoot();
  }

  function renderFoot() {
    const planned = blocks.reduce((a, b) => a + b.sec, 0);
    let recorded = 0;
    for (let i = 0; i < blocks.length; i++) recorded += T.totalTakes(actuals, i);
    $('blocksFoot').textContent = t('total') + ' ' + T.clk(planned) + (recorded > 0 ? ' · ' + t('recorded') + ' ' + T.clk(recorded) : '');
  }

  // ---- free / program ----
  function setMode(m) {
    if (mode === m) return;
    reset();
    mode = m;
    $('viewRec').classList.toggle('mode-prog', m === 'prog');
    $('viewRec').classList.toggle('mode-free', m === 'free');
    $('modeFreeBtn').classList.toggle('act-blue', m === 'free');
    $('modeProgBtn').classList.toggle('act-blue', m === 'prog');
    if (m === 'prog') {
      const wanted = programs().find((p) => p.id === cfg.program) || programs()[0];
      if (wanted) loadProgram(wanted, false);
      else {
        currentProgram = null;
        blocks = [];
        targetSec = 0;
        renderIdle();
      }
    } else {
      currentProgram = null;
      blocks = [];
      targetSec = readInputs();
      renderIdle();
    }
    populateSelector();
    renderBlockList();
    setButtons();
  }

  function loadProgram(prog, remember = true) {
    currentProgram = prog;
    blocks = prog.blocks.map((b) => ({ label: b.label, sec: b.sec }));
    idx = 0;
    actuals = [];
    finished = false;
    jumped = false;
    stopClock();
    targetSec = effTarget(0);
    if (remember && cfg.program !== prog.id) persist({ program: prog.id });
    $('progSelect').value = prog.id;
    renderIdle();
    renderBlockList();
    setButtons();
  }

  function restoreBlocks() {
    if (!currentProgram) return;
    blocks = currentProgram.blocks.map((b) => ({ label: b.label, sec: b.sec }));
    if (!running && !finished) targetSec = effTarget(idx);
    renderIdle();
    renderBlockList();
  }

  function populateSelector() {
    const sel = $('progSelect');
    const list = programs();
    if (!list.length) {
      sel.replaceChildren(GC.h('option', { value: '', text: t('manage.none') }));
      return;
    }
    sel.replaceChildren(...list.map((p) => GC.h('option', { value: p.id, text: p.name })));
    if (currentProgram) sel.value = currentProgram.id;
  }

  // Open a program from the manage list: switch to program mode and load it
  function openProgram(id) {
    const p = programs().find((x) => x.id === id);
    if (!p || running || prerolling) return;
    if (mode !== 'prog') {
      cfg.program = id;
      setMode('prog');
    }
    loadProgram(p);
  }

  // Called after programs were saved, deleted or imported
  function programsChanged(selectId) {
    populateSelector();
    if (mode !== 'prog') return;
    const list = programs();
    const busy = running || prerolling || pausedElapsed > 0;
    const target = list.find((p) => p.id === (selectId || currentProgram?.id));
    if (!target) {
      if (!busy) {
        if (list.length) loadProgram(list[0]);
        else {
          currentProgram = null;
          blocks = [];
          targetSec = 0;
          renderIdle();
          renderBlockList();
          setButtons();
        }
      }
    } else if (!busy && (selectId || target.id === currentProgram?.id)) loadProgram(target);
    populateSelector();
  }

  // ---- report ----
  const buildReport = () => T.buildReport(blocks, actuals, blockName);

  function snapshotReport() {
    lastReport = { name: currentProgram ? currentProgram.name : '', when: Date.now(), ...buildReport() };
    try {
      localStorage.setItem(REPORT_KEY, JSON.stringify(lastReport));
    } catch {
      /* storage unavailable: the report stays available until the app closes */
    }
  }

  function loadStoredReport() {
    try {
      const r = JSON.parse(localStorage.getItem(REPORT_KEY) || 'null');
      if (r && Array.isArray(r.rows) && Number.isFinite(r.totPlanned)) lastReport = r;
    } catch {
      /* none */
    }
  }

  // ---- persisted options ----
  function persist(patch) {
    Object.assign(cfg, patch);
    if (GC.state.settings) Object.assign(GC.state.settings.timer, patch);
    window.api.settings.update({ timer: patch });
  }

  function paintOptions() {
    $('optSound').classList.toggle('on', cfg.sound);
    $('optSound').classList.toggle('off', !cfg.sound);
    $('optPreroll').classList.toggle('on', cfg.preroll);
    $('optPreroll').classList.toggle('off', !cfg.preroll);
    $('optDyn').classList.toggle('on', cfg.dynamic);
    $('optDyn').classList.toggle('off', !cfg.dynamic);
  }

  function renderPresets() {
    $('timerPresets').replaceChildren(...cfg.presets.map((sec) => GC.h('button', { class: 'chip', type: 'button', text: T.clk(sec), onclick: () => { if (mode === 'free' && !running && !prerolling) setFree(sec); } })));
  }

  function configure(timer) {
    cfg = { ...timer };
    renderPresets();
    paintOptions();
    populateSelector();
    repaint();
  }

  function init() {
    loadStoredReport();
    $('tStart').addEventListener('click', start);
    $('tPause').addEventListener('click', pause);
    $('tNext').addEventListener('click', next);
    $('tRedo').addEventListener('click', redo);
    $('tBack').addEventListener('click', back);
    $('tReset').addEventListener('click', reset);
    $('modeFreeBtn').addEventListener('click', () => setMode('free'));
    $('modeProgBtn').addEventListener('click', () => setMode('prog'));
    $('progSelect').addEventListener('change', (e) => {
      const p = programs().find((x) => x.id === e.target.value);
      if (p) loadProgram(p);
    });
    $('btnRestore').addEventListener('click', restoreBlocks);
    $('optSound').addEventListener('click', () => {
      persist({ sound: !cfg.sound });
      paintOptions();
      if (cfg.sound) beep(1, 880);
    });
    $('optPreroll').addEventListener('click', () => {
      persist({ preroll: !cfg.preroll });
      paintOptions();
    });
    $('optDyn').addEventListener('click', () => {
      persist({ dynamic: !cfg.dynamic });
      paintOptions();
      if (mode === 'prog' && !running && !finished) {
        targetSec = effTarget(idx);
        renderIdle();
      }
      renderBlockList();
    });
    $('optReport').addEventListener('click', () => GC.programs.openReport());
    for (const id of ['tMin', 'tSec']) {
      const input = $(id);
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '');
        previewFree();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') start();
      });
      input.addEventListener('blur', () => {
        if (id === 'tSec' && input.value) input.value = GC.pad(Math.min(59, Number(input.value)));
      });
    }
    $('viewRec').classList.add('mode-free');
    renderIdle();
    setButtons();
  }

  return {
    init,
    configure,
    render,
    toggle,
    next,
    reset,
    cancelPreroll: () => cancelPreroll(true),
    programsChanged,
    openProgram,
    getReport: () => lastReport || (blocks.length ? { name: currentProgram?.name || '', when: Date.now(), ...buildReport() } : null),
    isBusy: () => running || prerolling || pausedElapsed > 0,
    isPreroll: () => prerolling,
    isProgram: () => mode === 'prog',
    currentProgramId: () => currentProgram?.id ?? null
  };
})();
