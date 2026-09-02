import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const btn = p.locator('.smooch-buybox__buy .product-form__submit').first();
const bb = await btn.boundingBox();
console.log('button:', Math.round(bb.width) + 'x' + Math.round(bb.height));
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/atc.png', clip: { x: bb.x - 16, y: bb.y - 16, width: bb.width + 32, height: bb.height + 32 } });
await b.close();
