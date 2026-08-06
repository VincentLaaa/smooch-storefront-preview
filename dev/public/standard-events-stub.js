/* Offline harness stub for cdn.shopify.com/storefront/standard-events.js.
   Provides just enough surface for Dawn's theme.liquid module script. */
export function createViewEventElement(Base = HTMLElement) {
  return class extends (Base || HTMLElement) {
    connectedCallback() {
      if (super.connectedCallback) super.connectedCallback();
    }
    disconnectedCallback() {
      if (super.disconnectedCallback) super.disconnectedCallback();
    }
  };
}
export class PageViewEvent extends Event {
  constructor() { super('dev:page-view'); }
}
