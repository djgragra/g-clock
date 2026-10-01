import Store from 'electron-store';
import { defaults, sanitizeSettings } from './schema.js';

const store = new Store({
  name: 'g-clock-data',
  defaults: {
    settings: defaults(),
    windowBounds: { width: 1280, height: 720 },
    newsCache: {} // feed id -> { fetchedAt, error, items }
  }
});

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
