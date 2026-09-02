import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const bb = await p.locator('.smooch-buybox__benefits').first().boundingBox();
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/bullets.png', clip: { x: bb.x - 6, y: bb.y - 6, width: bb.width + 12, height: bb.height + 12 } });
await b.close();
