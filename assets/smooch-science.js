/* Gentle illustration loops with visibility, motion preference and editor cleanup. */
(() => {
  if (window.smoochScienceInitialized) return;
  window.smoochScienceInitialized = true;
  const controllers = new Map();

  const init = (section) => {
    if (controllers.has(section)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const panels = [...section.querySelectorAll('.smooch-science__panel')];
    const videos = [...section.querySelectorAll('[data-science-anim]')];
    const button = section.querySelector('[data-science-motion]');
    let paused = false;

    const sync = () => {
      const stopped = paused || motion.matches || document.hidden;
      section.toggleAttribute('data-motion-paused', stopped);
      videos.forEach((video) => {
        if (stopped || video.closest('.smooch-science__panel').hasAttribute('data-science-offscreen')) {
          video.pause();
        } else {
          video.muted = true;
          video.playbackRate = 0.65;
          video.play().catch(() => {}); // Poster remains if autoplay is unavailable.
        }
      });
      if (button) {
        button.hidden = motion.matches;
        button.textContent = paused ? 'Play animations' : 'Pause animations';
        button.setAttribute('aria-pressed', String(paused));
      }
    };

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        target.toggleAttribute('data-science-offscreen', !isIntersecting);
      });
      sync();
    }, { threshold: 0.05 }) : null;
    panels.forEach((panel) => {
      panel.toggleAttribute('data-science-offscreen', Boolean(observer));
      observer?.observe(panel);
    });

    const toggle = () => { paused = !paused; sync(); };
    button?.addEventListener('click', toggle);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    section.setAttribute('data-science-ready', '');
    sync();

    controllers.set(section, () => {
      observer?.disconnect();
      videos.forEach((video) => video.pause());
      button?.removeEventListener('click', toggle);
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      controllers.delete(section);
    });
  };

  const initWithin = (root) => {
    if (root.matches?.('[data-smooch-science]')) init(root);
    root.querySelectorAll('[data-smooch-science]').forEach(init);
  };
  initWithin(document);
  document.addEventListener('shopify:section:load', (event) => initWithin(event.target));
  document.addEventListener('shopify:section:unload', (event) => {
    controllers.forEach((cleanup, section) => {
      if (event.target.contains(section)) cleanup();
    });
  });
})();
