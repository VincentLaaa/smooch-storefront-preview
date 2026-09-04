/* Smooch full reviews: client-side sort (reorders already-rendered rows —
 * no re-fetch), a load-more batcher, and keyword search that filters the
 * rendered rows so shoppers can find reviews mentioning their specific
 * concern. All content is server-rendered Liquid; this just toggles which
 * rows are visible/in what order.
 */
(() => {
  if (window.smoochReviewsFullInitialized) return;
  window.smoochReviewsFullInitialized = true;
  const init = (root) => {
  const lists = root.querySelectorAll('[data-smooch-review-list]');
  if (!lists.length) return;

  lists.forEach((list) => {
    if (list.dataset.rfInitialized) return;
    list.dataset.rfInitialized = 'true';
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
    const starBtns = section ? Array.from(section.querySelectorAll('[data-rf-star]')) : [];
    let visibleCount = initial;
    let query = '';
    let starFilter = 0;

    const getRows = () => Array.from(list.querySelectorAll('[data-smooch-review-row]'));

    const applyVisibility = () => {
      const rows = getRows();
      const rowMatches = (row) => {
        if (starFilter && Math.round(Number(row.dataset.rating)) !== starFilter) return false;
        if (query && !(row.dataset.rfSearchText || '').toLowerCase().includes(query)) return false;
        return true;
      };
      if (query || starFilter) {
        // Filter mode (search and/or star rating): show every matching row,
        // batching suspended.
        let shown = 0;
        rows.forEach((row) => {
          const match = rowMatches(row);
          row.hidden = !match;
          if (match) shown += 1;
        });
        if (moreBtn) moreBtn.hidden = true;
        if (statusEl) {
          statusEl.hidden = false;
          const star = starFilter ? `${starFilter}-star ` : '';
          const mention = query ? ` mentioning “${query}”` : '';
          statusEl.textContent = `${shown} ${star}review${shown === 1 ? '' : 's'}${mention}`;
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
        chip.setAttribute('aria-pressed', String(chip.textContent.trim().toLowerCase() === query));
      });
    };

    const setQuery = (value) => {
      query = value.trim().toLowerCase();
      if (clearBtn) clearBtn.hidden = query === '';
      syncChips();
      applyVisibility();
      syncSuggestions();
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

    const syncStars = () => {
      starBtns.forEach((btn) => {
        const active = Number(btn.dataset.rfStar) === starFilter;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    starBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = Number(btn.dataset.rfStar);
        // Tapping the active row again clears the rating filter.
        starFilter = starFilter === value ? 0 : value;
        syncStars();
        applyVisibility();
      });
    });

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.textContent.trim();
        if (searchInput) searchInput.value = text;
        // Tapping the active chip again clears the search.
        setQuery(text.toLowerCase() === query ? '' : text);
        if (query === '' && searchInput) searchInput.value = '';
      });
    });

    // Suggestions are decorative placeholders, never text inserted into a search.
    const suggestion = section.querySelector('[data-rf-suggestion]');
    const searchBox = searchInput?.closest('.smooch-rf__search');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const prompts = ['Search', 'Low sex drive after children...', 'Is stress ruining my relationship?', 'More energy for the things I love...', 'Feeling more like myself again...'];
    let promptIndex = 0;
    let suggestionTimer = null;
    let searchVisible = false;
    function syncSuggestions() {
      if (!suggestion || !searchInput) return;
      clearInterval(suggestionTimer);
      suggestionTimer = null;
      const empty = !searchInput.value && document.activeElement !== searchInput;
      searchBox.toggleAttribute('data-suggestions', empty);
      if (!empty || reducedMotion.matches) {
        suggestion.textContent = 'Search';
        suggestion.classList.remove('is-entering');
        promptIndex = 0;
        return;
      }
      if (!searchVisible || document.hidden) return;
      suggestionTimer = setInterval(() => {
        promptIndex = (promptIndex + 1) % prompts.length;
        suggestion.textContent = prompts[promptIndex];
        suggestion.classList.remove('is-entering');
        void suggestion.offsetWidth;
        suggestion.classList.add('is-entering');
      }, 3400);
    }
    const searchObserver = searchBox && 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      searchVisible = entry.isIntersecting;
      syncSuggestions();
    }, { threshold: 0.2 }) : null;
    if (searchObserver) searchObserver.observe(searchBox);
    else searchVisible = true;
    searchInput?.addEventListener('focus', syncSuggestions);
    searchInput?.addEventListener('blur', syncSuggestions);
    searchInput?.addEventListener('input', syncSuggestions);
    document.addEventListener('visibilitychange', syncSuggestions);
    reducedMotion.addEventListener('change', syncSuggestions);
    section.querySelector('[data-rf-search-submit]')?.addEventListener('click', () => {
      setQuery(searchInput.value);
      searchInput.focus();
    });
    section.querySelector('[data-rf-reset]')?.addEventListener('click', () => {
      starFilter = 0;
      visibleCount = initial;
      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = 'recent';
      syncStars();
      setQuery('');
      applySort('recent');
    });
    syncSuggestions();

    const badges = [...section.querySelectorAll('[data-rf-verified]')];
    const showBadge = (badge, open) => {
      badge.querySelector('button').setAttribute('aria-expanded', String(open));
      badge.querySelector('.smooch-rf__verified-tip').hidden = !open;
    };
    badges.forEach((badge) => {
      const trigger = badge.querySelector('button');
      trigger.addEventListener('click', () => {
        const open = trigger.getAttribute('aria-expanded') !== 'true';
        badges.forEach(other => showBadge(other, false));
        showBadge(badge, open);
      });
      badge.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') showBadge(badge, true); });
      badge.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse' && !badge.contains(document.activeElement)) showBadge(badge, false); });
      badge.addEventListener('focusout', (event) => { if (!badge.contains(event.relatedTarget)) showBadge(badge, false); });
    });
    const dismissBadges = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      badges.forEach(badge => { if (event.type === 'keydown' || !badge.contains(event.target)) showBadge(badge, false); });
    };
    document.addEventListener('click', dismissBadges);
    document.addEventListener('keydown', dismissBadges);

    const dialog = section.querySelector('[data-rf-dialog]');
    section.querySelector('[data-rf-write]')?.addEventListener('click', () => dialog.showModal());
    section.querySelector('[data-rf-close]')?.addEventListener('click', () => dialog.close());
    if (dialog?.querySelector('[data-rf-form-result]')) dialog.showModal();

    // Device-local preference only; these are not aggregate provider vote totals.
    section.querySelectorAll('[data-rf-votes]').forEach(group => {
      const key = `smooch-review-feedback:${group.dataset.rfVotes}`;
      let vote = '';
      try { vote = localStorage.getItem(key) || ''; } catch (_) { /* Storage may be unavailable. */ }
      const buttons = [...group.querySelectorAll('button')];
      const syncVotes = () => buttons.forEach(button => {
        const selected = button.dataset.rfVote === vote;
        button.setAttribute('aria-pressed', String(selected));
        button.querySelector('span').textContent = selected ? '1' : '0';
      });
      buttons.forEach(button => button.addEventListener('click', () => {
        vote = vote === button.dataset.rfVote ? '' : button.dataset.rfVote;
        try { localStorage.setItem(key, vote); } catch (_) { /* The current page still reflects the choice. */ }
        syncVotes();
      }));
      syncVotes();
    });
    const unload = (event) => {
      if (!event.target.contains(section)) return;
      clearInterval(suggestionTimer);
      searchObserver?.disconnect();
      document.removeEventListener('visibilitychange', syncSuggestions);
      reducedMotion.removeEventListener('change', syncSuggestions);
      document.removeEventListener('click', dismissBadges);
      document.removeEventListener('keydown', dismissBadges);
      document.removeEventListener('shopify:section:unload', unload);
    };
    document.addEventListener('shopify:section:unload', unload);
  });
  };
  init(document);
  document.addEventListener('shopify:section:load', event => init(event.target));
})();
