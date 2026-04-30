    function getAlbumsGroupedByArtist(albums) {
        const groups = new Map();
        albums.forEach((album) => {
            const artist = getAlbumPrimaryArtistName(album, album.artist) || ARTIST_NAME;
            const key = toArtistKey(artist);
            if (!groups.has(key)) groups.set(key, { artist, albums: [] });
            groups.get(key).albums.push(album);
        });
        return Array.from(groups.values()).sort((a, b) => a.artist.localeCompare(b.artist));
    }

    function renderAlbumArtistCarouselGroups(container, albums, density = 'compact') {
        clearNodeChildren(container);
        appendFragment(container, getAlbumsGroupedByArtist(albums).map((group) => {
            const section = document.createElement('section');
            section.className = 'album-artist-carousel-row';
            const header = document.createElement('button');
            header.type = 'button';
            header.className = 'album-artist-carousel-title zenith-meta-link';
            header.textContent = group.artist;
            header.addEventListener('click', () => routeToArtistProfile(group.artist));
            const rail = document.createElement('div');
            rail.className = 'album-artist-carousel-rail';
            appendFragment(rail, group.albums.map(album => createCollectionTile('album', album, { density, forGrid: true, context: 'library' })));
            section.appendChild(header);
            section.appendChild(rail);
            return section;
        }));
    }

    function renderCollectionLibrarySection({ section, container, sourceItems, getSortedItems, emptyState, kind, limit = 12, renderCustom }) {
        if (!container) return;
        applyLibraryAppearance(section, container);
        clearNodeChildren(container);

        const config = getLibraryAppearanceConfig(section);
        const sortedItems = typeof getSortedItems === 'function'
            ? getSortedItems(config.sort)
            : (Array.isArray(sourceItems) ? sourceItems.slice() : []);
        if (!sortedItems.length) {
            if (typeof renderCustom === 'function' && renderCustom({ container, items: sortedItems, config }) === true) return;
            appendLibraryEmptyState(container, emptyState);
            return;
        }

        if (typeof renderCustom === 'function' && renderCustom({ container, items: sortedItems, config }) === true) return;

        const useCards = ['grid', 'carousel'].includes(config.mode);
        const visibleItems = sortedItems.slice(0, limit);
        appendFragment(container, visibleItems.map((item, idx) => {
            const node = useCards
                ? createCollectionTile(kind, item, { density: config.density, forGrid: true, context: 'library' })
                : createCollectionRow(kind, item, 'library');
            if (!useCards && idx === visibleItems.length - 1) node.style.border = 'none';
            return node;
        }));
    }

    function getLibraryScreenId(tab) {
        return 'library-screen-' + normalizeLibrarySection(tab);
    }

    function getLibrarySectionFromScreen(id) {
        const match = String(id || '').match(/^library-screen-(playlists|albums|artists|songs|genres|folders)$/);
        return match ? match[1] : '';
    }

    function switchLib(tab) {
        tab = normalizeLibrarySection(tab);
        if (typeof searchModeActive !== 'undefined' && searchModeActive && activeId === 'library') {
            if (typeof setSearchFilter === 'function') setSearchFilter(tab);
            return;
        }
        setUiPreference('libraryTab', tab);
        syncLibraryTabSemantics(tab);
        ensureChipVisibility(getEl('lib-btn-' + tab), 'center');
        if (tab === 'songs') syncLibrarySongSortState();
        if (tab === 'folders') renderFolderBrowserView();
        if (typeof exitSearchMode === 'function') exitSearchMode();

        const screenId = getLibraryScreenId(tab);
        if (activeId === screenId) return;
        if (activeId !== 'library' && !getLibrarySectionFromScreen(activeId)) {
            const libraryTab = findTabNavButton('library');
            switchTab('library', libraryTab);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                push(screenId);
                syncLibraryTabSemantics(tab);
            }));
            return;
        }
        push(screenId);
        syncLibraryTabSemantics(tab);
    }
    function appendEmptyMessage(container, message) {
        const box = document.createElement('div');
        box.className = 'home-section-empty';
        box.textContent = message;
        container.appendChild(box);
    }

    function getActiveLibraryTabName() {
        const activeScreenSection = getLibrarySectionFromScreen(activeId);
        if (activeScreenSection) return activeScreenSection;
        const activeButton = document.querySelector('#library-nav-container .library-nav-item.active[id^="lib-btn-"]');
        return activeButton?.dataset?.section || 'playlists';
    }

    function syncLibraryTabSemantics(tab = getActiveLibraryTabName()) {
        tab = normalizeLibrarySection(tab);
        LIBRARY_SECTIONS.forEach((name) => {
            const button = getEl('lib-btn-' + name);
            const screen = getEl(getLibraryScreenId(name));
            const isActive = name === tab;
            if (button) {
                button.classList.toggle('active', isActive);
                if (isActive) button.setAttribute('aria-current', 'page');
                else button.removeAttribute('aria-current');
            }
            if (screen) {
                screen.setAttribute('aria-hidden', String(activeId !== getLibraryScreenId(name)));
            }
        });
    }

    function ensureChipVisibility(button, inline = 'nearest') {
        if (!button || typeof button.scrollIntoView !== 'function') return;
        const row = button.closest('.filter-row, .library-nav-list');
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const isVerticalList = row.classList.contains('library-nav-list');
        const needsScroll = isVerticalList
            ? buttonRect.top < rowRect.top + 12 || buttonRect.bottom > rowRect.bottom - 12
            : buttonRect.left < rowRect.left + 12 || buttonRect.right > rowRect.right - 12;
        if (!needsScroll) return;
        requestAnimationFrame(() => {
            try {
                button.scrollIntoView({ block: 'nearest', inline, behavior: 'smooth' });
            } catch (_) {
                button.scrollIntoView();
            }
        });
    }

    function syncLibrarySongSortState() {
        const row = getEl('lib-songs-sort-row');
        if (!row) return;
        row.setAttribute('role', 'tablist');
        let activeButton = null;
        row.querySelectorAll('.filter-chip').forEach((button) => {
            const isActive = button.dataset.sort === libSongsSortMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(isActive));
            button.setAttribute('tabindex', isActive ? '0' : '-1');
            if (isActive) activeButton = button;
        });
        ensureChipVisibility(activeButton, 'center');
    }

    function appendLibraryPlaylistEmptyState(container) {
        const box = createScreenEmptyState({
            className: 'screen-empty-state library-empty-state',
            title: 'No playlists',
            body: 'Create or import one.',
            iconName: 'listMusic'
        });
        box.querySelector('.screen-empty-title')?.classList.add('library-empty-title');
        box.querySelector('.screen-empty-copy')?.classList.add('library-empty-copy');

        const actions = document.createElement('div');
        actions.className = 'library-empty-actions';

        const createButton = document.createElement('button');
        createButton.type = 'button';
        createButton.className = 'library-empty-action primary';
        createButton.dataset.action = 'openCreatePlaylistDialog';
        createButton.textContent = 'Create Playlist';

        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.className = 'library-empty-action';
        importButton.dataset.action = 'importM3U';
        importButton.textContent = 'Import M3U';

        actions.appendChild(createButton);
        actions.appendChild(importButton);
        box.appendChild(actions);
        container.appendChild(box);
    }

    function appendLibraryEmptyState(container, { title, body, iconName }) {
        const box = createScreenEmptyState({
            className: 'screen-empty-state library-empty-state',
            title,
            body,
            iconName
        });
        box.querySelector('.screen-empty-title')?.classList.add('library-empty-title');
        box.querySelector('.screen-empty-copy')?.classList.add('library-empty-copy');
        container.appendChild(box);
    }

    let libSongsSortMode = 'alpha';
    const LIBRARY_SONG_INITIAL_RENDER = 80;
    const LIBRARY_SONG_RENDER_CHUNK = 120;
    let librarySongRenderToken = 0;
    let librarySongObserver = null;
