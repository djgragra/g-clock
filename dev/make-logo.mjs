#!/usr/bin/env node
// Draws assets/logo.svg: the studio dial as a logo. 60 minute segments filling from green to red (the same
// gradient as the clock face), the current minute lit in white, a blue stopset marker at :30, and the
// red ON AIR dot in the middle. Run: node dev/make-logo.mjs   (then dev/make-icons.mjs for the icons)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = 32;
const SEG = (2 * Math.PI) / 60;
const START = -Math.PI / 2 - SEG / 2;
const STOPS = [[0, [34, 197, 94]], [0.5, [245, 166, 35]], [0.85, [232, 74, 43]], [1, [232, 43, 43]]];
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function colour(p) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, c0] = STOPS[i];
    const [p1, c1] = STOPS[i + 1];
    if (p <= p1) return hex(c0.map((v, k) => v + (c1[k] - v) * ((p - p0) / (p1 - p0))));
  }
  return hex(STOPS.at(-1)[1]);
}
const f = (n) => n.toFixed(2);
function arc(r1, r2, a0, a1) {
  const pt = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r2, a1), [x3, y3] = pt(r2, a0);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r2} ${r2} 0 0 0 ${f(x3)} ${f(y3)}Z`;
}
const LIT = 46; // the minute that is "now"
const parts = [];
for (let i = 0; i < 60; i++) {
  const a0 = START + i * SEG + 0.02;
  const a1 = START + (i + 1) * SEG - 0.02;
  if (i === 30) parts.push(`<path d="${arc(17, 29.5, a0 - 0.012, a1 + 0.012)}" fill="#3b82f6"/>`);
  else if (i === LIT) parts.push(`<path d="${arc(20.5, 28, a0, a1)}" fill="#ffffff"/>`);
  else parts.push(`<path d="${arc(20.5, 28, a0, a1)}" fill="${i < LIT ? colour((i + 1) / 60) : '#22304f'}"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#070b16"/>${parts.join('')}<circle cx="${C}" cy="${C}" r="7" fill="#e8321a"/><circle cx="${C}" cy="${C}" r="2.6" fill="#ffffff"/></svg>\n`;
fs.writeFileSync(path.join(root, 'assets', 'logo.svg'), svg);
fs.mkdirSync(path.join(root, 'renderer', 'img'), { recursive: true });
fs.writeFileSync(path.join(root, 'renderer', 'img', 'logo.svg'), svg);
console.log('logo written', svg.length, 'bytes');
