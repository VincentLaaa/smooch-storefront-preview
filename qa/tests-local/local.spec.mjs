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
  await hero.locator('[data-smooch-plan-radio][value=""]').check({ force: true });
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

  test('B. quantity bundles: totals, unit price, cart quantity', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const bundles = hero.locator('[data-smooch-bundle-radio]');
    expect(await bundles.count()).toBe(3);
    await selectOneTime(hero, page);

    // Anchored largest-first: 3 → 2 → 1 bottles.
    const priceEl = hero.locator('[data-smooch-price]').first();
    const seen = [];
    for (let i = 0; i < 3; i++) {
      await bundles.nth(i).check({ force: true });
      await page.waitForTimeout(300);
      seen.push((await priceEl.textContent()).trim());
    }
    expect(seen).toEqual(['$90.00', '$60.00', '$30.00']);
    await shot(page, 'product-bundle-desktop-1440');

    // Last selection is the 1-bottle supply.
    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible();
    const cart = await cartState(page);
    expect(cart.item_count).toBe(1);
    expect(cart.items[0].final_line_price).toBe(3000);
  });

  test('C. variant picker drives Dawn pipeline: price, form id, cart variant', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const idInput = hero.locator('form[id^="product-form-"] input[name="id"]').first();
    const before = await idInput.inputValue();
    expect(before).toBe('111');

    await selectOneTime(hero, page);

    // Switch Pack option to "2 Packs" → variant 112. Click the LABEL like a
    // real user: Dawn's radios are 1×1 visually-hidden inputs, and Dawn swaps
    // the variant-selects DOM after the change event.
    await hero.locator('label[for="hero-2-1"]').click();
    await expect(idInput).toHaveValue('112', { timeout: 10_000 });

    // Offer price = selected bundle qty (preset preselects 3 bottles) × variant 112.
    const priceEl = hero.locator('[data-smooch-price]').first();
    await expect(priceEl).toHaveText('$168.00');

    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible();
    const cart = await cartState(page);
    expect(String(cart.items[0].variant_id)).toBe('112');
    expect(cart.item_count).toBe(3);
    expect(cart.items[0].final_line_price).toBe(16800);
  });

  test('D. subscription-first selector: default plan, posting, one-time opt-out', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const planRadios = hero.locator('[data-smooch-plan-radio]');
    expect(await planRadios.count()).toBe(3); // 2 fixture frequencies + one-time (last)

    // Subscription-first default: first plan preselected, input live.
    const planInput = hero.locator('[data-smooch-selling-plan]');
    await expect(planInput).toBeEnabled();
    expect(await planInput.inputValue()).toBe('101');
    // 3-bottle default × $27 plan price, one-time total struck through.
    await expect(hero.locator('[data-smooch-price]').first()).toHaveText('$81.00');
    await expect(hero.locator('[data-plan-compare][data-plan-id="101"]')).toHaveText('$90.00');
    const saveBadge = hero.locator('[data-plan-save][data-plan-id="101"]');
    await expect(saveBadge).toContainText('10%');
    await shot(page, 'product-subscription-desktop-1440');

    // frequency change (second plan radio)
    await planRadios.nth(1).check({ force: true });
    expect(await planInput.inputValue()).toBe('102');

    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible();
    const cart = await cartState(page);
    expect(cart.items[0].selling_plan_allocation?.selling_plan?.id).toBe(102);

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
  });

  test('E. sold-out variant: ATC disabled, bundle cards flagged, price dims', async ({ page }) => {
    const hero = page.locator('product-info').first();
    // Raspberry via its label (see matrix C note) → Raspberry / 1 Pack = 114 (sold out)
    await hero.locator('label[for="hero-1-1"]').click();
    const idInput = hero.locator('form[id^="product-form-"] input[name="id"]').first();
    await expect(idInput).toHaveValue('114', { timeout: 10_000 });

    const atc = hero.locator('button[id^="ProductSubmitButton-"]').first();
    await expect(atc).toBeDisabled();
    await expect(atc.locator('span').first()).toContainText(/sold out/i);
    await expect(hero.locator('[data-bundle-soldout]').first()).toBeVisible();
    await expect(page.locator('.smooch-offer--disabled').first()).toBeVisible();
    await shot(page, 'product-soldout-desktop-1440');
  });

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
    const hero = page.locator('product-info').first();
    await selectOneTime(hero, page); // 3-bottle default stays selected
    await page.waitForTimeout(300);
    await expect(sticky.locator('[data-sticky-price]')).toHaveText('$90.00');

    await page.evaluate(() => window.scrollTo(0, 3000));
    await sticky.locator('[data-sticky-submit]').click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    await expect(sticky).toBeHidden();
    await shot(page, 'cart-drawer-mobile-390');
    const cart = await cartState(page);
    expect(cart.item_count).toBe(3);
  });

  test('G. repeated purchase module: isolated, no duplicate ids, no second sticky', async ({ page }) => {
    await noDuplicateIds(page, 'product page');
    expect(await page.locator('smooch-sticky-atc').count()).toBe(1);
    const modules = page.locator('product-info');
    expect(await modules.count()).toBe(2);

    const second = modules.nth(1);
    await second.scrollIntoViewIfNeeded();
    // second module title is h2 (single h1 per page)
    expect(await page.locator('h1:visible').count()).toBe(1);
    const atc2 = second.locator('button[id^="ProductSubmitButton-"]').first();
    await expect(atc2).toBeEnabled();
    await atc2.click();
    await expect(page.locator('cart-drawer.active')).toBeVisible();
    expect((await cartState(page)).item_count).toBeGreaterThan(0);
    await shot(page, 'repeat-purchase-desktop-1440');
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

  test('numbered steps, supply-card economics, per-bottle + exact savings', async ({ page }) => {
    const hero = page.locator('product-info').first();
    await expect(hero.locator('.smooch-step__num').nth(0)).toHaveText('1');
    await expect(hero.locator('.smooch-step__num').nth(1)).toHaveText('2');

    // Largest-first anchoring: index 0 is the 3-bottle best-value card.
    const cards = hero.locator('.smooch-bundle');
    await expect(cards.nth(0).locator('.smooch-bundle__subtitle')).toHaveText('90-day supply');
    await expect(cards.nth(2).locator('.smooch-bundle__subtitle')).toHaveText('30-day supply');

    // Subscription-first default: cards reflect plan pricing (save vs one-time).
    await expect(cards.nth(0).locator('[data-bundle-price]')).toHaveText('$81.00');
    await expect(cards.nth(0).locator('[data-bundle-save-amount]')).toHaveText('Save $9.00');

    // One-time: cards switch to base pricing with compare-at savings.
    await selectOneTime(hero, page);
    await expect(cards.nth(0).locator('[data-bundle-price]')).toHaveText('$90.00');
    await expect(cards.nth(0).locator('[data-bundle-save-amount]')).toHaveText('Save $30.00');
    await expect(cards.nth(2).locator('[data-bundle-save-amount]')).toHaveText('Save $10.00');
    await expect(cards.nth(0).locator('[data-bundle-unit-line]')).toContainText('$30.00 per bottle');
    await expect(cards.nth(0).locator('[data-bundle-per-day]')).toHaveText('$1.00');
    // qty-1 card hides the per-bottle line
    await expect(cards.nth(2).locator('[data-bundle-unit-line]')).toBeHidden();
  });

  test('one-time and plan rows show resulting totals that follow the bundle', async ({ page }) => {
    const hero = page.locator('product-info').first();
    // preset preselects the 3-bottle supply, subscription-first
    await expect(hero.locator('[data-onetime-price]')).toHaveText('$90.00');
    await expect(hero.locator('[data-plan-price]').first()).toHaveText('$81.00');
    await expect(hero.locator('[data-plan-compare]').first()).toHaveText('$90.00');

    await hero.locator('[data-smooch-bundle-radio]').nth(2).check({ force: true });
    await expect(hero.locator('[data-onetime-price]')).toHaveText('$30.00');
    await expect(hero.locator('[data-plan-price]').first()).toHaveText('$27.00');
    await expect(hero.locator('[data-plan-compare]').first()).toHaveText('$30.00');
  });

  test('subscription-first: benefits visible by default; summary tracks the switch', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const benefits = hero.locator('[data-plan-benefits]');

    // Default state: 3 bottles + first plan, benefits and plan line visible.
    await expect(benefits).toBeVisible();
    await expect(hero.locator('[data-summary-supply]')).toHaveText('3 bottles · 90-day supply');
    await expect(hero.locator('[data-summary-plan]')).toContainText('Subscription');
    await expect(hero.locator('[data-smooch-price]').first()).toHaveText('$81.00');
    await expect(hero.locator('[data-summary-save]')).toHaveText('You save $9.00');

    // One-time opt-out: benefits + plan line hide, savings become compare-at based.
    await selectOneTime(hero, page);
    await expect(benefits).toBeHidden();
    await expect(hero.locator('[data-summary-plan]')).toBeHidden();
    await expect(hero.locator('[data-smooch-price]').first()).toHaveText('$90.00');
    await expect(hero.locator('[data-summary-save]')).toHaveText('You save $30.00');
  });

  test('variant switch while subscribed keeps plan pricing coherent', async ({ page }) => {
    const hero = page.locator('product-info').first();
    // Subscribed by default (plan 101). Switch Pack → 2 Packs (variant 112).
    await hero.locator('label[for="hero-2-1"]').click();
    const idInput = hero.locator('form[id^="product-form-"] input[name="id"]').first();
    await expect(idInput).toHaveValue('112', { timeout: 10_000 });
    // bundle qty 3 × v112 plan price ($50.40) = $151.20
    await expect(hero.locator('[data-smooch-price]').first()).toHaveText('$151.20');
    const planInput = hero.locator('[data-smooch-selling-plan]');
    await expect(planInput).toBeEnabled();
    expect(await planInput.inputValue()).toBe('101');
  });

  test('sticky bar mirrors the selection summary (subscription-first default)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PRODUCT);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 3000));
    const sticky = page.locator('smooch-sticky-atc').first();
    await expect(sticky).toBeVisible({ timeout: 10_000 });
    await expect(sticky.locator('[data-sticky-summary]')).toHaveText('3 bottles · 90-day supply · Subscription');
    await expect(sticky.locator('[data-sticky-price]')).toHaveText('$81.00');
  });

  test('media info cards render in the gallery column', async ({ page }) => {
    const cards = page.locator('product-info').first().locator('.smooch-media-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0).locator('.smooch-media-card__heading')).toHaveText('Mood · Desire · Connection');
    await page.locator('.smooch-media-cards').first().screenshot({ path: 'qa/screenshots/pdp-refresh/after-media-cards-desktop-1440.png' });
  });

  test('no subscription UI on a product without selling plans', async ({ page }) => {
    await page.goto(SINGLE);
    const hero = page.locator('product-info').first();
    expect(await hero.locator('.smooch-plans').count()).toBe(0);
    expect(await hero.locator('[data-smooch-selling-plan]').count()).toBe(0);
    // step numbering hidden when there is only one step
    expect(await hero.locator('.smooch-step__num').count()).toBe(0);
  });
});
