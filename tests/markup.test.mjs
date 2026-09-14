/* Static checks on the built markup: one <h1>, every in-page anchor resolves,
   every /assets reference exists on disk. No dependencies, no browser. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

test('exactly one <h1>', () => {
  const opens = html.match(/<h1[\s>]/gi) || [];
  assert.equal(opens.length, 1, `found ${opens.length} <h1> elements`);
});

test('every in-page #anchor resolves to an existing id', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const anchors = [...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]);
  assert.ok(anchors.length > 0, 'expected at least one in-page anchor');
  const missing = anchors.filter((a) => a !== '' && !ids.has(a));
  assert.deepEqual(missing, [], `unresolved anchors: ${missing.join(', ')}`);
});

test('every /assets reference exists on disk', () => {
  const refs = new Set(
    [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]),
  );
  assert.ok(refs.size > 0, 'expected at least one /assets reference');
  const missing = [...refs].filter((r) => !existsSync(join(ROOT, r)));
  assert.deepEqual(missing, [], `missing assets: ${missing.join(', ')}`);
});

test('local stylesheet and script are referenced and present', () => {
  for (const f of ['/styles.css', '/main.js']) {
    assert.ok(html.includes(`"${f}"`), `${f} is not referenced from index.html`);
    assert.ok(existsSync(join(ROOT, f)), `${f} is missing on disk`);
  }
});

test('external links carry rel="noopener"', () => {
  const offenders = [...html.matchAll(/<a\s[^>]*href="https?:\/\/[^"]+"[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => !/rel="[^"]*noopener/.test(tag));
  assert.deepEqual(offenders, [], `missing rel=noopener: ${offenders.join(' | ')}`);
});

test('no third-party requests beyond Google Fonts', () => {
  const hosts = new Set(
    [...html.matchAll(/(?:src|href)="https?:\/\/([^/"]+)/g)].map((m) => m[1]),
  );
  const allowed = new Set([
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'etatton.com', // own origin: rel=canonical, og:image
  ]);
  // Only <link>/<script>/<img> pull resources; <a href> does not.
  const fetched = new Set(
    [...html.matchAll(/<(?:link|script|img)\s[^>]*(?:src|href)="https?:\/\/([^/"]+)/g)].map(
      (m) => m[1],
    ),
  );
  const bad = [...fetched].filter((h) => !allowed.has(h));
  assert.deepEqual(bad, [], `unexpected third-party hosts: ${bad.join(', ')}`);
  assert.ok(hosts.size > 0);
});
