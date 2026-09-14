/* Page weight before images. index.html + styles.css + main.js + every
   self-hosted font must stay under 600 KB, so the whole typographic system
   still arrives on a bad connection. Prints the breakdown either way. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 600 * 1024;

test(`index.html + styles.css + main.js + fonts < ${LIMIT} bytes`, () => {
  const files = ['index.html', 'styles.css', 'main.js'];
  for (const f of readdirSync(join(ROOT, 'assets', 'fonts')).sort()) {
    files.push(join('assets', 'fonts', f));
  }

  let total = 0;
  const rows = files.map((f) => {
    const bytes = statSync(join(ROOT, f)).size;
    total += bytes;
    return `  ${String(bytes).padStart(7)}  ${f}`;
  });

  console.log('\npage weight before images:');
  console.log(rows.join('\n'));
  console.log(
    `  ${String(total).padStart(7)}  TOTAL  (${(total / 1024).toFixed(1)} KB of ` +
      `${(LIMIT / 1024).toFixed(0)} KB, ${((total / LIMIT) * 100).toFixed(1)}% of budget)\n`,
  );

  assert.ok(total < LIMIT, `total ${total} bytes is over the ${LIMIT} byte budget`);
});
