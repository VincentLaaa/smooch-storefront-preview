/* Smooch scroll story: entrance reveal, active-stage detection (drives the
 * product scene state + progress rail), and a scroll-linked product
 * reaction + extremely subtle parallax. IntersectionObserver does the
 * heavy lifting; the scroll listener only runs while the section is
 * actually in view, and only when prefers-reduced-motion allows it.
 */
(() => {
  const sections = document.querySelectorAll('[data-smooch-story]');
  if (!sections.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = () => window.matchMedia('(min-width: 990px)').matches;

  sections.forEach((section) => {
    const mode = section.dataset.mode === 'compact' ? 'compact' : 'full';
    const scene = section.querySelector('[data-smooch-scene]');
    const productScroll = section.querySelector('[data-smooch-product-scroll]');
    const stages = Array.from(section.querySelectorAll('[data-smooch-stage]'));
    const railFill = section.querySelector('[data-smooch-rail-fill]');
    const gummies = Array.from(section.querySelectorAll('[data-smooch-gummy]'));
    const stageCount = stages.length;

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

    /* ------------------------------------------------- active stage / scene */
    const revealGummies = (activeIndex) => {
      if (!gummies.length) return;
      // Fewer gummies on mobile (spec: 2-3 vs 3-5 desktop) — cap how many
      // are ever eligible to reveal rather than just hiding the overflow.
      const maxGummies = isDesktop() ? gummies.length : Math.min(3, gummies.length);
      const revealCount = Math.max(
        1,
        Math.ceil(((activeIndex + 1) / Math.max(stageCount, 1)) * maxGummies),
      );
      gummies.forEach((gummy, i) => {
        gummy.classList.toggle('is-revealed', i < Math.min(revealCount, maxGummies));
      });
    };

    const setActiveStage = (index) => {
      stages.forEach((stage, i) => stage.classList.toggle('is-active', i === index));
      if (scene) {
        scene.style.setProperty('--smooch-story-progress', stageCount > 1 ? index / (stageCount - 1) : 1);
        scene.dataset.activeStage = String(index);
      }
      if (railFill) {
        railFill.style.setProperty('--smooch-story-rail-progress', stageCount > 1 ? index / (stageCount - 1) : 1);
      }
      revealGummies(index);
    };

    if (mode === 'full' && stageCount) {
      // Start with stage 0's state before anything has scrolled/intersected.
      setActiveStage(0);

      const stageObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const index = stages.indexOf(entry.target);
            if (index > -1) setActiveStage(index);
          });
        },
        // A thin band near the vertical center of the viewport — a stage is
        // "active" once it crosses roughly the middle of the screen.
        { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
      );
      stages.forEach((stage) => stageObserver.observe(stage));
    } else if (stageCount) {
      // Compact: no scroll-driven progression — every stage is visible at
      // once (CSS handles that), so just reveal all the gummies up front
      // rather than staging them in across a scroll that doesn't happen.
      revealGummies(stageCount - 1);
    }

    /* --------------------------------------- scroll reaction + parallax */
    // Compact sections don't scroll-react or parallax — the whole point is
    // that they fit in one viewport-ish block, so there's no meaningful
    // scroll range to interpolate across, and no reason to pay for a
    // listener.
    if (mode === 'compact' || prefersReducedMotion || !productScroll) return;

    let ticking = false;
    let sectionInView = false;

    const updateScroll = () => {
      ticking = false;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const total = rect.height + vh;
      const raw = (vh - rect.top) / total;
      const progress = Math.min(1, Math.max(0, raw));

      const rot = -2 + progress * 4; // -2deg -> +2deg
      const x = -5 + progress * 10; // -5px -> +5px
      const scale = 1 + Math.sin(progress * Math.PI) * 0.025; // 1 -> 1.025 -> 1

      productScroll.style.setProperty('--smooch-story-scroll-rot', `${rot.toFixed(2)}deg`);
      productScroll.style.setProperty('--smooch-story-scroll-x', `${x.toFixed(2)}px`);
      productScroll.style.setProperty('--smooch-story-scroll-scale', scale.toFixed(4));

      if (scene) scene.style.setProperty('--smooch-story-scroll', progress.toFixed(4));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateScroll);
    };

    // Only pay for the scroll listener while the section is actually
    // visible — a coarse observer toggles it on/off.
    const viewportObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          sectionInView = entry.isIntersecting;
          if (sectionInView) {
            updateScroll();
            window.addEventListener('scroll', onScroll, { passive: true });
          } else {
            window.removeEventListener('scroll', onScroll);
          }
        });
      },
      { threshold: 0 },
    );
    viewportObserver.observe(section);
  });
})();
