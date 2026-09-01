import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const otf = readFileSync('Images for smooch/Fontspring-DEMO-proximanova-bold.otf').toString('base64');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 700, height: 260 } });
await p.setContent(`<style>
@font-face { font-family:'PXTest'; src:url(data:font/otf;base64,${otf}) format('opentype'); }
div { font-size: 34px; padding: 6px 14px; }
.px { font-family: 'PXTest', monospace; font-weight: 700; }
.ref { font-family: Arial; font-weight: 700; }
</style>
<div class="px">0123456789 $19.95 25% OFF 4.8/5 (1,692)</div>
<div class="ref">0123456789 $19.95 25% OFF 4.8/5 (1,692)</div>`);
await p.waitForTimeout(500);
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/font-test.png' });
await b.close();
