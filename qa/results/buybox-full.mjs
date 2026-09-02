import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const bb = await p.locator('.smooch-buybox').first().boundingBox();
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/buybox-full.png', clip: { x: bb.x - 8, y: bb.y - 8, width: bb.width + 16, height: Math.min(bb.height, 900) + 16 } });
await b.close();
