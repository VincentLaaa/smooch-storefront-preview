# Smooch PDP — Create-Style Simplification (Second Pass)

Date: 2026-08-06 · Objective: **cut aggressively** — Create's page architecture
and conversion density inside Smooch's feminine premium brand world.

## The cut, measured
| | Before | After |
| --- | --- | --- |
| Default template sections | 14 | **6** |
| Desktop page height (1440) | 18,013px | **7,380px (−59%)** |
| Mobile page height (390) | 20,587px | **8,706px (−58%)** |
| Product forms on page | 2 | **1** |
| FAQ questions | 13 | **8** |

**Default structure now:** buybox hero → small trust strip → "What's happening
in your body?" → three benefits → What's inside → FAQ (→ footer group).

**Removed from the default template** (all sections remain in the repo and
Theme Editor): press bar (unbacked placements; homepage keeps its own
merchant-editable copy), problem-awareness, standalone mechanism (its diagram
now serves as the benefits section), benefit editorials, how-to-use (folded
into buybox accordions + body facts), comparison table, sample review wall
(hidden until real proof exists), guarantee section (guarantee lives beside
the CTA), repeated purchase module, final CTA.

## Buybox (Create's architecture, minus flavor dominance)
Identity: "SELF LOVE, SIMPLIFIED" → **Smooch Daily Gummies** (customer-facing
custom title over the fixture name) → one-sentence promise → three bullets.
Variant pills stay compact (variant compatibility preserved and tested).

**1 · Choose Your Supply** — three month cards (1/2/3 Months; 3-across ≥1200px,
stacked below): bottles + duration line, total, compare-at, exact savings,
per-bottle, per-day, BEST VALUE ribbon on the substantiated tier, preselected.

**Subscription offer** — single featured MOST POPULAR panel (not three clone
cards): "Subscribe & Save {real %}", struck one-time total → plan total,
supply + per-day line, "You're saving $X", delivery-frequency pills (real
selling plans), three compact perks (merchant-configurable; only
platform-supported capabilities). One-time purchase is the clear secondary
row beneath; choosing it dims the panel and disables `selling_plan`; tapping
a frequency re-subscribes. Selection summary + ADD TO CART + checkmark
reassurance chips + payment icons close the panel. Accordions: Is this right
for me? / How to use / Ingredients / Shipping & returns.

All money remains Liquid-precomputed per variant × supply × plan (`t/c/u/s/
sa/pd`); JS selects among server strings. Native Dawn form contracts intact.

## "What's happening in your body?"
Create's format, Smooch's honesty: serif headline, one cautious intro
paragraph, Weeks 1–4 as ritual/consistency milestones (explicitly *not*
result milestones), then the compact three-fact row — Timing / Results /
Consistency (Create's "Loading" translated honestly). Implemented as `fact`
blocks added to the existing timeline section — no new section type.

## Benefits & ingredients
Benefits = the product-centered diagram retitled **Mood / Desire / Connection**
with one sentence each under "Made to support more than one part of you."
What's Inside = "Four ingredients. One easy ritual." — name, category, one
cautious line, optional expandable detail; dosages remain gated.

## Proof
Sample reviews, sample story, UGC placeholders, and press wordmarks are all
absent from the polished default (regression-tested). The reviews section
re-enters via the editor when Judge.me (or real reviews) provide genuine
content — the rating snippet already consumes the standard `reviews.rating`
metafields.

## Fixed along the way
- SSR ordering bug: subscription-first initial prices read `current_variant`
  before assignment (masked by JS re-render; now correct pre-JS).
- Sticky-bar first-paint summary (server-rendered + connect-time re-sync).
- 3-col supply cards overflowed the 1024px panel → cards go 3-across only
  ≥1200px; price rows wrap.
- CSS source-order regression on the card-column block.

## Verification
38/38 Playwright (updated + panel/dim/frequency coverage, single-form and
no-placeholder-proof assertions) · Theme Check 0 errors · CLS 0.0001 ·
screenshots in `qa/screenshots/create-pdp-refresh/` (before/after, buybox,
body, benefits, ingredients — manually reviewed). Shopify-connected tests
remain as listed in SMOOCH-CONNECT-CHECKLIST.md.
