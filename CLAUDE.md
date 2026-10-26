# etatton.com — project map

Ed Tatton's personal index page: one person, several projects, each explained and (where public)
linked out. It is not the studio site (that is et3.media) and not a résumé.

## Infra

| thing | where |
|---|---|
| repo | `github.com/etatton/etatton-site` (branch `main`) |
| domain | `etatton.com` / `www.etatton.com` |
| hosting | Cloudflare Pages, static, **no build step** — the repo root is the deploy directory |
| contact mail | `functions/api/contact.js` → Service binding `MAILER` → private `etatton-mailer` Worker |
| fonts | **self-hosted** in `assets/fonts/` (Instrument Serif normal + italic, Inter Tight variable; ~88 KB; OFL licences beside them). There is **no third-party request at all** |

## Hard rules

- **No build step, no framework, no site dependencies.** `package.json` exists only to run the
  tests (`node --test`); it must stay dependency-free. `wrangler pages deploy` ships the directory, not
  the git index, so nothing that must not ship may sit in the tree (see `.gitignore` note).
- **The page reads fully without JavaScript.** Without `main.js` it is a plain stacked document. The
  horizontal "folio" (`html.h`) is switched on by `main.js` only on a wide, landscape, fine-pointer
  screen with motion allowed; phones, reduced motion and no-JS all get the stacked layout from the
  same markup. The document always scrolls **vertically** — a sticky viewport turns that distance into
  a `translateX` of the track — so keyboard, anchors, back/forward and screen readers keep working.
  Never replace that with a scroll-jacking wheel handler.
- **All outbound mail goes through `functions/api/contact.js`.** It never sends without the `MAILER`
  binding; a missing binding fails loudly so the client falls back to a prefilled `mailto:` instead of
  telling the visitor a message was sent when it wasn't.
- **Private projects are described, never linked.** FamilyBot, HealthIntel and the marketing tools have
  no public URL on this page by the owner's decision; do not add one.
- **ChewyDown Productions is Ed's DJ business** (weddings and private events since 2000, Hudson Valley and
  tri-state, with DJ Big Mike). The card links to chewydown.com; keep the name spelled ChewyDown.
- **Every interactive target is ≥ 44px tall, body text ≥ 17px, focus rings visible, reduced motion
  honoured.** `tests/visual.mjs` measures the first two.
- **Grounds alternate by chapter, not by OS theme.** Charcoal `#2f2c28` (cover, Chapter III, Chapter V
  and ChewyDown), paper `#f9f8f5`, stone `#ece9e4`; each `.theme-*` sets its own ink and
  `color-scheme`. One `theme-color`, no `prefers-color-scheme` block (`tests/markup.test.mjs`).
  The accent `#cf5a2e` is for focus rings and the progress line only — never text.
- **No third-party request.** Fonts are self-hosted; `tests/markup.test.mjs` fails on any external
  host, `@import`, or absolute `url()` in the CSS.
- **The copy is pinned.** `tests/copy.snapshot.json` holds every visible string, in order. Copy may
  change, but deliberately: edit the page, run `UPDATE_COPY=1 node --test tests/copy.test.mjs`, and
  commit the snapshot diff with it. Facts in the copy come from what is already on the page or in the
  project repos — the voice can be edgier than before, the claims can't be bigger.
- **Project imagery is public work only.** `assets/work/` holds client pieces ET3 Media already
  publishes on et3.media (resized WebP). Never add a picture with a private person's contact details
  (the business cards in et3.media's print folder are out for that reason) and never a screenshot of a
  private project.
- **Contrast is computed, not asserted by hand.** `tests/contrast.test.mjs` parses the tokens out of
  `styles.css` and composites the translucent ones. Every text pairing must clear 4.5:1 and the accent 3:1 on all three grounds.

## Layout

```
index.html               the one page, as a folio: .spine (fixed rail / top bar, menu, progress) · #menu ·
                         main > .viewport > .track of panels: cover · Chapter I intro · The work (pinned
                         zoom) · Chapter II index (cursor previews) · .cases (one article per project,
                         private three as one ledger) · Chapter III what I do (hover columns) · Chapter IV
                         about · Chapter V contact + footer. Inline head script sets html.js before paint
                         (failsafe removes it if main.js never runs)
styles.css               @font-face, tokens + .theme-dark/-paper/-stone, the stacked layout, then every
                         html.h rule for the horizontal folio, reduced-motion and print blocks
main.js                  year, Norwalk clock, menu, the folio engine (measure → sticky translateX with a
                         lerp, pinned work zoom, spine colour, progress, deep links, focus snap), Chapter
                         II previews, contact form submit (fetch → success card; error keeps input +
                         mailto fallback)
assets/                  portrait, ET3 + ChewyDown logos, og.png (1200×630), the two feature JPEGs, fonts/
assets/work/             ET3 Media client work (from et3.media's portfolio), 1200px WebP
assets/fonts/            instrument-serif-latin · instrument-serif-italic-latin · inter-tight-latin + OFL
functions/api/contact.js Pages Function: validation, honeypot, MAILER service binding
tests/contact.test.mjs   node --test: validation, honeypot, missing binding, mailer 200/500, GET 405
tests/copy.test.mjs      node --test: copy pinned to copy.snapshot.json, chapters, project names, no links
tests/markup.test.mjs    node --test: anchors, assets, fonts, rel=noopener + aria-label, no third party,
                         palette, menu covers every chapter, alt text
tests/weight.test.mjs    node --test: html + css + js + fonts < 600 KB (prints the breakdown)
tests/contrast.test.mjs  node --test: WCAG ratios computed from the tokens in styles.css
tests/visual.mjs         Playwright: 360/390/1280/1600 overflow, tap targets, type size; the folio (end
                         reached, zoom grows and stays pinned, hover preview, every Tab stop on screen);
                         reduced motion stays stacked; the no-JS state (needs a local server)
tests/shoot-feature.mjs  Playwright: re-shoot a live site at 1600×1000 into assets/feature-<slot>.jpg
                         (the page references those files directly; no markup to swap any more)
_headers                 security headers; /api/* no-store
robots.txt · sitemap.xml
```

## Assets still to supply (exact sizes)

| slot | file | size | notes |
|---|---|---|---|
| 01 The Norwalk Sound feature | `assets/feature-norwalk-sound.jpg` | 1600×1000 (16:10), JPEG q70 | in place — shot from Ed's box on 2026-09-14 with `tests/shoot-feature.mjs norwalk-sound https://thenorwalksound.com/` (the build sandbox cannot reach the live site, and the repo renders from a database that lives only on that box, so the tool runs there). Re-shoot the same way whenever the homepage should look fresher |
| 02 Nothing To See Here feature | `assets/feature-nothing-to-see-here.jpg` | 1600×1000 (16:10) | in place; re-shoot with `tests/shoot-feature.mjs nothing-to-see-here https://nothingtosee.fyi/` when THE TAB moves far from $10.1M |
| Hero portrait | `assets/edward-tatton.jpg` | ≥ 1200×1500 (4:5), JPEG | current file is 400×400 and is being cropped to 4:5; a larger original will sharpen it |
| 03 ChewyDown artifact | `assets/chewydown-logo.png` | in place (288×142) | a 2× version (576×284) or an SVG would be crisper on retina |
| OG image | `assets/og.png` | 1200×630 | generated; regenerate if the name or dek changes |

## Everyday commands

```bash
python3 -m http.server 8787          # local preview at http://localhost:8787/
npm test                             # contact function tests, no deps
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) \
  node tests/visual.mjs http://localhost:8787/ [out-dir]   # screenshots default OUTSIDE the repo
npm install --no-save playwright@1.56.1 && npx playwright install chromium   # once, on the machine that runs the tool
node tests/shoot-feature.mjs norwalk-sound https://thenorwalksound.com/   # then review git diff + the JPEG, commit
npx wrangler pages deploy .          # deploy (needs CLOUDFLARE_API_TOKEN)
```

## Build history

- **2026-09-14 — redesign as a personal index.** Replaced the ET3-studio pitch page (services, higher-ed
  AI governance, process, parallax grid) with a projects-first personal page: The Norwalk Sound, Nothing
  To See Here, ChewyDown Productions and ET3 Media linked out; FamilyBot, HealthIntel and the Marketing Dashboard /
  Ad Sandbox described without links. New visual system (paper/ink, Instrument Serif + Inter, one accent,
  per-project accent marks, light + dark). Nav cut to three items, contact form cut to three fields with
  a real completion state. Added contact-function tests and a Playwright layout check. Design rationale
  follows the UX-law brief Ed supplied (Hick, Fitts, proximity, serial position, peak-end).

- **2026-09-14 — visual refresh: "civic editorial".** Dark only (`#141311`), light scheme removed.
  Google Fonts replaced by self-hosted Fraunces + Inter (`@font-face`, `font-display:swap`,
  `unicode-range`, two preloads) — the page now makes no third-party request and weighs 245 KB
  before images. New twelve-column `.wrap` grid inside wide outer margins, hairlines instead of
  cards. The four uniform card grids became ONE `<ol class="projects-list">` in three CSS tiers:
  two full-width zig-zag leads (02 carries a real 1600×1000 screenshot of nothingtosee.fyi built
  from its repo that day, THE TAB at $10.1M; 01 was a type-only placard until Ed shot the live Sound homepage from his
  box the same day with `tests/shoot-feature.mjs`), a two-up studio/side-business row with logo
  plates, and a three-column private ledger. Numbers 01–07 and section eyebrows added; "↗" + the sr-only
  "(opens …)" strings replaced by a "→" and an `aria-label` naming the host. A pull quote repeats
  one sentence from About, on purpose. Contact inputs are bottom-rule only with a two-row routes
  ledger above the unchanged fineprint. Header hairline appears on scroll; sections reveal on
  intersection, motion-query gated. Copy frozen and enforced by `tests/copy.test.mjs`.

- **2026-10-26 — "folio" edition.** Rebuilt after khanhnguyen.design, from Ed's screenshots (the
  sandbox could not reach the site): a fixed left spine, a horizontal folio driven by the normal
  vertical scroll, Instrument Serif display over Inter Tight, charcoal / paper / stone grounds by
  chapter. "The work" pins and zooms a 3×3 grid of real pieces to full bleed with the neighbours
  blurring; Chapter II is an index of names with a cursor-following preview; Chapter III four columns
  that reveal a picture on hover or focus. Same content and contact form, copy rewritten in a sharper
  voice with no new claims, copy freeze moved to a reviewed snapshot. Dark-only is retired: the reference
  alternates charcoal and paper chapters, and so does this. Stacked layout on phones, with reduced motion, and without JS.

