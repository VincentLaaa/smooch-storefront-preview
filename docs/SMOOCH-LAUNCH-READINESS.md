# Smooch — Launch Readiness

Categories: **Ready** · **Ready with placeholder** · **Blocked by missing business data** · **Blocked by external app** · **Blocked by merchant approval** · **Failed**

> **Offline MVP verification (2026-08-06):** the theme now also carries in-browser
> evidence from the local render harness — 31/31 automated checks green across
> 9 viewports, purchase matrix A–G, a11y spot checks, and CLS 0.0000; two
> defects found offline were fixed (`92ecc56`). "Ready" rows below for theme
> behavior are backed by this browser-level verification; commerce rows remain
> gated on a real store exactly as listed. See `SMOOCH-MVP-WALKTHROUGH.md`.

## Theme & code
| Item | Status | Notes |
| --- | --- | --- |
| Dawn 15.5 base integrity (variant logic, cart drawer, a11y, search, accounts) | Ready | Untouched except one render line + settings |
| Design tokens / brand settings system | Ready | All rebrandable via Theme settings |
| Product hero + purchase module (bundles, pricing, ATC, reassurance) | Ready | 0 theme-check errors; 30 adversarial findings fixed across Phases 3/6; live-store purchase matrix scripted, pending store |
| Subscription selector | Blocked by external app | Reads real selling plans only; UI hides without them. Needs Shopify Subscriptions (free) or equivalent — app install/approval is a merchant action |
| Mobile sticky add-to-cart | Ready | Proxy-submit, price sync, drawer-aware, safe-area padded |
| Narrative sections (19) + templates | Ready | Editorial defaults, compliance-safe language |
| FAQ / contact / policy templates | Ready | Store-side pages created by seed script |
| Theme Editor presets & schema validity | Ready | 0 schema errors; editor click-through pass scheduled post-deploy |

## Content
| Item | Status | Notes |
| --- | --- | --- |
| Brand name / palette / typography | Ready | Brand-guide palette (watermelon/pinks) + Loretta/Euclid applied per Smooch_BrandGuide.pdf; headings on Fraunces (Shopify-hosted, no license needed) |
| Logo / favicon files | Blocked by missing business data | Wordmark + "oo" submark exist in the brand guide PDF only; header uses a text approximation until SVG/PNG files are provided |
| Product copy (promise, benefits, mechanism, timeline) | Ready with placeholder | Cautious-language defaults; review before paid traffic |
| Formula ingredients + dosages | Blocked by missing business data | Examples marked as examples; dosages hidden until final formula |
| Reviews / featured story / UGC | Blocked by missing business data | Sample-labeled by default; needs real reviews or review app |
| Home-hero proof line | Blocked by missing business data | Empty by default; only add real proof |
| Guarantee length + refund policy | Blocked by merchant approval | 60-day default active; set real length (or 0 to hide) + legal policy |
| Value comparison prices | Blocked by missing business data | Hidden until real substantiable prices entered |
| Policies (refund/privacy/terms/shipping/subscription) | Ready with placeholder | Seed script writes development drafts marked "REQUIRES LEGAL REVIEW" |
| Press-bar outlets (Marie Claire / goop / Vogue / Cosmopolitan) | Blocked by merchant approval | Merchant-asserted features — confirm each placement is real (and logo licenses, if artwork replaces text) before launch |
| Product imagery | Blocked by missing business data | Obvious "SMOOCH QA" placeholders in staging |

## Commerce & operations
| Item | Status | Notes |
| --- | --- | --- |
| Staging store + unpublished deployment | Blocked by merchant approval | Needs store domain (or dev-store creation) + one CLI login; fully scripted after that |
| Store data (QA products, menus, pages) | Blocked by merchant approval | One Admin-API token grant for the seed script |
| Test payments / checkout walk | Blocked by merchant approval | Dev store uses Shopify's test gateway; no real charges ever |
| Live theme safety | Ready | Nothing in the pipeline can publish or edit a live theme; scripts hard-fail on role=live |
| Analytics/StandardEvents parity | Ready | Dawn's event plumbing preserved (product-form, variant-selects) |

## Verification
| Item | Status | Notes |
| --- | --- | --- |
| Static analysis | Ready | 0 errors; 8 known Dawn warnings |
| Automated storefront QA suite | Ready | 9 viewports + purchase matrix A–G + a11y/perf signals; runs post-deploy |
| Full manual editor / a11y / Lighthouse pass | Blocked by merchant approval | Requires the deployed preview |

**Nothing is currently in the Failed category.**
