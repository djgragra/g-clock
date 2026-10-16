// garage-common: trigger 2
// Audio level as a trigger: a gate with a threshold and a hold time. Only the LEVEL is used: this code never sees
// samples, nothing is recorded or kept. The renderer measures the level (RMS of the block, in dBFS) and feeds it here.

export const MIN_DB = -100;

// RMS of a block of float samples (-1..1) in dBFS. Silence is MIN_DB, not -Infinity.
export function rmsDb(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / (samples.length || 1));
  return rms > 0 ? Math.max(MIN_DB, 20 * Math.log10(rms)) : MIN_DB;
}

// The gate opens ("on") as soon as the level reaches the threshold, and closes ("off") only after the level has
// stayed below it for `holdMs` (so a breath or a short pause does not end the intervention).
// feed(levelDb, nowMs) -> 'on' | 'off' | null (the change, if any).
export function createGate({ thresholdDb = -40, holdMs = 3000 } = {}) {
  let open = false;
  let belowSince = null;
  return {
    feed(levelDb, now) {
      if (levelDb >= thresholdDb) {
        belowSince = null;
        if (!open) {
          open = true;
          return 'on';
        }
        return null;
      }
      if (!open) return null;
      if (belowSince === null) belowSince = now;
      if (now - belowSince >= holdMs) {
        open = false;
        belowSince = null;
        return 'off';
      }
      return null;
    },
    isOpen: () => open,
    configure(next) {
      if (Number.isFinite(next.thresholdDb)) thresholdDb = next.thresholdDb;
      if (Number.isFinite(next.holdMs)) holdMs = next.holdMs;
    },
    reset() {
      open = false;
      belowSince = null;
    }
  };
}
