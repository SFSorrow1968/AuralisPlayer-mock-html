/*
 * Auralis JS shard: 10-zenith-library-views.js
 * Purpose: favorites, artist, search, sidebar, library render refresh
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    const LIBRARY_SECTIONS = ['playlists', 'albums', 'artists', 'songs', 'genres', 'folders'];
    const LIBRARY_APPEARANCE_MODES = ['list', 'grid', 'carousel'];
    const LIBRARY_DENSITY_MODES = ['compact', 'large'];
    const LIBRARY_SORT_MODES = ['most_played', 'recent', 'forgotten'];
    const LIBRARY_GRID_COLUMN_OPTIONS = [1, 2, 3];
    const LIBRARY_APPEARANCE_GROUPS = ['view', 'size', 'columns', 'sort', 'group'];
    const LIBRARY_COLLECTION_LAYOUT_CLASSES = LIBRARY_APPEARANCE_MODES.map(mode => `library-view-${mode}`).concat(['library-view-compact', 'library-view-two-row']);
    let libraryEditMode = false;
    const categoryAppearanceEditModes = new Set();

    function normalizeLibrarySection(tab) {
        return LIBRARY_SECTIONS.includes(tab) ? tab : 'playlists';
    }

    function getLibraryCategoryOrder() {
        const stored = getUiPreference('libraryCategoryOrder', []);
        const order = Array.isArray(stored) ? stored.filter(section => LIBRARY_SECTIONS.includes(section)) : [];
        return order.concat(LIBRARY_SECTIONS).filter((section, index, list) => list.indexOf(section) === index);
    }

    function persistLibraryCategoryOrder(order) {
        setUiPreference('libraryCategoryOrder', order.filter(section => LIBRARY_SECTIONS.includes(section)));
    }

    function getLibraryAppearancePrefs() {
        const prefs = getUiPreference('libraryAppearance', {});
        return prefs && typeof prefs === 'object' ? prefs : {};
    }

    function getDefaultLibraryAppearance(section) {
        section = normalizeLibrarySection(section);
        return {
            mode: (section === 'albums' || section === 'genres') ? 'grid' : 'list',
            columns: section === 'artists' ? 2 : 2,
            density: 'compact',
            sort: 'most_played',
            groupByArtist: section === 'albums'
        };
    }

    function normalizeLibraryGridColumns(value, fallback = 2) {
        const numeric = Math.round(Number(value));
        if (LIBRARY_GRID_COLUMN_OPTIONS.includes(numeric)) return numeric;
        return fallback;
    }

    function normalizeLibraryCollapsedGroups(value) {
        return Array.isArray(value)
            ? value.filter(group => LIBRARY_APPEARANCE_GROUPS.includes(group))
            : [];
    }

    function getLibraryAppearanceConfig(section) {
        section = normalizeLibrarySection(section);
        const prefs = getLibraryAppearancePrefs();
        const raw = prefs[section] && typeof prefs[section] === 'object' ? prefs[section] : {};
        const defaults = getDefaultLibraryAppearance(section);
        let mode = raw.mode || defaults.mode;
        if (mode === 'compact' || mode === 'twoRow') mode = section === 'albums' ? 'carousel' : 'grid';
        if (!LIBRARY_APPEARANCE_MODES.includes(mode)) mode = defaults.mode;
        const columns = normalizeLibraryGridColumns(raw.columns, defaults.columns);
        const density = LIBRARY_DENSITY_MODES.includes(raw.density) ? raw.density : defaults.density;
        const sort = LIBRARY_SORT_MODES.includes(raw.sort) ? raw.sort : defaults.sort;
        return {
            mode,
            columns,
            density,
            sort,
            groupByArtist: raw.groupByArtist == null ? defaults.groupByArtist : Boolean(raw.groupByArtist),
            collapsedGroups: normalizeLibraryCollapsedGroups(raw.collapsedGroups)
        };
    }

    function setLibraryAppearanceGroupCollapsed(section, groupKey, collapsed) {
        section = normalizeLibrarySection(section);
        if (!LIBRARY_APPEARANCE_GROUPS.includes(groupKey)) return;
        const prefs = getLibraryAppearancePrefs();
        const config = getLibraryAppearanceConfig(section);
        const nextCollapsed = new Set(config.collapsedGroups);
        if (collapsed) nextCollapsed.add(groupKey);
        else nextCollapsed.delete(groupKey);
        prefs[section] = { ...config, collapsedGroups: Array.from(nextCollapsed) };
        setUiPreference('libraryAppearance', prefs);
    }

    function buildSettingsGroup({ label, groupKey, collapsedGroups, onToggle }) {
        const group = document.createElement('details');
        group.className = 'settings-choice-group library-appearance-group';
        group.open = !collapsedGroups.includes(groupKey);

        const summary = document.createElement('summary');
        summary.className = 'settings-choice-label library-appearance-label';
        const title = document.createElement('span');
        title.textContent = label;
        const state = document.createElement('span');
        state.className = 'settings-choice-chevron library-appearance-chevron';
        state.setAttribute('aria-hidden', 'true');
        state.textContent = group.open ? '-' : '+';
        summary.append(title, state);

        const options = document.createElement('div');
        options.className = 'settings-choice-options library-appearance-options';
        group.append(summary, options);
        group.addEventListener('toggle', () => {
            state.textContent = group.open ? '-' : '+';
            if (typeof onToggle === 'function') onToggle(groupKey, !group.open);
        });
        return { group, options };
    }

    function appendSettingsChoice(container, { label = '', title, icon = '', active = false, onClick }) {
        if (!container) return null;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `settings-choice library-appearance-choice${active ? ' active' : ''}`;
        if (!icon) btn.classList.add('is-text');
        btn.title = title;
        btn.setAttribute('aria-label', title);
        btn.innerHTML = icon ? getIconSvg(icon) : `<span>${label}</span>`;
        btn.addEventListener('click', onClick);
        container.appendChild(btn);
        return btn;
    }

    function renderSettingsToolbar(toolbar, groups, collapsedGroups, onToggle) {
        if (!toolbar) return;
        toolbar.replaceChildren();
        groups.forEach((groupConfig) => {
            const { group, options } = buildSettingsGroup({
                label: groupConfig.label,
                groupKey: groupConfig.key,
                collapsedGroups,
                onToggle
            });
            toolbar.appendChild(group);
            groupConfig.choices.forEach(choice => appendSettingsChoice(options, choice));
        });
    }

    function getLibraryHiddenCategories() {
        const prefs = getUiPreference('libraryHiddenCategories', []);
        return new Set(Array.isArray(prefs) ? prefs.filter(section => LIBRARY_SECTIONS.includes(section)) : []);
    }

    function setLibraryCategoryHidden(section, hidden) {
        section = normalizeLibrarySection(section);
        const next = getLibraryHiddenCategories();
        if (hidden) next.add(section);
        else next.delete(section);
        if (next.size >= LIBRARY_SECTIONS.length) next.delete(section);
        setUiPreference('libraryHiddenCategories', Array.from(next));
        syncLibraryCategoryOrder();
    }

    function getLibraryAppearanceMode(section) {
        return getLibraryAppearanceConfig(section).mode;
    }

    function setLibraryAppearanceOption(section, patch) {
        section = normalizeLibrarySection(section);
        const prefs = getLibraryAppearancePrefs();
        prefs[section] = { ...getLibraryAppearanceConfig(section), ...(patch || {}) };
        setUiPreference('libraryAppearance', prefs);
        renderLibraryViews({ force: true });
    }

    function setLibraryAppearance(section, mode) {
        if (!LIBRARY_APPEARANCE_MODES.includes(mode)) return;
        setLibraryAppearanceOption(section, { mode });
    }

    function moveLibraryCategory(section, delta) {
        const order = getLibraryCategoryOrder();
        const index = order.indexOf(normalizeLibrarySection(section));
        const nextIndex = index + Number(delta || 0);
        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
        const [item] = order.splice(index, 1);
        order.splice(nextIndex, 0, item);
        persistLibraryCategoryOrder(order);
        syncLibraryCategoryOrder();
    }

    function toggleLibraryEditMode() {
        libraryEditMode = !libraryEditMode;
        renderLibraryViews({ force: true });
    }

    function toggleCategoryAppearanceEdit(section) {
        section = normalizeLibrarySection(section);
        if (categoryAppearanceEditModes.has(section)) categoryAppearanceEditModes.delete(section);
        else categoryAppearanceEditModes.add(section);
        renderLibraryViews({ force: true });
    }

    function toggleLibraryTopEditMode() {
        if (typeof searchModeActive !== 'undefined' && searchModeActive && typeof toggleSearchWorkspaceEdit === 'function') {
            libraryEditMode = false;
            syncLibraryCategoryOrder();
            toggleSearchWorkspaceEdit();
            ensureLibraryEditControls();
            return;
        }
        toggleLibraryEditMode();
    }

    function syncLibraryCategoryOrder() {
        const nav = getEl('library-nav-container');
        const library = getEl('library');
        if (!nav) return;
        const hidden = getLibraryHiddenCategories();
        const navEditing = libraryEditMode && !(typeof searchModeActive !== 'undefined' && searchModeActive);
        getLibraryCategoryOrder().forEach(section => {
            const button = getEl(`lib-btn-${section}`);
            if (button) nav.appendChild(button);
        });
        nav.classList.toggle('is-editing', navEditing);
        if (library) library.classList.toggle('library-edit-mode', navEditing);
        nav.querySelectorAll('.library-nav-item').forEach((button) => {
            const section = normalizeLibrarySection(button.dataset.section);
            const isHidden = hidden.has(section);
            button.classList.toggle('is-hidden-category', isHidden);
            button.hidden = isHidden && !navEditing;
            let actions = button.querySelector('.library-nav-edit-actions');
            if (!navEditing) {
                actions?.remove();
                return;
            }
            actions?.remove();
            actions = document.createElement('span');
            actions.className = 'library-nav-edit-actions';
            [
                ['Move earlier', 'up', () => moveLibraryCategory(button.dataset.section, -1)],
                ['Move later', 'down', () => moveLibraryCategory(button.dataset.section, 1)],
                [isHidden ? 'Show category' : 'Hide category', isHidden ? 'open' : 'trash', () => setLibraryCategoryHidden(button.dataset.section, !isHidden)]
            ].forEach(([label, icon, handler]) => {
                const action = document.createElement('button');
                action.type = 'button';
                action.setAttribute('aria-label', label);
                action.innerHTML = getIconSvg(icon);
                action.addEventListener('click', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    handler();
                });
                actions.appendChild(action);
            });
            button.appendChild(actions);
        });
    }

    function ensureLibraryEditControls() {
        const topBar = document.querySelector('#library .top-bar');
        const createBtn = topBar?.querySelector('.library-create-btn');
        if (!topBar || !createBtn) return;
        let editBtn = getEl('library-edit-toggle-btn');
        if (!editBtn) {
            editBtn = document.createElement('button');
            editBtn.id = 'library-edit-toggle-btn';
            editBtn.type = 'button';
            editBtn.className = 'icon-btn library-edit-toggle-btn';
            editBtn.dataset.action = 'toggleLibraryTopEditMode';
            topBar.insertBefore(editBtn, createBtn);
        }
        const searchEditing = typeof searchModeActive !== 'undefined' && searchModeActive && typeof searchWorkspaceEditing !== 'undefined' && searchWorkspaceEditing;
        const isActive = searchEditing || libraryEditMode;
        editBtn.classList.toggle('active', isActive);
        editBtn.title = isActive ? 'Finish editing' : 'Edit library';
        editBtn.setAttribute('aria-label', editBtn.title);
        editBtn.innerHTML = getIconSvg(isActive ? 'source' : 'manage');
    }

    function ensureAppearanceToolbar(section) {
        const screen = getEl(getLibraryScreenId(section));
        const topBar = screen?.querySelector('.top-bar');
        if (!screen || !topBar) return;
        let editBtn = screen.querySelector('.category-appearance-edit-btn');
        if (!editBtn) {
            editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'icon-btn category-appearance-edit-btn';
            editBtn.setAttribute('aria-label', 'Edit view appearance');
            topBar.appendChild(editBtn);
        }
        const isEditing = categoryAppearanceEditModes.has(section);
        editBtn.classList.toggle('active', isEditing);
        editBtn.title = isEditing ? 'Finish view settings' : 'View settings';
        editBtn.setAttribute('aria-label', editBtn.title);
        editBtn.innerHTML = getIconSvg('tune');
        editBtn.onclick = () => toggleCategoryAppearanceEdit(section);
        let toolbar = screen.querySelector('.library-appearance-toolbar');
        if (!isEditing) {
            toolbar?.remove();
            return;
        }
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'settings-choice-toolbar library-appearance-toolbar';
            topBar.insertAdjacentElement('afterend', toolbar);
        }
        const config = getLibraryAppearanceConfig(section);
        const groups = [{
            key: 'view',
            label: 'View',
            choices: LIBRARY_APPEARANCE_MODES.map(mode => ({
                title: `${section} ${mode} view`,
                icon: mode === 'grid' ? 'grid' : mode === 'carousel' ? 'carousel' : 'listMusic',
                active: config.mode === mode,
                onClick: () => setLibraryAppearance(section, mode)
            }))
        }];
        if (['grid', 'carousel'].includes(config.mode)) {
            groups.push({
                key: 'size',
                label: 'Size',
                choices: [
                    ['compact', 'S'],
                    ['large', 'L']
                ].map(([density, label]) => ({
                    label,
                    title: `${section} ${density} cards`,
                    active: config.density === density,
                    onClick: () => setLibraryAppearanceOption(section, { density })
                }))
            });
        }

        if (config.mode === 'grid') {
            groups.push({
                key: 'columns',
                label: 'Columns',
                choices: LIBRARY_GRID_COLUMN_OPTIONS.map(columns => ({
                    label: String(columns),
                    title: `${columns} column${columns === 1 ? '' : 's'}`,
                    active: config.columns === columns,
                    onClick: () => setLibraryAppearanceOption(section, { columns })
                }))
            });
        }

        if (['albums', 'artists', 'playlists'].includes(section)) {
            groups.push({
                key: 'sort',
                label: 'Sort',
                choices: [
                    ['most_played', 'Plays'],
                    ['recent', 'Recent'],
                    ['forgotten', 'Old']
                ].map(([sort, label]) => ({
                    label,
                    title: `${section} sorted by ${label.toLowerCase()}`,
                    active: config.sort === sort,
                    onClick: () => setLibraryAppearanceOption(section, { sort })
                }))
            });
        }

        if (section === 'albums' && config.mode === 'carousel') {
            groups.push({
                key: 'group',
                label: 'Group',
                choices: [{
                    label: 'Artist',
                    title: 'Group albums by artist',
                    active: config.groupByArtist,
                    onClick: () => setLibraryAppearanceOption(section, { groupByArtist: !config.groupByArtist })
                }]
            });
        }

        renderSettingsToolbar(
            toolbar,
            groups,
            config.collapsedGroups,
            (groupKey, collapsed) => setLibraryAppearanceGroupCollapsed(section, groupKey, collapsed)
        );
    }

    function applyLibraryAppearance(section, container) {
        if (!container) return;
        const config = getLibraryAppearanceConfig(section);
        const mode = config.mode;
        container.dataset.appearance = mode;
        container.dataset.density = config.density;
        container.style.setProperty('--library-grid-columns', String(config.columns));
        container.classList.remove(...LIBRARY_COLLECTION_LAYOUT_CLASSES);
        container.classList.add(`library-view-${mode}`);
        container.classList.toggle('library-artist-carousel-groups', section === 'albums' && mode === 'carousel' && config.groupByArtist);
    }

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

    function scheduleLibrarySongWork(task) {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(task, { timeout: 160 });
        } else {
            requestAnimationFrame(task);
        }
    }

    function renderLibrarySongWindow(container, tracks) {
        librarySongRenderToken++;
        const token = librarySongRenderToken;
        if (librarySongObserver) {
            librarySongObserver.disconnect();
            librarySongObserver = null;
        }
        clearNodeChildren(container);
        container.dataset.virtualized = tracks.length > LIBRARY_SONG_INITIAL_RENDER ? 'true' : 'false';

        if (!tracks.length) {
            appendLibraryEmptyState(container, {
                title: 'No songs',
                body: 'Add music to fill this view.',
                iconName: 'music'
            });
            return;
        }

        let cursor = 0;
        const status = document.createElement('div');
        status.className = 'library-virtual-status';

        const appendChunk = () => {
            if (token !== librarySongRenderToken) return;
            const oldSentinel = container.querySelector('.library-virtual-sentinel');
            if (oldSentinel) oldSentinel.remove();

            const end = Math.min(
                tracks.length,
                cursor === 0 ? LIBRARY_SONG_INITIAL_RENDER : cursor + LIBRARY_SONG_RENDER_CHUNK
            );
            const frag = document.createDocumentFragment();
            for (let idx = cursor; idx < end; idx++) {
                const row = createLibrarySongRow(tracks[idx], true, {
                    compact: true,
                    hideAlbum: false,
                    showDuration: true,
                    metaContext: 'library'
                });
                if (idx === tracks.length - 1) row.style.border = 'none';
                frag.appendChild(row);
            }
            cursor = end;
            container.appendChild(frag);

            if (tracks.length > LIBRARY_SONG_INITIAL_RENDER) {
                status.textContent = `Showing ${cursor} of ${tracks.length} songs`;
                container.appendChild(status);
            }

            if (cursor < tracks.length) {
                const sentinel = document.createElement('button');
                sentinel.type = 'button';
                sentinel.className = 'library-virtual-sentinel';
                sentinel.textContent = 'Show more songs';
                sentinel.addEventListener('click', () => scheduleLibrarySongWork(appendChunk));
                container.appendChild(sentinel);
                if ('IntersectionObserver' in window) {
                    librarySongObserver = new IntersectionObserver((entries) => {
                        if (entries.some(entry => entry.isIntersecting)) scheduleLibrarySongWork(appendChunk);
                    }, { rootMargin: '600px 0px' });
                    librarySongObserver.observe(sentinel);
                }
            } else if (librarySongObserver) {
                librarySongObserver.disconnect();
                librarySongObserver = null;
            }

            scheduleTitleMotion(container);
        };

        appendChunk();
    }

    function switchLibSongsSort(mode) {
        libSongsSortMode = mode || 'alpha';
        syncLibrarySongSortState();
        const songsList = getEl('lib-songs-list');
        if (!songsList) return;
        renderLibrarySongWindow(songsList, getSortedTracks(libSongsSortMode));
    }

    let _libraryMetadataSubscriberBound = false;
    function bindLibraryMetadataSubscriber() {
        if (_libraryMetadataSubscriberBound) return;
        _libraryMetadataSubscriberBound = true;
        APP_STATE.on('library:metadata-refined', ({ trackKey: refinedTrackKey, previousTrackKey, albumKey: refinedAlbumKey }) => {
            const candidateKeys = [previousTrackKey, refinedTrackKey].filter(Boolean);
            const track = trackByKey.get(refinedTrackKey) || candidateKeys.map((key) => trackByKey.get(key)).find(Boolean);
            if (!track) return;
            const resolvedTrackKey = getTrackIdentityKey(track);

            candidateKeys.forEach((candidateKey) => {
                getTrackUiBindings(candidateKey).forEach((binding) => {
                    if (binding?.row) {
                        binding.row.dataset.trackKey = resolvedTrackKey;
                        binding.row.dataset.trackId = getStableTrackIdentity(track);
                        binding.row.dataset.metadataQuality = getTrackMetadataQuality(track);
                    }
                    if (binding?.click) {
                        binding.click.dataset.trackKey = resolvedTrackKey;
                        binding.click.dataset.trackId = getStableTrackIdentity(track);
                        binding.click.dataset.title = track.title;
                        binding.click.dataset.artist = track.artist;
                        binding.click.dataset.album = track.albumTitle;
                    }
                    const titleTrack = binding?.title?.querySelector('.zenith-title-track');
                    if (titleTrack) titleTrack.textContent = track.title || '';
                    (binding?.durations || []).forEach((timeEl) => {
                        if (!timeEl) return;
                        timeEl.dataset.originalDuration = getTrackDurationDisplay(track);
                        if (!(binding?.row?.classList?.contains('playing-row'))) {
                            timeEl.textContent = timeEl.dataset.originalDuration;
                        }
                    });
                    (binding?.arts || []).forEach((artEl) => applyArtBackground(artEl, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track')));
                    unregisterTrackUi(candidateKey, binding);
                    registerTrackUi(resolvedTrackKey, binding);
                });
            });

            document.querySelectorAll('.media-card[data-album-key], .list-item[data-album-key]').forEach((el) => {
                if (String(el.dataset.albumKey || '') !== String(refinedAlbumKey || '')) return;
                const artTarget = el.querySelector('.media-cover, .item-icon');
                if (artTarget) applyArtBackground(artTarget, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
            });
            scheduleTitleMotion(document);
        });
    }

    // ── Artist Profile Section System ────────────────────────────────────────

    function saveArtistProfileLayout() {
        safeStorage.setJson(STORAGE_KEYS.artistProfileLayout, artistProfileSections);
    }

    function loadArtistProfileLayout() {
        const raw = safeStorage.getJson(STORAGE_KEYS.artistProfileLayout, null);
        if (!Array.isArray(raw) || !raw.length) {
            artistProfileSections = getDefaultArtistProfileSections();
        } else {
            // Merge saved sections with defaults (ensure all core sections exist)
            const defaults = getDefaultArtistProfileSections();
            artistProfileSections = raw.map(s => ({ ...s }));
            defaults.forEach(def => {
                if (!artistProfileSections.find(s => s.id === def.id)) {
                    artistProfileSections.push(def);
                }
            });
        }
    }

    function getArtistSectionItems(section, artistName) {
        const key = toArtistKey(artistName || '');
        const limit = Math.max(1, Number(section.limit || 8));
        let items = [];
        if (section.type === 'artist_top_songs' || section.itemType === 'songs') {
            items = LIBRARY_TRACKS
                .filter(t => toArtistKey(getCanonicalTrackArtistName(t)) === key)
                .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
        } else {
            items = LIBRARY_ALBUMS
                .filter(album => toArtistKey(album.artist) === key)
                .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
        }
        return items.slice(0, limit);
    }

    function updateArtistSection(sectionId, patch) {
        const idx = artistProfileSections.findIndex(s => s.id === sectionId);
        if (idx < 0) return;
        const next = { ...artistProfileSections[idx], ...patch };
        if (next.itemType === 'songs') next.layout = ensureSongLayoutForDensity(next.layout, next.density);
        artistProfileSections[idx] = next;
        saveArtistProfileLayout();
        renderArtistProfileSections(viewedArtistName || activeArtistName);
    }

    function showArtistSectionConfigMenu(sectionId) {
        const section = artistProfileSections.find(s => s.id === sectionId);
        if (!section) return;
        const nextDensity = section.density === 'compact' ? 'large' : 'compact';
        const layoutLabels = { list: 'Track Column', carousel: 'Carousel', grid: 'Poster Grid' };
        const layoutOptions = section.itemType === 'songs'
            ? [{ value: 'list', label: 'Track Column' }, { value: 'carousel', label: 'Carousel' }]
            : [{ value: 'list', label: 'Track Column' }, { value: 'carousel', label: 'Carousel' }, { value: 'grid', label: 'Poster Grid' }];
        const countOptions = [4, 5, 6, 8, 10, 12, 16, 20, 25];

        presentActionSheet(`${section.title} Settings`, 'Artist section controls', [
            {
                label: `Presentation (${layoutLabels[section.layout] || section.layout})`,
                description: 'Switch between list, carousel, and grid.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => {
                    const actions = layoutOptions.map(opt => ({
                        label: opt.label,
                        icon: opt.value === 'carousel' ? 'carousel' : opt.value === 'grid' ? 'grid' : 'stack',
                        onSelect: () => updateArtistSection(sectionId, { layout: opt.value })
                    }));
                    presentActionSheet('Presentation Mode', section.title, actions);
                }
            },
            {
                label: `Item Count (${section.limit})`,
                description: 'How many items to show.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => {
                    const actions = countOptions.map(n => ({
                        label: `${n} items`,
                        icon: 'stack',
                        onSelect: () => updateArtistSection(sectionId, { limit: n })
                    }));
                    presentActionSheet('Item Count', section.title, actions);
                }
            },
            {
                label: `Density: ${section.density} → ${nextDensity}`,
                description: 'Compact boosts scan speed; large emphasises artwork.',
                icon: 'density',
                onSelect: () => {
                    const patch = { density: nextDensity };
                    if (section.itemType === 'songs') patch.layout = ensureSongLayoutForDensity(section.layout, nextDensity);
                    updateArtistSection(sectionId, patch);
                }
            }
        ]);
    }

    function openArtistProfileSectionMenu() {
        const actions = artistProfileSections.map(s => ({
            label: s.title,
            description: `${s.limit} items · ${s.layout} · ${s.density}`,
            icon: 'manage',
            keepOpen: true,
            onSelect: () => showArtistSectionConfigMenu(s.id)
        }));
        presentActionSheet('Artist Page Sections', 'Tap a section to configure it', actions);
    }

    function renderArtistProfileSections(artistName) {
        const root = getEl('artist-sections-root');
        if (!root || !artistName) return;
        clearNodeChildren(root);

        const visible = artistProfileSections.filter(s => s.enabled !== false);
        const blocks = [];
        visible.forEach(section => {
            const items = getArtistSectionItems(section, artistName);
            if (!items.length) return;

            const block = document.createElement('div');
            block.className = 'home-section';
            block.dataset.sectionId = section.id;

            const header = document.createElement('div');
            header.className = 'section-header';
            const left = document.createElement('div');
            left.className = 'section-header-left';
            const titleWrap = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.textContent = section.title;
            titleWrap.appendChild(h2);
            left.appendChild(titleWrap);
            bindLongPressAction(left, () => showArtistSectionConfigMenu(section.id));
            header.appendChild(left);
            block.appendChild(header);
            block.appendChild(createHomeSectionContent(section, items));
            blocks.push(block);
        });
        appendFragment(root, blocks);

        scheduleTitleMotion(root);
    }

    function renderArtistProfileView() {
        const artistScreen = getEl('artist_profile');
        if (!artistScreen) return;
        const fallback = LIBRARY_ARTISTS[0]?.name || ARTIST_NAME;
        const selected = viewedArtistName || activeArtistName || fallback;
        const selectedKey = toArtistKey(selected);
        const fallbackKey = toArtistKey(fallback);
        const artist = artistByKey.get(selectedKey)
            || LIBRARY_ARTISTS.find((entry) => toArtistKey(entry?.name) === selectedKey)
            || artistByKey.get(fallbackKey)
            || LIBRARY_ARTISTS.find((entry) => toArtistKey(entry?.name) === fallbackKey);
        if (!artist) return;
        viewedArtistName = artist.name;

        applyArtBackground(artistScreen.querySelector('.artist-bg'), artist.artUrl, getStableArtworkFallback(artist.name, 'artist'));
        const nameEl = getEl('art-name');
        if (nameEl) {
            nameEl.textContent = artist.name;
            nameEl.title = artist.name;
        }
        const metaEl = getEl('art-meta');
        if (metaEl) {
            const summary = getArtistSummary(artist.name);
            const albumLabel = `${summary.albumCount} album${summary.albumCount === 1 ? '' : 's'}`;
            const trackLabel = `${summary.trackCount} track${summary.trackCount === 1 ? '' : 's'}`;
            metaEl.textContent = `${albumLabel} • ${trackLabel}`;
            metaEl.title = metaEl.textContent;
        }

        renderArtistProfileSections(artist.name);
    }

    function renderSearchBrowseGrid() {
        const grid = getEl('search-cat-grid');
        if (!grid) return;
        clearNodeChildren(grid);
        const cards = getSortedAlbums('recent').slice(0, 8).map((album, idx) => {
            const card = document.createElement('div');
            card.className = 'cat-card';
            card.draggable = true;
            card.dataset.added = String(Math.max(1, 100 - idx));
            card.dataset.plays = String(Number(album.plays || 0));
            card.dataset.duration = String(album.tracks?.[0]?.durationSec || 0);
            card.dataset.albumTitle = album.title;
            applyArtBackground(card, album.artUrl, getStableArtworkFallback(album.title || album.id, 'album'));
            if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, card);
            card.style.border = '1px solid rgba(255,255,255,0.2)';
            card.onclick = () => routeToAlbum(album.title, album.artist, getAlbumSourceIdentity(album));
            bindLongPressAction(card, () => {
                if (typeof openAlbumZenithMenu !== 'function') return;
                const albumMeta = typeof resolveAlbumMeta === 'function' ? resolveAlbumMeta(album.title, album.artist) : album;
                if (albumMeta) openAlbumZenithMenu(albumMeta);
            });
            const span = document.createElement('span');
            span.textContent = album.title;
            span.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
            card.appendChild(span);
            return card;
        });
        appendFragment(grid, cards);
    }

    function renderSidebarPlaylists() {
        const list = getEl('sidebar-playlists-list');
        if (!list) return;
        clearNodeChildren(list);
        const playlists = LIBRARY_PLAYLISTS.slice(0, 10);
        if (!playlists.length) {
            const empty = createScreenEmptyState({
                className: 'screen-empty-state sidebar-empty-state',
                title: 'No playlists yet',
                body: 'Create one, then choose songs from your library.',
                iconName: 'listMusic'
            });
            const actions = document.createElement('div');
            actions.className = 'sidebar-empty-actions';

            const createButton = document.createElement('button');
            createButton.type = 'button';
            createButton.className = 'sidebar-empty-action primary';
            createButton.dataset.action = 'createPlaylistFromSidebar';
            createButton.textContent = 'New Playlist';

            const songsButton = document.createElement('button');
            songsButton.type = 'button';
            songsButton.className = 'sidebar-empty-action';
            songsButton.dataset.action = 'openLibrarySongsFromSidebar';
            songsButton.textContent = 'Browse Songs';

            actions.appendChild(createButton);
            actions.appendChild(songsButton);
            empty.appendChild(actions);
            list.appendChild(empty);
            scheduleTitleMotion(list);
            return;
        }
        appendFragment(list, playlists.map((playlist, idx) => {
            const row = createCollectionRow('playlist', playlist, 'sidebar');
            row.style.padding = '14px 0';
            if (idx === playlists.length - 1) row.style.border = 'none';
            row.querySelector('.item-clickable')?.addEventListener('click', () => closeSidebar(), { once: true });
            return row;
        }));
        scheduleTitleMotion(list);
    }

    function renderLibraryViews(options = {}) {
        const force = options === true || Boolean(options?.force);
        if (!force && !consumeLibraryRenderDirty()) return;
        if (force) setLibraryRenderDirty(false);
        const playlistsList = getEl('lib-playlists-list');
        const albumsGrid = getEl('lib-albums-grid');
        const artistsList = getEl('lib-artists-list');
        const songsList = getEl('lib-songs-list');
        const genresView = getEl('lib-view-genres');

        bindLibraryMetadataSubscriber();
        ensureLibraryHeaderBindings();
        ensureLibraryEditControls();
        syncLibraryCategoryOrder();
        LIBRARY_SECTIONS.forEach(ensureAppearanceToolbar);
        const restoredLibraryTab = getUiPreference('libraryTab', '');
        syncLibraryTabSemantics(LIBRARY_SECTIONS.includes(restoredLibraryTab) ? restoredLibraryTab : getActiveLibraryTabName());

        renderCollectionLibrarySection({
            section: 'playlists',
            container: playlistsList,
            sourceItems: LIBRARY_PLAYLISTS,
            getSortedItems: getSortedPlaylists,
            kind: 'playlist',
            emptyState: {
                title: 'No playlists',
                body: 'Create a playlist or import an M3U list.',
                iconName: 'playlist'
            },
            renderCustom: ({ container, items }) => {
                if (items.length) return false;
                appendLibraryPlaylistEmptyState(container);
                return true;
            }
        });

        renderCollectionLibrarySection({
            section: 'albums',
            container: albumsGrid,
            sourceItems: LIBRARY_ALBUMS,
            getSortedItems: getSortedAlbums,
            kind: 'album',
            emptyState: {
                title: 'No albums',
                body: 'Add music to fill this view.',
                iconName: 'album'
            },
            renderCustom: ({ container, items, config }) => {
                if (config.mode !== 'carousel' || !config.groupByArtist) return false;
                renderAlbumArtistCarouselGroups(container, items, config.density);
                return true;
            }
        });

        renderCollectionLibrarySection({
            section: 'artists',
            container: artistsList,
            sourceItems: LIBRARY_ARTISTS,
            getSortedItems: getSortedArtists,
            kind: 'artist',
            emptyState: {
                title: 'No artists',
                body: 'Add music to fill this view.',
                iconName: 'artist'
            }
        });

        if (songsList) {
            applyLibraryAppearance('songs', songsList);
            syncLibrarySongSortState();
            renderLibrarySongWindow(songsList, getSortedTracks(libSongsSortMode));
        }

        if (genresView) {
            applyLibraryAppearance('genres', genresView);
            clearNodeChildren(genresView);
            const buckets = getGenreBuckets();
            const taggedBuckets = buckets.filter((bucket) => String(bucket?.name || '').trim().toLowerCase() !== 'unknown');
            const visibleBuckets = taggedBuckets.length ? buckets : [];
            if (!visibleBuckets.length) {
                appendLibraryEmptyState(genresView, {
                    title: 'No genres',
                    body: 'Add genre tags.',
                    iconName: 'tag'
                });
            } else {
                const palette = ['#1F2937', '#0F766E', '#7C2D12', '#3B0764', '#0B3D91', '#5B21B6', '#7F1D1D', '#164E63'];
                const grid = document.createElement('div');
                grid.className = 'cat-grid';
                grid.style.marginTop = '8px';
                appendFragment(grid, visibleBuckets.slice(0, 12).map((bucket, idx) => {
                    const card = document.createElement('div');
                    card.className = 'cat-card';
                    card.style.minHeight = '108px';
                    card.style.display = 'flex';
                    card.style.alignItems = 'flex-end';
                    card.style.background = `linear-gradient(145deg, ${palette[idx % palette.length]}, #111827)`;
                    card.onclick = () => routeToGenre(bucket.name);
                    bindLongPressAction(card, () => openGenreActionMenu(bucket));

                    const label = document.createElement('span');
                    label.style.display = 'flex';
                    label.style.flexDirection = 'column';
                    label.style.gap = '4px';
                    const main = document.createElement('strong');
                    main.style.fontSize = '15px';
                    main.textContent = bucket.name === 'Unknown' ? 'Untagged' : bucket.name;
                    const count = document.createElement('small');
                    count.style.fontSize = '11px';
                    count.style.opacity = '0.85';
                    count.textContent = `${bucket.trackCount} tracks`;
                    label.appendChild(main);
                    label.appendChild(count);
                    card.appendChild(label);
                    return card;
                }));
                genresView.appendChild(grid);
            }
        }

        renderHomeSections();
        renderArtistProfileView();
        renderSearchBrowseGrid();
        renderSidebarPlaylists();
        ensureAccessibility();
        scheduleTitleMotion(document);
    }

    // ── Folder Browser View ──────────────────────────────────────────────────
    //
    // Groups LIBRARY_ALBUMS by their folder path (derived from album.id) and
    // renders a collapsible tree.  Each folder shows child albums as cards.
    //
    function renderFolderBrowserView() {
        const container = getEl('lib-folders-tree');
        if (!container) return;
        applyLibraryAppearance('folders', container);
        clearNodeChildren(container);

        const albums = Array.isArray(LIBRARY_ALBUMS) ? LIBRARY_ALBUMS : [];
        if (!albums.length) {
            appendLibraryEmptyState(container, {
                title: 'No folders',
                body: 'Add music folders.',
                iconName: 'folder'
            });
            return;
        }

        function normalizeLibraryPath(value) {
            return String(value || '').replace(/\\/g, '/').trim().replace(/^\/+|\/+$/g, '');
        }

        function extractAlbumDirectory(album) {
            const firstTrackPath = normalizeLibraryPath(album?.tracks?.find((track) => track?.path)?.path || '');
            if (firstTrackPath) {
                const parts = firstTrackPath.split('/').filter(Boolean);
                if (parts.length > 1) return parts.slice(0, -1).join('/');
            }

            const candidateIds = [album?._sourceAlbumId, album?.id];
            for (const candidate of candidateIds) {
                const raw = normalizeLibraryPath(candidate);
                if (!raw) continue;
                if (raw.includes('::')) {
                    const scopedPath = normalizeLibraryPath(raw.slice(raw.indexOf('::') + 2));
                    if (scopedPath) return scopedPath;
                }
                if (raw.startsWith('fixture:')) {
                    const fixturePath = normalizeLibraryPath(raw.slice('fixture:'.length));
                    if (fixturePath) return fixturePath;
                }
            }
            return '';
        }

        // Derive the parent folder that contains each album.
        function folderPathFromAlbum(album) {
            const albumDirectory = extractAlbumDirectory(album);
            if (!albumDirectory) return '/';
            const parts = albumDirectory.split('/').filter(Boolean);
            return parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
        }

        // Group albums by folder path
        const folderMap = new Map();
        albums.forEach((album) => {
            const folder = folderPathFromAlbum(album);
            if (!folderMap.has(folder)) folderMap.set(folder, []);
            folderMap.get(folder).push(album);
        });

        // Sort folder names: root first, then alphabetical
        const sortedFolders = Array.from(folderMap.keys()).sort((a, b) => {
            if (a === '/') return -1;
            if (b === '/') return 1;
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });

        const folderNodes = [];
        sortedFolders.forEach((folderPath) => {
            const folderAlbums = folderMap.get(folderPath) || [];
            const displayName = folderPath === '/' ? 'Root' : folderPath.split('/').pop();

            // ── Folder header (tappable to expand/collapse) ──────────────────
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; align-items:center; gap:10px; padding:12px 16px; cursor:pointer; border-radius:10px; margin:4px 0;';
            header.innerHTML = `
                <svg viewBox="0 0 24 24" width="22" style="color:var(--text-secondary); flex-shrink:0;" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                </svg>
                <span style="flex:1; font-weight:600; font-size:15px;">${escapeHtml(displayName)}</span>
                <span style="font-size:12px; color:var(--text-secondary);">${folderAlbums.length} album${folderAlbums.length !== 1 ? 's' : ''}</span>
                <svg class="folder-chevron" viewBox="0 0 24 24" width="16" style="color:var(--text-secondary); transition:transform 0.2s;" fill="currentColor">
                  <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
                </svg>`;

            // ── Albums inside the folder ──────────────────────────────────────
            const albumsGrid = document.createElement('div');
            albumsGrid.style.cssText = 'padding:0 12px 8px; display:none;';

            header.addEventListener('click', () => {
                const isOpen = albumsGrid.style.display !== 'none';
                albumsGrid.style.display = isOpen ? 'none' : 'block';
                const chevron = header.querySelector('.folder-chevron');
                if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
            });

            folderAlbums.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
            folderAlbums.forEach((album) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px 8px; border-radius:8px; cursor:pointer;';
                row.setAttribute('data-action', 'routeToAlbum');
                row.setAttribute('data-album', album.title || '');
                row.setAttribute('data-artist', album.artist || '');

                const thumb = document.createElement('div');
                thumb.style.cssText = 'width:48px; height:48px; border-radius:8px; flex-shrink:0; overflow:hidden; background:var(--bg-tertiary,#2a2a3a);';
                if (album.artUrl) {
                    const img = document.createElement('img');
                    img.src = album.artUrl;
                    img.alt = '';
                    img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
                    img.onerror = () => { img.style.display = 'none'; };
                    thumb.appendChild(img);
                }

                const info = document.createElement('div');
                info.style.cssText = 'flex:1; min-width:0;';
                const albumArtist = album.artist || '';
                const year        = album.year ? ` · ${album.year}` : '';
                const compilation = album.isCompilation
                    ? `<span style="font-size:10px; color:var(--text-secondary); background:rgba(255,255,255,0.08); border-radius:4px; padding:1px 5px; margin-left:6px;">Compilation</span>`
                    : '';
                info.innerHTML = `
                    <div style="font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHtml(album.title || 'Unknown Album')}${compilation}
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHtml(albumArtist)}${escapeHtml(year)} · ${album.trackCount || 0} tracks
                    </div>`;

                row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (typeof openAlbumZenithMenu === 'function') openAlbumZenithMenu(album);
                });
                row.addEventListener('click', () => {
                    if (typeof routeToAlbumDetail === 'function') {
                        routeToAlbumDetail(album.title, album.artist, getAlbumSourceIdentity(album));
                    }
                });

                row.appendChild(thumb);
                row.appendChild(info);
                albumsGrid.appendChild(row);
            });

            folderNodes.push(header, albumsGrid);
        });
        appendFragment(container, folderNodes);
    }

    function openSectionConfig(sectionRef) {
        showSectionConfigMenu(sectionRef);
    }

    window.presentActionSheet = presentActionSheet;
    window.createLibrarySongRow = createLibrarySongRow;
    window.createCollectionRow = createCollectionRow;
    window.createCollectionCard = createCollectionCard;
    window.openAddHomeSection = openAddHomeSection;
    window.openCreateHomeProfile = openCreateHomeProfile;
    window.openArtistProfileSectionMenu = openArtistProfileSectionMenu;
    window.filterHome = filterHome;
    window.switchLib = switchLib;
    window.switchLibSongsSort = switchLibSongsSort;
    window.renderLibraryViews = renderLibraryViews;
    window.renderFolderBrowserView = renderFolderBrowserView;
    window.openSectionConfig = openSectionConfig;

    try {
        loadHomeLayout();
        loadHomeProfiles();
        loadHomeSubtextPrefs();
        loadHomeTitleMode();
        loadEntitySubtextPrefs();
        loadArtistProfileLayout();
    } catch (_) {
        // ignore
    }

    window.addEventListener('resize', () => {
        scheduleNowPlayingMarquee(document);
        scheduleTitleMotion(document);
    });

    window.addEventListener('beforeunload', () => {
        blobUrlCache.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
        blobUrlCache.clear();
        revokeUrlSet(playbackBlobUrls);
        revokeUrlSet(librarySnapshotArtworkUrls);
    });

// ═══════════════════════════════════════════════════════════════════
