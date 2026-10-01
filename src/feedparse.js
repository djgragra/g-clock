import { XMLParser } from 'fast-xml-parser';
import { cleanText, parseWebUrl } from './schema.js';

// Reads RSS 2.0, RSS 1.0 (RDF, e.g. DW) and Atom. Only headline, link and date are kept:
// the article text (description, content) is dropped on purpose.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  removeNSPrefix: true,
  processEntities: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === 'item' || name === 'entry' || name === 'link'
});

const NAMED = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };

// Feeds often double-encode ("&amp;#8217;"), so what the XML parser returns can still hold entities.
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 31 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

function textOf(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return textOf(v[0]);
  if (typeof v === 'object') return textOf(v['#text']);
  return String(v);
}

export function headline(v) {
  return cleanText(decodeEntities(textOf(v).replace(/<[^>]*>/g, ' ')), 300);
}

function pickLink(item) {
  const candidates = [];
  for (const l of [].concat(item.link ?? [])) {
    if (typeof l === 'object' && l) {
      const rel = l['@_rel'];
      if (l['@_href'] && (!rel || rel === 'alternate')) candidates.push(l['@_href']);
      else if (l['#text']) candidates.push(l['#text']);
    } else candidates.push(l);
  }
  const guid = item.guid && typeof item.guid === 'object' ? item.guid : { '#text': item.guid };
  if (guid['@_isPermaLink'] !== 'false') candidates.push(textOf(guid));
  for (const c of candidates) {
    const url = parseWebUrl(decodeEntities(String(c)));
    if (url) return url;
  }
  return null;
}

function pickTime(item) {
  for (const k of ['pubDate', 'date', 'published', 'updated', 'issued']) {
    const t = Date.parse(textOf(item[k]));
    if (Number.isFinite(t)) return t;
  }
  return null;
}

export function parseFeed(xml, source, limit = 20) {
  const doc = parser.parse(xml);
  const entries = doc?.rss?.channel?.item ?? doc?.RDF?.item ?? doc?.feed?.entry ?? doc?.rss?.channel?.[0]?.item;
  if (!Array.isArray(entries)) throw new Error('not-a-feed');
  const now = Date.now();
  return entries
    .map((e) => ({ src: source, title: headline(e.title), link: pickLink(e), ts: pickTime(e) }))
    .filter((n) => n.title.length > 3 && n.link)
    // A date far in the future is a broken feed clock: treat it as "unknown".
    .map((n) => (n.ts && n.ts > now + 36e5 ? { ...n, ts: null } : n))
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .slice(0, limit);
}
