// garage-common: trigger 2
// The talk timer: the first signal starts the count, the next one stops it, the total stays visible for `holdMs`
// and then the timer goes back to zero. Time is passed in (monotonic milliseconds), so it can be tested.
//
// Actions: 'toggle' (start if not running, stop if running), 'start', 'stop', 'reset'.
// Phases:  'idle' (00:00) -> 'running' -> 'holding' (the total) -> 'idle'.

// holdMs may be Infinity: the total then stays until the next start or a reset.
export const DEFAULTS = { holdMs: 5000, debounceMs: 300 };

export function createStopwatch({ holdMs = DEFAULTS.holdMs, debounceMs = DEFAULTS.debounceMs } = {}) {
  let phase = 'idle';
  let startedAt = 0;
  let totalMs = 0;
  let holdUntil = 0;
  let lastAccepted = -Infinity;

  function settle(now) {
    if (phase === 'holding' && now >= holdUntil) {
      phase = 'idle';
      totalMs = 0;
    }
  }

  return {
    // -> { accepted, phase }. A start/stop/toggle that arrives within debounceMs of the previous accepted one is
    // ignored (a console that sends a Note and a CC for the same press); `reset` always works.
    signal(action, now) {
      settle(now);
      if (action === 'reset') {
        const was = phase;
        phase = 'idle';
        totalMs = 0;
        lastAccepted = -Infinity;
        return { accepted: was !== 'idle', phase };
      }
      if (now - lastAccepted < debounceMs) return { accepted: false, phase, debounced: true };
      const act = action === 'toggle' ? (phase === 'running' ? 'stop' : 'start') : action;
      if (act === 'start' && phase !== 'running') {
        phase = 'running';
        startedAt = now;
        totalMs = 0;
      } else if (act === 'stop' && phase === 'running') {
        phase = 'holding';
        totalMs = now - startedAt;
        holdUntil = now + holdMs;
      } else {
        return { accepted: false, phase };
      }
      lastAccepted = now;
      return { accepted: true, phase };
    },
    // the numbers to draw at time `now`
    snapshot(now) {
      settle(now);
      if (phase === 'running') return { phase, ms: Math.max(0, now - startedAt) };
      if (phase === 'holding') return { phase, ms: totalMs, holdLeftMs: Math.max(0, holdUntil - now) };
      return { phase, ms: 0 };
    },
    configure(next) {
      if (Number.isFinite(next.holdMs) || next.holdMs === Infinity) holdMs = next.holdMs;
      if (Number.isFinite(next.debounceMs)) debounceMs = next.debounceMs;
    }
  };
}

// 65432 ms -> "01:05"; an hour or more -> "1:01:05". Whole seconds, rounded down, as a stopwatch does.
export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
