# Smooch PDP Refresh

Date: 2026-08-06 · Base commit before refresh: `fc92c89` · All work offline
against the local render harness (no Shopify credentials used; no live store
touched).

## Current-PDP assessment (before)
Strengths: solid commerce contracts (Dawn section rendering, real bundles/
plans, sticky ATC, honest states), premium brand shell, clean layout.
Weaknesses: purchase decisions unlabeled (no guided sequence), supply cards
showed % savings but demanded mental math (no duration, no exact $ savings,
no per-bottle emphasis, no per-day option), one-time/subscription rows showed
no resulting totals, no selection summary near the CTA, gallery was
photography-only (no benefit communication), the lower page ran 18 sections
with proof/story duplication, and several copy defaults drifted from the final
positioning ("Feel more like yourself again" now disallowed).

## References studied and what was taken
- **Create** (fetched structure was JS-thin; principles applied from the spec):
  numbered decision steps ("1 · Choose your supply", "2 · Choose how to buy"),
  supply cards with duration + total + compare-at + exact savings + per-bottle
  (+ optional per-day), unmistakable selected state, summary + reassurance
  beside the CTA.
- **Lemme**: media-as-sales-tool (branded infographic cards: system /
  ingredients / ritual), benefit-led identity block, subscription benefits
  beneath the selector, soft color-blocked premium feminine presentation.
- **Kiala**: explicit resulting totals on each buy-type row, "Save X%" badges
  with real math, delivery-frequency clarity, repeated purchase module with a
  concise intro.
- **Deliberately rejected** (from Kiala and generally): transformation
  statistics, clinical percentages, fake counts/reviews/before-afters,
  "Love it or it's FREE" without policy, fake gifts/scarcity/inventory,
  subscription capabilities the platform doesn't provide.

## New page structure (product.smooch.json — 15 sections, was 18)
hero (guided purchase) → press bar → trust strip → emotional problem →
mechanism → 3 benefit editorials → formula → how to use → timeline →
comparison → reviews (sample-labeled) → guarantee (config-gated) → FAQ →
repeated purchase (with "Ready when you are" intro, sticky ATC off, h2 title)
→ final CTA. Removed from the default template (sections remain available in
the editor): featured story, UGC gallery, value comparison.

## Purchase-module changes
- Numbered step headers (rendered only when both steps exist — a lone "1" never shows).
- Supply cards: title ("1 Bottle"…), auto "N-day supply" from a new per-option
  `days` setting, total, compare-at, **exact savings ("Save $20.00")**,
  per-bottle price, optional per-day price — with merchant toggles for
  per-bottle / per-day / savings display.
- Buy-type rows: one-time shows its resulting total; each subscription row
  shows its real discounted total + Save-% badge + frequency; merchant-editable
  subscription benefits list appears only while subscribed.
- **Purchase summary card** above the CTA: "2 bottles · 60-day supply
  [· Subscription — every 30 days]", total + compare + Save-%, "You save $X",
  per-bottle — all Liquid-precomputed strings; JS only selects among them.
- Sticky ATC now mirrors the full selection ("3 bottles · 90-day supply ·
  Subscription") plus price; proxy-submit architecture unchanged.
- All money still Liquid-sourced (offer JSON gained `sa` save-amount and `pd`
  per-day fields per variant × supply × plan). No client money math.

## Media-gallery changes
Native gallery untouched (Dawn contracts intact). New `media_card` blocks
render a branded info-card rail in the media column: kicker + heading + serif
text, five brand palettes, optional image, organic-shape accent; swipeable
with snap on mobile, grid on desktop; cards without content are hidden.
Preset ships three: the system (Mood · Desire · Connection), four working
ingredients, the ritual.

## Content-hierarchy changes
Identity: eyebrow → title → promise ("Daily support for mood, desire, and
feeling connected.") → exactly three benefit bullets. Rating hidden unless
real data or explicitly-set sample counts (unchanged mechanics, default hidden).
Positioning sweep: banned phrase removed everywhere; problem section now
"When your brain won't turn off, your spark can't turn on." with
"Less pressure. More possibility." close; mechanism pillars are Calm the noise
/ Support your spark / Make connection feel easier; formula lists the real
current ingredients (KSM-66 Ashwagandha, Black Maca, Damiana, Cinnamon Bark)
with cautious traditional-use language, dosages still hidden until enabled.

## Accessibility
Steps are fieldset/legend semantics with decorative numbers; all new controls
are native radios in labels (44px+ targets, focus-visible rings, arrow-key
switching — regression-tested); benefits list toggles via `hidden`;
summary is text (no color-only meaning); media rail is a `role="list"` with
visible thin scrollbar. Existing accordion/aria fixes untouched.

## Performance impact
No new JS files; ~90 added lines in the existing controller (string selection
only). One extra CSS block in existing files. Media cards are pure CSS.
Suite still measures **CLS 0.0001** and single eager hero image. Two DEMO-font
glyph hazards neutralized (digit "4" watermark excluded via unicode-range;
prices moved to the Euclid numeric stack).

## Tests
38/38 passing (31 existing + 7 new): step numbering, supply-card economics
(duration/save-$/per-bottle visibility rules), one-time & plan-row totals
following the bundle, benefits visibility + full summary correctness
(supply/plan/save lines), variant-switch-while-subscribed coherence
($100.80 = 2 × $50.40 plan price), sticky summary/price mirroring, media-card
rendering, and no-plans state (no subscription UI, no step numbers).
Theme Check: **0 errors** (8 known Dawn-baseline warnings).

## Remaining placeholders / deferred
Placeholders: gummies-macro gallery slot, lifestyle/UGC/story imagery (sections
removed from default template until real assets exist), sample reviews
(labeled), guarantee copy pending policy, DEMO Proxima license, ingredient
amounts hidden pending label. Shopify-connected tests still deferred: real
checkout/cart pricing, selling-plan billing, Theme Editor click-through,
Lighthouse on live preview — see SMOOCH-CONNECT-CHECKLIST.md.

## Screenshots
`qa/screenshots/pdp-refresh/` — before/after at 1440 and 390, purchase panel
both breakpoints, media cards, lower PDP, full-page after.
