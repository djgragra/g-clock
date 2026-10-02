'use strict';

// Settings panel. Each change is validated and stored by the main process; the interface
// then re-applies whatever came back (GC.applySettings).
GC.settingsUI = (() => {
  const { h, $ } = GC;
  const t = (k, p) => GC.t(k, p);

  const SECTIONS = ['general', 'breaks', 'timer', 'news', 'weather', 'buttons', 'data', 'about'];
  let current = 'general';
  let updateInfo = null;
  const LIMITS = { feeds: 12, links: 8, places: 4 };

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
      row('general.hourFormat', select([['24', t('general.h24')], ['12', t('general.h12')]], s.hour12 ? '12' : '24', (v) => save({ hour12: v === '12' }))),
      row('general.seconds', check(s.showSeconds, (v) => save({ showSeconds: v }))),
      row('general.timezone', h('div', {}, tzInput, h('datalist', { id: 'tzList' }, zones.map((z) => h('option', { value: z })))), 'general.timezoneHint'),
      row('general.alwaysOnTop', check(s.alwaysOnTop, (v) => save({ alwaysOnTop: v })), 'general.alwaysOnTopHint'),
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
      row('breaks.warn', num(b.warnSec, 10, 1800, (v) => save({ breaks: { warnSec: v } })), 'breaks.warnHint')
    );
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

  // ---- Data & updates ----
  function data(s) {
    const m = msg();
    const um = msg();
    const upd = h('div', { class: 'update-box' });
    const paintUpdate = () => {
      upd.replaceChildren();
      if (!updateInfo) return;
      if (!updateInfo.ok) return upd.append(h('div', { class: 'msg err', text: t('upd.error') }));
      if (!updateInfo.available) return upd.append(h('div', { class: 'msg ok', text: t('upd.latest', { v: updateInfo.current }) }));
      const status = h('div', { class: 'msg', text: t('upd.available', { v: updateInfo.latest }) });
      upd.append(status);
      if (!updateInfo.installer || !updateInfo.sumsUrl) {
        upd.append(h('button', { class: 'btn', type: 'button', text: t('upd.openPage'), onclick: () => window.api.links.open(updateInfo.url) }));
        return;
      }
      const go = h('button', { class: 'btn btn-main', type: 'button', text: t('upd.download') });
      go.addEventListener('click', async () => {
        go.disabled = true;
        status.textContent = t('upd.downloading');
        const res = await window.api.updates.download();
        if (!res.ok) {
          status.textContent = t(res.error === 'checksum-mismatch' ? 'upd.checksum' : 'upd.failed');
          status.className = 'msg err';
          go.disabled = false;
          return;
        }
        status.textContent = t('upd.ready');
        status.className = 'msg ok';
        go.replaceWith(h('button', { class: 'btn btn-main', type: 'button', text: t(GC.state.platform === 'win32' ? 'upd.install' : 'upd.reveal'), onclick: () => window.api.updates.install() }));
      });
      upd.append(go, h('div', { class: 'hint', text: t('upd.unsigned') }));
    };
    paintUpdate();
    return section('sec.data', 'data.intro',
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', text: t('data.export'), onclick: async () => {
          const r = await window.api.settings.export();
          if (r.ok) say(m, 'data.exported', 'ok');
          else if (!r.canceled) say(m, 'data.exportFailed', 'err');
        } }),
        h('button', { class: 'btn', type: 'button', text: t('data.import'), onclick: async () => {
          const r = await window.api.settings.import();
          if (r.ok) { GC.applySettings(r, { rebuild: true }); }
          else if (!r.canceled) say(m, r.error === 'foreign' ? 'data.importForeign' : 'data.importInvalid', 'err');
        } }),
        h('button', { class: 'btn', type: 'button', text: t('data.reset'), onclick: async () => {
          const r = await window.api.settings.reset();
          if (r.ok) GC.applySettings(r, { rebuild: true });
        } })),
      m,
      h('p', { class: 'hint', text: t('data.noCredentials') }),
      h('h2', { class: 'sub', text: t('upd.title') }),
      row('upd.auto', check(s.checkUpdates, (v) => save({ checkUpdates: v })), 'upd.autoHint'),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: t('upd.check'), onclick: async () => {
        say(um, 'upd.checking', 'dim');
        updateInfo = await window.api.updates.check();
        say(um, '');
        paintUpdate();
      } })),
      um, upd);
  }

  // ---- About ----
  async function about() {
    const info = await window.api.app.info();
    const link = (url, label) => h('button', { class: 'linkish', type: 'button', text: label, onclick: () => window.api.links.open(url) });
    return section('sec.about', null,
      h('div', { class: 'about-name', text: 'G-Clock' }),
      h('div', { class: 'dim', text: t('about.version', { v: info.version }) }),
      h('p', { text: t('about.desc') }),
      h('dl', { class: 'about-list' },
        h('dt', { text: t('about.author') }), h('dd', { text: 'Graziano Melzi · OnAir Garage' }),
        h('dt', { text: t('about.site') }), h('dd', {}, link('https://onairgarage.com', 'onairgarage.com')),
        h('dt', { text: t('about.contact') }), h('dd', { class: 'mono', text: 'hello@onairgarage.com' }),
        h('dt', { text: t('about.license') }), h('dd', { text: 'MIT · © 2026 Graziano Melzi' }),
        h('dt', { text: t('about.code') }), h('dd', {}, link('https://github.com/djgragra/g-clock', 'github.com/djgragra/g-clock')),
        h('dt', { text: t('about.fonts') }), h('dd', { text: 'Barlow Condensed, Share Tech Mono (SIL OFL 1.1)' }),
        h('dt', { text: t('about.weather') }), h('dd', {}, link('https://open-meteo.com/', 'Open-Meteo.com (CC BY 4.0)'))),
      h('h2', { class: 'sub', text: t('about.keys') }),
      h('dl', { class: 'about-list' },
        ...[['Space', 'keys.space'], ['N', 'keys.next'], ['R', 'keys.reset'], ['O', 'keys.mode'], ['F / F11', 'keys.fullscreen'], ['S', 'keys.settings'], ['← →', 'keys.news'], ['Esc', 'keys.esc']].flatMap(([k, d]) => [h('dt', { class: 'mono', text: k }), h('dd', { text: t(d) })])));
  }

  // ---- shell ----
  async function render() {
    const s = GC.state.settings;
    const nav = $('settingsNav');
    nav.replaceChildren(...SECTIONS.map((id) => h('button', { class: 'nav-item' + (id === current ? ' active' : ''), type: 'button', text: t('sec.' + id), onclick: () => { current = id; render(); } })));
    const builders = { general, breaks, timer, news, weather, buttons, data, about };
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
    $('settings').hidden = true;
    document.body.classList.remove('settings-open');
  }

  function init() {
    $('settingsClose').addEventListener('click', close);
    $('settings').addEventListener('mousedown', (e) => {
      if (e.target === $('settings')) close();
    });
    window.api.on.updateProgress(({ received, total }) => {
      const box = document.querySelector('.update-box .msg');
      if (box && total) box.textContent = t('upd.downloadingPct', { p: Math.round((received / total) * 100) });
    });
  }

  return {
    init, open, close, render,
    isOpen: () => !$('settings').hidden,
    setUpdateInfo: (info) => { updateInfo = info; }
  };
})();
