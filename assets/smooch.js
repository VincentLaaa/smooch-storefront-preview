/* Smooch shared behaviors.
   Loaded once from layout/theme.liquid (deferred, after global.js so Dawn's
   pubsub/custom elements exist). All definitions are guarded so theme-editor
   section reloads never double-define or double-bind. */

/* Exclusive accordion group: closes sibling <details> when one opens.
   Usage: <smooch-details-group><details>…</details>…</smooch-details-group> */
if (!customElements.get('smooch-details-group')) {
  customElements.define(
    'smooch-details-group',
    class SmoochDetailsGroup extends HTMLElement {
      connectedCallback() {
        this.onToggle = (event) => {
          const target = event.target;
          if (!(target instanceof HTMLDetailsElement) || !target.open) return;
          this.querySelectorAll('details[open]').forEach((details) => {
            if (details !== target && details.parentElement.closest('smooch-details-group') === this) {
              details.open = false;
            }
          });
        };
        // 'toggle' does not bubble; use capture to observe descendants.
        this.addEventListener('toggle', this.onToggle, true);
      }

      disconnectedCallback() {
        this.removeEventListener('toggle', this.onToggle, true);
      }
    }
  );
}
