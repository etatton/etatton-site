/* Shoot a live site for one of the two feature slots on the projects list and
   swap the image into index.html. Not part of the site — a tool you run by hand.

     NODE_PATH=$(npm root -g) node tests/shoot-feature.mjs <slot> <url> [--html index.html] [--out assets/…jpg]

   slot  norwalk-sound | nothing-to-see-here
   url   the page to shoot, e.g. https://thenorwalksound.com/

   What it does, in order:
   1. Opens the URL in headless Chromium at 1600×1000 (16:10, the slot's aspect),
      waits for the network to go quiet, removes any entry-splash overlay so the
      masthead is visible, and writes a JPEG (quality 70) to assets/feature-<slot>.jpg.
   2. Finds the <figure … data-slot="<slot>"> in index.html. If it still holds the
      type-only placard, it is replaced by the <img> markup (class feature-media--img,
      no aria-hidden). If it already holds an <img>, only the file is refreshed.

   Needs Playwright + Chromium on the machine you run it on. Either a global install
   (then pass NODE_PATH=$(npm root -g)) or, simpler, a local one inside this folder:

     npm install --no-save playwright@1.56.1 && npx playwright install chromium

   node_modules/ is gitignored and never deployed. Nothing is committed by this tool;
   review `git diff` and the image, then commit. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ALT = {
  'norwalk-sound': 'The Norwalk Sound homepage: the day’s brief under the masthead',
  'nothing-to-see-here': 'The Nothing To See Here homepage: the timeline of entries with THE TAB counter in the corner',
};

const args = process.argv.slice(2);
const slot = args[0];
const url = args[1];
const opt = (name, fallback) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : fallback; };
if (!ALT[slot] || !url) {
  console.error('usage: node tests/shoot-feature.mjs <norwalk-sound|nothing-to-see-here> <url> [--html index.html] [--out assets/feature-<slot>.jpg]');
  process.exit(2);
}
const htmlPath = resolve(opt('--html', 'index.html'));
const outPath = resolve(opt('--out', `assets/feature-${slot}.jpg`));
const webPath = `/assets/feature-${slot}.jpg`;

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error(`playwright is not installed where node can see it.
From this folder, run once:
  npm install --no-save playwright@1.56.1 && npx playwright install chromium
then re-run this command without NODE_PATH. (A global install works too, with NODE_PATH=$(npm root -g).)`);
  process.exit(2);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  // The Norwalk Sound shows a once-per-day entry overlay; drop anything splash-like
  // so the masthead is what gets captured. Harmless on sites without one.
  for (const el of document.querySelectorAll('[class*="splash"],[id*="splash"]')) el.remove();
});
await page.waitForTimeout(600);
await page.screenshot({ path: outPath, type: 'jpeg', quality: 70 });
await browser.close();
console.log(`wrote ${outPath} (${(statSync(outPath).size / 1024).toFixed(0)} KB, 1600×1000)`);

const html = readFileSync(htmlPath, 'utf8');
const figRe = new RegExp(`<figure class="feature-media[^"]*" ?(?:aria-hidden="true" )?data-slot="${slot}">[\\s\\S]*?</figure>`);
const m = html.match(figRe);
if (!m) {
  console.error(`no <figure data-slot="${slot}"> found in ${htmlPath}; image written, markup untouched`);
  process.exit(1);
}
if (m[0].includes('<img ')) {
  console.log(`index.html already shows ${webPath}; only the file was refreshed`);
  process.exit(0);
}
const figure = `<figure class="feature-media feature-media--img" data-slot="${slot}">
            <img src="${webPath}" width="1600" height="1000"
                 alt="${ALT[slot]}" loading="lazy" decoding="async">
          </figure>`;
writeFileSync(htmlPath, html.replace(figRe, figure));
console.log(`swapped the placard for ${webPath} in ${htmlPath}`);
