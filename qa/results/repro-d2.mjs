import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const hero = p.locator('product-info').first();

const state = (tag) => p.evaluate((t) => ({
  step: t,
  drawerClass: document.querySelector('cart-drawer').className,
  drawerVis: getComputedStyle(document.querySelector('cart-drawer')).visibility,
  subRadioChecked: document.querySelector('[data-smooch-plan-radio]:not([value=""])').checked,
  oneTimeChecked: document.querySelector('[data-smooch-plan-radio][value=""]').checked,
  planDisabled: document.querySelector('[data-smooch-selling-plan]').disabled,
}), tag).then((r) => console.log(JSON.stringify(r)));

await state('initial');
await hero.locator('[data-smooch-plan-radio][value=""]').check({ force: true });
await p.waitForTimeout(400);
await state('after one-time check');
await p.screenshot({ path: 'qa/results/repro-d2-after-check.png' });
await hero.locator('.smooch-subpanel__content').click({ force: true });
await p.waitForTimeout(400);
await state('after subpanel click');
await p.screenshot({ path: 'qa/results/repro-d2-after-click.png' });
await b.close();
