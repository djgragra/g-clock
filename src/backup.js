// garage-common: backup 1
// Configuration backup (apps/COMMON-FEATURES.md, section 3). Pure code: the main process only asks for files.
// G-Clock holds no passwords or tokens, so the file never carries secrets and there is no "include passwords" box.
import { APP_SLUG, isOwnFile, parseImport, sanitizeSettings } from './schema.js';

export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5_000_000;

const pad = (n) => String(n).padStart(2, '0');
export const backupFileName = (d = new Date()) => `${APP_SLUG}-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;

// Settings and the recording programs (the items of this app). Runtime state (update choices, the news cache,
// window position, logs) is never part of it: it lives outside the settings.
export function buildBackup(settings, now = new Date()) {
  const { programs, ...rest } = structuredClone(settings);
  return { app: APP_SLUG, version: BACKUP_VERSION, exportedAt: now.toISOString(), includesSecrets: false, settings: rest, programs };
}

// -> the complete settings the file describes (what it does not carry keeps its default), validated like saved settings.
// Throws 'foreign' for another app's file and 'invalid' for anything unreadable. Older files (settings export, with
// the programs inside the settings, app id "com.onairgarage.gclock") are read too.
export function prepareImport(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
  if (!isOwnFile(parsed.app)) throw new Error('foreign');
  const body = parsed.settings && typeof parsed.settings === 'object' ? { ...parsed.settings } : { ...parsed };
  if (Array.isArray(parsed.programs)) body.programs = parsed.programs;
  return parseImport({ settings: body });
}

// "Add only the missing items": by id, settings untouched. -> a patch for updateSettings().
export function missingItems(current, incoming) {
  const add = (have, extra) => {
    const ids = new Set(have.map((x) => x.id));
    return [...have, ...extra.filter((x) => !ids.has(x.id))];
  };
  return {
    programs: add(current.programs, incoming.programs),
    links: add(current.links, incoming.links),
    news: { feeds: add(current.news.feeds, incoming.news.feeds) },
    weather: { places: add(current.weather.places, incoming.weather.places) },
    events: { list: add(current.events.list, incoming.events.list) },
    notes: { list: add(current.notes.list, incoming.notes.list) },
    talk: { programs: add(current.talk.programs, incoming.talk.programs) },
    breaks: { grids: add(current.breaks.grids, incoming.breaks.grids) }
  };
}

// What has to be typed again after an import: nothing here, G-Clock keeps no secrets. Kept so every app answers the same way.
export const missingSecrets = () => [];

// Applies the chosen way to the current settings: 'replace' or 'add' (only the missing items).
export function applyImport(current, incoming, mode) {
  if (mode === 'replace') return incoming;
  if (mode === 'add') return sanitizeSettings(missingItems(current, incoming), current);
  throw new Error('invalid-mode');
}
