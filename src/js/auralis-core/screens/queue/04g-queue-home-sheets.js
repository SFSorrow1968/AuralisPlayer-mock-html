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

    function bindQueueRowLongPress(target, onLongPress, delayMs = 560) {
        if (!target || typeof onLongPress !== 'function') return;
        let timer = null;
        const clearTimer = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };
        const begin = (evt) => {
            if (evt.type === 'mousedown' && evt.button !== 0) return;
            clearTimer();
            timer = setTimeout(() => {
                markLongPressSuppressed(target);
                if (navigator.vibrate) navigator.vibrate(35);
                onLongPress();
            }, delayMs);
        };

        target.addEventListener('mousedown', begin);
        target.addEventListener('touchstart', begin, { passive: true });
        target.addEventListener('mouseup', clearTimer);
        target.addEventListener('mouseleave', clearTimer);
        target.addEventListener('touchend', clearTimer, { passive: true });
        target.addEventListener('touchcancel', clearTimer, { passive: true });
        target.addEventListener('touchmove', clearTimer, { passive: true });
    }

    function renderQueue() {
        const inlineList = getEl('player-inline-queue-list');
        if (!inlineList) return;
        clearTrackUiRegistryForRoot(inlineList);
        inlineList.innerHTML = '';

        const { inlineEntries } = getQueueViewModel();
        if (!queueTracks.length || !inlineEntries.length) {
            const inlineEmpty = document.createElement('div');
            inlineEmpty.className = 'queue-inline-empty';
            inlineEmpty.textContent = queueTracks.length ? 'Nothing queued after the current track.' : 'No tracks queued yet.';
            inlineList.appendChild(inlineEmpty);
            ensureAccessibility();
            return;
        }

        inlineEntries.forEach(({ track, index }, offset) => {
            const row = createQueueTrackRow(track, {
                queueIndex: index,
                reorderable: true,
                compact: true,
                badgeLabel: offset === 0 ? 'Next' : '',
                badgeTone: 'next',
                showDuration: false,
                onActivate: () => {
                    if (Date.now() < queueDragSuppressUntil) return;
                    playQueueTrackAt(index, true);
                },
                onLongPress: () => openQueueTrackMenu(track, index),
                onMenu: () => openQueueTrackMenu(track, index)
            });
            makeSwipeable(row, {
                onSwipeLeft: () => removeQueueTrack(index),
                onSwipeRight: () => pickPlaylistForTrack(track),
                leftLabel: 'Remove'
            });
            inlineList.appendChild(row);
        });

        bindQueueInteractions(inlineList);
        ensureAccessibility();
    }

    function setHomeEditMode(enabled, options = {}) {
        inEditMode = Boolean(enabled);
        const announce = options.announce !== false;
        const home = getEl('home');
        const btn = getEl('edit-home-btn');
        if (!home || !btn) return;

        if (inEditMode) {
            home.classList.add('home-editor-active');
            btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
            btn.style.background = '';
            if (typeof syncHomeTitleEditability === 'function') syncHomeTitleEditability();
            if (announce) toast('Workspace Editor Unlocked');
        } else {
            if (typeof commitHomeTitleEdit === 'function') commitHomeTitleEdit();
            home.classList.remove('home-editor-active');
            btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>';
            btn.style.background = '';
            if (typeof syncHomeTitleEditability === 'function') syncHomeTitleEditability();
            if (announce) toast('Layout Settings Saved');
        }
    }

    function exitHomeEditMode(options = {}) {
        if (!inEditMode) return;
        setHomeEditMode(false, options);
    }

    function toggleEditMode() {
        setHomeEditMode(!inEditMode);
    }

    function setSheetContextIcon(options = {}) {
        const icon = getEl('sheet-icon');
        if (!icon) return;
        icon.className = 'sheet-context-icon';
        icon.style.backgroundImage = '';
        icon.innerHTML = '';
        const artUrl = resolveArtUrlForContext(options.artUrl || '');
        if (artUrl) {
            icon.classList.add('has-art');
            icon.style.backgroundImage = `url("${artUrl}")`;
            return;
        }
        const iconName = options.icon || 'library';
        icon.classList.add('has-symbol');
        icon.innerHTML = typeof getIconSvg === 'function'
            ? getIconSvg(iconName)
            : '<svg viewBox="0 0 24 24"><path d="M4 4h4v16H4V4zm6 0h4v16h-4V4zm6 2 3.5-1 4 14-3.5 1-4-14z"/></svg>';
    }

    // Sheet / Sidebar
    function openSheet(title, sub, options = {}) {
        getEl('sheet-title').innerText = title;
        getEl('sheet-sub').innerText = sub;
        setSheetContextIcon(options);
        getEl('sheet-scrim').classList.add('show');
        getEl('action-sheet').classList.add('show');
        focusFirstAction(getEl('action-sheet'));
    }

    function closeSheet() {
        getEl('sheet-scrim').classList.remove('show');
        getEl('action-sheet').classList.remove('show');
        // Restore data-action attrs that presentActionSheet saved before removing them
        document.querySelectorAll('#action-sheet .sheet-action').forEach(row => {
            if ('savedAction' in row.dataset) {
                if (row.dataset.savedAction) row.dataset.action = row.dataset.savedAction;
                delete row.dataset.savedAction;
            }
        });
    }

    // â”€â”€ Create-Playlist Dialog â”€â”€
    function openCreatePlaylistDialog() {
        const scrim = getEl('create-playlist-scrim');
        const input = getEl('create-playlist-input');
        const err = getEl('create-playlist-error');
        if (!scrim || !input) return;
        input.value = '';
        if (err) err.textContent = '';
        scrim.classList.add('show');
        // Use a short delay so the animation starts before focus
        setTimeout(() => input.focus(), 50);
    }

    function closeCreatePlaylistDialog() {
        const scrim = getEl('create-playlist-scrim');
        if (scrim) scrim.classList.remove('show');
    }

    function submitCreatePlaylist() {
        const input = getEl('create-playlist-input');
        const err = getEl('create-playlist-error');
        if (!input) return;
        const name = input.value.trim();
        if (!name) {
            if (err) err.textContent = 'Please enter a name.';
            input.focus();
            return;
        }
        if (err) err.textContent = '';
        const pl = createUserPlaylist(name);
        closeCreatePlaylistDialog();
        toast(`Playlist "${pl.name}" created`);
        if (typeof routeToPlaylistDetail === 'function') routeToPlaylistDetail(pl.id);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (typeof openAddSongsToPlaylist === 'function') openAddSongsToPlaylist();
        }));
    }

    function openSectionConfig(sectionName) {
        const actions = document.querySelectorAll('#action-sheet .sheet-action');
        if (actions.length > 3) {
            actions[0].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/></svg> Display as Grid';
            actions[1].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg> Display as List';
            actions[2].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> Edit Filters...';
            actions[3].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> Remove Section';
            actions[0].onclick = () => { toggleMarvisLayout(); closeSheet(); };
            actions[1].onclick = () => { toggleMarvisLayout(); closeSheet(); };
            actions[2].onclick = () => { closeSheet(); openPlaceholderScreen('Section Filters', 'Advanced section filters are still a placeholder in this build.'); };
            actions[3].onclick = () => { closeSheet(); openPlaceholderScreen('Remove Section', 'Section removal from this legacy sheet is still a placeholder here.'); };
        }

        openSheet(`${sectionName} Settings`, 'Layout & Filters');
    }

    function openSidebar() {
        getEl('sidebar-scrim').classList.add('show');
        getEl('sidebar').classList.add('show');
    }

    function closeSidebar() {
        getEl('sidebar-scrim').classList.remove('show');
        getEl('sidebar').classList.remove('show');
    }

    function createPlaylistFromSidebar() {
        closeSidebar();
        if (typeof openCreatePlaylistDialog === 'function') openCreatePlaylistDialog();
    }

    function openLibrarySongsFromSidebar() {
        closeSidebar();
        const libraryTab = findTabNavButton('library');
        if (activeId !== 'library') switchTab('library', libraryTab);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (typeof switchLib === 'function') switchLib('songs');
        }));
    }

    function openAlbumArtViewer(albumMeta) {
        if (!albumMeta) return;
        const scrim = getEl('image-viewer-scrim');
        const img = getEl('image-viewer-img');
        const title = getEl('image-viewer-title');
        const sub = getEl('image-viewer-sub');
        if (!scrim || !img) return;

        albumArtViewerLastFocus = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;
        if (title) title.textContent = albumMeta.title || 'Album Artwork';
        if (sub) sub.textContent = `${albumMeta.artist || ARTIST_NAME}${albumMeta.year ? ` - ${albumMeta.year}` : ''}`;
        img.src = resolveArtUrlForContext(albumMeta.artUrl) || '';
        img.alt = albumMeta.title ? `${albumMeta.title} cover art` : 'Album artwork';
        scrim.classList.add('show');
        albumArtViewerOpen = true;
        syncBottomNavVisibility();
        setTimeout(() => getEl('image-viewer-close')?.focus({ preventScroll: true }), 0);
    }

    function resolveNowPlayingAlbumMeta() {
        if (!nowPlaying) return null;

        // Always prioritize the playing track's own album â€” never show a
        // previously-browsed album when the user is in the now-playing view.
        const hintedAlbum = nowPlaying.albumTitle ? resolveAlbumMeta(nowPlaying.albumTitle, nowPlaying.artist) : null;
        if (hintedAlbum) return hintedAlbum;

        // activeAlbumTitle reflects the last *browsed* album and should only
        // be used as a fallback when it belongs to the same artist as the
        // currently playing track, to avoid cross-album bleed.
        if (activeAlbumTitle) {
            const activeMeta = resolveAlbumMeta(activeAlbumTitle, activeAlbumArtist || nowPlaying?.artist || '');
            if (activeMeta && albumMatchesArtistHint(activeMeta, nowPlaying?.artist || '')) return activeMeta;
        }

        return {
            title: nowPlaying.albumTitle || nowPlaying.title || 'Now Playing',
            artist: nowPlaying.artist || ARTIST_NAME,
            year: '',
            artUrl: nowPlaying.artUrl || ''
        };
    }

    function openNowPlayingArtViewer(evt) {
        if (evt) {
            evt.preventDefault();
            evt.stopPropagation();
        }
        const albumMeta = resolveNowPlayingAlbumMeta();
        if (!albumMeta || !albumMeta.artUrl) {
            toast('No artwork available');
            return;
        }
        openAlbumArtViewer(albumMeta);
    }

    function closeAlbumArtViewer() {
