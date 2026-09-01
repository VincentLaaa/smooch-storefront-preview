import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const audit = await p.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily.split(',')[0], weight: cs.fontWeight };
  };
  return {
    heading: pick('.smooch-buybox__title, .smooch-h1, h1'),
    eyebrow: pick('.smooch-eyebrow'),
    body: pick('.smooch-body, .smooch-lead, .smooch-prose p'),
    plainBody: pick('body'),
    button: pick('.product-form__submit, .button'),
    price: pick('.smooch-num, .smooch-offer-price__current'),
  };
});
console.log(JSON.stringify(audit, null, 1));
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/fonts-desktop.png' });
await b.close();
