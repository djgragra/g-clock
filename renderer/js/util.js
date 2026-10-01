'use strict';

// Shared helpers. Every script hangs its public part on the GC namespace (classic scripts,
// loaded in the order given in index.html).
window.GC = window.GC || {};

GC.$ = (id) => document.getElementById(id);

// h('div', { class: 'x', text: 'y', onclick: fn, dataset: { a: 1 } }, child, child…)
// Text always goes in through textContent, never as HTML.
GC.h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
};

GC.pad = (n) => String(n).padStart(2, '0');

// 125 -> "02:05"; minutes may grow past 99 ("100:00")
GC.mmss = (totalSec) => {
  const s = Math.max(0, Math.round(totalSec));
  return GC.pad(Math.floor(s / 60)) + ':' + GC.pad(s % 60);
};

// "5" -> 300 s (a bare number is minutes), "1:30" -> 90 s, anything else -> null
GC.parseDuration = (text) => {
  const s = String(text).trim();
  if (!s) return null;
  if (s.includes(':')) {
    const [m, sec] = s.split(':');
    if (!/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(sec) || Number(sec) > 59) return null;
    return Number(m) * 60 + Number(sec);
  }
  return /^\d{1,2}$/.test(s) ? Number(s) * 60 : null;
};

// Intl formatters are slow to build; keep them per key.
const cache = new Map();
GC.dtf = (locale, options) => {
  const key = locale + JSON.stringify(options);
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(locale, options));
  return cache.get(key);
};

// Locale with Latin digits, so the figures always match the clock font.
GC.latn = (locale) => (locale.includes('-u-') ? locale : `${locale}-u-nu-latn`);

// Time of day in a time zone. 12-hour periods are compacted ("p. m." -> "PM") so they stay short in every language.
GC.timeText = (date, locale, tz, hour12, seconds) => {
  const fmt = GC.dtf(locale, { timeZone: tz, hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', second: '2-digit', hourCycle: hour12 ? 'h12' : 'h23' });
  const p = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  const period = hour12 ? (p.dayPeriod || '').replace(/[.\s]/g, '').toUpperCase() : '';
  return { h: p.hour, m: p.minute, s: p.second, period, text: `${p.hour}:${p.minute}` + (seconds ? `:${p.second}` : '') };
};

GC.state = { settings: null, lang: 'en', locale: 'en', platform: '' };

// Reads a PNG / JPEG / SVG file and returns it resized to at most 512 px on its longest side,
// as a PNG (JPEG stays JPEG) data: URL. SVG is rasterized here, so no vector content is stored.
GC.logoFromFile = (file) =>
  new Promise((resolve, reject) => {
    const MAX = 512;
    if (file.size > 8_000_000 || !/^image\/(png|jpeg|svg\+xml)$/.test(file.type)) return reject(new Error('type'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const w = img.naturalWidth || MAX;
        const h = img.naturalHeight || MAX;
        const scale = file.type === 'image/svg+xml' ? MAX / Math.max(w, h) : Math.min(1, MAX / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(file.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
