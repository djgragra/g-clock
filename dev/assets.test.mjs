import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = (...p) => path.join(root, ...p);
const pkg = JSON.parse(fs.readFileSync(file('package.json'), 'utf8'));

test('the logo is an SVG of the dial: 60 segments, the lit minute, the blue stopset marker, the red dot', () => {
  const svg = fs.readFileSync(file('assets', 'logo.svg'), 'utf8');
  assert.match(svg, /^<svg [^>]*viewBox="0 0 64 64"/);
  assert.equal((svg.match(/<path /g) || []).length, 60);
  assert.ok(svg.includes('fill="#ffffff"') && svg.includes('fill="#3b82f6"') && svg.includes('fill="#e8321a"'));
  assert.ok(!/<script|href=|<image/i.test(svg), 'the logo carries no script or external content');
  assert.equal(fs.readFileSync(file('renderer', 'img', 'logo.svg'), 'utf8'), svg, 'the interface uses the same logo');
});

test('every icon generated from the logo exists, with the right size and format', () => {
  const png = (f) => {
    const b = fs.readFileSync(file('assets', f));
    assert.equal(b.subarray(1, 4).toString(), 'PNG', f);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  };
  assert.deepEqual(png('icon.png'), { w: 1024, h: 1024 });
  assert.deepEqual(png('icon-mac.png'), { w: 1024, h: 1024 });
  for (const s of [16, 32, 48, 64, 128, 256, 512]) assert.deepEqual(png(`linux-icons/${s}x${s}.png`), { w: s, h: s });
  const ico = fs.readFileSync(file('assets', 'icon.ico'));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.readUInt16LE(4) >= 6, 'icon.ico holds several sizes');
  assert.equal(fs.readFileSync(file('assets', 'icon.icns')).subarray(0, 4).toString(), 'icns');
});

test('package.json points at icons that exist, and packages the changelog', () => {
  for (const f of [pkg.build.win.icon, pkg.build.mac.icon, pkg.build.nsis.installerIcon]) assert.ok(fs.existsSync(file(f)), f);
  assert.ok(fs.statSync(file(pkg.build.linux.icon)).isDirectory());
  assert.ok(pkg.build.files.includes('CHANGELOG.md'));
  assert.ok(pkg.build.files.includes('assets/**/*'));
});

test('the interface has the logo, no inline script or style, and loads the new scripts in order', () => {
  const html = fs.readFileSync(file('renderer', 'index.html'), 'utf8');
  assert.ok(html.includes('img/logo.svg'));
  assert.ok(!/<script(?![^>]*\bsrc=)/i.test(html), 'no inline script');
  assert.ok(!/\sstyle="/i.test(html), 'no inline style');
  const order = [...html.matchAll(/src="js\/([^"]+)"/g)].map((m) => m[1]);
  assert.ok(order.indexOf('dialmath.js') < order.indexOf('schedmath.js') && order.indexOf('schedmath.js') < order.indexOf('clock.js'));
  assert.ok(order.indexOf('timer.js') < order.indexOf('updates.js') && order.indexOf('updates.js') < order.indexOf('settings.js'));
});

test('motion is switched off when the system asks for less', () => {
  const css = fs.readFileSync(file('renderer', 'style.css'), 'utf8');
  assert.ok((css.match(/prefers-reduced-motion: reduce/g) || []).length >= 2);
  assert.match(css, /prefers-reduced-motion: reduce\)[^}]*\{[^}]*event-bar\.warn/);
});

test('CLAUDE.md points at the standard and is not git-ignored', () => {
  const md = fs.readFileSync(file('CLAUDE.md'), 'utf8');
  assert.ok(md.includes('djgragra/garage-hub') && md.includes('apps/STANDARD.md'));
  assert.ok(!/(^|\n)\s*CLAUDE\.md\s*($|\n)/.test(fs.readFileSync(file('.gitignore'), 'utf8')));
});

test('shared modules carry their garage-common version line', () => {
  const first = (f) => fs.readFileSync(file('src', f), 'utf8').split('\n')[0];
  assert.equal(first('updater.js'), '// garage-common: updater 2');
  assert.equal(first('backup.js'), '// garage-common: backup 1');
  assert.equal(first('logs.js'), '// garage-common: logs 1');
  assert.equal(first('support.js'), '// garage-common: support 1');
});
