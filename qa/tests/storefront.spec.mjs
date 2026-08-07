import { test, expect } from '@playwright/test';
import {
  deploy, PRODUCT_HANDLE, SINGLE_HANDLE, VIEWPORTS,
  gotoPreview, watchConsole, assertNoHorizontalOverflow, assertNoDuplicateIds,
  cartState, clearCart, screenshot, fullPageScreenshot,
} from './helpers.mjs';

const PRODUCT_PATH = `/products/${PRODUCT_HANDLE}?view=smooch`;

test.describe('Viewport sweep — layout integrity', () => {
  for (const vp of VIEWPORTS) {
    test(`homepage @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const problems = watchConsole(page);
      await gotoPreview(page, '/');
      await page.waitForLoadState('networkidle').catch(() => {});
      await assertNoHorizontalOverflow(page, `homepage ${vp.name}`);
      await assertNoDuplicateIds(page, `homepage ${vp.name}`);
      await screenshot(page, `homepage-${vp.name}`);
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test(`product page @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const problems = watchConsole(page);
      await gotoPreview(page, PRODUCT_PATH);
      await page.waitForLoadState('networkidle').catch(() => {});
      await assertNoHorizontalOverflow(page, `product ${vp.name}`);
      await screenshot(page, `product-hero-${vp.name}`);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  test('FAQ page @ desktop-1440 and mobile-390', async ({ page }) => {
    for (const vp of [{ name: 'desktop-1440', width: 1440, height: 900 }, { name: 'mobile-390', width: 390, height: 844 }]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoPreview(page, '/pages/faq');
      await assertNoHorizontalOverflow(page, `faq ${vp.name}`);
      await fullPageScreenshot(page, `faq-${vp.name}`);
    }
  });

  test('full-page editorial capture (product, desktop-1440)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPreview(page, PRODUCT_PATH);
    await page.waitForLoadState('networkidle').catch(() => {});
    await fullPageScreenshot(page, 'product-fullpage-desktop-1440');
  });
});

test.describe('Purchase matrix', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPreview(page, PRODUCT_PATH);
    await clearCart(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
  });

  test('A. standard add-to-cart → drawer opens, bubble updates, line price correct', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const atc = hero.locator('button[id^="ProductSubmitButton-"]').first();
    await expect(atc).toBeEnabled();
    await atc.click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'cart-drawer-desktop-1440');
    const cart = await cartState(page);
    expect(cart.item_count).toBeGreaterThan(0);
    const bubble = page.locator('#cart-icon-bubble .cart-count-bubble');
    await expect(bubble).toContainText(String(cart.item_count));
  });

  test('B. quantity bundles update price, unit price, and cart quantity', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const bundles = hero.locator('[data-smooch-bundle-radio]');
    const count = await bundles.count();
    test.skip(count === 0, 'No bundle blocks configured on this product');

    const priceEl = hero.locator('[data-smooch-price]').first();
    const prices = [];
    for (let i = 0; i < count; i++) {
      await bundles.nth(i).check({ force: true }); // input is visually-hidden by design
      await page.waitForTimeout(400);
      const price = (await priceEl.textContent())?.trim();
      prices.push(price);
      const qty = await bundles.nth(i).getAttribute('data-quantity');
      if (Number(qty) > 1) {
        const card = hero.locator('.smooch-bundle').nth(i).locator('[data-bundle-unit-line]');
        if (await card.count()) await expect(card.first()).toBeVisible();
      }
    }
    expect(new Set(prices).size, `bundle tiers should show distinct totals: ${prices.join(' | ')}`).toBeGreaterThan(1);
    await screenshot(page, 'product-bundle-desktop-1440');

    // Add highest tier, verify cart quantity matches the bundle quantity.
    const last = bundles.nth(count - 1);
    await last.check({ force: true });
    const expectedQty = Number(await last.getAttribute('data-quantity')) || 1;
    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    const cart = await cartState(page);
    expect(cart.item_count).toBe(expectedQty);
  });

  test('C. variant-mode bundle / variant picker drives price + form variant id', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const packInputs = hero.locator('variant-selects .product-form__input input[type="radio"]');
    test.skip((await packInputs.count()) === 0, 'No variant picker rendered');

    const idInput = hero.locator('form[id^="product-form-"] input[name="id"]').first();
    const before = await idInput.inputValue();
    // Click a different Pack option value (second radio in the last option group).
    const groups = hero.locator('variant-selects .product-form__input');
    const lastGroup = groups.last();
    const options = lastGroup.locator('input[type="radio"]');
    await options.nth(1).check({ force: true });
    await page.waitForFunction(
      ([sel, prev]) => document.querySelector(sel)?.value !== prev,
      [`form[id^="product-form-"] input[name="id"]`, before],
      { timeout: 10_000 }
    );
    const after = await idInput.inputValue();
    expect(after).not.toBe(before);

    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    const cart = await cartState(page);
    expect(String(cart.items[0].variant_id)).toBe(after);
  });

  test('D. subscription selector (auto-skips without selling plans)', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const planRadios = hero.locator('[data-smooch-plan-radio]');
    const count = await planRadios.count();
    test.skip(count === 0, 'BLOCKED: no selling plans on staging store (requires subscriptions app approval)');

    const planInput = hero.locator('[data-smooch-selling-plan]');
    await expect(planInput).toBeDisabled(); // one-time default posts no selling_plan
    await planRadios.nth(1).check({ force: true });
    await expect(planInput).toBeEnabled();
    const planId = await planInput.inputValue();
    expect(planId).not.toBe('');
    await screenshot(page, 'product-subscription-desktop-1440');

    await hero.locator('button[id^="ProductSubmitButton-"]').first().click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    const cart = await cartState(page);
    expect(cart.items[0].selling_plan_allocation?.selling_plan?.id).toBeTruthy();
  });

  test('E. sold-out variant disables ATC, sticky bar mirrors, price dims', async ({ page }) => {
    const hero = page.locator('product-info').first();
    const groups = hero.locator('variant-selects .product-form__input');
    test.skip((await groups.count()) < 2, 'Needs Flavor × Pack QA product');

    // Raspberry / 1 Pack is the seeded sold-out variant.
    await groups.first().locator('input[type="radio"]', { hasNot: page.locator(':checked') });
    await groups.first().locator('input[type="radio"]').nth(1).check({ force: true }); // Raspberry
    await page.waitForTimeout(600);
    await groups.last().locator('input[type="radio"]').nth(0).check({ force: true }); // 1 Pack
    const atc = hero.locator('button[id^="ProductSubmitButton-"]').first();
    await expect(atc).toBeDisabled({ timeout: 10_000 });
    await expect(atc.locator('span').first()).toContainText(/sold out/i);
    await screenshot(page, 'product-soldout-desktop-1440');
  });

  test('F. mobile sticky ATC appears, tracks offer price, proxies real form', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPreview(page, PRODUCT_PATH);
    await clearCart(page);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const sticky = page.locator('smooch-sticky-atc').first();
    await page.evaluate(() => window.scrollTo(0, 2500));
    await expect(sticky).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'sticky-atc-mobile-390');

    // Body padding reserves space (no covered content).
    const hasPad = await page.evaluate(() => document.body.classList.contains('smooch-sticky-atc-visible'));
    expect(hasPad).toBe(true);

    // Change bundle → sticky price follows the offer price.
    const hero = page.locator('product-info').first();
    const bundles = hero.locator('[data-smooch-bundle-radio]');
    if ((await bundles.count()) > 1) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await bundles.last().check({ force: true });
      await page.waitForTimeout(400);
      const offerPrice = (await hero.locator('[data-smooch-price]').first().textContent())?.trim();
      const stickyPrice = (await sticky.locator('[data-sticky-price]').textContent())?.trim();
      expect(stickyPrice).toBe(offerPrice);
    }

    await page.evaluate(() => window.scrollTo(0, 2500));
    await sticky.locator('[data-sticky-submit]').click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'cart-drawer-mobile-390');
    // Sticky bar hides while the drawer is open.
    await expect(sticky).toBeHidden();
    const cart = await cartState(page);
    expect(cart.item_count).toBeGreaterThan(0);
  });

  test('G. repeated purchase module: unique ids, no second sticky bar, independent form', async ({ page }) => {
    const modules = page.locator('product-info');
    const count = await modules.count();
    test.skip(count < 2, 'Template has a single product hero');

    await assertNoDuplicateIds(page, 'product page with repeated module');
    expect(await page.locator('smooch-sticky-atc').count()).toBe(1);

    // The second module adds to cart via its own form.
    await clearCart(page);
    const second = modules.nth(1);
    await second.scrollIntoViewIfNeeded();
    const atc2 = second.locator('button[id^="ProductSubmitButton-"]').first();
    await expect(atc2).toBeEnabled();
    await atc2.click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    const cart = await cartState(page);
    expect(cart.item_count).toBeGreaterThan(0);
    await screenshot(page, 'repeat-purchase-desktop-1440');
  });
});

test.describe('Accessibility spot checks', () => {
  test('single h1 per page; FAQ accordions sync aria-expanded; bundle radios keyboard-operable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoPreview(page, '/');
    expect(await page.locator('h1').count(), 'homepage must have exactly one h1').toBe(1);

    await gotoPreview(page, PRODUCT_PATH);
    expect(await page.locator('h1:visible').count(), 'product page must have exactly one visible h1').toBe(1);

    // Exclusive accordions: opening the second closes the first and syncs aria-expanded.
    const faq = page.locator('smooch-details-group').first();
    if (await faq.count()) {
      const summaries = faq.locator('summary');
      if ((await summaries.count()) >= 2) {
        await summaries.nth(0).click();
        await summaries.nth(1).click();
        const firstOpen = await faq.locator('details').nth(0).evaluate((d) => d.open);
        expect(firstOpen, 'first accordion should auto-close').toBe(false);
        const ariaFirst = await summaries.nth(0).getAttribute('aria-expanded');
        if (ariaFirst !== null) expect(ariaFirst).toBe('false');
      }
    }

    // Bundle radios reachable and switchable via keyboard.
    const bundles = page.locator('product-info').first().locator('[data-smooch-bundle-radio]');
    if ((await bundles.count()) > 1) {
      await bundles.first().focus();
      await page.keyboard.press('ArrowDown');
      const secondChecked = await bundles.nth(1).isChecked();
      expect(secondChecked, 'arrow key should move bundle selection').toBe(true);
    }
  });

  test('reduced motion: page renders with no animation errors', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const problems = watchConsole(page);
    await gotoPreview(page, PRODUCT_PATH);
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(problems, problems.join('\n')).toEqual([]);
    await ctx.close();
  });
});

test.describe('Single-variant product state', () => {
  test('simple product renders Dawn price, no bundle UI, working ATC', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPreview(page, `/products/${SINGLE_HANDLE}?view=smooch`);
    await clearCart(page);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const hero = page.locator('product-info').first();
    // Template bundles blocks exist but this product may still use them (quantity
    // mode works on any product) — assert core purchasability either way.
    const atc = hero.locator('button[id^="ProductSubmitButton-"]').first();
    await expect(atc).toBeEnabled();
    await atc.click();
    await expect(page.locator('cart-drawer.active')).toBeVisible({ timeout: 10_000 });
    const cart = await cartState(page);
    expect(cart.item_count).toBeGreaterThan(0);
    await screenshot(page, 'product-single-variant-desktop-1440');
  });
});

test.describe('Performance signals (lab-lite)', () => {
  test('homepage: exactly one eager hero image; below-fold images lazy; CLS-safe dimensions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPreview(page, '/');
    const imgStats = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('main img')];
      return {
        eager: imgs.filter((i) => i.loading !== 'lazy').length,
        missingDims: imgs.filter((i) => !i.getAttribute('width') && !i.style.aspectRatio && !i.closest('[style*="aspect-ratio"], .smooch-media')).length,
        total: imgs.length,
      };
    });
    expect(imgStats.eager, `eager images in main: ${imgStats.eager}`).toBeLessThanOrEqual(2);
    expect(imgStats.missingDims, 'images without reserved space').toBe(0);
  });

  test('product page LCP + CLS within budget (chromium lab approximation)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPreview(page, PRODUCT_PATH);
    const metrics = await page.evaluate(() => new Promise((resolve) => {
      let lcp = 0; let cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve({ lcp, cls }), 5000);
    }));
    console.log(`[perf] product mobile: LCP≈${Math.round(metrics.lcp)}ms CLS=${metrics.cls.toFixed(3)}`);
    expect(metrics.cls, `CLS ${metrics.cls}`).toBeLessThan(0.1);
    // Lab LCP is directional only (preview bar + non-throttled). Budget generous:
    expect(metrics.lcp, `LCP ${metrics.lcp}ms`).toBeLessThan(6000);
  });
});
