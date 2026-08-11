/* Smooch cart drawer behaviors.
 *
 * Deal chips: clicking "Buy N · Save $X" sets the line's quantity input and
 * fires its change event, so Dawn's own cart pipeline (validation, section
 * render, live regions) does the actual update. (The reassurance ticker is a
 * pure-CSS marquee — no JS.)
 */

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-smooch-deal-qty]');
  if (!button) return;
  const row = button.closest('.cart-item');
  const input = row && row.querySelector('input.quantity__input');
  if (!input) return;
  const quantity = parseInt(button.dataset.smoochDealQty, 10);
  if (!quantity || quantity === parseInt(input.value, 10)) return;
  input.value = quantity;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
