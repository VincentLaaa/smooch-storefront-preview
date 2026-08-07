/**
 * Shopify-flavored Liquid engine for the offline Smooch harness.
 * Implements the subset of Shopify tags/filters/objects the Smooch pages use,
 * over LiquidJS. Rendering fidelity goal: real theme files, real CSS/JS,
 * fixture data. NOT a general Shopify emulator.
 */
import { Liquid } from 'liquidjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, colorDrop, adjustColor, colorBrightness } from './data.mjs';

const locales = JSON.parse(readFileSync(join(ROOT, 'locales/en.default.json'), 'utf8'));
const assetCache = new Map();

function lookupLocale(key) {
  let node = locales;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = node[part];
    else return null;
  }
  return node;
}

function normalizeArgs(args) {
  const kw = {}; const pos = [];
  for (const a of args) {
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'string') kw[a[0]] = a[1];
    else pos.push(a);
  }
  return { kw, pos };
}

function moneyFromCents(cents, format = '${{amount}}') {
  if (cents === null || cents === undefined || cents === '') return '';
  const n = Number(cents) / 100;
  const amount = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return format.replace(/{{\s*amount[a-z_]*\s*}}/g, amount);
}

/** Loose parser for Shopify tag argument lists: `'product', product, id: expr, class: 'x'` */
function parseTagArgs(argString) {
  const parts = [];
  let depth = 0, cur = '', inStr = null;
  for (const ch of argString) {
    if (inStr) { cur += ch; if (ch === inStr) inStr = null; continue; }
    if (ch === "'" || ch === '"') { inStr = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  const positional = []; const named = {};
  for (const p of parts) {
    const m = p.match(/^([\w-]+):\s*(.+)$/s);
    if (m) named[m[1]] = m[2].trim();
    else positional.push(p);
  }
  return { positional, named };
}

export function createEngine({ globals, renderSectionGroup }) {
  const engine = new Liquid({
    root: [ROOT],
    partials: [join(ROOT, 'snippets')],
    extname: '.liquid',
    // No template cache: the harness is a dev tool — picking up .liquid edits
    // on refresh matters more than parse time.
    cache: false,
    strictFilters: false,
    strictVariables: false,
    relativeReference: false,
    outputEscape: undefined,
    // Shopify exposes section/settings/product/etc. as ambient globals inside
    // snippets; LiquidJS's render tag isolates scope, but `globals` is shared
    // with partials. The server mutates this object per (serialized) render.
    globals,
  });

  // ---------------- block tags that wrap or swallow content ----------------
  const blockSwallow = (name, wrap) => {
    engine.registerTag(name, {
      parse(tagToken, remainTokens) {
        this.tpls = [];
        let closed = false;
        while (remainTokens.length) {
          const token = remainTokens.shift();
          if (token.name === 'end' + name) { closed = true; break; }
          const tpl = this.liquid.parser.parseToken(token, remainTokens);
          this.tpls.push(tpl);
        }
        if (!closed) throw new Error(`tag ${name} not closed`);
      },
      *render(ctx, emitter) {
        if (!wrap) return;
        emitter.write(wrap[0]);
        yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
        emitter.write(wrap[1]);
      },
    });
  };
  blockSwallow('style', ['<style>', '</style>']);
  blockSwallow('stylesheet', null);
  blockSwallow('schema', null);
  blockSwallow('javascript', null);

  // ---------------- form ----------------
  engine.registerTag('form', {
    parse(tagToken, remainTokens) {
      this.args = parseTagArgs(tagToken.args);
      this.tpls = [];
      let closed = false;
      while (remainTokens.length) {
        const token = remainTokens.shift();
        if (token.name === 'endform') { closed = true; break; }
        this.tpls.push(this.liquid.parser.parseToken(token, remainTokens));
      }
      if (!closed) throw new Error('form not closed');
    },
    *render(ctx, emitter) {
      const type = (this.args.positional[0] || "''").replace(/['"]/g, '');
      const attrs = [];
      for (const [k, expr] of Object.entries(this.args.named)) {
        const val = yield this.liquid.evalValue(expr, ctx);
        if (val !== undefined && val !== null && val !== false) attrs.push(`${k}="${String(val)}"`);
      }
      const action = { product: '/cart/add', customer: '/contact#newsletter', contact: '/contact' }[type] || '/';
      emitter.write(`<form method="post" action="${action}" accept-charset="UTF-8" enctype="multipart/form-data" ${attrs.join(' ')}>`);
      emitter.write(`<input type="hidden" name="form_type" value="${type}"><input type="hidden" name="utf8" value="✓">`);
      ctx.push({ form: { errors: false, 'posted_successfully?': false, email: '', posted_successfully: false } });
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      ctx.pop();
      emitter.write('</form>');
    },
  });

  // ---------------- section groups ----------------
  engine.registerTag('sections', {
    parse(tagToken) { this.groupName = tagToken.args.replace(/['"]/g, '').trim(); },
    *render(ctx, emitter) {
      const html = yield renderSectionGroup(this.groupName);
      emitter.write(html);
    },
  });
  engine.registerTag('section', {
    parse(tagToken) { this.name = tagToken.args.replace(/['"]/g, '').trim(); },
    *render(ctx, emitter) { emitter.write(`<!-- section ${this.name} omitted in offline harness -->`); },
  });

  // ---------------- filters ----------------
  const F = (name, fn) => engine.registerFilter(name, fn);

  F('t', function (key, ...args) {
    const { kw } = normalizeArgs(args);
    if (typeof key !== 'string') return '';
    let val = lookupLocale(key);
    if (val && typeof val === 'object') {
      const count = kw.count ?? kw.quantity;
      val = (count === 1 ? val.one : val.other) ?? val.other ?? val.one ?? '';
    }
    if (val === null || val === undefined) {
      return key.split('.').pop().replaceAll('_', ' ');
    }
    let out = String(val);
    for (const [k, v] of Object.entries(kw)) out = out.replaceAll(`{{ ${k} }}`, String(v));
    return out;
  });

  F('money', (c) => moneyFromCents(c));
  F('money_with_currency', (c) => (c === null || c === undefined ? '' : moneyFromCents(c) + ' USD'));
  F('money_without_trailing_zeros', (c) => moneyFromCents(c).replace(/\.00$/, ''));
  F('money_without_currency', (c) => (Number(c) / 100).toFixed(2));
  F('money_amount', (c) => (Number(c) / 100).toFixed(2));

  F('asset_url', (name) => `/assets/${name}`);
  F('stylesheet_tag', (href) => `<link rel="stylesheet" href="${href}">`);
  F('script_tag', (src) => `<script src="${src}" defer></script>`);

  F('image_url', function (img, ...args) {
    if (!img) return '';
    if (typeof img === 'string') return img;
    // Return a URL-ish object that stringifies to the src but keeps
    // dimensions, so a downstream image_tag can still reserve space.
    return {
      src: img.src || '',
      width: img.width,
      height: img.height,
      alt: img.alt,
      toString() { return img.src || ''; },
      toJSON() { return img.src || ''; },
    };
  });
  F('image_tag', function (src, ...args) {
    const { kw } = normalizeArgs(args);
    if (!src) return '';
    const url = typeof src === 'string' ? src : src.src;
    const attrs = [`src="${url}"`];
    const passthrough = ['loading', 'sizes', 'id', 'class', 'fetchpriority', 'style', 'alt'];
    for (const key of passthrough) if (kw[key] !== undefined) attrs.push(`${key}="${String(kw[key]).replace(/"/g, '&quot;')}"`);
    if (kw.alt === undefined) attrs.push(`alt=""`);
    // reserve space for CLS if the drop knows its dimensions
    if (typeof src === 'object' && src.width && src.height) attrs.push(`width="${src.width}" height="${src.height}"`);
    if (kw.preload) { /* no-op offline */ }
    return `<img ${attrs.join(' ')}>`;
  });
  F('placeholder_svg_tag', (name, cls) =>
    `<svg class="${cls || ''}" role="img" aria-hidden="true" viewBox="0 0 525 525" xmlns="http://www.w3.org/2000/svg"><rect width="525" height="525" fill="#F3DCE2"/><circle cx="262" cy="230" r="90" fill="#BE2B54" opacity="0.35"/><text x="262" y="420" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#2B1220">DEV PLACEHOLDER</text></svg>`);
  F('inline_asset_content', (name) => {
    if (!assetCache.has(name)) {
      const p = join(ROOT, 'assets', name);
      assetCache.set(name, existsSync(p) ? readFileSync(p, 'utf8') : `<!-- missing asset ${name} -->`);
    }
    return assetCache.get(name);
  });
  F('payment_type_svg_tag', function (type, ...args) {
    const { kw } = normalizeArgs(args);
    return `<svg class="${kw.class || ''}" role="img" width="38" height="24" viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg"><title>${type}</title><rect width="38" height="24" rx="4" fill="#FFFDF9" stroke="#C9BDB4"/><text x="19" y="16" text-anchor="middle" font-size="7" font-family="sans-serif" fill="#2B1220">${String(type).slice(0, 6)}</text></svg>`;
  });

  // Dawn pipes image_tag output through `| escape` in thumbnail markup; on
  // Shopify that escape binds to the alt kwarg, not the rendered tag. Match
  // that behavior: never escape an already-rendered media tag.
  F('escape', (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (/^<(img|svg|video|iframe)\b/.test(s)) return s;
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  });

  F('font_face', () => '');
  F('font_url', () => '');
  F('font_modify', (font, prop, val) => ({ ...font, [prop]: val }));

  F('color_brightness', (c) => colorBrightness(typeof c === 'string' ? colorDrop(c) : c));
  F('color_lighten', (c, pct) => adjustColor(typeof c === 'string' ? colorDrop(c) : c, Math.abs(pct)));
  F('color_darken', (c, pct) => adjustColor(typeof c === 'string' ? colorDrop(c) : c, -Math.abs(pct)));

  F('item_count_for_variant', (cart, variantId) => {
    if (!cart || !cart.items) return 0;
    return cart.items.filter((i) => String(i.variant_id) === String(variantId))
      .reduce((a, i) => a + i.quantity, 0);
  });

  F('payment_terms', () => '');
  F('payment_button', () => '');
  F('standard_event_data', () => '');
  F('preload_tag', () => '');
  F('handleize', (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  F('camelize', (s) => String(s || '').replace(/[-_](.)/g, (_, c) => c.toUpperCase()));
  F('md5', (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16); });
  F('link_to', (label, url) => `<a href="${url}">${label}</a>`);
  F('default_errors', () => '');
  F('highlight', (s) => s);
  F('weight_with_unit', (g) => `${g} g`);
  F('stylesheet', (x) => x);
  F('external_video_url', (m) => (m && m.external_url) || '');
  F('external_video_tag', () => '');
  F('video_tag', () => '');
  F('media_tag', () => '');
  F('model_viewer_tag', () => '');
  F('article_img_url', (x) => x);
  F('img_url', (img) => (typeof img === 'string' ? img : img?.src || ''));

  return engine;
}
