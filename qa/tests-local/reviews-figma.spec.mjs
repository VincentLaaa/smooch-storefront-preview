import { test, expect } from '@playwright/test';

const product = '/products/smooch-daily-gummies-qa';

test('review suggestions animate on view and yield to typing and reduced motion', async ({ page }) => {
  await page.goto(product);
  const input = page.locator('[data-smooch-review-search]');
  const suggestion = page.locator('[data-rf-suggestion]');
  await input.scrollIntoViewIfNeeded();
  await expect(suggestion).toHaveText('Low sex drive after children...', { timeout: 6000 });
  await expect(input).toHaveValue('');
  await input.fill('stress');
  await expect(suggestion).toBeHidden();
  await expect(page.locator('[data-smooch-search-status]')).toContainText('stress');
  await expect(input).toHaveValue('stress');
  await page.locator('[data-smooch-search-clear]').click();
  await input.blur();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(suggestion).toHaveText('Search');
  await expect(suggestion).toHaveCSS('animation-name', 'none');
});

test('verified purchase explanation supports hover, keyboard dismissal, and review form', async ({ page }) => {
  await page.goto(product);
  const badge = page.locator('[data-rf-verified]').first();
  const trigger = badge.locator('button');
  await trigger.hover();
  await expect(badge.locator('.smooch-rf__verified-tip')).toContainText('order number');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(badge.locator('.smooch-rf__verified-tip')).toBeHidden();
  await page.locator('[data-rf-write]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Order number')).toHaveAttribute('required', '');
  await expect(dialog.locator('form')).toHaveAttribute('action', '/contact');
  expect(await dialog.locator('form').evaluate(form => form.checkValidity())).toBe(false);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-rf-write]')).toBeFocused();
});

test.describe('mobile review interactions', () => {
  test.use({ viewport: { width: 375, height: 900 }, hasTouch: true });
  test('verified badge toggles by tap and filters reset to the two-card layout', async ({ page }) => {
    await page.goto(product);
    const section = page.locator('#smooch-reviews');
    const badge = section.locator('[data-rf-verified]').first();
    await badge.locator('button').tap();
    await expect(badge.locator('.smooch-rf__verified-tip')).toBeVisible();
    await badge.locator('button').tap();
    await expect(badge.locator('.smooch-rf__verified-tip')).toBeHidden();
    await section.locator('[data-smooch-search-chip]').filter({ hasText: /^Stress$/ }).tap();
    await section.locator('.smooch-rf__filters summary').tap();
    await section.locator('[data-smooch-sort]').selectOption('lowest');
    await section.locator('[data-rf-reset]').tap();
    await expect(section.locator('[data-smooch-review-row]:visible')).toHaveCount(2);
    await expect(section.locator('[data-smooch-review-search]')).toHaveValue('');
    await section.locator('[data-smooch-show-more]').tap();
    await expect(section.locator('[data-smooch-review-row]:visible')).toHaveCount(8);
  });
});
