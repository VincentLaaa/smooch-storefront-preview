import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const m = await p.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return 'MISSING: ' + sel;
    return el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) + ' -> ' + getComputedStyle(el).fontFamily.split(',')[0];
  };
  return [
    pick('.smooch-subpanel__title'),
    pick('.smooch-subpanel__pct-pill'),
    pick('.smooch-subpanel__price'),
    pick('.smooch-subpanel__meta'),
    pick('.smooch-sold-badge'),
    pick('.smooch-plan--onetime'),
    pick('.smooch-buybox__buy-perks li:nth-child(2)'),
  ];
});
console.log(m.join('\n'));
await b.close();
