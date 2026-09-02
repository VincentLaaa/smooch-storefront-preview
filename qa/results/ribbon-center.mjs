import { chromium } from '@playwright/test';
const b = await chromium.launch();
const vp = process.argv[2] === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
const p = await b.newPage({ viewport: vp, deviceScaleFactor: 4 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
await p.evaluate(() => document.querySelector('.smooch-subpanel__ship-ribbon').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(300);
const m = await p.evaluate(() => {
  const rib = document.querySelector('.smooch-subpanel__ship-ribbon');
  const rr = rib.getBoundingClientRect();
  const tr = rib.querySelector('.smooch-subpanel__ship-text').getBoundingClientRect();
  const img = rib.querySelector('img')?.getBoundingClientRect();
  return { ribbon: { top: rr.top, bottom: rr.bottom, h: rr.height }, text: { top: tr.top, bottom: tr.bottom }, img: img ? { top: img.top, bottom: img.bottom } : null,
    padTop: +(tr.top - rr.top).toFixed(2), padBottom: +(rr.bottom - tr.bottom).toFixed(2) };
});
console.log(JSON.stringify(m, null, 1));
const bb = await p.locator('.smooch-subpanel__ship-ribbon').boundingBox();
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/ribbon-zoom.png', clip: { x: bb.x - 6, y: bb.y - 6, width: bb.width + 12, height: bb.height + 12 } });
await b.close();
