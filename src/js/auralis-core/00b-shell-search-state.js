/*
 * Auralis JS shard: 00b-shell-search-state.js
 * Purpose: media search history, undo toast, refs, track UI registry, blob URL helpers
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function getMediaSearchHistory() {
        const entries = getUiPreference('mediaSearchHistory', []);
        return Array.isArray(entries)
            ? entries.filter(entry => entry && typeof entry === 'object' && entry.title).slice(0, 12)
            : [];
    }

    function makeSearchHistoryEntry(type, item = {}, context = {}) {
        const itemType = String(type || item.type || 'song');
        const stableId = item.id || item.key || item.trackId || getStableTrackIdentity(item) || trackKey(item.title, item.artist);
        return {
            type: itemType,
            id: String(stableId || `${itemType}:${item.title || item.name || Date.now()}`),
            title: item.title || item.name || 'Untitled',
            subtitle: item.subtitle || item.artist || item.albumArtist || item.albumTitle || '',
            artwork: item.artUrl || item.artwork || '',
            icon: context.icon || (itemType === 'album' ? 'album' : itemType === 'artist' ? 'artist' : itemType === 'playlist' ? 'playlist' : itemType === 'folder' ? 'folder' : itemType === 'genre' ? 'tag' : 'music'),
            lastQuery: context.query || searchQuery || '',
            filters: Array.isArray(context.filters) ? context.filters : Array.from(searchFilters || []),
            timestamp: Date.now()
        };
    }

    function rememberMediaSearchActivation(entry) {
        if (!entry || !entry.title) return;
        const normalized = {
            ...entry,
            id: String(entry.id || `${entry.type || 'media'}:${entry.title}`),
            timestamp: Number(entry.timestamp || Date.now())
        };
        const dedupeKey = `${normalized.type || 'media'}:${normalized.id}`.toLowerCase();
        const next = [normalized]
            .concat(getMediaSearchHistory().filter(item => `${item.type || 'media'}:${item.id}`.toLowerCase() !== dedupeKey))
            .slice(0, 12);
        setUiPreference('mediaSearchHistory', next);
    }

    function hashIdentity(value) {
        const input = String(value || 'auralis').trim() || 'auralis';
        let hash = 0;
        for (let index = 0; index < input.length; index += 1) {
            hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
        }
        return Math.abs(hash);
    }

    function getStableArtworkFallback(identity = '', kind = 'album') {
        const palettes = [
            ['#1f2937', '#0f766e'],
            ['#111827', '#7c3aed'],
            ['#172554', '#0891b2'],
            ['#3f1d38', '#be123c'],
            ['#052e16', '#65a30d'],
            ['#312e81', '#2563eb']
        ];
        const index = hashIdentity(`${kind}:${identity}`) % palettes.length;
        const [from, to] = palettes[index];
        return `linear-gradient(135deg, ${from}, ${to})`;
    }

    let activeUndoTimer = null;
    let activeUndoAction = null;

    function presentUndoToast(message, undoLabel, undoAction, timeoutMs = 5200) {
        activeUndoAction = typeof undoAction === 'function' ? undoAction : null;
        if (activeUndoTimer) clearTimeout(activeUndoTimer);
        activeUndoTimer = setTimeout(() => {
            activeUndoAction = null;
            activeUndoTimer = null;
        }, timeoutMs);
        toast(`${message} · ${undoLabel || 'Undo'}`, timeoutMs);
        const toastNode = getEl('toast');
        if (toastNode && activeUndoAction) {
            toastNode.classList.add('toast-undo');
            toastNode.setAttribute('role', 'button');
            toastNode.setAttribute('tabindex', '0');
            toastNode.setAttribute('aria-label', `${message}. ${undoLabel || 'Undo'}`);
            toastNode.onclick = () => runActiveUndoAction();
            toastNode.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    runActiveUndoAction();
                }
            };
        }
    }

    function runActiveUndoAction() {
        const action = activeUndoAction;
        activeUndoAction = null;
        if (activeUndoTimer) clearTimeout(activeUndoTimer);
        activeUndoTimer = null;
        if (typeof action === 'function') {
            action();
            toast('Undone');
            return true;
        }
        toast('Nothing to undo');
        return false;
    }

    let lpTimer = null;
    let longPressFiredAt = 0;
    const longPressBindingCleanup = new WeakMap();
    let queueDragSuppressUntil = 0;
    let albumArtViewerOpen = false;
    let albumArtViewerLastFocus = null;
    let nowPlayingMarqueeRaf = null;
    let longPressSuppression = { target: null, expiresAt: 0 };
    let libraryRenderDirty = true;
    let libraryStructureSignature = '[]';
    let librarySnapshotArtworkUrls = new Set();

    // File handle cache: maps normalized filename → FileSystemFileHandle
    const fileHandleCache = new Map();
    // Blob URL cache: maps track identity / handle hints → blob URL (avoids re-creating blobs)
    const blobUrlCache = new Map();
    // Art handle cache: maps subDir/folderName → FileSystemFileHandle for album art images
    const artHandleCache = new Map();
    const playbackBlobUrls = new Set();
    const domRefCache = new Map();
    const trackUiRegistry = new Map();
    let trackUiRegistryRevision = 0;
    let activeTrackUiSyncSignature = '';

    bridgeStateProp(APP_STATE.playback, 'queue', () => queueTracks, (value) => { queueTracks = Array.isArray(value) ? value : []; });
    bridgeStateProp(APP_STATE.playback, 'nowPlaying', () => nowPlaying, (value) => { nowPlaying = value || null; });
    bridgeStateProp(APP_STATE.playback, 'queueIndex', () => queueIndex, (value) => { queueIndex = Number(value) || 0; });
    bridgeStateProp(APP_STATE.playback, 'isPlaying', () => isPlaying, (value) => { isPlaying = Boolean(value); });
    bridgeStateProp(APP_STATE.playback, 'isSeeking', () => isSeeking, (value) => { isSeeking = Boolean(value); });
    bridgeStateProp(APP_STATE.playback, 'volume', () => currentVolume, (value) => { currentVolume = Number(value) || 0; });
    bridgeStateProp(APP_STATE.playback, 'rate', () => playbackRate, (value) => { playbackRate = Number(value) || 1; });
    bridgeStateProp(APP_STATE.playback, 'crossfadeEnabled', () => crossfadeEnabled, (value) => { crossfadeEnabled = Boolean(value); });
    bridgeStateProp(APP_STATE.library, 'albums', () => LIBRARY_ALBUMS, (value) => { LIBRARY_ALBUMS = Array.isArray(value) ? value : []; });
    bridgeStateProp(APP_STATE.library, 'tracks', () => LIBRARY_TRACKS, (value) => { LIBRARY_TRACKS = Array.isArray(value) ? value : []; });
    bridgeStateProp(APP_STATE.library, 'artists', () => LIBRARY_ARTISTS, (value) => { LIBRARY_ARTISTS = Array.isArray(value) ? value : []; });
    bridgeStateProp(APP_STATE.library, 'playlists', () => LIBRARY_PLAYLISTS, (value) => { LIBRARY_PLAYLISTS = Array.isArray(value) ? value : []; });
    bridgeStateProp(APP_STATE.userData, 'playCounts', () => playCounts, () => {});
    bridgeStateProp(APP_STATE.userData, 'lastPlayed', () => lastPlayed, () => {});
    bridgeStateProp(APP_STATE.userData, 'likedTracks', () => likedTracks, () => {});
    bridgeStateProp(APP_STATE.userData, 'trackRatings', () => trackRatings, () => {});
    bridgeStateProp(APP_STATE.userData, 'userPlaylists', () => userPlaylists, (value) => { userPlaylists = normalizeUserPlaylists(value); });
    bridgeStateProp(APP_STATE.ui, 'activeId', () => activeId, (value) => { activeId = String(value || 'home'); });
    bridgeStateProp(APP_STATE.ui, 'currentSort', () => currentSort, (value) => { currentSort = String(value || 'Recently Added'); });
    bridgeStateProp(APP_STATE.ui, 'libraryRenderDirty', () => libraryRenderDirty, (value) => { libraryRenderDirty = Boolean(value); });

    // Shared Helpers
    function getRef(id) {
        if (!id) return null;
        const cached = domRefCache.get(id);
        if (cached && cached.isConnected) return cached;
        const found = document.getElementById(id);
        if (found) domRefCache.set(id, found);
        else domRefCache.delete(id);
        return found;
    }

    function getEl(id) {
        return getRef(id);
    }

    function invalidateRef(id) {
        if (!id) return;
        domRefCache.delete(id);
    }

    function setLibraryRenderDirty(next = true) {
        libraryRenderDirty = Boolean(next);
        APP_STATE.emit('library:dirty-changed', { dirty: libraryRenderDirty });
    }

    function consumeLibraryRenderDirty() {
        if (!libraryRenderDirty) return false;
        libraryRenderDirty = false;
        return true;
    }

    function shouldSuppressLongPressClick(target) {
        if (!target) return false;
        const expiresAt = Number(longPressSuppression.expiresAt || 0);
        if (Date.now() > expiresAt) return false;
        const suppressionTarget = longPressSuppression.target;
        if (!suppressionTarget || !suppressionTarget.isConnected) return false;
        return suppressionTarget === target || suppressionTarget.contains(target) || target.contains(suppressionTarget);
    }

    function markLongPressSuppressed(target, windowMs = 450) {
        longPressSuppression = {
            target: target || null,
            expiresAt: Date.now() + Math.max(0, Number(windowMs) || 0)
        };
        longPressFiredAt = Date.now();
    }

    function clearLongPressSuppression() {
        longPressSuppression = { target: null, expiresAt: 0 };
    }

    function pruneTrackUiList(trackKey) {
        const bindings = trackUiRegistry.get(trackKey);
        if (!bindings || !bindings.length) return [];
        const next = bindings.filter((binding) => {
            const nodes = []
                .concat(binding?.row || [])
                .concat(binding?.click || [])
                .concat(binding?.title || [])
                .concat(binding?.stateButton || [])
                .concat(binding?.durations || [])
                .concat(binding?.arts || []);
            if (!nodes.length) return false;
            return nodes.some((node) => node && node.isConnected);
        });
        if (next.length) trackUiRegistry.set(trackKey, next);
        else trackUiRegistry.delete(trackKey);
        return next;
    }

    function registerTrackUi(trackKeyValue, binding) {
        const key = String(trackKeyValue || '').trim();
        if (!key || !binding) return;
        const list = pruneTrackUiList(key);
        list.push(binding);
        trackUiRegistry.set(key, list);
        trackUiRegistryRevision++;
    }

    function unregisterTrackUi(trackKeyValue, bindingOrElement) {
        const key = String(trackKeyValue || '').trim();
        if (!key) return;
        const list = pruneTrackUiList(key);
        if (!list.length) return;
        const next = list.filter((binding) => {
            if (bindingOrElement === binding) return false;
            if (bindingOrElement && binding && typeof bindingOrElement.nodeType === 'number') {
                if (binding.row === bindingOrElement || binding.click === bindingOrElement || binding.stateButton === bindingOrElement) return false;
                if (Array.isArray(binding.durations) && binding.durations.includes(bindingOrElement)) return false;
                if (Array.isArray(binding.arts) && binding.arts.includes(bindingOrElement)) return false;
            }
            return true;
        });
        if (next.length) trackUiRegistry.set(key, next);
        else trackUiRegistry.delete(key);
        trackUiRegistryRevision++;
    }

    function getTrackUiBindings(trackKeyValue) {
        return pruneTrackUiList(String(trackKeyValue || '').trim());
    }

    function clearTrackUiRegistryForRoot(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        root.querySelectorAll('[data-track-key]').forEach((node) => {
            unregisterTrackUi(node.dataset.trackKey, node);
        });
    }

    function revokeObjectUrl(url) {
        if (!url || typeof url !== 'string') return;
        try { URL.revokeObjectURL(url); } catch (_) { /* benign: cleanup */ }
    }

    function revokeUrlSet(urls) {
        if (!urls) return;
        Array.from(urls).forEach((url) => revokeObjectUrl(url));
        if (typeof urls.clear === 'function') urls.clear();
    }

    function revokePlaybackBlobUrl(url) {
        if (!url) return;
        revokeObjectUrl(url);
        playbackBlobUrls.delete(url);
    }

    function trackPlaybackBlobUrl(url) {
        if (!url || typeof url !== 'string' || !/^blob:/i.test(url)) return url;
        playbackBlobUrls.add(url);
        return url;
    }

    function collectSnapshotArtworkUrls(albums) {
        const urls = new Set();
        (Array.isArray(albums) ? albums : []).forEach((album) => {
            if (album?.artUrl && /^blob:/i.test(album.artUrl)) urls.add(album.artUrl);
            (Array.isArray(album?.tracks) ? album.tracks : []).forEach((track) => {
                if (track?.artUrl && /^blob:/i.test(track.artUrl)) urls.add(track.artUrl);
            });
        });
        return urls;
    }

    function setDelegatedAction(el, action, payload = {}) {
        if (!el) return el;
        el.dataset.action = action;
        Object.entries(payload).forEach(([key, value]) => {
            if (value == null) return;
            el.dataset[key] = String(value);
        });
        return el;
    }

    function getNowPlayingTrackKey() {
        return getTrackIdentityKey(nowPlaying);
    }

    function getPlaybackIconPath(playing) {
        return playing ? PAUSE_ICON_PATH : PLAY_ICON_PATH;
    }

    function getPlaybackIconSvg(playing) {
        return `<svg viewBox="0 0 24 24"><path d="${getPlaybackIconPath(playing)}"></path></svg>`;
    }

    function setPlaybackIcon(target, playing) {
        if (!target) return;
        const maybePathTag = String(target.tagName || '').toLowerCase() === 'path';
        if (maybePathTag) {
            target.setAttribute('d', getPlaybackIconPath(playing));
            return;
        }
        const path = typeof target.querySelector === 'function' ? target.querySelector('svg path') : null;
        if (path) path.setAttribute('d', getPlaybackIconPath(playing));
        if (target.classList) target.classList.toggle('is-playing', Boolean(playing));
    }

    function updateTrackStateButtonVisual(btn, isCurrentTrack = false) {
        if (!btn) return;
        const shouldShowPause = Boolean(isCurrentTrack && isPlaying);
        setPlaybackIcon(btn, shouldShowPause);
        btn.classList.toggle('is-current-track', Boolean(isCurrentTrack));
        const title = btn.dataset.trackTitle || 'track';
        const label = shouldShowPause
            ? `Pause ${title}`
            : (isCurrentTrack ? `Resume ${title}` : `Play ${title}`);
        btn.setAttribute('aria-label', label);
    }

    function syncTrackStateButtons() {
        const nowKey = getNowPlayingTrackKey();
        const seen = new Set();
        Array.from(trackUiRegistry.keys()).forEach((trackKeyValue) => {
            getTrackUiBindings(trackKeyValue).forEach((binding) => {
                const btn = binding?.stateButton;
                if (!btn || !btn.isConnected || seen.has(btn)) return;
                seen.add(btn);
                updateTrackStateButtonVisual(btn, Boolean(nowKey && trackKeyValue === nowKey));
            });
        });
        document.querySelectorAll('.track-state-btn').forEach((btn) => {
            if (!btn || seen.has(btn)) return;
            const btnTrackKey = String(btn.dataset.trackKey || '').trim();
            updateTrackStateButtonVisual(btn, Boolean(nowKey && btnTrackKey === nowKey));
        });
    }

    function createTrackStateButton(track, onActivate, options = {}) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `track-state-btn${options.compact ? ' is-compact' : ''}`;
        btn.dataset.trackTitle = String(track?.title || 'track');
        btn.dataset.trackKey = getTrackIdentityKey(track);
        btn.dataset.trackId = getStableTrackIdentity(track);
        btn.innerHTML = getPlaybackIconSvg(false);
        btn.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            const nowKey = getNowPlayingTrackKey();
            const isCurrentTrack = Boolean(nowKey && btn.dataset.trackKey === nowKey);
            if (isCurrentTrack && nowPlaying) {
                togglePlayback(evt);
                return;
            }
            if (typeof onActivate === 'function') onActivate(evt);
        });
        updateTrackStateButtonVisual(btn, btn.dataset.trackKey === getNowPlayingTrackKey());
        return btn;
    }

    function disableEl(el) {
        if (!el) return;
        el.style.pointerEvents = 'none';
        el.setAttribute('aria-disabled', 'true');
    }
    function enableEl(el) {
        if (!el) return;
        el.style.pointerEvents = 'auto';
        el.removeAttribute('aria-disabled');
    }

    // ── Persistence helpers for new features ──
    function persistLiked() { safeStorage.setJson(STORAGE_KEYS.likedTracks, [...likedTracks]); }
    function persistRatings() { safeStorage.setJson(STORAGE_KEYS.trackRatings, Object.fromEntries(trackRatings)); }
    function persistPlayCounts() { safeStorage.setJson(STORAGE_KEYS.playCounts, Object.fromEntries(playCounts)); }
    function persistLastPlayed() { safeStorage.setJson(STORAGE_KEYS.lastPlayed, Object.fromEntries(lastPlayed)); }
    function persistUserPlaylists() {
        userPlaylists = normalizeUserPlaylists(userPlaylists);
        safeStorage.setJson(
            STORAGE_KEYS.userPlaylists,
            userPlaylists.map((playlist) => serializeUserPlaylist(playlist)).filter(Boolean)
        );
        // Keep LIBRARY_PLAYLISTS and playlistById in sync with every mutation
        LIBRARY_PLAYLISTS = userPlaylists.slice();
        playlistById.clear();
        userPlaylists.forEach(pl => { if (pl?.id) playlistById.set(pl.id, pl); });
    }
    // Album progress: Map<albumKey, { trackIndex, position, total, timestamp }>
    const albumProgress = new Map(Object.entries(safeStorage.getJson(STORAGE_KEYS.albumProgress, {})));
    function persistAlbumProgress() { safeStorage.setJson(STORAGE_KEYS.albumProgress, Object.fromEntries(albumProgress)); }
    function recordAlbumProgress(albumTitle, trackIndex, position, total, albumArtist = '') {
        if (!albumTitle) return;
        const key = albumIdentityKey(albumTitle, albumArtist);
        albumProgress.set(key, { trackIndex, position, total, timestamp: Date.now() });
        persistAlbumProgress();
    }
    function getAlbumProgress(albumTitle, albumArtist = '') {
        return albumProgress.get(albumIdentityKey(albumTitle, albumArtist))
            || albumProgress.get(albumKey(albumTitle))
            || null;
    }
    function clearAlbumProgress(albumTitle, albumArtist = '') {
        albumProgress.delete(albumIdentityKey(albumTitle, albumArtist));
        albumProgress.delete(albumKey(albumTitle));
        persistAlbumProgress();
    }
    function persistQueue() {
        try {
            const qData = {
                tracks: queueTracks.map((track) => serializeTrackForPlaybackState(track)).filter(Boolean),
                index: queueIndex
            };
            safeStorage.setJson(STORAGE_KEYS.queue, qData);
        } catch (_) { /* benign: cleanup */ }
    }

    function clearDemoMarkup() {
        [
            'lib-playlists-list',
            'lib-albums-grid',
            'lib-artists-list',
            'lib-songs-list',
            'playlist-track-list',
            'album-track-list',
            'sidebar-playlists-list',
            'search-cat-grid'
        ].forEach((id) => {
            const el = getEl(id);
            if (el) el.innerHTML = '';
        });

        const artistTopTracks = document.querySelector('#artist_profile .list-wrap');
        if (artistTopTracks) artistTopTracks.innerHTML = '';
        const artistReleases = document.querySelector('#artist_profile .horizon-scroller');
        if (artistReleases) artistReleases.innerHTML = '';
    }

    function normalizeAlbumTitle(raw) {
        return String(raw || '')
            .replace(/^[_\s]+|[_\s]+$/g, '')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\s+\?/g, '?')
            .trim();
    }

