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
| fonts | Google Fonts (Instrument Serif + Inter), the only third-party request |

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
- **Copy for Chewy Down is a placeholder** until Ed confirms it (the live site could not be fetched from
  the build sandbox). The HTML carries a comment marking it.
- **Every interactive target is ≥ 44px tall, body text ≥ 17px, focus rings visible, reduced motion
  honoured.** `tests/visual.mjs` measures the first two.

## Layout

```
index.html               the one page: header · hero · projects · about · contact · footer
styles.css               tokens (light + dark), layout, components
main.js                  contact form submit (fetch → success card; error keeps input + mailto fallback), year
assets/                  portrait, ET3 logo, og.png (1200×630)
functions/api/contact.js Pages Function: validation, honeypot, MAILER service binding
tests/contact.test.mjs   node --test: validation, honeypot, missing binding, mailer 200/500, GET 405
tests/markup.test.mjs    node --test: in-page anchors resolve, assets exist, rel=noopener, only Google Fonts third-party
tests/visual.mjs         Playwright: screenshots, overflow, tap targets, font size (needs a local server)
_headers                 security headers; /api/* no-store
robots.txt · sitemap.xml
```

## Everyday commands

```bash
python3 -m http.server 8787          # local preview at http://localhost:8787/
npm test                             # contact function tests, no deps
NODE_PATH=$(npm root -g) node tests/visual.mjs   # screenshots + layout assertions against :8787
npx wrangler pages deploy .          # deploy (needs CLOUDFLARE_API_TOKEN)
```

## Build history

- **2026-09-14 — redesign as a personal index.** Replaced the ET3-studio pitch page (services, higher-ed
  AI governance, process, parallax grid) with a projects-first personal page: The Norwalk Sound, Nothing
  To See Here, Chewy Down and ET3 Media linked out; FamilyBot, HealthIntel and the Marketing Dashboard /
  Ad Sandbox described without links. New visual system (paper/ink, Instrument Serif + Inter, one accent,
  per-project accent marks, light + dark). Nav cut to three items, contact form cut to three fields with
  a real completion state. Added contact-function tests and a Playwright layout check. Design rationale
  follows the UX-law brief Ed supplied (Hick, Fitts, proximity, serial position, peak-end).
