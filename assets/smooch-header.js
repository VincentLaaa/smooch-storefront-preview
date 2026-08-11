/* Smooch header: sticky scroll state, scroll-direction hide, mega-menu
 * dropdowns, and the mobile nav drawer. Vanilla JS + CSS transitions only
 * (transform/opacity), reuses global.js's trapFocus/removeTrapFocus.
 */
(() => {
  const header = document.querySelector('[data-smooch-header]');
  if (!header) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------- scroll state */
  if (header.hasAttribute('data-header-sticky')) {
    const HIDE_AFTER = 120;
    const canAutoHide = !header.hasAttribute('data-header-no-autohide') && !prefersReducedMotion;
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 8);

      if (canAutoHide) {
        if (y > lastY && y > HIDE_AFTER) {
          header.classList.add('is-hidden');
        } else if (y < lastY) {
          header.classList.remove('is-hidden');
        }
      }

      lastY = y;
      ticking = false;
    };

    update();
    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
      },
      { passive: true },
    );
  }

  /* ---------------------------------------------------------- mega menus */
  class SmoochHeaderMenu extends HTMLElement {
    constructor() {
      super();
      this.trigger = this.querySelector('.smooch-header__trigger');
      this.panel = this.querySelector('.smooch-header__panel');
      this.closeTimer = null;

      if (!this.trigger || !this.panel) return;

      // Real mouse users trigger `open()` via mouseenter before the click
      // event even lands (the pointer has to enter the button to click it),
      // so a click that *toggled* would immediately re-close a hover-opened
      // menu. Click only opens; closing happens on mouseleave, Escape, or an
      // outside click — this also covers keyboard/touch activation cleanly.
      this.trigger.addEventListener('click', (event) => {
        event.preventDefault();
        this.open();
      });

      this.addEventListener('mouseenter', () => {
        clearTimeout(this.closeTimer);
        this.open();
      });
      this.addEventListener('mouseleave', () => {
        this.closeTimer = setTimeout(() => this.close(), 150);
      });

      this.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.isOpen) {
          this.close();
          this.trigger.focus();
        }
      });

      document.addEventListener('click', (event) => {
        if (this.isOpen && !this.contains(event.target)) this.close();
      });
    }

    get isOpen() {
      return this.classList.contains('is-open');
    }

    open() {
      document.querySelectorAll('smooch-header-menu.is-open').forEach((el) => {
        if (el !== this) el.close();
      });
      this.classList.add('is-open');
      this.trigger.setAttribute('aria-expanded', 'true');
      this.panel.hidden = false;
    }

    close() {
      clearTimeout(this.closeTimer);
      this.classList.remove('is-open');
      this.trigger.setAttribute('aria-expanded', 'false');
      // Wait for the fade/translate to finish before hiding from the a11y
      // tree, so the closing animation stays visible.
      const duration = prefersReducedMotion ? 0 : 240;
      window.setTimeout(() => {
        if (!this.isOpen) this.panel.hidden = true;
      }, duration);
    }
  }

  if (!customElements.get('smooch-header-menu')) {
    customElements.define('smooch-header-menu', SmoochHeaderMenu);
  }

  /* ---------------------------------------------------------- mobile drawer */
  class SmoochMobileNav extends HTMLElement {
    constructor() {
      super();
      const toggleId = this.dataset.toggleId;
      this.toggle = toggleId ? document.getElementById(toggleId) : null;
      this.overlay = this.querySelector('.smooch-mobile-nav__overlay');
      this.panel = this.querySelector('.smooch-mobile-nav__panel');
      this.closeBtn = this.querySelector('.smooch-mobile-nav__close');

      if (this.toggle) {
        this.toggle.addEventListener('click', () => this.open());
      }
      if (this.overlay) this.overlay.addEventListener('click', () => this.close());
      if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
      this.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.classList.contains('is-open')) this.close();
      });
    }

    open() {
      this.hidden = false;
      // Force a style flush between removing [hidden] and adding .is-open —
      // the element was display:none, so without a reflow in between the
      // browser can paint straight to the end state (no visible slide, and
      // no transitionend to hang anything off of).
      void this.panel.offsetHeight;
      this.classList.add('is-open');
      document.body.classList.add('overflow-hidden');
      if (this.toggle) this.toggle.setAttribute('aria-expanded', 'true');
      // Move focus immediately rather than waiting on the animation — that's
      // both simpler and the more common accessible-dialog pattern.
      trapFocus(this.panel, this.closeBtn);
    }

    close() {
      this.classList.remove('is-open');
      document.body.classList.remove('overflow-hidden');
      if (this.toggle) this.toggle.setAttribute('aria-expanded', 'false');
      removeTrapFocus(this.toggle);

      const duration = prefersReducedMotion ? 0 : 360;
      window.setTimeout(() => {
        this.hidden = true;
      }, duration);
    }
  }

  if (!customElements.get('smooch-mobile-nav')) {
    customElements.define('smooch-mobile-nav', SmoochMobileNav);
  }
})();
