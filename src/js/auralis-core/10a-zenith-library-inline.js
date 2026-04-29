/*
 * Auralis JS shard: 10a-zenith-library-inline.js
 * Purpose: inline library tab/list compatibility
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function getInlineLibraryListConfig(section) {
        return {
            ...getLibraryAppearanceConfig(section),
            mode: 'list',
            columns: 1,
            density: 'compact',
            groupByArtist: false
        };
    }

    function getActiveInlineLibraryTabName() {
        const activeButton = document.querySelector('#lib-tabs-container [id^="lib-btn-"].active');
        return activeButton?.dataset?.section || getUiPreference('libraryTab', '') || 'playlists';
    }

    function syncInlineLibraryView(tab = getActiveInlineLibraryTabName()) {
        tab = normalizeLibrarySection(tab);
        LIBRARY_SECTIONS.forEach((name) => {
            const isActive = name === tab;
            const button = getEl('lib-btn-' + name);
            const panel = getEl('lib-view-' + name);
            if (button) {
                button.classList.toggle('active', isActive);
                button.setAttribute('role', 'tab');
                button.setAttribute('aria-selected', String(isActive));
                button.setAttribute('tabindex', isActive ? '0' : '-1');
                button.setAttribute('aria-controls', 'lib-view-' + name);
            }
            if (panel) {
                panel.style.display = isActive ? 'block' : 'none';
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', 'lib-btn-' + name);
            }
        });
        if (tab === 'songs') syncLibrarySongSortState();
        if (tab === 'folders') renderFolderBrowserView();
    }

    function syncActiveLibraryInlineView() {
        syncInlineLibraryView(getActiveInlineLibraryTabName());
    }
