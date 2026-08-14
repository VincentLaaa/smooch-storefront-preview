/* Smooch why-us slider: native scroll-snap track with arrows, a live
 * "Slide N of X" counter, and mouse drag-to-scroll — same lightweight
 * pattern as the review carousel and hero gallery.
 */
(() => {
  document.querySelectorAll('[data-smooch-why]').forEach((root) => {
    const track = root.querySelector('[data-why-track]');
    if (!track) return;
    const prevBtn = root.querySelector('[data-why-prev]');
    const nextBtn = root.querySelector('[data-why-next]');
    const currentEl = root.querySelector('[data-why-current]');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const slides = () => Array.from(track.querySelectorAll('.smooch-why__slide'));

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
      if (currentEl) currentEl.textContent = String(index + 1);
      if (prevBtn) prevBtn.disabled = index <= 0;
      if (nextBtn) nextBtn.disabled = index >= slides().length - 1;
    };

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(currentIndex() - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(currentIndex() + 1));
    track.addEventListener('scroll', () => window.requestAnimationFrame(sync), { passive: true });
    window.addEventListener('resize', sync);

    track.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(currentIndex() + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(currentIndex() - 1);
      }
    });

    // Mouse drag; touch keeps native scrolling.
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
      if (moved) goTo(currentIndex());
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    sync();
  });
})();
