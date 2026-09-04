import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`desktop product and reviews fill their columns at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/products/smooch-daily-gummies-qa');
    await expect(page.locator('.smooch-product__panel')).toHaveCSS('zoom', '1');
    const media = await page.locator('.smooch-product__gallery').boundingBox();
    const panel = await page.locator('.smooch-product__panel').boundingBox();
    expect(panel.width).toBeGreaterThan(400);
    expect(panel.width / media.width).toBeGreaterThan(0.8);
    expect(panel.width / media.width).toBeLessThan(1.1);
    expect(panel.x - media.x - media.width).toBeGreaterThan(20);
    expect(panel.x - media.x - media.width).toBeLessThan(60);
    const buttons = page.locator('.smooch-buybox .product-form__buttons');
    await expect(buttons).toHaveCSS('max-width', 'none');
    await page.locator('.smooch-bundle__card').nth(2).click();
    await expect(page.locator('[data-smooch-bundle-radio]').nth(2)).toBeChecked();
    const reviews = page.locator('[data-smooch-review-row]:visible');
    await expect(reviews).toHaveCount(2);
    const first = await reviews.nth(0).boundingBox();
    const second = await reviews.nth(1).boundingBox();
    expect(Math.abs(first.y - second.y)).toBeLessThan(1);
    expect(second.x).toBeGreaterThan(first.x + first.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
