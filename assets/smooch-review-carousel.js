/* Smooch review carousel: arrow controls, mouse-drag scroll, and an
 * entrance reveal. Horizontal scrolling itself is native (overflow-x +
 * scroll-snap) — this only adds the affordances native scroll doesn't give
 * you for free (arrow buttons, drag-to-scroll on desktop, disabled-state
 * arrows at the ends).
 */
(() => {
  const sections = document.querySelectorAll('[data-smooch-carousel]');
  if (!sections.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  sections.forEach((section) => {
    const track = section.querySelector('[data-smooch-track]');
    const prevBtn = section.querySelector('[data-smooch-prev]');
    const nextBtn = section.querySelector('[data-smooch-next]');

    /* ---------------------------------------------------------- entrance */
    const entranceObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          section.classList.add('is-visible');
          entranceObserver.disconnect();
        });
      },
      { threshold: 0.15 },
    );
    entranceObserver.observe(section);

    if (!track) return;

    /* ---------------------------------------------- arrows (looping) */
    const scrollByCard = (dir) => {
      const behavior = prefersReducedMotion ? 'auto' : 'smooth';
      const max = track.scrollWidth - track.clientWidth;
      // At either end the arrows wrap around instead of dead-ending. The
      // snap gutters settle a few px off the exact edge, so "at the end"
      // is tolerant (48px is well under any card width).
      const EDGE = 48;
      if (dir > 0 && track.scrollLeft >= max - EDGE) {
        track.scrollTo({ left: 0, behavior });
        return;
      }
      if (dir < 0 && track.scrollLeft <= EDGE) {
        track.scrollTo({ left: track.scrollWidth, behavior });
        return;
      }
      const card = track.querySelector('.smooch-rc__card');
      const step = card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * step, behavior });
    };

    if (prevBtn) prevBtn.addEventListener('click', () => scrollByCard(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollByCard(1));

    /* -------------------------------------------------- desktop drag-scroll */
    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    track.addEventListener('mousedown', (event) => {
      isDown = true;
      moved = false;
      track.classList.add('is-dragging');
      startX = event.pageX;
      startScroll = track.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      isDown = false;
      track.classList.remove('is-dragging');
    });

    track.addEventListener('mouseleave', () => {
      isDown = false;
      track.classList.remove('is-dragging');
    });

    track.addEventListener('mousemove', (event) => {
      if (!isDown) return;
      event.preventDefault();
      const delta = event.pageX - startX;
      if (Math.abs(delta) > 4) moved = true;
      track.scrollLeft = startScroll - delta;
    });

    // Dragging shouldn't also fire link/button clicks inside the card that
    // was dragged past.
    track.addEventListener(
      'click',
      (event) => {
        if (moved) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true },
    );
  });
})();
