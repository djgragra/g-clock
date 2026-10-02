'use strict';

// Arithmetic of the program timer: blocks, takes, dynamic timing, report. Pure functions
// (no DOM), unit tested. `actuals[i]` is the list of recorded takes (seconds) of block i.
GC.timerMath = (() => {
  const pad = (n) => String(n).padStart(2, '0');

  // 125 -> "02:05", -5 -> "-00:05"
  function clk(sec) {
    const neg = sec < 0;
    const s = Math.abs(Math.round(sec));
    return (neg ? '-' : '') + pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }
  const durStr = (sec) => pad(Math.floor(Math.max(0, sec) / 60)) + ':' + pad(Math.max(0, sec) % 60);

  // Lenient, for the editor fields: "5" = 5 minutes, "1:30" = 90 s, anything else = 0.
  function parseDur(str) {
    const s = String(str ?? '').trim();
    if (!s) return 0;
    if (s.includes(':')) {
      const [m, sec] = s.split(':');
      return (parseInt(m, 10) || 0) * 60 + Math.min(59, parseInt(sec, 10) || 0);
    }
    return Math.round((parseFloat(s) || 0) * 60);
  }

  const hasTakes = (actuals, i) => Array.isArray(actuals[i]) && actuals[i].length > 0;
  const totalTakes = (actuals, i) => (hasTakes(actuals, i) ? actuals[i].reduce((a, x) => a + x, 0) : 0);

  // Drift (s) of the blocks already recorded: sum(actual - planned)
  function cumDevBefore(blocks, actuals, i) {
    let d = 0;
    for (let k = 0; k < i; k++) if (hasTakes(actuals, k)) d += totalTakes(actuals, k) - blocks[k].sec;
    return d;
  }

  // Target of block i. With dynamic timing the drift of the previous blocks is carried over.
  function effTarget(blocks, actuals, i, dynamic) {
    if (!blocks[i]) return 0;
    return dynamic ? blocks[i].sec - cumDevBefore(blocks, actuals, i) : blocks[i].sec;
  }

  function buildReport(blocks, actuals, blockName) {
    const rows = blocks.map((b, k) => {
      const total = hasTakes(actuals, k) ? totalTakes(actuals, k) : null;
      return {
        n: k + 1,
        label: b.label || blockName(k),
        planned: b.sec,
        actual: total,
        diff: total === null ? null : total - b.sec,
        takes: actuals[k] && actuals[k].length > 1 ? actuals[k] : null
      };
    });
    const totPlanned = blocks.reduce((a, b) => a + b.sec, 0);
    let totActual = 0;
    for (let k = 0; k < blocks.length; k++) totActual += totalTakes(actuals, k);
    return { rows, totPlanned, totActual, drift: totActual - totPlanned };
  }

  // Plain-text report; L holds the translated labels.
  function reportText(r, L, name, when) {
    const w = Math.max(L.planned.length, L.actual.length, 7);
    let s = `${L.header} — ${name}\n${when}\n\n`;
    s += '#  ' + L.block.padEnd(22) + ' ' + L.planned.padStart(w) + '  ' + L.actual.padStart(w) + '  ' + L.diff + '\n';
    for (const x of r.rows) {
      const ds = x.diff === null ? '—' : (x.diff >= 0 ? '+' : '-') + durStr(Math.abs(x.diff));
      const tk = x.takes ? ' [' + x.takes.map(durStr).join('+') + ']' : '';
      s += String(x.n).padEnd(3) + (x.label || '').padEnd(22).slice(0, 22) + ' ' + durStr(x.planned).padStart(w) + '  ' + (x.actual === null ? '—' : durStr(x.actual)).padStart(w) + '  ' + ds + tk + '\n';
    }
    const lw = Math.max(L.totPlanned.length, L.totActual.length, L.drift.length) + 2;
    s += '\n' + (L.totPlanned + ':').padEnd(lw) + clk(r.totPlanned) + '\n';
    s += (L.totActual + ':').padEnd(lw) + clk(r.totActual) + '\n';
    s += (L.drift + ':').padEnd(lw) + (r.drift >= 0 ? '+' : '-') + durStr(Math.abs(r.drift)) + '\n';
    return s;
  }

  return { clk, durStr, parseDur, hasTakes, totalTakes, cumDevBefore, effTarget, buildReport, reportText };
})();
