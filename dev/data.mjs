/**
 * Offline fixture data layer for the Smooch render harness.
 * Builds Shopify-shaped plain objects (drops) from local fixtures so the real
 * theme Liquid renders without a store. Harness-only — never shipped in the
 * theme package (dev/ is not a theme directory).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

// ---------------------------------------------------------------- colors
export function colorDrop(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  const n = hex.length === 4
    ? hex.slice(1).split('').map((c) => parseInt(c + c, 16))
    : [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((h) => parseInt(h, 16));
  const [red, green, blue] = n;
  return {
    red, green, blue,
    rgb: `${red}, ${green}, ${blue}`,
    hex,
    toString() { return hex; },
    toJSON() { return hex; },
  };
}

export function adjustColor(drop, lightenPct) {
  // crude HSL-free lighten/darken good enough for the contrast var
  const f = (v) => Math.max(0, Math.min(255, Math.round(
    lightenPct >= 0 ? v + (255 - v) * (lightenPct / 100) : v * (1 + lightenPct / 100)
  )));
  const hex = '#' + [f(drop.red), f(drop.green), f(drop.blue)]
    .map((v) => v.toString(16).padStart(2, '0')).join('');
  return colorDrop(hex);
}

export function colorBrightness(drop) {
  return Math.round((drop.red * 299 + drop.green * 587 + drop.blue * 114) / 1000);
}

// ---------------------------------------------------------------- settings
const settingsSchema = readJson('config/settings_schema.json');
const settingsData = readJson('config/settings_data.json');

function fontDrop(family, weight = 400, style = 'normal') {
  return {
    family, weight, style,
    fallback_families: /playfair|serif/i.test(family) ? 'serif' : 'sans-serif',
    'system?': false,
    system: false,
    toString() { return family; },
  };
}

export function resolveGlobalSettings() {
  const out = {};
  for (const group of settingsSchema) {
    for (const s of group.settings || []) {
      if (s.id && 'default' in s) out[s.id] = s.default;
    }
  }
  const preset = typeof settingsData.current === 'string'
    ? settingsData.presets[settingsData.current]
    : settingsData.current;
  for (const [k, v] of Object.entries(preset)) {
    if (k === 'sections') continue;
    out[k] = v;
  }
  // color schemes → drops array + keep object access
  const schemes = [];
  for (const [id, def] of Object.entries(preset.color_schemes || {})) {
    const settings = {};
    for (const [k, v] of Object.entries(def.settings)) {
      settings[k] = k === 'background_gradient' ? (v || '') : colorDrop(v);
    }
    schemes.push({ id, settings });
  }
  out.color_schemes = schemes;
  // colors used as objects
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) && k !== 'color_schemes') out[k] = colorDrop(v);
  }
  out.type_header_font = fontDrop('Playfair Display', 500);
  out.type_body_font = fontDrop('Assistant', 400);
  out.logo = null;
  out.favicon = null;
  return out;
}

// ---------------------------------------------------------------- images
export function imageDrop(src, { width = 1200, height = 1500, alt = '' } = {}) {
  const drop = {
    src, width, height, alt,
    aspect_ratio: width / height,
    id: Math.abs([...src].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 10 ** 9),
    media_type: 'image',
    position: 1,
    'attached_to_variant?': false,
    presentation: null,
    toString() { return src; },
    toJSON() { return { src, width, height, alt }; },
  };
  drop.preview_image = drop;
  return drop;
}

// ---------------------------------------------------------------- products
/** Deterministic option-value ids — Dawn round-trips them in section-render
    URLs (?option_values=...), so they MUST be stable across requests. */
function optionValueId(handle, position, name) {
  let h = 7;
  for (const c of `${handle}|${position}|${name}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 900000 + (h % 90000);
}

function buildOptionValues(product, optionName, names, selectedName, position) {
  return names.map((name) => {
    const id = optionValueId(product.handle, position, name);
    const available = product.variants.some(
      (v) => v.options[position] === name && v.available
    );
    const exists = product.variants.some((v) => v.options[position] === name);
    return {
      id, name, available: exists ? available : false,
      selected: name === selectedName,
      swatch: null,
      product_url: null,
      variant: null,
      toString() { return name; },
      toJSON() { return { id, name }; },
    };
  });
}

/** Fixture product definitions. Prices in cents. */
const FIXTURES = {
  'smooch-daily-gummies-qa': {
    title: "Women's Libido & Mood Gummies — Dev Fixture",
    vendor: 'Smooch',
    type: "Women's Wellness Gummy",
    description: '<p><strong>Offline development fixture</strong> — all data on this page is mock data rendered locally.</p>',
    options: [
      { name: 'Flavor', values: ['Strawberry', 'Raspberry'] },
      { name: 'Pack', values: ['1 Pack', '2 Packs', '3 Packs'] },
    ],
    media: [
      { src: '/assets/smooch-demo-bottle-open.png', alt: "Smooch Women's Libido & Mood bottle with open cap and gummy", width: 1086, height: 1448 },
      { src: '/assets/smooch-demo-bottles-duo.png', alt: "Two Smooch Women's Libido & Mood bottles", width: 1254, height: 1254 },
      { src: '/assets/smooch-demo-info-card.jpg', alt: 'Smooch bottles with 60 gummies per bottle and mood, desire, and connection support highlights', width: 1600, height: 1600 },
      { src: '/assets/smooch-demo-back-in-stock.jpg', alt: 'Two Smooch bottles with gummies and a back-in-stock badge', width: 1600, height: 1600 },
    ],
    sellingPlans: [
      { id: 101, name: 'Every 30 days', discountPct: 10 },
      { id: 102, name: 'Every 60 days', discountPct: 10 },
    ],
    variants: [
      { id: 111, options: ['Strawberry', '1 Pack'], price: 3000, compare_at_price: 4000, sku: 'QA-STR-1', available: true, inventory_quantity: 25 },
      { id: 112, options: ['Strawberry', '2 Packs'], price: 5600, compare_at_price: 8000, sku: 'QA-STR-2', available: true, inventory_quantity: 25 },
      { id: 113, options: ['Strawberry', '3 Packs'], price: 7500, compare_at_price: 12000, sku: 'QA-STR-3', available: true, inventory_quantity: 25 },
      { id: 114, options: ['Raspberry', '1 Pack'], price: 3000, compare_at_price: null, sku: 'QA-RSP-1', available: false, inventory_quantity: 0 },
      { id: 115, options: ['Raspberry', '2 Packs'], price: 5600, compare_at_price: 8000, sku: 'QA-RSP-2', available: true, inventory_quantity: 25 },
      { id: 116, options: ['Raspberry', '3 Packs'], price: 7500, compare_at_price: 12000, sku: 'QA-RSP-3', available: true, inventory_quantity: 25 },
    ],
  },
  'smooch-daily-gummies-qa-single': {
    title: "Women's Libido & Mood — Single Dev Fixture",
    vendor: 'Smooch',
    type: "Women's Wellness Gummy",
    description: '<p><strong>Offline development fixture</strong> — single-variant, no compare-at, no plans.</p>',
    options: [{ name: 'Title', values: ['Default Title'] }],
    media: [{ src: '/assets/smooch-demo-bottle-open.png', alt: "Smooch Women's Libido & Mood bottle", width: 1086, height: 1448 }],
    sellingPlans: [],
    variants: [
      { id: 211, options: ['Default Title'], price: 2500, compare_at_price: null, sku: 'QA-SINGLE-1', available: true, inventory_quantity: 10, untracked: true },
    ],
  },
};

export function productDrop(handle, { selectedVariantId = null, optionValueIds = [] } = {}) {
  const fx = FIXTURES[handle];
  if (!fx) return null;
  const url = `/products/${handle}`;
  const media = fx.media.map((m, i) => {
    const img = imageDrop(m.src, { alt: m.alt, width: m.width || 1200, height: m.height || 1500 });
    img.position = i + 1;
    img.id = img.id + i;
    return img;
  });

  const planGroups = fx.sellingPlans.length
    ? [{
        name: 'Subscribe & save',
        selling_plans: fx.sellingPlans.map((p) => ({
          id: p.id, name: p.name,
          description: 'Development fixture plan',
          recurring_deliveries: true,
          toJSON() { return { id: p.id, name: p.name }; },
        })),
      }]
    : [];

  const variants = fx.variants.map((v) => ({
    id: v.id,
    title: v.options.join(' / '),
    options: v.options,
    option1: v.options[0] || null,
    option2: v.options[1] || null,
    option3: v.options[2] || null,
    price: v.price,
    compare_at_price: v.compare_at_price,
    available: v.available,
    sku: v.sku,
    requires_shipping: true,
    taxable: true,
    featured_media: null,
    inventory_management: v.untracked ? null : 'shopify',
    inventory_policy: 'deny',
    inventory_quantity: v.inventory_quantity,
    quantity_rule: { min: 1, max: null, increment: 1 },
    unit_price: null,
    unit_price_measurement: null,
    'matched?': true,
    selling_plan_allocations: fx.sellingPlans.map((p) => {
      const discounted = Math.round(v.price * (1 - p.discountPct / 100));
      return {
        selling_plan: { id: p.id, name: p.name },
        price: discounted,
        compare_at_price: v.price,
        per_delivery_price: discounted,
      };
    }),
    url: `${url}?variant=${v.id}`,
    toJSON() {
      return {
        id: v.id, title: v.options.join(' / '), options: v.options,
        option1: v.options[0] || null, option2: v.options[1] || null, option3: v.options[2] || null,
        price: v.price, compare_at_price: v.compare_at_price, available: v.available,
        featured_media: null, sku: v.sku,
      };
    },
  }));

  // selection resolution: explicit variant id > option value ids > first available
  let selected = null;
  if (selectedVariantId) selected = variants.find((v) => String(v.id) === String(selectedVariantId)) || null;

  const product = {
    id: 5001,
    title: fx.title,
    handle,
    url,
    vendor: fx.vendor,
    type: fx.type,
    description: fx.description,
    content: fx.description,
    available: variants.some((v) => v.available),
    media,
    images: media,
    featured_media: media[0] || null,
    featured_image: media[0] || null,
    variants,
    has_only_default_variant: fx.options.length === 1 && fx.options[0].name === 'Title',
    'has_only_default_variant?': undefined,
    selling_plan_groups: planGroups,
    requires_selling_plan: false,
    'quantity_price_breaks_configured?': false,
    price: Math.min(...variants.map((v) => v.price)),
    price_min: Math.min(...variants.map((v) => v.price)),
    price_max: Math.max(...variants.map((v) => v.price)),
    price_varies: new Set(variants.map((v) => v.price)).size > 1,
    compare_at_price: variants.find((v) => v.compare_at_price)?.compare_at_price || null,
    compare_at_price_varies: false,
    tags: ['dev-fixture'],
    template_suffix: 'smooch',
    metafields: {},
    'gift_card?': false,
    selected_variant: selected,
  };

  // options_with_values with per-value drops (ids used by option_values= param)
  product.options_with_values = fx.options.map((o, i) => {
    const values = buildOptionValues(product, o.name, o.values, null, i);
    return {
      name: o.name,
      position: i + 1,
      values,
      selected_value: null,
    };
  });

  // option-value-id based selection (Dawn's section-render URL)
  if (!selected && optionValueIds.length) {
    const names = [];
    for (const ov of product.options_with_values) {
      const hit = ov.values.find((v) => optionValueIds.includes(String(v.id)));
      names.push(hit ? hit.name : null);
    }
    if (names.every(Boolean)) {
      selected = variants.find((v) => v.options.every((n, i) => n === names[i])) || null;
      product.selected_variant = selected;
    }
  }

  const effective = selected || variants.find((v) => v.available) || variants[0];
  product.selected_or_first_available_variant = effective;
  product.sold_out = !product.available;
  product.on_sale = !!effective.compare_at_price && effective.compare_at_price > effective.price;

  for (const ov of product.options_with_values) {
    const idx = ov.position - 1;
    ov.selected_value = ov.values.find((v) => v.name === effective.options[idx]) || null;
    for (const v of ov.values) v.selected = v.name === effective.options[idx];
  }

  return product;
}

export const PRODUCT_HANDLES = Object.keys(FIXTURES);
export function variantById(id) {
  for (const handle of PRODUCT_HANDLES) {
    const p = productDrop(handle);
    const v = p.variants.find((x) => String(x.id) === String(id));
    if (v) return { product: p, variant: v };
  }
  return null;
}

// ---------------------------------------------------------------- cart
export function makeCartState() {
  return { items: [] }; // items: {variantId, quantity, sellingPlanId|null, key}
}

export function cartDrop(state) {
  let index = 0;
  const items = state.items.map((line) => {
    index += 1;
    const found = variantById(line.variantId);
    if (!found) return null;
    const { product, variant } = found;
    const alloc = line.sellingPlanId
      ? variant.selling_plan_allocations.find((a) => String(a.selling_plan.id) === String(line.sellingPlanId))
      : null;
    const unit = alloc ? alloc.price : variant.price;
    return {
      index: index - 1,
      key: line.key,
      quantity: line.quantity,
      title: product.title,
      product_title: product.title,
      product: { title: product.title, url: product.url, 'gift_card?': false },
      url: variant.url,
      variant_id: variant.id,
      id: variant.id,
      sku: variant.sku,
      vendor: product.vendor,
      image: product.featured_media,
      final_price: unit,
      original_price: variant.price,
      final_line_price: unit * line.quantity,
      original_line_price: variant.price * line.quantity,
      line_price: unit * line.quantity,
      price: unit,
      discounts: [],
      line_level_discount_allocations: [],
      selling_plan_allocation: alloc ? { selling_plan: alloc.selling_plan } : null,
      options_with_values: variant.options[0] === 'Default Title'
        ? []
        : variant.options.map((value, i) => ({ name: found.product.options_with_values[i].name, value })),
      variant: { title: variant.title, options: variant.options },
      unit_price: null,
      unit_price_measurement: null,
      properties: [],
      requires_shipping: true,
      taxable: true,
      error_message: null,
      message: null,
    };
  }).filter(Boolean);

  const total = items.reduce((a, i) => a + i.final_line_price, 0);
  return {
    items,
    item_count: items.reduce((a, i) => a + i.quantity, 0),
    total_price: total,
    items_subtotal_price: total,
    original_total_price: total,
    estimated_total: total,
    checkout_charge_amount: total,
    total_discount: 0,
    cart_level_discount_applications: [],
    empty: items.length === 0,
    'empty?': items.length === 0,
    note: '',
    currency: { iso_code: 'USD', symbol: '$' },
    taxes_included: false,
    duties_included: false,
    requires_shipping: true,
  };
}

export function cartJson(state) {
  const drop = cartDrop(state);
  return {
    token: 'dev-cart',
    item_count: drop.item_count,
    total_price: drop.total_price,
    items_subtotal_price: drop.items_subtotal_price,
    original_total_price: drop.original_total_price,
    currency: 'USD',
    items: drop.items.map((i) => ({
      id: i.variant_id,
      key: i.key,
      quantity: i.quantity,
      variant_id: i.variant_id,
      title: i.title,
      price: i.price,
      line_price: i.line_price,
      final_price: i.final_price,
      final_line_price: i.final_line_price,
      sku: i.sku,
      product_title: i.product_title,
      selling_plan_allocation: i.selling_plan_allocation
        ? { selling_plan: { id: i.selling_plan_allocation.selling_plan.id, name: i.selling_plan_allocation.selling_plan.name } }
        : null,
      url: i.url,
      image: i.image ? i.image.src : null,
    })),
  };
}

// ---------------------------------------------------------------- misc drops
export const linklists = {
  'main-menu': {
    handle: 'main-menu', title: 'Main menu',
    links: [
      { title: 'Shop', url: '/products/smooch-daily-gummies-qa', active: false, current: false, links: [] },
      { title: 'How It Works', url: '/products/smooch-daily-gummies-qa#shopify-section-mechanism', active: false, current: false, links: [] },
      { title: 'Ingredients', url: '/products/smooch-daily-gummies-qa#shopify-section-formula', active: false, current: false, links: [] },
      { title: 'Reviews', url: '/products/smooch-daily-gummies-qa#smooch-reviews', active: false, current: false, links: [] },
      { title: 'FAQ', url: '/pages/faq', active: false, current: false, links: [] },
    ],
  },
  footer: {
    handle: 'footer', title: 'Footer menu',
    links: [
      { title: 'Contact', url: '/pages/contact', active: false, current: false, links: [] },
      { title: 'FAQ', url: '/pages/faq', active: false, current: false, links: [] },
      { title: 'Shipping', url: '/policies/shipping-policy', active: false, current: false, links: [] },
      { title: 'Returns', url: '/policies/refund-policy', active: false, current: false, links: [] },
    ],
  },
};

export const shopDrop = {
  name: 'Smooch (Offline Dev)',
  url: 'http://127.0.0.1:9292',
  secure_url: 'http://127.0.0.1:9292',
  currency: 'USD',
  money_format: '${{amount}}',
  money_with_currency_format: '${{amount}} USD',
  enabled_payment_types: ['visa', 'master', 'american_express', 'paypal', 'shop_pay'],
  customer_accounts_enabled: false,
  shipping_policy: { body: '' },
  refund_policy: { title: 'Refund policy', url: '/policies/refund-policy', body: '<p>DEV DRAFT</p>' },
  privacy_policy: { title: 'Privacy policy', url: '/policies/privacy-policy', body: '<p>DEV DRAFT</p>' },
  terms_of_service: { title: 'Terms of service', url: '/policies/terms-of-service', body: '<p>DEV DRAFT</p>' },
  policies: [
    { title: 'Refund policy', url: '/policies/refund-policy', body: '<p>DEV DRAFT</p>' },
    { title: 'Privacy policy', url: '/policies/privacy-policy', body: '<p>DEV DRAFT</p>' },
    { title: 'Terms of service', url: '/policies/terms-of-service', body: '<p>DEV DRAFT</p>' },
  ],
  brand: null,
  metafields: {},
};

export const routesDrop = {
  root_url: '/',
  cart_url: '/cart',
  cart_add_url: '/cart/add',
  cart_change_url: '/cart/change',
  cart_update_url: '/cart/update',
  predictive_search_url: '/search/suggest',
  search_url: '/search',
  account_url: '/account',
  account_login_url: '/account/login',
  account_logout_url: '/account/logout',
  account_register_url: '/account/register',
  all_products_collection_url: '/collections/all',
};
