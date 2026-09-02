import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const cards = await p.locator('.smooch-buybox .smooch-bundle__card').all();
let x1=1e9,y1=1e9,x2=0,y2=0;
for (const c of cards) { const r = await c.boundingBox(); x1=Math.min(x1,r.x); y1=Math.min(y1,r.y); x2=Math.max(x2,r.x+r.width); y2=Math.max(y2,r.y+r.height); }
const bb={x:x1,y:y1,width:x2-x1,height:y2-y1};
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/bundle.png', clip: { x: bb.x - 6, y: bb.y - 20, width: bb.width + 12, height: bb.height + 26 } });
console.log('badges:', await p.locator('.smooch-bundle__badge').allTextContents());
await b.close();
