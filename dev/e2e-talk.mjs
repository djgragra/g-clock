#!/usr/bin/env node
// End-to-end check of MicTime on the REAL app: starts Electron (under Xvfb when there is no display), drives the
// window over the DevTools protocol and checks that the timer is OFF by default, that it works when switched on (button,
// MIDI messages injected: there is no MIDI hardware in a test run, keys, the audio gate with Chromium's fake input), the
// programs, limits and colours, the REC chip and the settings page. Linux only as written.
//   node dev/e2e-talk.mjs        needs: npm ci, xvfb-run (or a display)
// It uses a throw-away profile folder, never the user's settings.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, sleep } from './driver.mjs';

// a stand-in for xdg-open records what the app asks the system to open (no browser is started, the allow-list in main.js still decides)
const openLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gclock-open-')), 'opened.txt');
const binDir = path.dirname(openLog);
fs.writeFileSync(path.join(binDir, 'xdg-open'), `#!/bin/sh\necho "$1" >> '${openLog}'\n`, { mode: 0o755 });
process.env.PATH = `${binDir}:${process.env.PATH}`;

const app = await launch({ extraArgs: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const { ev, send, errors } = app;
const key = async (code, k, mods = 0) => {
  for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code, key: k, modifiers: mods, windowsVirtualKeyCode: 0 });
};
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`); if (!ok) failed++; };
const text = (id) => ev(`document.getElementById('${id}').textContent`);
const view = () => ev(`JSON.stringify({ d: document.getElementById('talkDigits').textContent, phase: document.body.className.match(/talk-ph-(\\w+)/)?.[1] })`).then(JSON.parse);
const talk = (patch) => ev(`GC.settingsUI.save({ talk: ${JSON.stringify(patch)} }).then(() => 1)`);
const cls = () => ev('document.body.className');

try {
  await sleep(3000);
  check('page loaded, ES modules ran, no errors', (await ev('typeof GC.talk === "object" && GC.talk.ready === true && typeof GC.talk.signals === "object"')) && !errors.length, errors.join(' | '));

  // ---- OFF by default ----
  check('MicTime is off by default: nothing on screen', await ev('GC.state.settings.talk.enabled === false && document.getElementById("talkPanel").hidden && document.getElementById("talkChip").hidden'));
  check('while off nothing is listened to (no MIDI access, no audio)', (await ev('GC.talk.signals.midi.access === null')) && (await ev('GC.talk.signals.audio.status')) === 'off');
  check('while off the system refuses MIDI and the microphone', await ev(`navigator.requestMIDIAccess({ sysex: false }).then(() => false, () => true)`));

  // ---- switched on ----
  await talk({ enabled: true, mode: 'toggle', holdSeconds: 2, debounceMs: 0 });
  await sleep(600);
  check('switched on: the panel is shown, the first start says READY', await ev('!document.getElementById("talkPanel").hidden && document.getElementById("talkChip").hidden') && (await text('talkState')) === 'READY', await text('talkState'));
  check('Web MIDI is requested and handled (no MIDI hardware here: no access or no input)', await ev('GC.talk.signals.midi.error !== "denied"'), await ev('GC.talk.signals.midi.error'));
  check('no signal assigned: the hint is shown', await ev('!document.getElementById("talkHint").hidden'));

  await ev(`document.getElementById('talkStart').click()`);
  await sleep(2200);
  let v = await view();
  check('start: counting, 00:02', v.phase === 'running' && v.d === '00:02', JSON.stringify(v));
  await ev(`document.getElementById('talkStart').click()`);
  v = await view();
  check('second signal: stops, the total stays on screen', v.phase === 'holding' && v.d === '00:02', JSON.stringify(v));
  await sleep(2300);
  v = await view();
  check('after the hold time it is back to 00:00', v.phase === 'idle' && v.d === '00:00', JSON.stringify(v));

  // ---- MIDI ----
  const midi = (bytes) => ev(`GC.talk.signals.handleMidi({ data: new Uint8Array([${bytes}]) })`);
  await talk({ mode: 'toggle', midi: { enabled: true, bindings: { toggle: { type: 'note', channel: 1, number: 60 }, reset: { type: 'cc', channel: 0, number: 99 } } } });
  await midi([0x90, 60, 100]);
  await sleep(300);
  check('MIDI note on starts', (await view()).phase === 'running');
  await midi([0x90, 60, 0]);
  check('note on with velocity 0 does nothing', (await view()).phase === 'running');
  await midi([0x91, 60, 100]);
  check('another channel does not match', (await view()).phase === 'running');
  await midi([0xf8]);
  await midi([0x90, 60, 90]);
  check('the same note on again stops (toggle)', (await view()).phase === 'holding');
  await midi([0xb5, 99, 127]);
  check('CC reset on any channel returns to zero at once', (await view()).phase === 'idle');
  await talk({ mode: 'separate', midi: { bindings: { start: { type: 'cc', channel: 1, number: 20 }, stop: { type: 'cc', channel: 1, number: 20 }, toggle: null } } });
  await midi([0xb0, 20, 127]);
  check('separate, same CC for start and stop: 127 starts', (await view()).phase === 'running');
  await sleep(400);
  await midi([0xb0, 20, 0]);
  check('separate, same CC: 0 stops', (await view()).phase === 'holding');
  await ev('GC.talk.action("reset", "test")');
  await ev(`GC.talk.signals.startLearn('start', (b) => { window.__learned = b; })`);
  await midi([0x92, 36, 100]);
  check('MIDI learn takes the next note on', JSON.stringify(await ev('window.__learned')) === '{"type":"note","channel":3,"number":36}');

  // ---- keys: window in front ----
  await talk({ mode: 'toggle', debounceMs: 0, key: { enabled: true, global: false, keys: { toggle: 'F9', reset: 'F10' } } });
  await key('F9', 'F9');
  await sleep(150);
  check('key F9 (window in front) starts', (await view()).phase === 'running');
  await key('F10', 'F10');
  check('key F10 resets', (await view()).phase === 'idle');
  await talk({ key: { enabled: true, global: true, keys: { toggle: 'ctrl+alt+f9', reset: 'F10' } } });
  await sleep(300);
  const st = JSON.parse(await ev('window.api.keys.status().then(JSON.stringify)'));
  console.log(`info global shortcuts registered by the system: ${JSON.stringify(st)}`);
  check('Ctrl+Alt+F9 and F10 are registered, or reported as refused (never lost)', Object.keys(st.global).length + st.failed.length === 2, JSON.stringify(st));
  await talk({ enabled: false });
  await sleep(300);
  const off = JSON.parse(await ev('window.api.keys.status().then(JSON.stringify)'));
  check('switched off: the system shortcuts are released', Object.keys(off.global).length === 0 && off.failed.length === 0, JSON.stringify(off));
  check('switched off: the panel is hidden again', await ev('document.getElementById("talkPanel").hidden'));
  await talk({ enabled: true, key: { global: false, keys: { toggle: '', reset: '' } } });

  // ---- audio gate with Chromium's fake input device ----
  await talk({ mode: 'toggle', holdSeconds: 1, debounceMs: 0, audio: { enabled: true, thresholdDb: -45, holdMs: 400 } });
  let heard = false;
  for (let i = 0; i < 40 && !heard; i++) { await sleep(250); heard = (await ev('GC.talk.signals.audio.status')) === 'listening' && (await view()).phase !== 'idle'; }
  check('audio level starts the timer when the beep goes over the threshold', heard, await ev('JSON.stringify({s: GC.talk.signals.audio.status, db: GC.talk.signals.audio.db})'));
  await talk({ audio: { enabled: false } });
  await sleep(300);
  check('switching the audio off releases the input', (await ev('GC.talk.signals.audio.status')) === 'off' && (await ev('GC.talk.signals.audio.stream')) === null);

  // ---- programs, limits, colours ----
  await talk({ audio: { enabled: false }, mode: 'toggle', holdSeconds: 2, holdForever: false, debounceMs: 0, warnSeconds: 2, flashSeconds: 1, midi: { bindings: { toggle: null, start: null, stop: null, reset: null } }, key: { enabled: true, global: false, keys: { toggle: 'F9', reset: 'F10', next: 'F5', prev: 'F6', restart: 'F7' } } });
  await talk({ programs: [{ id: 'show', name: 'Show', steps: [{ name: 'News', sec: 3 }, { name: 'Chat', sec: 0 }, { name: 'End', sec: 5 }] }], activeProgram: 'show', programEnd: 'loop' });
  await sleep(300);
  await ev('GC.talk.action("reset", "test")');
  await key('F7', 'F7');
  await sleep(150);
  check('program on screen: step 1/3 News 00:03, next Chat', (await text('talkStep')) === 'Step 1/3 · News · 00:03' && (await text('talkNext')) === 'Next: Chat · no limit', `${await text('talkStep')} | ${await text('talkNext')}`);
  await key('F9', 'F9');
  await sleep(1300);
  check('1.3 s of a 3 s limit with a 2 s warning: warning colour', (await cls()).includes('talk-lim-warn'), await cls());
  await sleep(2000);
  check('past the limit: over colour', /talk-lim-(over|flash)/.test(await cls()), await cls());
  check('the figures are red', (await ev("getComputedStyle(document.getElementById('talkDigits')).color")) === 'rgb(255, 77, 58)');
  await sleep(1200);
  check('past the limit by more than 1 s: blinking', (await cls()).includes('talk-lim-flash') && (await ev("getComputedStyle(document.getElementById('talkDigits')).animationName")) === 'talk-pulse', await cls());
  await key('F9', 'F9');
  await sleep(200);
  check('stop: the total keeps the red colour, no blinking, the next step is armed', (await cls()).includes('talk-lim-over') && !(await cls()).includes('talk-lim-flash') && (await text('talkNext')).startsWith('Next: Chat') && (await text('talkStep')).startsWith('News'), `${await cls()} | ${await text('talkStep')} | ${await text('talkNext')}`);
  await sleep(2300);
  check('after the hold time: back to zero, step 2/3 (no limit) is armed', (await cls()).includes('talk-ph-idle') && (await text('talkStep')) === 'Step 2/3 · Chat · no limit', `${await cls()} | ${await text('talkStep')}`);
  await key('F9', 'F9');
  await sleep(1500);
  check('a step with no limit never changes colour', (await cls()).includes('talk-lim-none'), await cls());
  await key('F9', 'F9');
  await sleep(100);
  await key('F10', 'F10');
  await key('F6', 'F6');
  check('previous step', (await text('talkStep')).startsWith('Step 2/3'), await text('talkStep'));
  await key('F7', 'F7');
  check('restart: first step', (await text('talkStep')).startsWith('Step 1/3'));
  await key('F5', 'F5'); await key('F5', 'F5'); await key('F5', 'F5');
  check('next three times with loop: back to the first step', (await text('talkStep')).startsWith('Step 1/3'), await text('talkStep'));
  await talk({ programEnd: 'free' });
  await key('F5', 'F5'); await key('F5', 'F5'); await key('F5', 'F5');
  check('"free" at the end: no limit and the program says so', (await text('talkStep')) === 'End of the program: no limit', await text('talkStep'));
  await talk({ activeProgram: '', limitSeconds: 2, warnSeconds: 1, flashSeconds: 1, holdSeconds: 2 });
  await sleep(200);
  check('single limit: the line says so', (await text('talkNext')) === 'Limit 00:02', await text('talkNext'));
  await key('F9', 'F9');
  await sleep(1300);
  check('single limit: warning near the limit', (await cls()).includes('talk-lim-warn'), await cls());
  await sleep(1000);
  check('single limit: over past it', /talk-lim-(over|flash)/.test(await cls()), await cls());
  await key('F10', 'F10');
  await talk({ limitSeconds: 0 });
  const idx = JSON.parse(await ev('window.api.settings.get().then((p) => JSON.stringify(p.talkProgramIndex))'));
  check('the step is kept by the main process, not in the settings', typeof idx.show === 'number' && !JSON.stringify(await ev('GC.state.settings')).includes('programIndex'), JSON.stringify(idx));

  // reduce motion: a steady red frame instead of blinking
  await talk({ programs: [{ id: 'q', name: 'Quick', steps: [{ name: 'Q', sec: 1 }] }], activeProgram: 'q', warnSeconds: 0, flashSeconds: 0 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await key('F7', 'F7');
  await key('F9', 'F9');
  await sleep(2300);
  check('reduce motion: no animation on the figures, a red frame on the panel', (await ev("getComputedStyle(document.getElementById('talkDigits')).animationName")) === 'none' && (await ev("getComputedStyle(document.getElementById('talkPanel')).boxShadow")).includes('rgb(255, 77, 58)'), await cls());
  await send('Emulation.setEmulatedMedia', { features: [] });
  await key('F10', 'F10');
  await talk({ activeProgram: '', colors: { normal: '#00ff00', idle: '#0000ff' } });
  check('chosen colours apply (idle blue)', (await ev("getComputedStyle(document.getElementById('talkDigits')).color")) === 'rgb(0, 0, 255)');
  await key('F9', 'F9');
  check('chosen colours apply (counting green)', (await ev("getComputedStyle(document.getElementById('talkDigits')).color")) === 'rgb(0, 255, 0)');
  await key('F10', 'F10');
  await talk({ colors: { normal: '', idle: '' } });

  // ---- REC: the timer becomes a chip in the header ----
  await ev(`document.getElementById('btnRec').click()`);
  await sleep(400);
  check('in REC the panel gives way to the chip in the header', await ev('document.getElementById("talkPanel").hidden && !document.getElementById("talkChip").hidden'));
  await key('F9', 'F9');
  await sleep(1200);
  check('the chip counts and the signal still works in REC', (await ev("document.getElementById('talkChipDigits').textContent")) === '00:01', await ev("document.getElementById('talkChipDigits').textContent"));
  await ev(`document.getElementById('talkChip').click()`);
  check('clicking the chip stops (toggle)', (await view()).phase === 'holding');
  await key('F10', 'F10');
  await ev(`document.getElementById('btnOnAir').click()`);
  await sleep(300);

  // ---- settings page ----
  await ev(`GC.settingsUI.open('talk')`);
  await sleep(500);
  const names = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.nav-item')].map((b) => b.textContent))`));
  check('MicTime page is in the settings, after Timer', names.indexOf('MicTime') === names.indexOf('Timer') + 1, names.join('|'));
  check('the page shows the options when the timer is on', await ev(`document.querySelectorAll('#settingsContent .talk-card').length >= 3 && document.querySelectorAll('#settingsContent .bind').length >= 10`));
  await talk({ programs: [{ id: 'al', name: 'Align', steps: [{ name: 'One', sec: 60 }] }], activeProgram: 'al' });
  await ev('GC.settingsUI.render().then(() => 1)');
  await sleep(300);
  const al = JSON.parse(await ev(`(() => { const head = [...document.querySelectorAll('.step-row.head span')]; const row = document.querySelector('.step-row:not(.head)'); const inputs = row.querySelectorAll('input'); const r = (e) => e.getBoundingClientRect(); return JSON.stringify({ name: [r(head[1]).left, r(inputs[0]).left], min: [r(head[2]).left, r(inputs[1]).left], sec: [r(head[3]).left, r(inputs[2]).left] }); })()`));
  check('step table: the labels start where their boxes start', Object.values(al).every(([a, b]) => Math.abs(a - b) <= 4), JSON.stringify(al));
  await talk({ enabled: false });
  await ev('GC.settingsUI.render().then(() => 1)');
  await sleep(300);
  check('switched off, the page shows only the switch', await ev(`document.querySelectorAll('#settingsContent .talk-card').length === 0`));
  await ev(`GC.settingsUI.close()`);

  // ---- languages ----
  await talk({ enabled: true });
  await ev(`GC.settingsUI.save({ language: 'it' }).then(() => 1)`);
  check('Italian applies to MicTime', (await text('talkReset')) === 'AZZERA' && (await text('talkState')) === 'PRONTO', `${await text('talkReset')} ${await text('talkState')}`);
  await ev(`GC.settingsUI.save({ language: 'es' }).then(() => 1)`);
  check('Spanish applies to MicTime', (await text('talkReset')) === 'REINICIAR', await text('talkReset'));
  await ev(`GC.settingsUI.save({ language: 'en' }).then(() => 1)`);

  // ---- theme: dark, light, follow the system ----
  check('the theme is dark by default', (await ev('document.documentElement.dataset.theme')) === 'dark' && (await ev('GC.state.settings.theme')) === 'dark');
  await ev(`GC.settingsUI.save({ theme: 'light' }).then(() => 1)`);
  check('light theme: light background, dark text', (await ev('document.documentElement.dataset.theme')) === 'light' && (await ev("getComputedStyle(document.body).backgroundColor")) === 'rgb(238, 242, 248)' && (await ev("getComputedStyle(document.getElementById('hTime')).color")) !== 'rgb(255, 255, 255)');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await ev(`GC.settingsUI.save({ theme: 'system' }).then(() => 1)`);
  check('follow the system: light when the system is light', (await ev('document.documentElement.dataset.theme')) === 'light');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(300);
  check('follow the system: it changes with the system', (await ev('document.documentElement.dataset.theme')) === 'dark');
  await send('Emulation.setEmulatedMedia', { features: [] });
  await ev(`GC.settingsUI.save({ theme: 'dark' }).then(() => 1)`);

  // ---- tip jar: a click on the jar goes where the pill goes (through the bridge and the allow-list, to the system) ----
  for (const [lang, url] of [['en', 'https://onairgarage.com/support/'], ['it', 'https://onairgarage.com/it/support/'], ['es', 'https://onairgarage.com/es/support/']]) {
    await ev(`GC.settingsUI.save({ language: '${lang}' }).then(() => 1)`);
    await ev(`GC.settingsUI.open('about')`);
    await sleep(500);
    const read = () => (fs.existsSync(openLog) ? fs.readFileSync(openLog, 'utf-8').split('\n').filter(Boolean) : []);
    const r = JSON.parse(await ev(`(() => { const jar = document.querySelector('.tip-jar-link'); return JSON.stringify({ aria: jar.getAttribute('aria-hidden'), tab: jar.getAttribute('tabindex'), alt: jar.querySelector('img').getAttribute('alt'), cursor: getComputedStyle(jar).cursor }); })()`));
    fs.rmSync(openLog, { force: true });
    await ev(`document.querySelector('.tip-pill').click()`);
    await sleep(800);
    const viaPill = read();
    fs.rmSync(openLog, { force: true });
    await ev(`document.querySelector('.tip-jar-link').click()`);
    await sleep(800);
    const viaJar = read();
    check(`tip jar (${lang}): pill and jar open the same page`, viaPill.length === 1 && viaPill[0] === url && viaJar.length === 1 && viaJar[0] === url && r.aria === 'true' && r.tab === '-1' && r.alt === '' && r.cursor === 'pointer', JSON.stringify({ r, viaPill, viaJar }));
  }
  await ev(`GC.settingsUI.save({ language: 'en' }).then(() => 1)`);
  await ev(`GC.settingsUI.close()`);

  // ---- clock only: the dial alone (key C), the feeds stay configured ----
  await talk({ enabled: false });
  const shown = (sel) => ev(`(() => { const e = document.querySelector('${sel}'); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; })()`);
  await ev(`GC.settingsUI.save({ airMode: 'onair', clockOnly: false, news: { enabled: true, ticker: true }, weather: { enabled: true, places: [{ id: 'p1', name: 'Test city', detail: '', lat: 10, lon: 10 }] } }).then(() => 1)`);
  await ev(`GC.news.update({ enabled: true, items: [{ id: 'x', title: 'Headline', source: 'Feed', time: Date.now(), link: 'https://example.org/a' }], sources: [] })`);
  await sleep(300);
  check('clock only is off by default: headlines and weather columns are laid out', !(await ev('GC.state.settings.clockOnly')) && (await shown('#newsPanel')) && (await shown('#infoPanel')));
  await key('KeyC', 'c');
  await sleep(400);
  check('key C: clock only; headlines, ticker and weather are gone, the dial is there', (await ev('GC.state.settings.clockOnly')) && (await cls()).includes('clock-only') && !(await shown('#newsPanel')) && !(await shown('#infoPanel')) && !(await shown('#ticker')) && (await shown('#dial')));
  check('clock only is saved in the settings file', (await ev(`window.api.settings.get().then((p) => p.settings.clockOnly)`)) === true);
  await ev(`GC.settingsUI.open('general')`);
  await sleep(300);
  check('Settings → General shows the switch, on', await ev(`document.querySelector('.settings-panel').textContent.includes('Clock only')`));
  await ev(`GC.settingsUI.close()`);
  await key('KeyC', 'c');
  await sleep(400);
  check('key C again: back to the full view, nothing lost', !(await ev('GC.state.settings.clockOnly')) && (await shown('#newsPanel')) && (await shown('#infoPanel')) && (await ev('GC.state.settings.news.feeds.length > 0')));
  await ev(`GC.settingsUI.save({ weather: { enabled: false, places: [] } }).then(() => 1)`);

  // ---- messages for the announcer: saved ones with the keys 1..9, M for a one-off, 0 to clear, clock only keeps the strip ----
  await ev(`GC.settingsUI.save({ notes: { list: [{ id: 'n1', text: 'Guest is waiting' }, { id: 'n2', text: 'Wrap up in 1 minute' }] } }).then(() => 1)`);
  await sleep(300);
  const note = () => ev(`JSON.stringify({ bar: !document.getElementById('noteBar').hidden, text: document.getElementById('noteText').textContent, on: [...document.querySelectorAll('.note-chip.on')].length })`).then(JSON.parse);
  check('no message on screen at the start, two quick-choice buttons', !(await note()).bar && (await ev(`document.querySelectorAll('.note-chip').length`)) === 2);
  await key('Digit2', '2');
  check('key 2: the second saved message is shown, its button is on', JSON.stringify(await note()) === '{"bar":true,"text":"Wrap up in 1 minute","on":1}', JSON.stringify(await note()));
  check('the message is large under the dial', await shown('#noteBar'));
  await key('Digit2', '2');
  check('the same key again takes it off', !(await note()).bar);
  await key('Digit1', '1');
  await key('Digit0', '0');
  check('0 clears the message', !(await note()).bar);
  await key('Digit5', '5');
  check('a key with no saved message does nothing', !(await note()).bar);
  await key('KeyM', 'm');
  check('M opens the line to type a one-off message', await shown('#noteInput'));
  await ev(`(() => { const i = document.getElementById('noteInput'); i.value = '  Phone   call on line 2 '; })()`);
  await key('Enter', 'Enter');
  check('Enter shows the typed message, cleaned, and closes the line', (await note()).text === 'Phone call on line 2' && !(await shown('#noteInput')), JSON.stringify(await note()));
  check('what is on screen is not saved in the settings', (await ev(`window.api.settings.get().then((p) => JSON.stringify(p.settings.notes.list.map((n) => n.text)))`)) === '["Guest is waiting","Wrap up in 1 minute"]');
  await key('KeyC', 'c');
  await sleep(300);
  check('clock only keeps the message on screen and hides the buttons', (await shown('#noteBar')) && !(await shown('#noteChips')));
  await key('KeyC', 'c');
  await ev(`document.getElementById('noteBar').click()`);
  check('a click on the message clears it', !(await note()).bar);
  await key('KeyM', 'm');
  await key('Escape', 'Escape');
  check('Esc closes the line without a message', !(await shown('#noteInput')) && !(await note()).bar);
  await ev(`GC.settingsUI.open('notes')`);
  await sleep(300);
  check('Settings → Messages lists the two saved messages', await ev(`document.querySelectorAll('.settings-panel .list-row input[type=text]').length >= 2 && document.querySelector('.settings-panel').textContent.includes('Messages')`));
  await ev(`GC.settingsUI.close()`);
  await ev(`GC.settingsUI.save({ notes: { list: [] } }).then(() => 1)`);

  // ---- blinking before a stopset: countdown and marker blink in the last blinkSec seconds ----
  const at = (m, sec) => ev(`(() => { GC.clock.render(new Date(2026, 9, 24, 10, ${m}, ${sec})); const mk = [...document.querySelectorAll('#dial > path')].map((p) => p.getAttribute('opacity')).filter(Boolean); return JSON.stringify({ count: document.querySelector('.dial-count').getAttribute('class'), opacity: mk }); })()`).then(JSON.parse);
  await ev(`GC.settingsUI.save({ breaks: { enabled: true, marks: [0, 30], warnSec: 300, blinkSec: 60, grids: [] } }).then(() => 1)`);
  let a = await at(29, 20); // 40 s to the stopset, even second
  let b = await at(29, 21);
  check('blink 60: 40 s before, the countdown blinks and the marker flashes second by second', a.count.includes('blink') && a.opacity.includes('1') && b.opacity.includes('0.3'), JSON.stringify({ a, b }));
  a = await at(28, 20); // 100 s to go: warning colour, no blink
  b = await at(28, 21);
  check('blink 60: 100 s before, warning colour, steady marker', a.count.includes('warn') && !a.count.includes('blink') && !b.opacity.includes('0.3'), JSON.stringify({ a, b }));
  await ev(`GC.settingsUI.save({ breaks: { blinkSec: 0 } }).then(() => 1)`);
  a = await at(29, 20);
  b = await at(29, 21);
  check('blink 0: nothing blinks, warning colour only', a.count.includes('warn') && !a.count.includes('blink') && !b.opacity.includes('0.3'), JSON.stringify({ a, b }));
  await ev(`GC.settingsUI.save({ breaks: { blinkSec: 120 } }).then(() => 1)`);
  a = await at(28, 20);
  check('blink 120: 100 s before it already blinks', a.count.includes('blink'), JSON.stringify(a));
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(200);
  a = await at(29, 20);
  b = await at(29, 21);
  check('"reduce motion": the marker stays steady in the last seconds', !a.opacity.includes('0.3') && !b.opacity.includes('0.3'), JSON.stringify({ a, b }));
  await send('Emulation.setEmulatedMedia', { features: [] });
  await ev(`GC.settingsUI.save({ breaks: { blinkSec: 60 } }).then(() => 1)`);

  check('no errors in the console during the run', !errors.length, errors.join(' | '));
} catch (err) {
  console.log('FAIL', err.message);
  failed++;
} finally {
  app.close();
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
