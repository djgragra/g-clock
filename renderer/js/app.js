'use strict';

// Start-up, mode switch (On Air / Rec), keyboard, quiet controls.
(() => {
  const { $ } = GC;
  const IDLE_MS = 4000;
  let idleTimer = null;
  let overChrome = false;
  let lastSecond = -1;

  // ---- applying settings ----
  GC.applySettings = (payload, { rebuild = false } = {}) => {
    GC.state = { ...GC.state, ...payload };
    const s = GC.state.settings;
    GC.setLanguage(GC.state.lang);
    GC.clock.configure(s, GC.state.locale);
    GC.breaks.configure(s.breaks);
    GC.cities.configure(s, GC.state.locale);
    GC.timer.configure(s.timer);
    GC.news.configure(s, GC.state.locale);
    GC.weather.configure(s);
    GC.links.configure(s);
    paintBrand(s);
    paintMode(s.airMode);
    lastSecond = -1;
    tick();
    if (rebuild && GC.settingsUI.isOpen()) GC.settingsUI.render();
  };

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
    $('viewClock').hidden = rec;
    $('viewRec').hidden = !rec;
    $('modeText').textContent = GC.t(rec ? 'mode.rec' : 'mode.onair');
  }

  function toggleMode() {
    // Leaving Rec while the timer is counting would hide it silently: refuse instead.
    if (GC.state.settings.airMode === 'rec' && GC.timer.isBusy()) {
      const badge = $('modeBadge');
      badge.classList.add('deny');
      setTimeout(() => badge.classList.remove('deny'), 500);
      return;
    }
    const next = GC.state.settings.airMode === 'rec' ? 'onair' : 'rec';
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
      GC.breaks.render(GC.clock.secInHour(now));
      GC.cities.render(now);
    }
    GC.timer.render();
  }

  // ---- quiet controls: buttons fade after a few seconds without mouse or keyboard ----
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const busy = GC.settingsUI.isOpen() || overChrome || document.activeElement?.closest?.('.chrome, .timer-controls');
      if (!busy) document.body.classList.add('idle');
      else wake();
    }, IDLE_MS);
  }

  // ---- keyboard ----
  function typing(e) {
    const tag = e.target?.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  }

  document.addEventListener('keydown', (e) => {
    wake();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (GC.settingsUI.isOpen()) GC.settingsUI.close();
      else if (GC.timer.isPreroll()) GC.timer.cancelPreroll();
      return;
    }
    if (GC.settingsUI.isOpen() || typing(e)) return;
    const key = e.key.toLowerCase();
    if (e.key === ' ' && GC.state.settings.airMode === 'rec') {
      e.preventDefault();
      document.activeElement?.blur?.();
      GC.timer.toggle();
    } else if (key === 'r' && GC.state.settings.airMode === 'rec') GC.timer.reset();
    else if (key === 'o') toggleMode();
    else if (key === 's') GC.settingsUI.open();
    else if (e.key === 'ArrowRight') GC.news.step(1);
    else if (e.key === 'ArrowLeft') GC.news.step(-1);
  });
  // a button must not also "click" when Space is used as the timer key
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ' && !typing(e) && !GC.settingsUI.isOpen() && GC.state.settings?.airMode === 'rec') e.preventDefault();
  });
  for (const ev of ['mousemove', 'mousedown', 'touchstart']) document.addEventListener(ev, wake, { passive: true });

  function toast(text, ms = 12000) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    setTimeout(() => (el.hidden = true), ms);
  }

  // ---- boot ----
  async function boot() {
    GC.timer.init();
    GC.news.init();
    GC.weather.init();
    GC.settingsUI.init();

    $('modeBadge').addEventListener('click', toggleMode);
    $('btnSettings').addEventListener('click', () => GC.settingsUI.open());
    $('btnFullscreen').addEventListener('click', () => window.api.window.toggleFullscreen());
    for (const el of document.querySelectorAll('.chrome')) {
      el.addEventListener('mouseenter', () => (overChrome = true));
      el.addEventListener('mouseleave', () => (overChrome = false));
    }

    window.api.on.news((state) => GC.news.update(state));
    window.api.on.weather((state) => GC.weather.update(state));
    window.api.on.fullscreen((on) => document.body.classList.toggle('fullscreen', on));
    window.api.on.updateAvailable((info) => {
      GC.settingsUI.setUpdateInfo(info);
      $('btnSettings').classList.add('has-update');
      if (!GC.timer.isBusy()) toast(GC.t('upd.toast', { v: info.latest }));
    });

    GC.applySettings(await window.api.settings.get());
    GC.news.update(await window.api.news.get());
    GC.weather.update(await window.api.weather.get());
    setInterval(tick, 100);
    wake();
  }

  boot();
})();
