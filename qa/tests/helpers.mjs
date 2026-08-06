import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export const deploy = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../results/deploy.json', import.meta.url), 'utf8'));
  } catch {
    throw new Error('qa/results/deploy.json missing — run scripts/setup-staging.ps1 first.');
  }
})();

export const seed = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../results/seed.json', import.meta.url), 'utf8'));
  } catch {
    return null;
  }
})();

export const PRODUCT_HANDLE = process.env.QA_PRODUCT_HANDLE || seed?.productHandle || 'smooch-daily-gummies-qa-product';
export const SINGLE_HANDLE = process.env.QA_SINGLE_HANDLE || seed?.singleProductHandle || 'smooch-daily-gummies-qa-single';

export const VIEWPORTS = [
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

/** Collect console errors + failed requests for assertion at test end. */
export function watchConsole(page) {
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    // Ignore aborted prefetches/analytics beacons; report theme asset failures.
    const url = req.url();
    if (/\/(assets|cdn)\//.test(url) && !/analytics|monorail|shopifysvc/.test(url)) {
      problems.push(`requestfailed: ${url} (${req.failure()?.errorText})`);
    }
  });
  return problems;
}

/** Navigate to a storefront path with the unpublished theme preview active,
 *  transparently passing the storefront password page when present. */
export async function gotoPreview(page, path = '/') {
  const sep = path.includes('?') ? '&' : '?';
  await page.goto(`${path}${sep}preview_theme_id=${deploy.themeId}`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/password')) {
    const pw = process.env.STORE_PASSWORD;
    if (!pw) throw new Error('Storefront is password-protected: set STORE_PASSWORD env var.');
    await page.fill('input[type="password"]', pw);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
    await page.goto(`${path}${sep}preview_theme_id=${deploy.themeId}`, { waitUntil: 'domcontentloaded' });
  }
  // The preview bar iframe can overlap content in screenshots; hide it.
  await page.addStyleTag({ content: '#preview-bar-iframe, .shopify-preview-bar { display: none !important; }' }).catch(() => {});
}

export async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth - doc.clientWidth, document.body.scrollWidth - doc.clientWidth);
  });
  expect(overflow, `${label}: horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(1);
}

export async function assertNoDuplicateIds(page, label) {
  const dupes = await page.evaluate(() => {
    const seen = new Map();
    for (const el of document.querySelectorAll('[id]')) {
      seen.set(el.id, (seen.get(el.id) || 0) + 1);
    }
    return [...seen.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
  });
  expect(dupes, `${label}: duplicate ids ${dupes.join(', ')}`).toEqual([]);
}

export async function cartState(page) {
  return page.evaluate(async () => {
    const res = await fetch('/cart.js');
    return res.json();
  });
}

export async function clearCart(page) {
  await page.evaluate(async () => {
    await fetch('/cart/clear.js', { method: 'POST' });
  });
}

export async function screenshot(page, name) {
  await page.screenshot({ path: `qa/screenshots/${name}.png`, fullPage: false });
}

export async function fullPageScreenshot(page, name) {
  await page.screenshot({ path: `qa/screenshots/${name}.png`, fullPage: true });
}
