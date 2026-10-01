import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'renderer');
const ctx = vm.createContext({ document: { documentElement: {}, querySelectorAll: () => [] } });
ctx.window = ctx; // in the browser `window` is the global object
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'i18n.js'), 'utf-8'), ctx);
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
  const prefix = /^(common|mode|settings|window|timer|break|news|wx|sec|general|breaks|cities|btn|data|upd|about|keys)\./;
  const files = fs.readdirSync(path.join(root, 'js')).map((f) => path.join(root, 'js', f)).filter((f) => !f.endsWith('i18n.js'));
  for (const f of [...files, path.join(root, 'index.html')]) {
    const src = fs.readFileSync(f, 'utf-8');
    for (const m of src.matchAll(/['"]([a-z]+(?:\.[A-Za-z0-9]+)+)['"]/g)) if (prefix.test(m[1])) used.add(m[1]);
    for (const m of src.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)) used.add(m[1]);
  }
  // keys built at run time
  for (const s of ['ready', 'preroll', 'recording', 'ending', 'paused', 'over']) used.add('timer.state.' + s);
  for (const s of ['general', 'breaks', 'timer', 'cities', 'news', 'weather', 'buttons', 'data', 'about']) used.add('sec.' + s);
  for (const s of ['guest', 'meet', 'jitsi', 'zoom', 'cam', 'site', 'chat', 'traffic']) used.add('btn.idea.' + s);
  for (const s of ['cam', 'site', 'chat', 'traffic']) used.add('btn.ideaLabel.' + s);
  const wxGroups = fs.readFileSync(path.join(root, 'js', 'weather.js'), 'utf-8').match(/CODE_GROUP = \{([\s\S]*?)\};/)[1];
  for (const m of wxGroups.matchAll(/'([A-Za-z]+)'/g)) used.add('wx.' + m[1]);
  const missing = [...used].filter((k) => !(k in DICT.en));
  assert.deepEqual(missing, []);
  assert.ok(used.size > 100);
});
