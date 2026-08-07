/**
 * Offline render server for the Smooch theme.
 *
 * Renders the REAL theme files (layout, section groups, JSON templates, Dawn +
 * Smooch sections/snippets, real CSS/JS assets) with local fixture data, and
 * mocks the storefront endpoints Dawn's JavaScript depends on:
 *   - GET  /products/:handle          (+ ?section_id= & ?option_values= re-render)
 *   - POST /cart/add                  (multipart, returns line item + rendered sections)
 *   - GET  /cart.js, POST /cart/change, /cart/update, /cart/clear.js
 *
 * WHAT THIS PROVES: theme markup/CSS/JS behavior, section rendering contracts,
 * the offer engine, variant-change pipeline, drawer open/refresh flow.
 * WHAT THIS DOES NOT PROVE: real Shopify checkout, real cart pricing rules,
 * selling-plan billing, app behavior, or Shopify's exact Liquid edge cases.
 *
 * Usage: node dev/server.mjs   (port 9292, override with PORT env)
 */
import express from 'express';
import multer from 'multer';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, resolveGlobalSettings, productDrop, variantById, PRODUCT_HANDLES,
  makeCartState, cartDrop, cartJson, linklists, shopDrop, routesDrop, imageDrop,
} from './data.mjs';
import { createEngine } from './engine.mjs';

const PORT = Number(process.env.PORT || 9292);
const settings = resolveGlobalSettings();
const cartState = makeCartState();
let keyCounter = 1;

// ------------------------------------------------------------ schema cache
const schemaCache = new Map();
function sectionSchema(type) {
  if (!schemaCache.has(type)) {
    const file = join(ROOT, 'sections', `${type}.liquid`);
    let schema = {};
    if (existsSync(file)) {
      const m = readFileSync(file, 'utf8').match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
      if (m) { try { schema = JSON.parse(m[1]); } catch { schema = {}; } }
    }
    const settingTypes = {}; const settingDefaults = {};
    for (const s of schema.settings || []) {
      if (!s.id) continue;
      settingTypes[s.id] = s.type;
      if ('default' in s) settingDefaults[s.id] = s.default;
    }
    const blockMeta = {};
    for (const b of schema.blocks || []) {
      if (b.type === '@app') continue;
      const types = {}; const defaults = {};
      for (const s of b.settings || []) {
        if (!s.id) continue;
        types[s.id] = s.type;
        if ('default' in s) defaults[s.id] = s.default;
      }
      blockMeta[b.type] = { types, defaults };
    }
    schemaCache.set(type, { class: schema.class || 'section', settingTypes, settingDefaults, blockMeta });
  }
  return schemaCache.get(type);
}

/** Harness fixture conveniences (documented in the walkthrough):
    - empty product pickers fall back to the main fixture product
    - empty image pickers fall back to a themed placeholder image chosen by
      the setting id, so demo pages are visually complete */
function coerceSetting(type, value, fallbackProduct, settingId = '') {
  if (type === 'link_list') return linklists[value] || null;
  if (type === 'product') {
    if (value) return productDrop(value) || null;
    return fallbackProduct ? productDrop(fallbackProduct) : null;
  }
  if (type === 'image_picker') {
    // Empty image pickers stay empty so THEME-level fallbacks (bundled brand
    // renders / placeholder blocks) render exactly as they will on Shopify.
    return value && typeof value === 'object' ? value : null;
  }
  if (type === 'collection' || type === 'page' || type === 'blog' || type === 'article') return null;
  return value;
}

function resolveSettings(types, defaults, entrySettings, fallbackProduct) {
  const resolved = {};
  // Resolve EVERY declared setting id (not only ones with defaults) so typed
  // fallbacks (product/image) apply to settings that are simply absent.
  for (const id of Object.keys(types)) {
    const raw = entrySettings && id in entrySettings ? entrySettings[id] : defaults[id];
    resolved[id] = coerceSetting(types[id], raw, fallbackProduct, id);
  }
  // Pass through any extra entry settings not declared in the schema.
  for (const [id, val] of Object.entries(entrySettings || {})) {
    if (!(id in resolved)) resolved[id] = val;
  }
  return resolved;
}

function buildSectionDrop(type, entry, sectionId, { fallbackProduct } = {}) {
  const meta = sectionSchema(type);
  const resolved = resolveSettings(meta.settingTypes, meta.settingDefaults, entry.settings, fallbackProduct);
  const blocks = [];
  for (const bid of entry.block_order || []) {
    const b = entry.blocks?.[bid];
    if (!b) continue;
    const bm = meta.blockMeta[b.type] || { types: {}, defaults: {} };
    const bs = resolveSettings(bm.types, bm.defaults, b.settings, fallbackProduct);
    blocks.push({ id: bid, type: b.type, settings: bs, shopify_attributes: `data-shopify-editor-block data-block-id="${bid}"` });
  }
  return { id: sectionId, settings: resolved, blocks, index: 1, location: 'template' };
}

// ------------------------------------------------------------ rendering
let currentScope = null;
let renderChain = Promise.resolve();
const serialize = (fn) => (renderChain = renderChain.then(fn, fn));

/** Ambient globals shared with snippets (see engine.mjs). Mutated per render;
    safe because all renders go through the `serialize` queue.
    setGlobals resets for a request; patchGlobals layers keys for a nested
    render (e.g. the section rendered inside the layout's sections tag) and
    restores on completion — a wholesale reset mid-layout would wipe
    content_for_layout / page_title. */
const GLOBALS = {};
function setGlobals(scope) {
  for (const k of Object.keys(GLOBALS)) delete GLOBALS[k];
  Object.assign(GLOBALS, scope);
}
function patchGlobals(patch) {
  const saved = {};
  for (const k of Object.keys(patch)) { saved[k] = GLOBALS[k]; GLOBALS[k] = patch[k]; }
  return () => {
    for (const k of Object.keys(patch)) {
      if (saved[k] === undefined) delete GLOBALS[k];
      else GLOBALS[k] = saved[k];
    }
  };
}

const engine = createEngine({
  globals: GLOBALS,
  renderSectionGroup: async (groupName) => {
    const group = JSON.parse(readFileSync(join(ROOT, 'sections', `${groupName}.json`), 'utf8'));
    let html = '';
    for (const id of group.order) {
      const entry = group.sections[id];
      html += await renderSection(entry.type, entry, id);
    }
    return html;
  },
});

async function renderSection(type, entry, sectionId) {
  const meta = sectionSchema(type);
  const section = buildSectionDrop(type, entry, sectionId, { fallbackProduct: PRODUCT_HANDLES[0] });
  const restore = patchGlobals({ section });
  let inner;
  try {
    inner = await engine.renderFile(`sections/${type}.liquid`, {});
  } catch (err) {
    console.error(`[render error] section ${type}: ${err.message}`);
    inner = `<div style="padding:2rem;background:#fee;color:#900;font-family:monospace">HARNESS RENDER ERROR in section ${type}: ${String(err.message).replace(/</g, '&lt;')}</div>`;
  } finally {
    restore();
  }
  return `<div id="shopify-section-${sectionId}" class="shopify-section ${meta.class}">${inner}</div>`;
}

async function renderTemplate(templateName) {
  const tpl = JSON.parse(readFileSync(join(ROOT, 'templates', `${templateName}.json`), 'utf8'));
  let html = '';
  for (const id of tpl.order) {
    html += await renderSection(tpl.sections[id].type, tpl.sections[id], id);
  }
  return html;
}

async function renderLayout(bodyHtml, { pageTitle = 'Smooch (offline dev)', templateName = 'index' } = {}) {
  const restore = patchGlobals({
    content_for_layout: bodyHtml,
    content_for_header:
      '<script>window.Shopify = window.Shopify || { designMode: false, shop: "offline.dev", currency: { active: "USD" }, routes: { root: "/" }, PaymentButton: { init(){} } };</script>',
    page_title: pageTitle,
    page_description: 'Offline development preview',
    canonical_url: `http://127.0.0.1:${PORT}/`,
    current_tags: null,
    current_page: 1,
    template: { name: templateName, suffix: null },
  });
  let html;
  try {
    html = await engine.renderFile('layout/theme.liquid', {});
  } finally {
    restore();
  }
  html = html.replace('https://cdn.shopify.com/storefront/standard-events.js', '/dev-assets/standard-events-stub.js');
  if (process.env.HARNESS_BADGE !== '0') {
    html = html.replace('</body>', `<div style="position:fixed;left:8px;bottom:8px;z-index:9999;background:#2B1220;color:#FFF8F2;font:11px/1.6 monospace;padding:2px 8px;border-radius:4px;opacity:.85;pointer-events:none">OFFLINE DEV — MOCK DATA</div></body>`);
  }
  return html;
}

function baseScope(extra = {}) {
  return {
    settings,
    shop: shopDrop,
    routes: routesDrop,
    cart: cartDrop(cartState),
    linklists,
    request: { locale: { iso_code: 'en' }, origin: `http://127.0.0.1:${PORT}`, design_mode: false, page_type: 'index', path: '/' },
    localization: { available_countries: [{}], available_languages: [{}] },
    powered_by_link: '',
    ...extra,
  };
}

// ------------------------------------------------------------ app
const app = express();
const upload = multer();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(join(ROOT, 'assets')));
app.use('/dev-assets', express.static(join(ROOT, 'dev', 'public')));

const page = (handler) => (req, res) => {
  serialize(async () => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[server error]', err);
      res.status(500).send(`<pre>HARNESS ERROR\n${String(err.stack).replace(/</g, '&lt;')}</pre>`);
    }
  });
};

app.get('/', page(async (req, res) => {
  currentScope = baseScope();
  setGlobals(currentScope);
  const body = await renderTemplate('index');
  res.send(await renderLayout(body, { pageTitle: 'Smooch — offline dev', templateName: 'index' }));
}));

app.get('/products/:handle', page(async (req, res) => {
  const handle = req.params.handle;
  const optionValueIds = String(req.query.option_values || '').split(',').filter(Boolean);
  const product = productDrop(handle, {
    selectedVariantId: req.query.variant || null,
    optionValueIds,
  });
  if (!product) return res.status(404).send('fixture product not found');
  currentScope = baseScope({ product, request: { ...baseScope().request, page_type: 'product', path: `/products/${handle}` } });
  setGlobals(currentScope);

  const tpl = JSON.parse(readFileSync(join(ROOT, 'templates', 'product.smooch.json'), 'utf8'));
  if (req.query.section_id) {
    const id = req.query.section_id;
    const entry = tpl.sections[id];
    if (!entry) return res.status(404).send(`section ${id} not in template`);
    return res.send(await renderSection(entry.type, entry, id));
  }
  let body = '';
  for (const id of tpl.order) body += await renderSection(tpl.sections[id].type, tpl.sections[id], id);
  res.send(await renderLayout(body, { pageTitle: product.title, templateName: 'product' }));
}));

app.get('/pages/:handle', page(async (req, res) => {
  const handle = req.params.handle;
  const known = { faq: 'page.faq', contact: 'page.contact' };
  const tplName = known[handle] || 'page';
  const pageDrop = {
    title: handle === 'faq' ? 'FAQ' : handle === 'contact' ? 'Contact' : handle,
    content: `<p>Offline development page for <strong>${handle}</strong>.</p>`,
  };
  currentScope = baseScope({ page: pageDrop });
  setGlobals(currentScope);
  let body;
  try {
    body = await renderTemplate(tplName);
  } catch {
    body = `<div class="page-width"><h1>${pageDrop.title}</h1>${pageDrop.content}</div>`;
  }
  res.send(await renderLayout(body, { pageTitle: pageDrop.title, templateName: 'page' }));
}));

app.get('/policies/:handle', (req, res) => {
  res.send(`<!doctype html><meta charset="utf-8"><title>${req.params.handle}</title><body style="font-family:sans-serif;max-width:60ch;margin:4rem auto"><h1>${req.params.handle}</h1><p><strong>DEVELOPMENT DRAFT — REQUIRES LEGAL REVIEW.</strong></p><p>Placeholder policy page served by the offline harness.</p></body>`);
});

app.get('/cart', page(async (req, res) => {
  const c = cartJson(cartState);
  res.send(`<!doctype html><meta charset="utf-8"><title>Cart (dev)</title><body style="font-family:sans-serif;max-width:70ch;margin:4rem auto"><h1>Cart (offline dev fallback)</h1><p>The themed cart page is deferred to real-store QA; the cart drawer is the primary cart surface.</p><pre>${JSON.stringify(c, null, 2).replace(/</g, '&lt;')}</pre></body>`);
}));

// ------------------------------------------------------------ cart API
async function renderCartSections(ids) {
  currentScope = baseScope();
  setGlobals(currentScope);
  const out = {};
  for (const id of ids) {
    const file = join(ROOT, 'sections', `${id}.liquid`);
    if (!existsSync(file)) continue;
    setGlobals({ ...currentScope, section: buildSectionDrop(id, {}, id, {}) });
    out[id] = `<div id="shopify-section-${id}" class="shopify-section">${await engine.renderFile(`sections/${id}.liquid`, {})}</div>`;
  }
  return out;
}

app.post('/cart/add', upload.none(), (req, res) => {
  serialize(async () => {
    try {
      const variantId = req.body.id;
      const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
      const sellingPlanId = req.body.selling_plan || null;
      const found = variantById(variantId);
      if (!found) return res.status(422).json({ status: 422, message: 'Cart Error', description: 'Variant not found' });
      if (!found.variant.available) {
        return res.status(422).json({ status: 422, message: 'Cart Error', description: `The product '${found.product.title}' is sold out.` });
      }
      const existing = cartState.items.find((i) => String(i.variantId) === String(variantId) && String(i.sellingPlanId || '') === String(sellingPlanId || ''));
      if (existing) existing.quantity += quantity;
      else cartState.items.push({ variantId, quantity, sellingPlanId, key: `${variantId}:dev${keyCounter++}` });

      const drop = cartDrop(cartState);
      const line = drop.items.find((i) => String(i.variant_id) === String(variantId));
      const sections = req.body.sections ? await renderCartSections(String(req.body.sections).split(',')) : undefined;
      res.json({
        id: Number(variantId),
        key: line.key,
        quantity: line.quantity,
        variant_id: Number(variantId),
        title: line.title,
        price: line.final_price,
        final_price: line.final_price,
        final_line_price: line.final_line_price,
        product_title: line.product_title,
        selling_plan_allocation: line.selling_plan_allocation
          ? { selling_plan: { id: line.selling_plan_allocation.selling_plan.id, name: line.selling_plan_allocation.selling_plan.name } }
          : undefined,
        sections,
      });
    } catch (err) {
      console.error('[cart/add]', err);
      res.status(500).json({ status: 500, description: String(err.message) });
    }
  });
});

app.get('/cart.js', (req, res) => res.json(cartJson(cartState)));

app.post(['/cart/change', '/cart/change.js'], (req, res) => {
  serialize(async () => {
    const { line, quantity, id } = req.body;
    if (line !== undefined) {
      const idx = Number(line) - 1;
      if (cartState.items[idx]) {
        if (Number(quantity) <= 0) cartState.items.splice(idx, 1);
        else cartState.items[idx].quantity = Number(quantity);
      }
    } else if (id !== undefined) {
      const item = cartState.items.find((i) => i.key === id || String(i.variantId) === String(id));
      if (item) {
        if (Number(quantity) <= 0) cartState.items.splice(cartState.items.indexOf(item), 1);
        else item.quantity = Number(quantity);
      }
    }
    const json = cartJson(cartState);
    const sections = req.body.sections ? await renderCartSections(String(req.body.sections).split(',')) : undefined;
    res.json({ ...json, sections });
  });
});

app.post(['/cart/update', '/cart/update.js'], (req, res) => res.json(cartJson(cartState)));
app.post(['/cart/clear', '/cart/clear.js'], (req, res) => { cartState.items.length = 0; res.json(cartJson(cartState)); });

app.get('/search/suggest', (req, res) => res.json({ resources: { results: {} } }));

// Pre-flight: if something already answers on the port (e.g. a stale harness
// left running), say so clearly instead of half-binding and confusing everyone.
try {
  const probe = await fetch(`http://127.0.0.1:${PORT}/cart.js`, { signal: AbortSignal.timeout(1500) });
  if (probe.ok) {
    console.error(`ERROR: something is already serving http://127.0.0.1:${PORT} (probably an earlier harness instance).`);
    console.error(`  Either just use that one in your browser, stop it (taskkill /F /IM node.exe), or run:  $env:PORT=9293; node dev/server.mjs`);
    process.exit(1);
  }
} catch {
  // nothing listening — good, proceed
}

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Smooch offline harness → http://127.0.0.1:${PORT}`);
  console.log(`  /                     homepage (index.json)`);
  console.log(`  /products/${PRODUCT_HANDLES[0]}   product page (product.smooch.json)`);
  console.log(`  /products/${PRODUCT_HANDLES[1]}   single-variant state`);
  console.log(`  /pages/faq  /pages/contact`);
  console.log('  (leave this window open — Ctrl+C to stop)');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: port ${PORT} is already in use (a previous harness instance is still running).`);
    console.error(`  Stop it (taskkill /F /IM node.exe) or run on another port:  $env:PORT=9293; node dev/server.mjs`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
