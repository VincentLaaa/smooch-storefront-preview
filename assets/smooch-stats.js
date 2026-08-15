/* Smooch stats: the big numbers roll up from 0 when the list scrolls into
 * view. Values stay server-rendered ("100k+", "82%", "3x"); the script
 * parses prefix/number/suffix from the text so any editable value animates.
 * Skipped entirely for prefers-reduced-motion (numbers just show final).
 */
(() => {
  const cards = document.querySelectorAll('[data-smooch-stats]');
  if (!cards.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;

  cards.forEach((card) => {
    const target = card.querySelector('.smooch-stats__list') || card;
    const parsed = Array.from(card.querySelectorAll('.smooch-stats__value'))
      .map((el) => {
        const text = el.textContent.trim();
        const m = text.match(/^([^0-9]*)([0-9.,]+)(.*)$/);
        if (!m) return null;
        return {
          el,
          text,
          prefix: m[1],
          value: parseFloat(m[2].replace(/,/g, '')),
          decimals: (m[2].split('.')[1] || '').length,
          grouped: m[2].includes(','),
          suffix: m[3],
        };
      })
      .filter(Boolean);
    if (!parsed.length) return;

    const fmt = (v, p) => {
      let s = v.toFixed(p.decimals);
      if (p.grouped) {
        s = Number(s).toLocaleString('en-US', {
          minimumFractionDigits: p.decimals,
          maximumFractionDigits: p.decimals,
        });
      }
      return p.prefix + s + p.suffix;
    };

    // Start from 0 so the roll-in has somewhere to come from.
    parsed.forEach((p) => {
      p.el.textContent = fmt(0, p);
    });

    const DURATION = 1400;
    const animate = () => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        parsed.forEach((p) => {
          // Land on the exact original text so no rounding drift survives.
          p.el.textContent = t >= 1 ? p.text : fmt(p.value * eased, p);
        });
        if (t < 1) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          animate();
        });
      },
      { threshold: 0.5 },
    );
    io.observe(target);
  });
})();
