/*
 * Auralis JS shard: 11-events-compat.js
 * Purpose: delegated event action map, long press delegation, legacy global bridge
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
// Â§ EVENT DELEGATION SYSTEM
// Replaces all inline onclick/onmousedown/ontouchstart handlers
// Elements use data-action attributes instead of inline JS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
        playTrack: (e, el) => playTrack(el.dataset.title, el.dataset.artist, el.dataset.album),
        toggleShuffle: () => toggleShuffle(),

        // Routes
        navToAlbum: (e, el) => navToAlbum(el.dataset.album, el.dataset.artist),
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
        filterHome: (e, el) => filterHome(el.dataset.filter),
        toast: (e, el) => toast(el.dataset.message),

        // Party
        setRole: (e, el) => setRole(el.dataset.role),
        startParty: () => startParty(),
        leaveParty: () => leaveParty(),

        // Sheet / Overlay
        closeSheet: () => closeSheet(),
        addCurrentToQueue: () => { addCurrentToQueue(); closeSheet(); },
        playCurrentNext: () => { playCurrentNext(); closeSheet(); },
        shareAndClose: () => { toast('Sharing menu opened...'); closeSheet(); },
        removeAndClose: () => { toast('Removed from library'); closeSheet(); },

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
        openAlbumMetaZenithMenu: () => openAlbumZenithMenu(albumByTitle.get(albumKey(activeAlbumTitle)) || LIBRARY_ALBUMS[0]),

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

        // Volume, Speed, Sleep, Lyrics, Like
        setVolume: (e, el) => setVolume(el.value),
        toggleMute: () => toggleMute(),
        cycleSpeed: () => cyclePlaybackSpeed(),
        sleepTimer: (e, el) => startSleepTimer(Number(el.dataset.minutes) || 15),
        cancelSleep: () => cancelSleepTimer(),
        toggleLyrics: () => toggleLyrics(),
        toggleLike: () => { if (nowPlaying) toggleLikeTrack(nowPlaying); },
        toggleCrossfade: () => toggleCrossfade(),
        toggleReplayGain: () => toggleReplayGain(),
        createPlaylist: () => {
            const name = prompt('Playlist name:');
            if (name) createUserPlaylist(name);
        }
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Â§ COMPAT BRIDGE â€” Legacy global references
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
        toggleReplayGain: toggleReplayGain
    };

})();

