/*
 * Auralis JS shard: 11-events-compat.js
 * Purpose: delegated event action map, long press delegation, legacy global bridge
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
// § EVENT DELEGATION SYSTEM
// Replaces all inline onclick/onmousedown/ontouchstart handlers
// Elements use data-action attributes instead of inline JS
// ═══════════════════════════════════════════════════════════════════

    const ACTION_MAP = {
        // Navigation
        pop: () => pop(),
        push: (e, el) => push(el.dataset.target),
        switchTab: (e, el) => switchTab(el.dataset.tab, el),
        toggleOverlay: (e, el) => toggleOverlay(el.dataset.target),

        // Playback
        togglePlayback: (e) => togglePlayback(e),
        playPrevious: (e) => { playPrevious(); e.stopPropagation(); },
        playNext: (e) => { playNext(); e.stopPropagation(); },
        playTrack: (e, el) => playTrack(el.dataset.title, el.dataset.artist, el.dataset.album, el.dataset.trackId),
        toggleShuffle: () => toggleShuffle(),

        // Routes
        navToAlbum: (e, el) => navToAlbum(el.dataset.album, el.dataset.artist, el.dataset.sourceAlbumId),
        routeToArtistProfile: (e, el) => routeToArtistProfile(el.dataset.artist),
        routeToPlaylist: (e, el) => routeToPlaylist(el.dataset.playlistId || el.dataset.id),
        routeToPlaylistByIndex: (e, el) => routeToPlaylistByIndex(Number(el.dataset.index)),

        // UI Controls
        openSidebar: () => openSidebar(),
        closeSidebar: () => closeSidebar(),
        openSearchSort: () => openSearchSort(),
        openTagCreator: () => openTagCreator(),
        closeTagCreator: () => closeTagCreator(),
        createTag: () => createTag(),
        toggleEditMode: () => toggleEditMode(),
        openAddHomeSection: () => openAddHomeSection(),
        openCreateHomeProfile: () => openCreateHomeProfile(),
        openSectionConfig: (e, el) => openSectionConfig(el.dataset.section || el.textContent),
        toggleSearchFilter: (e, el) => toggleSearchFilter(el),
        toggleSearchTag: (e, el) => toggleSearchTag(el, el.dataset.tag),
        switchLib: (e, el) => switchLib(el.dataset.section),
        switchLibSongsSort: (e, el) => switchLibSongsSort(el.dataset.sort),
        filterHome: (e, el) => filterHome(el.dataset.filter),
        toast: (e, el) => toast(el.dataset.message),
        openPlaceholder: (e, el) => openPlaceholderScreen(
            el.dataset.placeholderTitle || el.dataset.message || 'Placeholder',
            el.dataset.placeholderBody || 'This part of the app does not have working logic yet.'
        ),

        // Party (no-op; party sessions removed)
        setRole: () => {},
        startParty: () => {},
        leaveParty: () => {},

        // Sheet / Overlay
        closeSheet: () => closeSheet(),
        addCurrentToQueue: () => { addCurrentToQueue(); closeSheet(); },
        playCurrentNext: () => { playCurrentNext(); closeSheet(); },
        shareAndClose: () => {
            closeSheet();
            const track = sheetTrack || nowPlaying;
            if (!track) return;
            const parts = [track.title, track.artist, track.albumTitle].filter(Boolean);
            const text = parts.join(' \u00b7 ');
            if (navigator.share) { navigator.share({ title: track.title, text }).catch(() => {}); return; }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => toast('Track info copied to clipboard')).catch(() => toast('Could not copy'));
            } else { toast('Share not available on this device'); }
        },
        removeAndClose: () => {
            closeSheet();
            const track = sheetTrack || nowPlaying;
            if (!track) return;
            // Context 1: user is inside a user playlist
            if (activePlaylistId) {
                const pl = userPlaylists.find(p => p.id === activePlaylistId);
                if (pl) {
                    const idx = pl.tracks.findIndex((candidate) => isSameTrack(candidate, track));
                    if (idx >= 0) {
                        showConfirm(
                            `Remove from "${pl.name}"?`,
                            `"${track.title}" will be removed from this playlist.`,
                            'Remove',
                            () => { removeTrackFromUserPlaylist(activePlaylistId, idx); setLibraryRenderDirty(true); renderLibraryViews({ force: true }); }
                        );
                        return;
                    }
                }
            }
            // Context 2: track is in the queue
            const queueIdx = queueTracks.findIndex((candidate) => isSameTrack(candidate, track));
            if (queueIdx >= 0) {
                showConfirm('Remove from queue?', `"${track.title}" will be removed from the queue.`, 'Remove', () => { removeQueueTrack(queueIdx); });
                return;
            }
            toast('Remove is only available from playlists or the queue');
        },

        // Queue
        clearQueue: () => clearQueue(),
        clearQueueAndRender: () => { clearQueue(); renderQueue(); },
        addNowPlayingToQueue: () => { if (nowPlaying) { addTrackToQueueSmart(nowPlaying); } },

        // Misc
        dismissOnboarding: () => dismissOnboarding(),
        openNowPlayingArtViewer: (e) => openNowPlayingArtViewer(e),
        stopPropagation: (e) => e.stopPropagation(),
        toggleSelfActive: (e, el) => el.classList.toggle('active'),
        closeAlbumArtViewer: () => closeAlbumArtViewer(),
        closeImageViewerSelf: (e, el) => { if (e.target === el) closeAlbumArtViewer(); },
        openAlbumMetaZenithMenu: () => openAlbumZenithMenu(resolveAlbumMeta(activeAlbumTitle, activeAlbumArtist) || LIBRARY_ALBUMS[0]),
        openArtistProfileSectionMenu: () => { if (typeof openArtistProfileSectionMenu === 'function') openArtistProfileSectionMenu(); },
        openPlaylistZenithMenu: () => { if (typeof openPlaylistZenithMenu === 'function') openPlaylistZenithMenu(); },
        openAddSongsToPlaylist: () => { if (typeof openAddSongsToPlaylist === 'function') openAddSongsToPlaylist(); },
        closeAddSongsToPlaylist: () => { if (typeof closeAddSongsToPlaylist === 'function') closeAddSongsToPlaylist(); },

        // First-time setup
        toggleSetupFolder: (e, el) => toggleSetupFolder(el),
        confirmSetup: () => confirmSetupSmart(),
        skipSetup: () => skipSetup(),
        addSetupFolder: () => addSetupFolder(),
        openMediaFolderSetup: () => openMediaFolderSetup(),

        // Settings media folders
        removeSettingsFolder: (e, el) => removeSettingsFolder(e, el),
        addSettingsFolder: () => addSettingsFolder(),
        rescanFolders: () => rescanFolders(),
        clearMediaCache: () => clearMediaCache(),

        // Confirm dialog
        confirmCancel: () => confirmCancel(),
        confirmAccept: () => confirmAccept(),

        // Sidebar compound actions
        closeSidebarAndPush: (e, el) => { closeSidebar(); push(el.dataset.target); },
        closeSidebarAndRoute: (e, el) => { closeSidebar(); routeToPlaylistByIndex(Number(el.dataset.index)); },

        playerRepeat: (e) => { e.stopPropagation(); toggleRepeatMode(); },

        // Volume, Speed, Lyrics
        setVolume: (e, el) => setVolume(el.value),
        toggleMute: () => toggleMute(),
        cycleSpeed: () => cyclePlaybackSpeed(),
        toggleLyrics: () => toggleLyrics(),
        toggleCrossfade: () => toggleCrossfade(),
        toggleReplayGain: () => toggleReplayGain(),
        toggleGapless: () => toggleGapless(),
        openEq: () => openEq(),
        closeEq: () => closeEq(),
        toggleEq: () => toggleEq(),
        setEqPreset: (e, el) => setEqPreset(el.dataset.preset),
        createPlaylist: () => {
            if (typeof openCreatePlaylistDialog === 'function') { openCreatePlaylistDialog(); return; }
            // Fallback if dialog element is absent
            const name = prompt('Playlist name:');
            if (name) createUserPlaylist(name.trim());
        },
        openCreatePlaylistDialog:  () => { if (typeof openCreatePlaylistDialog  === 'function') openCreatePlaylistDialog(); },
        closeCreatePlaylistDialog: () => { if (typeof closeCreatePlaylistDialog === 'function') closeCreatePlaylistDialog(); },
        submitCreatePlaylist:      () => { if (typeof submitCreatePlaylist      === 'function') submitCreatePlaylist(); },
        closeMetadataEditor: () => { if (typeof closeMetadataEditor === 'function') closeMetadataEditor(); },
        saveMetadataEdits:   () => { if (typeof saveMetadataEdits   === 'function') saveMetadataEdits(); },
        importM3U:           () => { if (typeof importM3UFile       === 'function') importM3UFile(); },
        exportQueueAsM3U:    () => { if (typeof exportQueueAsM3U    === 'function') exportQueueAsM3U(); },

        // Backend integration
        backendRegister:     () => { if (typeof window.backendRegister === 'function') window.backendRegister(); },
        backendLogin:        () => { if (typeof window.backendLogin === 'function') window.backendLogin(); },
        backendLogout:       () => { if (typeof window.backendLogout === 'function') window.backendLogout(); },
        backendSyncNow:      () => { if (typeof window.backendSyncNow === 'function') window.backendSyncNow(); },
        backendPullRemote:   () => { if (typeof window.backendPullRemote === 'function') window.backendPullRemote(); },
        backendRefreshMetrics: () => { if (typeof window.backendRefreshMetrics === 'function') window.backendRefreshMetrics(); },
        backendRefreshSessions: () => { if (typeof window.backendRefreshSessions === 'function') window.backendRefreshSessions(); }
    };

    // Click delegation
    document.addEventListener('click', (e) => {
        // Suppress clicks that follow a long-press
        if (shouldSuppressLongPressClick(e.target)) return;

        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        if (action === 'addSettingsFolder' || action === 'addSetupFolder') {
            console.log('[Auralis][FolderPicker] Delegation handler caught action:', action, 'target:', target);
        }
        const handler = ACTION_MAP[action];
        if (handler) handler(e, target);
    }, false);

    // Long-press delegation for elements with data-longpress
    function handleDelegatedLongPressStart(e) {
        const target = e.target.closest('[data-longpress]');
        if (!target) return;
        if (e.type === 'mousedown' && e.button !== 0) return;

        clearLongPress();
        const lpTitle = target.dataset.lpTitle || '';
        const lpSub = target.dataset.lpSub || '';

        lpTimer = setTimeout(() => {
            markLongPressSuppressed(target);
            if (navigator.vibrate) navigator.vibrate(40);
            openInferredLongPressMenu(lpTitle, lpSub);
        }, 600);
    }

    document.addEventListener('mousedown', handleDelegatedLongPressStart, false);
    document.addEventListener('touchstart', handleDelegatedLongPressStart, { passive: true });

// ═══════════════════════════════════════════════════════════════════
// § COMPAT BRIDGE — Legacy global references
// ═══════════════════════════════════════════════════════════════════

    function cloneBackendValue(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function exportBackendPayload() {
        return {
            userState: {
                playCounts: Object.fromEntries(playCounts),
                lastPlayed: Object.fromEntries(lastPlayed),
                likedTracks: [...likedTracks],
                trackRatings: Object.fromEntries(trackRatings),
                userPlaylists: cloneBackendValue(userPlaylists),
                metadataOverrides: Object.fromEntries(metadataOverrides),
                albumProgress: Object.fromEntries(albumProgress),
                preferences: {
                    sort: currentSort,
                    volume: currentVolume,
                    speed: playbackRate,
                    crossfadeEnabled: Boolean(crossfadeEnabled),
                    replayGainEnabled: replayGainEnabled !== false,
                    gaplessEnabled: Boolean(gaplessEnabled),
                    eqEnabled: Boolean(eqEnabled),
                    eqBands: Array.isArray(eqBandGains) ? eqBandGains.slice() : []
                }
            },
            librarySnapshot: {
                schema: LIBRARY_CACHE_SCHEMA_VERSION,
                albums: cloneBackendValue(LIBRARY_ALBUMS),
                artists: cloneBackendValue(LIBRARY_ARTISTS),
                tracks: cloneBackendValue(LIBRARY_TRACKS),
                playlists: cloneBackendValue(LIBRARY_PLAYLISTS),
                sources: (Array.isArray(mediaFolders) ? mediaFolders : []).map((folder) => ({
                    id: folder?.id || '',
                    displayName: folder?.name || 'Local Folder',
                    kind: 'local_folder',
                    status: 'active',
                    lastScanned: folder?.lastScanned || ''
                })),
                generatedAt: new Date().toISOString()
            },
            playbackSession: {
                nowPlaying: serializeTrackForPlaybackState(nowPlaying),
                queue: queueTracks.map((track) => serializeTrackForPlaybackState(track)).filter(Boolean),
                queueIndex,
                repeatMode,
                shuffleMode: Boolean(isShuffleEnabled),
                isPlaying: Boolean(isPlaying),
                positionMs: audioEngine && Number.isFinite(audioEngine.currentTime) ? Math.round(audioEngine.currentTime * 1000) : 0,
                activeId,
                activeAlbumTitle,
                activeAlbumArtist,
                updatedAt: new Date().toISOString()
            }
        };
    }

    function resolveBackendTrack(track) {
        return hydratePlaybackTrack(track);
    }

    function applyBackendUserState(userState = {}) {
        playCounts.clear();
        Object.entries(userState.playCounts || {}).forEach(([key, value]) => playCounts.set(key, Number(value) || 0));
        persistPlayCounts();

        lastPlayed.clear();
        Object.entries(userState.lastPlayed || {}).forEach(([key, value]) => lastPlayed.set(key, Number(value) || 0));
        persistLastPlayed();

        likedTracks.clear();
        (Array.isArray(userState.likedTracks) ? userState.likedTracks : []).forEach((value) => {
            const key = String(value || '').trim();
            if (key) likedTracks.add(key);
        });
        persistLiked();

        trackRatings.clear();
        Object.entries(userState.trackRatings || {}).forEach(([key, value]) => trackRatings.set(key, Number(value) || 0));
        persistRatings();

        userPlaylists = cloneBackendValue(Array.isArray(userState.userPlaylists) ? userState.userPlaylists : []);
        persistUserPlaylists();

        metadataOverrides = new Map(Object.entries(userState.metadataOverrides || {}));
        persistMetadataOverrides();

        albumProgress.clear();
        Object.entries(userState.albumProgress || {}).forEach(([key, value]) => albumProgress.set(key, value));
        persistAlbumProgress();

        const prefs = userState.preferences || {};
        currentSort = String(prefs.sort || currentSort || 'Recently Added');
        safeStorage.setItem(STORAGE_KEYS.sort, currentSort);

        if (prefs.volume != null) setVolume(Number(prefs.volume));
        if (prefs.speed != null) setPlaybackSpeed(Number(prefs.speed));

        crossfadeEnabled = Boolean(prefs.crossfadeEnabled);
        replayGainEnabled = prefs.replayGainEnabled !== false;
        gaplessEnabled = Boolean(prefs.gaplessEnabled);
        eqEnabled = Boolean(prefs.eqEnabled);
        safeStorage.setItem(STORAGE_KEYS.crossfade, crossfadeEnabled ? '1' : '0');
        safeStorage.setItem(STORAGE_KEYS.replayGain, replayGainEnabled ? '1' : '0');
        safeStorage.setItem(STORAGE_KEYS.gapless, gaplessEnabled ? '1' : '0');
        safeStorage.setItem(STORAGE_KEYS.eq, eqEnabled ? '1' : '0');

        if (Array.isArray(prefs.eqBands) && prefs.eqBands.length === EQ_FREQUENCIES.length) {
            eqBandGains = prefs.eqBands.map((value) => Number(value) || 0);
            safeStorage.setJson(STORAGE_KEYS.eqBands, eqBandGains);
        }

        renderEqPanel();
        updatePlaybackHealthWarnings();
        syncLikeButtons();
        syncTrackStateButtons();
    }

    function applyBackendLibrarySnapshot(librarySnapshot = {}) {
        if (!Array.isArray(librarySnapshot.albums)) return;
        const schema = Number(librarySnapshot.schema || 0);
        if (schema < LIBRARY_CACHE_SCHEMA_VERSION) {
            if (typeof scheduleCanonicalLibraryBackendSync === 'function') {
                scheduleCanonicalLibraryBackendSync('reject_stale_backend_library_snapshot');
            }
            return;
        }
        installLibrarySnapshot(cloneBackendValue(librarySnapshot.albums), {
            force: true,
            renderHome: true,
            renderLibrary: true,
            syncEmpty: true,
            updateHealth: true
        });
    }

    function applyBackendPlaybackSession(playbackSession = {}) {
        const incomingQueue = Array.isArray(playbackSession.queue) ? playbackSession.queue : [];
        queueTracks = incomingQueue.map((track) => resolveBackendTrack(track)).filter(Boolean);
        queueIndex = Math.max(0, Math.min(Number(playbackSession.queueIndex) || 0, Math.max(0, queueTracks.length - 1)));
        repeatMode = String(playbackSession.repeatMode || repeatMode || 'off');
        isShuffleEnabled = Boolean(playbackSession.shuffleMode);

        const nextTrack = resolveBackendTrack(playbackSession.nowPlaying) || queueTracks[queueIndex] || null;
        if (nextTrack) {
            setNowPlaying(nextTrack, false);
            updateProgressUI(Math.max(0, Number(playbackSession.positionMs || 0)) / 1000, nextTrack.durationSec || 0);
        }

        setPlayButtonState(Boolean(playbackSession.isPlaying));
        persistQueue();
        renderQueue();
    }

    function applyBackendPayload(payload = {}) {
        if (payload.userState) applyBackendUserState(payload.userState);
        if (payload.librarySnapshot) applyBackendLibrarySnapshot(payload.librarySnapshot);
        if (payload.playbackSession) applyBackendPlaybackSession(payload.playbackSession);
        renderHomeSections();
        renderLibraryViews({ force: true });
        if (activeId === 'settings') renderSettingsFolderList();
    }

    window.showToast = toast;
    window.AuralisApp = {
        navigate: push,
        back: pop,
        switchTab: switchTab,
        toggleOverlay: toggleOverlay,
        playTrack: playTrack,
        togglePlayback: togglePlayback,
        playNext: playNext,
        playPrevious: playPrevious,
        renderQueue: renderQueue,
        toast: toast,
        setVolume: setVolume,
        toggleMute: toggleMute,
        setPlaybackSpeed: setPlaybackSpeed,
        cyclePlaybackSpeed: cyclePlaybackSpeed,
        startSleepTimer: startSleepTimer,
        cancelSleepTimer: cancelSleepTimer,
        toggleLikeTrack: toggleLikeTrack,
        rateTrack: rateTrack,
        getPlayCount: getPlayCount,
        createUserPlaylist: createUserPlaylist,
        deleteUserPlaylist: deleteUserPlaylist,
        addTrackToUserPlaylist: addTrackToUserPlaylist,
        generateSmartPlaylist: generateSmartPlaylist,
        toggleLyrics: toggleLyrics,
        toggleCrossfade: toggleCrossfade,
        toggleReplayGain: toggleReplayGain,
        // Testing / diagnostic hooks
        _installLibrarySnapshot: installLibrarySnapshot,
        _getLibrary: () => ({ albums: LIBRARY_ALBUMS, tracks: LIBRARY_TRACKS, artists: LIBRARY_ARTISTS }),
        _resolveAlbumMeta: (title, artist = '') => resolveAlbumMeta(title, artist),
        _exportBackendPayload: exportBackendPayload,
        _applyBackendPayload: applyBackendPayload,
        _syncCanonicalBackend: () => syncCanonicalLibraryBackend('manual'),
        _hydrateCanonicalBackendCache: () => hydrateCanonicalLibraryBackendCache('manual'),
        _getCanonicalBackendSummary: () => getCanonicalLibraryBackendSummary(),
        _getCanonicalBackendCacheSummary: () => getCanonicalLibraryBackendCacheSummary()
    };

})();
