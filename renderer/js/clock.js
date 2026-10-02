'use strict';

// The studio dial of Studio Clock. 60 segments, one per minute, fill as the hour goes by
// (green → orange → red); the current minute fills second by second. Stopset markers (ad breaks,
// news, jingles at minutes you choose) are larger segments that turn red as they get close.
// In the centre: the date, the time, and how long to the next stopset (to the end of the hour
// when no stopsets are set). The header shows date and time too.
GC.clock = (() => {
  const M = GC.dialMath;
  const NS = 'http://www.w3.org/2000/svg';

  // geometry, in viewBox units (700 x 700)
  const C = 350;
  const R_OUT = 318;
  const R_IN = 270;
  const RM_OUT = 346;
  const RM_IN = 250;
  const LABEL_R = 226;
  const GAP = 0.016;
  const NOW_SECONDS = 10; // how long "NOW" shows at the start of a stopset minute

  const DIM = 'rgba(100,130,180,0.13)';
  const RED = '#e84a2b';
  const MARK_BLUE = '#3b82f6';

  let tz;
  let hour12 = false;
  let showSeconds = true;
  let locale = 'en';
  let dateFmt;
  let dialDateFmt;
  let cfg = { enabled: true, marks: [0, 30], label: 'STOPSET', warnSec: 300 };

  let segs = [];
  let markers = [];
  let sweep;
  const el = {};
  const head = {};
  let last = {};

  const make = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const marksOn = () => (cfg.enabled ? cfg.marks : []);

  function build() {
    const svg = GC.$('dial');
    svg.replaceChildren();
    svg.setAttribute('aria-label', GC.t('dial.aria'));
    segs = [];
    markers = [];
    const marks = marksOn();

    const ring = make('g');
    for (let i = 0; i < 60; i++) {
      if (marks.includes(i)) {
        segs.push(null);
        continue;
      }
      const p = make('path', { d: M.arc(C, C, R_IN, R_OUT, M.angle(i) + GAP, M.angle(i + 1) - GAP), fill: DIM });
      ring.append(p);
      segs.push(p);
    }
    sweep = make('path', { d: '', fill: '#fff' });
    ring.append(sweep);
    svg.append(ring);

    for (const m of marks) {
      const path = make('path', { d: M.arc(C, C, RM_IN, RM_OUT, M.angle(m) + GAP / 2, M.angle(m + 1) - GAP / 2), fill: MARK_BLUE });
      const mid = M.angle(m) + M.SEG / 2;
      const label = make('text', { class: 'dial-mark', x: (C + LABEL_R * Math.cos(mid)).toFixed(1), y: (C + LABEL_R * Math.sin(mid)).toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#60a5fa' });
      label.textContent = ':' + GC.pad(m);
      svg.append(path, label);
      markers.push({ m, path, label, state: '' });
    }

    svg.classList.toggle('noseconds', !showSeconds);
    el.date = make('text', { class: 'dial-date', x: C, y: 200, 'text-anchor': 'middle' });
    el.time = make('text', { class: 'dial-time', x: C, y: 372, 'text-anchor': 'middle' });
    el.hm = make('tspan', { class: 'hm' });
    el.ss = make('tspan', { class: 'ss' });
    el.pm = make('tspan', { class: 'pm', dx: 10 });
    el.time.append(el.hm, el.ss, el.pm);
    el.label = make('text', { class: 'dial-label', x: C, y: 440, 'text-anchor': 'middle' });
    el.count = make('text', { class: 'dial-count', x: C, y: 512, 'text-anchor': 'middle' });
    svg.append(el.date, el.time, el.label, el.count);
    last = {};
  }

  function configure(settings, loc) {
    tz = settings.timeZone === 'system' ? undefined : settings.timeZone;
    hour12 = settings.hour12;
    showSeconds = settings.showSeconds;
    cfg = settings.breaks;
    locale = GC.latn(loc);
    dateFmt = GC.dtf(locale, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
    dialDateFmt = GC.dtf(locale, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
    build();
    for (const id of ['hTime', 'hDate']) head[id] = GC.$(id);
  }

  const setText = (node, key, text) => {
    if (last[key] !== text) {
      last[key] = text;
      node.textContent = text;
    }
  };

  function render(date) {
    if (!el.time) return;
    const t = GC.timeText(date, locale, tz, hour12, true);
    const minute = Number(t.m);
    const second = Number(t.s);
    const sec = minute * 60 + second;
    const marks = marksOn();
    const blink = second % 2 === 0;

    // header: time and date
    setText(head.hTime, 'hTime', (showSeconds ? t.text : `${t.h}:${t.m}`) + (t.period ? ' ' + t.period : ''));
    setText(head.hDate, 'hDate', dateFmt.format(date));

    // ring: whole minutes behind us
    if (last.minute !== minute) {
      last.minute = minute;
      for (let i = 0; i < 60; i++) if (segs[i]) segs[i].setAttribute('fill', i < minute ? M.colorFP((i + 1) / 60) : DIM);
    }
    // the current minute fills second by second
    if (last.sweep !== sec) {
      last.sweep = sec;
      if (segs[minute] && second > 0) {
        const a0 = M.angle(minute) + GAP;
        const a1 = M.angle(minute + 1) - GAP;
        sweep.setAttribute('d', M.arc(C, C, R_IN, R_OUT, a0, a0 + (a1 - a0) * (second / 60)));
        sweep.setAttribute('fill', M.colorFP((minute + second / 60) / 60));
      } else {
        sweep.setAttribute('d', '');
      }
    }
    // stopset markers
    for (const mk of markers) {
      const state = M.markerState(mk.m, sec, cfg.warnSec);
      const key = state === 'active' ? state + (blink ? 'a' : 'b') : state;
      if (key === mk.state) continue;
      mk.state = key;
      const fill = state === 'passed' ? M.colorFP((mk.m + 1) / 60) : state === 'upcoming' ? MARK_BLUE : RED;
      mk.path.setAttribute('fill', fill);
      mk.path.setAttribute('opacity', key === 'activeb' ? '0.3' : '1');
      mk.label.setAttribute('fill', state === 'upcoming' ? '#60a5fa' : state === 'passed' ? 'rgba(160,180,204,0.55)' : '#ff6b35');
    }

    // centre: date, time, countdown
    setText(el.date, 'date', dialDateFmt.format(date));
    setText(el.hm, 'hm', `${t.h}:${t.m}`);
    setText(el.ss, 'ss', showSeconds ? `:${t.s}` : '');
    setText(el.pm, 'pm', t.period);

    let label;
    let value;
    let state = 'normal';
    if (marks.length) {
      label = cfg.label;
      if (M.flashing(sec, marks, NOW_SECONDS)) {
        value = GC.t('dial.now');
        state = 'now';
      } else {
        const next = M.nextStopset(sec, marks);
        value = GC.mmss(next.remaining);
        state = next.remaining <= 60 ? 'blink' : next.remaining <= cfg.warnSec ? 'warn' : 'normal';
      }
    } else {
      label = GC.t('dial.endOfHour');
      const left = 3600 - sec;
      value = GC.mmss(left);
      state = left <= 60 ? 'blink' : left <= cfg.warnSec ? 'warn' : 'normal';
    }
    setText(el.label, 'label', label);
    setText(el.count, 'count', value);
    if (last.state !== state) {
      last.state = state;
      el.count.setAttribute('class', 'dial-count ' + state);
    }
  }

  return { configure, render };
})();
