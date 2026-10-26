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
  for (const n of ['--dark', '--cream', '--cream-2', '--paper', '--stone', '--ink', '--ink-2', '--accent', '--rule-dark', '--rule-light']) {
    assert.ok(T[n], `${n} is not declared in :root`);
  }
  assert.equal(T['--dark'], '#2f2c28', 'the cover ground must be #2f2c28');
});

test('every text colour clears 4.5:1 on every ground it is used on; the accent clears 3:1', () => {
  const dark = C('--dark');
  const paper = C('--paper');
  const stone = C('--stone');
  const checks = [
    ['--cream   on --dark ', ratio(C('--cream'), dark), 4.5],
    ['--cream-2 on --dark ', ratio(C('--cream-2'), dark), 4.5],
    ['--ink     on --paper', ratio(C('--ink'), paper), 4.5],
    ['--ink-2   on --paper', ratio(C('--ink-2'), paper), 4.5],
    ['--ink     on --stone', ratio(C('--ink'), stone), 4.5],
    ['--ink-2   on --stone', ratio(C('--ink-2'), stone), 4.5],
    ['--dark on --cream (button)', ratio(dark, C('--cream')), 4.5],
    // Focus rings and the error rule are non-text: WCAG 1.4.11 asks 3:1.
    ['--accent  on --dark ', ratio(C('--accent'), dark), 3],
    ['--accent  on --paper', ratio(C('--accent'), paper), 3],
    ['--accent  on --stone', ratio(C('--accent'), stone), 3],
  ];

  console.log('\nWCAG contrast (computed from styles.css tokens):');
  for (const [label, r, min] of checks) {
    console.log(`  ${label}  ${round(r).toFixed(2)}:1   (needs ${min})`);
  }
  console.log('');

  const failures = checks.filter(([, r, min]) => r < min);
  assert.deepEqual(failures.map(([l, r]) => `${l.trim()} = ${round(r)}`), [], 'contrast below threshold');
});

test('the accent is never used as a text colour', () => {
  const uses = [...css.matchAll(/(?:^|[;{\s])color:\s*var\(--accent\)/g)];
  assert.equal(uses.length, 0, `--accent is used as a text colour ${uses.length} time(s)`);
});
