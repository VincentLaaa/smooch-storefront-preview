/**
 * Seeds the Smooch staging store with development QA data.
 *
 * Creates (idempotently, keyed by handle/title):
 *   - "Smooch Women's Libido & Mood Gummies — QA Product"  (multi-variant: Pack,
 *     compare-at + no-compare-at variants, one sold-out tracked variant,
 *     product.smooch template, placeholder media)
 *   - "Smooch Women's Libido & Mood Gummies — QA Single"   (single variant, untracked
 *     inventory, one image, product.smooch template)
 *   - FAQ + Contact pages (templates page.faq / page.contact)
 *   - Development draft policies (marked as requiring legal review)
 *   - Main + footer menus
 *   - Publishes QA products to the Online Store channel
 *   - Points the STAGING theme's homepage/product templates at the QA product
 *     (staging theme only — identified from qa/results/deploy.json)
 *
 * Auth: SHOPIFY_ADMIN_TOKEN env var (Admin API access token from a custom app
 * on the staging store; scopes: write_products, read_locations,
 * write_online_store_pages, write_content, write_online_store_navigation,
 * write_legal_policies, write_themes, write_publications).
 * The token is never written to disk.
 *
 * Safety: only creates/updates objects it owns (QA-prefixed), never touches
 * the live theme, never deletes anything.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const API_VERSION = '2024-10';
const deploy = JSON.parse(readFileSync(new URL('../qa/results/deploy.json', import.meta.url), 'utf8'));
const STORE = process.env.SMOOCH_STORE || deploy.store;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
if (!STORE) fail('No store: set SMOOCH_STORE or run setup-staging.ps1 first.');
if (!TOKEN) fail('BLOCKED: SHOPIFY_ADMIN_TOKEN is not set.\nCreate a custom app on the staging store (Settings > Apps and sales channels > Develop apps), grant the scopes listed in this file header, install it, and export its Admin API access token as SHOPIFY_ADMIN_TOKEN for this shell only.');

function fail(msg) { console.error('SEED FAIL: ' + msg); process.exit(1); }
const log = (m) => console.log('== ' + m);

async function gql(query, variables = {}) {
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) fail(JSON.stringify(json.errors, null, 2));
  return json.data;
}

function userErrors(payload, label) {
  const errs = payload?.userErrors || [];
  if (errs.length) fail(`${label}: ${JSON.stringify(errs, null, 2)}`);
}

const PLACEHOLDER = (text, bg = 'F3DCE2', fg = '2B1220') =>
  `https://placehold.co/1200x1500/${bg}/${fg}/png?text=${encodeURIComponent(text)}`;

const summary = { store: STORE, createdAt: new Date().toISOString(), products: [], pages: [], menus: [], policies: [], notes: [] };

// ---------------------------------------------------------------- products
async function findProductByHandle(handle) {
  const d = await gql(`query($q:String!){ products(first:1, query:$q){ nodes{ id handle title } } }`, { q: `handle:${handle}` });
  return d.products.nodes[0] || null;
}

async function ensureMultiVariantProduct() {
  const handle = 'smooch-daily-gummies-qa-product';
  let existing = await findProductByHandle(handle);
  if (existing) { log(`QA product exists (${existing.id}) — leaving as-is`); return existing.id; }

  log('Creating multi-variant QA product');
  const d = await gql(`
    mutation($input: ProductSetInput!) {
      productSet(synchronous: true, input: $input) {
        product { id handle variants(first: 12) { nodes { id sku inventoryItem { id } } } }
        userErrors { field message }
      }
    }`, {
    input: {
      title: "Smooch Women's Libido & Mood Gummies — QA Product",
      handle,
      vendor: 'Smooch',
      productType: "Women's Wellness Gummy",
      status: 'ACTIVE',
      templateSuffix: 'smooch',
      descriptionHtml: '<p><strong>DEVELOPMENT TEST PRODUCT</strong> — not for sale. Prices are test values.</p>',
      productOptions: [
        { name: 'Pack', values: [{ name: '1 Pack' }, { name: '2 Packs' }, { name: '3 Packs' }] },
      ],
      variants: [
        { optionValues: [{ optionName: 'Pack', name: '1 Pack' }], price: '30.00', compareAtPrice: '40.00', sku: 'QA-1' },
        { optionValues: [{ optionName: 'Pack', name: '2 Packs' }], price: '56.00', compareAtPrice: '80.00', sku: 'QA-2' },
        { optionValues: [{ optionName: 'Pack', name: '3 Packs' }], price: '75.00', sku: 'QA-3' },
      ],
    },
  });
  userErrors(d.productSet, 'productSet');
  const product = d.productSet.product;

  // Inventory: track everything at the first location; QA-3 stays at 0 (sold out).
  const loc = await gql(`{ locations(first: 1) { nodes { id name } } }`);
  const locationId = loc.locations.nodes[0].id;
  const variants = product.variants.nodes;

  const tracked = await gql(`
    mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`, {
    productId: product.id,
    variants: variants.map((v) => ({ id: v.id, inventoryItem: { tracked: true } })),
  });
  userErrors(tracked.productVariantsBulkUpdate, 'variant tracking');

  const inv = await gql(`
    mutation($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) { userErrors { field message } }
    }`, {
    input: {
      name: 'available',
      reason: 'correction',
      ignoreCompareQuantity: true,
      quantities: variants.map((v) => ({
        inventoryItemId: v.inventoryItem.id,
        locationId,
        quantity: v.sku === 'QA-3' ? 0 : 25,
      })),
    },
  });
  userErrors(inv.inventorySetQuantities, 'inventory');

  const media = await gql(`
    mutation($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        mediaUserErrors { field message }
      }
    }`, {
    productId: product.id,
    media: [
      { originalSource: PLACEHOLDER('SMOOCH QA\\nPRODUCT RENDER'), alt: 'Development placeholder — product render', mediaContentType: 'IMAGE' },
      { originalSource: PLACEHOLDER('SMOOCH QA\\nGUMMIES CLOSE-UP', 'FAF5EE'), alt: 'Development placeholder — gummies close-up', mediaContentType: 'IMAGE' },
      { originalSource: PLACEHOLDER('SMOOCH QA\\nLIFESTYLE', 'BE2B54', 'FFF6F0'), alt: 'Development placeholder — lifestyle', mediaContentType: 'IMAGE' },
    ],
  });
  if (media.productCreateMedia.mediaUserErrors?.length) {
    summary.notes.push('Media upload errors: ' + JSON.stringify(media.productCreateMedia.mediaUserErrors));
  }
  summary.products.push({ handle, id: product.id, role: 'multi-variant QA' });
  return product.id;
}

async function ensureSingleVariantProduct() {
  const handle = 'smooch-daily-gummies-qa-single';
  const existing = await findProductByHandle(handle);
  if (existing) { log(`QA single product exists (${existing.id}) — leaving as-is`); return existing.id; }

  log('Creating single-variant QA product (untracked inventory, one image)');
  const d = await gql(`
    mutation($input: ProductSetInput!) {
      productSet(synchronous: true, input: $input) {
        product { id }
        userErrors { field message }
      }
    }`, {
    input: {
      title: "Smooch Women's Libido & Mood Gummies — QA Single",
      handle,
      vendor: 'Smooch',
      productType: "Women's Wellness Gummy",
      status: 'ACTIVE',
      templateSuffix: 'smooch',
      descriptionHtml: '<p><strong>DEVELOPMENT TEST PRODUCT</strong> — single-variant state.</p>',
      productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
      variants: [{ optionValues: [{ optionName: 'Title', name: 'Default Title' }], price: '25.00', sku: 'QA-SINGLE-1' }],
    },
  });
  userErrors(d.productSet, 'productSet single');
  const id = d.productSet.product.id;
  await gql(`
    mutation($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) { mediaUserErrors { field message } }
    }`, {
    productId: id,
    media: [{ originalSource: PLACEHOLDER('SMOOCH QA\\nSINGLE'), alt: 'Development placeholder', mediaContentType: 'IMAGE' }],
  });
  summary.products.push({ handle, id, role: 'single-variant QA' });
  return id;
}

async function publishToOnlineStore(productIds) {
  const pubs = await gql(`{ publications(first: 10) { nodes { id name } } }`);
  const online = pubs.publications.nodes.find((p) => /online store/i.test(p.name));
  if (!online) { summary.notes.push('Online Store publication not found — publish products manually.'); return; }
  for (const id of productIds) {
    const d = await gql(`
      mutation($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) { userErrors { field message } }
      }`, { id, input: [{ publicationId: online.id }] });
    const errs = d.publishablePublish.userErrors || [];
    if (errs.length && !/already published/i.test(JSON.stringify(errs))) {
      summary.notes.push(`publish ${id}: ${JSON.stringify(errs)}`);
    }
  }
  log('Products published to Online Store channel');
}

// ---------------------------------------------------------------- pages
async function ensurePage(title, handle, templateSuffix, body) {
  const found = await gql(`query($q:String!){ pages(first:1, query:$q){ nodes { id handle } } }`, { q: `handle:${handle}` });
  if (found.pages.nodes[0]) { log(`Page '${handle}' exists`); summary.pages.push({ handle, existed: true }); return; }
  const d = await gql(`
    mutation($page: PageCreateInput!) {
      pageCreate(page: $page) { page { id handle } userErrors { field message } }
    }`, { page: { title, handle, templateSuffix, body, isPublished: true } });
  userErrors(d.pageCreate, `pageCreate ${handle}`);
  summary.pages.push({ handle, created: true });
  log(`Created page '${handle}' (template suffix: ${templateSuffix || 'default'})`);
}

// ---------------------------------------------------------------- policies
async function ensurePolicies() {
  const DEV = (name) =>
    `<p><strong>DEVELOPMENT DRAFT — REQUIRES LEGAL REVIEW BEFORE LAUNCH.</strong></p><p>This placeholder ${name} exists so the staging theme renders policy links correctly. Replace with counsel-approved copy.</p>`;
  const types = ['REFUND_POLICY', 'PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'SHIPPING_POLICY', 'SUBSCRIPTION_POLICY'];
  for (const type of types) {
    try {
      const d = await gql(`
        mutation($type: ShopPolicyType!, $body: String!) {
          shopPolicyUpdate(shopPolicy: { type: $type, body: $body }) {
            userErrors { field message }
          }
        }`, { type, body: DEV(type.replaceAll('_', ' ').toLowerCase()) });
      const errs = d.shopPolicyUpdate?.userErrors || [];
      if (errs.length) summary.policies.push({ type, error: errs });
      else summary.policies.push({ type, set: 'development draft' });
    } catch (e) {
      summary.policies.push({ type, error: String(e) });
    }
  }
  log('Development draft policies written (marked as requiring legal review)');
}

// ---------------------------------------------------------------- menus
async function ensureMenus(productHandle, faqHandle, contactHandle) {
  const menus = await gql(`{ menus(first: 20) { nodes { id handle title items { id title url } } } }`);
  const byHandle = Object.fromEntries(menus.menus.nodes.map((m) => [m.handle, m]));

  const mainItems = [
    { title: 'Shop', type: 'HTTP', url: `/products/${productHandle}` },
    { title: 'How It Works', type: 'HTTP', url: `/products/${productHandle}#shopify-section-mechanism` },
    { title: 'Ingredients', type: 'HTTP', url: `/products/${productHandle}#shopify-section-formula` },
    { title: 'Reviews', type: 'HTTP', url: `/products/${productHandle}#smooch-reviews` },
    { title: 'FAQ', type: 'HTTP', url: `/pages/${faqHandle}` },
  ];
  const footerItems = [
    { title: 'Contact', type: 'HTTP', url: `/pages/${contactHandle}` },
    { title: 'FAQ', type: 'HTTP', url: `/pages/${faqHandle}` },
    { title: 'Shipping', type: 'HTTP', url: '/policies/shipping-policy' },
    { title: 'Returns', type: 'HTTP', url: '/policies/refund-policy' },
    { title: 'Privacy', type: 'HTTP', url: '/policies/privacy-policy' },
    { title: 'Terms', type: 'HTTP', url: '/policies/terms-of-service' },
  ];

  for (const [handle, title, items] of [
    ['main-menu', 'Main menu', mainItems],
    ['footer', 'Footer menu', footerItems],
  ]) {
    const existing = byHandle[handle];
    if (existing) {
      const d = await gql(`
        mutation($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, items: $items) { userErrors { field message } }
        }`, { id: existing.id, title, items });
      userErrors(d.menuUpdate, `menuUpdate ${handle}`);
      summary.menus.push({ handle, updated: true });
    } else {
      const d = await gql(`
        mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
          menuCreate(title: $title, handle: $handle, items: $items) { userErrors { field message } }
        }`, { title, handle, items });
      userErrors(d.menuCreate, `menuCreate ${handle}`);
      summary.menus.push({ handle, created: true });
    }
    log(`Menu '${handle}' configured`);
  }
}

// ------------------------------------------------- staging-theme template wiring
async function pointTemplatesAtProduct(productHandle) {
  const themeGid = `gid://shopify/OnlineStoreTheme/${deploy.themeId}`;
  const files = await gql(`
    query($id: ID!, $filenames: [String!]!) {
      theme(id: $id) {
        role
        files(filenames: $filenames, first: 5) {
          nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
        }
      }
    }`, { id: themeGid, filenames: ['templates/index.json', 'templates/product.smooch.json'] });
  if (!files.theme) { summary.notes.push('Theme files query failed — set section product pickers in the editor.'); return; }
  if (String(files.theme.role).toUpperCase() === 'MAIN') fail('SAFETY: recorded staging theme is LIVE; refusing to edit its files.');

  const updates = [];
  for (const node of files.theme.files.nodes) {
    const json = JSON.parse(node.content);
    let changed = false;
    for (const section of Object.values(json.sections || {})) {
      if (!section.settings) continue;
      if ('product' in section.settings && !section.settings.product) {
        section.settings.product = productHandle;
        changed = true;
      }
      if ('cta_link' in section.settings && !section.settings.cta_link) {
        section.settings.cta_link = `/products/${productHandle}`;
        changed = true;
      }
    }
    if (changed) updates.push({ filename: node.filename, body: { type: 'TEXT', value: JSON.stringify(json, null, 2) } });
  }
  if (!updates.length) { log('Templates already wired to a product'); return; }
  const d = await gql(`
    mutation($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        upsertedThemeFiles { filename }
        userErrors { field message }
      }
    }`, { themeId: themeGid, files: updates });
  userErrors(d.themeFilesUpsert, 'themeFilesUpsert');
  log(`Staging theme templates now reference '${productHandle}' (${updates.map((u) => u.filename).join(', ')})`);
}

// ---------------------------------------------------------------- run
const FAQ_HANDLE = 'faq';
const CONTACT_HANDLE = 'contact';
const productId = await ensureMultiVariantProduct();
const singleId = await ensureSingleVariantProduct();
await publishToOnlineStore([productId, singleId]);
await ensurePage('FAQ', FAQ_HANDLE, 'faq', '<p>Development page — the FAQ content renders from the Smooch FAQ section below.</p>');
await ensurePage('Contact', CONTACT_HANDLE, 'contact', '<p>Development contact page.</p>');
await ensurePolicies();
await ensureMenus('smooch-daily-gummies-qa-product', FAQ_HANDLE, CONTACT_HANDLE);
await pointTemplatesAtProduct('smooch-daily-gummies-qa-product');

summary.productHandle = 'smooch-daily-gummies-qa-product';
summary.singleProductHandle = 'smooch-daily-gummies-qa-single';
writeFileSync(new URL('../qa/results/seed.json', import.meta.url), JSON.stringify(summary, null, 2));
log('Seed complete → qa/results/seed.json');
console.log('NOTE: subscription selling plans require an app (e.g. Shopify Subscriptions) — not configurable via this script. See staging report.');
