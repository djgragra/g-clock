import { app } from 'electron';
import { guardedFetch } from './httpfetch.js';
import { cleanText } from './schema.js';

// Weather is optional and off by default. Data: Open-Meteo.com (CC BY 4.0), whose attribution
// the UI shows whenever the weather is on. The hosts below are the only ones ever contacted.
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const REFRESH_MS = 15 * 60_000;
const headers = () => ({ 'User-Agent': `G-Clock/${app.getVersion()} (+https://onairgarage.com)`, Accept: 'application/json' });

export async function geocode(query, language) {
  const name = cleanText(query, 80);
  if (name.length < 2) return [];
  const lang = ['en', 'it', 'es'].includes(language) ? language : 'en';
  const url = `${GEO}?name=${encodeURIComponent(name)}&count=6&language=${lang}&format=json`;
  const { text } = await guardedFetch(url, { timeoutMs: 10000, maxBytes: 500_000, headers: headers() });
  const results = JSON.parse(text).results ?? [];
  return results
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({
      name: cleanText(r.name, 60),
      detail: cleanText([r.admin1, r.country].filter(Boolean).join(', '), 80),
      lat: r.latitude,
      lon: r.longitude
    }));
}

export async function fetchForecast(places, unit) {
  if (!places.length) return [];
  const q = new URLSearchParams({
    latitude: places.map((p) => p.lat).join(','),
    longitude: places.map((p) => p.lon).join(','),
    current: 'temperature_2m,weather_code',
    timezone: 'auto'
  });
  if (unit === 'f') q.set('temperature_unit', 'fahrenheit');
  const { text } = await guardedFetch(`${FORECAST}?${q}`, { timeoutMs: 10000, maxBytes: 500_000, headers: headers() });
  const json = JSON.parse(text);
  const rows = Array.isArray(json) ? json : [json];
  return places.map((p, i) => {
    const cur = rows[i]?.current;
    const temp = Number(cur?.temperature_2m);
    return { id: p.id, temp: Number.isFinite(temp) ? Math.round(temp) : null, code: Number.isInteger(cur?.weather_code) ? cur.weather_code : null };
  });
}

export function createWeather({ getSettings, onUpdate }) {
  let timer = null;
  let current = { enabled: false, unit: 'c', rows: [], error: null, updatedAt: null };

  async function refresh() {
    const { weather } = getSettings();
    if (!weather.enabled || !weather.places.length) {
      current = { enabled: weather.enabled, unit: weather.unit, rows: [], error: null, updatedAt: null };
      onUpdate(current);
      return;
    }
    try {
      const rows = await fetchForecast(weather.places, weather.unit);
      current = { enabled: true, unit: weather.unit, rows, error: null, updatedAt: Date.now() };
    } catch (err) {
      // keep the last values on screen, flag the failure
      current = { ...current, enabled: true, unit: current.unit, error: err.name === 'TimeoutError' ? 'timeout' : String(err.message || err).slice(0, 80) };
    }
    onUpdate(current);
  }

  function schedule() {
    clearInterval(timer);
    const { weather } = getSettings();
    // no timer, and so no network traffic at all, while the weather is off
    if (weather.enabled) timer = setInterval(refresh, REFRESH_MS);
  }

  return {
    state: () => current,
    start() {
      schedule();
      return refresh();
    },
    reschedule(fetch = true) {
      schedule();
      return fetch ? refresh() : undefined;
    }
  };
}
