import { test, expect } from '@playwright/test';

/** Offline MVP QA against the local render harness.
 *  Verifies THEME behavior (markup, CSS, JS, offer engine, Dawn pipeline
 *  integration) with mock data. Does NOT verify real Shopify cart pricing,
 *  checkout, subscriptions billing, or publishing — those are deferred to
 *  real-store QA (see docs/SMOOCH-LAUNCH-READINESS.md).
 */

const PRODUCT = '/products/smooch-daily-gummies-qa';
const SINGLE = '/products/smooch-daily-gummies-qa-single';

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 800 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

function watchConsole(page) {
  const problems = [];
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`); });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.startsWith('http://127.0.0.1')) problems.push(`requestfailed: ${url} (${req.failure()?.errorText})`);
  });
  return problems;
}

async function noHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth - doc.clientWidth, document.body.scrollWidth - doc.clientWidth);
  });
  expect(overflow, `${label}: horizontal overflow ${overflow}px`).toBeLessThanOrEqual(1);
}

async function noDuplicateIds(page, label) {
  const dupes = await page.evaluate(() => {
    const seen = new Map();
    for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
    return [...seen.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
  });
  expect(dupes, `${label}: duplicate ids ${dupes.join(', ')}`).toEqual([]);
}

const cartState = (page) => page.evaluate(() => fetch('/cart.js').then((r) => r.json()));
const clearCart = (page) => page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
// Subscription-first is the default; switch to one-time for base-price tests.
const selectOneTime = async (hero, page) => {
  // Click the visible label body, like a real user taps it — the radio
  // itself is visually-hidden (1x1, clipped) and native label click-forwarding
  // handles the rest. Force-clicking the hidden input's own tiny hit box is
  // fragile: its CSS static position can end up overlapped by unrelated
  // normal-flow siblings after scroll-driven relayout.
  await hero.locator('.smooch-plan--onetime .smooch-plan__divider-text').click({ force: true });
  await page.waitForTimeout(200);
};
const shot = (page, name) => page.screenshot({ path: `qa/screenshots/${name}.png` });
const fullShot = (page, name) => page.screenshot({ path: `qa/screenshots/${name}.png`, fullPage: true });

// ---------------------------------------------------------------- viewports
test.describe('Viewport sweep', () => {
  for (const vp of VIEWPORTS) {
    test(`homepage @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const problems = watchConsole(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await noHorizontalOverflow(page, `homepage ${vp.name}`);
      await noDuplicateIds(page, `homepage ${vp.name}`);
      await shot(page, `homepage-${vp.name}`);
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test(`product @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const problems = watchConsole(page);
      await page.goto(PRODUCT);
      await page.waitForLoadState('networkidle');
      await noHorizontalOverflow(page, `product ${vp.name}`);
      await shot(page, `product-hero-${vp.name}`);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  test('FAQ + full-page captures', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/pages/faq');
    await noHorizontalOverflow(page, 'faq desktop');
    await fullShot(page, 'faq-desktop-1440');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pages/faq');
    await noHorizontalOverflow(page, 'faq mobile');
    await fullShot(page, 'faq-mobile-390');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    await page.waitForLoadState('networkidle');
    await fullShot(page, 'product-fullpage-desktop-1440');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await fullShot(page, 'homepage-fullpage-desktop-1440');
  });
});

// ---------------------------------------------------------------- purchase
test.describe('Purchase matrix (offline harness)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    await clearCart(page);
  });

  test('A. standard add-to-cart opens drawer, bubble + line price correct', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const atc = hero.locator('button[id^="ProductSubmitButton-"]').first();
    await expect(atc).toBeEnabled();
    await atc.click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    await shot(page, 'cart-drawer-desktop-1440');
    const cart = await cartState(page);
    expect(cart.item_count).toBeGreaterThan(0);
    await expect(page.locator('#cart-icon-bubble .cart-count-bubble span').first()).toContainText(String(cart.item_count));
  });

  test('A2. cart drawer: shipping meter, order summary, secure checkout, ticker', async ({ page }) => {
    const hero = page.locator('product-info').first();
    // Default selection: 3-month subscription ($80.94 ≥ $50 threshold).
    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    const drawer = page.locator('cart-drawer .drawer__inner');

    await expect(drawer.locator('[data-smooch-shipbar]')).toHaveClass(/smooch-cart-shipbar--unlocked/);
    await expect(drawer.locator('[data-smooch-shipbar]')).toContainText('unlocked FREE shipping');

    const summary = drawer.locator('.smooch-cart-summary');
    await expect(summary).toContainText('Order summary');
    await expect(summary.locator('.smooch-cart-summary__row').nth(0)).toContainText('$119.85'); // subtotal
    await expect(summary.locator('.smooch-cart-summary__row--discount')).toContainText('-$38.91');
    await expect(summary.locator('.smooch-cart-summary__free')).toHaveText('FREE SHIPPING');
    // Deal recap next to the total: percent badge, struck retail, final price.
    await expect(summary.locator('.smooch-cart-summary__pct')).toHaveText('32% OFF');
    await expect(summary.locator('.smooch-cart-summary__total .smooch-strike')).toHaveText('$119.85');
    await expect(summary.locator('.smooch-cart-summary__final')).toHaveText('$80.94');

    await expect(drawer.locator('#CartDrawer-Checkout')).toContainText('Secure checkout');
    // Marquee ticker: one visible set of three lines plus its aria-hidden clone.
    const tickerItems = drawer.locator('.smooch-cart-ticker__list:not([aria-hidden]) .smooch-cart-ticker__item');
    expect(await tickerItems.count()).toBe(3);
    await expect(tickerItems.nth(2)).toContainText('30-day money-back guarantee');
    await expect(drawer.locator('.smooch-cart-ticker__list[aria-hidden]')).toHaveCount(1);
  });

  test('A3. cart drawer: progress message and deal chips drive real quantity updates', async ({ page }) => {
    const hero = page.locator('product-info').first();
    // 1-month subscription: $29.95 line, below the $50 free-shipping threshold.
    await hero.locator('[data-smooch-bundle-radio]').last().check({ force: true });
    await page.waitForTimeout(300);
    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    const drawer = page.locator('cart-drawer .drawer__inner');

    await expect(drawer.locator('[data-smooch-shipbar]')).not.toHaveClass(/smooch-cart-shipbar--unlocked/);
    await expect(drawer.locator('[data-smooch-shipbar]')).toContainText('$20.05 away from FREE shipping');

    // Two missed deals with real savings ($10/unit under the 1-month plan).
    const chips = drawer.locator('.smooch-cart-deal');
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toContainText('Save $20.00');
    await expect(chips.nth(1)).toContainText('Save $30.00');

    // Clicking "Buy 3" updates the real line quantity through Dawn's pipeline.
    // Wait for the server-rendered drawer refresh (debounced change + section
    // render) before reading cart state: unlocked shipbar only renders once
    // the $81 cart came back from the server.
    await chips.nth(1).click();
    await expect(drawer.locator('[data-smooch-shipbar]')).toHaveClass(/smooch-cart-shipbar--unlocked/, { timeout: 10_000 });
    await expect(drawer.locator('input.quantity__input')).toHaveValue('3');
    await expect(drawer.locator('.smooch-cart-deal')).toHaveCount(0);
    const cart = await cartState(page);
    expect(cart.items[0].quantity).toBe(3);
  });

  test('B. quantity bundles: totals, unit price, cart quantity', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const bundles = hero.locator('[data-smooch-bundle-radio]');
    expect(await bundles.count()).toBe(3);
    await selectOneTime(hero, page);
    // selectOneTime scrolls down to the one-time row; scroll back so the
    // size cards aren't left sitting right under the sticky header, where
    // scrollIntoViewIfNeeded() considers them "in view" but they're actually
    // covered by it.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    // Cards render largest-first: 3 → 2 → 1 bottles.
    const priceEl = hero.locator('[data-smooch-price]').first();
    const seen = [];
    for (let i = 0; i < 3; i++) {
      await bundles.nth(i).check({ force: true });
      await page.waitForTimeout(300);
      seen.push((await priceEl.textContent()).trim());
    }
    expect(seen).toEqual(['$119.85', '$79.90', '$39.95']);
    await shot(page, 'product-bundle-desktop-1440');

    // Last selection is the 1-month supply.
    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible();
    const cart = await cartState(page);
    expect(cart.item_count).toBe(1);
    expect(cart.items[0].final_line_price).toBe(3995);
  });

  test('C. no Pack/variant picker — "Select Your Size" bundles are the only size control', async ({ page }) => {
    const hero = page.locator('product-info').first();
    // The raw "1 Pack / 2 Packs / 3 Packs" Dawn variant picker is intentionally
    // removed from this template — bundles alone drive size/quantity.
    expect(await hero.locator('.product-form__input, .smooch-buybox__variants').count()).toBe(0);
    expect(await page.locator('text=/^1 Pack$/').count()).toBe(0);

    const idInput = hero.locator('form[id^="product-form-"] input[name="id"]').first();
    expect(await idInput.inputValue()).toBe('111');

    // Switching size (bundle) never changes the underlying variant — only qty.
    await hero.locator('[data-smooch-bundle-radio]').last().check({ force: true });
    expect(await idInput.inputValue()).toBe('111');
  });

  test('D. subscription-first selector: fixed cadence (no frequency picker), posting, one-time opt-out', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const planRadios = hero.locator('[data-smooch-plan-radio]');
    // Exactly one fixed subscription cadence + one-time — no frequency choice.
    expect(await planRadios.count()).toBe(2);
    await expect(hero.locator('.smooch-freq')).toHaveCount(0);

    // Subscription-first default: the fixed plan preselected, input live.
    // Each bundle carries its own real selling plan; the preselected 3-month
    // bundle maps to plan 103.
    const planInput = hero.locator('[data-smooch-selling-plan]');
    await expect(planInput).toBeEnabled();
    expect(await planInput.inputValue()).toBe('103');
    // 3-bottle default × real $80.94 plan price, one-time total struck through.
    await expect(hero.locator('[data-smooch-price]').first()).toHaveText('$80.94');
    await expect(hero.locator('[data-sub-compare]')).toHaveText('$119.85');
    await expect(hero.locator('[data-sub-pct]')).toHaveText('32');
    await expect(hero.locator('[data-sub-pct-pill]')).toContainText('SAVE 32%');
    await shot(page, 'product-subscription-desktop-1440');

    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible();
    const cart = await cartState(page);
    expect(cart.items[0].selling_plan_allocation?.selling_plan?.id).toBe(103);

    // Close the drawer first — it overlays the panel, so radio clicks would
    // land on the overlay. Then one-time opt-out disables the input.
    await page.locator('cart-drawer .drawer__close').click();
    await expect(page.locator('cart-drawer.active')).toHaveCount(0);
    await page.waitForFunction(() => {
      const d = document.querySelector('cart-drawer');
      return !d || getComputedStyle(d).visibility === 'hidden';
    });
    await hero.locator('[data-smooch-plan-radio][value=""]').check({ force: true });
    await expect(planInput).toBeDisabled();

    // Clicking the subscription card re-selects it — the card itself is the
    // only "subscribe" control now that there's no separate frequency pill.
    await hero.locator('.smooch-subpanel__content').click({ force: true });
    await expect(planInput).toBeEnabled();
    expect(await planInput.inputValue()).toBe('103');
  });

  // Retired: this exercised switching to a sold-out variant via the Pack
  // picker, which is now intentionally removed (bundles are quantity
  // multipliers of a single fixed variant, not a variant switcher). Dawn's
  // own disabled/sold-out button swap requires the real picker's fetch-based
  // section re-render — there's no way to reach that state from the shipped
  // UI anymore, and simulating it by hand (setting the hidden id input and
  // dispatching 'change') doesn't trigger that swap, so faking a pass here
  // would test something that can no longer happen for a real shopper.

  test('F. mobile sticky ATC: appears, syncs price, proxies form, hides with drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PRODUCT);
    await clearCart(page);

    const sticky = page.locator('smooch-sticky-atc').first();
    await page.evaluate(() => window.scrollTo(0, 3000));
    await expect(sticky).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => document.body.classList.contains('smooch-sticky-atc-visible'))).toBe(true);
    await shot(page, 'sticky-atc-mobile-390');

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(sticky).toBeHidden(); // let the sticky bar clear the tap target before interacting
    const hero = page.locator('product-info').first();
    await selectOneTime(hero, page); // 3-bottle default stays selected
    await page.waitForTimeout(300);
    await expect(sticky.locator('[data-sticky-price]')).toHaveText('$119.85');

    await page.evaluate(() => window.scrollTo(0, 3000));
    await sticky.locator('[data-sticky-submit]').click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    await expect(sticky).toBeHidden();
    await shot(page, 'cart-drawer-mobile-390');
    const cart = await cartState(page);
    expect(cart.item_count).toBe(3);
  });

  test('G. one canonical product form; no placeholder proof on the default PDP', async ({ page }) => {
    await noDuplicateIds(page, 'product page');
    expect(await page.locator('smooch-sticky-atc').count()).toBe(1);
    // Simplified PDP: a single buybox is the only product form.
    expect(await page.locator('product-info').count()).toBe(1);
    expect(await page.locator('form[id^="product-form-"]:not([id*="installment"])').count()).toBe(1);
    expect(await page.locator('h1:visible').count()).toBe(1);
    // The product page ships review sections (carousel + full) with the
    // honesty flag flipped to "Verified Buyer" — no sample badge should
    // remain. No unbacked-press placeholders either.
    expect(await page.locator('#smooch-reviews .smooch-rf__sample-badge').count()).toBe(0);
    expect(await page.locator('.smooch-press-bar').count()).toBe(0);
  });
});

// ---------------------------------------------------------------- states
test('single-variant product: no variant picker, working ATC', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SINGLE);
  await clearCart(page);
  expect(await page.locator('variant-selects').count()).toBe(0);
  const hero = page.locator('product-info').first();
  const atc = hero.locator('button[id^="ProductSubmitButton-"]').first();
  await expect(atc).toBeEnabled();
  await atc.click();
  await expect(page.locator('cart-drawer.active')).toBeVisible();
  expect((await cartState(page)).item_count).toBeGreaterThan(0);
  await shot(page, 'product-single-variant-desktop-1440');
});

// ---------------------------------------------------------------- a11y
test.describe('Accessibility spot checks', () => {
  test('h1 uniqueness, accordion aria sync, keyboard bundles, focus visibility', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    expect(await page.locator('h1:visible').count()).toBe(1);

    await page.goto(PRODUCT);
    const faqGroup = page.locator('smooch-details-group').first();
    const summaries = faqGroup.locator('summary');
    if ((await summaries.count()) >= 2) {
      await summaries.nth(0).click();
      await summaries.nth(1).click();
      expect(await faqGroup.locator('details').nth(0).evaluate((d) => d.open)).toBe(false);
      const aria = await summaries.nth(0).getAttribute('aria-expanded');
      if (aria !== null) expect(aria).toBe('false');
    }

    const bundles = page.locator('product-info').first().locator('[data-smooch-bundle-radio]');
    await bundles.first().focus();
    await page.keyboard.press('ArrowDown');
    expect(await bundles.nth(1).isChecked()).toBe(true);

    // focus ring styling exists on the focused bundle card
    const outline = await page.evaluate(() => {
      const input = document.querySelector('[data-smooch-bundle-radio]:checked');
      const card = input.nextElementSibling;
      return getComputedStyle(card).outlineStyle;
    });
    expect(['solid', 'auto']).toContain(outline);
  });

  test('reduced motion renders cleanly', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const problems = watchConsole(page);
    await page.goto('http://127.0.0.1:9292' + PRODUCT);
    await page.waitForLoadState('networkidle');
    expect(problems, problems.join('\n')).toEqual([]);
    await ctx.close();
  });
});

// ---------------------------------------------------------------- perf
test.describe('Performance signals', () => {
  test('homepage: ≤2 eager images, all images have reserved space', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const stats = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('main img')];
      return {
        eager: imgs.filter((i) => i.loading !== 'lazy').length,
        missingDims: imgs
          .filter((i) => !i.getAttribute('width') && !i.style.aspectRatio && !i.closest('.smooch-media, [style*="aspect-ratio"]'))
          .map((i) => i.src.split('/').pop()),
        total: imgs.length,
      };
    });
    expect(stats.eager, `eager imgs: ${stats.eager}/${stats.total}`).toBeLessThanOrEqual(2);
    expect(stats.missingDims, `imgs without reserved space: ${stats.missingDims.join(', ')}`).toEqual([]);
  });

  test('product page CLS < 0.1 (lab)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PRODUCT);
    const metrics = await page.evaluate(() => new Promise((resolve) => {
      let lcp = 0; let cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve({ lcp, cls }), 4000);
    }));
    console.log(`[perf] product mobile (local): LCP≈${Math.round(metrics.lcp)}ms CLS=${metrics.cls.toFixed(4)}`);
    expect(metrics.cls).toBeLessThan(0.1);
  });
});

// ---------------------------------------------------------------- PDP refresh
test.describe('PDP refresh: guided purchase flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    await clearCart(page);
  });

  test('numbered step, simplified supply cards: month / count / per-day only', async ({ page }) => {
    const hero = page.locator('product-info').first();
    // Single numbered step: supply. (The subscription panel is unnumbered.)
    expect(await hero.locator('.smooch-step__num').count()).toBe(1);
    await expect(hero.locator('.smooch-step__num').first()).toHaveText('1');

    // Create-style month cards, 3 → 2 → 1 (best value first, auto-selected).
    // Deliberately minimal: no price, compare-at, or savings on the card —
    // that full breakdown lives in the subscription card below.
    const cards = hero.locator('.smooch-bundle');
    await expect(cards.nth(2).locator('.smooch-bundle__title')).toHaveText('1 Month');
    await expect(cards.nth(2).locator('.smooch-bundle__count')).toHaveText('30 Count');
    await expect(cards.nth(0).locator('.smooch-bundle__count')).toHaveText('90 Count');
    expect(await cards.nth(0).locator('.smooch-bundle__input').isChecked()).toBe(true);
    expect(await hero.locator('[data-bundle-price]').count()).toBe(0);
    expect(await hero.locator('[data-bundle-save-amount]').count()).toBe(0);

    // Subscription-first default: per-day reflects the real plan discount.
    await expect(cards.nth(0).locator('[data-bundle-per-day]')).toHaveText('$0.90');

    // One-time: per-day switches to the real base (undiscounted) rate —
    // uniform across bundles since one-time is just qty × the $39.95 tub.
    await selectOneTime(hero, page);
    await expect(cards.nth(0).locator('[data-bundle-per-day]')).toHaveText('$1.33');
    await expect(cards.nth(2).locator('[data-bundle-per-day]')).toHaveText('$1.33');
  });

  test('subscription panel and one-time row track the selected supply', async ({ page }) => {
    const hero = page.locator('product-info').first();
    // preset preselects the 3-month supply, subscription-first
    await expect(hero.locator('[data-onetime-price]')).toHaveText('$119.85');
    await expect(hero.locator('[data-sub-price]')).toHaveText('$80.94');
    await expect(hero.locator('[data-sub-compare]')).toHaveText('$119.85');
    await expect(hero.locator('[data-sub-perday]')).toHaveText('$0.90');
    await expect(hero.locator('[data-sub-saving]')).toContainText('$38.91');
    // Meta line is compact: the bundle title (plan-label) already carries the
    // duration, so the supply span only needs the bottle count.
    await expect(hero.locator('[data-sub-plan-label]')).toHaveText('3 Months');
    await expect(hero.locator('[data-sub-supply]')).toHaveText('· 3 bottles');

    await hero.locator('[data-smooch-bundle-radio]').last().check({ force: true });
    await expect(hero.locator('[data-onetime-price]')).toHaveText('$39.95');
    await expect(hero.locator('[data-sub-price]')).toHaveText('$29.95');
    await expect(hero.locator('[data-sub-compare]')).toHaveText('$39.95');
    await expect(hero.locator('[data-sub-perday]')).toHaveText('$1.00');
    await expect(hero.locator('[data-sub-plan-label]')).toHaveText('1 Month');
    await expect(hero.locator('[data-sub-supply]')).toHaveText('· 1 bottle');
  });

  test('subscription panel featured by default; dims on one-time opt-out', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const panel = hero.locator('[data-sub-panel]');
    const perks = hero.locator('[data-plan-benefits]');

    // Default state: panel active with perks, summary carries the plan line.
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveClass(/smooch-subpanel--inactive/);
    await expect(perks).toBeVisible();
    await expect(hero.locator('[data-summary-supply]')).toHaveText('3 bottles · 90-day supply');
    await expect(hero.locator('[data-summary-plan]')).toContainText('Subscription');
    await expect(hero.locator('[data-smooch-price]').first()).toHaveText('$80.94');
    // Auto-applied badge shows while the discount is live.
    await expect(hero.locator('[data-sub-autobadge]')).toBeVisible();
    // Summary is a single quiet line: no strike/save/per-bottle repeats.
    await expect(hero.locator('[data-summary-save]')).toHaveCount(0);
    await expect(hero.locator('[data-smooch-compare]')).toHaveCount(0);
    await expect(hero.locator('[data-smooch-unit-line]')).toHaveCount(0);

    // One-time opt-out: panel dims (still informative), summary switches.
    await selectOneTime(hero, page);
    await expect(panel).toHaveClass(/smooch-subpanel--inactive/);
    await expect(hero.locator('[data-summary-plan]')).toBeHidden();
    await expect(hero.locator('[data-smooch-price]').first()).toHaveText('$119.85');

    // Tapping the subscription card itself re-subscribes — there's no
    // separate frequency picker; the whole card is the clickable control.
    await hero.locator('.smooch-subpanel__content').click({ force: true });
    await expect(panel).not.toHaveClass(/smooch-subpanel--inactive/);
    await expect(hero.locator('[data-smooch-price]').first()).toHaveText('$80.94');
  });

  // Retired: this exercised switching Pack variants while subscribed. The
  // Pack picker is intentionally removed (see test C) — bundles are quantity
  // multipliers of one fixed variant now, so there's no longer a variant
  // switch for the plan to stay coherent across.

  test('sticky bar shows the product name (not a bundle/plan label) and mirrors price', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PRODUCT);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 3000));
    const sticky = page.locator('smooch-sticky-atc').first();
    await expect(sticky).toBeVisible({ timeout: 10_000 });
    // Real product name (the same custom title the H1 uses), not a
    // "3 Months · Subscribe" bundle/plan label that used to live here.
    await expect(sticky.locator('[data-sticky-summary]')).toHaveText("Smooch Women's Libido & Mood Gummies");
    await expect(sticky.locator('[data-sticky-price]')).toHaveText('$80.94');
    // Switching bundle/plan must never change the displayed product name.
    const hero = page.locator('product-info').first();
    await hero.locator('[data-smooch-bundle-radio]').last().check({ force: true });
    await page.waitForTimeout(300);
    await expect(sticky.locator('[data-sticky-summary]')).toHaveText("Smooch Women's Libido & Mood Gummies");
  });

  test('media info cards render in the gallery column', async ({ page }) => {
    const cards = page.locator('product-info').first().locator('.smooch-media-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0).locator('.smooch-media-card__heading')).toHaveText('Mood · Desire · Connection');
    await page.locator('.smooch-media-cards').first().screenshot({ path: 'qa/screenshots/pdp-refresh/after-media-cards-desktop-1440.png' });
  });

  test('sticky gallery never slides over the media cards while scrolling', async ({ page }) => {
    // The sticky unit must be the whole media column (gallery + card rail);
    // sticking only Dawn's inner media-gallery lets it ride down over the cards.
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const y of [0, 400, 800, 1200, 1600, 2200]) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(120);
      const overlap = await page.evaluate(() => {
        const gal = document.querySelector('media-gallery').getBoundingClientRect();
        const cards = document.querySelector('.smooch-media-cards').getBoundingClientRect();
        return Math.max(0, gal.bottom - cards.top);
      });
      expect(overlap, `gallery overlaps cards by ${overlap}px at scrollY=${y}`).toBeLessThanOrEqual(1);
    }
  });

  test('collage gallery: every photo visible at once, no slider chrome', async ({ page }) => {
    for (const vw of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(vw);
      const items = page.locator('.product__media-item');
      await expect(items).toHaveCount(4);
      for (let i = 0; i < 4; i += 1) {
        const box = await items.nth(i).boundingBox();
        expect(box?.width ?? 0, `media item ${i} collapsed at ${vw.width}px`).toBeGreaterThan(50);
      }
      // No thumbnail strip and no visible mobile slider counter in the collage.
      await expect(page.locator('.thumbnail-list__item')).toHaveCount(0);
      await expect(page.locator('media-gallery .slider-buttons')).toBeHidden();
    }
  });

  test('no subscription UI on a product without selling plans', async ({ page }) => {
    await page.goto(SINGLE);
    const hero = page.locator('product-info').first();
    expect(await hero.locator('.smooch-plans').count()).toBe(0);
    expect(await hero.locator('[data-smooch-selling-plan]').count()).toBe(0);
    // the supply step is numbered "1" regardless of whether selling plans exist
    expect(await hero.locator('.smooch-step__num').count()).toBe(1);
  });

  test('product name, prominent sales-activity badge, real-inventory "selling fast" badge, CTA trust line', async ({ page }) => {
    const hero = page.locator('product-info').first();

    await expect(page.locator('h1').first()).toHaveText("Smooch Women's Libido & Mood Gummies");

    // Sales-activity badge renders before the title (subtitle-row placement).
    const proofBadge = hero.locator('.smooch-sold-badge');
    const title = hero.locator('h1').first();
    const proofBox = await proofBadge.boundingBox();
    const titleBox = await title.boundingBox();
    expect(proofBox.y).toBeLessThan(titleBox.y);
    await expect(proofBadge).toHaveText('2k+ bought in the past month');

    // Low-stock badge reads real inventory (default fixture variant: 25 units,
    // template threshold: 30) — never a fabricated claim.
    await expect(hero.locator('.smooch-stock-badge')).toHaveText('Selling fast');

    // Create-style micro-trust row directly under the Add to Cart button,
    // sourced from the subscription block's real benefits setting.
    const perks = hero.locator('.smooch-buybox__buy-perks li');
    await expect(perks).toHaveCount(3);
    await expect(perks.nth(0)).toHaveText('Every order ships FREE');
    await expect(perks.nth(1)).toHaveText('VIP discounts & perks');
    await expect(perks.nth(2)).toHaveText('Pause, edit, or cancel anytime');
  });

  test('Create-style buybox: one-time row, discount badge, trust grid, footer row — single source of truth', async ({ page }) => {
    const hero = page.locator('product-info').first();

    // No flavor step — the first numbered step is the size selector.
    await expect(hero.locator('.smooch-bundles__legend')).toContainText('Select Your Size');
    expect(await hero.locator('text=Select Your Flavor').count()).toBe(0);

    // Discount badge shown by default (subscription-first) and driven by the
    // same planId the offer engine already uses — no separate state.
    const discountBadge = hero.locator('[data-discount-badge]');
    await expect(discountBadge).toBeVisible();
    await expect(discountBadge).toContainText('Discount Auto-Applied');

    // One-time row: real total (qty × the flat $39.95 tub, no multi-buy
    // discount outside a subscription) + real per-day. No compare-at here —
    // only the subscription plan carries a discount against this size.
    const onetimeRow = hero.locator('.smooch-plan--onetime');
    await expect(onetimeRow.locator('[data-onetime-compare]')).toBeHidden();
    await expect(onetimeRow.locator('[data-onetime-price]')).toHaveText('$119.85');
    await expect(onetimeRow.locator('[data-onetime-perday]')).toHaveText('$1.33');

    // Selecting one-time is the single source of truth: discount badge hides,
    // the (still real, bundle-driven) compare price stays on the one-time row.
    await selectOneTime(hero, page);
    await expect(discountBadge).toBeHidden();
    await expect(hero.locator('[data-smooch-selling-plan]')).toBeDisabled();

    // 3-column trust grid: real icon + short stacked title per item.
    const trustItems = hero.locator('.smooch-trust-grid li');
    await expect(trustItems).toHaveCount(3);
    await expect(trustItems.nth(0)).toContainText('30-Day Money Back Guarantee');

    // Small footer info row with an optional "Learn more" link.
    await expect(hero.locator('.smooch-reassurance__footer-row')).toContainText('HSA/FSA eligible');
  });

  test('"Most popular" ribbon only shows for the preselected (3-month) size', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const ribbon = hero.locator('[data-sub-ribbon]');

    // Default selection is the 3-month bundle (preselected: true) — visible.
    await expect(ribbon).toBeVisible();

    // Switch to 1 Month (last card, not preselected) — ribbon hides.
    await hero.locator('[data-smooch-bundle-radio]').last().check({ force: true });
    await expect(ribbon).toBeHidden();

    // Switch back to 3 Months (first card) — ribbon returns.
    await hero.locator('[data-smooch-bundle-radio]').first().check({ force: true });
    await expect(ribbon).toBeVisible();
  });

  test('Add to Cart hover: turns black and reveals a trailing arrow', async ({ page }) => {
    const btn = page.locator('.smooch-buybox__buy .product-form__submit');
    await btn.scrollIntoViewIfNeeded();

    const restBg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
    const restArrowWidth = await btn.evaluate((el) => getComputedStyle(el, '::before').width);
    expect(restArrowWidth).toBe('0px');

    await btn.hover();
    await page.waitForTimeout(300);
    const hoverBg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
    const hoverArrowWidth = await btn.evaluate((el) => getComputedStyle(el, '::before').width);
    const hoverArrowOpacity = await btn.evaluate((el) => getComputedStyle(el, '::before').opacity);

    expect(hoverBg).not.toBe(restBg);
    expect(hoverBg).toBe('rgb(17, 17, 17)');
    expect(hoverArrowWidth).not.toBe('0px');
    expect(hoverArrowOpacity).toBe('1');

    // Flex `order: 1` puts the arrow after the label visually, even though
    // it's a ::before pseudo-element (Dawn's own ::after is already used for
    // every .button's border/glow ring, so the arrow can't live there).
    const arrowOrder = await btn.evaluate((el) => getComputedStyle(el, '::before').order);
    const spanOrder = await btn.evaluate((el) => getComputedStyle(el.querySelector('span')).order);
    expect(Number(arrowOrder)).toBeGreaterThan(Number(spanOrder) || 0);
  });
});

// ---------------------------------------------------------------- scroll story
test.describe('Scroll story: full (product page) vs compact (homepage)', () => {
  test('homepage uses compact mode and stays roughly one section tall', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const story = page.locator('[data-smooch-story]');
    await expect(story).toHaveAttribute('data-mode', 'compact');
    const box = await story.boundingBox();
    // Compact target is ~70-110vh; give it headroom but this must stay well
    // under a multi-screen scroll story (which lands around 300vh).
    expect(box.height).toBeLessThan(900 * 1.6);
    // No long-form progress rail or sticky visual column in compact mode.
    expect(await story.locator('.smooch-story__rail').count()).toBe(0);
    const stickyPos = await story.locator('.smooch-story__visual-sticky').evaluate((el) => getComputedStyle(el).position);
    expect(stickyPos).toBe('static');
  });

  // The full-mode floating visual now lives inside the product page's
  // timeline section ("What's happening in your body?") rather than as its
  // own standalone section — [data-smooch-story] there is the visual column
  // (the same reused smooch-scroll-story JS/CSS), and the timeline's own
  // Week 1-4 steps double as its "stages". The section is intentionally
  // compact (not a tall scroll-jacked reveal) — boss feedback was that the
  // old deliberately-tall layout meant too much scrolling — so this only
  // checks the sticky visual mechanics still work, not a minimum height.
  test('product page: timeline section uses a sticky floating visual', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    const timelineSection = page.locator('#shopify-section-body');
    const box = await timelineSection.boundingBox();
    expect(box.height).toBeGreaterThan(0);
    const story = timelineSection.locator('[data-smooch-story]');
    await expect(story).toHaveAttribute('data-mode', 'full');
    const stickyPos = await story.locator('.smooch-timeline__visual-sticky').evaluate((el) => getComputedStyle(el).position);
    expect(stickyPos).toBe('sticky');
    // Real bundled product photo fallback shows even with no image picked.
    await expect(story.locator('.smooch-story__product-img')).toBeVisible();
  });

  test('product page: timeline steps drive the floating visual\'s active-stage state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    const timelineSection = page.locator('#shopify-section-body');
    const steps = timelineSection.locator('.smooch-timeline__step');
    const stepCount = await steps.count();
    expect(stepCount).toBe(4);

    // Scroll each step's own vertical center to the middle of the viewport
    // (matching the observer's -45%/-45% rootMargin band) rather than
    // guessing a fraction of the whole section — the section also contains
    // the header/facts/disclaimer, so its total height isn't proportional
    // to the 4 steps alone.
    const seen = [];
    for (let i = 0; i < stepCount; i++) {
      // boundingBox() is viewport-relative, not document-absolute — add the
      // current scroll position to get a real target for window.scrollTo.
      const stepBox = await steps.nth(i).boundingBox();
      const currentScrollY = await page.evaluate(() => window.scrollY);
      const targetY = currentScrollY + stepBox.y + stepBox.height / 2 - 450;
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(600);
      const active = await timelineSection.locator('.smooch-timeline__step.is-active').getAttribute('data-stage-index');
      seen.push(active === null ? null : Number(active));
    }
    expect(seen).toEqual([0, 1, 2, 3]);
    // The sticky visual should still be within the viewport partway through
    // (not scrolled away above it) while a middle step is active.
    const midStepBox = await steps.nth(1).boundingBox();
    const scrollYNow = await page.evaluate(() => window.scrollY);
    await page.evaluate((y) => window.scrollTo(0, y), scrollYNow + midStepBox.y + midStepBox.height / 2 - 450);
    await page.waitForTimeout(400);
    const sceneBox = await timelineSection.locator('.smooch-story__scene').boundingBox();
    expect(sceneBox).not.toBeNull();
    expect(sceneBox.y).toBeGreaterThan(-10);
    expect(sceneBox.y).toBeLessThan(900);
  });

  test('compact mode does not attach the scroll-reaction listener', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?scroll_story_preview=1');
    const productScroll = page.locator('[data-smooch-product-scroll]').first();
    // Scroll the whole page substantially — in full mode this drives
    // --smooch-story-scroll-rot/x/scale; in compact it must never be set.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    const rot = await productScroll.evaluate((el) => el.style.getPropertyValue('--smooch-story-scroll-rot'));
    expect(rot).toBe('');
  });

  test('both modes respect prefers-reduced-motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    await page.goto('/?scroll_story_preview=1');
    const homeAnim = await page.locator('[data-floating]').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(homeAnim).toBe('none');

    await page.goto(PRODUCT + '?scroll_story_preview=1');
    const productAnim = await page.locator('[data-floating]').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(productAnim).toBe('none');

    await ctx.close();
  });
});

// ---------------------------------------------------------------- reviews
test.describe('Reviews: curated carousel + full reviews (product page only)', () => {
  test('carousel: honesty labeling, mixed card widths, next-card peek', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    const carousel = page.locator('[data-smooch-carousel]');
    await expect(carousel).toBeVisible();
    // Honesty toggle flipped live: no sample badge, every card reads "Verified Buyer",
    // and every card shows an avatar (photo or initial monogram).
    await expect(carousel.locator('.smooch-rc__sample-badge')).toHaveCount(0);
    expect(await carousel.locator('.smooch-rc__card-status', { hasText: 'Sample' }).count()).toBe(0);
    const cardCountForStatus = await carousel.locator('.smooch-rc__card').count();
    expect(await carousel.locator('.smooch-rc__card-status', { hasText: 'Verified Buyer' }).count()).toBe(cardCountForStatus);
    expect(await carousel.locator('.smooch-rc__avatar').count()).toBe(cardCountForStatus);

    // Mixed card types/widths present.
    const longW = await carousel.locator('.smooch-rc__card--long').first().boundingBox();
    const shortW = await carousel.locator('.smooch-rc__card--short').first().boundingBox();
    expect(longW.width).not.toBe(shortW.width);

    // Next card partially visible (peeking past the viewport edge) at start:
    // some card's right edge extends beyond the track's visible edge, and
    // not every card is fully within it.
    const cards = carousel.locator('.smooch-rc__card');
    const cardCount = await cards.count();
    expect(cardCount).toBe(12);
    const track = carousel.locator('[data-smooch-track]');
    const trackBox = await track.boundingBox();
    const visibleEdge = trackBox.x + trackBox.width;
    const boxes = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    const peeking = boxes.some((right) => right > visibleEdge + 5);
    const fullyVisible = boxes.every((right) => right <= visibleEdge + 5);
    expect(peeking).toBe(true);
    expect(fullyVisible).toBe(false);
  });

  test('carousel: arrows scroll the track and correctly disable at each end', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    const track = page.locator('[data-smooch-track]');
    await track.scrollIntoViewIfNeeded();

    expect(await page.evaluate(() => document.querySelector('[data-smooch-prev]').disabled)).toBe(true);

    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => document.querySelector('[data-smooch-next]').click());
      await page.waitForTimeout(200);
    }
    const info = await track.evaluate((el) => ({ scrollLeft: el.scrollLeft, max: el.scrollWidth - el.clientWidth }));
    expect(info.scrollLeft).toBeGreaterThan(0);
    expect(Math.abs(info.scrollLeft - info.max)).toBeLessThan(2);
    expect(await page.evaluate(() => document.querySelector('[data-smooch-next]').disabled)).toBe(true);
  });

  test('full reviews: id="smooch-reviews" anchor, distribution math, honesty labels', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    const full = page.locator('#smooch-reviews');
    await expect(full).toBeVisible();

    // 40 demo reviews: 36 five-star, 2 four-star, 1 three-star, 0 two-star,
    // 1 one-star -> 90% / 5% / 2.5% / 0% / 2.5%.
    const fills = full.locator('.smooch-rf__dist-fill');
    await expect(fills).toHaveCount(5);
    const widths = await fills.evaluateAll((els) => els.map((el) => el.style.width));
    expect(widths).toEqual(['90%', '5%', '2.5%', '0%', '2.5%']);

    // Honesty toggle flipped live: no "Demo review"/"Sample" labels, every row reads "Verified Buyer".
    expect(await full.locator('.smooch-rf__row-demo').count()).toBe(0);
    expect(await full.locator('.smooch-rf__sample-badge').count()).toBe(0);
    const rowCount = await full.locator('.smooch-rf__row').count();
    expect(await full.getByText(/verified buyer/i).count()).toBe(rowCount);

    // No review/aggregateRating structured data anywhere on the page.
    const ldJsonBlocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasReviewSchema = ldJsonBlocks.some((json) => /"@type"\s*:\s*"(Review|AggregateRating)"/i.test(json));
    expect(hasReviewSchema).toBe(false);
  });

  test('full reviews: initial 6 shown, "Show more" reveals the rest and then hides, sort has no errors', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(PRODUCT);
    const full = page.locator('#smooch-reviews');
    await full.scrollIntoViewIfNeeded();

    expect(await full.locator('.smooch-rf__row:not([hidden])').count()).toBe(6);
    const moreBtn = full.locator('[data-smooch-show-more]');
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();
    // Batches by 6 (40 reviews total now) — one click reveals the next
    // batch, not everything at once; the button stays visible until the
    // last batch.
    expect(await full.locator('.smooch-rf__row:not([hidden])').count()).toBe(12);
    await expect(moreBtn).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await moreBtn.click();
    }
    expect(await full.locator('.smooch-rf__row:not([hidden])').count()).toBe(40);
    await expect(moreBtn).toBeHidden();

    await page.selectOption('[data-smooch-sort]', 'highest');
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });

  test('reviews sections respect prefers-reduced-motion and stay off the homepage', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    expect(await page.locator('[data-smooch-carousel]').count()).toBe(0);
    expect(await page.locator('#smooch-reviews').count()).toBe(0);

    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const rp = await ctx.newPage();
    await rp.goto(PRODUCT);
    const carousel = rp.locator('[data-smooch-carousel]');
    await carousel.scrollIntoViewIfNeeded();
    await rp.waitForTimeout(400);
    const opacity = await rp.locator('[data-smooch-fade-up]').first().evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
    await ctx.close();
  });
});
