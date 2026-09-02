import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const el = p.locator('.smooch-buybox .smooch-rating').first();
await el.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/rating.png' });
const m = await p.evaluate(() => {
  const row = document.querySelector('.smooch-buybox .smooch-rating');
  const out = { row: null, kids: [] };
  const r = row.getBoundingClientRect();
  out.row = { cls: row.className, top: r.top, h: r.height, display: getComputedStyle(row).display, align: getComputedStyle(row).alignItems };
  for (const k of row.children) {
    const kr = k.getBoundingClientRect();
    const cs = getComputedStyle(k);
    out.kids.push({ tag: k.tagName, cls: k.className, top: +(kr.top - r.top).toFixed(1), h: +kr.height.toFixed(1), mid: +(kr.top - r.top + kr.height / 2).toFixed(1), fs: cs.fontSize, lh: cs.lineHeight, va: cs.verticalAlign, ff: cs.fontFamily.split(',')[0] });
  }
  return out;
});
console.log(JSON.stringify(m, null, 1));
await b.close();
