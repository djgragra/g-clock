import { randomUUID } from 'node:crypto';

// Settings model, defaults and validation. Pure code (no Electron), so it can be unit tested.
// Everything that comes from the renderer or from an imported JSON file goes through
// sanitizeSettings(): unknown keys are dropped, types and ranges are enforced, URLs are checked.

export const APP_ID = 'com.onairgarage.gclock';
export const SETTINGS_VERSION = 1;

// Fixed addresses the app may open in the browser besides the user's own links and headlines.
export const REPO_LINKS = ['https://open-meteo.com/', 'https://onairgarage.com', 'https://github.com/djgragra/g-clock'];

export const LIMITS = {
  feeds: 12,
  links: 8,
  places: 4,
  marks: 12,
  presets: 8,
  programs: 40,
  blocks: 60,
  logoBytes: 1_000_000
};

export const DEFAULT_FEEDS = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', enabled: true },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-all', enabled: true },
  { name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', enabled: true }
];

// Offered in Settings → News as one-click additions. Checked to answer on 2026-10-01;
// each publisher's own terms for its feed still apply to the user.
export const SUGGESTED_FEEDS = [
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'France 24', url: 'https://www.france24.com/en/rss' },
  { name: 'The Guardian · World', url: 'https://www.theguardian.com/world/rss' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'Euronews', url: 'https://www.euronews.com/rss?format=mrss' }
];

export const newId = () => randomUUID().slice(0, 8);

export function defaults() {
  return {
    version: SETTINGS_VERSION,
    language: 'auto', // 'auto' follows the system; 'en' | 'it' | 'es' is the user's saved choice
    hour12: false,
    showSeconds: true,
    timeZone: 'system',
    alwaysOnTop: false,
    keepAwake: false,
    airMode: 'onair', // 'onair' | 'rec'
    logo: null, // data: URL of a PNG/JPEG already resized to 512 px max
    breaks: { enabled: true, marks: [0, 30], label: 'STOPSET', warnSec: 300 },
    timer: { sound: false, preroll: true, dynamic: true, program: null, presets: [60, 120, 180, 300, 600, 900] },
    programs: [], // recording programs: [{ id, name, blocks: [{ label, sec }], updated }]
    news: {
      enabled: true,
      ticker: true,
      intervalMin: 10,
      rotateSec: 15,
      feeds: DEFAULT_FEEDS.map((f) => ({ id: newId(), ...f }))
    },
    weather: { enabled: false, unit: 'c', places: [] },
    links: [],
    checkUpdates: true
  };
}

// ---- primitives ----------------------------------------------------------------------

export function cleanText(v, max) {
  // eslint-disable-next-line no-control-regex
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const int = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Returns the normalized URL when it is a plain http(s) URL without credentials, else null.
export function parseWebUrl(v, { httpsOnly = false } = {}) {
  let u;
  try {
    u = new URL(String(v ?? '').trim());
  } catch {
    return null;
  }
  const okProto = u.protocol === 'https:' || (!httpsOnly && u.protocol === 'http:');
  if (!okProto || u.username || u.password || !u.hostname || u.href.length > 2000) return null;
  return u.href;
}

function cleanId(v, used) {
  let id = /^[a-z0-9-]{1,40}$/i.test(String(v ?? '')) ? String(v) : newId();
  while (used.has(id)) id = newId();
  used.add(id);
  return id;
}

function list(v, max) {
  return Array.isArray(v) ? v.slice(0, max) : null;
}

// Recording programs: a name and 1..60 blocks of 1 s .. 99:59 each. Anything malformed is dropped.
export function sanitizePrograms(input) {
  const arr = Array.isArray(input) ? input.slice(0, LIMITS.programs) : [];
  const used = new Set();
  return arr
    .map((p) => {
      const blocks = (Array.isArray(p?.blocks) ? p.blocks : [])
        .filter((b) => b && Number.isFinite(Number(b.sec)) && Number(b.sec) >= 1)
        .slice(0, LIMITS.blocks)
        .map((b) => ({ label: cleanText(b.label, 80), sec: Math.min(99 * 60 + 59, Math.round(Number(b.sec))) }));
      return { p, blocks };
    })
    .filter(({ p, blocks }) => cleanText(p?.name, 60) && blocks.length)
    .map(({ p, blocks }) => ({
      id: cleanId(p.id, used),
      name: cleanText(p.name, 60),
      blocks,
      updated: Number.isFinite(Number(p.updated)) ? Math.round(Number(p.updated)) : Date.now()
    }));
}

// ---- per-key sanitizers: (input, current) -> sanitized value --------------------------

const SANITIZERS = {
  language: (v, cur) => oneOf(v, ['auto', 'en', 'it', 'es'], cur),
  hour12: (v, cur) => bool(v, cur),
  showSeconds: (v, cur) => bool(v, cur),
  timeZone: (v, cur) => (v === 'system' || isValidTimeZone(v) ? v : cur),
  alwaysOnTop: (v, cur) => bool(v, cur),
  keepAwake: (v, cur) => bool(v, cur),
  airMode: (v, cur) => oneOf(v, ['onair', 'rec'], cur),
  checkUpdates: (v, cur) => bool(v, cur),

  logo: (v, cur) => {
    if (v === null) return null;
    if (typeof v !== 'string') return cur;
    // Only raster images produced by the renderer's resize step; never SVG or other types.
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v) || v.length > LIMITS.logoBytes) return cur;
    return v;
  },

  breaks: (v, cur) => {
    if (!v || typeof v !== 'object') return cur;
    const marks = Array.isArray(v.marks)
      ? [...new Set(v.marks.map((m) => Number(m)).filter((m) => Number.isInteger(m) && m >= 0 && m <= 59))].sort((a, b) => a - b).slice(0, LIMITS.marks)
      : cur.marks;
    return {
      enabled: bool(v.enabled, cur.enabled),
      marks,
      label: v.label === undefined ? cur.label : cleanText(v.label, 16) || cur.label,
      warnSec: int(v.warnSec, 10, 1800, cur.warnSec)
    };
  },

  timer: (v, cur) => {
    if (!v || typeof v !== 'object') return cur;
    let presets = cur.presets;
    if (Array.isArray(v.presets)) {
      presets = [...new Set(v.presets.map((s) => Math.round(Number(s))).filter((s) => Number.isFinite(s) && s >= 1 && s <= 99 * 60 + 59))]
        .sort((a, b) => a - b)
        .slice(0, LIMITS.presets);
    }
    const program = v.program === null ? null : typeof v.program === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(v.program) ? v.program : cur.program;
    return { sound: bool(v.sound, cur.sound), preroll: bool(v.preroll, cur.preroll), dynamic: bool(v.dynamic, cur.dynamic), program, presets };
  },

  news: (v, cur) => {
    if (!v || typeof v !== 'object') return cur;
    let feeds = cur.feeds;
    const arr = list(v.feeds, LIMITS.feeds);
    if (arr) {
      const used = new Set();
      feeds = arr
        .map((f) => ({ f, url: parseWebUrl(f?.url, { httpsOnly: true }) }))
        .filter((x) => x.url)
        .map(({ f, url }) => ({
          id: cleanId(f.id, used),
          name: cleanText(f.name, 40) || new URL(url).hostname,
          url,
          enabled: bool(f.enabled, true)
        }));
    }
    return {
      enabled: bool(v.enabled, cur.enabled),
      ticker: bool(v.ticker, cur.ticker),
      intervalMin: int(v.intervalMin, 2, 120, cur.intervalMin),
      rotateSec: int(v.rotateSec, 4, 60, cur.rotateSec),
      feeds
    };
  },

  weather: (v, cur) => {
    if (!v || typeof v !== 'object') return cur;
    let places = cur.places;
    const arr = list(v.places, LIMITS.places);
    if (arr) {
      const used = new Set();
      places = arr
        .filter((p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)
        .map((p) => ({
          id: cleanId(p.id, used),
          name: cleanText(p.name, 60) || '?',
          detail: cleanText(p.detail, 80),
          lat: Math.round(Number(p.lat) * 1e4) / 1e4,
          lon: Math.round(Number(p.lon) * 1e4) / 1e4
        }));
    }
    return { enabled: bool(v.enabled, cur.enabled), unit: oneOf(v.unit, ['c', 'f'], cur.unit), places };
  },

  programs: (v, cur) => (Array.isArray(v) ? sanitizePrograms(v) : cur),

  links: (v, cur) => {
    const arr = list(v, LIMITS.links);
    if (!arr) return cur;
    const used = new Set();
    return arr
      .map((l) => ({ l, url: parseWebUrl(l?.url) }))
      .filter((x) => x.url)
      .map(({ l, url }) => ({
        id: cleanId(l.id, used),
        label: cleanText(l.label, 24) || new URL(url).hostname,
        url,
        note: cleanText(l.note, 300)
      }));
  }
};

// Applies `input` (a whole or partial settings object) on top of `base`, key by key.
export function sanitizeSettings(input, base = defaults()) {
  const out = structuredClone(base);
  if (!input || typeof input !== 'object') return out;
  for (const [key, fn] of Object.entries(SANITIZERS)) {
    if (Object.hasOwn(input, key)) out[key] = fn(input[key], out[key]);
  }
  out.version = SETTINGS_VERSION;
  return out;
}

// ---- import / export -------------------------------------------------------------------

export function buildExport(settings) {
  return { app: APP_ID, version: SETTINGS_VERSION, exportedAt: new Date().toISOString(), settings };
}

// Accepts an export file ({ app, settings }) or a bare settings object. Throws on foreign files.
export function parseImport(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
  if (parsed.app !== undefined && parsed.app !== APP_ID) throw new Error('foreign');
  const body = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed;
  if (!Object.keys(SANITIZERS).some((k) => Object.hasOwn(body, k))) throw new Error('invalid');
  // Start from defaults: whatever the file does not carry keeps its default value.
  return sanitizeSettings(body, defaults());
}
