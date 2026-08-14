/* Smooch hero media carousel controller.
 * The carousel itself is native (overflow-x + scroll-snap on Dawn's
 * .product__media-list), so touch swipe and trackpad panning work with no
 * JS at all. This adds only what native scroll can't provide: mouse
 * drag-to-scroll on desktop, pagination dots, arrow buttons, keyboard
 * arrows, and re-syncing when product-info.js mutates the media list on
 * variant changes.
 */
(() => {
  const roots = document.querySelectorAll('[data-smooch-gallery]');
  if (!roots.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  roots.forEach((root) => {
    const track = root.querySelector('.product__media-list');
    if (!track) return;
    const dotsWrap = root.querySelector('[data-gallery-dots]');
    const prevBtn = root.querySelector('[data-gallery-prev]');
    const nextBtn = root.querySelector('[data-gallery-next]');

    const slides = () => Array.from(track.querySelectorAll('.product__media-item'));

    const currentIndex = () => {
      const list = slides();
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      list.forEach((slide, i) => {
        const dist = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    };

    const goTo = (index) => {
      const list = slides();
      const slide = list[Math.max(0, Math.min(index, list.length - 1))];
      if (!slide) return;
      track.scrollTo({ left: slide.offsetLeft, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    };

    const sync = () => {
      const index = currentIndex();
      if (dotsWrap) {
        Array.from(dotsWrap.children).forEach((dot, i) => {
          dot.classList.toggle('is-active', i === index);
          dot.setAttribute('aria-current', i === index ? 'true' : 'false');
        });
      }
      const last = slides().length - 1;
      if (prevBtn) prevBtn.disabled = index <= 0;
      if (nextBtn) nextBtn.disabled = index >= last;
    };

    // Scroll-linked motion: driven by the live scroll position (not a timed
    // animation), so it tracks a drag 1:1. A slide leaving the viewport
    // gently scales down and fades while the incoming one rises to full
    // presence; the image itself lags a touch behind its slide (parallax).
    const applyMotion = () => {
      if (prefersReducedMotion) return;
      const list = slides();
      if (list.length < 2) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      list.forEach((slide) => {
        const container = slide.querySelector('.product-media-container');
        if (!container) return;
        const raw = (slide.offsetLeft + slide.offsetWidth / 2 - center) / track.clientWidth;
        const progress = Math.max(-1, Math.min(1, raw));
        const away = Math.abs(progress);
        container.style.transform = `scale(${(1 - away * 0.12).toFixed(4)})`;
        container.style.opacity = (1 - away * 0.5).toFixed(4);
        const media = container.querySelector('.media img, .media video, .media iframe');
        if (media) media.style.transform = `translateX(${(-progress * 10).toFixed(3)}%)`;
      });
    };

    const buildDots = () => {
      const count = slides().length;
      root.classList.toggle('smooch-gallery--single', count < 2);
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      if (count < 2) return;
      for (let i = 0; i < count; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'smooch-gallery__dot';
        dot.setAttribute('aria-label', `Go to image ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(dot);
      }
      sync();
    };

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(currentIndex() - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(currentIndex() + 1));

    let frameQueued = false;
    const onFrame = () => {
      frameQueued = false;
      sync();
      applyMotion();
    };
    track.addEventListener(
      'scroll',
      () => {
        if (frameQueued) return;
        frameQueued = true;
        window.requestAnimationFrame(onFrame);
      },
      { passive: true }
    );
    window.addEventListener('resize', onFrame);

    // Keyboard support on the scroll region itself.
    track.setAttribute('tabindex', '0');
    track.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(currentIndex() + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(currentIndex() - 1);
      }
    });

    // Mouse drag-to-scroll. Touch pointers keep native scrolling — snapping,
    // momentum, and overscroll all behave better than anything reimplemented.
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;

    track.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.pageX;
      startScroll = track.scrollLeft;
      track.classList.add('is-dragging');
    });

    window.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const delta = event.pageX - startX;
      if (Math.abs(delta) > 4) moved = true;
      track.scrollLeft = startScroll - delta;
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      // is-dragging disabled CSS snapping so the drag tracks 1:1; settle on
      // the nearest slide now that it's back on.
      if (moved) goTo(currentIndex());
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // A drag that traveled must not also fire the click it lands on
    // (each slide is wrapped in a zoom modal-opener).
    track.addEventListener(
      'click',
      (event) => {
        if (moved) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true }
    );
    track.addEventListener('dragstart', (event) => event.preventDefault());

    // product-info.js adds/removes/reorders slides in place on variant
    // changes — rebuild the dots whenever the list mutates.
    new MutationObserver(() => {
      buildDots();
      applyMotion();
    }).observe(track, { childList: true });

    buildDots();
    applyMotion();
    root.classList.add('smooch-gallery--ready');
  });
})();
