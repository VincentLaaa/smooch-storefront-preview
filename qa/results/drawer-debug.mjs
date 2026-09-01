import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:9292/products/smooch-daily-gummies-qa', { waitUntil: 'networkidle' });
const r = await p.evaluate(() => {
  const d = document.querySelector('cart-drawer');
  const f = document.querySelector('.drawer__footer');
  const pick = (el) => {
    const cs = getComputedStyle(el);
    return { visibility: cs.visibility, display: cs.display, opacity: cs.opacity, position: cs.position, zIndex: cs.zIndex, pointerEvents: cs.pointerEvents, transform: cs.transform.slice(0, 60) };
  };
  return {
    drawer: pick(d),
    drawerClass: d.className,
    inner: pick(document.querySelector('cart-drawer .drawer__inner')),
    footer: f ? pick(f) : null,
    footerRect: f ? f.getBoundingClientRect().toJSON() : null,
    itemsClass: document.querySelector('cart-drawer-items') ? document.querySelector('cart-drawer-items').className : null,
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
