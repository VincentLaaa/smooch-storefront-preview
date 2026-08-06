# Smooch MVP — Offline Walkthrough

The theme is visually complete and testable **without any Shopify account**, via
a local render harness that serves the real theme files with fixture data.

## Run it
```bash
npm install          # once
node dev/server.mjs  # → http://127.0.0.1:9292
```

| URL | What you see |
| --- | --- |
| `/` | Homepage (`templates/index.json`): berry editorial hero, benefit strip, featured product, problem/solution, mechanism, story, UGC, guarantee, final CTA |
| `/products/smooch-daily-gummies-qa` | Full 21-step product lander (`product.smooch.json`) incl. the purchase module and the repeated purchase section |
| `/products/smooch-daily-gummies-qa-single` | Single-variant / no-compare-at / untracked-inventory state |
| `/pages/faq` | FAQ template with exclusive accordions + FAQPage JSON-LD |
| `/pages/contact` | Contact template (Dawn's native contact form) |

A small "OFFLINE DEV — MOCK DATA" badge marks every page (disable with
`HARNESS_BADGE=0`).

## Demo states covered by the fixtures
- **Normal product / multiple variants** — Flavor (Strawberry, Raspberry) × Pack (1/2/3 Packs)
- **Compare-at pricing** — $40/$80/$120 vs $30/$56/$75 (Save-% badges everywhere they should be, absent where compare-at is absent)
- **Sold-out variant** — Raspberry / 1 Pack: disabled ATC ("Sold out"), flagged bundle cards, dimmed offer price, mirrored sticky bar
- **Subscription selection** — 2 fixture frequencies at 10% off: plan radios, per-plan savings badges, `selling_plan` posted only when a plan is chosen
- **Quantity bundles** — 1/2/3-month tiers: totals $30/$60/$90, per-unit line, cart receives the right quantity
- **Cart quantities** — mock cart drawer round-trip incl. line prices and icon-bubble count
- **FAQ + contact pages** — real templates

## Automated QA (all offline): **31/31 passing**
```bash
npx playwright test --config qa/playwright.local.config.mjs
```
9-viewport layout sweep (320→1920; overflow, duplicate IDs, console/network
errors) · purchase matrix A–G · accessibility spot checks (single h1,
`aria-expanded` sync, keyboard bundle selection, focus rings, reduced motion) ·
performance signals (≤1 eager image, all images space-reserved, **CLS 0.0000**).
Screenshots: `qa/screenshots/` (30). Results: `qa/results/local-playwright.json`.

## Defects found offline and fixed (commit `92ecc56`)
1. Offer-data JSON emitted a trailing comma in the selling-plans array
   (`forloop.parentloop` pattern) — replaced with index-based commas.
2. The comparison table's scrollable overflow propagated to the root scroller
   (page-level horizontal scroll on phones) — contained with `overflow-x: clip`
   on the section band; inner scrolling + sticky column verified intact.

## What the harness intentionally fakes (honesty boundary)
The harness renders real Liquid/CSS/JS but mocks the platform. **Not verified
offline and explicitly deferred to a real store:** Shopify checkout, real cart
pricing/discount rules, selling-plan billing, subscriptions apps, theme
publishing, Theme Editor behavior, Shopify's exact Liquid edge cases, payment
methods, shipping, and any Admin API behavior. See
`SMOOCH-CONNECT-CHECKLIST.md` for the deferred-test list.

Harness conveniences that differ from a fresh store: empty product pickers fall
back to the fixture product, and empty image pickers get themed placeholder art
so pages photograph complete. On Shopify, those settings start empty and are
chosen in the Theme Editor.

## Package
`dist/Smooch-1.0.0.zip` (1.3 MB, theme files only — regenerate with
`npx shopify theme package`). Upload via **Online Store → Themes → Add theme →
Upload zip**, or push the repo with `scripts/setup-staging.ps1` when Shopify
access exists.
