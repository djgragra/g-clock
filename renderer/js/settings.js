'use strict';

// Settings panel. Each change is validated and stored by the main process; the interface
// then re-applies whatever came back (GC.applySettings).
GC.settingsUI = (() => {
  const { h, $ } = GC;
  const t = (k, p) => GC.t(k, p);

  const SECTIONS = ['general', 'breaks', 'events', 'timer', 'talk', 'news', 'weather', 'buttons', 'updates', 'backup', 'about'];
  let current = 'general';
  let flash = null; // a message to show once when the Backup page is drawn again after an import
  const LIMITS = { feeds: 12, links: 8, places: 4, grids: 8, events: 20 };

  // ---- small builders ----
  const row = (labelKey, control, hintKey) =>
    h('div', { class: 'field' }, h('div', { class: 'field-label', text: t(labelKey) }), h('div', { class: 'field-control' }, control, hintKey && h('div', { class: 'hint', text: t(hintKey) })));

  const check = (value, onChange, labelKey) => {
    const input = h('input', { type: 'checkbox', checked: value });
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'switch' }, input, h('span', { class: 'switch-track' }), labelKey && h('span', { class: 'switch-text', text: t(labelKey) }));
  };

  const select = (options, value, onChange) => {
    const el = h('select', {}, options.map(([v, label]) => h('option', { value: v, text: label, selected: v === value })));
    el.addEventListener('change', () => onChange(el.value));
    return el;
  };

  const text = (value, onCommit, props = {}) => {
    const el = h('input', { type: 'text', value, spellcheck: false, ...props });
    el.addEventListener('change', () => onCommit(el.value.trim(), el));
    return el;
  };

  const num = (value, min, max, onCommit) => {
    const el = h('input', { type: 'number', value, min, max, class: 'num' });
    el.addEventListener('change', () => onCommit(Math.min(max, Math.max(min, Number(el.value) || min))));
    return el;
  };

  const section = (titleKey, introKey, ...kids) => h('section', {}, h('h2', { text: t(titleKey) }), introKey && h('p', { class: 'intro', text: t(introKey) }), ...kids);
  const msg = () => h('div', { class: 'msg', role: 'status' });
  const say = (el, key, kind = 'ok', params) => {
    el.textContent = key ? t(key, params) : '';
    el.className = 'msg ' + kind;
  };

  async function save(patch, rebuild = false) {
    const payload = await window.api.settings.update(patch);
    GC.applySettings(payload, { rebuild });
    return payload;
  }

  // ---- General ----
  function general(s) {
    const zones = ['UTC', ...(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [])];
    const tzInput = text(s.timeZone === 'system' ? '' : s.timeZone, (v, el) => {
      if (!v || v.toLowerCase() === 'system') return save({ timeZone: 'system' }).then(() => (el.value = ''));
      const zone = zones.find((z) => z.toLowerCase() === v.toLowerCase());
      if (!zone) {
        el.classList.add('err');
        setTimeout(() => el.classList.remove('err'), 800);
        el.value = s.timeZone === 'system' ? '' : s.timeZone;
        return;
      }
      return save({ timeZone: zone }).then(() => (el.value = zone));
    }, { placeholder: t('general.tzSystem'), list: 'tzList' });

    const logoMsg = msg();
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      try {
        const data = await GC.logoFromFile(f);
        const payload = await save({ logo: data }, true);
        if (!payload.settings.logo) say(logoMsg, 'general.logoRejected', 'err');
      } catch {
        say(logoMsg, 'general.logoError', 'err');
      }
    });

    return section('sec.general', null,
      row('general.language', select([['auto', t('general.langAuto')], ['en', 'English'], ['it', 'Italiano'], ['es', 'Español']], s.language, (v) => save({ language: v }, true))),
      row('general.theme', select([['dark', t('general.themeDark')], ['light', t('general.themeLight')], ['system', t('general.themeSystem')]], s.theme, (v) => save({ theme: v }, true))),
      row('general.hourFormat', select([['24', t('general.h24')], ['12', t('general.h12')]], s.hour12 ? '12' : '24', (v) => save({ hour12: v === '12' }))),
      row('general.seconds', check(s.showSeconds, (v) => save({ showSeconds: v }))),
      row('general.timezone', h('div', {}, tzInput, h('datalist', { id: 'tzList' }, zones.map((z) => h('option', { value: z })))), 'general.timezoneHint'),
      row('general.alwaysOnTop', check(s.alwaysOnTop, (v) => save({ alwaysOnTop: v })), 'general.alwaysOnTopHint'),
      row('general.clockOnly', check(s.clockOnly, (v) => save({ clockOnly: v })), 'general.clockOnlyHint'),
      row('general.keepAwake', check(s.keepAwake, (v) => save({ keepAwake: v })), 'general.keepAwakeHint'),
      row('general.logo',
        h('div', {},
          h('div', { class: 'logo-row' },
            s.logo ? h('img', { class: 'logo-preview', src: s.logo, alt: '' }) : h('span', { class: 'hint', text: t('general.noLogo') }),
            h('button', { class: 'btn', type: 'button', text: t('general.logoChoose'), onclick: () => file.click() }),
            s.logo && h('button', { class: 'btn', type: 'button', text: t('general.logoRemove'), onclick: () => save({ logo: null }, true) }),
            file),
          logoMsg),
        'general.logoHint')
    );
  }

  // ---- Break counter ----
  function breaks(s) {
    const b = s.breaks;
    const m = msg();
    return section('sec.breaks', 'breaks.intro',
      row('breaks.enabled', check(b.enabled, (v) => save({ breaks: { enabled: v } }))),
      row('breaks.marks', text(b.marks.join(', '), async (v, el) => {
        const marks = v.split(/[\s,;]+/).filter(Boolean).map(Number);
        if (!marks.length || marks.some((n) => !Number.isInteger(n) || n < 0 || n > 59)) {
          say(m, 'breaks.marksInvalid', 'err');
          el.value = b.marks.join(', ');
          return;
        }
        say(m, '');
        const p = await save({ breaks: { marks } });
        el.value = p.settings.breaks.marks.join(', ');
      }), 'breaks.marksHint'),
      m,
      row('breaks.label', text(b.label, (v) => save({ breaks: { label: v } }), { maxLength: 16 })),
      row('breaks.warn', num(b.warnSec, 10, 1800, (v) => save({ breaks: { warnSec: v } })), 'breaks.warnHint'),
      row('breaks.blink', num(b.blinkSec, 0, 1800, (v) => save({ breaks: { blinkSec: v } })), 'breaks.blinkHint'),
      schedules()
    );
  }

  // ---- shared by schedules and events ----
  const S = () => GC.schedMath;
  const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  const dayName = (d) => GC.dtf(GC.state.locale, { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 7 + d)));

  // Seven day buttons; at least one day stays on.
  const dayChips = (days, onChange) => {
    let now = [...days];
    return h('div', { class: 'days' }, WEEK.map((d) => {
      const b = h('button', { class: 'day' + (now.includes(d) ? ' on' : ''), type: 'button', text: dayName(d), 'aria-pressed': String(now.includes(d)) });
      b.addEventListener('click', () => {
        const next = now.includes(d) ? now.filter((x) => x !== d) : [...now, d].sort();
        if (!next.length) return;
        now = next;
        for (const [i, x] of WEEK.entries()) {
          b.parentElement.children[i].classList.toggle('on', now.includes(x));
          b.parentElement.children[i].setAttribute('aria-pressed', String(now.includes(x)));
        }
        onChange(now);
      });
      return b;
    }));
  };

  // A time field "HH:MM" that says no to anything else and puts the old value back.
  const timeField = (minutes, onCommit, { allow24 = false } = {}) =>
    text(S().hhmm(minutes), (v, el) => {
      const m = S().parseHHMM(v);
      if (m === null || (m === 1440 && !allow24)) {
        el.classList.add('err');
        setTimeout(() => el.classList.remove('err'), 800);
        el.value = S().hhmm(minutes);
        return;
      }
      onCommit(m);
    }, { class: 'time', maxLength: 5, placeholder: 'HH:MM', inputMode: 'numeric' });

  // ---- Stopset schedules (other minutes on certain days and hours) ----
  function schedules() {
    const grids = () => GC.state.settings.breaks.grids;
    const write = (next, rebuild = false) => save({ breaks: { grids: next } }, rebuild);
    const edit = (i, patch, rebuild = false) => write(grids().map((g, j) => (j === i ? { ...g, ...patch } : g)), rebuild);
    const m = msg();
    const cards = grids().map((g, i) => {
      const marksMsg = msg();
      return h('div', { class: 'card' },
        h('div', { class: 'card-row' },
          text(g.name, (v) => edit(i, { name: v }), { maxLength: 24, placeholder: t('sched.name'), class: 'card-name' }),
          h('div', { class: 'range' }, timeField(g.from, (v) => edit(i, { from: v })), h('span', { class: 'dim', text: t('sched.to') }), timeField(g.to, (v) => edit(i, { to: v }), { allow24: true })),
          h('button', { class: 'btn small icon', type: 'button', title: t('common.remove'), 'aria-label': t('common.remove'), text: '✕', onclick: () => write(grids().filter((_, j) => j !== i), true) })),
        dayChips(g.days, (days) => edit(i, { days })),
        h('div', { class: 'card-row' },
          h('span', { class: 'field-label', text: t('sched.marks') }),
          text(g.marks.join(', '), async (v, el) => {
            const marks = v.split(/[\s,;]+/).filter(Boolean).map(Number);
            if (marks.some((n) => !Number.isInteger(n) || n < 0 || n > 59)) {
              say(marksMsg, 'breaks.marksInvalid', 'err');
              el.value = g.marks.join(', ');
              return;
            }
            say(marksMsg, '');
            const p = await edit(i, { marks });
            el.value = p.settings.breaks.grids[i].marks.join(', ');
          }, { placeholder: '0, 30' })),
        marksMsg);
    });
    return h('div', { class: 'block' },
      h('h2', { class: 'sub', text: t('sched.title') }),
      h('p', { class: 'intro', text: t('sched.intro') }),
      cards.length ? h('div', { class: 'cards' }, cards) : h('p', { class: 'hint', text: t('sched.empty') }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: t('sched.add'), onclick: () => {
        if (grids().length >= LIMITS.grids) return say(m, 'sched.max', 'err', { n: LIMITS.grids });
        write([...grids(), { name: t('sched.newName', { n: grids().length + 1 }), days: [1, 2, 3, 4, 5], from: 0, to: 1440, marks: [0, 30] }], true);
      } })),
      m,
      h('p', { class: 'hint', text: t('sched.note') }));
  }

  // ---- Events: fixed times of day with a countdown ----
  function events(s) {
    const list = () => GC.state.settings.events.list;
    const write = (next, rebuild = false) => save({ events: { list: next } }, rebuild);
    const edit = (i, patch, rebuild = false) => write(list().map((e, j) => (j === i ? { ...e, ...patch } : e)), rebuild);
    const m = msg();
    const cards = s.events.list.map((e, i) =>
      h('div', { class: 'card' },
        h('div', { class: 'card-row' },
          check(e.enabled, (v) => edit(i, { enabled: v })),
          text(e.label, (v) => edit(i, { label: v || t('ev.newLabel') }), { maxLength: 24, placeholder: t('ev.label'), class: 'card-name' }),
          timeField(e.time, (v) => edit(i, { time: v })),
          h('button', { class: 'btn small icon', type: 'button', title: t('common.remove'), 'aria-label': t('common.remove'), text: '✕', onclick: () => write(list().filter((_, j) => j !== i), true) })),
        dayChips(e.days, (days) => edit(i, { days })),
        h('div', { class: 'card-row' },
          h('span', { class: 'field-label', text: t('ev.warn') }),
          num(e.warnSec, 5, 3600, (v) => edit(i, { warnSec: v })),
          h('span', { class: 'dim', text: t('ev.warnUnit') }))));
    return section('sec.events', 'ev.intro',
      row('ev.enabled', check(s.events.enabled, (v) => save({ events: { enabled: v } }))),
      cards.length ? h('div', { class: 'cards' }, cards) : h('p', { class: 'hint', text: t('ev.empty') }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: t('ev.add'), onclick: () => {
        if (list().length >= LIMITS.events) return say(m, 'ev.max', 'err', { n: LIMITS.events });
        write([...list(), { label: t('ev.newLabel'), time: 18 * 60, days: [0, 1, 2, 3, 4, 5, 6], warnSec: 60, enabled: true }], true);
      } })),
      m,
      h('p', { class: 'hint', text: t('ev.note') }));
  }

  // ---- Timer ----
  function timer(s) {
    const tm = s.timer;
    const m = msg();
    return section('sec.timer', 'timer.intro',
      row('timer.presets', text(tm.presets.map(GC.mmss).join(', '), async (v, el) => {
        const list = v.split(/[\s,;]+/).filter(Boolean).map(GC.parseDuration);
        if (!list.length || list.some((x) => x === null || x < 1)) {
          say(m, 'timer.presetsInvalid', 'err');
          el.value = tm.presets.map(GC.mmss).join(', ');
          return;
        }
        say(m, '');
        const p = await save({ timer: { presets: list } });
        el.value = p.settings.timer.presets.map(GC.mmss).join(', ');
      }), 'timer.presetsHint'),
      m,
      row('timer.preroll', check(tm.preroll, (v) => save({ timer: { preroll: v } })), 'timer.prerollHint'),
      row('timer.dynamic', check(tm.dynamic, (v) => save({ timer: { dynamic: v } })), 'timer.dynamicHint'),
      row('timer.sound', check(tm.sound, (v) => save({ timer: { sound: v } })), 'timer.soundHint')
    );
  }

  // ---- News ----
  function statusOf(f) {
    if (!f.enabled) return t('news.off');
    if (f.error) return t('news.error', { e: f.error });
    return f.fetchedAt ? t('news.ok', { n: f.count }) : t('news.loading');
  }

  async function news(s, box) {
    const n = s.news;
    const state = await window.api.news.get();
    const status = new Map(state.feeds.map((f) => [f.id, f]));
    const m = msg();
    const write = (patch, rebuild) => save({ news: patch }, rebuild);
    const list = h('div', { class: 'list' },
      n.feeds.map((f, i) =>
        h('div', { class: 'list-row' },
          check(f.enabled, (v) => write({ feeds: n.feeds.map((x, j) => (j === i ? { ...x, enabled: v } : x)) }, true)),
          h('div', { class: 'grow' }, h('div', { class: 'strong', text: f.name }), h('div', { class: 'mono dim small-text', text: f.url })),
          h('span', { class: status.get(f.id)?.error ? 'dim err-text' : 'dim', text: status.get(f.id) ? statusOf(status.get(f.id)) : '' }),
          h('button', { class: 'btn small', type: 'button', text: t('common.remove'), onclick: () => write({ feeds: n.feeds.filter((_, j) => j !== i) }, true) })
        )
      ));
    const name = text('', () => {}, { placeholder: t('news.feedName'), maxLength: 40 });
    const url = text('', () => {}, { placeholder: 'https://…', class: 'grow' });
    const addFeed = (feed) => {
      if (n.feeds.length >= LIMITS.feeds) return say(m, 'news.max', 'err', { n: LIMITS.feeds });
      if (!/^https:\/\//i.test(feed.url)) return say(m, 'news.httpsOnly', 'err');
      if (n.feeds.some((f) => f.url === feed.url)) return say(m, 'news.duplicate', 'err');
      say(m, '');
      write({ feeds: [...n.feeds, { name: feed.name, url: feed.url, enabled: true }] }, true);
    };
    const suggestions = (GC.state.suggestedFeeds || []).filter((f) => !n.feeds.some((x) => x.url === f.url));
    return section('sec.news', 'news.intro',
      row('news.enabled', check(n.enabled, (v) => write({ enabled: v }))),
      row('news.tickerRow', check(n.ticker, (v) => write({ ticker: v })), 'news.tickerHint'),
      list,
      h('div', { class: 'list-row add' }, name, url, h('button', { class: 'btn', type: 'button', text: t('common.add'), onclick: () => addFeed({ name: name.value.trim() || (url.value.match(/^https:\/\/([^/]+)/i) || [])[1] || '', url: url.value.trim() }) })),
      m,
      suggestions.length && h('div', { class: 'suggest' }, h('div', { class: 'field-label', text: t('news.suggested') }), h('div', { class: 'chips' }, suggestions.map((f) => h('button', { class: 'chip', type: 'button', text: '+ ' + f.name, onclick: () => addFeed(f) })))),
      h('p', { class: 'hint', text: t('news.termsHint') }),
      row('news.interval', num(n.intervalMin, 2, 120, (v) => write({ intervalMin: v })), 'news.intervalHint'),
      row('news.rotate', num(n.rotateSec, 4, 60, (v) => write({ rotateSec: v })), 'news.rotateHint'),
      h('button', { class: 'btn', type: 'button', text: t('news.refreshNow'), onclick: async () => { await window.api.news.refresh(); if (current === 'news') render(); } })
    );
  }

  // ---- Weather ----
  function weather(s) {
    const w = s.weather;
    const m = msg();
    const results = h('div', { class: 'list' });
    const write = (patch, rebuild = true) => save({ weather: patch }, rebuild);
    const q = text('', () => {}, { placeholder: t('wx.search'), class: 'grow' });
    const search = async () => {
      say(m, '');
      results.replaceChildren();
      if (q.value.trim().length < 2) return;
      const res = await window.api.weather.geocode(q.value);
      if (!res.ok) return say(m, 'wx.searchError', 'err');
      if (!res.results.length) return say(m, 'wx.noResults', 'dim');
      results.replaceChildren(...res.results.map((r) =>
        h('div', { class: 'list-row' },
          h('div', { class: 'grow' }, h('div', { class: 'strong', text: r.name }), h('div', { class: 'dim small-text', text: r.detail })),
          h('button', { class: 'btn small', type: 'button', text: t('common.add'), onclick: () => {
            if (w.places.length >= LIMITS.places) return say(m, 'wx.max', 'err', { n: LIMITS.places });
            write({ places: [...w.places, { name: r.name, detail: r.detail, lat: r.lat, lon: r.lon }] });
          } })
        )));
    };
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
    return section('sec.weather', 'wx.intro',
      row('wx.enabled', check(w.enabled, (v) => write({ enabled: v })), 'wx.enabledHint'),
      row('wx.unit', select([['c', '°C'], ['f', '°F']], w.unit, (v) => write({ unit: v }, false))),
      h('div', { class: 'list' }, w.places.map((p, i) =>
        h('div', { class: 'list-row' },
          h('div', { class: 'grow' }, h('div', { class: 'strong', text: p.name }), h('div', { class: 'dim small-text', text: p.detail })),
          h('button', { class: 'btn small', type: 'button', text: t('common.remove'), onclick: () => write({ places: w.places.filter((_, j) => j !== i) }) })))),
      h('div', { class: 'list-row add' }, q, h('button', { class: 'btn', type: 'button', text: t('wx.searchBtn'), onclick: search })),
      m, results,
      h('p', { class: 'hint', text: t('wx.attribution') }),
      h('button', { class: 'btn', type: 'button', text: t('wx.terms'), onclick: () => window.api.links.open('https://open-meteo.com/') })
    );
  }

  // ---- Buttons ----
  const SUGGESTIONS = [
    { key: 'guest', label: 'ipDTL', url: 'https://www.ipdtl.com' },
    { key: 'meet', label: 'Google Meet', url: 'https://meet.google.com' },
    { key: 'jitsi', label: 'Jitsi Meet', url: 'https://meet.jit.si' },
    { key: 'zoom', label: 'Zoom', url: 'https://zoom.us/join' },
    { key: 'cam', url: '' },
    { key: 'site', url: '' },
    { key: 'chat', url: '' },
    { key: 'traffic', url: '' }
  ];
  // brand names stay as they are; the generic ideas get a label in the interface language
  const ideaLabel = (x) => x.label || t('btn.ideaLabel.' + x.key);

  function buttons(s) {
    const m = msg();
    const write = (list) => save({ links: list }, true);
    const label = text('', () => {}, { placeholder: t('btn.label'), maxLength: 24 });
    const url = text('', () => {}, { placeholder: 'https://…', class: 'grow' });
    const note = text('', () => {}, { placeholder: t('btn.note'), maxLength: 300, class: 'grow' });
    const add = () => {
      if (s.links.length >= LIMITS.links) return say(m, 'btn.max', 'err', { n: LIMITS.links });
      if (!/^https?:\/\//i.test(url.value.trim())) return say(m, 'btn.urlInvalid', 'err');
      write([...s.links, { label: label.value.trim(), url: url.value.trim(), note: note.value.trim() }]);
    };
    const list = h('div', { class: 'list' },
      s.links.map((l, i) =>
        h('div', { class: 'list-row' },
          h('div', { class: 'grow' },
            h('div', { class: 'strong', text: l.label }),
            h('div', { class: 'mono dim small-text', text: l.url }),
            l.note && h('div', { class: 'dim small-text', text: l.note })),
          h('button', { class: 'btn small', type: 'button', text: t('btn.test'), onclick: () => window.api.links.open(l.url) }),
          h('button', { class: 'btn small', type: 'button', text: t('common.remove'), onclick: () => write(s.links.filter((_, j) => j !== i)) })
        )
      ));
    const suggest = h('div', { class: 'suggest' },
      h('div', { class: 'field-label', text: t('btn.suggestions') }),
      h('div', { class: 'ideas' }, SUGGESTIONS.map((x) =>
        h('button', { class: 'idea', type: 'button', onclick: () => {
          label.value = ideaLabel(x);
          url.value = x.url;
          note.value = t('btn.idea.' + x.key);
          (x.url ? label : url).focus();
          say(m, x.url ? 'btn.ideaFilled' : 'btn.ideaNeedsUrl', 'dim');
        } }, h('span', { class: 'strong', text: ideaLabel(x) }), h('span', { class: 'dim small-text', text: t('btn.idea.' + x.key) })))));
    return section('sec.buttons', 'btn.intro',
      h('ul', { class: 'howto' }, ['btn.how1', 'btn.how2', 'btn.how3'].map((k) => h('li', { text: t(k) }))),
      list,
      h('div', { class: 'list-row add' }, label, url),
      h('div', { class: 'list-row add' }, note, h('button', { class: 'btn', type: 'button', text: t('common.add'), onclick: add })),
      m, suggest);
  }

  // ---- Updates (the same states as the strip under the header) ----
  function updates(s) {
    const um = msg();
    const box = h('div', { class: 'update-box' });
    GC.updates.mountBox(box);
    const last = h('div', { class: 'hint', text: GC.updates.lastCheckText() });
    return section('sec.updates', 'upd.intro',
      row('upd.auto', check(s.checkUpdates, (v) => save({ checkUpdates: v })), 'upd.autoHint'),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: t('upd.check'), onclick: async () => {
        say(um, 'upd.checking', 'dim');
        await GC.updates.check();
        say(um, '');
        last.textContent = GC.updates.lastCheckText();
      } })),
      last, um, box);
  }

  // ---- Backup and restore (the same box in every OnAir Garage app) ----
  function backup() {
    const m = msg();
    if (flash) {
      say(m, flash.key, flash.kind);
      flash = null;
    }
    return section('sec.backup', null,
      h('h2', { class: 'sub', text: t('bk.title') }),
      h('p', { class: 'intro', text: t('bk.note') }),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', text: t('bk.export'), onclick: async () => {
          const r = await window.api.backup.export();
          if (r.ok) say(m, 'bk.exported', 'ok');
          else if (!r.canceled) say(m, 'bk.exportFailed', 'err');
        } }),
        h('button', { class: 'btn', type: 'button', text: t('bk.import'), onclick: async () => {
          const r = await window.api.backup.import();
          if (r.ok) {
            flash = { key: r.mode === 'replace' ? 'bk.importedReplace' : 'bk.importedAdd', kind: 'ok' };
            GC.applySettings(r, { rebuild: true });
          } else if (!r.canceled) say(m, r.error === 'foreign' ? 'bk.importForeign' : r.error === 'too-large' ? 'bk.importTooLarge' : 'bk.importInvalid', 'err');
        } })),
      m,
      h('p', { class: 'hint', text: t('bk.noSecrets') }),
      h('h2', { class: 'sub', text: t('bk.resetTitle') }),
      h('p', { class: 'hint', text: t('bk.resetNote') }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: t('data.reset'), onclick: async () => {
        const r = await window.api.settings.reset();
        if (r.ok) GC.applySettings(r, { rebuild: true });
      } })));
  }

  // ---- Help & About ----
  async function about() {
    const openTip = () => window.api.links.open(t('about.tipUrl'));
    const info = await window.api.app.info();
    const m = msg();
    const link = (url, label) => h('button', { class: 'linkish', type: 'button', text: label, onclick: () => window.api.links.open(url) });
    const credits = [
      ['Electron', 'MIT'], ['electron-store', 'MIT'], ['fast-xml-parser', 'MIT'],
      ['Barlow Condensed, Share Tech Mono', 'SIL OFL 1.1'], ['Open-Meteo.com', 'CC BY 4.0']
    ];
    return section('sec.about', null,
      h('div', { class: 'about-head' }, h('img', { class: 'about-logo', src: 'img/logo.svg', alt: '' }), h('div', {}, h('div', { class: 'about-name', text: 'G-Clock' }), h('div', { class: 'dim', text: t('about.version', { v: info.version }) }))),
      h('p', { text: t('about.desc') }),
      h('dl', { class: 'about-list' },
        h('dt', { text: t('about.system') }), h('dd', { text: `${info.platform} ${info.arch} · Electron ${info.electron}` }),
        h('dt', { text: t('about.author') }), h('dd', { text: 'Graziano Melzi · OnAir Garage' }),
        h('dt', { text: t('about.license') }), h('dd', { text: 'MIT · © 2026 Graziano Melzi' }),
        h('dt', { text: t('about.links') }), h('dd', { class: 'links' },
          link('https://onairgarage.com/tools/g-clock/', t('about.toolPage')),
          link('https://github.com/djgragra/g-clock/releases/latest', t('about.releases')),
          link('https://github.com/djgragra/g-clock/blob/main/README.md', t('about.manual')),
          link('https://github.com/djgragra/g-clock', t('about.code'))),
        h('dt', { text: t('about.contact') }), h('dd', { class: 'mono', text: 'hello@onairgarage.com' })),
      h('h2', { class: 'sub', text: t('about.credits') }),
      h('ul', { class: 'howto' }, credits.map(([name, licence]) => h('li', { text: `${name} — ${licence}` }))),
      h('p', { class: 'hint', text: t('about.privacy') }),
      h('h2', { class: 'sub', text: t('about.support') }),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', text: t('about.copySupport'), onclick: async () => {
          await window.api.clipboard.write(await window.api.app.supportInfo());
          say(m, 'about.copied', 'ok');
        } }),
        h('button', { class: 'btn', type: 'button', text: t('about.openLogs'), onclick: async () => {
          const r = await window.api.app.openLogs();
          if (!r.ok) say(m, 'about.logsFailed', 'err');
        } }),
        h('button', { class: 'btn', type: 'button', text: t('upd.check'), onclick: async () => {
          say(m, 'upd.checking', 'dim');
          await GC.updates.check();
          const i = GC.updates.hasUpdate();
          say(m, i ? 'upd.foundSee' : 'upd.uptodate', 'ok');
        } })),
      m,
      h('p', { class: 'hint', text: t('about.supportHint') }),
      h('h2', { class: 'sub', text: t('about.unsignedTitle') }),
      h('p', { class: 'hint', text: t('about.unsigned') }),
      h('h2', { class: 'sub', text: t('about.keys') }),
      h('dl', { class: 'about-list' },
        ...[['Space', 'keys.space'], ['N', 'keys.next'], ['R', 'keys.reset'], ['O', 'keys.mode'], ['C', 'keys.clockOnly'], ['F / F11', 'keys.fullscreen'], ['S', 'keys.settings'], ['← →', 'keys.news'], ['Esc', 'keys.esc']].flatMap(([k, d]) => [h('dt', { class: 'mono', text: k }), h('dd', { text: t(d) })])),
      // the tip jar: one card at the bottom of this page, nowhere else (apps/COMMON-FEATURES.md, section 6)
      h('aside', { class: 'tip-card' },
        // the jar is a second link to the same page as the pill; keyboard and screen readers keep the pill only
        h('span', { class: 'tip-jar-link', 'aria-hidden': 'true', tabindex: '-1', onclick: openTip },
          h('img', { class: 'tip-jar', src: 'img/tip-jar.png', alt: '', width: 176, height: 130 })),
        h('div', { class: 'tip-body' },
          h('p', { class: 'tip-text', text: t('about.tipText') }),
          h('button', { class: 'tip-pill', type: 'button', text: t('about.tipButton'), onclick: openTip }))));
  }

  // ---- shell ----
  async function render() {
    const s = GC.state.settings;
    const nav = $('settingsNav');
    nav.replaceChildren(...SECTIONS.map((id) => h('button', { class: 'nav-item' + (id === current ? ' active' : ''), type: 'button', text: t('sec.' + id), onclick: () => { GC.talkSettings?.close(); current = id; render(); } })));
    const builders = { general, breaks, events, timer, talk: () => GC.talkSettings.build(), news, weather, buttons, updates, backup, about };
    const body = $('settingsContent');
    const scroll = body.scrollTop;
    const content = await builders[current](s);
    body.replaceChildren(content);
    body.scrollTop = scroll;
  }

  function open(sectionId) {
    if (sectionId) current = sectionId;
    $('settings').hidden = false;
    document.body.classList.add('settings-open');
    render();
    $('settingsPanel').focus();
  }

  function close() {
    GC.talkSettings?.close();
    $('settings').hidden = true;
    document.body.classList.remove('settings-open');
  }

  function init() {
    $('settingsClose').addEventListener('click', close);
    $('settings').addEventListener('mousedown', (e) => {
      if (e.target === $('settings')) close();
    });
  }

  return {
    init, open, close, render, save,
    isOpen: () => !$('settings').hidden,
    current: () => current
  };
})();
