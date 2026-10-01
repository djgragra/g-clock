'use strict';

// The big clock: time of day and date, in the chosen time zone and 12/24 h format.
GC.clock = (() => {
  let tz;
  let hour12 = false;
  let showSeconds = true;
  let locale = 'en';
  let dateFmt;
  let miniDateFmt;
  let last = { time: '', mini: '', period: '', date: '' };

  const el = {};

  function configure(settings, loc) {
    tz = settings.timeZone === 'system' ? undefined : settings.timeZone;
    hour12 = settings.hour12;
    showSeconds = settings.showSeconds;
    locale = GC.latn(loc);
    dateFmt = GC.dtf(locale, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    miniDateFmt = GC.dtf(locale, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
    document.body.classList.toggle('show-seconds', showSeconds);
    last = { time: '', mini: '', period: '', date: '' };
  }

  // Seconds elapsed in the current hour of the clock's time zone (used by the break counter).
  function secInHour(date) {
    const t = GC.timeText(date, locale, tz, hour12, true);
    return Number(t.m) * 60 + Number(t.s);
  }

  function render(date) {
    el.time ||= GC.$('clockTime');
    el.period ||= GC.$('clockPeriod');
    el.date ||= GC.$('clockDate');
    el.mini ||= GC.$('miniTime');
    el.miniDate ||= GC.$('miniDate');
    const t = GC.timeText(date, locale, tz, hour12, true);
    const main = showSeconds ? t.text : `${t.h}:${t.m}`;
    if (main !== last.time) el.time.textContent = last.time = main;
    if (t.text !== last.mini) el.mini.textContent = last.mini = t.text;
    if (t.period !== last.period) {
      last.period = t.period;
      el.period.textContent = t.period;
      el.period.hidden = !t.period;
    }
    const d = dateFmt.format(date);
    if (d !== last.date) {
      last.date = d;
      el.date.textContent = d;
      el.miniDate.textContent = miniDateFmt.format(date);
    }
  }

  return { configure, render, secInHour };
})();
