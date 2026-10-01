'use strict';

// Strip of clocks for other cities / time zones.
GC.cities = (() => {
  let list = [];
  let locale = 'en';
  let hour12 = false;
  let els = [];
  let lastTick = -1;

  function configure(settings, loc) {
    list = settings.cities;
    locale = GC.latn(loc);
    hour12 = settings.hour12;
    const box = GC.$('cities');
    box.replaceChildren();
    box.hidden = !list.length;
    els = list.map((c) => {
      const name = GC.h('div', { class: 'card-name', text: c.name });
      const time = GC.h('div', { class: 'card-time' });
      const period = GC.h('span', { class: 'card-period' });
      const day = GC.h('div', { class: 'card-sub' });
      box.append(GC.h('div', { class: 'card' }, name, time, day));
      return { time, period, day, c, lastTime: '', lastDay: '' };
    });
    lastTick = -1;
  }

  function render(date) {
    const minute = Math.floor(date.getTime() / 60000);
    if (minute === lastTick) return;
    lastTick = minute;
    for (const e of els) {
      const t = GC.timeText(date, locale, e.c.tz, hour12, false);
      const d = GC.dtf(locale, { timeZone: e.c.tz, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
      if (t.text + t.period !== e.lastTime) {
        e.lastTime = t.text + t.period;
        e.time.textContent = t.text;
        e.period.textContent = t.period;
        if (t.period) e.time.append(e.period);
      }
      if (d !== e.lastDay) e.day.textContent = e.lastDay = d;
    }
  }

  return { configure, render };
})();
