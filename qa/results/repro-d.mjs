import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const hero = p.locator('product-info').first();
await hero.locator('[data-smooch-plan-radio][value=""]').check({ force: true });
await p.waitForTimeout(300);
const before = await p.evaluate(() => document.querySelector('[data-smooch-selling-plan]').disabled);
await hero.locator('.smooch-subpanel__content').click({ force: true });
await p.waitForTimeout(400);
const r = await p.evaluate(() => {
  const label = document.querySelector('.smooch-subpanel__content');
  const rc = label.getBoundingClientRect();
  const cx = rc.x + rc.width / 2, cy = rc.y + rc.height / 2;
  const top = document.elementFromPoint(cx, cy);
  const radio = document.querySelector('[data-smooch-plan-radio]:not([value=""])');
  return {
    topAtCenter: top ? `${top.tagName}.${String(top.className).slice(0, 90)}` : null,
    radioChecked: radio ? radio.checked : 'no-radio',
    radioValue: radio ? radio.value : null,
    inputDisabled: document.querySelector('[data-smooch-selling-plan]').disabled,
    labelRect: { x: Math.round(rc.x), y: Math.round(rc.y), w: Math.round(rc.width), h: Math.round(rc.height) },
    radioInLabel: radio ? label.contains(radio) : null,
  };
});
console.log('input disabled after one-time opt-out:', before);
console.log(JSON.stringify(r, null, 1));
await b.close();
