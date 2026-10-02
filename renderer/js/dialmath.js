'use strict';

// Geometry and timing of the studio dial. Pure functions (no DOM), unit tested.
//
// The dial has 60 segments, one per minute of the hour, minute 0 centred at 12 o'clock.
// Segments fill as the hour goes by; "stopset" markers (ad breaks, news, jingles at minutes the
// user chooses) are drawn as larger segments that change colour as they get close.
GC.dialMath = (() => {
  const SEG = (2 * Math.PI) / 60;
  const START = -Math.PI / 2 - SEG / 2;

  // Same gradient as Studio Clock: green at the start of the hour, orange halfway, red at the end.
  const STOPS = [
    [0, [34, 197, 94]],
    [0.5, [245, 166, 35]],
    [0.85, [232, 74, 43]],
    [1, [232, 43, 43]]
  ];

  function colorFP(p) {
    const x = Math.max(0, Math.min(1, p));
    for (let i = 0; i < STOPS.length - 1; i++) {
      const [p0, c0] = STOPS[i];
      const [p1, c1] = STOPS[i + 1];
      if (x <= p1) {
        const t = (x - p0) / (p1 - p0);
        return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(',')})`;
      }
    }
    return `rgb(${STOPS[STOPS.length - 1][1].join(',')})`;
  }

  const angle = (minute) => START + minute * SEG;

  // Annular sector between radii r1 (inner) and r2 (outer), from angle a0 to a1 (radians).
  function arc(cx, cy, r1, r2, a0, a1) {
    const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const f = (n) => n.toFixed(2);
    const [x0, y0] = pt(r1, a0);
    const [x1, y1] = pt(r1, a1);
    const [x2, y2] = pt(r2, a1);
    const [x3, y3] = pt(r2, a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${large} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r2} ${r2} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
  }

  // Seconds from `sec` (seconds into the hour) to the next occurrence of minute `mark`.
  function untilMark(mark, sec) {
    let d = mark * 60 - sec;
    if (d <= 0) d += 3600;
    return d;
  }

  function nextStopset(sec, marks) {
    if (!marks.length) return null;
    let best = Infinity;
    let which = null;
    for (const m of marks) {
      const d = untilMark(m, sec);
      if (d < best) {
        best = d;
        which = m;
      }
    }
    return { remaining: best, mark: which };
  }

  // True during the whole minute of a stopset.
  const onStopset = (sec, marks) => marks.includes(Math.floor(sec / 60));

  // True during the first `seconds` of a stopset minute: the moment to go.
  const flashing = (sec, marks, seconds = 10) => marks.some((m) => sec >= m * 60 && sec < m * 60 + seconds);

  // 'active' during its minute, 'near' when closer than warnSec (also across the hour change),
  // otherwise 'passed' (earlier in this hour) or 'upcoming'.
  function markerState(mark, sec, warnSec) {
    const minute = Math.floor(sec / 60);
    if (minute === mark) return 'active';
    if (untilMark(mark, sec) <= warnSec) return 'near';
    return mark < minute ? 'passed' : 'upcoming';
  }

  return { SEG, angle, colorFP, arc, untilMark, nextStopset, onStopset, flashing, markerState };
})();
