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

## Brand system applied (from `Images for smooch/` + `Smooch_BrandGuide.pdf`)
- **Palette** — Watermelon `#F65275`, Purple `#8246AF`, Soft Pink `#F2D4D7`,
  Light Pink `#FCAFC0` + Lilac `#C1A0DA` (exposed as tokens), Off White
  `#FAF1EE`; all five color schemes and Smooch tokens re-pointed; AA-tuned
  deep-watermelon variants used for small text/links on light backgrounds.
- **Typography** — Proxima Nova Bold (headings, all-caps labels/buttons),
  Loretta (editorial serif body), Euclid Flex (UI text); bundled via
  `assets/smooch-fonts.css`, toggleable with the "Use bundled Smooch brand
  fonts" theme setting. ⚠ **The Proxima file is a Fontspring DEMO** — it
  watermarks several glyphs (`' & $ %`), which are excluded via
  `unicode-range` (they render in Helvetica) until a licensed copy replaces it.
- **Imagery** — the two provided renders ship in `assets/` and back the
  product-hero gallery fixtures plus the built-in fallbacks for the homepage
  hero, mechanism, and final CTA; taglines "Self love in a bottle" /
  "Self love, simplified" / "No pills, no fluff." adopted from the guide.
- **Press bar** — 'As featured in' strip on the product lander (Marie Claire,
  goop, Vogue, Cosmopolitan as typographic wordmarks; per-outlet style, link,
  and optional licensed-logo upload). Merchant-asserted: keep it only for
  outlets that have genuinely featured the brand.
- **Wordmark** — no logo file was provided, so the header/footer render a
  lowercase Proxima "smooch" text approximation until the real SVG arrives.

## Package
`dist/Smooch-1.0.0.zip` (3.7 MB incl. brand fonts + demo renders, theme files
only — regenerate with `npx shopify theme package`). Upload via **Online Store
→ Themes → Add theme → Upload zip**, or push the repo with
`scripts/setup-staging.ps1` when Shopify access exists.
