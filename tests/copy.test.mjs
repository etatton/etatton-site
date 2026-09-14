/* The copy freeze.

   Every visible sentence that was on origin/main must still be on the page.
   The old markup is pulled straight out of git rather than kept as a fixture,
   so this cannot drift: if a sentence is edited away, this test goes red.

   Two decorative fragments are normalised out of BOTH sides before comparing,
   because the redesign swapped one for the other and neither is copy:
     · the "↗" glyph (old) and the "→" glyph (new), with their spacing
     · the screen-reader-only "(opens example.com)" strings, replaced by
       aria-label on the anchor itself
   Nothing else is stripped. Text that is visually hidden (.sr-only) still
   counts as copy here — it is still read aloud, it is only not drawn. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const OLD = execFileSync('git', ['show', 'origin/main:index.html'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
});
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

const oldStrings = [...new Set(extract(OLD))];
const newStrings = extract(NEW);
const newBlob = newStrings.join('\n');

test('the old page yields a real body of copy to check against', () => {
  assert.ok(oldStrings.length >= 40, `only ${oldStrings.length} strings extracted from origin/main`);
});

test('every visible string from origin/main is still on the page', () => {
  const missing = oldStrings.filter((s) => !newBlob.includes(s));
  assert.deepEqual(missing, [], `copy lost:\n  - ${missing.join('\n  - ')}`);
});

test('the H1 is unchanged', () => {
  const h1 = (s) =>
    normalise(((s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ''));
  assert.equal(h1(NEW), h1(OLD));
});

test('section order is unchanged', () => {
  const order = (s) => [...s.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((x) => x[1]);
  assert.deepEqual(order(NEW), order(OLD));
});

test('the seven project names are present, in the original order', () => {
  const names = [
    'The Norwalk Sound',
    'Nothing To See Here',
    'ChewyDown Productions',
    'ET3 Media',
    'FamilyBot',
    'HealthIntel',
    'Marketing Dashboard & Ad Sandbox',
  ];
  const found = [...NEW.matchAll(/<h4[^>]*class="proj-name"[^>]*>([\s\S]*?)<\/h4>/g)]
    .map((m) => normalise(m[1]));
  assert.deepEqual(found, names);
});

test('the three private projects still carry no link', () => {
  for (const host of ['familybot', 'healthintel.et3.media']) {
    assert.ok(!NEW.includes(`href="https://${host}`), `${host} must not be linked`);
  }
  const noLinks = [...NEW.matchAll(/class="proj-action no-link"/g)];
  assert.equal(noLinks.length, 3, `expected 3 "No link:" notes, found ${noLinks.length}`);
});
