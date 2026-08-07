/* Smooch cart drawer behaviors.
 *
 * - Deal chips: clicking "Buy N · Save $X" sets the line's quantity input and
 *   fires its change event, so Dawn's own cart pipeline (validation, section
 *   render, live regions) does the actual update.
 * - Ticker: rotates the reassurance lines beneath the checkout button. The
 *   drawer's inner HTML is replaced on every cart update, which re-creates the
 *   element and restarts the cycle cleanly.
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

if (!customElements.get('smooch-cart-ticker')) {
  customElements.define(
    'smooch-cart-ticker',
    class SmoochCartTicker extends HTMLElement {
      connectedCallback() {
        this.items = Array.from(this.querySelectorAll('.smooch-cart-ticker__item'));
        if (this.items.length < 2) return;
        this.index = 0;
        this.timer = setInterval(() => {
          this.index = (this.index + 1) % this.items.length;
          this.items.forEach((el, i) => el.classList.toggle('is-active', i === this.index));
        }, 3000);
      }

      disconnectedCallback() {
        clearInterval(this.timer);
      }
    }
  );
}
