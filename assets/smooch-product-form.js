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

        // Each bundle carries its own real selling plan (different sizes can
        // have different real discounts/intervals, e.g. 1 tub/month vs. 3
        // tubs/3 months aren't the same percentage off) — swap the single
        // subscribe radio's value to match so posting "subscribe" always
        // submits the plan that actually applies to the selected size.
        const bundleIndex = parseInt(radio.value, 10) || 0;
        const bundleMeta = this.data.bundles && this.data.bundles[bundleIndex];
        const subscribeRadio = this.querySelector('[data-smooch-plan-radio]:not([value=""])');
        if (bundleMeta && bundleMeta.sellingPlanId && subscribeRadio) {
          subscribeRadio.value = bundleMeta.sellingPlanId;
          // Setting .value doesn't fire 'change', so the hidden selling-plan
          // form input (what's actually submitted to the cart) would stay
          // stale at the old bundle's plan id unless synced here explicitly.
          if (subscribeRadio.checked) this.applyPlan();
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

          // Cards only ever show month / count / per-day — the full price
          // breakdown (compare, current, savings) lives in the subscription
          // card below, so only the per-day figure needs live sync here.
          // Each bundle carries its OWN real selling plan (different sizes
          // aren't the same discount/interval), so when subscribed, this
          // card's per-day must use ITS OWN plan id, not whichever plan
          // happens to be globally selected right now.
          const cardPlanId = planId ? bundle.sellingPlanId || planId : '';
          const prices = cardPlanId && entry.plans && entry.plans[cardPlanId]
            ? entry.plans[cardPlanId][index]
            : priceFor(entry, index);
          if (prices) {
            const perDay = card.querySelector('[data-bundle-per-day]');
            if (perDay) {
              if (prices.pd) {
                perDay.textContent = prices.pd;
                perDay.parentElement.hidden = false;
              } else {
                perDay.parentElement.hidden = true;
              }
            }
          }
          const soldout = card.querySelector('[data-bundle-soldout]');
          if (soldout) soldout.hidden = !unavailable;
          card.classList.toggle('smooch-bundle--soldout', unavailable);
        });

        const mainPrices = priceFor(variant, bundleIndex);
        const priceWrap = this.querySelector('[data-smooch-offer-price]');
        if (priceWrap && mainPrices) {
          this.setText(priceWrap, '[data-smooch-price]', mainPrices.t);
        }

        this.querySelectorAll('[data-plan-save]').forEach((badge) => {
          const id = badge.dataset.planId;
          const planPrices = variant.plans && variant.plans[id] ? variant.plans[id][bundleIndex] : null;
          this.setSave(badge, planPrices ? planPrices.s : 0);
        });

        // Per-option resulting totals (one-time row + each plan row).
        const baseEntry = variant.base ? variant.base[bundleIndex] : null;
        const onetimePrice = this.querySelector('[data-onetime-price]');
        if (onetimePrice && baseEntry) onetimePrice.textContent = baseEntry.t;
        this.setCompare(this.querySelector('[data-onetime-compare]'), baseEntry ? baseEntry.c : '');
        const onetimePerDayWrap = this.querySelector('[data-onetime-perday-wrap]');
        if (onetimePerDayWrap) {
          if (baseEntry && baseEntry.pd) {
            this.setText(this, '[data-onetime-perday]', baseEntry.pd);
            onetimePerDayWrap.hidden = false;
          } else {
            onetimePerDayWrap.hidden = true;
          }
        }
        this.querySelectorAll('[data-plan-price]').forEach((el) => {
          const id = el.dataset.planId;
          const planPrices = variant.plans && variant.plans[id] ? variant.plans[id][bundleIndex] : null;
          if (planPrices) {
            el.textContent = planPrices.t;
            el.hidden = false;
          } else {
            el.hidden = true;
          }
        });
        // Strike-through one-time total beside each subscription price.
        this.querySelectorAll('[data-plan-compare]').forEach((el) => {
          const id = el.dataset.planId;
          const planPrices = variant.plans && variant.plans[id] ? variant.plans[id][bundleIndex] : null;
          this.setCompare(el, planPrices ? planPrices.c : '');
        });

        // Featured subscription panel (Create-style): always shows the
        // economics of the active (or first) plan for the selected supply;
        // dims when one-time is chosen.
        const panel = this.querySelector('[data-sub-panel]');
        if (panel) {
          // Each bundle carries its own real selling plan — prefer the
          // currently selected plan, else the CURRENT bundle's own plan
          // (not just "the first plan in the array", which may not even
          // apply to this bundle), else the first plan as a last resort.
          const currentBundleMeta = this.data.bundles[bundleIndex] || {};
          const panelPlanId =
            planId || String(currentBundleMeta.sellingPlanId || (this.data.plans[0] || {}).id || '');
          const planEntry = variant.plans && variant.plans[panelPlanId] ? variant.plans[panelPlanId][bundleIndex] : null;
          const oneTimeEntry = variant.base ? variant.base[bundleIndex] : null;
          panel.classList.toggle('smooch-subpanel--inactive', !planId);
          if (planEntry && oneTimeEntry) {
            this.setText(panel, '[data-sub-price]', planEntry.t);
            this.setCompare(panel.querySelector('[data-sub-compare]'), planEntry.c);
            const pct = panel.querySelector('[data-sub-pct]');
            const pctPill = panel.querySelector('[data-sub-pct-pill]');
            if (pct && pctPill) {
              if (planEntry.s > 0) { pct.textContent = planEntry.s; pctPill.hidden = false; }
              else pctPill.hidden = true;
            }
            const autoBadge = panel.querySelector('[data-sub-autobadge]');
            if (autoBadge) autoBadge.hidden = !(planEntry.s > 0);
            const perDayWrap = panel.querySelector('[data-sub-perday-wrap]');
            if (perDayWrap) {
              if (planEntry.pd) {
                this.setText(panel, '[data-sub-perday]', planEntry.pd);
                perDayWrap.hidden = false;
              } else perDayWrap.hidden = true;
            }
            const saving = panel.querySelector('[data-sub-saving]');
            if (saving) {
              if (planEntry.sa) { saving.textContent = `You’re saving ${planEntry.sa}`; saving.hidden = false; }
              else saving.hidden = true;
            }
          }
        }

        const discountBadge = this.querySelector('[data-discount-badge]');
        if (discountBadge) discountBadge.hidden = !planId;

        // Purchase summary line ("2 bottles · 60-day supply · Subscription…").
        const bundleMeta = this.data.bundles[bundleIndex] || { quantity: 1, days: 0, label: '' };
        const planLabelEl = this.querySelector('[data-sub-plan-label]');
        if (planLabelEl && bundleMeta.label) planLabelEl.textContent = bundleMeta.label;
        // "Most popular" only makes sense for the size it's actually badging —
        // re-hide/show it as the shopper switches supply size.
        const ribbon = this.querySelector('[data-sub-ribbon]');
        if (ribbon) ribbon.hidden = !bundleMeta.mostPopular;
        const supplyEl = this.querySelector('[data-summary-supply]');
        const bundleQty = bundleMeta.quantity || 1;
        const bottleText = `${bundleQty} bottle${bundleQty === 1 ? '' : 's'}`;
        let supplyText = bottleText;
        if (bundleMeta.days > 0) supplyText += ` · ${bundleMeta.days}-day supply`;
        if (supplyEl) supplyEl.textContent = supplyText;
        // Subscription card's meta line stays compact: "3 Months · 3 bottles · $X/day" —
        // the bundle title already conveys duration, so this only needs the count.
        this.setText(this, '[data-sub-supply]', `· ${bottleText}`);
        const planLineEl = this.querySelector('[data-summary-plan]');
        if (planLineEl) {
          if (planId) {
            const plan = (this.data.plans || []).find((p) => String(p.id) === String(planId));
            planLineEl.textContent = ` · Subscription${plan ? ` — ${plan.name.toLowerCase()}` : ''}`;
            planLineEl.hidden = false;
          } else {
            planLineEl.hidden = true;
          }
        }
        const saveLineEl = this.querySelector('[data-summary-save]');
        if (saveLineEl && mainPrices) {
          if (mainPrices.sa) {
            saveLineEl.textContent = `You save ${mainPrices.sa}`;
            saveLineEl.hidden = false;
          } else {
            saveLineEl.hidden = true;
          }
        }

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
              compareText: mainPrices && mainPrices.c ? mainPrices.c : '',
              perDayText: mainPrices && mainPrices.pd ? mainPrices.pd : '',
              saveText: mainPrices && planId && mainPrices.s > 0 ? `Subscribe & Save ${mainPrices.s}%` : '',
              isSubscribe: !!planId,
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
        this.compareEl = this.querySelector('[data-sticky-compare]');
        this.saveEl = this.querySelector('[data-sticky-save]');
        this.perDayWrap = this.querySelector('[data-sticky-perday-wrap]');
        this.perDayEl = this.querySelector('[data-sticky-perday]');
        this.target = document.getElementById(`ProductSubmitButton-${this.sectionId}`);
        this.sentinel = document.querySelector(
          `[data-smooch-sticky-sentinel][data-section-id="${this.sectionId}"]`
        );
        this.visible = false;
        this.drawerOpen = false;

        this.boundOnClick = () => {
          if (!this.target) return;
          if (this.target.hasAttribute('disabled')) return;
          if (this.target.getAttribute('aria-disabled') === 'true') return;
          this.target.click();
        };
        if (this.button) this.button.addEventListener('click', this.boundOnClick);

        this.boundOnOffer = (event) => {
          if (!event.detail || event.detail.sectionId !== this.sectionId) return;
          if (this.priceEl && event.detail.priceText) this.priceEl.textContent = event.detail.priceText;
          if (this.compareEl) {
            if (event.detail.compareText) {
              this.compareEl.textContent = event.detail.compareText;
              this.compareEl.hidden = false;
            } else {
              this.compareEl.hidden = true;
            }
          }
          if (this.saveEl) {
            if (event.detail.saveText) {
              this.saveEl.textContent = event.detail.saveText;
              this.saveEl.hidden = false;
            } else {
              this.saveEl.hidden = true;
            }
          }
          if (this.perDayWrap && this.perDayEl) {
            if (event.detail.perDayText) {
              this.perDayEl.textContent = event.detail.perDayText;
              this.perDayWrap.hidden = false;
            } else {
              this.perDayWrap.hidden = true;
            }
          }
        };
        document.addEventListener('smooch:offer:change', this.boundOnOffer);
        // The offer's initial render fires before this listener exists (it sits
        // earlier in the DOM) — nudge a re-render so the bar starts in sync.
        const offer = document.querySelector(`smooch-offer[data-section-id="${this.sectionId}"]`);
        if (offer && typeof offer.render === 'function' && offer.data) offer.render();

        // Visibility is driven by a sentinel placed immediately after the real
        // purchase controls, NOT by observing the button itself — a button-only
        // observer reports "not intersecting" both when the visitor has scrolled
        // past it AND when they haven't reached it yet (e.g. it starts below the
        // fold), which would show the bar before the purchase controls are ever
        // seen. The sentinel's rect tells the two cases apart: only a rect whose
        // bottom has moved above the viewport top means "scrolled past." An
        // IntersectionObserver only fires on a genuine crossing of its target's
        // intersection ratio — an instant jump that skips over the sentinel
        // entirely (e.g. a deep link landing already past the fold) never
        // registers a crossing and would leave the bar stuck in its prior
        // state. A passive, rAF-throttled rect check driven by scroll/resize
        // (never a raw unthrottled scroll handler) is correct in both cases.
        const sentinelTarget = this.sentinel || this.target;
        if (sentinelTarget) {
          // The bar also steps aside at the end of the page: once the footer
          // enters the viewport, the visitor is reading the page bottom and
          // the fixed bar would sit on top of it.
          const footerEl = document.querySelector('footer, .footer');
          let ticking = false;
          this.boundCheckSentinel = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
              ticking = false;
              const pastControls = sentinelTarget.getBoundingClientRect().bottom < 0;
              const footerInView = footerEl
                ? footerEl.getBoundingClientRect().top < window.innerHeight
                : false;
              this.visible = pastControls && !footerInView;
              this.update();
            });
          };
          window.addEventListener('scroll', this.boundCheckSentinel, { passive: true });
          window.addEventListener('resize', this.boundCheckSentinel, { passive: true });
          this.boundCheckSentinel();
        }

        if (this.target) {
          this.boundSyncState = () => {
            const disabled =
              this.target.hasAttribute('disabled') || this.target.getAttribute('aria-disabled') === 'true';
            if (this.button) {
              this.button.disabled = disabled;
              this.button.classList.toggle('loading', this.target.classList.contains('loading'));
            }
            const span = this.target.querySelector('span');
            if (this.label && span) this.label.textContent = span.textContent.trim();
            const targetSpinner = this.target.querySelector('.loading__spinner');
            const stickySpinner = this.button && this.button.querySelector('.loading__spinner');
            if (targetSpinner && stickySpinner) {
              stickySpinner.classList.toggle('hidden', targetSpinner.classList.contains('hidden'));
            }
          };
          this.stateObserver = new MutationObserver(this.boundSyncState);
          this.stateObserver.observe(this.target, {
            attributes: true,
            attributeFilter: ['disabled', 'aria-disabled', 'class'],
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

        // Remove the no-JS-fallback `hidden` attribute now that this element is
        // upgraded: visibility from here on is animated via the `is-visible`
        // class (opacity/transform/visibility), not the `hidden` attribute,
        // so showing/hiding can transition instead of snapping.
        this.hidden = false;
        this.update();
      }

      update() {
        const show = this.visible && !this.drawerOpen;
        this.classList.toggle('is-visible', show);
        this.setAttribute('aria-hidden', show ? 'false' : 'true');
        document.body.classList.toggle('smooch-sticky-atc-visible', show);
      }

      disconnectedCallback() {
        if (this.button) this.button.removeEventListener('click', this.boundOnClick);
        document.removeEventListener('smooch:offer:change', this.boundOnOffer);
        if (this.boundCheckSentinel) {
          window.removeEventListener('scroll', this.boundCheckSentinel);
          window.removeEventListener('resize', this.boundCheckSentinel);
        }
        if (this.stateObserver) this.stateObserver.disconnect();
        if (this.drawerObserver) this.drawerObserver.disconnect();
        if (this.cartErrorUnsubscriber) this.cartErrorUnsubscriber();
        if (this.variantChangeUnsubscriber) this.variantChangeUnsubscriber();
        document.body.classList.remove('smooch-sticky-atc-visible');
      }
    }
  );
}

/* Swap the main Add to Cart button's label to "Adding…" while product-form.js
   has it in its `.loading` state (submit in flight). Purely a label swap —
   Dawn's own disabled/spinner handling on this button is untouched; we only
   watch it via MutationObserver, the same non-invasive pattern the sticky
   ATC bar already uses to mirror this button's state. Guarded per-button so
   theme-editor re-execution can't attach a second observer. */
document.querySelectorAll('.smooch-buybox__buy [id^="ProductSubmitButton-"]').forEach((button) => {
  if (button.dataset.smoochLoadingLabelBound) return;
  button.dataset.smoochLoadingLabelBound = 'true';

  const label = button.querySelector('span');
  if (!label) return;
  const defaultText = label.textContent.trim();
  const loadingText = 'Adding…';

  const sync = () => {
    if (button.classList.contains('loading')) {
      if (label.textContent !== loadingText) label.textContent = loadingText;
    } else if (label.textContent === loadingText) {
      label.textContent = defaultText;
    }
  };

  new MutationObserver(sync).observe(button, { attributes: true, attributeFilter: ['class'] });
});
