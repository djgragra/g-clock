'use strict';

// Headlines of the feeds you chose: a list with one tab per source, a page at a time turning
// every few seconds, plus the scrolling ticker at the bottom. Only headline, source, time and
// link are shown: the article text is never fetched.
GC.news = (() => {
  const PER_PAGE = 6;
  const PALETTE = ['#f5a623', '#a78bfa', '#00a0e4', '#22c55e', '#e84a2b', '#f43f5e', '#facc15'];
  const TICKER_PX_PER_SEC = 70;

  let data = { enabled: false, items: [], feeds: [] };
  let cfg = { enabled: true, ticker: true, rotateSec: 15, feeds: [] };
  let locale = 'en';
  let hour12 = false;
  let page = 0;
  let filter = 'all';
  let timer = null;
  let hovering = false;
  let tickerSig = '';
  let tickerAnim = null;

  const $ = GC.$;

  const colorOf = (src) => {
    const i = cfg.feeds.findIndex((f) => f.name === src);
    return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
  };
  const visible = () => (filter === 'all' ? data.items : data.items.filter((n) => n.src === filter));
  const pages = () => Math.max(1, Math.ceil(visible().length / PER_PAGE));

  function fmtTime(ts) {
    if (!ts) return '';
    const t = GC.timeText(new Date(ts), locale, undefined, hour12, false);
    return t.text + (t.period ? ' ' + t.period : '');
  }

  function paintTabs() {
    const sources = [...new Set(data.items.map((n) => n.src))];
    if (filter !== 'all' && !sources.includes(filter)) filter = 'all';
    const tabs = $('newsTabs');
    tabs.replaceChildren(
      ...['all', ...sources].map((s) => {
        const active = s === filter;
        const b = GC.h('button', { class: 'src-tab' + (active ? ' active' : ''), type: 'button', text: s === 'all' ? GC.t('news.all') : s, onclick: () => { filter = s; page = 0; paintTabs(); paint(); restart(); } });
        if (active && s !== 'all') {
          b.style.background = colorOf(s);
          b.style.borderColor = colorOf(s);
          b.style.color = '#000';
        }
        return b;
      })
    );
  }

  function paint() {
    const active = cfg.enabled && data.enabled !== false;
    $('newsPanel').hidden = !active;
    document.body.classList.toggle('no-news', !active);
    if (!active) return;
    const list = $('newsList');
    const items = visible();
    page = ((page % pages()) + pages()) % pages();

    if (!items.length) {
      const failing = data.feeds?.some((f) => f.enabled && f.error);
      list.replaceChildren(GC.h('div', { class: 'news-empty', text: GC.t(failing ? 'news.unavailable' : 'news.loading') }));
      $('newsCount').textContent = '';
      return;
    }
    list.replaceChildren(
      ...items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map((n) => {
        const time = fmtTime(n.ts);
        const src = GC.h('span', { class: 'ni-src', text: n.src });
        src.style.color = colorOf(n.src);
        return GC.h(
          'button',
          { class: 'ni', type: 'button', title: GC.t('news.open'), onclick: () => window.api.links.open(n.link) },
          src,
          GC.h('span', { class: 'ni-ttl', text: n.title }),
          time && GC.h('span', { class: 'ni-ts', text: time })
        );
      })
    );
    list.classList.remove('in');
    void list.offsetWidth; // restart the fade-in
    list.classList.add('in');
    $('newsCount').textContent = pages() > 1 ? `${page + 1} / ${pages()}` : '';
  }

  // ---- ticker ----
  function paintTicker() {
    const bar = $('ticker');
    const on = cfg.enabled && cfg.ticker && data.items.length > 0 && data.enabled !== false;
    bar.hidden = !on;
    if (!on) {
      tickerAnim?.cancel();
      tickerAnim = null;
      tickerSig = '';
      return;
    }
    const sig = data.items.map((n) => n.link).join('|');
    if (sig === tickerSig) return;
    tickerSig = sig;
    const inner = $('tkInner');
    const build = () => data.items.map((n) => {
      const src = GC.h('span', { class: 'tk-src', text: n.src });
      return GC.h('span', { class: 'tk-item' }, src, n.title);
    });
    inner.replaceChildren(...build());
    requestAnimationFrame(() => {
      const half = inner.scrollWidth;
      if (!half) return;
      inner.append(...build()); // second copy for a seamless loop
      tickerAnim?.cancel();
      tickerAnim = inner.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${half}px)` }], { duration: Math.max(30, half / TICKER_PX_PER_SEC) * 1000, iterations: Infinity, easing: 'linear' });
    });
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (hovering || document.hidden || pages() < 2) return;
      page++;
      paint();
    }, cfg.rotateSec * 1000);
  }

  function step(delta) {
    if (!visible().length) return;
    page += delta;
    paint();
    restart();
  }

  function update(state) {
    data = state;
    paintTabs();
    paint();
    paintTicker();
  }

  function configure(settings, loc) {
    cfg = settings.news;
    locale = GC.latn(loc);
    hour12 = settings.hour12;
    tickerSig = '';
    restart();
    paintTabs();
    paint();
    paintTicker();
  }

  function init() {
    const list = $('newsList');
    list.addEventListener('mouseenter', () => (hovering = true));
    list.addEventListener('mouseleave', () => (hovering = false));
  }

  return { init, configure, update, step };
})();
