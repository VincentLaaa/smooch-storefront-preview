/* Smooch science section: accessible tab switcher.
 * Standard tablist semantics — click or roving-focus arrow keys select a
 * tab, aria-selected and hidden stay in sync. No motion, no dependencies.
 */
(() => {
  document.querySelectorAll('[data-smooch-science]').forEach((section) => {
    const tabs = Array.from(section.querySelectorAll('[role="tab"]'));
    if (tabs.length < 2) return;

    const select = (tab, focus = false) => {
      tabs.forEach((other) => {
        const active = other === tab;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', active ? 'true' : 'false');
        other.tabIndex = active ? 0 : -1;
        const panel = section.querySelector(`#${other.getAttribute('aria-controls')}`);
        if (panel) panel.hidden = !active;
      });
      if (focus) tab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        let target = null;
        if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
        else if (event.key === 'ArrowLeft') target = tabs[(index - 1 + tabs.length) % tabs.length];
        else if (event.key === 'Home') target = tabs[0];
        else if (event.key === 'End') target = tabs[tabs.length - 1];
        if (target) {
          event.preventDefault();
          select(target, true);
        }
      });
    });
  });
})();
