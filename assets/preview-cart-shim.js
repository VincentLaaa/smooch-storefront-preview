/* STATIC DESIGN PREVIEW ONLY — never shipped to the real Shopify theme.
 * GitHub Pages has no backend, so the real `/cart/add` request Dawn's
 * product-form.js issues would 404. This intercepts that one fetch call and
 * answers it with a real, Liquid-rendered cart-drawer + cart-icon-bubble
 * fragment that was captured from the offline dev harness at export time
 * (see build-static-preview.mjs) — Dawn's own cart-drawer.js then renders it
 * exactly as it would a genuine Shopify response, so open/close, focus trap,
 * and animation all keep working unmodified. Checkout is disabled in the
 * baked fragment itself (no live store to check out against).
 *
 * Scope: the baked fragment matches ONE selection — the page's default
 * bundle/plan. If the visitor changes the selection before adding to cart,
 * we can't fabricate a correct fragment for it, so we surface that plainly
 * through Dawn's existing cart-error UI rather than showing wrong data.
 */
(function () {
  var fixtureEl = document.getElementById('smooch-preview-cart-fixture');
  if (!fixtureEl) return;

  var fixture;
  try {
    fixture = JSON.parse(fixtureEl.textContent);
  } catch (e) {
    return;
  }

  var originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/cart/add') === -1) return originalFetch(input, init);

    var matches = true;
    var body = init && init.body;
    if (body && typeof body.get === 'function') {
      var id = body.get('id');
      var sellingPlan = body.get('selling_plan') || '';
      if (String(id) !== String(fixture.variantId) || String(sellingPlan) !== String(fixture.sellingPlan || '')) {
        matches = false;
      }
    }

    var payload = matches
      ? { sections: fixture.sections }
      : {
          status: 422,
          message: 'Preview limitation',
          description:
            "This design preview can only add the page's default selection to cart. Every purchase path works fully on the live store.",
        };

    return Promise.resolve(
      new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
  };
})();
