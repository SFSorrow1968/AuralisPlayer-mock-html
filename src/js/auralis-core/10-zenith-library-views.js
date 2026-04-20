/*
 * Auralis JS shard: 10-zenith-library-views.js
 * Purpose: favorites, artist, search, sidebar, library render refresh
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        const allTabs = ['playlists', 'albums', 'artists', 'songs', 'genres', 'folders'];
        // Remove active from all tab buttons
        allTabs.forEach(name => getEl('lib-btn-' + name)?.classList.remove('active'));
        getEl('lib-btn-' + tab)?.classList.add('active');
        allTabs.forEach(name => {
            const el = getEl('lib-view-' + name);
            if (el) el.style.display = 'none';
        });
        const next = getEl('lib-view-' + tab);
        if (next) next.style.display = 'block';
        // Lazy-render folder browser on first switch
        if (tab === 'folders') renderFolderBrowserView();
    }
    function appendEmptyMessage(container, message) {
        const box = document.createElement('div');
        box.className = 'home-section-empty';
        box.textContent = message;
        container.appendChild(box);
    }

    let libSongsSortMode = 'alpha';

    function switchLibSongsSort(mode) {
        libSongsSortMode = mode || 'alpha';
        document.querySelectorAll('#lib-songs-sort-row .filter-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === libSongsSortMode);
        });
        const songsList = getEl('lib-songs-list');
        if (!songsList) return;
        clearTrackUiRegistryForRoot(songsList);
        songsList.innerHTML = '';
        const tracks = getSortedTracks(libSongsSortMode);
        tracks.forEach((track, idx) => {
            const row = createLibrarySongRow(track, true, { compact: true, hideAlbum: false, showDuration: true, metaContext: 'library' });
            if (idx === tracks.length - 1) row.style.border = 'none';
            songsList.appendChild(row);
        });
        scheduleTitleMotion(songsList);
    }

    let _libraryMetadataSubscriberBound = false;
    function bindLibraryMetadataSubscriber() {
        if (_libraryMetadataSubscriberBound) return;
        _libraryMetadataSubscriberBound = true;
        APP_STATE.on('library:metadata-refined', ({ trackKey: refinedTrackKey, previousTrackKey, albumKey: refinedAlbumKey }) => {
            const candidateKeys = [previousTrackKey, refinedTrackKey].filter(Boolean);
            const track = trackByKey.get(refinedTrackKey) || candidateKeys.map((key) => trackByKey.get(key)).find(Boolean);
            if (!track) return;

            candidateKeys.forEach((candidateKey) => {
                getTrackUiBindings(candidateKey).forEach((binding) => {
                    if (binding?.row) binding.row.dataset.trackKey = refinedTrackKey;
                    if (binding?.click) {
                        binding.click.dataset.trackKey = refinedTrackKey;
                        binding.click.dataset.title = track.title;
                        binding.click.dataset.artist = track.artist;
                        binding.click.dataset.album = track.albumTitle;
                    }
                    const titleTrack = binding?.title?.querySelector('.zenith-title-track');
                    if (titleTrack) titleTrack.textContent = track.title || '';
                    (binding?.durations || []).forEach((timeEl) => {
                        if (!timeEl) return;
                        timeEl.dataset.originalDuration = track.duration || '--:--';
                        if (!(binding?.row?.classList?.contains('playing-row'))) {
                            timeEl.textContent = timeEl.dataset.originalDuration;
                        }
                    });
                    (binding?.arts || []).forEach((artEl) => applyArtBackground(artEl, track.artUrl, FALLBACK_GRADIENT));
                    unregisterTrackUi(candidateKey, binding);
                    registerTrackUi(refinedTrackKey, binding);
                });
            });

            document.querySelectorAll('.media-card[data-album-key], .list-item[data-album-key]').forEach((el) => {
                if (String(el.dataset.albumKey || '') !== String(refinedAlbumKey || '')) return;
                const artTarget = el.querySelector('.media-cover, .item-icon');
                if (artTarget) applyArtBackground(artTarget, track.artUrl, FALLBACK_GRADIENT);
            });
            scheduleTitleMotion(document);
        });
    }

    function renderArtistProfileView() {
        const artistScreen = getEl('artist_profile');
        if (!artistScreen) return;
        const fallback = LIBRARY_ARTISTS[0]?.name || ARTIST_NAME;
        const selected = activeArtistName || fallback;
        const selectedKey = toArtistKey(selected);
        const fallbackKey = toArtistKey(fallback);
        const artist = artistByKey.get(selectedKey)
            || LIBRARY_ARTISTS.find((entry) => toArtistKey(entry?.name) === selectedKey)
            || artistByKey.get(fallbackKey)
            || LIBRARY_ARTISTS.find((entry) => toArtistKey(entry?.name) === fallbackKey);
        if (!artist) return;
        activeArtistName = artist.name;

        applyArtBackground(artistScreen.querySelector('.artist-bg'), artist.artUrl, FALLBACK_GRADIENT);
        const nameEl = getEl('art-name');
        if (nameEl) nameEl.textContent = artist.name;
        const metaEl = getEl('art-meta');
        if (metaEl) {
            const summary = getArtistSummary(artist.name);
            const albumLabel = `${summary.albumCount} album${summary.albumCount === 1 ? '' : 's'}`;
            const trackLabel = `${summary.trackCount} track${summary.trackCount === 1 ? '' : 's'}`;
            metaEl.textContent = `${albumLabel} • ${trackLabel}`;
        }

        const topWrap = artistScreen.querySelectorAll('.list-wrap')[0];
        if (topWrap) {
            clearTrackUiRegistryForRoot(topWrap);
            topWrap.innerHTML = '';
            LIBRARY_TRACKS
                .filter(track => toArtistKey(getCanonicalTrackArtistName(track)) === toArtistKey(artist.name))
                .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0))
                .slice(0, 8)
                .forEach((track, idx, arr) => {
                    const row = createLibrarySongRow(track, true, { compact: true, hideAlbum: false, showDuration: true, metaContext: 'artist_profile' });
                    const num = document.createElement('span');
                    num.className = 'track-num';
                    num.textContent = String(idx + 1);
                    row.querySelector('.item-clickable')?.insertBefore(num, row.querySelector('.item-clickable').firstChild);
                    if (idx === arr.length - 1) row.style.border = 'none';
                    topWrap.appendChild(row);
                });
        }

        const releases = artistScreen.querySelector('.horizon-scroller');
        if (releases) {
            releases.innerHTML = '';
            LIBRARY_ALBUMS
                .filter(album => toArtistKey(album.artist) === toArtistKey(artist.name))
                .slice(0, 8)
                .forEach(album => releases.appendChild(createCollectionCard('album', album, 'large', false, 'artist_profile')));
        }
    }

    function renderSearchBrowseGrid() {
        const grid = getEl('search-cat-grid');
        if (!grid) return;
        grid.innerHTML = '';
        getSortedAlbums('recent').slice(0, 8).forEach((album, idx) => {
            const card = document.createElement('div');
            card.className = 'cat-card';
            card.draggable = true;
            card.dataset.added = String(Math.max(1, 100 - idx));
            card.dataset.plays = String(Number(album.plays || 0));
            card.dataset.duration = String(album.tracks?.[0]?.durationSec || 0);
            card.dataset.albumTitle = album.title;
            applyArtBackground(card, album.artUrl, FALLBACK_GRADIENT);
            if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, card);
            card.style.border = '1px solid rgba(255,255,255,0.2)';
            card.onclick = () => routeToAlbum(album.title, album.artist);
            bindLongPressAction(card, () => {
                if (typeof openAlbumZenithMenu !== 'function') return;
                const albumMeta = typeof resolveAlbumMeta === 'function' ? resolveAlbumMeta(album.title, album.artist) : album;
                if (albumMeta) openAlbumZenithMenu(albumMeta);
            });
            const span = document.createElement('span');
            span.textContent = album.title;
            span.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
            card.appendChild(span);
            grid.appendChild(card);
        });
    }

    function renderSidebarPlaylists() {
        const list = getEl('sidebar-playlists-list');
        if (!list) return;
        list.innerHTML = '';
        LIBRARY_PLAYLISTS.slice(0, 10).forEach((playlist, idx) => {
            const row = createCollectionRow('playlist', playlist, 'sidebar');
            row.style.padding = '14px 0';
            if (idx === Math.min(LIBRARY_PLAYLISTS.length, 10) - 1) row.style.border = 'none';
            row.querySelector('.item-clickable')?.addEventListener('click', () => closeSidebar(), { once: true });
            list.appendChild(row);
        });
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

        if (playlistsList) {
            playlistsList.innerHTML = '';
            if (!LIBRARY_PLAYLISTS.length) {
                appendEmptyMessage(playlistsList, 'No playlists yet.');
            } else {
                LIBRARY_PLAYLISTS.slice(0, 12).forEach((playlist, idx) => {
                    const row = createCollectionRow('playlist', playlist, 'library');
                    if (idx === Math.min(LIBRARY_PLAYLISTS.length, 12) - 1) row.style.border = 'none';
                    playlistsList.appendChild(row);
                });
            }
        }

        if (albumsGrid) {
            albumsGrid.innerHTML = '';
            getSortedAlbums('most_played').slice(0, 12).forEach(album => albumsGrid.appendChild(createCollectionCard('album', album, 'compact', true, 'library')));
        }

        if (artistsList) {
            artistsList.innerHTML = '';
            getSortedArtists('most_played').slice(0, 12).forEach((artist, idx) => {
                const row = createCollectionRow('artist', artist, 'library');
                if (idx === Math.min(LIBRARY_ARTISTS.length, 12) - 1) row.style.border = 'none';
                artistsList.appendChild(row);
            });
        }

        if (songsList) {
            clearTrackUiRegistryForRoot(songsList);
            songsList.innerHTML = '';
            const tracks = getSortedTracks(libSongsSortMode);
            tracks.forEach((track, idx) => {
                const row = createLibrarySongRow(track, true, { compact: true, hideAlbum: false, showDuration: true, metaContext: 'library' });
                if (idx === tracks.length - 1) row.style.border = 'none';
                songsList.appendChild(row);
            });
        }

        if (genresView) {
            genresView.innerHTML = '';
            const buckets = getGenreBuckets();
            if (!buckets.length) {
                appendEmptyMessage(genresView, 'No tagged genres yet.');
            } else {
                const palette = ['#1F2937', '#0F766E', '#7C2D12', '#3B0764', '#0B3D91', '#5B21B6', '#7F1D1D', '#164E63'];
                const grid = document.createElement('div');
                grid.className = 'cat-grid';
                grid.style.marginTop = '8px';
                buckets.slice(0, 12).forEach((bucket, idx) => {
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
                    main.textContent = bucket.name;
                    const count = document.createElement('small');
                    count.style.fontSize = '11px';
                    count.style.opacity = '0.85';
                    count.textContent = `${bucket.trackCount} tracks`;
                    label.appendChild(main);
                    label.appendChild(count);
                    card.appendChild(label);
                    grid.appendChild(card);
                });
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
        container.innerHTML = '';

        const albums = Array.isArray(LIBRARY_ALBUMS) ? LIBRARY_ALBUMS : [];
        if (!albums.length) {
            const empty = document.createElement('div');
            empty.className = 'home-section-empty';
            empty.textContent = 'No folders found. Scan a music library to browse by folder.';
            container.appendChild(empty);
            return;
        }

        // Derive folder path from album id: '_scanned_<folderId>::<subDir>'
        // Albums not following this pattern (e.g. manual playlists) use root '/'.
        function folderPathFromAlbum(album) {
            if (!album || !album.id) return '/';
            const raw = String(album.id);
            const colonIdx = raw.indexOf('::');
            if (colonIdx === -1) return '/';
            const subDir = raw.slice(colonIdx + 2).trim();
            if (!subDir) return '/';
            // subDir is the relative path inside the folder root
            // Take the parent segments (strip the album leaf if it looks like a known album)
            const parts = subDir.split('/').filter(Boolean);
            return parts.length > 1 ? parts.slice(0, -1).join('/') : (parts[0] || '/');
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
                <span style="flex:1; font-weight:600; font-size:15px;">${escapeHTML(displayName)}</span>
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
                        ${escapeHTML(album.title || 'Unknown Album')}${compilation}
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHTML(albumArtist)}${escapeHTML(year)} · ${album.trackCount || 0} tracks
                    </div>`;

                row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (typeof openAlbumZenithMenu === 'function') openAlbumZenithMenu(album);
                });
                row.addEventListener('click', () => {
                    if (typeof routeToAlbumDetail === 'function') {
                        routeToAlbumDetail(album.title, album.artist);
                    }
                });

                row.appendChild(thumb);
                row.appendChild(info);
                albumsGrid.appendChild(row);
            });

            container.appendChild(header);
            container.appendChild(albumsGrid);
        });
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

