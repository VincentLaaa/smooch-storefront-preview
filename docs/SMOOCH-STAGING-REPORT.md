# Smooch — Shopify Staging Report

Status date: 2026-08-06
Repository: `C:\Users\vince\Dev\SmoochAI Web` · branch `main` · deployed-from commit: _pending deployment_ (HEAD at time of writing: `596d4de`)

## 1. Repository audit (completed)
- Git: clean working tree, 5-commit history intact (`f806b04` Dawn 15.5.0 import → `596d4de` Phase 6 QA fixes), branch `main`.
- Docs verified present and current: `SMOOCH-ARCHITECTURE.md`, `SMOOCH-DESIGN-SPEC.md`, `SMOOCH-SETUP.md`.
- Secrets scan: no tokens/passwords tracked; `.gitignore` covers `.shopify/`, `node_modules/`, `.env*`, Playwright artifacts.
- No production configuration present (no store domain, no theme IDs, no credentials anywhere in the repo).
- Theme structure: full Dawn 15.5 tree + 20 `smooch-*` sections, 8 snippets, Smooch templates and section groups.

## 2. Validation (completed)
- `shopify theme check` (CLI 3.85 local dev-dependency): **0 errors, 8 warnings** across 177 files
  → recorded at `qa/results/theme-check.json`.
  The 8 warnings are known non-blocking Dawn baseline issues (`scheme_classes`
  UndefinedObject in theme/password layouts, Dawn variable-naming/unused-assign
  notes, `quick-order-product-row` orphaned snippet). Per policy these are not
  "fixed" — they ship with stock Dawn.

## 3. Tools installed (project-local, completed)
- `@shopify/cli` 3.x — `node_modules` dev dependency (no global installs).
- `@playwright/test` + Chromium browser binary.
- `package.json` scripts: `npm run check` (theme check), `npm run qa` (storefront suite).

## 4. Automation built (completed)
| Artifact | Purpose |
| --- | --- |
| `scripts/setup-staging.ps1` | Theme-check-gated deploy as a **new unpublished theme** (`Smooch QA - <date>`); records store inventory before touching anything; verifies post-push role is not `live`; rerun-safe (updates the same staging theme by ID); refuses to proceed if the recorded staging theme ever reports `live`. No publish flag exists anywhere in it. |
| `scripts/seed-store-data.mjs` | Idempotent Admin-GraphQL seeding: multi-variant QA product (Flavor × Pack; compare-at and no-compare-at variants; tracked inventory; one deliberately sold-out variant `QA-RSP-1`; `product.smooch` template; clearly-labeled placeholder media), single-variant untracked QA product, FAQ/Contact pages on Smooch templates, development-draft policies (marked "REQUIRES LEGAL REVIEW"), main/footer menus, Online Store publication, and staging-theme-only template wiring of product pickers. Token via `SHOPIFY_ADMIN_TOKEN` env only — never written to disk. |
| `scripts/run-storefront-qa.ps1` | Runs the Playwright suite against the unpublished preview; hard-refuses if the recorded theme role is `live`. |
| `qa/playwright.config.mjs`, `qa/tests/*` | 40+ automated checks: 9-viewport sweep (320→1920) of homepage/product/FAQ with horizontal-overflow, duplicate-ID, console-error and failed-asset assertions; purchase matrix A–G (standard add, quantity bundles incl. cart quantity assertion, variant-mode switching with form `input[name=id]` and `/cart.js` verification, subscription selector incl. `selling_plan` posting — auto-marked BLOCKED when no selling-plan app exists, sold-out state, mobile sticky-ATC behavior incl. price sync/proxy-submit/drawer-hide, repeated-module isolation); accessibility spot checks (single h1, accordion `aria-expanded` sync, keyboard bundle selection, reduced motion); single-variant product state; performance signals (eager-image budget, reserved image space, lab CLS < 0.1). Screenshots land in `qa/screenshots/` with the agreed names. |

## 5. Store / deployment status — ⏸ BLOCKED on the one unavoidable human step
This machine has **no Shopify CLI session and no known store**:
- No `%APPDATA%/shopify` / `~/.config/shopify` session state, no `SHOPIFY_*` env vars.
- `shopify theme list` correctly reports "A store is required".
- Creating a Shopify **development store** is a Partner-Dashboard web flow tied to
  the owner's login (often with 2FA/CAPTCHA) — it cannot be done headlessly
  without the owner's authenticated browser.

Per the hands-off rules, the following minimal interventions are requested (see
final handoff): provide/create the staging store domain and complete the one
CLI login. Everything downstream is scripted and resumes automatically.

Deployment fields to be filled by `setup-staging.ps1` on first run
(`qa/results/deploy.json`): store, theme ID, theme name, role (verified
non-live twice: CLI push output *and* post-push theme list), preview URL,
editor URL, live-theme ID (recorded and never touched), git commit, timestamp.

## 6. Theme configuration state
Everything configurable **in theme code** already ships configured in the repo
(this is why the theme deploys pre-configured): brand settings defaults,
Smooch palette color schemes, typography, drawer cart, announcement/header/
footer groups, homepage + product + FAQ templates, sticky ATC on, review/
formula/value-comparison honest placeholder states, disclaimers.
Store-side objects (products, menus, pages, policies, publication, template
product pickers) are covered by `seed-store-data.mjs`.

## 7. Test execution status
| Area | Status |
| --- | --- |
| Static validation (theme check, JSON, schema) | ✅ done — 0 errors |
| Deployment | ⏸ blocked on store + login |
| Store data seeding | ⏸ blocked on store + Admin token approval |
| Browser QA (9 viewports, purchase matrix A–G) | 🔧 suite built & installed; runs via one command post-deploy |
| Subscription (matrix D) | ⏸ blocked on subscriptions app approval (test auto-skips with BLOCKED message; not a theme defect) |
| Checkout / test payment | ⏸ requires dev store (Shopify test gateway); cart-level assertions automated via `/cart.js` |
| Theme Editor QA | ⏸ requires deployed theme (manual pass planned in the editor URL) |
| Accessibility | partial ✅ static review done in Phase 6; automated spot checks in suite; full manual pass post-deploy |
| Performance | 🔧 lab-lite checks in suite (CLS/LCP/eager-image budget); full Lighthouse pass post-deploy |

## 8. Defects
- Found during staging-tooling construction: none new. (Phases 3/6 defect logs
  live in the git history: 7 purchase-module defects + 23 integration findings, all fixed.)
- Placeholder content intentionally present: sample-labeled reviews/story,
  empty hero proof line, example ingredients with dosages hidden, hidden
  value comparison, development policies pending legal review, placeholder
  product imagery (obvious "SMOOCH QA" development placeholders).

## 9. Resume sequence (fully scripted once unblocked)
```powershell
# 1) one-time login happens during the first CLI call
pwsh -File scripts/setup-staging.ps1 -Store <store>.myshopify.com
# 2) seed store data (needs SHOPIFY_ADMIN_TOKEN in this shell only)
node scripts/seed-store-data.mjs
# 3) storefront QA ($env:STORE_PASSWORD for password-protected dev stores)
pwsh -File scripts/run-storefront-qa.ps1
```
