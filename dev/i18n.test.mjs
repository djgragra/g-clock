import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'renderer');
const ctx = vm.createContext({ document: { documentElement: {}, querySelectorAll: () => [] } });
ctx.window = ctx; // in the browser `window` is the global object
for (const f of ['i18n.js', 'i18n-talk.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf-8'), ctx);
const { DICT } = ctx.GC;

test('every language has exactly the English keys', () => {
  const en = Object.keys(DICT.en).sort();
  for (const lang of ['it', 'es']) assert.deepEqual(Object.keys(DICT[lang]).sort(), en, lang);
});

test('placeholders match between languages', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const [k, v] of Object.entries(DICT.en)) for (const lang of ['it', 'es']) assert.equal(ph(DICT[lang][k]), ph(v), `${lang} ${k}`);
});

test('no empty texts', () => {
  for (const lang of Object.keys(DICT)) for (const [k, v] of Object.entries(DICT[lang])) assert.ok(v.trim(), `${lang} ${k}`);
});

test('every key used by the interface exists', () => {
  const used = new Set();
  const prefix = /^(common|mode|settings|window|timer|break|news|wx|sec|general|breaks|cities|btn|data|upd|about|keys|ev|sched|bk|pill|new|dial|talk)\./;
  const files = fs.readdirSync(path.join(root, 'js')).map((f) => path.join(root, 'js', f)).filter((f) => !/i18n(-talk)?\.js$/.test(f));
  for (const f of [...files, path.join(root, 'index.html')]) {
    const src = fs.readFileSync(f, 'utf-8');
    for (const m of src.matchAll(/['"]([a-z]+(?:\.[A-Za-z0-9]+)+)['"]/g)) if (prefix.test(m[1])) used.add(m[1]);
    for (const m of src.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)) used.add(m[1]);
  }
  // keys built at run time
  for (const s of ['ready', 'preroll', 'recording', 'ending', 'paused', 'over']) used.add('timer.state.' + s);
  for (const s of ['general', 'breaks', 'events', 'timer', 'talk', 'news', 'weather', 'buttons', 'updates', 'backup', 'about']) used.add('sec.' + s);
  for (const s of ['guest', 'meet', 'jitsi', 'zoom', 'cam', 'site', 'chat', 'traffic']) used.add('btn.idea.' + s);
  for (const s of ['cam', 'site', 'chat', 'traffic']) used.add('btn.ideaLabel.' + s);
  // the talk timer builds some keys at run time
  for (const s of ['idle', 'running', 'holding']) used.add('talk.phase.' + s);
  for (const s of ['toggle', 'start', 'stop', 'reset', 'next', 'prev', 'restart']) { used.add('talk.sig.name.' + s); used.add('talk.act.' + s); }
  for (const s of ['colTime', 'colType', 'colCh', 'colNum', 'colVal', 'colAction', 'colName', 'colState', 'colConn', 'unsupported', 'failed', 'denied']) used.add('talk.midi.' + s);
  for (const s of ['stOff', 'stStarting', 'stListening', 'stDenied', 'stUnavailable']) used.add('talk.audio.' + s);
  for (const s of ['normal', 'warn', 'over', 'idle']) used.add('talk.col.' + s);
  const wxGroups = fs.readFileSync(path.join(root, 'js', 'weather.js'), 'utf-8').match(/CODE_GROUP = \{([\s\S]*?)\};/)[1];
  for (const m of wxGroups.matchAll(/'([A-Za-z]+)'/g)) used.add('wx.' + m[1]);
  const missing = [...used].filter((k) => !(k in DICT.en));
  assert.deepEqual(missing, []);
  assert.ok(used.size > 100);
});

test('the talk timer texts are all used, none is left over', () => {
  const src = ['talk.js', 'talk-settings.js', 'talk-signals.js', 'settings.js', 'app.js'].map((f) => fs.readFileSync(path.join(root, 'js', f), 'utf-8')).join('\n') + fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
  const dynamic = /^talk\.((phase|sig\.name|act|col)\.|midi\.col[A-Z]|audio\.st[A-Z])/;
  const unused = Object.keys(DICT.en).filter((k) => k.startsWith('talk.') && !dynamic.test(k) && !src.includes(`'${k}'`) && !src.includes(`"${k}"`) && !src.includes(`'${k.slice(5)}'`));
  assert.deepEqual(unused, []);
});
