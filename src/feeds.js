import { app } from 'electron';
import { guardedFetch } from './httpfetch.js';
import { parseFeed } from './feedparse.js';

const MAX_ITEMS = 30;

// Reads the user's feeds from the main process (no CORS), keeps a copy on disk so the headlines
// are there right after launch, and refreshes on the interval chosen in Settings.
export function createNews({ getSettings, getCache, setCache, onUpdate }) {
  let timer = null;
  let running = null;

  function state() {
    const { news } = getSettings();
    const cache = getCache();
    const active = news.feeds.filter((f) => f.enabled);
    const seen = new Set();
    const items = active
      .flatMap((f) => cache[f.id]?.items ?? [])
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
      .filter((n) => !seen.has(n.link) && seen.add(n.link))
      .slice(0, MAX_ITEMS);
    const feeds = news.feeds.map((f) => ({
      id: f.id,
      name: f.name,
      enabled: f.enabled,
      error: cache[f.id]?.error ?? null,
      fetchedAt: cache[f.id]?.fetchedAt ?? null,
      count: cache[f.id]?.items?.length ?? 0
    }));
    return { enabled: news.enabled, items, feeds };
  }

  async function fetchOne(feed) {
    const { text } = await guardedFetch(feed.url, {
      timeoutMs: 10000,
      maxBytes: 2_000_000,
      headers: {
        'User-Agent': `G-Clock/${app.getVersion()} (+https://onairgarage.com)`,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5'
      }
    });
    return parseFeed(text, feed.name);
  }

  async function refresh() {
    if (running) return running;
    running = (async () => {
      const { news } = getSettings();
      const cache = { ...getCache() };
      const live = new Set(news.feeds.map((f) => f.id));
      for (const id of Object.keys(cache)) if (!live.has(id)) delete cache[id];
      if (news.enabled) {
        await Promise.all(
          news.feeds
            .filter((f) => f.enabled)
            .map(async (f) => {
              try {
                cache[f.id] = { fetchedAt: Date.now(), error: null, items: await fetchOne(f) };
              } catch (err) {
                // keep the previous headlines, remember why the refresh failed
                cache[f.id] = { items: [], ...cache[f.id], error: err.name === 'TimeoutError' ? 'timeout' : String(err.message || err).slice(0, 80) };
              }
            })
        );
      }
      setCache(cache);
      onUpdate(state());
    })().finally(() => {
      running = null;
    });
    return running;
  }

  function schedule() {
    clearInterval(timer);
    const { news } = getSettings();
    timer = setInterval(refresh, news.intervalMin * 60_000);
  }

  return {
    state,
    refresh,
    start() {
      schedule();
      refresh();
    },
    // called after the news settings changed; `fetch` only when feeds were added, removed or switched
    reschedule(fetch = true) {
      schedule();
      onUpdate(state());
      if (fetch) refresh();
    }
  };
}
