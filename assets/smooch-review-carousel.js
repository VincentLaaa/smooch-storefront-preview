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

    /* ------------------------------------------------------------ arrows */
    const updateArrows = () => {
      if (!prevBtn && !nextBtn) return;
      const max = track.scrollWidth - track.clientWidth - 1;
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 0;
      if (nextBtn) nextBtn.disabled = track.scrollLeft >= max;
    };

    const scrollByCard = (dir) => {
      const card = track.querySelector('.smooch-rc__card');
      const step = card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * step, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    };

    if (prevBtn) prevBtn.addEventListener('click', () => scrollByCard(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollByCard(1));

    track.addEventListener('scroll', () => window.requestAnimationFrame(updateArrows), { passive: true });
    window.addEventListener('resize', updateArrows);
    updateArrows();

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
