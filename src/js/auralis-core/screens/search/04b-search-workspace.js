    function getSearchTerms(query) {
        const normalized = normalizeSearchText(query);
        return normalized ? normalized.split(' ').filter(Boolean) : [];
    }

    function getSearchFieldScore(value, fullQuery, terms, weight) {
        const text = normalizeSearchText(value);
        if (!text) return 0;

        let score = 0;
        if (fullQuery) {
            if (text === fullQuery) score += weight * 8;
            else if (text.startsWith(fullQuery)) score += weight * 6;
            else if (text.includes(fullQuery)) score += weight * 4;
        }

        terms.forEach((term) => {
            if (text === term) score += weight * 5;
            else if (text.startsWith(term)) score += weight * 3;
            else if (text.includes(term)) score += weight;
        });
        return score;
    }

    function getSearchMatchScore(item, query) {
        const fullQuery = normalizeSearchText(query);
        const terms = getSearchTerms(query);
        if (!fullQuery || terms.length === 0) return 1;

        const index = item?._searchIndex || createSearchIndex({
            title: item?.title || '',
            subtitle: item?.subtitle || '',
            artist: item?.artist || item?.name || '',
            album: item?.albumTitle || '',
            genre: item?.genre || '',
            year: item?.year || ''
        });
        const haystack = index.text || '';
        if (!terms.every((term) => haystack.includes(term))) return 0;

        const weights = {
            title: 100,
            artist: 75,
            album: 65,
            albums: 55,
            tracks: 50,
            subtitle: 35,
            genre: 25,
            year: 20,
            path: 5
        };
        return Object.entries(index.fields || {}).reduce((total, [field, values]) => {
            const weight = weights[field] || 10;
            return total + (Array.isArray(values) ? values : [values]).reduce(
                (fieldTotal, value) => fieldTotal + getSearchFieldScore(value, fullQuery, terms, weight),
                0
            );
        }, 0);
    }

    function appendSearchMetaToken(line, label, onClick) {
        if (!label) return;
        if (line.childElementCount > 0) {
            const sep = document.createElement('span');
            sep.className = 'zenith-meta-sep';
            line.appendChild(sep);
        }
        if (typeof onClick === 'function') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'zenith-meta-link';
            btn.textContent = label;
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                onClick();
            });
            line.appendChild(btn);
            return;
        }
        const text = document.createElement('span');
        text.textContent = label;
        line.appendChild(text);
    }

    function buildSearchSubtextLine(item) {
        const line = document.createElement('div');
        line.className = 'zenith-meta zenith-meta-row';
        if (item.type === 'songs') {
            appendSearchMetaToken(line, item.artist || '', () => routeToArtistProfile(item.artist));
            appendSearchMetaToken(line, item.albumTitle || '', () => routeToAlbumDetail(item.albumTitle, item.artist, getTrackSourceAlbumIdentity(item)));
            if (item.genre) appendSearchMetaToken(line, item.genre, () => routeToGenreBrowse(item.genre));
            if (item.duration > 0) appendSearchMetaToken(line, toDurationLabel(item.duration));
            return line;
        }
        if (item.type === 'albums') {
            appendSearchMetaToken(line, item.artist || '', () => routeToArtistProfile(item.artist));
            appendSearchMetaToken(line, `${Number(item.trackCount || 0)} tracks`);
            if (item.genre) appendSearchMetaToken(line, item.genre, () => routeToGenreBrowse(item.genre));
            return line;
        }
        appendSearchMetaToken(line, item.subtitle || '');
        return line;
    }

    function findTrackSearchMatch(tracks, query) {
        const terms = getSearchTerms(query);
        if (!terms.length || !Array.isArray(tracks)) return null;
        return tracks.find((track) => {
            const index = createSearchIndex({
                title: track.title || '',
                artist: [track.artist || '', track.albumArtist || ''],
                genre: track.genre || '',
                year: track.year || ''
            });
            return terms.every((term) => String(index.text || '').includes(term));
        }) || null;
    }

    function shouldShowSearchLensMatches() {
        return getSearchWorkspaceScopeKey() === 'all';
    }

    function appendLensMatch(row, tracks, query, options = {}) {
        const showLens = Object.prototype.hasOwnProperty.call(options, 'showLensMatches')
            ? Boolean(options.showLensMatches)
            : shouldShowSearchLensMatches();
        if (!showLens) return;
        const match = findTrackSearchMatch(tracks, query);
        if (!match) return;
        const content = row.querySelector('.item-content');
        if (!content) return;
        row.classList.add('album-lens-result');
        const cue = document.createElement('div');
        cue.className = 'album-lens-match';
        cue.innerHTML = `
            <span class="album-lens-match-icon">${getIconSvg('music')}</span>
            <span class="album-lens-match-copy">Match inside</span>
            <strong></strong>
        `;
        cue.querySelector('strong').textContent = match.title || 'Untitled Track';
        content.appendChild(cue);
    }

    function buildSearchRow(item, options = {}) {
        if (item?.type === 'songs' && typeof createLibrarySongRow === 'function') {
            const track = resolveTrackMeta(item.title, item.artist, item.albumTitle);
            const row = createLibrarySongRow(track, true, {
                compact: true,
                showDuration: true,
                hideAlbum: false,
                metaContext: 'search'
            });
            row.style.padding = '12px 0';
            row.dataset.type = 'songs';
            row.addEventListener('click', () => rememberMediaSearchActivation(makeSearchHistoryEntry('song', track, { query: searchQuery, icon: 'music' })), { capture: true });
            return row;
        }

        if (item?.type === 'albums' && typeof createCollectionRow === 'function') {
            const resolvedAlbum = resolveAlbumMeta(item.albumTitle || item.title, item.artist);
            const albumItem = resolvedAlbum || {
                title: item.title,
                artist: item.artist || ARTIST_NAME,
                year: item.year || '',
                trackCount: Number(item.trackCount || 0),
                genre: item.genre || '',
                artUrl: item.artUrl || '',
                tracks: Array.isArray(item.tracks) ? item.tracks.slice() : []
            };
            const row = createCollectionRow('album', albumItem, 'search');
            row.dataset.type = 'albums';
            appendLensMatch(row, albumItem.tracks, searchQuery, options);
            row.addEventListener('click', () => rememberMediaSearchActivation(makeSearchHistoryEntry('album', albumItem, { query: searchQuery, icon: 'album' })), { capture: true });
            return row;
        }

        if (item?.type === 'artists' && typeof createCollectionRow === 'function') {
            const key = toArtistKey(item.name || item.artist || item.title);
            const resolvedArtist = artistByKey.get(key) || LIBRARY_ARTISTS.find((artist) => toArtistKey(artist.name) === key);
            const artistItem = resolvedArtist || {
                name: item.name || item.artist || item.title || ARTIST_NAME,
                artUrl: item.artUrl || '',
                albumCount: Number(item.albumCount || 0),
                trackCount: Number(item.trackCount || 0),
                plays: Number(item.plays || 0)
            };
            const row = createCollectionRow('artist', artistItem, 'search');
            row.dataset.type = 'artists';

            const artistTracks = (typeof LIBRARY_TRACKS !== 'undefined' && Array.isArray(LIBRARY_TRACKS))
                ? LIBRARY_TRACKS.filter(t => toArtistKey(t.artist) === key || toArtistKey(t.albumArtist) === key)
                : [];
            appendLensMatch(row, artistTracks, searchQuery, options);

            row.addEventListener('click', () => rememberMediaSearchActivation(makeSearchHistoryEntry('artist', artistItem, { query: searchQuery, icon: 'artist' })), { capture: true });
            return row;
        }

        if (item?.type === 'playlists' && typeof createCollectionRow === 'function') {
            const playlist = playlistById.get(item.id) || LIBRARY_PLAYLISTS.find(pl => pl.id === item.id) || {
                id: item.id,
                name: item.title,
                tracks: []
            };
            const row = createCollectionRow('playlist', playlist, 'search');
            row.dataset.type = 'playlists';
            appendLensMatch(row, playlist.tracks || [], searchQuery, options);
            row.addEventListener('click', () => rememberMediaSearchActivation(makeSearchHistoryEntry('playlist', playlist, { query: searchQuery, icon: 'playlist' })), { capture: true });
            return row;
        }

        const row = document.createElement('div');
        row.className = 'list-item';
        row.dataset.type = item.type;

        const clickable = document.createElement('button');
        clickable.className = 'item-clickable';
        clickable.type = 'button';

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        applyArtBackground(
            icon,
            item.artUrl || '',
            item.type === 'songs'
                ? 'linear-gradient(135deg, #FF6B6B, #818CF8)'
                : item.type === 'albums'
                    ? FALLBACK_GRADIENT
                    : 'linear-gradient(135deg, #0ea5e9, #14b8a6)'
        );

        const content = document.createElement('div');
        content.className = 'item-content';

        const h3 = document.createElement('h3');
        h3.textContent = item.title;

        content.appendChild(h3);
        content.appendChild(buildSearchSubtextLine(item));
        clickable.appendChild(icon);
        clickable.appendChild(content);

        clickable.addEventListener('click', (evt) => {
            rememberMediaSearchActivation(makeSearchHistoryEntry(String(item.type || 'media').replace(/s$/, ''), item, {
                query: searchQuery,
                icon: item.type === 'genres' ? 'tag' : item.type === 'folders' ? 'folder' : 'library'
            }));
            if (typeof item.action === 'function') item.action(evt);
        });
        clickable.addEventListener('mousedown', (e) => startLongPress(e, item.title, item.subtitle));
        clickable.addEventListener('mouseup', clearLongPress);
        clickable.addEventListener('mouseleave', clearLongPress);
        clickable.addEventListener('touchstart', (e) => startLongPress(e, item.title, item.subtitle), { passive: true });
        clickable.addEventListener('touchend', clearLongPress, { passive: true });

        row.appendChild(clickable);
        appendLensMatch(row, item.tracks || [], searchQuery, options);
        return row;
    }

    function getFolderSearchItems() {
        const folderMap = new Map();
        (Array.isArray(LIBRARY_ALBUMS) ? LIBRARY_ALBUMS : []).forEach((album) => {
            const trackPath = String(album?.tracks?.find((track) => track?.path)?.path || '').replace(/\\/g, '/');
            const idPath = String(album?._sourceAlbumId || album?.id || '').replace(/\\/g, '/');
            const rawPath = trackPath || idPath;
            const parts = rawPath.split('/').filter(Boolean);
            const folder = parts.length > 1 ? parts.slice(0, -1).join(' / ') : 'Library Root';
            if (!folderMap.has(folder)) folderMap.set(folder, { albums: [], tracks: [] });
            const bucket = folderMap.get(folder);
            bucket.albums.push(album);
            if (Array.isArray(album.tracks)) bucket.tracks.push(...album.tracks);
        });

        return Array.from(folderMap.entries()).map(([folder, bucket]) => ({
            type: 'folders',
            title: folder,
            subtitle: `${bucket.albums.length} albums - ${bucket.tracks.length} tracks`,
            tracks: bucket.tracks,
            added: bucket.albums.length,
            plays: bucket.tracks.length,
            duration: bucket.tracks.length,
            action: () => {
                if (typeof exitSearchMode === 'function') exitSearchMode();
                switchLib('folders');
            },
            _searchIndex: createSearchIndex({
                title: folder,
                albums: bucket.albums.map(album => album.title || ''),
                tracks: bucket.tracks.map(track => track.title || '')
            })
        }));
    }

    function getSearchDataset() {
        if (typeof rebuildSearchData === 'function') rebuildSearchData();
        const playlistItems = (Array.isArray(LIBRARY_PLAYLISTS) ? LIBRARY_PLAYLISTS : []).map((playlist, index) => ({
            type: 'playlists',
            id: playlist.id,
            title: playlist.name || 'Untitled Playlist',
            subtitle: `${Array.isArray(playlist.tracks) ? playlist.tracks.length : 0} tracks`,
            tracks: playlist.tracks || [],
            added: Number(playlist.created || 0) || index + 1,
            plays: Array.isArray(playlist.tracks) ? playlist.tracks.length : 0,
            duration: Array.isArray(playlist.tracks) ? playlist.tracks.length : 0,
            action: () => routeToPlaylistDetail(playlist.id),
            _searchIndex: createSearchIndex({
                title: playlist.name || '',
                tracks: (playlist.tracks || []).map(track => track.title || ''),
                artist: (playlist.tracks || []).map(track => track.artist || '')
            })
        }));
        const genreItems = (typeof getGenreBuckets === 'function' ? getGenreBuckets() : [])
            .filter(bucket => String(bucket?.name || '').trim())
            .map((bucket, index) => ({
                type: 'genres',
                title: bucket.name === 'Unknown' ? 'Untagged' : bucket.name,
                subtitle: `${bucket.trackCount || 0} tracks`,
                tracks: bucket.tracks || [],
                added: index + 1,
                plays: Number(bucket.trackCount || 0),
                duration: Number(bucket.trackCount || 0),
                action: () => routeToGenre(bucket.name),
                _searchIndex: createSearchIndex({
                    title: bucket.name || '',
                    tracks: (bucket.tracks || []).map(track => track.title || ''),
                    artist: (bucket.tracks || []).map(track => track.artist || '')
                })
            }));

        return [
            ...SEARCH_DATA,
            ...playlistItems,
            ...genreItems,
            ...getFolderSearchItems()
        ];
    }

    function renderSearchResults() {
        const resultsEl = getEl('search-results');
        if (!resultsEl) return;

        const { activeTypes, filtered } = getFilteredSearchResultItems();
        clearTrackUiRegistryForRoot(resultsEl);
        resultsEl.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'list-wrap search-results-list-shell';
        wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';

        if (filtered.length === 0) {
            if (searchWorkspaceEditing) return;
            const iconByType = {
                songs: 'music',
                albums: 'album',
                artists: 'artist',
                playlists: 'playlist',
                genres: 'tag',
                folders: 'folder'
            };
            const scopedIcon = activeTypes.length === 1 ? iconByType[activeTypes[0]] : 'library';
            resultsEl.appendChild(createScreenEmptyState({
                className: 'screen-empty-state library-empty-state search-empty-state',
                title: 'No results',
                body: '',
                iconName: scopedIcon || 'library'
            }));
            return;
        }

        const scopeKey = getSearchWorkspaceScopeKey();
        const prefs = getSearchResultPrefs(scopeKey);
        const collapsed = new Set(prefs.collapsed);

        getSearchResultSectionEntries(scopeKey)
            .forEach((section) => {
                const items = section.items || [];
                const isCollapsed = collapsed.has(section.id);
                const group = document.createElement('section');
                group.className = `search-results-group search-workspace-section${isCollapsed ? ' is-collapsed' : ''}`;
                group.dataset.searchResultSection = section.id;

                const heading = document.createElement('div');
                heading.className = 'search-results-heading search-workspace-section-header';
                heading.innerHTML = `
                    <span class="search-workspace-section-icon">${getIconSvg(section.icon)}</span>
                    <h2>${section.title}</h2>
                    <span>${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
                `;

                heading.appendChild(createSearchCollapseToggle({
                    collapsed: isCollapsed,
                    label: section.title,
                    onToggle: () => toggleSearchResultSectionCollapsed(section.id)
                }));

                group.appendChild(heading);

                if (!isCollapsed) {
                    const list = document.createElement('div');
                    list.className = 'search-results-list';
                    items.forEach(item => list.appendChild(buildSearchRow(item, { showLensMatches: section.showLensMatches })));
                    group.appendChild(list);
                }
                wrap.appendChild(group);
            });
        resultsEl.appendChild(wrap);
        bindSearchResultSectionsDrag(wrap);
    }

    function applySortToBrowseGrid() {
        const grid = getEl('search-cat-grid');
        if (!grid) return;

        const cards = Array.from(grid.querySelectorAll('.cat-card'));
        const decorated = cards.map((card, index) => {
            if (!card.dataset.added) card.dataset.added = String(cards.length - index);
            if (!card.dataset.plays) card.dataset.plays = String((index + 1) * 10);
            if (!card.dataset.duration) card.dataset.duration = String(180 + index * 12);
            return {
                card,
                title: card.innerText.trim(),
                added: Number(card.dataset.added),
                plays: Number(card.dataset.plays),
                duration: Number(card.dataset.duration)
            };
        });

        switch (currentSort) {
            case 'A-Z':
                decorated.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'Most Played':
                decorated.sort((a, b) => b.plays - a.plays);
                break;
            case 'Duration':
                decorated.sort((a, b) => b.duration - a.duration);
                break;
            default:
                decorated.sort((a, b) => b.added - a.added);
                break;
        }

        decorated.forEach(item => grid.appendChild(item.card));
    }

    function updateSortIndicators() {
        document.querySelectorAll('.sort-indicator').forEach(node => {
            node.textContent = currentSort;
            node.title = `Sort: ${currentSort}`;
        });
    }

    function ensureSortIndicators() {
        const triggers = Array.from(document.querySelectorAll('div.icon-btn[onclick="openSearchSort()"]'));
        triggers.forEach(btn => {
            const parent = btn.parentElement;
            if (!parent) return;
            let indicator = parent.querySelector('.sort-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'sort-indicator';
                indicator.style.cssText = 'font-size:11px; color:var(--text-tertiary); margin-left:8px; white-space:nowrap;';
                parent.appendChild(indicator);
            }
        });
        updateSortIndicators();
    }

    const SEARCH_WORKSPACE_SECTIONS = [
        { id: 'history', title: 'Search History', icon: 'filter' },
        { id: 'recentlyPlayed', title: 'Recently Played', icon: 'music' },
        { id: 'recentlyAdded', title: 'Recently Added', icon: 'library' }
    ];
    const SEARCH_RESULT_SECTION_META = {
        songs: { title: 'Songs', icon: 'music' },
        albums: { title: 'Albums', icon: 'album' },
        artists: { title: 'Artists', icon: 'artist' },
        playlists: { title: 'Playlists', icon: 'playlist' },
        genres: { title: 'Genres', icon: 'tag' },
        folders: { title: 'Folders', icon: 'folder' }
    };
    let searchWorkspaceEditing = false;
    let searchWorkspaceEditExpanded = new Set();

    function getSearchWorkspaceScopeKey() {
        if (!searchFilters || searchFilters.has('all')) return 'all';
        const active = Array.from(searchFilters).find(type => SEARCH_SCOPE_TYPES.includes(type));
        return active || 'all';
    }

    function normalizeSearchWorkspacePrefs(prefs = {}) {
        return {
            order: Array.isArray(prefs.order) ? prefs.order.filter(Boolean) : SEARCH_WORKSPACE_SECTIONS.map(section => section.id),
            hidden: Array.isArray(prefs.hidden) ? prefs.hidden.filter(Boolean) : [],
            collapsed: Array.isArray(prefs.collapsed) ? prefs.collapsed.filter(Boolean) : []
        };
    }

    function getAllSearchWorkspacePrefs() {
        const stored = getUiPreference('searchSections', {});
        return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    }

    function getSearchWorkspacePrefs(scopeKey = getSearchWorkspaceScopeKey()) {
        const stored = getAllSearchWorkspacePrefs();
        const scoped = stored.byScope && typeof stored.byScope === 'object' ? stored.byScope[scopeKey] : null;
        return normalizeSearchWorkspacePrefs(scoped || (scopeKey === 'all' ? stored : {}));
    }

    function persistSearchWorkspacePrefs(prefs, scopeKey = getSearchWorkspaceScopeKey()) {
        const stored = getAllSearchWorkspacePrefs();
        const byScope = stored.byScope && typeof stored.byScope === 'object' ? { ...stored.byScope } : {};
        byScope[scopeKey] = normalizeSearchWorkspacePrefs(prefs);
        setUiPreference('searchSections', { ...stored, byScope });
    }

    function getPrimarySearchResultType(scopeKey = getSearchWorkspaceScopeKey()) {
        if (SEARCH_SCOPE_TYPES.includes(scopeKey)) return scopeKey;
        const activeSource = document.querySelector('#library-nav-container .library-nav-item.active[data-section]')?.dataset?.section;
        if (SEARCH_SCOPE_TYPES.includes(activeSource)) return activeSource;
        const preferredSource = getUiPreference('libraryTab', '');
        if (SEARCH_SCOPE_TYPES.includes(preferredSource)) return preferredSource;
        return SEARCH_SCOPE_TYPES[0];
    }

    function getDefaultSearchResultOrder(scopeKey = getSearchWorkspaceScopeKey()) {
        const primary = getPrimarySearchResultType(scopeKey);
        return [primary]
            .concat(SEARCH_SCOPE_TYPES)
            .filter((type, index, list) => SEARCH_SCOPE_TYPES.includes(type) && list.indexOf(type) === index);
    }

    function hasCustomSearchResultOrder(scopeKey = getSearchWorkspaceScopeKey()) {
        const stored = getAllSearchWorkspacePrefs();
        const byScope = stored.resultByScope && typeof stored.resultByScope === 'object' ? stored.resultByScope : {};
        const scoped = byScope[scopeKey];
        return Array.isArray(scoped?.order) && scoped.order.some(type => SEARCH_SCOPE_TYPES.includes(type));
    }

    function normalizeSearchResultPrefs(prefs = {}, scopeKey = getSearchWorkspaceScopeKey()) {
        const validTypes = new Set(SEARCH_SCOPE_TYPES);
        return {
            order: Array.isArray(prefs.order) && prefs.order.length
                ? prefs.order.filter(type => validTypes.has(type))
                : getDefaultSearchResultOrder(scopeKey),
            collapsed: Array.isArray(prefs.collapsed) ? prefs.collapsed.filter(type => validTypes.has(type)) : []
        };
    }

    function getSearchResultPrefs(scopeKey = getSearchWorkspaceScopeKey()) {
        const stored = getAllSearchWorkspacePrefs();
        const byScope = stored.resultByScope && typeof stored.resultByScope === 'object' ? stored.resultByScope : {};
        return normalizeSearchResultPrefs(byScope[scopeKey], scopeKey);
    }

    function persistSearchResultPrefs(prefs, scopeKey = getSearchWorkspaceScopeKey()) {
        const stored = getAllSearchWorkspacePrefs();
        const resultByScope = stored.resultByScope && typeof stored.resultByScope === 'object' ? { ...stored.resultByScope } : {};
        resultByScope[scopeKey] = normalizeSearchResultPrefs(prefs);
        setUiPreference('searchSections', { ...stored, resultByScope });
    }

    function orderedSearchResultSections(activeTypes = getSearchWorkspaceActiveTypes(), scopeKey = getSearchWorkspaceScopeKey()) {
        const active = new Set(activeTypes);
        const prefs = getSearchResultPrefs(scopeKey);
        const baseOrder = hasCustomSearchResultOrder(scopeKey)
            ? prefs.order
            : getDefaultSearchResultOrder(scopeKey);
        return baseOrder
            .concat(SEARCH_SCOPE_TYPES)
            .filter((type, index, list) => SEARCH_SCOPE_TYPES.includes(type) && list.indexOf(type) === index && active.has(type))
            .map(type => ({ id: type, ...(SEARCH_RESULT_SECTION_META[type] || { title: type, icon: 'library' }) }));
    }

    function getFilteredSearchResultItems() {
        const activeTypes = getActiveFilterTypes();
        const q = normalizeSearchText(searchQuery);
        let filtered = getSearchDataset().map((item) => {
            if (!activeTypes.includes(item.type)) return false;
            if (q.length > 0) {
                const score = getSearchMatchScore(item, searchQuery);
                return score > 0 ? { ...item, _searchScore: score } : false;
            }
            return item;
        }).filter(Boolean);

        filtered = sortItems(filtered, { queryActive: q.length > 0 });
        return { activeTypes, filtered, q };
    }

    function getSearchResultSectionEntries(scopeKey = getSearchWorkspaceScopeKey()) {
        const { activeTypes, filtered } = getFilteredSearchResultItems();
        if (!normalizeSearchText(searchQuery)) return [];
        const showLensMatches = activeTypes.length > 1;
        const grouped = new Map();
        filtered.forEach((item) => {
            if (!grouped.has(item.type)) grouped.set(item.type, []);
            grouped.get(item.type).push(item);
        });
        return orderedSearchResultSections(activeTypes, scopeKey)
            .filter(section => grouped.has(section.id))
            .map(section => ({
                key: `source:${section.id}`,
                kind: 'source',
                id: section.id,
                title: section.title,
                icon: section.icon,
                items: grouped.get(section.id) || [],
                showLensMatches,
                hideable: false
            }));
    }

    function moveSearchResultSection(sectionId, delta) {
        const scopeKey = getSearchWorkspaceScopeKey();
        const activeTypes = getSearchWorkspaceActiveTypes();
        const prefs = getSearchResultPrefs(scopeKey);
        const visibleIds = orderedSearchResultSections(activeTypes, scopeKey).map(section => section.id);
        const index = visibleIds.indexOf(sectionId);
        const nextIndex = index + Number(delta || 0);
        if (index < 0 || nextIndex < 0 || nextIndex >= visibleIds.length) return;
        const [item] = visibleIds.splice(index, 1);
        visibleIds.splice(nextIndex, 0, item);
        prefs.order = visibleIds
            .concat(prefs.order)
            .concat(SEARCH_SCOPE_TYPES)
            .filter((type, listIndex, list) => SEARCH_SCOPE_TYPES.includes(type) && list.indexOf(type) === listIndex);
        persistSearchResultPrefs(prefs, scopeKey);
        renderSearchResults();
    }

    function setSearchResultSectionOrder(orderedIds) {
        const scopeKey = getSearchWorkspaceScopeKey();
        const prefs = getSearchResultPrefs(scopeKey);
        prefs.order = orderedIds
            .concat(prefs.order)
            .concat(SEARCH_SCOPE_TYPES)
            .filter((type, index, list) => SEARCH_SCOPE_TYPES.includes(type) && list.indexOf(type) === index);
        persistSearchResultPrefs(prefs, scopeKey);
    }

    function getSearchUnifiedOrder(scopeKey = getSearchWorkspaceScopeKey()) {
        const stored = getAllSearchWorkspacePrefs();
        const byScope = stored.unifiedOrderByScope && typeof stored.unifiedOrderByScope === 'object'
            ? stored.unifiedOrderByScope
            : {};
        return Array.isArray(byScope[scopeKey]) ? byScope[scopeKey].filter(Boolean) : [];
    }

    function persistSearchUnifiedOrder(orderedKeys, scopeKey = getSearchWorkspaceScopeKey()) {
        const stored = getAllSearchWorkspacePrefs();
        const unifiedOrderByScope = stored.unifiedOrderByScope && typeof stored.unifiedOrderByScope === 'object'
            ? { ...stored.unifiedOrderByScope }
            : {};
        unifiedOrderByScope[scopeKey] = Array.isArray(orderedKeys) ? orderedKeys.filter(Boolean) : [];
        setUiPreference('searchSections', { ...stored, unifiedOrderByScope });

        const workspaceIds = unifiedOrderByScope[scopeKey]
            .filter(key => String(key).startsWith('workspace:'))
            .map(key => String(key).replace('workspace:', ''));
        if (workspaceIds.length) setSearchWorkspaceSectionOrder(workspaceIds);

        const resultIds = unifiedOrderByScope[scopeKey]
            .filter(key => String(key).startsWith('source:'))
            .map(key => String(key).replace('source:', ''));
        if (resultIds.length) setSearchResultSectionOrder(resultIds);
    }

    function orderUnifiedSearchSections(sections, scopeKey = getSearchWorkspaceScopeKey()) {
        const order = getSearchUnifiedOrder(scopeKey);
        if (!order.length) return sections;
        const map = new Map(sections.map(section => [section.key, section]));
        return order
            .filter(key => map.has(key))
            .map(key => map.get(key))
            .concat(sections.filter(section => !order.includes(section.key)));
    }

    function toggleSearchResultSectionCollapsed(sectionId) {
        const scopeKey = getSearchWorkspaceScopeKey();
        const prefs = getSearchResultPrefs(scopeKey);
        const collapsed = new Set(prefs.collapsed);
        if (collapsed.has(sectionId)) collapsed.delete(sectionId);
        else collapsed.add(sectionId);
        prefs.collapsed = Array.from(collapsed);
        persistSearchResultPrefs(prefs, scopeKey);
        renderSearchResults();
    }

    function orderedSearchSections(includeHidden = false, scopeKey = getSearchWorkspaceScopeKey()) {
        const prefs = getSearchWorkspacePrefs(scopeKey);
        const map = new Map(SEARCH_WORKSPACE_SECTIONS.map(section => [section.id, section]));
        const orderedIds = prefs.order.concat(SEARCH_WORKSPACE_SECTIONS.map(section => section.id))
            .filter((id, index, list) => map.has(id) && list.indexOf(id) === index);
        return orderedIds
            .filter(id => includeHidden || !prefs.hidden.includes(id))
            .map(id => map.get(id));
    }

    function moveSearchWorkspaceSection(sectionId, delta) {
        const scopeKey = getSearchWorkspaceScopeKey();
        const prefs = getSearchWorkspacePrefs(scopeKey);
        const orderedIds = orderedSearchSections(true, scopeKey).map(section => section.id);
        const index = orderedIds.indexOf(sectionId);
        const nextIndex = index + delta;
        if (index < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) return;
        const [item] = orderedIds.splice(index, 1);
        orderedIds.splice(nextIndex, 0, item);
        prefs.order = orderedIds;
        persistSearchWorkspacePrefs(prefs, scopeKey);
        renderSearchWorkspace();
    }

    function setSearchWorkspaceSectionOrder(orderedIds) {
        const scopeKey = getSearchWorkspaceScopeKey();
        const prefs = getSearchWorkspacePrefs(scopeKey);
        const valid = new Set(SEARCH_WORKSPACE_SECTIONS.map(section => section.id));
        prefs.order = orderedIds
            .filter(id => valid.has(id))
            .concat(SEARCH_WORKSPACE_SECTIONS.map(section => section.id))
            .filter((id, index, list) => list.indexOf(id) === index);
        persistSearchWorkspacePrefs(prefs, scopeKey);
    }

    function toggleSearchWorkspaceSection(sectionId) {
        const scopeKey = getSearchWorkspaceScopeKey();
        const prefs = getSearchWorkspacePrefs(scopeKey);
        const hidden = new Set(prefs.hidden);
        if (hidden.has(sectionId)) hidden.delete(sectionId);
        else hidden.add(sectionId);
        prefs.hidden = Array.from(hidden);
        persistSearchWorkspacePrefs(prefs, scopeKey);
        renderSearchWorkspace();
    }

    function toggleSearchWorkspaceSectionCollapsed(sectionId) {
        const scopeKey = getSearchWorkspaceScopeKey();
        const prefs = getSearchWorkspacePrefs(scopeKey);
        const collapsed = new Set(prefs.collapsed);
        if (collapsed.has(sectionId)) collapsed.delete(sectionId);
        else collapsed.add(sectionId);
        prefs.collapsed = Array.from(collapsed);
        persistSearchWorkspacePrefs(prefs, scopeKey);
        renderSearchWorkspace();
    }

    function toggleSearchEditSectionExpanded(sectionKey) {
        if (searchWorkspaceEditExpanded.has(sectionKey)) searchWorkspaceEditExpanded.delete(sectionKey);
        else searchWorkspaceEditExpanded.add(sectionKey);
        renderSearchWorkspace();
    }

    function toggleSearchWorkspaceEdit() {
        searchWorkspaceEditing = !searchWorkspaceEditing;
        searchWorkspaceEditExpanded = new Set();
        renderSearchState();
    }

    function createSearchCollapseToggle({ collapsed, label, onToggle }) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zenith-collapse-toggle search-section-collapse-toggle';
        btn.title = collapsed ? `Expand ${label}` : `Collapse ${label}`;
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-expanded', String(!collapsed));
        btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"></path></svg>';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle();
        });
        return btn;
    }

    function createSearchWorkspaceEmpty(iconName, title) {
        const empty = document.createElement('div');
        empty.className = 'search-section-empty';
        empty.innerHTML = `
            <div class="search-section-empty-icon">${getIconSvg(iconName)}</div>
            <strong>${title}</strong>
        `;
        return empty;
    }

    function createSearchWorkspaceButton(label, iconName, onClick, subtitle = '') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-section-row';
        btn.innerHTML = `
            <span class="search-section-row-icon">${getIconSvg(iconName)}</span>
            <span class="search-section-row-copy">
                <strong>${escapeHtml(label)}</strong>
                ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}
            </span>
        `;
        btn.addEventListener('click', onClick);
        return btn;
    }

    function getSearchWorkspaceActiveTypes() {
        return typeof getActiveFilterTypes === 'function' ? getActiveFilterTypes() : SEARCH_SCOPE_TYPES.slice();
    }

    function getSearchWorkspaceDatasetItems() {
        const q = normalizeSearchText(searchQuery);
        const activeTypes = getSearchWorkspaceActiveTypes();
        return getSearchDataset()
            .filter(item => activeTypes.includes(item.type))
            .map(item => {
                const score = q ? getSearchMatchScore(item, searchQuery) : 1;
                return score > 0 ? { ...item, _searchScore: score } : null;
            })
            .filter(Boolean);
    }

    function getSearchWorkspaceRecentItems(sortMode = 'added') {
        const items = getSearchWorkspaceDatasetItems();
        const recentScore = (item) => {
            const tracks = Array.isArray(item.tracks) && item.tracks.length
                ? item.tracks
                : item.type === 'songs' ? [item] : [];
            return tracks.reduce((max, track) => Math.max(max, Number(getTrackMapValue(lastPlayed, track) || track.lastPlayedAt || 0)), 0);
        };

        return items
            .filter(item => sortMode !== 'played' || recentScore(item) > 0)
            .sort((a, b) => {
                if (sortMode === 'played') return recentScore(b) - recentScore(a);
                return Number(b.added || 0) - Number(a.added || 0);
            })
            .slice(0, 8);
    }

    function searchHistoryEntryMatchesScope(entry) {
        if (!entry) return false;
        const scopeKey = getSearchWorkspaceScopeKey();
        if (scopeKey === 'all') return true;
        const entryType = String(entry.type || '').trim().toLowerCase();
        return `${entryType}s` === scopeKey || entryType === scopeKey.replace(/s$/, '');
    }

    function searchWorkspaceSectionHasContent(section) {
        if (searchWorkspaceEditing) return true;
        if (section.id === 'history') {
            const q = normalizeSearchText(searchQuery);
            if (!q) return true;
            return getMediaSearchHistory().filter(searchHistoryEntryMatchesScope).some(entry => createSearchIndex({
                title: entry.title || '',
                subtitle: entry.subtitle || '',
                type: entry.type || ''
            }).text.includes(q));
        }
        if (section.id === 'recentlyPlayed') return searchWorkspaceEditing || getSearchWorkspaceRecentItems('played').length > 0;
        if (section.id === 'recentlyAdded') return getSearchWorkspaceRecentItems('added').length > 0;
        return false;
    }

    function buildSearchWorkspaceContent(section) {
        const body = document.createElement('div');
        body.className = 'search-section-body';
        if (section.id === 'history') {
            const q = normalizeSearchText(searchQuery);
            const searches = getMediaSearchHistory().filter(entry => {
                if (!searchHistoryEntryMatchesScope(entry)) return false;
                if (!q || searchWorkspaceEditing) return true;
                return createSearchIndex({
                    title: entry.title || '',
                    subtitle: entry.subtitle || '',
                    type: entry.type || ''
                }).text.includes(q);
            });
            if (!searches.length) {
                if (searchWorkspaceEditing) return body;
                body.appendChild(createSearchWorkspaceEmpty('filter', 'No recent searches'));
                return body;
            }
            searches.forEach(entry => {
                body.appendChild(createSearchWorkspaceButton(entry.title, entry.icon || 'filter', () => {
                    if (entry.type === 'song') playTrack(entry.title, entry.subtitle, '');
                    else routeToSearchQuery(entry.title, [entry.type === 'album' ? 'albums' : entry.type === 'artist' ? 'artists' : entry.type === 'playlist' ? 'playlists' : 'all']);
                }, entry.subtitle || entry.type || ''));
            });
            return body;
        }
        const items = getSearchWorkspaceRecentItems(section.id === 'recentlyPlayed' ? 'played' : 'added');
        if (!items.length) {
            if (searchWorkspaceEditing) return body;
            body.appendChild(createSearchWorkspaceEmpty(
                section.id === 'recentlyPlayed' ? 'music' : 'library',
                section.id === 'recentlyPlayed' ? 'No recent plays' : 'No recent additions'
            ));
            return body;
        }
        items.forEach(item => {
            const row = buildSearchRow(item);
            row.classList.add('search-media-row');
            body.appendChild(row);
        });
        return body;
    }

    function buildSearchResultSectionContent(section) {
        const body = document.createElement('div');
        body.className = 'search-results-list search-section-body';
        (section.items || []).forEach(item => body.appendChild(buildSearchRow(item, { showLensMatches: section.showLensMatches })));
        return body;
    }

    function openSearchSectionOptions(section) {
        if (!section || !searchWorkspaceEditing || typeof showZenithActionSheet !== 'function') return;
        const isExpanded = searchWorkspaceEditExpanded.has(section.key);
        const actions = [{
            label: isExpanded ? 'Collapse section' : 'Expand section',
            description: isExpanded ? 'Keep this section compact while editing.' : 'Show rows in this section while editing.',
            onSelect: () => toggleSearchEditSectionExpanded(section.key)
        }];
        if (section.hideable) {
            actions.push({
                label: section.hidden ? 'Show section' : 'Hide section',
                description: section.hidden ? 'Bring this search section back.' : 'Remove this search section from normal search.',
                danger: !section.hidden,
                onSelect: () => toggleSearchWorkspaceSection(section.id)
            });
        }
        showZenithActionSheet(section.title || 'Search Section', 'Section options', actions, { icon: section.icon || 'filter' });
    }

    function bindSearchWorkspaceDrag(root) {
        let draggingEl = null;
        let pendingDrag = null;
        const dragThreshold = 6;
        const interactiveSelector = 'button, a, input, textarea, select, [contenteditable="true"], .icon-btn, .search-workspace-section-actions, .search-workspace-section-actions *, .search-section-collapse-toggle, .search-section-collapse-toggle *';
        const clearDropIndicators = () => {
            root.querySelectorAll('.is-drop-before, .is-drop-after').forEach(node => {
                node.classList.remove('is-drop-before', 'is-drop-after');
            });
        };
        const setDropIndicator = (target, insertAfter) => {
            clearDropIndicators();
            target?.classList.add(insertAfter ? 'is-drop-after' : 'is-drop-before');
        };

        const canStartFromTarget = (event, card) => {
            if (!searchWorkspaceEditing) return false;
            const header = event.target?.closest?.('.search-workspace-section-header');
            if (!header || !card.contains(header)) return false;
            return !event.target.closest(interactiveSelector);
        };

        const moveDraggedSection = (point) => {
            if (!draggingEl) return;
            const siblings = Array.from(root.querySelectorAll('.search-workspace-section[data-search-edit-section]'))
                .filter(node => node !== draggingEl);
            let target = null;
            let targetDistance = Number.POSITIVE_INFINITY;
            siblings.forEach((section) => {
                const rect = section.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const distance = Math.abs(point.clientY - centerY);
                if (distance < targetDistance) {
                    targetDistance = distance;
                    target = section;
                }
            });
            if (!target) return;
            const rect = target.getBoundingClientRect();
            const insertAfter = point.clientY > rect.top + rect.height / 2;
            setDropIndicator(target, insertAfter);
            root.insertBefore(draggingEl, insertAfter ? target.nextSibling : target);
        };

        const startPointerDrag = (event, card) => {
            draggingEl = card;
            root.classList.add('is-reordering');
            clearDropIndicators();
            card.classList.add('search-section-dragging');
            card.style.touchAction = 'none';
            try {
                card.setPointerCapture?.(event.pointerId);
            } catch (_) {}
        };

        const finishPointerDrag = () => {
            if (!draggingEl && !pendingDrag) return;
            const moved = Boolean(draggingEl);
            const card = draggingEl || pendingDrag?.card;
            if (card) {
                card.style.touchAction = '';
                card.classList.remove('search-section-dragging');
            }
            root.classList.remove('is-reordering');
            clearDropIndicators();
            draggingEl = null;
            pendingDrag = null;
            if (moved) {
                persistSearchUnifiedOrder(Array.from(root.querySelectorAll('.search-workspace-section[data-search-edit-section]'))
                    .map(node => node.dataset.searchEditSection)
                    .filter(Boolean));
                renderSearchWorkspace();
            }
        };

        const removePointerListeners = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handlePointerUp);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        const handlePointerMove = (event) => {
            if (!pendingDrag) return;
            const dx = event.clientX - pendingDrag.startX;
            const dy = event.clientY - pendingDrag.startY;
            if (!draggingEl && Math.hypot(dx, dy) >= dragThreshold) startPointerDrag(event, pendingDrag.card);
            if (!draggingEl) return;
            event.preventDefault();
            moveDraggedSection(event);
        };

        const handlePointerUp = (event) => {
            if (draggingEl) moveDraggedSection(event);
            removePointerListeners();
            finishPointerDrag();
        };

        const handleMouseMove = (event) => {
            if (!pendingDrag) return;
            if (!draggingEl) startPointerDrag(event, pendingDrag.card);
            event.preventDefault();
            moveDraggedSection(event);
        };

        const handleMouseUp = (event) => {
            if (draggingEl) moveDraggedSection(event);
            removePointerListeners();
            finishPointerDrag();
        };

        root.querySelectorAll('.search-workspace-section[data-search-edit-section]').forEach(card => {
            if (card.dataset.searchDragBound === '1') return;
            card.dataset.searchDragBound = '1';
            card.draggable = false;

            card.addEventListener('pointerdown', (event) => {
                if (!canStartFromTarget(event, card)) return;
                pendingDrag = {
                    card,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY
                };
                document.addEventListener('pointermove', handlePointerMove, { passive: false });
                document.addEventListener('pointerup', handlePointerUp);
                document.addEventListener('pointercancel', handlePointerUp);
                document.addEventListener('mousemove', handleMouseMove, { passive: false });
                document.addEventListener('mouseup', handleMouseUp);
            });

            card.addEventListener('mousedown', (event) => {
                if (event.button !== 0 || !canStartFromTarget(event, card)) return;
                pendingDrag = {
                    card,
                    pointerId: 'mouse',
                    startX: event.clientX,
                    startY: event.clientY
                };
                document.addEventListener('mousemove', handleMouseMove, { passive: false });
                document.addEventListener('mouseup', handleMouseUp);
                event.preventDefault();
            });

            card.addEventListener('pointermove', (event) => {
                if (!pendingDrag || pendingDrag.card !== card || pendingDrag.pointerId !== event.pointerId) return;
                const dx = event.clientX - pendingDrag.startX;
                const dy = event.clientY - pendingDrag.startY;
                if (!draggingEl && Math.hypot(dx, dy) >= dragThreshold) startPointerDrag(event, card);
                if (!draggingEl) return;
                event.preventDefault();
                moveDraggedSection(event);
            });

            card.addEventListener('pointerup', handlePointerUp);
            card.addEventListener('pointercancel', handlePointerUp);

            card.addEventListener('dragstart', (event) => {
                if (!canStartFromTarget(event, card)) {
                    event.preventDefault();
                    return;
                }
                draggingEl = card;
                root.classList.add('is-reordering');
                clearDropIndicators();
                card.classList.add('search-section-dragging');
                if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('search-section-dragging');
                root.classList.remove('is-reordering');
                clearDropIndicators();
                card.draggable = false;
                draggingEl = null;
                persistSearchUnifiedOrder(Array.from(root.querySelectorAll('.search-workspace-section[data-search-edit-section]'))
                    .map(node => node.dataset.searchEditSection)
                    .filter(Boolean));
                renderSearchWorkspace();
            });

            card.addEventListener('dragover', (event) => {
                event.preventDefault();
                if (!draggingEl || draggingEl === card) return;
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
                const rect = card.getBoundingClientRect();
                const insertAfter = event.clientY > rect.top + rect.height / 2;
                setDropIndicator(card, insertAfter);
                root.insertBefore(draggingEl, insertAfter ? card.nextSibling : card);
            });
        });
    }

    function bindSearchResultSectionsDrag(root) {
        let draggingEl = null;
        let pendingDrag = null;
        const dragThreshold = 6;
        const interactiveSelector = 'button, a, input, textarea, select, [contenteditable="true"], .icon-btn, .search-workspace-section-actions, .search-workspace-section-actions *, .search-section-collapse-toggle, .search-section-collapse-toggle *';
        const clearDropIndicators = () => {
            root.querySelectorAll('.is-drop-before, .is-drop-after').forEach(node => {
                node.classList.remove('is-drop-before', 'is-drop-after');
            });
        };
        const setDropIndicator = (target, insertAfter) => {
            clearDropIndicators();
            target?.classList.add(insertAfter ? 'is-drop-after' : 'is-drop-before');
        };

        const canStartFromTarget = (event, group) => {
            const header = event.target?.closest?.('.search-workspace-section-header');
            if (!header || !group.contains(header)) return false;
            return !event.target.closest(interactiveSelector);
        };

        const moveDraggedSection = (point) => {
            if (!draggingEl) return;
            const siblings = Array.from(root.querySelectorAll('.search-results-group[data-search-result-section]'))
                .filter(node => node !== draggingEl);
            let target = null;
            let targetDistance = Number.POSITIVE_INFINITY;
            siblings.forEach((section) => {
                const rect = section.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const distance = Math.abs(point.clientY - centerY);
                if (distance < targetDistance) {
                    targetDistance = distance;
                    target = section;
                }
            });
            if (!target) return;
            const rect = target.getBoundingClientRect();
            const insertAfter = point.clientY > rect.top + rect.height / 2;
            setDropIndicator(target, insertAfter);
            root.insertBefore(draggingEl, insertAfter ? target.nextSibling : target);
        };

        const startPointerDrag = (event, group) => {
            draggingEl = group;
            root.classList.add('is-reordering');
            clearDropIndicators();
            group.classList.add('search-section-dragging');
            group.style.touchAction = 'none';
            try {
                group.setPointerCapture?.(event.pointerId);
            } catch (_) {}
        };

        const finishPointerDrag = () => {
            if (!draggingEl && !pendingDrag) return;
            const moved = Boolean(draggingEl);
            const group = draggingEl || pendingDrag?.group;
            if (group) {
                group.style.touchAction = '';
                group.classList.remove('search-section-dragging');
            }
            root.classList.remove('is-reordering');
            clearDropIndicators();
            draggingEl = null;
            pendingDrag = null;
            if (moved) {
                setSearchResultSectionOrder(Array.from(root.querySelectorAll('.search-results-group[data-search-result-section]'))
                    .map(node => node.dataset.searchResultSection)
                    .filter(Boolean));
                renderSearchResults();
            }
        };

        const removePointerListeners = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handlePointerUp);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        const handlePointerMove = (event) => {
            if (!pendingDrag) return;
            const dx = event.clientX - pendingDrag.startX;
            const dy = event.clientY - pendingDrag.startY;
            if (!draggingEl && Math.hypot(dx, dy) >= dragThreshold) startPointerDrag(event, pendingDrag.group);
            if (!draggingEl) return;
            event.preventDefault();
            moveDraggedSection(event);
        };

        const handlePointerUp = (event) => {
            if (draggingEl) moveDraggedSection(event);
            removePointerListeners();
            finishPointerDrag();
        };

        const handleMouseMove = (event) => {
            if (!pendingDrag) return;
            if (!draggingEl) startPointerDrag(event, pendingDrag.group);
            event.preventDefault();
            moveDraggedSection(event);
        };

        const handleMouseUp = (event) => {
            if (draggingEl) moveDraggedSection(event);
            removePointerListeners();
            finishPointerDrag();
        };

        root.querySelectorAll('.search-results-group[data-search-result-section]').forEach(group => {
            if (group.dataset.searchResultDragBound === '1') return;
            group.dataset.searchResultDragBound = '1';
            group.draggable = false;

            group.addEventListener('pointerdown', (event) => {
                if (!canStartFromTarget(event, group)) return;
                pendingDrag = {
                    group,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY
                };
                startPointerDrag(event, group);
                document.addEventListener('pointermove', handlePointerMove, { passive: false });
                document.addEventListener('pointerup', handlePointerUp);
                document.addEventListener('pointercancel', handlePointerUp);
                document.addEventListener('mousemove', handleMouseMove, { passive: false });
                document.addEventListener('mouseup', handleMouseUp);
            });

            group.addEventListener('mousedown', (event) => {
                if (event.button !== 0 || !canStartFromTarget(event, group)) return;
                pendingDrag = {
                    group,
                    pointerId: 'mouse',
                    startX: event.clientX,
                    startY: event.clientY
                };
                startPointerDrag(event, group);
                document.addEventListener('mousemove', handleMouseMove, { passive: false });
                document.addEventListener('mouseup', handleMouseUp);
                event.preventDefault();
            });

            group.addEventListener('pointermove', (event) => {
                if (!pendingDrag || pendingDrag.group !== group || pendingDrag.pointerId !== event.pointerId) return;
                const dx = event.clientX - pendingDrag.startX;
                const dy = event.clientY - pendingDrag.startY;
                if (!draggingEl && Math.hypot(dx, dy) >= dragThreshold) startPointerDrag(event, group);
                if (!draggingEl) return;
                event.preventDefault();
                moveDraggedSection(event);
            });

            group.addEventListener('pointerup', handlePointerUp);
            group.addEventListener('pointercancel', handlePointerUp);

            group.addEventListener('dragstart', (event) => {
                if (!canStartFromTarget(event, group)) {
                    event.preventDefault();
                    return;
                }
                draggingEl = group;
                root.classList.add('is-reordering');
                clearDropIndicators();
                group.classList.add('search-section-dragging');
                if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
            });

            group.addEventListener('dragend', () => {
                group.classList.remove('search-section-dragging');
                root.classList.remove('is-reordering');
                clearDropIndicators();
                group.draggable = false;
                draggingEl = null;
                setSearchResultSectionOrder(Array.from(root.querySelectorAll('.search-results-group[data-search-result-section]'))
                    .map(node => node.dataset.searchResultSection)
                    .filter(Boolean));
                renderSearchResults();
            });

            group.addEventListener('dragover', (event) => {
                event.preventDefault();
                if (!draggingEl || draggingEl === group) return;
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
                const rect = group.getBoundingClientRect();
                const insertAfter = event.clientY > rect.top + rect.height / 2;
                setDropIndicator(group, insertAfter);
                root.insertBefore(draggingEl, insertAfter ? group.nextSibling : group);
            });
        });
    }

    function renderSearchWorkspace() {
        const root = getEl('search-workspace-root');
        if (!root) return;
        clearNodeChildren(root);
        const inSearchMode = typeof searchModeActive !== 'undefined' && searchModeActive;
        const hasQuery = normalizeSearchText(searchQuery).length > 0;
        const hasScopedFilter = searchFilters && !searchFilters.has('all');
        const shouldShowWorkspace = inSearchMode && (hasQuery || searchWorkspaceEditing);
        if (inSearchMode && hasQuery && hasScopedFilter && !searchWorkspaceEditing) {
            root.style.display = 'none';
            root.classList.remove('is-editing');
            return;
        }
        root.style.display = shouldShowWorkspace ? 'grid' : 'none';
        root.classList.toggle('is-editing', Boolean(searchWorkspaceEditing));
        if (!shouldShowWorkspace) return;

        const header = document.createElement('div');
        header.className = 'search-workspace-header';
        header.innerHTML = '<h2>Search</h2>';
        root.appendChild(header);

        const scopeKey = getSearchWorkspaceScopeKey();
        const prefs = getSearchWorkspacePrefs(scopeKey);
        const sectionsPrefs = getSearchWorkspacePrefs(scopeKey);
        const workspaceSections = (searchWorkspaceEditing ? orderedSearchSections(true, scopeKey) : orderedSearchSections(false, scopeKey))
            .filter(section => searchWorkspaceSectionHasContent(section))
            .map(section => ({
                key: `workspace:${section.id}`,
                kind: 'workspace',
                id: section.id,
                title: section.title,
                icon: section.icon,
                hidden: sectionsPrefs.hidden.includes(section.id),
                hideable: true
            }));
        const sections = searchWorkspaceEditing
            ? orderUnifiedSearchSections(workspaceSections.concat(getSearchResultSectionEntries(scopeKey)), scopeKey)
            : workspaceSections;
        sections.forEach((section) => {
            const isHidden = Boolean(section.hidden);
            const isCollapsed = searchWorkspaceEditing
                ? !searchWorkspaceEditExpanded.has(section.key)
                : prefs.collapsed.includes(section.id);
            const card = document.createElement('section');
            card.className = 'search-workspace-section'
                + (section.kind === 'source' ? ' is-source-section' : '')
                + (isHidden ? ' is-hidden-section' : '')
                + (isCollapsed ? ' is-collapsed' : '');
            card.dataset.searchEditSection = section.key;
            if (section.kind === 'workspace') card.dataset.searchSection = section.id;
            if (section.kind === 'source') card.dataset.searchResultSection = section.id;
            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'search-workspace-section-header';
            sectionHeader.innerHTML = `
                <span class="search-workspace-section-icon">${getIconSvg(section.icon)}</span>
                <h3>${section.title}</h3>
                ${section.kind === 'source' ? `<span class="search-source-count">${(section.items || []).length} ${(section.items || []).length === 1 ? 'item' : 'items'}</span>` : ''}
            `;
            sectionHeader.appendChild(createSearchCollapseToggle({
                collapsed: isCollapsed,
                label: section.title,
                onToggle: () => searchWorkspaceEditing
                    ? toggleSearchEditSectionExpanded(section.key)
                    : toggleSearchWorkspaceSectionCollapsed(section.id)
            }));
            if (searchWorkspaceEditing) {
                let longPressTimer = 0;
                const cancelSectionLongPress = () => {
                    if (longPressTimer) window.clearTimeout(longPressTimer);
                    longPressTimer = 0;
                };
                sectionHeader.addEventListener('pointerdown', (event) => {
                    if (event.target?.closest?.('button, a')) return;
                    cancelSectionLongPress();
                    const startX = event.clientX;
                    const startY = event.clientY;
                    const cleanupLongPressWatch = () => {
                        document.removeEventListener('pointermove', cancelLongPressOnMove);
                        document.removeEventListener('mousemove', cancelLongPressOnMove);
                        document.removeEventListener('pointerup', cleanupLongPressWatch);
                        document.removeEventListener('mouseup', cleanupLongPressWatch);
                        document.removeEventListener('pointercancel', cleanupLongPressWatch);
                    };
                    const cancelLongPressOnMove = (moveEvent) => {
                        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 8) return;
                        cancelSectionLongPress();
                        cleanupLongPressWatch();
                    };
                    document.addEventListener('pointermove', cancelLongPressOnMove, { passive: true });
                    document.addEventListener('mousemove', cancelLongPressOnMove, { passive: true });
                    document.addEventListener('pointerup', cleanupLongPressWatch);
                    document.addEventListener('mouseup', cleanupLongPressWatch);
                    document.addEventListener('pointercancel', cleanupLongPressWatch);
                    longPressTimer = window.setTimeout(() => openSearchSectionOptions(section), 900);
                });
                ['pointermove', 'mousemove', 'pointerup', 'pointercancel', 'mouseleave'].forEach(type => {
                    sectionHeader.addEventListener(type, cancelSectionLongPress);
                });
                const actions = document.createElement('div');
                actions.className = 'search-workspace-section-actions';
                if (section.hideable) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'search-section-hide-btn';
                    btn.setAttribute('aria-label', isHidden ? 'Show section' : 'Hide section');
                    btn.innerHTML = isHidden
                        ? getIconSvg('open')
                        : '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"></path></svg>';
                    btn.addEventListener('click', () => toggleSearchWorkspaceSection(section.id));
                    actions.appendChild(btn);
                }
                sectionHeader.appendChild(actions);
            }
            card.appendChild(sectionHeader);
            if ((!isHidden || searchWorkspaceEditing) && !isCollapsed) {
                card.appendChild(section.kind === 'source'
                    ? buildSearchResultSectionContent(section)
                    : buildSearchWorkspaceContent(section));
            }
            root.appendChild(card);
        });
        if (searchWorkspaceEditing) bindSearchWorkspaceDrag(root);
    }

    function renderSearchState() {
        const results = getEl('search-results');
        const browse = getEl('search-browse');
        const libraryNav = getEl('library-nav-container');
        if (!results || !browse) return;

        const libScreen = getEl('library');
        const inSearchMode = typeof searchModeActive !== 'undefined' && searchModeActive;
        const shouldShowResults = inSearchMode && searchQuery.length > 0 && !searchWorkspaceEditing;

        if (inSearchMode) {
            if (libScreen) libScreen.classList.add('search-mode');
            browse.style.display = 'none';
            if (libraryNav) libraryNav.style.display = 'flex';
            results.style.display = shouldShowResults ? 'block' : 'none';
            if (shouldShowResults) renderSearchResults();
            renderSearchWorkspace();
            if (typeof syncLibraryCategoryOrder === 'function') syncLibraryCategoryOrder();
            if (typeof ensureLibraryEditControls === 'function') ensureLibraryEditControls();
        } else {
            if (libScreen) libScreen.classList.remove('search-mode');
            browse.style.display = 'none';
            results.style.display = 'none';
            if (libraryNav) libraryNav.style.display = 'grid';
            renderSearchWorkspace();
            if (typeof syncLibraryCategoryOrder === 'function') syncLibraryCategoryOrder();
            if (typeof ensureLibraryEditControls === 'function') ensureLibraryEditControls();
        }

        syncSearchFilterControls();
        updateSortIndicators();
    }

    function setSort(sortName) {
        currentSort = normalizeSortLabel(sortName);
        safeStorage.setItem(STORAGE_KEYS.sort, currentSort);
        toast(`Sorting: ${currentSort}`);
        renderSearchState();
        updateSortIndicators();
    }

    function openSearchSort() {
        if (!(typeof searchModeActive !== 'undefined' && searchModeActive)) {
            enterSearchMode();
            getEl('search-input')?.focus();
            return;
        }
        getEl('sheet-title').innerText = 'Sort & Order';
        getEl('sheet-sub').innerText = `Current: ${currentSort}`;
        const actions = document.querySelectorAll('#action-sheet .sheet-action');

        if (actions.length > 3) {
            actions[0].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg> Recently Added';
            actions[1].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg> A-Z';
            actions[2].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Most Played';
            actions[3].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> Duration';

            actions[0].onclick = () => { setSort('Recently Added'); closeSheet(); };
            actions[1].onclick = () => { setSort('A-Z'); closeSheet(); };
            actions[2].onclick = () => { setSort('Most Played'); closeSheet(); };
            actions[3].onclick = () => { setSort('Duration'); closeSheet(); };
        }

        openSheet('Sort & Order', `Current: ${currentSort}`, { icon: 'filter' });
    }

    function syncSearchFilterControls() {
        document.querySelectorAll('[data-filter]').forEach(node => {
            const filter = node.dataset.filter;
            const isActive = searchFilters.has(filter) || (filter === 'all' && searchFilters.has('all'));
            node.classList.toggle('active', node.classList.contains('filter-chip') && isActive);
            node.classList.toggle('is-search-filter-active', node.classList.contains('library-nav-item') && isActive);
            if (node.classList.contains('library-nav-item')) {
                node.setAttribute('aria-pressed', String(isActive));
            }
        });
        const clearBtn = getEl('search-clear-btn');
        if (clearBtn) clearBtn.hidden = !(typeof searchModeActive !== 'undefined' && searchModeActive);
    }

    function setSearchFilter(filter) {
        filter = SEARCH_SCOPE_TYPES.includes(filter) ? filter : 'all';

        // Radio-style: one selection at a time; clicking active non-all â†’ back to all
        if (filter === 'all' || searchFilters.has(filter)) {
            searchFilters.clear();
            searchFilters.add('all');
        } else {
            searchFilters.clear();
            searchFilters.add(filter);
        }

        searchModeActive = Boolean(searchModeActive || normalizeSearchText(searchQuery).length);
        syncSearchFilterControls();
        persistSearchUiState();
        renderSearchState();
    }

    function toggleSearchFilter(chip) {
        if (!chip) return;
        setSearchFilter(chip.dataset.filter);
    }
    // Player / Media
