// Time limits and programs. A program is a list of steps (a name and a limit); after each speech the next step is
// armed. Pure code (no Electron, no DOM), unit tested. Time is in milliseconds, limits in seconds; 0 = no limit.
import { formatDuration } from './trigger/stopwatch.js';

// -> 'none' (no limit) | 'ok' | 'warn' | 'over' | 'flash'
//   warn:  `warnSec` seconds or less before the limit (the limit itself is still "warn", not yet "over")
//   over:  past the limit
//   flash: past the limit by more than `flashSec`
export function limitState(ms, limitSec, { warnSec = 10, flashSec = 10 } = {}) {
  if (!(limitSec > 0)) return 'none';
  const limit = limitSec * 1000;
  if (ms > limit + flashSec * 1000) return 'flash';
  if (ms > limit) return 'over';
  if (ms >= limit - warnSec * 1000) return 'warn';
  return 'ok';
}

// `index` counts from 0; index === steps.length means "past the end" (the program ended with "free" = no limit).
export const clampIndex = (program, index) => (program ? Math.max(0, Math.min(Math.trunc(index) || 0, program.steps.length)) : 0);

export function currentStep(program, index) {
  if (!program) return null;
  return program.steps[clampIndex(program, index)] || null;
}

// The index after a step: the next one, or at the end `end` decides: 'loop' = back to the first, 'free' = past the end.
export function advance(program, index, end = 'loop') {
  if (!program || !program.steps.length) return 0;
  const i = clampIndex(program, index);
  if (i >= program.steps.length) return end === 'loop' ? 0 : program.steps.length; // already past the end: "next" starts again only on loop
  const n = i + 1;
  if (n < program.steps.length) return n;
  return end === 'loop' ? 0 : program.steps.length;
}

// "Previous step": one back, never before the first; from "past the end" it goes to the last step.
export function back(program, index) {
  if (!program || !program.steps.length) return 0;
  const i = clampIndex(program, index);
  return i >= program.steps.length ? program.steps.length - 1 : Math.max(0, i - 1);
}

// The step that comes after the one at `index` (for the "Next:" line), or null (no program, or the end with "free").
export function stepAfter(program, index, end = 'loop') {
  if (!program || !program.steps.length) return null;
  const i = clampIndex(program, index);
  if (i >= program.steps.length) return end === 'loop' ? program.steps[0] : null;
  const n = i + 1;
  if (n < program.steps.length) return program.steps[n];
  return end === 'loop' ? program.steps[0] : null;
}

// "Interview · 03:00", or the name alone when the step has no limit.
export const stepText = (step, free = 'free') => (step ? `${step.name || ''}${step.name ? ' · ' : ''}${step.sec > 0 ? formatDuration(step.sec * 1000) : free}` : '');
