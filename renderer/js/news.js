'use strict';

// One big headline at a time, rotating. Headlines, source and time only: the article text is never fetched.
GC.news = (() => {
  let data = { enabled: false, items: [] };
  let cfg = { enabled: true, rotateSec: 10 };
  let locale = 'en';
  let hour12 = false;
  let index = 0;
  let timer = null;
  let hovering = false;
  let shown = null;

  const $ = GC.$;

  function fmtTime(ts) {
    if (!ts) return '';
    const t = GC.timeText(new Date(ts), locale, undefined, hour12, false);
    return t.text + (t.period ? ' ' + t.period : '');
  }

  function paint() {
    const bar = $('newsBar');
    const items = data.items;
    const active = cfg.enabled && data.enabled !== false;
    bar.hidden = !active;
    if (!active) return;
    if (!items.length) {
      shown = null;
      $('newsMeta').textContent = '';
      $('newsCount').textContent = '';
      const failing = data.feeds?.some((f) => f.enabled && f.error);
      $('newsHeadline').textContent = GC.t(failing ? 'news.unavailable' : 'news.loading');
      $('newsHeadline').classList.add('muted');
      $('newsHeadline').disabled = true;
      return;
    }
    index = ((index % items.length) + items.length) % items.length;
    const n = items[index];
    shown = n;
    const head = $('newsHeadline');
    head.classList.remove('muted');
    head.disabled = false;
    head.classList.remove('in');
    void head.offsetWidth; // restart the fade-in
    head.classList.add('in');
    head.textContent = n.title;
    head.title = GC.t('news.open');
    const time = fmtTime(n.ts);
    $('newsMeta').textContent = n.src + (time ? ' · ' + time : '');
    $('newsCount').textContent = `${index + 1}/${items.length}`;
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (hovering || document.hidden) return;
      index++;
      paint();
    }, cfg.rotateSec * 1000);
  }

  function step(delta) {
    if (!data.items.length) return;
    index += delta;
    paint();
    restart();
  }

  function update(state) {
    data = state;
    if (shown) {
      // keep the current headline on screen when the list refreshes
      const i = state.items.findIndex((n) => n.link === shown.link);
      if (i >= 0) index = i;
    }
    paint();
  }

  function configure(settings, loc) {
    cfg = settings.news;
    locale = GC.latn(loc);
    hour12 = settings.hour12;
    restart();
    paint();
  }

  function init() {
    const head = $('newsHeadline');
    head.addEventListener('click', () => shown && window.api.links.open(shown.link));
    head.addEventListener('mouseenter', () => (hovering = true));
    head.addEventListener('mouseleave', () => (hovering = false));
  }

  return { init, configure, update, step };
})();
