# Smooch Section Design Spec (for all smooch-* sections)

The single source of truth for building Smooch sections. Follow it exactly so
19 sections read as one designed system.

## Brand + voice
- Brand name: NEVER hardcode "Smooch" in markup. Use:
  `{%- assign brand_name = settings.smooch_brand_name | default: shop.name -%}`
  Placeholder copy in schema `default`s MAY use "[brand]" only where the section
  liquid replaces it: `{{ block.settings.x | replace: '[brand]', brand_name }}`.
  Otherwise write brand-free copy ("Feel more like yourself again.").
- Tone: feminine, confident, intimate, playful, premium, editorial. Supportive,
  never shaming. Modern beauty brand that happens to sell an ingestible.
- Compliance: cautious language ONLY in every default ("formulated to support",
  "may help support", "some customers notice", "experiences vary"). NEVER claim
  treatment, cure, hormone correction, guaranteed outcomes, FDA approval,
  clinical validation, statistics, or physician endorsement. No fabricated
  reviews/counts/press/certifications. Sample content must say it is sample.

## Layout skeleton (every section)
```liquid
{%- style -%}
  .section-{{ section.id }}-padding {
    padding-top: {{ section.settings.padding_top | times: 0.75 | round: 0 }}px;
    padding-bottom: {{ section.settings.padding_bottom | times: 0.75 | round: 0 }}px;
  }
  @media screen and (min-width: 750px) {
    .section-{{ section.id }}-padding {
      padding-top: {{ section.settings.padding_top }}px;
      padding-bottom: {{ section.settings.padding_bottom }}px;
    }
  }
{%- endstyle -%}
<div class="smooch-band color-{{ section.settings.color_scheme }} gradient">
  <div class="page-width section-{{ section.id }}-padding">
    ...content...
  </div>
</div>
```
- Schema: `"tag": "section", "class": "section"`, body sections add
  `"disabled_on": { "groups": ["header", "footer"] }`.
- color_scheme setting: `{"type":"color_scheme","id":"color_scheme","label":"t:sections.all.colors.label","default":"scheme-?"}`.
- padding settings use the shared t: keys:
  `t:sections.all.padding.section_padding_heading`, `t:sections.all.padding.padding_top`,
  `t:sections.all.padding.padding_bottom` (range 0–100 step 4, defaults ~52/64 for
  editorial bands). ONLY use t: keys that exist in locales/en.default.schema.json —
  when unsure use literal English labels (valid and preferred for Smooch-specific settings).
- Every block's root element carries `{{ block.shopify_attributes }}`.
- Every section has a `presets` array with a full, launch-plausible default
  composition (blocks included).

## Color system
Scheme classes drive backgrounds/foregrounds. Palette mapping (already configured):
- scheme-1 warm cream `#FAF5EE` (default body sections)
- scheme-2 soft blush `#F3DCE2` (testimonials, soft moments)
- scheme-3 saturated berry `#BE2B54`, cream text (editorial statements, hero)
- scheme-4 deep plum `#2B1220`, cream text (comparison, dramatic moments)
- scheme-5 surface white `#FFFDF9` (formula/product detail)
Inside sections use ONLY:
- Scheme vars as RGB triplets: `rgb(var(--color-foreground))`, `rgba(var(--color-foreground), 0.65)`, `rgb(var(--color-background))`.
- Smooch accent tokens: `var(--smooch-berry)`, `var(--smooch-blush)`, `var(--smooch-ink)`,
  `var(--smooch-cream)`, `var(--smooch-surface)`, `var(--smooch-plum)`,
  `var(--smooch-cta-bg)`, `var(--smooch-cta-text)` (+ `-rgb` triplet variants for rgba()).
- Radii: `var(--smooch-radius-card)`, `var(--smooch-radius-button)`, `var(--smooch-radius-media)`.
- Borders: `var(--smooch-border-soft)` / `var(--smooch-border-strong)`.
NEVER hardcode hex colors (rare exceptions: pure white on berry badges already in components).

## Type + shared classes (assets/smooch-base|layout|components.css — already loaded globally)
Typography: `.smooch-display`, `.smooch-h1`, `.smooch-h2`, `.smooch-h3`,
`.smooch-eyebrow` (+`--accent`), `.smooch-lead`, `.smooch-body`, `.smooch-caption`,
`.smooch-fine-print`, `.smooch-num`, `.smooch-quote`, `.smooch-quote-attribution`.
Layout: `.smooch-split` (+`--flip`, `--top`, `--split-a/--split-b` custom props),
`.smooch-stack` (+`--loose`, `--tight`), `.smooch-cluster`, `.smooch-grid`
(`--grid-min` prop), `.smooch-scroller` (+`--desktop-grid`), `.smooch-section-head`
(+`--center`), `.smooch-media` (+`--portrait`, `--square`, `--wide`), `.smooch-divider`,
`.smooch-prose`, `.smooch-measure-narrow`, `.smooch-center`.
Components: `.smooch-btn` (+`--brand`, `--berry`, `--ghost`, `--lg`, `--full`),
`.smooch-badge` (+`--berry`, `--ink`, `--blush`, `--outline`), `.smooch-card`
(+`--flush`), `.smooch-ticks`, `.smooch-icon` (+`--sm`, `--lg`, `--xl`),
`.smooch-stars`, `.smooch-rating`, `.smooch-accordion` (details/summary pattern —
see smooch-product-hero collapsible_tab markup), `.smooch-link`, `.smooch-strike`.
Icons: `{% render 'smooch-icon', icon: 'check' %}` — names: star, star-half,
star-empty, check, heart, sparkle, moon, leaf, drop, truck, shield, lock, gift,
refresh, clock, box, mail, plus, minus, close, arrow-right, arrow-left, caret,
quote, info. Icons are decorative (aria-hidden) — pair with text.
Rating: `{% render 'smooch-rating', product: product, fallback_rating: n, fallback_count: n, show_sample_label: true %}`.
Price: `{% render 'smooch-price', product: product, show_save: true %}`.
Exclusive accordions: wrap `<details>` rows in `<smooch-details-group>` (defined in smooch.js).

## Section-specific CSS
Put it in `assets/section-smooch-<name>.css`, loaded as line 1 of the section:
`{{ 'section-smooch-<name>.css' | asset_url | stylesheet_tag }}`. Class names
prefixed `.smooch-<name>__...`. 1rem = 10px (Dawn base) — size accordingly.
Breakpoints: max-width 749px / min-width 750px / min-width 990px. No horizontal
page overflow ever; wide content scrolls inside its own container.

## Images
Use Shopify responsive images:
```liquid
{{ settings_image | image_url: width: 1500 | image_tag:
  loading: 'lazy', widths: '375, 550, 750, 1100, 1500',
  sizes: '(min-width: 990px) 50vw, 100vw', class: '...', alt: alt_text }}
```
- `loading: 'lazy'` everywhere EXCEPT a homepage hero image (eager + fetchpriority high).
- Always reserve space (aspect-ratio via `.smooch-media--*` or explicit CSS) — no CLS.
- Empty image settings → render a tasteful placeholder:
  `{{ 'product-1' | placeholder_svg_tag: 'smooch-placeholder-svg' }}` or a solid
  blush/berry block. Never broken layouts.

## Accessibility
- One h2 per section (h1 only in hero/product title). Real heading hierarchy.
- `<ul role="list">` when list-style removed. Buttons ≥44px tap target.
- details/summary for accordions (keyboard-free), `aria-controls` on summary
  pointing at the content id (see product hero collapsible_tab).
- No color-only states. Visible focus (`.smooch-focus` or component focus styles).
- Motion: wrap any transition/animation in `@media (prefers-reduced-motion: reduce)` override.
- Image alt from a merchant setting or image.alt; decorative images `alt=""`.

## JavaScript
Avoid it. If truly needed: custom element in the section's own asset file,
guarded `if (!customElements.get('...'))`, listeners in connectedCallback,
cleanup in disconnectedCallback, no top-level document listeners. Prefer CSS
(scroll-snap, details, :checked) for interactions.

## Performance
- Sections must not load smooch-base/layout/components.css (already global).
- Defer any JS. No external libraries, no fonts, no CDN assets.
- Videos: poster + click-to-load (`deferred-media` pattern) — never autoplay on mobile.

## Honesty
- Anything that displays proof (reviews, UGC, ratings) must be clearly
  sample-labeled by default and easy to disable/remove.
- No fake urgency of any kind. No invented prices — value-comparison numbers are
  all merchant-entered with empty defaults that hide the section content.
- Guarantee UI must hide entirely when `settings.smooch_guarantee_days == 0`.
