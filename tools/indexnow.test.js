import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { findKey, payload, sitemapUrls } from './indexnow.mjs';

test('sitemapUrls liest alle <loc>-Einträge', () => {
  const xml = '<urlset><url><loc>https://praxura.de/</loc></url><url><loc> https://praxura.de/a.html </loc></url></urlset>';
  assert.deepEqual(sitemapUrls(xml), ['https://praxura.de/', 'https://praxura.de/a.html']);
});

test('findKey verlangt genau eine Schlüsseldatei', () => {
  assert.equal(findKey(['robots.txt', '0123456789abcdef0123456789abcdef.txt']), '0123456789abcdef0123456789abcdef');
  assert.throws(() => findKey(['robots.txt']));
  assert.throws(() => findKey(['0123456789abcdef0123456789abcdef.txt', 'fedcba9876543210fedcba9876543210.txt']));
});

test('payload lehnt fremde Hosts ab', () => {
  assert.throws(() => payload('k', ['https://app.praxura.de/x']));
  assert.equal(payload('k', ['https://praxura.de/']).keyLocation, 'https://praxura.de/k.txt');
});

test('Repo: Schlüsseldatei existiert, Inhalt = Name, alle Sitemap-URLs auf praxura.de', () => {
  const root = new URL('..', import.meta.url);
  const key = findKey(readdirSync(root));
  assert.equal(readFileSync(new URL(`${key}.txt`, root), 'utf8').trim(), key);
  assert.doesNotThrow(() => payload(key, sitemapUrls(readFileSync(new URL('sitemap.xml', root), 'utf8'))));
});
