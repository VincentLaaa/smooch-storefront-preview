import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/mobile-current.png' });
const m = await p.evaluate(() => {
  const hero = document.querySelector('.smooch-hero, .smooch-pdp-hero, [class*="hero"]');
  const buybox = document.querySelector('[class*="buybox"]');
  const img = document.querySelector('img[class*="hero"], [class*="gallery"] img, [class*="media"] img');
  const r = (el) => el ? { cls: el.className, top: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height) } : null;
  return { hero: r(hero), buybox: r(buybox), img: img ? { ...{cls: img.className}, top: Math.round(img.getBoundingClientRect().top), h: Math.round(img.getBoundingClientRect().height), natural: img.naturalWidth + 'x' + img.naturalHeight, src: img.currentSrc.split('/').pop() } : null, vh: innerHeight };
});
console.log(JSON.stringify(m, null, 1));
await b.close();
