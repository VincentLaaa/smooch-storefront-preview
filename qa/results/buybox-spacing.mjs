import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const m = await p.evaluate(() => {
  const q = (s) => document.querySelector('.smooch-buybox ' + s);
  const els = {
    ratingRow: q('.smooch-rating')?.closest('div'),
    rating: q('.smooch-rating'),
    proof: q('.smooch-buybox__proof-row') || q('.smooch-sold-badge')?.parentElement,
    sold: q('.smooch-sold-badge'),
    title: q('.smooch-buybox__title'),
  };
  const out = {};
  for (const [k, el] of Object.entries(els)) {
    if (!el) { out[k] = null; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[k] = { cls: el.className.slice(0, 60), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), mt: cs.marginTop, mb: cs.marginBottom };
  }
  // glyph boxes for visual gaps
  const glyph = (el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1) }; };
  out.glyphs = { rating: glyph(els.rating), sold: els.sold ? glyph(els.sold) : null, title: glyph(els.title) };
  const parent = els.title.parentElement;
  out.parentGap = getComputedStyle(parent).rowGap || getComputedStyle(parent).gap;
  out.parentCls = parent.className;
  return out;
});
console.log(JSON.stringify(m, null, 1));
const clip = await p.locator('.smooch-buybox .smooch-rating').first().boundingBox();
const t = await p.locator('.smooch-buybox .smooch-buybox__title').first().boundingBox();
await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/buybox-top.png', clip: { x: clip.x - 10, y: clip.y - 14, width: 620, height: t.y + t.height - clip.y + 30 } });
await b.close();
