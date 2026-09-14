/* Static checks on the shipped markup: one <h1>, every in-page anchor resolves,
   every referenced asset exists, every external link is safe and labelled, and
   nothing on this page is fetched from anyone else's server.
   No dependencies, no browser. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
/* Comments carry the documented <img> swap for the two feature placeholders,
   naming files Ed has not supplied yet. They are notes, not requests, so the
   asset and host checks read the page with comments removed. */
const live = html.replace(/<!--[\s\S]*?-->/g, '');

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

test('every /assets reference in the HTML exists on disk', () => {
  const refs = new Set(
    [...live.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]),
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

test('every font file styles.css names exists on disk', () => {
  const refs = [...css.matchAll(/url\("(\/assets\/fonts\/[^"]+\.woff2)"\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 3, `expected at least 3 @font-face sources, found ${refs.length}`);
  const missing = refs.filter((r) => !existsSync(join(ROOT, r)));
  assert.deepEqual(missing, [], `missing font files: ${missing.join(', ')}`);
});

test('every self-hosted font is preloaded or declared, and the two above the fold are preloaded', () => {
  const onDisk = readdirSync(join(ROOT, 'assets', 'fonts')).filter((f) => f.endsWith('.woff2'));
  const declared = new Set(
    [...css.matchAll(/url\("\/assets\/fonts\/([^"]+\.woff2)"\)/g)].map((m) => m[1]),
  );
  const undeclared = onDisk.filter((f) => !declared.has(f));
  assert.deepEqual(undeclared, [], `font files shipped but never used: ${undeclared.join(', ')}`);

  for (const f of ['fraunces-normal-latin.woff2', 'inter-normal-latin.woff2']) {
    const re = new RegExp(
      `<link[^>]*rel="preload"[^>]*href="/assets/fonts/${f}"[^>]*crossorigin`,
    );
    assert.ok(re.test(html), `${f} is not preloaded with crossorigin`);
  }
  assert.ok(
    !/rel="preload"[^>]*fraunces-italic/.test(html),
    'the italic face is below the fold and must not be preloaded',
  );
});

test('every @font-face uses font-display:swap and a unicode-range', () => {
  const faces = [...css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map((m) => m[1]);
  assert.ok(faces.length >= 3, `expected at least 3 @font-face blocks, found ${faces.length}`);
  for (const face of faces) {
    assert.match(face, /font-display:\s*swap/, 'a @font-face is missing font-display:swap');
    assert.match(face, /unicode-range:/, 'a @font-face is missing unicode-range');
  }
});

test('no Google Fonts link or preconnect remains', () => {
  assert.ok(!/googleapis\.com/.test(html), 'a googleapis.com reference remains');
  assert.ok(!/gstatic\.com/.test(html), 'a gstatic.com reference remains');
  assert.ok(!/rel="preconnect"/.test(html), 'a preconnect remains');
});

test('no third-party host is fetched from at all', () => {
  // Only <link>/<script>/<img> pull resources; <a href> does not.
  const fetched = new Set(
    [...live.matchAll(/<(?:link|script|img)\s[^>]*(?:src|href)="https?:\/\/([^/"]+)/g)].map(
      (m) => m[1],
    ),
  );
  const allowed = new Set(['etatton.com']); // own origin: rel=canonical only
  const bad = [...fetched].filter((h) => !allowed.has(h));
  assert.deepEqual(bad, [], `unexpected third-party hosts: ${bad.join(', ')}`);
  assert.ok(!/@import/.test(css), 'styles.css must not @import anything');
  assert.ok(
    !/url\(\s*['"]?https?:/.test(css),
    'styles.css must not reference an absolute URL',
  );
});

test('every external <a> carries rel="noopener" and an aria-label naming its host', () => {
  const tags = [...live.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)];
  assert.ok(tags.length >= 8, `expected at least 8 external links, found ${tags.length}`);
  const noRel = [];
  const noLabel = [];
  for (const [tag, href] of tags) {
    if (!/rel="[^"]*noopener/.test(tag)) noRel.push(href);
    const label = (tag.match(/aria-label="([^"]*)"/) || [])[1];
    const host = new URL(href).hostname;
    if (!label || !label.includes(host)) noLabel.push(`${href} -> ${label ?? '(none)'}`);
  }
  assert.deepEqual(noRel, [], `missing rel=noopener: ${noRel.join(', ')}`);
  assert.deepEqual(noLabel, [], `aria-label missing or not naming the host: ${noLabel.join(' | ')}`);
});

test('the "↗" glyph is gone from the page', () => {
  assert.ok(!html.includes('↗'), 'an ↗ glyph is still in index.html');
  assert.ok(!/class="ext"/.test(html), 'an .ext span is still in index.html');
  assert.ok(!/\(opens\s/.test(html), 'an "(opens …)" string is still in index.html');
});

test('dark only: one theme-color, no prefers-color-scheme block, color-scheme declared', () => {
  const themeTags = html.match(/<meta\s+name="theme-color"[^>]*>/g) || [];
  assert.equal(themeTags.length, 1, `expected 1 theme-color meta, found ${themeTags.length}`);
  assert.match(themeTags[0], /content="#141311"/);
  assert.ok(
    !/prefers-color-scheme/.test(css),
    'styles.css still carries a prefers-color-scheme block',
  );
  assert.match(css, /color-scheme:\s*dark/);
});

test('the accessibility baseline is still in the markup', () => {
  assert.match(html, /class="skip"\s+href="#main"/, 'skip link missing');
  assert.match(html, /<noscript>/, 'noscript mailto fallback missing');
  assert.match(html, /id="contact-form"/, 'contact form missing');
  assert.match(html, /class="hp"/, 'honeypot missing');
  assert.match(html, /id="sent-card"/, 'success card missing');
  assert.match(html, /id="form-status"/, 'status region missing');
  assert.match(css, /outline:\s*3px solid var\(--accent\)/, 'focus ring missing');
  assert.match(css, /outline-offset:\s*3px/, 'focus ring offset missing');
  assert.match(css, /prefers-reduced-motion:\s*reduce/, 'reduced-motion block missing');
});
