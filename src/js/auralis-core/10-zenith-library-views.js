/*
 * Auralis JS shard: 10-zenith-library-views.js
 * Purpose: favorites, artist, search, sidebar, library render refresh
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        getEl('lib-btn-' + tab)?.classList.add('active');
        ['playlists', 'albums', 'artists', 'songs', 'genres'].forEach(name => {
            const el = getEl('lib-view-' + name);
            if (el) el.style.display = 'none';
        });
        const next = getEl('lib-view-' + tab);
        if (next) next.style.display = 'block';
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

    function openSectionConfig(sectionRef) {
        if (sectionRef === 'Local Video Cache' || sectionRef === 'Dashboard') {
            presentActionSheet('Video Section', 'Static video mock section', [
                { label: 'Pin Section', description: 'Keep this section anchored at top.', icon: 'up', onSelect: () => openPlaceholderScreen('Pin Video Section', 'Video section pinning is still a placeholder in this build.') },
                { label: 'Show as Grid', description: 'Switch to visual poster layout.', icon: 'grid', onSelect: () => openPlaceholderScreen('Video Grid Layout', 'Video layout switching is still a placeholder in this build.') },
                { label: 'Sort by Date', description: 'Prioritize newest captures.', icon: 'filter', onSelect: () => openPlaceholderScreen('Sort Video Cache', 'Video cache sorting is still a placeholder in this build.') },
                { label: 'Close', description: '', icon: 'stack', onSelect: () => {} }
            ]);
            return;
        }
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

