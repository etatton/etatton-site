/* Playwright verification for etatton.com.
   Not required by the site — it is a checker you run by hand against a local
   server. Playwright is a GLOBAL install here, hence createRequire + NODE_PATH.

     cd /home/user/etatton-site
     python3 -m http.server 8787 &
     PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) \
       node tests/visual.mjs http://localhost:8787/ <screenshot-dir>
*/
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const URL = process.argv[2] || 'http://localhost:8787/';
const OUT = process.argv[3] || '.';

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

/** Every rendered <a>/<button>, with its bounding box height. */
const TAP_TARGETS = () =>
  [...document.querySelectorAll('a, button')].map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.className || '',
      text: (el.textContent || '').trim().slice(0, 44),
      height: Math.round(r.height * 100) / 100,
      width: Math.round(r.width * 100) / 100,
      rendered: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
    };
  });

const OVERFLOW = () => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  bodyFontSize: parseFloat(getComputedStyle(document.body).fontSize),
});

async function settle(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  try { await page.evaluate(() => document.fonts.ready); } catch { /* fonts optional */ }
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();

try {
  /* ── 390 × 844, light ───────────────────────────────────────────────── */
  let page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  await settle(page);
  await page.screenshot({ path: `${OUT}/shot-mobile.png`, fullPage: true });

  let m = await page.evaluate(OVERFLOW);
  record(
    'no horizontal overflow @390',
    m.scrollWidth <= m.innerWidth,
    `scrollWidth ${m.scrollWidth} <= innerWidth ${m.innerWidth}`,
  );
  record('body font-size >= 17px @390', m.bodyFontSize >= 17, `${m.bodyFontSize}px`);

  const targets = await page.evaluate(TAP_TARGETS);
  const rendered = targets.filter((t) => t.rendered);
  const skipped = targets.filter((t) => !t.rendered);
  const offenders = rendered.filter((t) => t.height < 40);
  record(
    'every rendered a/button >= 40px tall @390',
    offenders.length === 0,
    `${rendered.length} checked, ${skipped.length} not rendered (skipped), ` +
      `min height ${Math.min(...rendered.map((t) => t.height))}px` +
      (offenders.length
        ? ' | offenders: ' + offenders.map((o) => `${o.tag}.${o.cls}"${o.text}"=${o.height}px`).join('; ')
        : ''),
  );
  if (skipped.length) {
    console.log(
      '      not-rendered while hidden: ' +
        skipped.map((s) => `${s.tag}.${s.cls}"${s.text}"`).join('; '),
    );
  }

  // The success card is hidden until a message sends, so measure its controls
  // in the state the visitor actually sees them in rather than skipping them.
  const revealed = await page.evaluate(() => {
    const card = document.getElementById('sent-card');
    const form = document.getElementById('contact-form');
    card.hidden = false;
    form.hidden = true;
    return [...card.querySelectorAll('a, button')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 44),
        height: Math.round(r.height * 100) / 100,
      };
    });
  });
  const revealedBad = revealed.filter((t) => t.height < 40);
  record(
    'success-card a/button >= 40px tall @390 (revealed)',
    revealedBad.length === 0,
    `${revealed.length} checked, min height ${Math.min(...revealed.map((t) => t.height))}px` +
      (revealedBad.length
        ? ' | offenders: ' + revealedBad.map((o) => `${o.tag}"${o.text}"=${o.height}px`).join('; ')
        : ''),
  );
  await page.close();

  /* ── 1280 × 900, light ──────────────────────────────────────────────── */
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await settle(page);
  await page.screenshot({ path: `${OUT}/shot-desktop.png`, fullPage: true });
  let d = await page.evaluate(OVERFLOW);
  record(
    'no horizontal overflow @1280',
    d.scrollWidth <= d.innerWidth,
    `scrollWidth ${d.scrollWidth} <= innerWidth ${d.innerWidth}`,
  );
  record('body font-size >= 17px @1280', d.bodyFontSize >= 17, `${d.bodyFontSize}px`);
  await page.close();

  /* ── 1280 × 900, dark ───────────────────────────────────────────────── */
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  await settle(page);
  await page.screenshot({ path: `${OUT}/shot-dark.png`, fullPage: true });
  const dark = await page.evaluate(() => ({
    ...((w) => w)({}),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bg: getComputedStyle(document.body).backgroundColor,
    fg: getComputedStyle(document.body).color,
  }));
  record(
    'no horizontal overflow @1280 dark',
    dark.scrollWidth <= dark.innerWidth,
    `scrollWidth ${dark.scrollWidth} <= innerWidth ${dark.innerWidth}`,
  );
  record(
    'dark scheme actually applied',
    dark.bg === 'rgb(20, 19, 17)',
    `body background ${dark.bg}, colour ${dark.fg}`,
  );
  await page.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots: ${OUT}/shot-mobile.png, ${OUT}/shot-desktop.png, ${OUT}/shot-dark.png`);
process.exit(failed.length ? 1 : 0);
