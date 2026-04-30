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
        viewedArtistName = activeArtistName;
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

    function openPlaylist(playlistId, options = {}) {
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
            const totalSeconds = playlist.tracks.reduce((sum, track) => sum + Number(track.durationSec || toDurationSeconds(track.duration) || 0), 0);
            const tc = playlist.tracks.length;
            const durationLabel = totalSeconds > 0 ? ` - ${toDurationLabel(totalSeconds)}` : '';
            subEl.textContent = `${tc} ${tc === 1 ? 'song' : 'songs'}${durationLabel}`;
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
                    iconName: 'listMusic',
                    action: { label: 'Add Songs', action: 'openAddSongsToPlaylist' }
                }));
            } else {
                appendFragment(list, playlist.tracks.slice(0, 200).map((track, idx) => createPlaylistDetailTrackRow(playlist, track, idx, playlist.tracks.length)));
            }
        }

        setPlayButtonState(isPlaying);
        if (options.push !== false) push('playlist_detail');
        ensureAccessibility();
    }

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
    function getPickerTrackKey(track) {
        return getTrackIdentityKey(track) || trackKey(track?.title, track?.artist);
    }

    function getPlaylistAddedTrackKeys(playlist) {
        return new Set((playlist?.tracks || []).map(getPickerTrackKey).filter(Boolean));
    }

    function buildFolderPickerItems() {
        const folderMap = new Map();
        (Array.isArray(LIBRARY_TRACKS) ? LIBRARY_TRACKS : []).forEach((track) => {
            const rawPath = String(track?.path || track?._sourceAlbumId || '').replace(/\\/g, '/');
            const parts = rawPath.split('/').filter(Boolean);
            const folder = parts.length > 1 ? parts.slice(0, -1).join(' / ') : 'Library Root';
            if (!folderMap.has(folder)) folderMap.set(folder, []);
            folderMap.get(folder).push(track);
        });
        return Array.from(folderMap.entries()).map(([name, tracks]) => ({
            type: 'folders',
            key: `folder:${name}`,
            title: name,
            subtitle: `${tracks.length} tracks`,
            icon: 'folder',
            tracks
        }));
    }

    function getPlaylistPickerItems(type) {
        if (type === 'songs') {
            return (Array.isArray(LIBRARY_TRACKS) ? LIBRARY_TRACKS : []).map(track => ({
                type,
                key: getPickerTrackKey(track),
                title: track.title || 'Untitled Track',
                subtitle: [track.artist, track.albumTitle].filter(Boolean).join(' - '),
                icon: 'music',
                track,
                tracks: [track]
            }));
        }
        if (type === 'albums') {
            return (Array.isArray(LIBRARY_ALBUMS) ? LIBRARY_ALBUMS : []).map(album => ({
                type,
                key: getAlbumIdentityKey(album, album.artist),
                title: album.title || 'Untitled Album',
                subtitle: `${album.artist || 'Unknown Artist'} - ${album.tracks?.length || album.trackCount || 0} tracks`,
                icon: 'album',
                tracks: Array.isArray(album.tracks) ? album.tracks : []
            }));
        }
        if (type === 'artists') {
            return (Array.isArray(LIBRARY_ARTISTS) ? LIBRARY_ARTISTS : []).map(artist => {
                const artistKey = toArtistKey(artist.name || artist.artist);
                const tracks = (Array.isArray(LIBRARY_TRACKS) ? LIBRARY_TRACKS : []).filter(track => toArtistKey(track.artist || track.albumArtist) === artistKey);
                return {
                    type,
                    key: `artist:${artistKey}`,
                    title: artist.name || artist.artist || 'Unknown Artist',
                    subtitle: `${tracks.length || artist.trackCount || 0} tracks`,
                    icon: 'artist',
                    tracks
                };
            });
        }
        if (type === 'genres') {
            return (typeof getGenreBuckets === 'function' ? getGenreBuckets() : []).map(bucket => ({
                type,
                key: `genre:${bucket.name}`,
                title: bucket.name === 'Unknown' ? 'Untagged' : bucket.name,
                subtitle: `${bucket.trackCount || bucket.tracks?.length || 0} tracks`,
                icon: 'tag',
                tracks: Array.isArray(bucket.tracks) ? bucket.tracks : []
            }));
        }
        if (type === 'folders') return buildFolderPickerItems();
        return (Array.isArray(LIBRARY_PLAYLISTS) ? LIBRARY_PLAYLISTS : [])
            .filter(playlist => playlist.id !== activePlaylistId)
            .map(playlist => ({
                type: 'playlists',
                key: `playlist:${playlist.id}`,
                title: playlist.title || playlist.name || 'Playlist',
                subtitle: `${playlist.tracks?.length || 0} tracks`,
                icon: 'playlist',
                tracks: Array.isArray(playlist.tracks) ? playlist.tracks : []
            }));
    }

    function openAddSongsToPlaylist() {
        const scrim = getEl('add-songs-scrim');
        const searchInput = getEl('add-songs-search');
        const listEl = getEl('add-songs-list');
        if (!scrim || !listEl) return;
        const playlist = userPlaylists.find(p => p.id === activePlaylistId);
        if (!playlist) {
            toast('Open a playlist first');
            return;
        }

        let pickerTabs = getEl('add-songs-picker-tabs');
        if (!pickerTabs) {
            pickerTabs = document.createElement('div');
            pickerTabs.id = 'add-songs-picker-tabs';
            pickerTabs.className = 'playlist-picker-tabs';
            searchInput?.insertAdjacentElement('afterend', pickerTabs);
        }
        let summary = getEl('add-songs-selected-summary');
        let footer = getEl('add-songs-picker-footer');
        let addBtn = getEl('add-songs-add-selected');
        if (!footer) {
            footer = document.createElement('div');
            footer.id = 'add-songs-picker-footer';
            footer.className = 'playlist-picker-footer';
            summary = document.createElement('span');
            summary.id = 'add-songs-selected-summary';
            summary.className = 'playlist-picker-summary';
            addBtn = document.createElement('button');
            addBtn.id = 'add-songs-add-selected';
            addBtn.type = 'button';
            addBtn.className = 'confirm-btn';
            addBtn.textContent = 'Add Selected';
            footer.appendChild(summary);
            footer.appendChild(addBtn);
            listEl.insertAdjacentElement('afterend', footer);
        }

        const state = {
            type: 'songs',
            selected: new Map(),
            query: ''
        };

        function currentAddedKeys() {
            return getPlaylistAddedTrackKeys(userPlaylists.find(p => p.id === activePlaylistId) || playlist);
        }

        function updateSummary() {
            const count = state.selected.size;
            const trackWord = count === 1 ? 'track' : 'tracks';
            if (summary) summary.textContent = count ? `${count} selected ${trackWord}` : 'No selections yet';
            if (addBtn) {
                addBtn.disabled = count === 0;
                addBtn.setAttribute('aria-disabled', String(count === 0));
            }
        }

        function toggleTracks(tracks) {
            const added = currentAddedKeys();
            const selectable = (tracks || []).filter(track => track && !added.has(getPickerTrackKey(track)));
            const allSelected = selectable.length > 0 && selectable.every(track => state.selected.has(getPickerTrackKey(track)));
            selectable.forEach(track => {
                const key = getPickerTrackKey(track);
                if (!key) return;
                if (allSelected) state.selected.delete(key);
                else state.selected.set(key, track);
            });
        }

        function renderPicker() {
            pickerTabs.innerHTML = '';
            ['songs', 'albums', 'artists', 'genres', 'folders', 'playlists'].forEach(type => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `playlist-picker-tab${state.type === type ? ' active' : ''}`;
                btn.dataset.pickerType = type;
                btn.innerHTML = `<span>${getIconSvg(type === 'songs' ? 'music' : type === 'albums' ? 'album' : type === 'artists' ? 'artist' : type === 'genres' ? 'tag' : type === 'folders' ? 'folder' : 'playlist')}</span>${type[0].toUpperCase() + type.slice(1)}`;
                btn.addEventListener('click', () => {
                    state.type = type;
                    renderPicker();
                });
                pickerTabs.appendChild(btn);
            });

            listEl.innerHTML = '';
            const query = normalizeSearchText(state.query);
            const added = currentAddedKeys();
            const items = getPlaylistPickerItems(state.type)
                .filter(item => {
                    if (!query) return true;
                    return createSearchIndex({
                        title: item.title || '',
                        subtitle: item.subtitle || '',
                        tracks: (item.tracks || []).map(track => `${track.title || ''} ${track.artist || ''}`)
                    }).includes(query);
                })
                .slice(0, 300);

            if (!items.length) {
                listEl.appendChild(createSearchWorkspaceEmpty('library', query ? 'No matches' : 'Nothing to add', 'Try another section or search term.'));
                updateSummary();
                return;
            }

            items.forEach(item => {
                const itemTracks = item.tracks || [];
                const selectableTracks = itemTracks.filter(track => !added.has(getPickerTrackKey(track)));
                const selectedCount = selectableTracks.filter(track => state.selected.has(getPickerTrackKey(track))).length;
                const isTrack = state.type === 'songs';
                const isAdded = isTrack && item.track && added.has(getPickerTrackKey(item.track));
                const row = document.createElement('button');
                row.type = 'button';
                row.className = `playlist-picker-row${selectedCount ? ' is-selected' : ''}${isAdded ? ' is-added' : ''}`;
                row.dataset.pickerEntityKey = item.key;
                if (isTrack) row.dataset.pickerTrackKey = item.key;
                row.innerHTML = `
                    <span class="playlist-picker-row-icon">${getIconSvg(item.icon)}</span>
                    <span class="playlist-picker-row-copy">
                        <strong>${escapeHtml(item.title)}</strong>
                        <small>${escapeHtml(item.subtitle || '')}</small>
                    </span>
                    <span class="playlist-picker-row-state">${isAdded ? 'Added' : selectedCount ? `${selectedCount} selected` : selectableTracks.length > 1 ? `+${selectableTracks.length}` : '+'}</span>
                `;
                row.disabled = Boolean(isAdded || selectableTracks.length === 0);
                row.addEventListener('click', () => {
                    toggleTracks(itemTracks);
                    renderPicker();
                });
                listEl.appendChild(row);
            });
            updateSummary();
        }

        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => {
                state.query = searchInput.value;
                renderPicker();
            };
        }
        if (addBtn) {
            addBtn.onclick = () => {
                const tracks = Array.from(state.selected.values());
                if (!tracks.length) return;
                tracks.forEach(track => addTrackToUserPlaylist(activePlaylistId, track, { silent: true }));
                toast(`Added ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`);
                state.selected.clear();
                openPlaylist(activePlaylistId, { push: false });
                setLibraryRenderDirty(true);
                renderLibraryViews({ force: true });
                renderPicker();
            };
        }

        renderPicker();
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
                const row = document.createElement('div');
                row.className = 'list-item album-track-row';
                row.dataset.trackKey = trackKey(track.title, track.artist);
                row.dataset.trackId = getStableTrackIdentity(track);
                row.dataset.metadataStatus = getTrackMetadataStatus(track);
                row.dataset.metadataQuality = getTrackMetadataQuality(track);
                if (idx === tracks.length - 1) row.style.borderBottom = 'none';

                const click = document.createElement('button');
                click.className = 'item-clickable';
                click.type = 'button';
                click.addEventListener('click', () => playAlbumInOrder(albumMeta.title, idx, albumMeta.artist));
                bindLongPressAction(click, () => openTrackZenithMenu(track));

                const numEl = document.createElement('span');
                numEl.className = 'track-num';
                numEl.textContent = String(track.no || idx + 1);

                const content = document.createElement('div');
                content.className = 'item-content';
                const titleEl = document.createElement('h3');
                titleEl.textContent = track.title;
                content.appendChild(titleEl);
                const qualityLabel = getTrackMetadataQualityLabel(track);
                if (qualityLabel) {
                    const qualityEl = document.createElement('span');
                    qualityEl.className = `metadata-quality-pill is-${getTrackMetadataQuality(track)}`;
                    qualityEl.textContent = qualityLabel;
                    qualityEl.title = getTrackMetadataQualityDescription(track);
                    content.appendChild(qualityEl);
                }

                const durationEl = document.createElement('span');
                durationEl.className = 'album-track-duration';
                durationEl.textContent = getTrackDurationDisplay(track);
                durationEl.dataset.originalDuration = durationEl.textContent;
                durationEl.dataset.metadataStatus = getTrackMetadataStatus(track);
                const stateBtn = createTrackStateButton(track, () => playAlbumInOrder(albumMeta.title, idx, albumMeta.artist), { compact: true });
                stateBtn.classList.add('album-track-state-btn');

                click.appendChild(numEl);
                click.appendChild(content);
                click.appendChild(durationEl);
                click.appendChild(stateBtn);
                row.appendChild(click);
                registerTrackUi(trackKey(track.title, track.artist), { row, click, stateButton: stateBtn, durations: [durationEl] });
                list.appendChild(row);
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
