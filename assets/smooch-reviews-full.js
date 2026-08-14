/* Smooch full reviews: client-side sort (reorders already-rendered rows —
 * no re-fetch), a load-more batcher, and keyword search that filters the
 * rendered rows so shoppers can find reviews mentioning their specific
 * concern. All content is server-rendered Liquid; this just toggles which
 * rows are visible/in what order.
 */
(() => {
  const lists = document.querySelectorAll('[data-smooch-review-list]');
  if (!lists.length) return;

  lists.forEach((list) => {
    const section = list.closest('.smooch-rf');
    const sortSelect = section ? section.querySelector('[data-smooch-sort]') : null;
    const moreBtn = section ? section.querySelector('[data-smooch-show-more]') : null;
    const searchInput = section ? section.querySelector('[data-smooch-review-search]') : null;
    const clearBtn = section ? section.querySelector('[data-smooch-search-clear]') : null;
    const statusEl = section ? section.querySelector('[data-smooch-search-status]') : null;
    const emptyEl = section ? section.querySelector('[data-smooch-search-empty]') : null;
    const chips = section ? Array.from(section.querySelectorAll('[data-smooch-search-chip]')) : [];
    const initial = parseInt(list.dataset.initial, 10) || 6;
    const batch = parseInt(list.dataset.batch, 10) || 6;
    let visibleCount = initial;
    let query = '';

    const getRows = () => Array.from(list.querySelectorAll('[data-smooch-review-row]'));

    const applyVisibility = () => {
      const rows = getRows();
      if (query) {
        // Search mode: show every matching row (batching suspended).
        let shown = 0;
        rows.forEach((row) => {
          const match = (row.textContent || '').toLowerCase().includes(query);
          row.hidden = !match;
          if (match) shown += 1;
        });
        if (moreBtn) moreBtn.hidden = true;
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = `${shown} review${shown === 1 ? '' : 's'} mentioning “${query}”`;
        }
        if (emptyEl) emptyEl.hidden = shown > 0;
      } else {
        rows.forEach((row, i) => {
          row.hidden = i >= visibleCount;
        });
        if (moreBtn) moreBtn.hidden = visibleCount >= rows.length;
        if (statusEl) statusEl.hidden = true;
        if (emptyEl) emptyEl.hidden = true;
      }
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

    const syncChips = () => {
      chips.forEach((chip) => {
        chip.classList.toggle('is-active', chip.textContent.trim().toLowerCase() === query);
      });
    };

    const setQuery = (value) => {
      query = value.trim().toLowerCase();
      if (clearBtn) clearBtn.hidden = query === '';
      syncChips();
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

    if (searchInput) {
      let debounce = null;
      searchInput.addEventListener('input', () => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(() => setQuery(searchInput.value), 150);
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        setQuery('');
        searchInput.focus();
      });
    }

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.textContent.trim();
        if (searchInput) searchInput.value = text;
        // Tapping the active chip again clears the search.
        setQuery(text.toLowerCase() === query ? '' : text);
        if (query === '' && searchInput) searchInput.value = '';
      });
    });
  });
})();
