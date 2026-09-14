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
| fonts | **self-hosted** in `assets/fonts/` (Fraunces normal + italic, Inter; ~197 KB). There is now **no third-party request at all** |

## Hard rules

- **No build step, no framework, no site dependencies.** `package.json` exists only to run the
  tests (`node --test`); it must stay dependency-free. `wrangler pages deploy` ships the directory, not
  the git index, so nothing that must not ship may sit in the tree (see `.gitignore` note).
- **The page reads fully without JavaScript.** `main.js` only enhances the contact form and the year.
- **All outbound mail goes through `functions/api/contact.js`.** It never sends without the `MAILER`
  binding; a missing binding fails loudly so the client falls back to a prefilled `mailto:` instead of
  telling the visitor a message was sent when it wasn't.
- **Private projects are described, never linked.** FamilyBot, HealthIntel and the marketing tools have
  no public URL on this page by the owner's decision; do not add one.
- **ChewyDown Productions is Ed's DJ business** (weddings and private events since 2000, Hudson Valley and
  tri-state, with DJ Big Mike). The card links to chewydown.com; keep the name spelled ChewyDown.
- **Every interactive target is ≥ 44px tall, body text ≥ 17px, focus rings visible, reduced motion
  honoured.** `tests/visual.mjs` measures the first two.
- **The page is dark only.** Ground `#141311`, one `theme-color`, `color-scheme:dark`. There is no
  light scheme and no `prefers-color-scheme` block; `tests/markup.test.mjs` enforces that.
- **No third-party request.** Fonts are self-hosted; `tests/markup.test.mjs` fails on any external
  host, `@import`, or absolute `url()` in the CSS.
- **The copy is frozen.** `tests/copy.test.mjs` pulls `git show origin/main:index.html` and asserts
  every visible string is still on the page. If it goes red, fix the page — never the test.
- **Contrast is computed, not asserted by hand.** `tests/contrast.test.mjs` parses the tokens out of
  `styles.css` and composites the translucent ones; `--fg-3` is large-text/non-text only.

## Layout

```
index.html               the one page: header · hero · projects (one <ol>, three tiers) · pull quote ·
                         about · contact · footer. A 1px #scroll-sentinel and an inline head script
                         (sets html.js before paint, with a failsafe that removes it if main.js never runs)
styles.css               @font-face, dark-only tokens, the 12-column .wrap grid, components
main.js                  year, header-hairline observer, section reveal observer, contact form submit
                         (fetch → success card; error keeps input + mailto fallback)
assets/                  portrait, ET3 logo, ChewyDown logo, og.png (1200×630), fonts/
assets/fonts/            fraunces-normal-latin · fraunces-italic-latin · inter-normal-latin (woff2)
functions/api/contact.js Pages Function: validation, honeypot, MAILER service binding
tests/contact.test.mjs   node --test: validation, honeypot, missing binding, mailer 200/500, GET 405
tests/copy.test.mjs      node --test: the copy freeze, against origin/main out of git
tests/markup.test.mjs    node --test: anchors, assets, fonts, rel=noopener + aria-label, no third party
tests/weight.test.mjs    node --test: html + css + js + fonts < 600 KB (prints the breakdown)
tests/contrast.test.mjs  node --test: WCAG ratios computed from the tokens in styles.css
tests/visual.mjs         Playwright: 360/390/1280/1600 — overflow, tap targets, type size, the header
                         hairline, the reveal, and the no-JS state (needs a local server)
tests/shoot-feature.mjs  Playwright: shoot a live site at 1600×1000 into assets/feature-<slot>.jpg and swap
                         the <img> into the matching data-slot figure (placard → image; image → refresh)
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
