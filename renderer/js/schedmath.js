'use strict';

// Which stopset minutes apply now, and the next fixed event. Pure functions (no DOM), unit tested.
// "day" is 0 = Sunday … 6 = Saturday and "secOfDay" is the second of the day, both read in the clock's
// time zone by the caller. Times are wall-clock times: a change of summer time moves nothing here.
GC.schedMath = (() => {
  const DAY = 86400;

  // A grid applies on its days between from and to (minutes of the day, from included, to excluded).
  // to <= from runs past midnight: the day it belongs to is the day it starts.
  function gridMatches(g, day, secOfDay) {
    const from = g.from * 60;
    const to = g.to * 60;
    if (g.from === g.to) return g.days.includes(day);
    if (from < to) return g.days.includes(day) && secOfDay >= from && secOfDay < to;
    return (g.days.includes(day) && secOfDay >= from) || (g.days.includes((day + 6) % 7) && secOfDay < to);
  }

  // -> { marks, grid } : the first matching grid, otherwise the default minutes.
  function activeMarks(breaks, day, secOfDay) {
    for (const g of breaks.grids || []) if (gridMatches(g, day, secOfDay)) return { marks: g.marks, grid: g };
    return { marks: breaks.marks, grid: null };
  }

  // Seconds from now to each occurrence of an event, from today to a week ahead (negative: it was earlier today).
  function* occurrences(ev, day, secOfDay) {
    for (let offset = 0; offset <= 7; offset++) {
      if (!ev.days.includes((day + offset) % 7)) continue;
      yield offset * DAY + ev.time * 60 - secOfDay;
    }
  }

  // -> { event, remaining } for the nearest event still to come (remaining > 0), or null.
  function nextEvent(events, day, secOfDay) {
    let best = null;
    for (const ev of events.list || []) {
      if (!ev.enabled) continue;
      for (const d of occurrences(ev, day, secOfDay)) {
        if (d > 0 && (!best || d < best.remaining)) best = { event: ev, remaining: d };
      }
    }
    return best;
  }

  // The event that started less than `windowSec` seconds ago (the moment to go), or null.
  function activeEvent(events, day, secOfDay, windowSec = 10) {
    for (const ev of events.list || []) {
      if (!ev.enabled) continue;
      for (const d of occurrences(ev, day, secOfDay)) if (d <= 0 && d > -windowSec) return ev;
    }
    return null;
  }

  // 'normal' | 'warn' (inside the warning time) for a countdown to an event.
  const eventState = (ev, remaining) => (remaining <= ev.warnSec ? 'warn' : 'normal');

  // 09:05 for 545
  const hhmm = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

  // "09:05" -> 545 ("24:00" -> 1440), anything else -> null
  function parseHHMM(text) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim());
    if (!m) return null;
    const v = Number(m[1]) * 60 + Number(m[2]);
    return Number(m[2]) < 60 && v <= 1440 ? v : null;
  }

  // h:mm:ss for long waits, mm:ss below one hour
  function countdown(sec) {
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600);
    const p = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${p(Math.floor(s / 60))}:${p(s % 60)}`;
  }

  return { gridMatches, activeMarks, nextEvent, activeEvent, eventState, hhmm, parseHHMM, countdown };
})();
