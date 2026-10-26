/* The copy freeze.

   Every visible string on the page is pinned in tests/copy.snapshot.json.
   Changing copy is allowed — it was rewritten for the 2026 folio — but it
   has to be deliberate: edit the page, then refresh the snapshot with

     UPDATE_COPY=1 node --test tests/copy.test.mjs

   and the diff of the snapshot is what a reviewer reads. Without that step
   an edit that drops or changes a sentence turns this test red.

   Two decorative fragments are normalised out before comparing: the "→"
   glyph with its spacing, and screen-reader-only "(opens example.com)"
   strings. Text that is visually hidden still counts as copy here. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = join(ROOT, 'tests', 'copy.snapshot.json');
const NEW = readFileSync(join(ROOT, 'index.html'), 'utf8');

const OF_INTEREST = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'dt', 'dd', 'label', 'button', 'figcaption', 'a',
]);
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', middot: '·', mdash: '—', ndash: '–',
  hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“',
  rdquo: '”', times: '×', deg: '°',
};

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m));

const normalise = (s) =>
  decode(s)
    .replace(/\s*\(opens[^)]*\)/gi, '')
    .replace(/\s*[↗→]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Collect the text of every element we care about, nesting-aware. */
function extract(html) {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');

  const stack = [];
  const out = [];
  const tag = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let cursor = 0;
  let m;

  const push = (text) => {
    if (!text) return;
    for (const frame of stack) if (frame.keep) frame.text += text;
  };

  while ((m = tag.exec(clean)) !== null) {
    push(clean.slice(cursor, m.index));
    cursor = tag.lastIndex;
    const name = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    const selfClosing = /\/\s*$/.test(m[2] || '');

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === name) {
          const [frame] = stack.splice(i, 1);
          if (frame.keep) out.push(normalise(frame.text));
          stack.length = i;
          break;
        }
      }
    } else if (!VOID.has(name) && !selfClosing) {
      stack.push({ name, keep: OF_INTEREST.has(name), text: '' });
    }
  }
  push(clean.slice(cursor));
  return out.filter(Boolean);
}

const newStrings = extract(NEW);

if (process.env.UPDATE_COPY === '1') {
  writeFileSync(SNAPSHOT, JSON.stringify(newStrings, null, 2) + '\n');
}
const pinned = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')) : [];

test('the snapshot holds a real body of copy', () => {
  assert.ok(pinned.length >= 60, `only ${pinned.length} strings in copy.snapshot.json`);
});

test('every visible string matches the pinned copy, in order', () => {
  const missing = pinned.filter((s) => !newStrings.includes(s));
  const added = newStrings.filter((s) => !pinned.includes(s));
  assert.deepEqual(
    { missing, added },
    { missing: [], added: [] },
    'copy changed — if that was intended, run UPDATE_COPY=1 node --test tests/copy.test.mjs',
  );
  assert.deepEqual(newStrings, pinned, 'copy is the same but its order changed');
});

test('the H1 is the name', () => {
  const h1 = normalise((NEW.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1].replace(/<[^>]+>/g, ' '));
  assert.equal(h1, 'Ed Tatton');
});

test('the chapters are all there, in reading order', () => {
  const order = [...NEW.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((x) => x[1]);
  assert.deepEqual(order, ['cover', 'intro', 'work', 'projects', 'what', 'about', 'contact']);
});

test('every project is named, in order', () => {
  const names = [...NEW.matchAll(/<h3[^>]*class="case-name"[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => normalise(m[1]));
  assert.deepEqual(names, [
    'The Norwalk Sound',
    'Nothing To See Here',
    'ET3 Media',
    'ChewyDown Productions',
    'Built for a few people',
  ]);
  const privateNames = [...NEW.matchAll(/<h4>([\s\S]*?)<\/h4>/g)].map((m) => normalise(m[1]));
  assert.deepEqual(privateNames, ['FamilyBot', 'HealthIntel', 'Marketing Dashboard & Ad Sandbox']);
});

test('the three private projects carry no link, and say so', () => {
  for (const host of ['familybot', 'healthintel.et3.media']) {
    assert.ok(!NEW.includes(`href="https://${host}`), `${host} must not be linked`);
  }
  const ledger = (NEW.match(/<article id="p-private"[\s\S]*?<\/article>/) || [''])[0];
  assert.ok(ledger, 'the private ledger is missing');
  assert.ok(!/<a\s/.test(ledger), 'the private ledger must not contain a link');
  assert.equal((ledger.match(/class="no-link"/g) || []).length, 3, 'expected 3 "No link:" notes');
});
