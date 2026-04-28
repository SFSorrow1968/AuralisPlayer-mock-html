/*
 * Auralis JS shard: 04c-navigation-album-home.js
 * Purpose: playlist menus, album detail, home sections, queue rendering
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    // â”€â”€ Playlist zenith menu (3-dot) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function openPlaylistZenithMenu() {
        const pl = userPlaylists.find(p => p.id === activePlaylistId);
        if (!pl) return;
        showZenithActionSheet(
            pl.name || pl.title,
            `${pl.tracks.length} songs`,
            [
                {
                    label: 'Add Songs',
                    description: 'Browse your library and add tracks.',
                    icon: 'queue',
                    onSelect: () => openAddSongsToPlaylist()
                },
                {
                    label: 'Rename Playlist',
                    description: 'Give this playlist a new name.',
                    icon: 'manage',
                    onSelect: () => {
                        const newName = prompt('New name:', pl.name || pl.title);
                        if (newName && newName.trim()) {
                            if (typeof renameUserPlaylist === 'function') renameUserPlaylist(pl.id, newName.trim());
                            const titleEl = getEl('playlist-title');
                            if (titleEl) titleEl.textContent = newName.trim();
                        }
                    }
                },
                {
                    label: 'Delete Playlist',
                    description: 'Permanently remove this playlist.',
                    icon: 'trash',
                    danger: true,
                    onSelect: () => {
                        showConfirm(
                            `Delete "${pl.name || pl.title}"?`,
                            'This playlist will be permanently deleted.',
                            'Delete',
                            () => {
                                deleteUserPlaylist(pl.id);
                                activePlaylistId = '';
                                pop();
                                setLibraryRenderDirty(true);
                                renderLibraryViews({ force: true });
                            }
                        );
                    }
                }
            ]
        );
    }

    // â”€â”€ Add Songs to Playlist overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function openAddSongsToPlaylist() {
        const scrim = getEl('add-songs-scrim');
        const searchInput = getEl('add-songs-search');
        const listEl = getEl('add-songs-list');
        if (!scrim || !listEl) return;

        function renderSongList(query) {
            listEl.innerHTML = '';
            const q = (query || '').toLowerCase();
            const tracks = Array.isArray(LIBRARY_TRACKS) ? LIBRARY_TRACKS : [];
            const filtered = q ? tracks.filter(t =>
                (t.title || '').toLowerCase().includes(q) ||
                (t.artist || '').toLowerCase().includes(q)
            ) : tracks;
            if (!filtered.length) {
                const empty = document.createElement('p');
                empty.style.cssText = 'color:var(--text-tertiary); font-size:14px; padding:12px 0;';
                empty.textContent = q ? 'No matching songs.' : 'No songs in library yet.';
                listEl.appendChild(empty);
                return;
            }
            filtered.slice(0, 300).forEach(track => {
                const row = document.createElement('div');
                row.className = 'list-item album-track-row';
                row.style.cssText = 'padding:10px 0 !important; cursor:pointer;';
                const btn = document.createElement('button');
                btn.className = 'item-clickable';
                btn.type = 'button';
                btn.style.cssText = 'gap:12px; align-items:center; width:100%;';
                const content = document.createElement('div');
                content.className = 'item-content';
                const t = document.createElement('h3');
                t.style.fontSize = '14px';
                t.textContent = track.title;
                const a = document.createElement('span');
                a.style.cssText = 'font-size:12px; color:var(--text-secondary);';
                a.textContent = track.artist || '';
                content.appendChild(t);
                if (track.artist) content.appendChild(a);
                const addIcon = document.createElement('span');
                addIcon.innerHTML = '<svg viewBox="0 0 24 24" width="20" fill="currentColor" style="color:var(--sys-primary);"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
                addIcon.style.marginLeft = 'auto';
                btn.appendChild(content);
                btn.appendChild(addIcon);
                btn.addEventListener('click', () => {
                    addTrackToUserPlaylist(activePlaylistId, track);
                    // Re-render the playlist track list live
                    const pl = userPlaylists.find(p => p.id === activePlaylistId);
                    if (pl) {
                        if (typeof openPlaylist === 'function') openPlaylist(activePlaylistId);
                    }
                    closeAddSongsToPlaylist();
                    push('playlist_detail');
                });
                row.appendChild(btn);
                listEl.appendChild(row);
            });
        }

        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => renderSongList(searchInput.value);
        }
        renderSongList('');
        scrim.classList.add('show');
        if (searchInput) setTimeout(() => searchInput.focus(), 50);
    }

    function closeAddSongsToPlaylist() {
        const scrim = getEl('add-songs-scrim');
        if (scrim) scrim.classList.remove('show');
    }

    function resolveAlbumMeta(inputTitle, inputArtist = '', inputSourceAlbumId = '') {
        if (inputTitle == null && !LIBRARY_ALBUMS.length) return null;
        const rawSourceId = inputSourceAlbumId || (typeof inputTitle === 'object' && inputTitle ? getAlbumSourceIdentity(inputTitle) : '');
        if (rawSourceId && albumBySourceId.has(rawSourceId)) return albumBySourceId.get(rawSourceId);
        const rawTitle = typeof inputTitle === 'string'
            ? inputTitle
            : (inputTitle && typeof inputTitle === 'object' ? inputTitle.title : '');
        const rawArtist = typeof inputTitle === 'object' && inputTitle
            ? (inputTitle.albumArtist || inputTitle.artist || inputArtist || '')
            : inputArtist;
        if (typeof getCanonicalBackendAlbumMeta === 'function') {
            const canonicalBackendAlbum = getCanonicalBackendAlbumMeta(inputTitle, inputArtist);
            if (canonicalBackendAlbum) return canonicalBackendAlbum;
            if (typeof scheduleCanonicalLibraryBackendHydration === 'function') {
                void scheduleCanonicalLibraryBackendHydration('resolveAlbumMeta');
            }
        }
        const normalizedTitle = normalizeAlbumTitle(rawTitle);
        const normalizedKey = albumKey(normalizedTitle);
        const normalizedArtist = toArtistKey(rawArtist);
        if (normalizedKey && normalizedArtist) {
            const exactByIdentity = albumByIdentity.get(albumIdentityKey(normalizedTitle, rawArtist));
            if (exactByIdentity) return exactByIdentity;
            const exactByArtist = LIBRARY_ALBUMS.find((album) => (
                albumKey(album?.title || '') === normalizedKey
                && albumMatchesArtistHint(album, rawArtist)
            ));
            if (exactByArtist) return exactByArtist;
        }

        const exact = albumByTitle.get(normalizedKey);
        if (exact && (!normalizedArtist || albumMatchesArtistHint(exact, rawArtist))) return exact;

        // Exact title match only â€” no fuzzy substring matching
        if (normalizedKey) {
            const exactTitleMatch = LIBRARY_ALBUMS.find((album) => {
                if (albumKey(album?.title || '') !== normalizedKey) return false;
                return albumMatchesArtistHint(album, rawArtist);
            });
            if (exactTitleMatch) return exactTitleMatch;
        }

        return null;
    }

    function renderAlbumDetail(albumMeta) {
        if (!albumMeta) return;
        activeAlbumTitle = albumMeta.title;
        activeAlbumArtist = getAlbumPrimaryArtistName(albumMeta, albumMeta.artist);
        viewedAlbumTitle = activeAlbumTitle;
        viewedAlbumArtist = activeAlbumArtist;

        const at = getEl('alb-title');
        const aa = getEl('alb-artist');
        const am = getEl('alb-meta');
        const trackCount = albumMeta.tracks?.length || Number(albumMeta.trackCount || 0);

        const albumMetaDone = Array.isArray(albumMeta.tracks) && albumMeta.tracks.length > 0 && albumMeta.tracks.every(t => t._metaDone);
        const titleMissing  = albumMetaDone && isMissingMetadata(albumMeta.title,  'album');
        const artistMissing = albumMetaDone && isMissingMetadata(albumMeta.artist, 'artist');
        const yearMissing   = albumMetaDone && !albumMeta.year;

        if (at) {
            at.textContent = titleMissing  ? 'No Album Tag'  : albumMeta.title;
            at.classList.toggle('metadata-error', titleMissing);
        }
        if (aa) {
            aa.textContent = artistMissing ? 'No Artist Tag' : albumMeta.artist;
            aa.classList.toggle('metadata-error', artistMissing);
        }
        if (am) {
            renderAlbumMetadataLine(albumMeta, am);
        }
        const albArtEl = getEl('alb-art');
        applyArtBackground(albArtEl, albumMeta.artUrl, FALLBACK_GRADIENT);
        if (!albumMeta.artUrl && albArtEl && typeof lazyLoadArt === 'function') lazyLoadArt(albumMeta, albArtEl);
        wireAlbumDetailHeaderInteractions(albumMeta);
        ensureAlbumProgressBinding();

        const playBtn = getEl('alb-play-btn');
        if (playBtn && albumMeta.tracks?.[0]) {
            // Clear any stale data-action/data-title/data-artist left from HTML placeholder
            // so the delegated ACTION_MAP handler does not intercept this click.
            playBtn.removeAttribute('data-action');
            playBtn.removeAttribute('data-title');
            playBtn.removeAttribute('data-artist');
            playBtn.dataset.collectionType = 'album';
            playBtn.dataset.collectionKey = getAlbumIdentityKey(albumMeta, albumMeta.artist);
            playBtn.onclick = (evt) => {
                if (isCollectionActive('album', getAlbumIdentityKey(albumMeta, albumMeta.artist))) {
                    togglePlayback(evt);
                    return;
                }
                playAlbumInOrder(albumMeta.title, 0, albumMeta.artist);
            };
        }

        const list = getEl('album-track-list');
        if (list) {
            clearTrackUiRegistryForRoot(list);
            list.innerHTML = '';
            const tracks = (Array.isArray(albumMeta.tracks) ? albumMeta.tracks : []).slice().sort((a, b) =>
                Number(a.discNo || 1) - Number(b.discNo || 1)
                || Number(a.no || 0) - Number(b.no || 0)
            );
            tracks.forEach((track, idx) => {
                list.appendChild(makeAlbumTrackRow(track, idx, {
                    onActivate: () => playAlbumInOrder(albumMeta.title, idx, albumMeta.artist),
                    onLongPress: () => openTrackZenithMenu(track),
                    numDisplay: track.no || idx + 1,
                    isLast: idx === tracks.length - 1,
                    showQuality: true
                }));
            });
        }

        const engine = ensureAudioEngine();
        const currentSeconds = engine && Number.isFinite(engine.currentTime) ? engine.currentTime : 0;
        const currentDuration = engine && Number.isFinite(engine.duration) && engine.duration > 0
            ? engine.duration
            : (nowPlaying?.durationSec || 0);
        updateAlbumProgressLine(currentSeconds, currentDuration);
        setPlayButtonState(isPlaying);
        push('album_detail');
        ensureAccessibility();
    }

    function navToAlbum(album, artist, sourceAlbumId = '') {
        const resolved = resolveAlbumMeta(album, artist, sourceAlbumId);
        if (!resolved) return;
        const albumMeta = (!resolved.artist && artist) ? { ...resolved, artist } : resolved;
        renderAlbumDetail(albumMeta);
    }

    // Home / Library
    function toggleMarvisLayout() {
        const mod = getEl('marvis-mod-section');
        if (!mod) return;
        isGrid = !isGrid;

        mod.style.opacity = '0';
        setTimeout(() => {
            if (isGrid) {
                mod.className = 'cat-grid';
                mod.style.display = 'grid';
            } else {
                mod.className = 'horizon-scroller';
                mod.style.display = 'flex';
            }
            renderJumpBackSection(getFeaturedAlbums());
            mod.style.opacity = '1';
            applySortToBrowseGrid();
        }, 150);

        toast(isGrid ? 'Marvis: Grid View' : 'Marvis: List View');
    }

    function renderJumpBackSection(featuredAlbums) {
        const mod = getEl('marvis-mod-section');
        if (!mod) return;

        mod.innerHTML = '';
        const albums = Array.isArray(featuredAlbums) ? featuredAlbums.slice(0, 8) : [];
        if (albums.length === 0) return;

        albums.forEach(album => {
            if (isGrid) {
                const card = document.createElement('div');
                card.className = 'cat-card';
                card.draggable = true;
                card.dataset.albumTitle = album.title;
                card.dataset.added = String(album.year || 0);
                card.dataset.plays = String(200);
                card.dataset.duration = String(album.tracks[0]?.durationSec || 0);
                applyArtBackground(card, album.artUrl, FALLBACK_GRADIENT);
                if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, card);
                card.style.border = '1px solid rgba(255,255,255,0.2)';
                card.addEventListener('click', () => navToAlbum(album.title, album.artist, getAlbumSourceIdentity(album)));
                card.addEventListener('mousedown', (e) => startLongPress(e, album.title, album.artist));
                card.addEventListener('mouseup', clearLongPress);
                card.addEventListener('mouseleave', clearLongPress);

                const span = document.createElement('span');
                span.textContent = album.title;
                span.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
                card.appendChild(span);
                const jbKey = getAlbumIdentityKey(album, album.artist);
                const jbPlayBtn = document.createElement('div');
                jbPlayBtn.className = 'catalog-play-btn';
                jbPlayBtn.dataset.collectionType = 'album';
                jbPlayBtn.dataset.collectionKey = jbKey;
                jbPlayBtn.innerHTML = getPlaybackIconSvg(isCollectionPlaying('album', jbKey));
                jbPlayBtn.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    if (isCollectionActive('album', jbKey)) { togglePlayback(evt); }
                    else { playAlbumInOrder(album.title, 0, album.artist); }
                });
                card.appendChild(jbPlayBtn);
                mod.appendChild(card);
                return;
            }

            const card = document.createElement('div');
            card.className = 'media-card';
            card.addEventListener('click', () => navToAlbum(album.title, album.artist, getAlbumSourceIdentity(album)));
            card.addEventListener('mousedown', (e) => startLongPress(e, album.title, album.artist));
            card.addEventListener('mouseup', clearLongPress);
            card.addEventListener('mouseleave', clearLongPress);
            card.addEventListener('touchstart', (e) => startLongPress(e, album.title, album.artist), { passive: true });
            card.addEventListener('touchend', clearLongPress, { passive: true });

            const cover = document.createElement('div');
            cover.className = 'media-cover';
            applyArtBackground(cover, album.artUrl, FALLBACK_GRADIENT);
            if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, cover);
            const jbKey = getAlbumIdentityKey(album, album.artist);
            const jbPlayBtn = document.createElement('div');
            jbPlayBtn.className = 'catalog-play-btn';
            jbPlayBtn.dataset.collectionType = 'album';
            jbPlayBtn.dataset.collectionKey = jbKey;
            jbPlayBtn.innerHTML = getPlaybackIconSvg(isCollectionPlaying('album', jbKey));
            jbPlayBtn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                if (isCollectionActive('album', jbKey)) { togglePlayback(evt); }
                else { playAlbumInOrder(album.title, 0, album.artist); }
            });
            cover.appendChild(jbPlayBtn);

            const wrap = document.createElement('div');
            const t = document.createElement('div');
            t.className = 'media-title';
            t.textContent = album.title;
            const s = document.createElement('div');
            s.className = 'media-sub';
            s.textContent = `${album.artist} - Album`;
            wrap.appendChild(t);
            wrap.appendChild(s);

            card.appendChild(cover);
            card.appendChild(wrap);
            mod.appendChild(card);
        });
    }

    function clearHomePlaceholders() {
        document.querySelectorAll('.home-placeholder').forEach(el => el.remove());
    }

    function createHomePlaceholder(typeLabel) {
        const container = document.createElement('div');
        container.className = 'home-placeholder card';
        container.style.cssText = 'text-align:center; margin-top:16px;';

        const h3 = document.createElement('h3');
        h3.style.cssText = 'margin-bottom:8px; color:var(--text-primary);';
        h3.textContent = `No ${typeLabel} here yet`;

        const p = document.createElement('p');
        p.style.marginBottom = '16px';
        p.textContent = 'Your local library has no matching items. Try browsing to add more.';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.style.cssText = 'width:auto; padding:10px 20px; font-size:13px;';
        btn.textContent = 'Browse Catalog';
        btn.addEventListener('click', () => switchTab('library', getEl('tabs')?.querySelectorAll('.nav-item')[1]));

        container.appendChild(h3);
        container.appendChild(p);
        container.appendChild(btn);
        return container;
    }

    function filterHome(type) {
        const mus = getEl('home-music-section');
        const vid = getEl('home-videos-section');
        if (!mus || !vid) return;

        clearHomePlaceholders();

        if (type === 'all') {
            mus.style.display = 'block';
            vid.style.display = 'block';
            toast('Filtering: All Content');
            return;
        }

        if (type === 'music') {
            mus.style.display = 'block';
            vid.style.display = 'none';
            toast('Filtering: Songs');
            return;
        }

        if (type === 'videos') {
            mus.style.display = 'none';
            vid.style.display = 'block';
            toast('Filtering: Videos');
            return;
        }

        if (type === 'Albums' || type === 'Artists') {
            mus.style.display = 'block';
            vid.style.display = 'none';
            toast(`Filtering: ${type}`);
            return;
        }

        mus.style.display = 'none';
        vid.style.display = 'none';
        getEl('home').appendChild(createHomePlaceholder(type));
        toast(`Filtering: ${type}`);
    }

    function switchLib(tab) {
        document.querySelectorAll('#library .filter-chip').forEach(b => b.classList.remove('active'));
        getEl('lib-btn-' + tab)?.classList.add('active');

        ['playlists', 'albums', 'artists', 'songs', 'genres'].forEach(name => {
            const el = getEl('lib-view-' + name);
            if (el) el.style.display = 'none';
        });

        getEl('lib-view-' + tab).style.display = 'block';
    }

    function getQueueViewModel() {
        if (!Array.isArray(queueTracks) || queueTracks.length === 0) {
            return {
                currentIdx: -1,
                currentEntry: null,
                upNextEntries: [],
                inlineEntries: []
            };
        }
        const currentIdx = getCurrentQueueIndex();
        const safeIndex = currentIdx >= 0 ? currentIdx : 0;
        const currentTrack = queueTracks[safeIndex] || null;
        const currentEntry = currentTrack ? { track: currentTrack, index: safeIndex } : null;
        const upNextEntries = queueTracks
            .slice(safeIndex + 1)
            .map((track, offset) => ({ track, index: safeIndex + 1 + offset }));
        return {
            currentIdx: safeIndex,
            currentEntry,
            upNextEntries,
            inlineEntries: upNextEntries
        };
    }

    function playQueueTrackAt(index, autoplay = true) {
        const safeIndex = Number(index);
        if (!Number.isFinite(safeIndex)) return;
        if (safeIndex < 0 || safeIndex >= queueTracks.length) return;
        const track = queueTracks[safeIndex];
        if (!track) return;
        queueIndex = safeIndex;
        // GAP 8: clear stale collection key when jumping to a track from a different album
        if (activePlaybackCollectionType === 'album' && activePlaybackCollectionKey && activeAlbumTitle) {
            const rawAlbum = String(track.albumTitle || '').trim();
            if (rawAlbum && albumKey(rawAlbum) !== albumKey(activeAlbumTitle)) {
                setPlaybackCollection('', '');
            }
        }
        setNowPlaying(track, true);
        loadTrackIntoEngine(track, autoplay, true);
        renderQueue();
    }
