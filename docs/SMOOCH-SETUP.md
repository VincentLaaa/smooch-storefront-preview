# Smooch Theme — Setup & Launch Guide

A reusable direct-response Shopify foundation built on Dawn v15.5. The working
brand is "Smooch", but every brand-specific value (name, palette, copy, prices,
proof) is a Theme setting or section setting — nothing requires touching code.

## 1. Install
1. Zip the theme directory (or push with `shopify theme push` from this folder).
2. Shopify admin → Online Store → Themes → Add theme → Upload zip.
3. Publish (or customize first — recommended).

## 2. First-run configuration (Theme settings)
Open the Theme editor → Theme settings:
- **Smooch brand** — brand name, palette tokens, delivery estimate, shipping
  message, guarantee length + label (set **0 days to hide ALL guarantee UI**
  until your policy is real), secure-checkout label, review-provider label,
  supplement + footer disclaimers, email-capture copy.
- **Colors** — the five schemes ship pre-pointed at the Smooch palette
  (cream / blush / berry / plum / surface). Rebranding = edit these five
  schemes + the Smooch brand tokens.
- **Typography** — headings default to Playfair Display, body to Assistant.
  Any Shopify-library font works; sections scale automatically.
- **Logo / favicon / social links** — Dawn's native settings, used by the
  Smooch header, footer, and meta tags.
- **Cart** — ships set to **drawer** (required for the slide-out cart the
  purchase module is designed around).

## 3. The product page (primary lander)
1. Create your product (with real price / compare-at price; compare-at drives
   every "Save %" badge — none render without it).
2. Product admin → Theme template → **product.smooch**.
3. In the Theme editor on that product, configure the **Smooch product hero**:
   - **Bundles** — each "Bundle option" block either sells the selected variant
     × a quantity (default), or — if your packs are modeled as variants (e.g. a
     "Pack" option with 1-Pack/2-Pack/3-Pack values) — enter the option value in
     "Variant option value" and selection switches the real variant.
   - **Subscriptions** — install a selling-plan app (e.g. Shopify
     Subscriptions) and attach plans to the product; the selector, discounted
     prices, and posted `selling_plan` all come from real selling plans and the
     UI hides entirely without them.
   - **Free gift display** — promotional display only; pair it with an actual
     free-gift discount/app and keep the two in step.
   - **Low-inventory note** — off by default; when enabled it only ever shows
     real tracked inventory at/below your threshold.
4. Walk the narrative sections top-to-bottom replacing placeholder copy,
   imagery, and the formula/ingredient examples with your real formula.

## 4. Homepage & pages
- The homepage template is already the Smooch composition (`index.json`;
  `index.smooch.json` is an identical reference copy).
- Point the hero CTA and the two Final-CTA sections at your product.
- FAQ page: create a page, assign template **page.faq**.
- Contact page: create a page, assign template **page.contact** (Dawn native).
- Policy pages: Settings → Policies (Shopify native; footer links them
  automatically).

## 5. Honesty checklist before spending on traffic
- [ ] Replace ALL sample reviews (marked "Sample") with real reviews or a
      review app writing the standard `reviews.rating` metafields — or remove
      the reviews section. Turn off "sample content" flags only when real.
- [ ] Replace the featured story with a real customer story (it is labeled
      "Sample story" until you do).
- [ ] Home-hero proof line is empty by default — add only real proof.
- [ ] Formula section: enter your real ingredients; enable dosages only when
      final ("Show amounts" is off by default).
- [ ] Confirm every benefit/timeline claim is one you can substantiate; the
      defaults use "formulated to support / may notice / experiences vary"
      language on purpose — keep that register.
- [ ] Set the real guarantee length (or 0 to hide) and publish a matching
      refund policy.
- [ ] Value-comparison prices are empty by default — enter only real,
      substantiable prices.
- [ ] Comparison table: never name a competitor; only claims you can back.

## 6. What needs a live store to verify
Static analysis (`theme check`: 0 errors) and code review are done, but these
require a real store session: add-to-cart → drawer flow, selling-plan checkout
pricing, variant-mode bundle switching on a real multi-variant product,
Shop Pay installments banner, and the theme-editor preview of every preset.
Run through `docs/SMOOCH-ARCHITECTURE.md` §7 Phase 3's state list on a dev
store before launch.

## Files added by Smooch (all additive to Dawn)
- `sections/smooch-*.liquid` (20), `snippets/smooch-*.liquid` (8)
- `assets/smooch-*.{css,js}` (6), `assets/section-smooch-*.{css,js}` (per-section)
- `templates/product.smooch.json`, `templates/index.smooch.json`,
  `templates/page.faq.json`
- Modified: `layout/theme.liquid` (1 render line), `config/settings_schema.json`
  (appended group), `config/settings_data.json`, `templates/index.json`,
  `sections/header-group.json`, `sections/footer-group.json`
