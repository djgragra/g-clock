'use strict';

// Recording programs: the manage list, the editor and the end-of-program report.
// Programs are stored by the main process with the other settings (and travel with the
// settings export); this file only drives the three windows.
GC.programs = (() => {
  const T = GC.timerMath;
  const $ = GC.$;
  const t = (k, p) => GC.t(k, p);
  let editingId = null;

  const list = () => GC.state.settings.programs;
  const blockName = (i) => `${t('block')} ${i + 1}`;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  // The main process validates what it stores and sends it back.
  async function save(next, selectId) {
    const payload = await window.api.settings.update({ programs: next });
    GC.state = { ...GC.state, ...payload };
    GC.timer.programsChanged(selectId);
    renderManage();
    return payload.settings.programs;
  }

  const show = (id) => ($(id).hidden = false);
  const hide = (id) => ($(id).hidden = true);
  const isOpen = (id) => !$(id).hidden;

  // ---- manage ----
  function openManage() {
    $('manageMsg').textContent = '';
    renderManage();
    show('manageOverlay');
  }

  function renderManage() {
    const box = $('manageList');
    const programs = list();
    if (!programs.length) {
      box.replaceChildren(GC.h('div', { class: 'prog-empty', text: t('manage.empty') }));
      return;
    }
    const btn = (cls, text, title, fn) => GC.h('button', { class: 'pi-btn ' + cls, type: 'button', text, title, 'aria-label': title, onclick: fn });
    box.replaceChildren(
      ...programs.map((p) => {
        const total = p.blocks.reduce((a, b) => a + b.sec, 0);
        return GC.h('div', { class: 'prog-item' },
          GC.h('div', { class: 'pi-main' }, GC.h('div', { class: 'pi-name', text: p.name }), GC.h('div', { class: 'pi-meta', text: `${t('manage.blocks', { n: p.blocks.length })} · ${T.clk(total)}` })),
          GC.h('div', { class: 'pi-actions' },
            btn('load', '▸', t('manage.load'), () => { GC.timer.openProgram(p.id); hide('manageOverlay'); }),
            btn('', '✎', t('manage.edit'), () => openEditor(p.id)),
            btn('', '⧉', t('manage.dup'), () => duplicate(p.id)),
            btn('', '✕', t('manage.del'), () => remove(p.id))));
      })
    );
  }

  function duplicate(id) {
    const p = list().find((x) => x.id === id);
    if (p) save([...list(), { id: uid(), name: `${p.name} ${t('manage.copy')}`.slice(0, 60), blocks: p.blocks.map((b) => ({ ...b })), updated: Date.now() }]);
  }

  async function remove(id) {
    const p = list().find((x) => x.id === id);
    if (!p || !window.confirm(t('manage.confirmDel', { name: p.name }))) return;
    await save(list().filter((x) => x.id !== id));
  }

  // ---- editor ----
  function addBlockRow(label, sec) {
    const wrap = $('edBlocks');
    const n = wrap.children.length + 1;
    const dur = GC.h('input', { class: 'er-dur', placeholder: 'mm:ss', value: sec ? T.durStr(sec) : '', 'aria-label': 'mm:ss' });
    const row = GC.h('div', { class: 'ed-row' },
      GC.h('span', { class: 'er-idx', text: String(n) }),
      GC.h('input', { class: 'er-label', placeholder: blockName(n - 1), value: label || '', maxLength: 80, 'aria-label': t('block') }),
      dur,
      GC.h('button', { class: 'er-del', type: 'button', text: '✕', title: t('ed.remove'), 'aria-label': t('ed.remove'), onclick: () => { row.remove(); reindex(); total(); } }));
    dur.addEventListener('input', total);
    wrap.append(row);
  }

  function reindex() {
    [...$('edBlocks').children].forEach((r, i) => {
      r.querySelector('.er-idx').textContent = String(i + 1);
      r.querySelector('.er-label').placeholder = blockName(i);
    });
  }

  function total() {
    let sum = 0;
    for (const d of $('edBlocks').querySelectorAll('.er-dur')) sum += T.parseDur(d.value);
    $('edTotal').textContent = `${t('total')} ${T.clk(sum)}`;
  }

  function openEditor(id) {
    editingId = id || null;
    $('edBlocks').replaceChildren();
    if (id) {
      const p = list().find((x) => x.id === id);
      $('editorTitle').textContent = t('ed.edit');
      $('edName').value = p.name;
      for (const b of p.blocks) addBlockRow(b.label, b.sec);
      $('edDelete').hidden = false;
    } else {
      $('editorTitle').textContent = t('ed.new');
      $('edName').value = '';
      addBlockRow(blockName(0), 0);
      $('edDelete').hidden = true;
    }
    total();
    show('editorOverlay');
    $('edName').focus();
  }

  async function saveEditor() {
    const nameEl = $('edName');
    const name = nameEl.value.trim();
    if (!name) {
      nameEl.focus();
      nameEl.classList.add('err');
      setTimeout(() => nameEl.classList.remove('err'), 800);
      return;
    }
    const blocks = [];
    [...$('edBlocks').children].forEach((r, i) => {
      const sec = T.parseDur(r.querySelector('.er-dur').value);
      if (sec > 0) blocks.push({ label: r.querySelector('.er-label').value.trim() || blockName(i), sec });
    });
    if (!blocks.length) return total();
    const id = editingId || uid();
    const entry = { id, name, blocks, updated: Date.now() };
    const next = editingId ? list().map((p) => (p.id === editingId ? entry : p)) : [...list(), entry];
    const stored = await save(next, id);
    // the program may have got a new id if the one we made was refused: pick it by name
    if (!stored.some((p) => p.id === id)) GC.timer.programsChanged(stored.find((p) => p.name === name)?.id);
    hide('editorOverlay');
  }

  // ---- import / export ----
  async function exportAll() {
    const res = await window.api.programs.export();
    say(res.ok ? 'manage.exported' : res.canceled ? '' : 'manage.badFile');
  }

  async function importAll() {
    const res = await window.api.programs.import();
    if (res.ok) {
      GC.state = { ...GC.state, settings: res.settings };
      GC.timer.programsChanged();
      renderManage();
      say('manage.imported');
    } else if (!res.canceled) say(res.error === 'foreign' ? 'manage.foreign' : 'manage.badFile');
  }

  const say = (key) => ($('manageMsg').textContent = key ? t(key) : '');

  // ---- report ----
  function reportLabels() {
    return { header: t('rep.header'), block: t('block'), planned: t('rep.planned'), actual: t('rep.actual'), diff: t('rep.diff'), totPlanned: t('rep.totPlanned'), totActual: t('rep.totActual'), drift: t('rep.drift') };
  }

  const reportName = (r) => (r && r.name) || t('rep.recording');
  const fmtWhen = (ms) => new Date(ms).toLocaleString(GC.state.locale);

  function openReport() {
    const r = GC.timer.getReport();
    if (!r) return;
    renderReport(r);
    show('reportOverlay');
  }

  function renderReport(r) {
    $('reportTitle').textContent = `Report — ${reportName(r)}${r.when ? ' · ' + fmtWhen(r.when) : ''}`;
    const sign = (d) => (d > 0 ? '+' : d < 0 ? '-' : '±') + T.durStr(Math.abs(d));
    const cls = (d) => (d == null ? '' : d > 0 ? 'up' : d < 0 ? 'dn' : '');
    const head = GC.h('tr', {}, ...['#', t('block'), t('rep.planned'), t('rep.actual'), t('rep.diff')].map((x) => GC.h('th', { text: x })));
    const rows = r.rows.map((x) =>
      GC.h('tr', {},
        GC.h('td', { text: String(x.n) }),
        GC.h('td', { class: 'rt-label', text: x.label }),
        GC.h('td', { text: T.durStr(x.planned) }),
        GC.h('td', {}, x.actual === null ? '—' : T.durStr(x.actual), x.takes && GC.h('span', { class: 'rt-takes', text: ' ' + x.takes.map(T.durStr).join('+') })),
        GC.h('td', { class: cls(x.diff), text: x.diff === null ? '—' : sign(x.diff) })));
    $('reportTable').replaceChildren(head, ...rows);
    const row = (label, value, extra = '') => GC.h('div', { class: 'rt-row ' + extra }, GC.h('span', { text: label }), GC.h('span', { text: value }));
    $('reportTot').replaceChildren(
      row(t('rep.totPlanned'), T.clk(r.totPlanned)),
      row(t('rep.totActual'), T.clk(r.totActual)),
      row(t('rep.drift'), sign(r.drift), 'rt-drift ' + cls(r.drift)));
  }

  const reportText = () => {
    const r = GC.timer.getReport();
    return r ? T.reportText(r, reportLabels(), reportName(r), fmtWhen(r.when || Date.now())) : '';
  };

  async function copyReport() {
    const r = GC.timer.getReport();
    if (!r) return;
    await window.api.clipboard.write(reportText());
    $('reportTitle').textContent = t('rep.copied');
    setTimeout(() => isOpen('reportOverlay') && renderReport(r), 1400);
  }

  function saveReport() {
    const r = GC.timer.getReport();
    if (r) window.api.report.save(reportName(r), reportText());
  }

  // Escape closes the window on top; returns true when one was open
  function closeTop() {
    for (const id of ['editorOverlay', 'reportOverlay', 'manageOverlay']) {
      if (isOpen(id)) {
        hide(id);
        return true;
      }
    }
    return false;
  }

  function init() {
    $('btnManage').addEventListener('click', openManage);
    $('manageClose').addEventListener('click', () => hide('manageOverlay'));
    $('manageNew').addEventListener('click', () => openEditor(null));
    $('manageImport').addEventListener('click', importAll);
    $('manageExport').addEventListener('click', exportAll);
    $('editorClose').addEventListener('click', () => hide('editorOverlay'));
    $('edCancel').addEventListener('click', () => hide('editorOverlay'));
    $('edAdd').addEventListener('click', () => { addBlockRow('', 0); total(); });
    $('edSave').addEventListener('click', saveEditor);
    $('edDelete').addEventListener('click', async () => { const id = editingId; if (id) { hide('editorOverlay'); await remove(id); } });
    $('reportClose').addEventListener('click', () => hide('reportOverlay'));
    $('reportOk').addEventListener('click', () => hide('reportOverlay'));
    $('reportCopy').addEventListener('click', copyReport);
    $('reportSave').addEventListener('click', saveReport);
    for (const id of ['manageOverlay', 'editorOverlay', 'reportOverlay']) {
      $(id).addEventListener('mousedown', (e) => { if (e.target === $(id)) hide(id); });
    }
    $('edName').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveEditor(); });
  }

  return { init, openReport, closeTop, isAnyOpen: () => ['editorOverlay', 'reportOverlay', 'manageOverlay'].some(isOpen) };
})();
