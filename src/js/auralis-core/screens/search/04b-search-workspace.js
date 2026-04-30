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

    function buildSearchRow(item) {
        if (item?.type === 'songs' && typeof createLibrarySongRow === 'function') {
            const track = resolveTrackMeta(item.title, item.artist, item.albumTitle);
            const row = createLibrarySongRow(track, true, {
                compact: true,
                showDuration: true,
                hideAlbum: false,
                metaContext: 'search'
            });
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
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
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'albums';
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
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'artists';
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
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'playlists';
            row.addEventListener('click', () => rememberMediaSearchActivation(makeSearchHistoryEntry('playlist', playlist, { query: searchQuery, icon: 'playlist' })), { capture: true });
            return row;
        }

        const row = document.createElement('div');
        row.className = 'list-item';
        row.style.cssText = 'padding:12px 0; border-color:var(--border-default);';
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
            if (!folderMap.has(folder)) folderMap.set(folder, { albums: [], tracks: 0 });
            const bucket = folderMap.get(folder);
            bucket.albums.push(album);
            bucket.tracks += Number(album?.trackCount || album?.tracks?.length || 0);
        });

        return Array.from(folderMap.entries()).map(([folder, bucket]) => ({
            type: 'folders',
            title: folder,
            subtitle: `${bucket.albums.length} albums - ${bucket.tracks} tracks`,
            added: bucket.albums.length,
            plays: bucket.tracks,
            duration: bucket.tracks,
            action: () => {
                if (typeof exitSearchMode === 'function') exitSearchMode();
                switchLib('folders');
            },
            _searchIndex: createSearchIndex({
                title: folder,
                albums: bucket.albums.map(album => album.title || ''),
                tracks: bucket.albums.flatMap(album => (album.tracks || []).map(track => track.title || ''))
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
        clearTrackUiRegistryForRoot(resultsEl);
        resultsEl.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'list-wrap';
        wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';

        if (filtered.length === 0) {
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
                body: 'Try another filter.',
                iconName: scopedIcon || 'library'
            }));
            return;
        }

        filtered.forEach(item => wrap.appendChild(buildSearchRow(item)));
        resultsEl.appendChild(wrap);
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
        { id: 'recentlyAdded', title: 'Recently Added', icon: 'library' }
    ];
    let searchWorkspaceEditing = false;

    function getSearchWorkspacePrefs() {
        const stored = getUiPreference('searchSections', {});
        const prefs = stored && typeof stored === 'object' ? stored : {};
        return {
            order: Array.isArray(prefs.order) ? prefs.order.filter(Boolean) : SEARCH_WORKSPACE_SECTIONS.map(section => section.id),
            hidden: Array.isArray(prefs.hidden) ? prefs.hidden.filter(Boolean) : []
        };
    }

    function persistSearchWorkspacePrefs(prefs) {
        setUiPreference('searchSections', {
            order: Array.isArray(prefs.order) ? prefs.order : SEARCH_WORKSPACE_SECTIONS.map(section => section.id),
            hidden: Array.isArray(prefs.hidden) ? prefs.hidden : []
        });
    }

    function orderedSearchSections(includeHidden = false) {
        const prefs = getSearchWorkspacePrefs();
        const map = new Map(SEARCH_WORKSPACE_SECTIONS.map(section => [section.id, section]));
        const orderedIds = prefs.order.concat(SEARCH_WORKSPACE_SECTIONS.map(section => section.id))
            .filter((id, index, list) => map.has(id) && list.indexOf(id) === index);
        return orderedIds
            .filter(id => includeHidden || !prefs.hidden.includes(id))
            .map(id => map.get(id));
    }

    function moveSearchWorkspaceSection(sectionId, delta) {
        const prefs = getSearchWorkspacePrefs();
        const orderedIds = orderedSearchSections(true).map(section => section.id);
        const index = orderedIds.indexOf(sectionId);
        const nextIndex = index + delta;
        if (index < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) return;
        const [item] = orderedIds.splice(index, 1);
        orderedIds.splice(nextIndex, 0, item);
        prefs.order = orderedIds;
        persistSearchWorkspacePrefs(prefs);
        renderSearchWorkspace();
    }

    function toggleSearchWorkspaceSection(sectionId) {
        const prefs = getSearchWorkspacePrefs();
        const hidden = new Set(prefs.hidden);
        if (hidden.has(sectionId)) hidden.delete(sectionId);
        else hidden.add(sectionId);
        prefs.hidden = Array.from(hidden);
        persistSearchWorkspacePrefs(prefs);
        renderSearchWorkspace();
    }

    function toggleSearchWorkspaceEdit() {
        searchWorkspaceEditing = !searchWorkspaceEditing;
        renderSearchWorkspace();
    }

    function createSearchWorkspaceEmpty(iconName, title, body) {
        const empty = document.createElement('div');
        empty.className = 'search-section-empty';
        empty.innerHTML = `
            <div class="search-section-empty-icon">${getIconSvg(iconName)}</div>
            <strong>${title}</strong>
            <span>${body}</span>
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

    function getRecentSearchTracksForWorkspace() {
        const tracks = Array.isArray(LIBRARY_TRACKS) ? LIBRARY_TRACKS : [];
        const q = normalizeSearchText(searchQuery);
        if (!q) return [];
        return tracks
            .filter(track => createSearchIndex({
                title: track.title || '',
                artist: track.artist || '',
                album: track.albumTitle || '',
                genre: track.genre || ''
            }).text.includes(q))
            .slice(0, 8);
    }

    function searchWorkspaceSectionHasContent(section) {
        if (searchWorkspaceEditing) return true;
        if (section.id === 'history') {
            const q = normalizeSearchText(searchQuery);
            if (!q) return true;
            return getMediaSearchHistory().some(entry => createSearchIndex({
                title: entry.title || '',
                subtitle: entry.subtitle || '',
                type: entry.type || ''
            }).text.includes(q));
        }
        if (section.id === 'recentlyAdded') return getRecentSearchTracksForWorkspace().length > 0;
        return false;
    }

    function buildSearchWorkspaceContent(section) {
        const body = document.createElement('div');
        body.className = 'search-section-body';
        if (section.id === 'history') {
            const q = normalizeSearchText(searchQuery);
            const searches = getMediaSearchHistory().filter(entry => {
                if (!q || searchWorkspaceEditing) return true;
                return createSearchIndex({
                    title: entry.title || '',
                    subtitle: entry.subtitle || '',
                    type: entry.type || ''
                }).text.includes(q);
            });
            if (!searches.length) {
                body.appendChild(createSearchWorkspaceEmpty('filter', 'No recent searches', 'Searches appear here after you use them.'));
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
        const tracks = getRecentSearchTracksForWorkspace();
        if (!tracks.length) {
            body.appendChild(createSearchWorkspaceEmpty('music', 'No recent tracks', 'Indexed music will fill this section.'));
            return body;
        }
        tracks.forEach(track => {
            if (typeof createLibrarySongRow === 'function') {
                const row = createLibrarySongRow(track, true, {
                    compact: true,
                    showDuration: true,
                    hideAlbum: false,
                    metaContext: 'search'
                });
                row.classList.add('search-media-row');
                row.addEventListener('click', () => rememberMediaSearchActivation(makeSearchHistoryEntry('song', track, { query: searchQuery, icon: 'music' })), { capture: true });
                body.appendChild(row);
                return;
            }
            body.appendChild(createSearchWorkspaceButton(track.title || 'Untitled Track', 'music', () => {
                rememberMediaSearchActivation(makeSearchHistoryEntry('song', track, { query: searchQuery, icon: 'music' }));
                playTrack(track.title, track.artist, track.albumTitle);
            }, track.artist || track.albumTitle || ''));
        });
        return body;
    }

    function renderSearchWorkspace() {
        const root = getEl('search-workspace-root');
        if (!root) return;
        clearNodeChildren(root);
        const inSearchMode = typeof searchModeActive !== 'undefined' && searchModeActive;
        root.style.display = inSearchMode ? 'grid' : 'none';
        if (!inSearchMode) return;

        const header = document.createElement('div');
        header.className = 'search-workspace-header';
        header.innerHTML = '<h2>Search</h2>';
        root.appendChild(header);

        const prefs = getSearchWorkspacePrefs();
        const sections = (searchWorkspaceEditing ? orderedSearchSections(true) : orderedSearchSections(false))
            .filter(section => searchWorkspaceSectionHasContent(section));
        sections.forEach((section) => {
            const isHidden = prefs.hidden.includes(section.id);
            const card = document.createElement('section');
            card.className = 'search-workspace-section' + (isHidden ? ' is-hidden-section' : '');
            card.dataset.searchSection = section.id;
            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'search-workspace-section-header';
            sectionHeader.innerHTML = `
                <span class="search-workspace-section-icon">${getIconSvg(section.icon)}</span>
                <h3>${section.title}</h3>
            `;
            if (searchWorkspaceEditing) {
                const actions = document.createElement('div');
                actions.className = 'search-workspace-section-actions';
                [
                    ['Move section up', 'carousel', () => moveSearchWorkspaceSection(section.id, -1)],
                    ['Move section down', 'density', () => moveSearchWorkspaceSection(section.id, 1)],
                    [isHidden ? 'Show section' : 'Hide section', isHidden ? 'open' : 'trash', () => toggleSearchWorkspaceSection(section.id)]
                ].forEach(([label, iconName, handler]) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.setAttribute('aria-label', label);
                    btn.innerHTML = getIconSvg(iconName);
                    btn.addEventListener('click', handler);
                    actions.appendChild(btn);
                });
                sectionHeader.appendChild(actions);
            }
            card.appendChild(sectionHeader);
            if (!isHidden || searchWorkspaceEditing) card.appendChild(buildSearchWorkspaceContent(section));
            root.appendChild(card);
        });
    }

    function renderSearchState() {
        const results = getEl('search-results');
        const browse = getEl('search-browse');
        const libraryNav = getEl('library-nav-container');
        if (!results || !browse) return;

        const libScreen = getEl('library');
        const inSearchMode = typeof searchModeActive !== 'undefined' && searchModeActive;
        const hasScopedFilter = !searchFilters.has('all');
        const shouldShowResults = inSearchMode && (searchQuery.length > 0 || hasScopedFilter);

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
        if (clearBtn) clearBtn.hidden = !String(searchQuery || '').trim();
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

        syncSearchFilterControls();
        persistSearchUiState();
        renderSearchState();
    }

    function toggleSearchFilter(chip) {
        if (!chip) return;
        setSearchFilter(chip.dataset.filter);
    }
    // Player / Media