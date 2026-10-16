import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import Store from 'electron-store';
import { defaults, sanitizeSettings } from './schema.js';

// Read before the store is created: creating it writes the file with its defaults.
const existedBefore = fs.existsSync(path.join(app.getPath('userData'), 'g-clock-data.json'));

const store = new Store({
  name: 'g-clock-data',
  defaults: {
    settings: defaults(),
    windowBounds: { width: 1280, height: 720 },
    newsCache: {}, // feed id -> { fetchedAt, error, items }
    // kept apart from the settings on purpose: not part of a backup, not reset by an import
    updateState: { skipVersion: '', remindUntil: 0, lastCheck: null },
    lastSeenVersion: '',
    // the step each talk-timer program is at: { <programId>: index }. Runtime state, not part of the settings or of a backup.
    talkProgramIndex: {}
  }
});

// A settings file existed before this start (decides if the first start of a new version counts as an update).
export const hadSettingsFile = existedBefore;
export const settingsFile = () => store.path;

// Whatever is on disk goes through the same validation as imported files, so a hand-edited
// or older store can never feed unchecked values to the rest of the app.
store.set('settings', sanitizeSettings(store.get('settings'), defaults()));

export function getSettings() {
  return store.get('settings');
}

export function updateSettings(patch) {
  const next = sanitizeSettings(patch, getSettings());
  store.set('settings', next);
  return next;
}

export function replaceSettings(settings) {
  store.set('settings', settings);
  return settings;
}

export function getWindowBounds() {
  return store.get('windowBounds');
}

export function setWindowBounds(bounds) {
  store.set('windowBounds', { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
}

export function getNewsCache() {
  return store.get('newsCache');
}

export function setNewsCache(cache) {
  store.set('newsCache', cache);
}

export function getUpdateState() {
  return store.get('updateState');
}

export function setUpdateState(patch) {
  store.set('updateState', { ...getUpdateState(), ...patch });
  return getUpdateState();
}

export const getLastSeenVersion = () => store.get('lastSeenVersion');
export const setLastSeenVersion = (v) => store.set('lastSeenVersion', String(v || ''));

export const getTalkProgramIndex = () => store.get('talkProgramIndex');
export function setTalkProgramIndex(id, index) {
  const all = { ...getTalkProgramIndex(), [id]: index };
  // forget programs that no longer exist
  const alive = new Set(getSettings().talk.programs.map((p) => p.id));
  store.set('talkProgramIndex', Object.fromEntries(Object.entries(all).filter(([k]) => alive.has(k))));
}
