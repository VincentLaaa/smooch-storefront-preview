/* Smooch full reviews: client-side sort (reorders already-rendered rows —
 * no re-fetch) and a load-more batcher. All content is server-rendered
 * Liquid; this just toggles which rows are visible/in what order.
 */
(() => {
  const lists = document.querySelectorAll('[data-smooch-review-list]');
  if (!lists.length) return;

  lists.forEach((list) => {
    const section = list.closest('.smooch-rf');
    const sortSelect = section ? section.querySelector('[data-smooch-sort]') : null;
    const moreBtn = section ? section.querySelector('[data-smooch-show-more]') : null;
    const initial = parseInt(list.dataset.initial, 10) || 6;
    const batch = parseInt(list.dataset.batch, 10) || 6;
    let visibleCount = initial;

    const getRows = () => Array.from(list.querySelectorAll('[data-smooch-review-row]'));

    const applyVisibility = () => {
      const rows = getRows();
      rows.forEach((row, i) => {
        row.hidden = i >= visibleCount;
      });
      if (moreBtn) moreBtn.hidden = visibleCount >= rows.length;
    };

    const applySort = (mode) => {
      const rows = getRows();
      const sorted = rows.slice().sort((a, b) => {
        if (mode === 'highest') return Number(b.dataset.rating) - Number(a.dataset.rating);
        if (mode === 'lowest') return Number(a.dataset.rating) - Number(b.dataset.rating);
        // "Most Recent" — demo fixtures have no real submission dates, so
        // this keeps the original (curated) block order.
        return Number(a.dataset.order) - Number(b.dataset.order);
      });
      sorted.forEach((row) => list.appendChild(row));
      applyVisibility();
    };

    applyVisibility();

    if (sortSelect) {
      sortSelect.addEventListener('change', () => applySort(sortSelect.value));
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        visibleCount += batch;
        applyVisibility();
      });
    }
  });
})();
