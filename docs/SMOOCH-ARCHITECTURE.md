# Smooch Theme — Architecture & Build Plan

Base: **Shopify Dawn v15.5.0** (imported unmodified at commit `f806b04`).
Goal: a reusable, premium, long-form direct-response Shopify foundation. Working brand
"Smooch" is a **setting default**, never hardcoded in section markup.

---

## 1. Theme audit (Dawn v15.5.0)

### What Dawn already does well (we keep, untouched)
| Capability | Where | Verdict |
| --- | --- | --- |
| Variant resolution + option availability | `assets/global.js` (`variant-selects`), `snippets/product-variant-picker.liquid` | Reuse as-is |
| Product form + AJAX add-to-cart | `assets/product-form.js`, `snippets/buy-buttons.liquid` (`{% form 'product' %}`) | Reuse as-is |
| Section re-render on variant change | `assets/product-info.js` (`<product-info>`) | Reuse; our section honors its ID contract |
| Media gallery (slider, thumbnails, zoom, deferred media) | `snippets/product-media-gallery.liquid`, `assets/media-gallery.js` | Reuse as-is |
| Cart drawer + notification, section re-render on add | `assets/cart-drawer.js`, `snippets/cart-drawer.liquid` | Untouched |
| Quantity rules / volume pricing | `main-product.liquid` quantity block | Not used by hero (bundles replace it) but left intact |
| Localization, predictive search, accounts, a11y | various | Untouched |
| Color schemes → CSS vars (`--color-*` RGB triplets per `.color-{scheme}` class) | `layout/theme.liquid` L81–124 | Reuse; Smooch palette ships as re-configured schemes |
| Global typography (`type_header_font` / `type_body_font` → `--font-heading-family` etc.) | `layout/theme.liquid` L126–137 | Reuse — these ARE the "heading/body font" brand settings |
| Radius/border/width tokens (`--buttons-radius`, `--text-boxes-radius`, `--page-width`, …) | `layout/theme.liquid` | Reuse — these ARE the radius/border/width brand settings |

### Key integration contracts discovered (first-hand reads)
`<product-info data-section data-url data-update-url>` fetches
`{product.url}?section_id={id}&option_values=…` on option change and swaps, by ID:
`price-{id}`, `Sku-{id}`, `Inventory-{id}`, `Volume-{id}`, `Price-Per-Item-{id}`,
`Quantity-Rules-{id}`, replaces `variant-selects`, syncs `media-gallery ul li[data-media-id]`,
sets `input[name=id]` in `#product-form-{id}` / `#product-form-installment-{id}`, toggles
`#ProductSubmitButton-{id}`, then publishes `PUB_SUB_EVENTS.variantChange {sectionId, html, variant}`.

`<product-form>` submits the **native** `{% form 'product' %}` via `routes.cart_add_url`
with the form's FormData — meaning **any `quantity` and `selling_plan` fields associated
with the form are posted natively**. Dawn's own quantity input sits *outside* the form and
associates via the `form="product-form-{id}"` attribute — the exact mechanism our bundle
and subscription selectors use. No cart hacks needed.

### Gaps Dawn does not cover (we build)
1. **No selling-plan UI anywhere** (only the cart drawer displays an already-added plan's
   name). A real subscription selector that writes `selling_plan` into the native form is
   a genuine, safe addition.
2. No bundle/multi-quantity offer UI.
3. No long-form persuasion sections (mechanism, timeline, comparison, guarantee, UGC…).
4. No sticky mobile ATC.
5. No global "brand copy" settings (guarantee text, shipping message, disclaimers).

---

## 2. Conversion architecture

### Product page (paid-traffic lander) — 21 steps
Announcement → minimal sticky header → **product hero + purchase module** (gallery left,
sticky buy panel right; on mobile: gallery → rating → title → promise → bullets → bundles
→ plan → price → ATC → reassurance → accordions) → trust/benefit strip → featured
transformation quote → problem-awareness (empathetic, no shaming) → mechanism (3 pillars:
Mood / Desire / Connection radiating from product render) → 4 alternating benefit
editorials → formula breakdown (dosage optional/hideable) → what-to-expect timeline
(cautious language) → how to use (3 steps) → lifestyle editorial → comparison table →
value comparison (merchant-priced only) → reviews + UGC (sample-labeled, fully
disableable) → guarantee → **repeat purchase section** → FAQ → final emotional CTA →
footer + supplement disclaimer.

### Homepage (short, brand-led)
Announcement → header → editorial hero (layered render on saturated berry, not
left/right template) → benefit strip → featured product + CTA → problem/solution →
mechanism preview → proof → lifestyle editorial → guarantee → final CTA → footer.

### Purchase module mechanics (all real Shopify behavior)
- **Bundles** = section blocks, two honest modes per block:
  - *Variant mode*: block names a real option value (e.g. "3-Pack") → selecting the card
    drives Dawn's own variant picker (programmatic input selection → Dawn resolves the
    variant, price, availability).
  - *Quantity mode*: block sets quantity N → hidden `input[name=quantity] form=…` set to N.
  - All bundle-card prices are **precomputed in Liquid** from real
    `variant.price` / `variant.compare_at_price` / `selling_plan_allocations` for every
    (variant × bundle × plan) combination, and emitted as formatted strings — JS only
    selects among server-rendered values. No client-side money math, no invented prices.
- **Subscription** = radios over `product.selling_plan_groups`; selecting a plan enables a
  `selling_plan` input on the native form; hidden entirely when no plans exist.
- **Savings badges** render only when a real compare-at (or plan discount) exists.
- **Free gifts** = merchant-configured promotional display, explicitly labeled as such in
  the schema; nothing is silently added to the cart.
- **Sticky mobile ATC** = IntersectionObserver on the hero ATC; proxies a click to the
  real submit button; mirrors disabled/sold-out state; hides while the cart drawer is open
  (class MutationObserver); respects `env(safe-area-inset-bottom)`.
- **Urgency**: none fabricated. Optional inventory note reads real
  `variant.inventory_quantity` only, off by default.

---

## 3. Visual system

**Palette (defaults; all editable in Theme settings → Smooch brand):**
| Token | Default | Role |
| --- | --- | --- |
| `--smooch-cream` | `#FAF5EE` | primary warm background |
| `--smooch-surface` | `#FFFDF9` | product surfaces / "white" sections |
| `--smooch-ink` | `#2B1220` | deep plum near-black text + primary CTA bg |
| `--smooch-muted` | `#6E5A66` | secondary text |
| `--smooch-berry` | `#BE2B54` | primary accent, saturated full-width sections |
| `--smooch-blush` | `#F3DCE2` | soft secondary accent sections |
| `--smooch-plum` | `#3A1528` | dark editorial/comparison sections |
| `--smooch-cta-bg` / `--smooch-cta-text` | `#2B1220` / `#FFF8F2` | primary CTA |

Dawn's five color schemes are re-pointed at this palette in `settings_data.json`
(scheme-1 cream, scheme-2 blush, scheme-3 berry, scheme-4 dark plum, scheme-5 surface
white) so **native Dawn components and Smooch sections share one color system** and every
section stays scheme-switchable in the editor.

**Type:** display = Dawn `type_header_font` (default set to Playfair Display — editorial,
legible); body = `type_body_font` (default Assistant). Scale in `smooch-base.css` via
`clamp()`: display ~40→76px, h2 ~30→52px, body 16–18px, micro-labels 12–13px tracked
uppercase. (Dawn sets `1rem = 10px` — all Smooch CSS is written against that.)

**Rhythm:** alternating scheme-driven full-width bands (cream → berry → surface → plum →
blush → cream), thin `1px` borders, selective radius (buttons/cards from Dawn tokens),
oversized product renders, asymmetric editorial splits, generous but intentional
whitespace. No glassmorphism, no neon gradients, no card-grid monotony, motion respects
`prefers-reduced-motion`.

---

## 4. Files to create
**Sections (each with full schema + presets):** `smooch-announcement-bar`, `smooch-header`,
`smooch-home-hero`, `smooch-product-hero`, `smooch-benefit-strip`, `smooch-featured-story`,
`smooch-problem-solution`, `smooch-mechanism`, `smooch-benefit-editorial`, `smooch-formula`,
`smooch-timeline`, `smooch-how-to-use`, `smooch-comparison`, `smooch-value-comparison`,
`smooch-reviews`, `smooch-ugc-gallery`, `smooch-guarantee`, `smooch-faq`,
`smooch-final-cta`, `smooch-footer` (all `.liquid`, in `sections/`).

**Snippets:** `smooch-rating`, `smooch-price`, `smooch-icon`, `smooch-benefit-item`,
`smooch-bundle-option`, `smooch-purchase-reassurance`, `smooch-review-card`,
`smooch-theme-tokens` (emits brand CSS vars + loads shared assets).

**Assets:** `smooch-base.css` (tokens, type, utilities), `smooch-layout.css` (bands,
splits, containers), `smooch-components.css` (buttons, badges, accordions, cards),
`smooch-product.css` (hero + purchase module), `smooch.js` (shared custom elements:
marquee-free sliders via Dawn's, accordion helpers, sticky bits), `smooch-product-form.js`
(bundle/plan/price/sticky-ATC controller).

**Templates:** `templates/product.smooch.json`, `templates/index.smooch.json`,
`templates/page.faq.json` (+ Dawn's existing `page.contact.json` restyled via sections).

**Docs:** this file.

## 5. Existing files modified (minimal, reversible)
- `layout/theme.liquid` — **one line**: `{% render 'smooch-theme-tokens' %}` after
  `base.css`.
- `config/settings_schema.json` — append one "Smooch brand" settings group (literal
  labels; brand name default "Smooch", palette, guarantee/shipping/review-provider/
  disclaimer/email-capture copy).
- `config/settings_data.json` — re-point color schemes, fonts, radii, page width to the
  Smooch defaults.
- Nothing else in Dawn is edited; all Smooch code is additive.

## 6. Shopify compatibility risks & mitigations
1. **`product-info` ID contract** — fetched-section swaps fail silently if IDs drift →
   hero keeps Dawn's exact ID patterns (`price-{id}`, `ProductSubmitButton-{id}`, …) and
   reuses Dawn snippets for gallery/picker/buy-buttons.
2. **Re-fetched HTML doesn't know bundle/plan state** — after `variantChange`, Dawn
   replaces `#price-{id}` with plain variant price → our computed offer price lives in our
   own nodes and re-applies on the `variantChange` pubsub event.
3. **Combined-listing product swap** replaces the whole `<product-info>` subtree →
   our controllers are custom elements; `connectedCallback` re-initializes; selected
   bundle resets to default (acceptable, documented).
4. **Quantity machinery** — `product-info.js` binds to `.quantity__input`; our hidden
   quantity input deliberately omits that class so quantity-rules logic never fights the
   bundle selector.
5. **Empty `selling_plan` param** can 422 on `/cart/add` → the input is `disabled` when
   "one-time" is selected (disabled inputs are excluded from FormData).
6. **Theme editor reloads** re-execute section JS → all customElements guarded with
   `customElements.get()`; listeners bound in `connectedCallback`, cleaned in
   `disconnectedCallback`; no document-level anonymous listeners.
7. **Scheme re-pointing** changes the look of native Dawn sections storewide — intended
   (one palette), but flagged: merchants restyle via Colors settings as usual.
8. **Selling-plan deliveries/pricing** vary per app (Shopify Subscriptions vs others) —
   we read only documented `selling_plan_groups` / `selling_plan_allocations` fields and
   hide anything absent.
9. **`quantity` posted from a hidden input** — cart quantity rules (min/max/increment)
   still apply server-side; server errors surface through Dawn's existing
   `product-form` error UI (kept).

## 7. Implementation order
1. **Phase 1** — tokens snippet, settings group, `smooch-base/layout/components.css`,
   `smooch.js`, settings_data re-point. *(No visual sections yet.)*
2. **Phase 2** — `smooch-product-hero` + purchase snippets + `smooch-product.css` +
   `smooch-product-form.js` (gallery, variants, bundles, plans, pricing, ATC,
   reassurance, sticky ATC).
3. **Phase 3** — purchase-state verification matrix + `shopify theme check` + adversarial
   review of the module.
4. **Phase 4** — narrative/proof sections (announcement → footer).
5. **Phase 5** — `product.smooch.json`, `index.smooch.json`, FAQ/contact templates,
   presets.
6. **Phase 6** — responsive/a11y/performance/editor QA + final report.

**Honesty ledger:** anything not verifiable on a live store (real cart adds, selling-plan
apps, checkout) is marked "needs live-store testing" in the final report — static
analysis and theme-check only prove structure, not commerce behavior.
