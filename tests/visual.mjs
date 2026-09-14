/* Playwright verification for etatton.com.
   Not part of the site — a checker you run by hand against a local server.
   Playwright is a GLOBAL install here, hence createRequire + NODE_PATH.

     cd /home/user/etatton-site
     python3 -m http.server 8787 &
     PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) \
       node tests/visual.mjs http://localhost:8787/ [screenshot-dir]

   Screenshots never land in the repo root: `wrangler pages deploy .` ships the
   directory, so a stray PNG here would be published. */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const URL = process.argv[2] || 'http://localhost:8787/';
/* Never the repo root: `wrangler pages deploy .` ships the directory, so a
   stray PNG here would be published. Pass a directory as the second argument,
   or set ETATTON_SHOTS; otherwise they land in a scratch folder under TMPDIR. */
const OUT = process.argv[3] || process.env.ETATTON_SHOTS || join(tmpdir(), 'etatton-shots');
mkdirSync(OUT, { recursive: true });

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const METRICS = () => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  bodyFontSize: parseFloat(getComputedStyle(document.body).fontSize),
});

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
      rendered:
        cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
    };
  });

/** Anything still transparent, after everything has had its chance to reveal. */
const STILL_HIDDEN = () =>
  [...document.querySelectorAll('.reveal, section, main, footer')]
    .filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99)
    .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);

async function settle(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  try {
    await page.evaluate(() => document.fonts.ready);
  } catch {
    /* fonts optional */
  }
  await page.waitForTimeout(450);
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.7);
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 700));
  });
}

const browser = await chromium.launch();

try {
  /* ── Overflow, type size and tap targets across four widths ─────────── */
  const VIEWPORTS = [
    { w: 360, h: 780, shot: 'shot-360.png', taps: true },
    { w: 390, h: 844, shot: 'shot-mobile.png', taps: true },
    { w: 1280, h: 900, shot: 'shot-desktop.png', taps: false },
    { w: 1600, h: 1000, shot: 'shot-wide.png', taps: false },
  ];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: vp.w < 500 ? 2 : 1,
    });
    await settle(page);

    if (vp.w === 1280) {
      await page.screenshot({ path: `${OUT}/shot-hero.png` }); // viewport only
    }
    await scrollThrough(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${vp.shot}`, fullPage: true });

    const m = await page.evaluate(METRICS);
    record(
      `no horizontal overflow @${vp.w}`,
      m.scrollWidth <= m.innerWidth,
      `scrollWidth ${m.scrollWidth} <= innerWidth ${m.innerWidth}`,
    );
    record(`body font-size >= 17px @${vp.w}`, m.bodyFontSize >= 17, `${m.bodyFontSize}px`);

    if (vp.taps) {
      const targets = await page.evaluate(TAP_TARGETS);
      const rendered = targets.filter((t) => t.rendered);
      const skipped = targets.filter((t) => !t.rendered);
      const offenders = rendered.filter((t) => t.height < 40);
      record(
        `every rendered a/button >= 40px tall @${vp.w}`,
        offenders.length === 0,
        `${rendered.length} checked, ${skipped.length} not rendered (skipped), ` +
          `min height ${Math.min(...rendered.map((t) => t.height))}px` +
          (offenders.length
            ? ' | offenders: ' +
              offenders.map((o) => `${o.tag}.${o.cls}"${o.text}"=${o.height}px`).join('; ')
            : ''),
      );

      // The success card is hidden until a message sends, so measure its
      // controls in the state a visitor actually sees them in.
      const revealed = await page.evaluate(() => {
        const card = document.getElementById('sent-card');
        const form = document.getElementById('contact-form');
        card.hidden = false;
        form.hidden = true;
        return [...card.querySelectorAll('a, button')].map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 44),
          height: Math.round(el.getBoundingClientRect().height * 100) / 100,
        }));
      });
      const bad = revealed.filter((t) => t.height < 40);
      record(
        `success-card a/button >= 40px tall @${vp.w} (revealed)`,
        bad.length === 0,
        `${revealed.length} checked, min height ${Math.min(...revealed.map((t) => t.height))}px` +
          (bad.length
            ? ' | offenders: ' + bad.map((o) => `${o.tag}"${o.text}"=${o.height}px`).join('; ')
            : ''),
      );
    }

    const leftHidden = await page.evaluate(STILL_HIDDEN);
    record(
      `nothing left hidden after a full scroll @${vp.w}`,
      leftHidden.length === 0,
      leftHidden.length ? leftHidden.join('; ') : 'every section reached opacity 1',
    );

    await page.close();
  }

  /* ── The header hairline appears only once the page has moved ───────── */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await settle(page);
    const top = await page.evaluate(
      () => getComputedStyle(document.getElementById('site-header')).borderBottomWidth,
    );
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(350);
    const scrolled = await page.evaluate(
      () => getComputedStyle(document.getElementById('site-header')).borderBottomWidth,
    );
    record('header hairline absent at scrollY 0', parseFloat(top) === 0, `border-bottom ${top}`);
    record(
      'header hairline present after scrolling 200px',
      parseFloat(scrolled) > 0,
      `border-bottom ${scrolled}`,
    );
    await page.close();
  }

  /* ── With JavaScript off, nothing is hidden and the mailto is offered ── */
  {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      javaScriptEnabled: false,
    });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => 0).catch(() => null); // evaluate is unavailable
    void state;
    const hidden = await page.$$eval('section, .pullquote', (els) =>
      els
        .filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99)
        .map((el) => el.className),
    );
    record(
      'no JS: every section is visible',
      hidden.length === 0,
      hidden.length ? `hidden: ${hidden.join('; ')}` : 'all sections at opacity 1',
    );
    const noscript = await page.$$eval('noscript', (els) => els.length);
    record('no JS: the noscript mailto fallback is in the document', noscript === 1, `${noscript} noscript block`);
    const m = await page.$$eval('html', (els) => ({
      scrollWidth: els[0].scrollWidth,
      innerWidth: window.innerWidth,
    }));
    record(
      'no JS: no horizontal overflow @1280',
      m.scrollWidth <= m.innerWidth,
      `scrollWidth ${m.scrollWidth} <= innerWidth ${m.innerWidth}`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(
  `screenshots: ${OUT}/shot-360.png, ${OUT}/shot-mobile.png, ${OUT}/shot-desktop.png, ` +
    `${OUT}/shot-wide.png, ${OUT}/shot-hero.png`,
);
process.exit(failed.length ? 1 : 0);
