'use strict';

// Optional "next break" counter. The user lists the minutes of the hour at which a break
// (ad break, news, jingle…) is due, e.g. 0 and 30; the counter runs down to the next one.
GC.breaks = (() => {
  const NOW_SECONDS = 10; // how long the "now" state stays on after the mark
  let cfg = { enabled: false, marks: [], label: 'BREAK', warnSec: 60 };
  let last = '';

  function configure(breaks) {
    cfg = breaks;
    last = '';
    const on = cfg.enabled && cfg.marks.length > 0;
    GC.$('breakLine').hidden = !on;
    document.body.classList.toggle('has-break', on);
  }

  function render(secInHour) {
    if (!cfg.enabled || !cfg.marks.length) return;
    const line = GC.$('breakLine');
    let state = 'normal';
    let text;
    const sinceMark = cfg.marks.map((m) => secInHour - m * 60).filter((d) => d >= 0 && d < NOW_SECONDS);
    if (sinceMark.length) {
      state = 'now';
      text = GC.t('break.now');
    } else {
      let remaining = Infinity;
      for (const m of cfg.marks) {
        let d = m * 60 - secInHour;
        if (d <= 0) d += 3600;
        remaining = Math.min(remaining, d);
      }
      text = GC.mmss(remaining);
      if (remaining <= cfg.warnSec) state = 'warn';
    }
    const key = state + text;
    if (key === last) return;
    last = key;
    GC.$('breakLabel').textContent = cfg.label;
    GC.$('breakValue').textContent = text;
    line.className = 'break-line ' + state;
  }

  return { configure, render };
})();
