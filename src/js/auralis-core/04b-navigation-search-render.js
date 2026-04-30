/*
 * Auralis JS shard: 04b-navigation-search-render.js
 * Purpose: search rows, search render, sort/filter, playback routing, playlist detail
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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

        clickable.addEventListener('click', item.action);
        clickable.addEventListener('mousedown', (e) => startLongPress(e, item.title, item.subtitle));
        clickable.addEventListener('mouseup', clearLongPress);
        clickable.addEventListener('mouseleave', clearLongPress);
        clickable.addEventListener('touchstart', (e) => startLongPress(e, item.title, item.subtitle), { passive: true });
        clickable.addEventListener('touchend', clearLongPress, { passive: true });

        row.appendChild(clickable);
        return row;
    }

    function renderSearchResults() {
        const resultsEl = getEl('search-results');
        if (!resultsEl) return;

        const activeTypes = getActiveFilterTypes();
        const q = normalizeSearchText(searchQuery);

        let filtered = SEARCH_DATA.map((item) => {
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

        searchViewMode = normalizeSearchViewMode(searchViewMode);
        syncSearchViewModeControls();

        const wrap = document.createElement('div');
        wrap.className = searchViewMode === 'list'
            ? 'list-wrap search-results-list'
            : `search-results-cards search-results-${searchViewMode}`;
        wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'card';
            empty.style.cssText = 'padding:20px; text-align:center;';
            const title = document.createElement('h3');
            title.style.marginBottom = '8px';
            title.textContent = searchQuery ? `No results for "${searchQuery}"` : 'No matching media';
            const copy = document.createElement('p');
            copy.style.margin = '0';
            copy.textContent = 'Try another filter or clear your query.';
            empty.appendChild(title);
            empty.appendChild(copy);
            resultsEl.appendChild(empty);
            return;
        }

        filtered.forEach(item => wrap.appendChild(searchViewMode === 'list' ? buildSearchRow(item) : buildSearchCard(item)));
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

    function renderSearchState() {
        const results = getEl('search-results');
        const browse = getEl('search-browse');
        const libTabs = getEl('lib-tabs-container');
        const searchFilterRow = getEl('search-filter-row');
        const searchTagRow = getEl('search-tag-row');
        if (!results || !browse) return;

        const libScreen = getEl('library');
        const inSearchMode = typeof searchModeActive !== 'undefined' && searchModeActive;

        if (inSearchMode) {
            if (libScreen) libScreen.classList.add('search-mode');
            browse.style.display = 'none';
            if (libTabs) libTabs.style.display = 'none';
            if (searchFilterRow) searchFilterRow.style.display = 'flex';
            // show results only when there is an actual query
            results.style.display = searchQuery.length > 0 ? 'block' : 'none';
            if (searchQuery.length > 0) renderSearchResults();
        } else {
            if (libScreen) libScreen.classList.remove('search-mode');
            browse.style.display = 'none';
            results.style.display = 'none';
            if (libTabs) libTabs.style.display = 'block';
            if (searchFilterRow) searchFilterRow.style.display = 'none';
        }

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

        openSheet('Sort & Order', `Current: ${currentSort}`);
    }

    function toggleSearchFilter(chip) {
        const row = getEl('search-filter-row');
        if (!row || !chip) return;
        const filter = chip.dataset.filter;

        // Radio-style: one selection at a time; clicking active non-all â†’ back to all
        if (filter === 'all' || searchFilters.has(filter)) {
            searchFilters.clear();
            searchFilters.add('all');
        } else {
            searchFilters.clear();
            searchFilters.add(filter);
        }

        row.querySelectorAll('.filter-chip').forEach(node => {
            const f = node.dataset.filter;
            node.classList.toggle('active', searchFilters.has(f));
        });

        renderSearchState();
    }
    // Player / Media
    function playTrack(title, artist, albumHint) {
        const track = resolveTrackMeta(title, artist, albumHint);
        setPlaybackCollection('', '');
        const idx = queueTracks.findIndex(q => trackKey(q.title, q.artist) === trackKey(track.title, track.artist));
        if (idx >= 0) queueTracks.splice(idx, 1);
        queueTracks.unshift(track);
        if (queueTracks.length > 60) queueTracks = queueTracks.slice(0, 60);
        queueIndex = 0;
        renderQueue();
        setNowPlaying(track, true);
        loadTrackIntoEngine(track, true, true);
    }

    function playAlbumInOrder(albumTitle, startTrackIndex = 0, albumArtist = '') {
        const albumMeta = resolveAlbumMeta(albumTitle, albumArtist || activeAlbumArtist);
        if (!albumMeta || !albumMeta.tracks.length) return;
        activeAlbumTitle = albumMeta.title;
        activeAlbumArtist = getAlbumPrimaryArtistName(albumMeta, albumArtist);
        setPlaybackCollection('album', getAlbumIdentityKey(albumMeta, albumArtist));
        queueTracks = albumMeta.tracks.slice().sort((a, b) =>
            Number(a.discNo || 1) - Number(b.discNo || 1)
            || Number(a.no || 0) - Number(b.no || 0)
        );
        queueIndex = Math.max(0, Math.min(startTrackIndex, queueTracks.length - 1));
        const track = queueTracks[queueIndex];
        setNowPlaying(track, true);
        renderQueue();
        loadTrackIntoEngine(track, true, true);
        updateAlbumProgressLine(0, track.durationSec || 0);
    }

    function playPlaylistInOrder(playlistId, startTrackIndex = 0) {
        const playlist = playlistById.get(playlistId);
        if (!playlist || !playlist.tracks.length) return;
        activePlaylistId = playlist.id;
        setPlaybackCollection('playlist', playlist.id);
        queueTracks = playlist.tracks.slice();
        queueIndex = Math.max(0, Math.min(startTrackIndex, queueTracks.length - 1));
        const track = queueTracks[queueIndex];
        setNowPlaying(track, true);
        renderQueue();
        loadTrackIntoEngine(track, true, true);
    }

    function openArtistProfile(name) {
        activeArtistName = name || ARTIST_NAME;
        push('artist_profile');
        renderArtistProfileView();
    }

    function routeToArtistProfile(name) {
        if (!name) return;
        const normalized = toArtistKey(name);
        const resolved = artistByKey.get(normalized)
            || LIBRARY_ARTISTS.find((artist) => toArtistKey(artist?.name) === normalized)
            || LIBRARY_ALBUMS.find((album) => toArtistKey(album?.artist) === normalized);
        if (!resolved) {
            toast('Artist unavailable');
            return;
        }
        openArtistProfile(resolved.name || resolved.artist || name);
    }

    function routeToAlbumDetail(title, artist, sourceAlbumId = '') {
        if (!title) return;
        navToAlbum(title, artist, sourceAlbumId);
    }

    function routeToPlaylistDetail(id) {
        if (!id) return;
        const playlist = playlistById.get(id);
        if (playlist && playlist.sourceType === 'album_proxy') {
            routeToAlbumDetail(playlist.sourceAlbumTitle || playlist.title, playlist.sourceAlbumArtist || playlist.artist);
            return;
        }
        openPlaylist(id);
    }

    function routeToPlaylistByIndex(index = 0) {
        const list = Array.isArray(LIBRARY_PLAYLISTS) ? LIBRARY_PLAYLISTS : [];
        if (!list.length) {
            toast('No playlists available');
            return;
        }
        const numericIndex = Number(index);
        const safeIndex = Number.isFinite(numericIndex)
            ? Math.max(0, Math.min(Math.round(numericIndex), list.length - 1))
            : 0;
        const playlist = list[safeIndex] || list[0];
        if (!playlist?.id) {
            toast('Playlist unavailable');
            return;
        }
        routeToPlaylistDetail(playlist.id);
    }

    function routeToGenreBrowse(genre) {
        const value = String(genre || '').trim();
        if (!value) {
            toast('No genre metadata found');
            return;
        }
        routeToSearchQuery(value, ['songs', 'albums']);
        toast(`Browsing genre: ${value}`);
    }

    function openPlaylist(playlistId) {
        const playlist = playlistById.get(playlistId);
        if (!playlist) return;
        if (playlist.sourceType === 'album_proxy') {
            navToAlbum(playlist.sourceAlbumTitle || playlist.title, playlist.sourceAlbumArtist || playlist.artist);
            return;
        }
        activePlaylistId = playlist.id;

        const cover   = getEl('playlist-hero-cover');
        const titleEl = getEl('playlist-title');
        const subEl   = getEl('playlist-subtitle');
        const playBtn = getEl('playlist-play-btn');
        const list    = getEl('playlist-track-list');

        applyArtBackground(cover, playlist.artUrl, FALLBACK_GRADIENT);
        if (titleEl) titleEl.textContent = playlist.title || playlist.name;
        if (subEl) {
            const tc = playlist.tracks.length;
            subEl.textContent = `${tc} ${tc === 1 ? 'song' : 'songs'}`;
        }
        if (playBtn) {
            playBtn.dataset.collectionType = 'playlist';
            playBtn.dataset.collectionKey = String(playlist.id || '');
            playBtn.onclick = (evt) => {
                if (isCollectionActive('playlist', playlist.id)) {
                    togglePlayback(evt);
                    return;
                }
                playPlaylistInOrder(playlist.id, 0);
            };
        }

        if (list) {
            clearTrackUiRegistryForRoot(list);
            list.innerHTML = '';
            if (!playlist.tracks.length) {
                list.appendChild(createScreenEmptyState({
                    title: 'This playlist is empty',
                    body: 'Add songs from Search, Library, or the Queue.',
                    iconName: 'playlist',
                    action: { label: 'Add Songs', action: 'openAddSongsToPlaylist' }
                }));
            } else {
                playlist.tracks.slice(0, 200).forEach((track, idx) => {
                    list.appendChild(makeAlbumTrackRow(track, idx, {
                        onActivate: () => playPlaylistInOrder(playlist.id, idx),
                        onLongPress: () => openTrackZenithMenu(track),
                        isLast: idx === Math.min(playlist.tracks.length, 200) - 1,
                        showArtist: true
                    }));
                });
            }
        }

        setPlayButtonState(isPlaying);
        push('playlist_detail');
        ensureAccessibility();
    }

