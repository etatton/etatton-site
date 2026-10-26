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

  /* ── The horizontal folio: on, scrolling sideways, zooming, navigable ── */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await settle(page);
    const isH = await page.evaluate(() => document.documentElement.classList.contains('h'));
    record('folio: horizontal mode on a wide mouse-driven screen', isH);

    const xOf = (sel) => page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().x), sel);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1600);
    const contactX = await xOf('#contact');
    record('folio: scrolling to the end brings Chapter V to the left edge', Math.abs(contactX - 84) <= 2, `#contact at x=${contactX}`);
    await page.screenshot({ path: `${OUT}/shot-folio-end.png` });

    // The work zoom: postcard at the start of the pin, full bleed near the end.
    const scaleAt = async (f) => {
      await page.evaluate((f) => {
        const work = document.getElementById('work');
        let x = 0; for (let el = work; el && el.id !== 'track'; el = el.offsetParent) x += el.offsetLeft;
        const vw = document.getElementById('viewport').clientWidth;
        window.scrollTo(0, x + (work.offsetWidth - vw) * f);
      }, f);
      await page.waitForTimeout(1500);
      return page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('work-grid')).getPropertyValue('--s')));
    };
    const s0 = await scaleAt(0);
    const s1 = await scaleAt(0.9);
    await page.screenshot({ path: `${OUT}/shot-folio-work.png` });
    record('folio: the work grid grows from a postcard to full bleed', s0 < 0.4 && s1 > 0.97, `scale ${s0} -> ${s1}`);
    const stageX = await xOf('#work-stage');
    record('folio: the work stage stays pinned while it zooms', Math.abs(stageX - 84) <= 2, `stage at x=${stageX}`);

    // Chapter II: hovering a name brings up its picture.
    await page.evaluate(() => { location.hash = ''; });
    await page.click('#menu-btn');
    await page.click('.menu-list a[href="#projects"]');
    await page.waitForTimeout(1600);
    const name = await page.locator('.ix-link').nth(1).locator('.ix-name').boundingBox();
    await page.mouse.move(name.x + 40, name.y + 20);
    await page.mouse.move(name.x + 90, name.y + 30, { steps: 6 });
    await page.waitForTimeout(700);
    const preview = await page.evaluate(() => {
      const p = document.getElementById('ix-preview');
      return { on: p.classList.contains('on'), shown: [...p.children].findIndex((c) => c.classList.contains('shown')) };
    });
    record('folio: hovering a project name shows its picture', preview.on && preview.shown === 1, JSON.stringify(preview));
    await page.screenshot({ path: `${OUT}/shot-folio-hover.png` });

    // Keyboard: every focus stop is on screen when it lands.
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const off = [];
    for (let k = 0; k < 40; k += 1) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(120);
      const r = await page.evaluate(() => {
        const el = document.activeElement;
        const b = el.getBoundingClientRect();
        return { t: (el.textContent || el.id || el.tagName).trim().slice(0, 30), x: Math.round(b.x), w: Math.round(b.width) };
      });
      if (r.x < 0 || r.x + Math.min(r.w, 120) > 1600) off.push(r);
    }
    record('folio: every keyboard focus stop lands on screen', off.length === 0, off.length ? JSON.stringify(off) : '40 stops checked');
    await page.close();
  }

  /* ── Reduced motion: the stacked document, no sideways scroll ────────── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await settle(page);
    const isH = await page.evaluate(() => document.documentElement.classList.contains('h'));
    record('reduced motion: the folio stays stacked', !isH);
    await ctx.close();
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
    const hidden = await page.$$eval('section, article, .pullquote', (els) =>
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
    `${OUT}/shot-wide.png, ${OUT}/shot-hero.png, ${OUT}/shot-folio-*.png`,
);
process.exit(failed.length ? 1 : 0);
