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

    // Ã¢â€â‚¬Ã¢â€â‚¬ Playlist zenith menu (3-dot) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

    // Ã¢â€â‚¬Ã¢â€â‚¬ Add Songs to Playlist overlay Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
