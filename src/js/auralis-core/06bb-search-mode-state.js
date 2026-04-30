/*
 * Auralis JS shard: 06bb-search-mode-state.js
 * Purpose: Library search activation and single-filter state helpers
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    let _searchDebounceTimer = null;
    let searchModeActive = false;
    let isSearchActive = false;
    let activeFilter = 'all';

    function normalizeSearchFilter(filter) {
        return ['all', 'songs', 'albums', 'artists'].includes(filter) ? filter : 'all';
    }

    function syncSearchFilterControls() {
        document.querySelectorAll('[data-filter]').forEach((chip) => {
            const filter = normalizeSearchFilter(chip.dataset.filter);
            const selected = filter === activeFilter;
            chip.classList.toggle('active', selected);
            chip.setAttribute('aria-selected', String(selected));
        });
    }
    window.syncSearchFilterControls = syncSearchFilterControls;

    function syncSearchFilterState(filter = activeFilter) {
        activeFilter = normalizeSearchFilter(filter);
        if (searchFilters && typeof searchFilters.clear === 'function') {
            searchFilters.clear();
            searchFilters.add(activeFilter);
        }
        syncSearchFilterControls();
    }

    function setSearchActive(next) {
        isSearchActive = Boolean(next);
        searchModeActive = isSearchActive;
    }

    function setSearchFilter(filter) {
        syncSearchFilterState(filter);
        persistSearchUiState();
        renderSearchState();
    }
    window.setSearchFilter = setSearchFilter;
