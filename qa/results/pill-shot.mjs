import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const pill = p.locator('.smooch-buybox .smooch-flavor-pill').first();
const bb = await pill.boundingBox();
console.log('pill size:', Math.round(bb.width) + 'x' + Math.round(bb.height));
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/pill.png', clip: { x: bb.x - 18, y: bb.y - 18, width: bb.width + 36, height: bb.height + 36 } });
await b.close();
