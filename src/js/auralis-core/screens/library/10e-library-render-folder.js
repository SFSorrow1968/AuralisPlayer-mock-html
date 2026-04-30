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
