# Smooch — Shopify Connection Checklist

What remains once somebody has Shopify access. Everything below is prepared;
none of it requires editing theme code.

## 1. Deploy (5 min)
- [ ] Upload `dist/Smooch-1.0.0.zip` (admin → Themes → Add theme → Upload zip),
      **or** run `pwsh -File scripts/setup-staging.ps1 -Store <store>.myshopify.com`
      (theme-check-gated, deploys **unpublished**, never touches the live theme).
- [ ] Confirm the theme appears as *unpublished*; use its Customize/Preview links.

## 2. Store data (15 min manual, or scripted)
- [ ] With an Admin API token: `node scripts/seed-store-data.mjs` creates the QA
      products (full purchase-state matrix), FAQ/contact pages, dev-draft
      policies, menus, and wires the staging theme's product pickers.
- [ ] Without a token: create a product, assign template **product.smooch**,
      set real prices + compare-at prices, add a `main-menu`/`footer` menu, and
      pick the product in the theme editor's hero/final-CTA sections
      (`docs/SMOOCH-SETUP.md` walks every setting).

## 3. Subscriptions (optional)
- [ ] Install a selling-plan app (Shopify Subscriptions is free) and attach
      plans to the product. The theme's selector appears automatically; it
      hides without plans. **Do not** expect the theme to fake one.

## 4. Deferred tests — run these on the real store before spending on traffic
None of these were (or could be) verified offline:
- [ ] Real add-to-cart → drawer → **checkout** with Shopify's test gateway
      (order contents, line prices, discounts, shipping presentation)
- [ ] Selling-plan checkout pricing and the plan shown on the order
- [ ] Variant-mode bundles (`Variant option value` setting) on a real
      pack-option product
- [ ] Quantity rules / inventory clamping server responses surfacing in the UI
- [ ] Shop Pay installments banner (needs eligible store)
- [ ] **Theme Editor pass**: every Smooch section loads, blocks add/remove/
      reorder, presets, settings update live, no duplicate JS listeners on
      section reload
- [ ] Real-device pass (iOS Safari sticky ATC + safe-area, Android Chrome)
- [ ] Lighthouse on the live preview (offline lab showed CLS 0.0000; LCP needs
      real CDN images)
- [ ] Accessibility audit with real content (offline spot checks passed)
- [ ] Combined listings / market pricing if used
- [ ] `scripts/run-storefront-qa.ps1` — the store-connected Playwright suite
      (same matrix, against the real preview)

## 5. Content before launch (from `SMOOCH-SETUP.md` §5)
- [ ] Replace all sample-labeled proof, example ingredients, placeholder
      imagery, and dev-draft policies (marked "REQUIRES LEGAL REVIEW")
- [ ] Set the real guarantee length (or 0 to hide) and real shipping copy

## Safety notes (unchanged)
The deploy scripts cannot publish a theme and hard-fail if the target theme
ever reports `role: live`. No credentials are stored in the repo.
