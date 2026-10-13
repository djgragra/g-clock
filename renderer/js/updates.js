'use strict';

// Guided update, the same in every OnAir Garage app (apps/COMMON-FEATURES.md, section 4): one state machine drawn in
// two places, the strip under the header and Settings → Updates. The strip never covers the dial: it stays hidden
// in full screen and while the recording timer runs. Nothing is installed without a click.
GC.updates = (() => {
  const { h, $ } = GC;
  const t = (k, p) => GC.t(k, p);

  let view = null; // what the main process says: { info, banner, lastCheck, downloaded }
  let phase = 'idle'; // idle | downloading | ready | error
  let progress = null; // { received, total }
  let errorKey = '';
  let hint = ''; // 'mac' | 'linux' after "install"
  let checking = false;
  const boxes = new Set(); // Settings → Updates containers currently on screen

  const info = () => view?.info;
  const mb = (n) => (n / 1048576).toFixed(1);
  const canShowBanner = () => !document.body.classList.contains('fullscreen') && !GC.timer.isBusy();

  const errorFor = (code) => ({ 'checksum-mismatch': 'upd.checksum', stalled: 'upd.stalled', 'no-checksums': 'upd.failed' })[code] || 'upd.failed';

  // ---- one drawing for both places ----
  function paint(into, { banner }) {
    into.replaceChildren();
    const i = info();
    if (!i) return;
    if (!i.ok) {
      if (!banner) into.append(h('div', { class: 'msg err', text: t('upd.error') }));
      return;
    }
    if (!i.available && phase === 'idle') {
      if (!banner) into.append(h('div', { class: 'msg ok', text: t('upd.latest', { v: i.current }) }));
      return;
    }
    const btn = (key, onclick, main = false) => h('button', { class: 'btn' + (main ? ' btn-main' : ' ghost') + (banner ? ' compact' : ''), type: 'button', text: t(key), onclick });
    const notes = i.notes ? h('div', { class: 'upd-notes', text: i.notes }) : null;
    const head = h('div', { class: 'upd-title', text: t('upd.bannerAvailable', { v: i.latest, c: i.current }) });

    if (phase === 'downloading') {
      const pct = progress?.total ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : null;
      const fill = h('div', { class: 'upd-fill' });
      fill.style.width = (pct ?? 0) + '%';
      const label = pct === null ? t('upd.downloadingUnknown', { a: mb(progress?.received || 0) }) : t('upd.downloadingMb', { p: pct, a: mb(progress.received), b: mb(progress.total) });
      into.append(head, h('div', { class: 'upd-bar', role: 'progressbar', 'aria-valuenow': pct ?? 0, 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill), h('div', { class: 'upd-line' }, h('span', { class: 'upd-status', text: label }), btn('upd.cancel', cancel)));
    } else if (phase === 'ready') {
      const win = GC.state.platform === 'win32';
      into.append(head, h('div', { class: 'upd-line' }, h('span', { class: 'upd-status ok', text: t('upd.verified') }), btn(win ? 'upd.install' : 'upd.reveal', install, true)));
      if (hint) into.append(h('div', { class: 'msg ok', text: t(hint === 'mac' ? 'upd.macHint' : 'upd.linuxHint') }));
      if (!banner) into.append(h('div', { class: 'hint', text: t('upd.unsigned') }));
    } else if (phase === 'error') {
      into.append(head, h('div', { class: 'upd-line' }, h('span', { class: 'upd-status err', text: t(errorKey) }), btn('upd.retry', download, true)));
    } else {
      const actions = [];
      if (i.canInstall) actions.push(btn('upd.downloadInstall', download, true));
      else actions.push(btn('upd.openPage', () => window.api.links.open(i.url), true));
      if (banner) actions.push(btn('upd.later', remind), btn('upd.skip', skip));
      if (i.canInstall) actions.push(btn('upd.notesLink', () => window.api.links.open(i.url)));
      into.append(head, notes, h('div', { class: 'upd-line' }, ...actions));
      if (!banner) {
        if (view.banner === 'skipped') into.append(h('div', { class: 'hint', text: t('upd.skippedNote') }));
        into.append(h('div', { class: 'hint', text: t('upd.unsigned') }));
      }
    }
  }

  function render() {
    const strip = $('updateBanner');
    const show = !!view && (phase !== 'idle' || view.banner === 'show') && info()?.available && canShowBanner();
    strip.hidden = !show;
    if (show) paint(strip, { banner: true });
    for (const box of [...boxes]) {
      if (!box.isConnected) boxes.delete(box);
      else paint(box, { banner: false });
    }
    $('btnSettings').classList.toggle('has-update', !!info()?.available);
  }

  // called every second: the strip steps aside in full screen and while recording, and returns after
  function syncVisibility() {
    const strip = $('updateBanner');
    const want = !!view && (phase !== 'idle' || view.banner === 'show') && info()?.available && canShowBanner();
    if (strip.hidden === want) render();
  }

  function setView(v) {
    view = v;
    if (!v?.info?.available) phase = 'idle';
    else if (v.downloaded && phase === 'idle') phase = 'ready';
    else if (v.downloading && phase === 'idle') phase = 'downloading';
    render();
  }

  // ---- actions ----
  async function download() {
    phase = 'downloading';
    progress = null;
    render();
    const res = await window.api.updates.download();
    if (res.ok) phase = 'ready';
    else if (res.error === 'cancelled') phase = 'idle';
    else {
      phase = 'error';
      errorKey = errorFor(res.error);
    }
    render();
  }

  const cancel = () => window.api.updates.cancel();

  async function install() {
    const res = await window.api.updates.install({ busy: GC.timer.isBusy() });
    if (res.ok) hint = res.hint || '';
    else if (res.error === 'safety-copy' || res.error === 'no-installer') {
      phase = 'error';
      errorKey = 'upd.installFailed';
    }
    render();
  }

  async function remind() {
    setView(await window.api.updates.remind());
  }
  async function skip() {
    setView(await window.api.updates.skip());
  }

  async function check() {
    if (checking) return;
    checking = true;
    try {
      setView(await window.api.updates.check());
    } finally {
      checking = false;
    }
  }

  // Settings → Updates: the states, the last check and "Check now"
  function mountBox(box) {
    boxes.add(box);
    paint(box, { banner: false });
  }

  function lastCheckText() {
    const c = view?.lastCheck;
    if (!c) return t('upd.neverChecked');
    const when = GC.dtf(GC.state.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(c.at));
    return t('upd.lastCheck', { d: when, r: c.ok ? t('upd.resultOk') : t('upd.resultFailed') });
  }

  async function init() {
    window.api.on.updateProgress((p) => {
      progress = p;
      if (phase === 'downloading') render();
    });
    window.api.on.updateAvailable((v) => setView(v));
    setView(await window.api.updates.status());
  }

  return { init, check, mountBox, lastCheckText, syncVisibility, render, isChecking: () => checking, hasUpdate: () => !!info()?.available };
})();
