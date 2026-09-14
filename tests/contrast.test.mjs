/* WCAG contrast, computed from the tokens actually declared in styles.css —
   not from a table written by hand next to them. Translucent foregrounds are
   composited over each ground first, because that is what the eye receives.
   Prints every ratio. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');

/** Pull `--name: value;` out of the :root block. */
function tokens(source) {
  const root = (source.match(/:root\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
  const out = {};
  for (const m of root.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

function parseColour(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = value.match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i,
  );
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`cannot parse colour: ${value}`);
}

const over = (fg, bg) => ({
  r: fg.a * fg.r + (1 - fg.a) * bg.r,
  g: fg.a * fg.g + (1 - fg.a) * bg.g,
  b: fg.a * fg.b + (1 - fg.a) * bg.b,
  a: 1,
});

function luminance({ r, g, b }) {
  const ch = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function ratio(fg, bg) {
  const solid = fg.a < 1 ? over(fg, bg) : fg;
  const a = luminance(solid);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const T = tokens(css);
const C = (name) => parseColour(T[name]);
const round = (n) => Math.round(n * 100) / 100;

test('the tokens the design is built on are all declared', () => {
  for (const n of ['--bg', '--surface', '--fg', '--fg-2', '--fg-3', '--accent', '--rule', '--rule-strong']) {
    assert.ok(T[n], `${n} is not declared in :root`);
  }
  assert.equal(T['--bg'], '#141311', 'the ground must be #141311');
});

test('body and secondary text and the accent all clear 4.5:1 on both grounds', () => {
  const bg = C('--bg');
  const surface = C('--surface');
  const checks = [
    ['--fg   on --bg     ', ratio(C('--fg'), bg), 4.5],
    ['--fg   on --surface', ratio(C('--fg'), surface), 4.5],
    ['--fg-2 on --bg     ', ratio(C('--fg-2'), bg), 4.5],
    ['--fg-2 on --surface', ratio(C('--fg-2'), surface), 4.5],
    ['--accent on --bg   ', ratio(C('--accent'), bg), 4.5],
    ['--accent on --surfc', ratio(C('--accent'), surface), 4.5],
    ['#141311 on --accent', ratio(parseColour('#141311'), C('--accent')), 4.5],
  ];

  console.log('\nWCAG contrast (computed from styles.css tokens):');
  for (const [label, r, min] of checks) {
    console.log(`  ${label}  ${round(r).toFixed(2)}:1   (needs ${min})`);
  }
  // Reported, deliberately not asserted at 4.5: --fg-3 is reserved for large
  // text and non-text by the token comment, where the bar is 3:1.
  const fg3 = ratio(C('--fg-3'), C('--bg'));
  console.log(`  --fg-3 on --bg       ${round(fg3).toFixed(2)}:1   (large text / non-text only, needs 3)`);
  console.log('');

  const failures = checks.filter(([, r, min]) => r < min);
  assert.deepEqual(
    failures.map(([l, r]) => `${l.trim()} = ${round(r)}`),
    [],
    'contrast below the AA threshold',
  );
  assert.ok(fg3 >= 3, `--fg-3 is ${round(fg3)}:1, under the 3:1 large-text floor`);
});

test('--fg-3 is never used for body-size text', () => {
  // It only clears 3:1, so any rule that paints it must also raise the size.
  const uses = [...css.matchAll(/color:\s*var\(--fg-3\)/g)];
  assert.equal(uses.length, 0, `--fg-3 is used as a text colour ${uses.length} time(s)`);
});
