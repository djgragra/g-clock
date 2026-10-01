import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, headline } from '../src/feedparse.js';

const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>T</title>
<item><title><![CDATA[Fish &amp; chips: the <b>news</b>]]></title><link>https://ex.com/a</link><pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate><description>LONG ARTICLE TEXT</description></item>
<item><title>Older &amp;#8217;story&amp;#8217; here</title><link>https://ex.com/b</link><pubDate>Wed, 30 Sep 2026 10:00:00 GMT</pubDate></item>
<item><title>No link at all</title></item>
<item><title>Bad scheme link</title><link>javascript:alert(1)</link></item>
<item><title>ab</title><link>https://ex.com/short</link></item>
</channel></rss>`;

const rdf = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<item rdf:about="https://ex.com/r1"><title>RDF headline one</title><link>https://ex.com/r1</link><dc:date>2026-10-01T09:00:00Z</dc:date></item></rdf:RDF>`;

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title type="html">Atom headline</title><link rel="self" href="https://ex.com/self"/><link rel="alternate" href="https://ex.com/atom1"/><updated>2026-10-01T08:00:00Z</updated><summary>TEXT</summary></entry></feed>`;

test('RSS 2.0: headline, link, time; sorted newest first; broken items dropped', () => {
  const items = parseFeed(rss, 'Src');
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Fish & chips: the news');
  assert.equal(items[0].link, 'https://ex.com/a');
  assert.equal(items[0].src, 'Src');
  assert.equal(items[0].ts, Date.parse('2026-10-01T10:00:00Z'));
  assert.equal(items[1].title, 'Older ’story’ here');
});

test('article text is never kept', () => {
  assert.doesNotMatch(JSON.stringify(parseFeed(rss, 'S')), /LONG ARTICLE TEXT/);
  assert.doesNotMatch(JSON.stringify(parseFeed(atom, 'S')), /TEXT/);
});

test('RSS 1.0 (RDF)', () => {
  const [a] = parseFeed(rdf, 'DW');
  assert.equal(a.title, 'RDF headline one');
  assert.equal(a.link, 'https://ex.com/r1');
  assert.equal(a.ts, Date.parse('2026-10-01T09:00:00Z'));
});

test('Atom: picks the alternate link', () => {
  const [a] = parseFeed(atom, 'A');
  assert.equal(a.title, 'Atom headline');
  assert.equal(a.link, 'https://ex.com/atom1');
});

test('not a feed throws', () => {
  assert.throws(() => parseFeed('<html><body>hi</body></html>', 'x'), /not-a-feed/);
  assert.throws(() => parseFeed('', 'x'));
});

test('headline strips tags and control characters and caps the length', () => {
  assert.equal(headline('<i>Hi</i>\u0000 there\n now'), 'Hi there now');
  assert.equal(headline('x'.repeat(1000)).length, 300);
});

test('future dates become unknown, limit applies', () => {
  const future = `<rss><channel><item><title>Future one</title><link>https://ex.com/f</link><pubDate>Mon, 01 Jan 2040 00:00:00 GMT</pubDate></item></channel></rss>`;
  assert.equal(parseFeed(future, 'S')[0].ts, null);
  const many = '<rss><channel>' + Array.from({ length: 50 }, (_, i) => `<item><title>Headline ${i}</title><link>https://ex.com/${i}</link></item>`).join('') + '</channel></rss>';
  assert.equal(parseFeed(many, 'S', 20).length, 20);
});
