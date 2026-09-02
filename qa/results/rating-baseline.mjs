import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const m = await p.evaluate(() => {
  const row = document.querySelector('.smooch-buybox .smooch-rating');
  const val = row.querySelector('.smooch-rating__value');
  const cnt = row.querySelector('.smooch-rating__count');
  const stars = row.querySelector('.smooch-stars-img');
  // exact glyph boxes via Range
  const box = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return { top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2), mid: +((b.top + b.bottom) / 2).toFixed(2) };
  };
  const sb = stars.getBoundingClientRect();
  return {
    value: box(val), count: box(cnt),
    stars: { top: +sb.top.toFixed(2), bottom: +sb.bottom.toFixed(2), mid: +((sb.top + sb.bottom) / 2).toFixed(2) },
    valStyles: { fs: getComputedStyle(val).fontSize, lh: getComputedStyle(val).lineHeight, fw: getComputedStyle(val).fontWeight },
    cntStyles: { fs: getComputedStyle(cnt).fontSize, lh: getComputedStyle(cnt).lineHeight, fw: getComputedStyle(cnt).fontWeight },
  };
});
console.log(JSON.stringify(m, null, 1));
// draw guides at stars midline and screenshot
await p.evaluate(() => {
  const row = document.querySelector('.smooch-buybox .smooch-rating');
  const sb = row.querySelector('.smooch-stars-img').getBoundingClientRect();
  const line = document.createElement('div');
  line.style.cssText = `position:fixed;left:${sb.left - 120}px;width:${sb.width + 260}px;top:${(sb.top + sb.bottom) / 2 - 0.5}px;height:1px;background:rgba(0,128,255,.9);z-index:99999;pointer-events:none`;
  document.body.appendChild(line);
});
const el = p.locator('.smooch-buybox .smooch-rating').first();
await el.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/rating-guide.png' });
await b.close();
