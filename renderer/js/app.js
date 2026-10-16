'use strict';

// Start-up, mode switch (On Air / Rec), keyboard.
(() => {
  const { $ } = GC;
  const IDLE_MS = 4000;
  let idleTimer = null;
  let lastSecond = -1;

  // ---- applying settings ----
  GC.applySettings = (payload, { rebuild = false } = {}) => {
    GC.state = { ...GC.state, ...payload };
    const s = GC.state.settings;
    GC.setLanguage(GC.state.lang);
    applyTheme(s.theme);
    GC.clock.configure(s, GC.state.locale);
    GC.timer.configure(s.timer);
    GC.news.configure(s, GC.state.locale);
    GC.weather.configure(s);
    GC.links.configure(s);
    GC.talk?.configure(s, payload);
    paintBrand(s);
    paintMode(s.airMode);
    lastSecond = -1;
    tick();
    if (rebuild && GC.settingsUI.isOpen()) GC.settingsUI.render();
  };

  // ---- theme: dark, light or follow the system ----
  const lightQuery = matchMedia('(prefers-color-scheme: light)');
  function applyTheme(theme) {
    const resolved = theme === 'system' ? (lightQuery.matches ? 'light' : 'dark') : theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = resolved;
    GC.talk?.redraw();
  }
  lightQuery.addEventListener('change', () => { if (GC.state.settings?.theme === 'system') applyTheme('system'); });

  function paintBrand(s) {
    const logo = $('logo');
    logo.hidden = !s.logo;
    if (s.logo) logo.src = s.logo;
    else logo.removeAttribute('src');
    $('brandName').hidden = !!s.logo;
  }

  // ---- On Air / Rec ----
  function paintMode(mode) {
    const rec = mode === 'rec';
    document.body.classList.toggle('mode-rec', rec);
    document.body.classList.toggle('mode-onair', !rec);
    $('viewRec').hidden = !rec;
    $('btnOnAir').className = 'tog-btn' + (rec ? '' : ' act-red');
    $('btnRec').className = 'tog-btn' + (rec ? ' act-green' : '');
    const badge = $('clockBadge');
    badge.className = 'clock-badge ' + (rec ? 'recording' : 'onair');
    $('clockBadgeText').textContent = GC.t(rec ? 'mode.rec' : 'mode.onair');
  }

  function setMode(next) {
    const current = GC.state.settings.airMode;
    if (next === current) return;
    // Leaving Rec while the timer is counting would hide it silently: refuse instead.
    if (current === 'rec' && GC.timer.isBusy()) {
      const tog = document.querySelector('header .tog');
      tog.classList.add('deny');
      setTimeout(() => tog.classList.remove('deny'), 500);
      return;
    }
    GC.state.settings.airMode = next;
    paintMode(next);
    window.api.settings.update({ airMode: next });
  }

  // ---- loop ----
  function tick() {
    const now = new Date();
    const sec = Math.floor(now.getTime() / 1000);
    if (sec !== lastSecond) {
      lastSecond = sec;
      GC.clock.render(now);
    }
    GC.updates.syncVisibility(); // the update strip steps aside in full screen and while recording
    GC.timer.render();
  }

  // ---- the cursor hides in full screen after a few seconds ----
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), IDLE_MS);
  }

  // ---- keyboard ----
  function typing(e) {
    const tag = e.target?.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  }

  const isRec = () => GC.state.settings?.airMode === 'rec';

  document.addEventListener('keydown', (e) => {
    wake();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (GC.programs.closeTop()) return;
      if (GC.settingsUI.isOpen()) GC.settingsUI.close();
      else if (GC.timer.isPreroll()) GC.timer.cancelPreroll();
      return;
    }
    if (GC.settingsUI.isOpen() || GC.programs.isAnyOpen() || typing(e)) return;
    const key = e.key.toLowerCase();
    if (e.key === ' ' && isRec()) {
      e.preventDefault();
      document.activeElement?.blur?.();
      GC.timer.toggle();
    } else if (key === 'n' && isRec()) GC.timer.next();
    else if (key === 'r' && isRec()) GC.timer.reset();
    else if (key === 'o') setMode(isRec() ? 'onair' : 'rec');
    else if (key === 's') GC.settingsUI.open();
    else if (key === 'f') window.api.window.toggleFullscreen();
    else if (e.key === 'ArrowRight') GC.news.step(1);
    else if (e.key === 'ArrowLeft') GC.news.step(-1);
  });
  // a button must not also "click" when Space is used as the timer key
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ' && !typing(e) && !GC.settingsUI.isOpen() && !GC.programs.isAnyOpen() && isRec()) e.preventDefault();
  });
  for (const ev of ['mousemove', 'mousedown', 'touchstart']) document.addEventListener(ev, wake, { passive: true });

  // ---- what's new: once, after an update (the bullets of this version from CHANGELOG.md) ----
  async function whatsNew() {
    const wn = await window.api.whatsNew.get();
    if (!wn) return;
    const close = () => {
      $('newOverlay').hidden = true;
      window.api.whatsNew.seen();
    };
    $('newTitle').textContent = GC.t('new.title', { v: wn.version });
    $('newList').replaceChildren(...wn.bullets.map((b) => GC.h('li', { text: b.replace(/[*_`]/g, '') })));
    $('newOverlay').hidden = false;
    for (const id of ['newOk', 'newClose']) $(id).addEventListener('click', close);
    $('newOk').focus();
  }

  // ---- boot ----
  async function boot() {
    GC.timer.init();
    GC.programs.init();
    GC.news.init();
    GC.weather.init();
    GC.settingsUI.init();

    $('btnOnAir').addEventListener('click', () => setMode('onair'));
    $('btnRec').addEventListener('click', () => setMode('rec'));
    $('btnSettings').addEventListener('click', () => GC.settingsUI.open());
    $('btnFullscreen').addEventListener('click', () => window.api.window.toggleFullscreen());

    window.api.on.news((state) => GC.news.update(state));
    window.api.on.weather((state) => GC.weather.update(state));
    window.api.on.fullscreen((on) => {
      document.body.classList.toggle('fullscreen', on);
      GC.updates.syncVisibility();
    });

    GC.applySettings(await window.api.settings.get());
    GC.news.update(await window.api.news.get());
    GC.weather.update(await window.api.weather.get());
    await GC.updates.init();
    setInterval(tick, 100);
    wake();
    whatsNew();
  }

  boot();
})();
