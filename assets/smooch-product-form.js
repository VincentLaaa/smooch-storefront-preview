/* Smooch purchase module controllers.
   Loaded by sections/smooch-product-hero.liquid after product-info.js /
   product-form.js. Never replaces Dawn behavior:
   - Variant switching goes through Dawn's <variant-selects> inputs so the whole
     section-render pipeline (price swap, media, URL, availability) runs as-is.
   - Quantity and selling plan ride on the native product form via
     form-associated hidden inputs; product-form.js posts them untouched.
   - All displayed prices are precomputed server-side (Liquid) and only
     *selected* here — no client-side money math.
   All elements guard against theme-editor re-execution via customElements.get. */

if (!customElements.get('smooch-offer')) {
  customElements.define(
    'smooch-offer',
    class SmoochOffer extends HTMLElement {
      connectedCallback() {
        this.sectionId = this.dataset.sectionId;
        this.currentVariantId = String(this.dataset.currentVariant || '');
        this.saveTemplate = this.dataset.saveTemplate || 'Save [percent]%';

        this.data = null;
        const dataScript = this.querySelector('[data-smooch-offer]');
        if (dataScript) {
          try {
            this.data = JSON.parse(dataScript.textContent);
          } catch (error) {
            console.error('smooch-offer: could not parse offer data', error);
          }
        }

        this.qtyInput = this.querySelector('[data-smooch-quantity]');
        this.planInput = this.querySelector('[data-smooch-selling-plan]');

        this.boundOnChange = this.onChange.bind(this);
        this.addEventListener('change', this.boundOnChange);

        // Track the form's variant id input directly: Dawn updates it (and
        // dispatches 'change') on every variant resolution — including the
        // unavailable-combination path where variantChange is never published.
        const form = document.getElementById(`product-form-${this.sectionId}`);
        this.variantIdInput = form ? form.querySelector('input[name="id"]') : null;
        if (this.variantIdInput) {
          this.boundOnVariantIdChange = () => {
            const value = this.variantIdInput.value;
            if (value && value !== this.currentVariantId) {
              this.currentVariantId = value;
              this.reconcileBundleSelection(false);
              this.render();
            }
          };
          this.variantIdInput.addEventListener('change', this.boundOnVariantIdChange);
        }

        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          this.variantChangeUnsubscriber = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
            if (event.data.sectionId !== this.sectionId) return;
            if (event.data.variant) this.currentVariantId = String(event.data.variant.id);
            this.reconcileBundleSelection(false);
            this.syncFormControls();
            this.render();
          });
        }

        // Dawn does not publish variantChange for unavailable option combos
        // (setUnavailable path) — mirror the submit button's disabled state so
        // the offer price visibly dims instead of looking confidently stale.
        const submitButton = document.getElementById(`ProductSubmitButton-${this.sectionId}`);
        if (submitButton) {
          this.submitStateObserver = new MutationObserver(() => {
            this.classList.toggle('smooch-offer--disabled', submitButton.hasAttribute('disabled'));
          });
          this.submitStateObserver.observe(submitButton, { attributes: true, attributeFilter: ['disabled'] });
          this.classList.toggle('smooch-offer--disabled', submitButton.hasAttribute('disabled'));
        }

        this.reconcileBundleSelection(true);
        this.syncFormControls();
        this.render();
      }

      disconnectedCallback() {
        this.removeEventListener('change', this.boundOnChange);
        if (this.variantChangeUnsubscriber) this.variantChangeUnsubscriber();
        if (this.submitStateObserver) this.submitStateObserver.disconnect();
        if (this.variantIdInput && this.boundOnVariantIdChange) {
          this.variantIdInput.removeEventListener('change', this.boundOnVariantIdChange);
        }
      }

      /* Keep the checked bundle card consistent with the actually selected
         variant (deep links with ?variant=, picker-driven pack changes).
         When `allowDrive` (initial load only) and the checked variant-mode
         bundle disagrees with reality with no better match, drive the picker
         so the offer is never visually misrepresented. */
      reconcileBundleSelection(allowDrive) {
        const radios = this.bundleRadios;
        if (!radios.length || !this.data) return;

        const matchesCurrent = (radio) => {
          const value = (radio.dataset.variantValue || '').trim();
          if (!value) return false;
          const target = this.resolveVariantForValue(value);
          return !!target && String(target.id) === this.currentVariantId;
        };

        const checked = this.selectedBundleRadio;
        const checkedValue = checked ? (checked.dataset.variantValue || '').trim() : '';
        if (checked && checkedValue && matchesCurrent(checked)) return;

        const match = radios.find(matchesCurrent);
        if (match) {
          if (!match.checked) {
            match.checked = true;
            if (this.qtyInput) this.qtyInput.value = parseInt(match.dataset.quantity, 10) || 1;
          }
          return;
        }

        if (allowDrive && checked && checkedValue) {
          this.applyBundle(checked);
        }
      }

      get bundleRadios() {
        return Array.from(this.querySelectorAll('[data-smooch-bundle-radio]'));
      }

      get selectedBundleRadio() {
        return this.bundleRadios.find((radio) => radio.checked);
      }

      get selectedBundleIndex() {
        const radio = this.selectedBundleRadio;
        return radio ? parseInt(radio.value, 10) || 0 : 0;
      }

      get selectedPlanId() {
        const radio = this.querySelector('[data-smooch-plan-radio]:checked');
        return radio && radio.value ? radio.value : '';
      }

      onChange(event) {
        const target = event.target;
        if (target.hasAttribute && target.hasAttribute('data-smooch-bundle-radio')) {
          this.applyBundle(target);
          this.render();
        } else if (target.hasAttribute && target.hasAttribute('data-smooch-plan-radio')) {
          this.applyPlan();
          this.render();
        }
      }

      applyBundle(radio) {
        if (this.qtyInput) this.qtyInput.value = parseInt(radio.dataset.quantity, 10) || 1;
        const value = (radio.dataset.variantValue || '').trim();
        if (value) {
          const target = this.resolveVariantForValue(value);
          if (target && String(target.id) !== this.currentVariantId) this.selectVariant(target);
        }
      }

      applyPlan() {
        if (!this.planInput) return;
        const planId = this.selectedPlanId;
        if (planId) {
          this.planInput.value = planId;
          this.planInput.disabled = false;
        } else {
          this.planInput.value = '';
          // Disabled inputs are excluded from FormData, so a one-time purchase
          // never posts an empty selling_plan parameter.
          this.planInput.disabled = true;
        }
      }

      /* Re-assert our form-associated inputs after any external update. */
      syncFormControls() {
        const radio = this.selectedBundleRadio;
        if (radio && this.qtyInput) this.qtyInput.value = parseInt(radio.dataset.quantity, 10) || 1;
        this.applyPlan();
      }

      variantEntry(id) {
        return this.data && this.data.variants ? this.data.variants[id] : null;
      }

      /* Find the variant matching `value` on one option while keeping the
         current variant's other option values. Falls back to the first variant
         carrying the value anywhere. */
      resolveVariantForValue(value) {
        if (!this.data || !this.data.variants) return null;
        const entries = Object.entries(this.data.variants).map(([id, entry]) => ({ id, ...entry }));
        const current = this.variantEntry(this.currentVariantId);

        if (current) {
          const exact = entries.find((candidate) => {
            for (let i = 0; i < candidate.options.length; i++) {
              if (candidate.options[i] !== value) continue;
              let matchesOthers = true;
              for (let j = 0; j < candidate.options.length; j++) {
                if (j !== i && candidate.options[j] !== current.options[j]) {
                  matchesOthers = false;
                  break;
                }
              }
              if (matchesOthers) return true;
            }
            return false;
          });
          if (exact) return exact;
        }
        return entries.find((candidate) => candidate.options.includes(value)) || null;
      }

      /* Drive Dawn's variant picker so its full pipeline runs. */
      selectVariant(target) {
        const productInfo = this.closest('product-info');
        const variantSelects = productInfo && productInfo.querySelector('variant-selects');
        if (!variantSelects) return;
        const current = this.variantEntry(this.currentVariantId);
        const optionContainers = variantSelects.querySelectorAll('.product-form__input');

        target.options.forEach((value, position) => {
          if (current && current.options[position] === value) return;
          const container = optionContainers[position];
          if (!container) return;

          const radioInput = Array.from(container.querySelectorAll('input[type="radio"]')).find(
            (input) => input.value === value
          );
          if (radioInput) {
            if (!radioInput.checked) {
              radioInput.checked = true;
              radioInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
          }

          const select = container.querySelector('select');
          if (select && select.value !== value) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }

      render() {
        if (!this.data) return;
        const variant = this.variantEntry(this.currentVariantId);
        if (!variant) return;

        // Plans are allocated per variant — hide plans the current variant
        // does not carry so the posted selling_plan always matches the shown
        // price. If the selected plan vanishes, fall back to one-time.
        let planSelectionLost = false;
        this.querySelectorAll('[data-smooch-plan-radio]').forEach((radio) => {
          if (!radio.value) return;
          const allocated = !!(variant.plans && variant.plans[radio.value]);
          radio.disabled = !allocated;
          const label = radio.closest('.smooch-plan');
          if (label) label.hidden = !allocated;
          if (!allocated && radio.checked) {
            radio.checked = false;
            planSelectionLost = true;
          }
        });
        if (planSelectionLost) {
          const onetime = this.querySelector('[data-smooch-plan-radio][value=""]');
          if (onetime) onetime.checked = true;
          this.applyPlan();
        }

        const planId = this.selectedPlanId;
        const bundleIndex = this.selectedBundleIndex;
        const priceFor = (entry, index) => {
          if (planId && entry.plans && entry.plans[planId]) return entry.plans[planId][index];
          return entry.base ? entry.base[index] : null;
        };

        this.bundleRadios.forEach((radio) => {
          const index = parseInt(radio.value, 10) || 0;
          const card = radio.closest('.smooch-bundle');
          if (!card) return;
          const bundle = this.data.bundles[index] || { quantity: 1, variantValue: '' };

          let entry = variant;
          let unavailable = !variant.available;
          if (bundle.variantValue) {
            const target = this.resolveVariantForValue(bundle.variantValue);
            if (target) {
              entry = target;
              unavailable = !target.available;
            }
          }

          const prices = priceFor(entry, index);
          if (prices) {
            this.setText(card, '[data-bundle-price]', prices.t);
            this.setCompare(card.querySelector('[data-bundle-compare]'), prices.c);
            this.setText(card, '[data-bundle-unit]', prices.u);
            this.setSave(card.querySelector('[data-bundle-save]'), prices.s);
          }
          const unitLine = card.querySelector('[data-bundle-unit-line]');
          if (unitLine) unitLine.hidden = (bundle.quantity || 1) <= 1;
          const soldout = card.querySelector('[data-bundle-soldout]');
          if (soldout) soldout.hidden = !unavailable;
          card.classList.toggle('smooch-bundle--soldout', unavailable);
        });

        const mainPrices = priceFor(variant, bundleIndex);
        const priceWrap = this.querySelector('[data-smooch-offer-price]');
        if (priceWrap && mainPrices) {
          this.setText(priceWrap, '[data-smooch-price]', mainPrices.t);
          this.setCompare(priceWrap.querySelector('[data-smooch-compare]'), mainPrices.c);
          this.setSave(priceWrap.querySelector('[data-smooch-save]'), mainPrices.s);
        }
        const unitLine = this.querySelector('[data-smooch-unit-line]');
        if (unitLine && mainPrices) {
          const bundle = this.data.bundles[bundleIndex] || { quantity: 1 };
          unitLine.hidden = (bundle.quantity || 1) <= 1;
          this.setText(unitLine, '[data-smooch-unit]', mainPrices.u);
        }

        this.querySelectorAll('[data-plan-save]').forEach((badge) => {
          const id = badge.dataset.planId;
          const planPrices = variant.plans && variant.plans[id] ? variant.plans[id][bundleIndex] : null;
          this.setSave(badge, planPrices ? planPrices.s : 0);
        });

        const selectedTier = bundleIndex + 1;
        this.querySelectorAll('[data-smooch-gift]').forEach((gift) => {
          const tier = parseInt(gift.dataset.tier, 10) || 1;
          const included = selectedTier >= tier;
          gift.classList.toggle('smooch-gift--included', included);
          const includedEl = gift.querySelector('[data-gift-included]');
          const lockedEl = gift.querySelector('[data-gift-locked]');
          if (includedEl) includedEl.hidden = !included;
          if (lockedEl) lockedEl.hidden = included;
        });

        this.dispatchEvent(
          new CustomEvent('smooch:offer:change', {
            bubbles: true,
            detail: {
              sectionId: this.sectionId,
              priceText: mainPrices ? mainPrices.t : '',
            },
          })
        );
      }

      setText(scope, selector, text) {
        const el = scope.querySelector(selector);
        if (el && typeof text === 'string') el.textContent = text;
      }

      setCompare(el, text) {
        if (!el) return;
        if (text) {
          el.textContent = text;
          el.hidden = false;
        } else {
          el.textContent = '';
          el.hidden = true;
        }
      }

      setSave(el, save) {
        if (!el) return;
        if (save > 0) {
          el.textContent = this.saveTemplate.replace('[percent]', save);
          el.hidden = false;
        } else {
          el.hidden = true;
        }
      }
    }
  );
}

if (!customElements.get('smooch-sticky-atc')) {
  customElements.define(
    'smooch-sticky-atc',
    class SmoochStickyAtc extends HTMLElement {
      connectedCallback() {
        this.sectionId = this.dataset.sectionId;
        this.button = this.querySelector('[data-sticky-submit]');
        this.label = this.querySelector('[data-sticky-label]');
        this.priceEl = this.querySelector('[data-sticky-price]');
        this.target = document.getElementById(`ProductSubmitButton-${this.sectionId}`);
        this.visible = false;
        this.drawerOpen = false;

        this.boundOnClick = () => {
          if (this.target && !this.target.hasAttribute('disabled')) this.target.click();
        };
        if (this.button) this.button.addEventListener('click', this.boundOnClick);

        this.boundOnOffer = (event) => {
          if (!event.detail || event.detail.sectionId !== this.sectionId) return;
          if (this.priceEl && event.detail.priceText) this.priceEl.textContent = event.detail.priceText;
        };
        document.addEventListener('smooch:offer:change', this.boundOnOffer);

        if (this.target && 'IntersectionObserver' in window) {
          this.observer = new IntersectionObserver(
            (entries) => {
              this.visible = !entries[0].isIntersecting;
              this.update();
            },
            { threshold: 0 }
          );
          this.observer.observe(this.target);

          this.boundSyncState = () => {
            const disabled =
              this.target.hasAttribute('disabled') || this.target.getAttribute('aria-disabled') === 'true';
            if (this.button) this.button.disabled = disabled;
            const span = this.target.querySelector('span');
            if (this.label && span) this.label.textContent = span.textContent.trim();
          };
          this.stateObserver = new MutationObserver(this.boundSyncState);
          this.stateObserver.observe(this.target, {
            attributes: true,
            attributeFilter: ['disabled', 'aria-disabled'],
            childList: true,
            subtree: true,
            characterData: true,
          });
          this.boundSyncState();
        }

        const drawer = document.querySelector('cart-drawer');
        if (drawer) {
          // Only 'active' is toggled symmetrically by Dawn; 'animate' is added
          // on first open and never removed.
          this.drawerObserver = new MutationObserver(() => {
            this.drawerOpen = drawer.classList.contains('active');
            this.update();
          });
          this.drawerObserver.observe(drawer, { attributes: true, attributeFilter: ['class'] });
        }

        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          // Surface add-to-cart errors triggered from the bar: Dawn renders the
          // message next to the (offscreen) main button, so bring it into view.
          this.cartErrorUnsubscriber = subscribe(PUB_SUB_EVENTS.cartError, () => {
            if (!this.visible) return;
            setTimeout(() => {
              const section = document.getElementById(`MainProduct-${this.sectionId}`);
              const errorWrapper = section && section.querySelector('.product-form__error-message-wrapper:not([hidden])');
              if (errorWrapper) {
                const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                errorWrapper.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
              }
            }, 100);
          });

          // Simple products (no bundles/plans → no offer engine): refresh the
          // bar price from Dawn's freshly swapped price node on variant change.
          this.variantChangeUnsubscriber = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
            if (event.data.sectionId !== this.sectionId || !this.priceEl) return;
            const section = document.getElementById(`MainProduct-${this.sectionId}`);
            if (!section || section.querySelector('[data-smooch-offer]')) return;
            const priceRoot = document.getElementById(`price-${this.sectionId}`);
            if (!priceRoot) return;
            const onSale = priceRoot.querySelector('.price--on-sale');
            const node = onSale
              ? priceRoot.querySelector('.price__sale .price-item--sale')
              : priceRoot.querySelector('.price__regular .price-item--regular');
            const text = node && node.textContent.trim();
            if (text) this.priceEl.textContent = text;
          });
        }

        this.update();
      }

      update() {
        const show = this.visible && !this.drawerOpen;
        this.hidden = !show;
        document.body.classList.toggle('smooch-sticky-atc-visible', show);
      }

      disconnectedCallback() {
        if (this.button) this.button.removeEventListener('click', this.boundOnClick);
        document.removeEventListener('smooch:offer:change', this.boundOnOffer);
        if (this.observer) this.observer.disconnect();
        if (this.stateObserver) this.stateObserver.disconnect();
        if (this.drawerObserver) this.drawerObserver.disconnect();
        if (this.cartErrorUnsubscriber) this.cartErrorUnsubscriber();
        if (this.variantChangeUnsubscriber) this.variantChangeUnsubscriber();
        document.body.classList.remove('smooch-sticky-atc-visible');
      }
    }
  );
}
