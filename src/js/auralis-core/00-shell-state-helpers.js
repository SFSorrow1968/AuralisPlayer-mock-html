/*
 * Auralis JS shard: 00-shell-state-helpers.js
 * Purpose: IIFE shell, app state, shared helpers, action sheets, album progress, playable URL resolution
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// auralis-core.js â€” Unified AuralisPlayer Runtime
// Merged from inline script + zenith_overrides.js into single module
// Architecture: IIFE with delegated event system, zero inline handlers
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(function () {
    'use strict';

    // Core State
    let activeId = 'home';
    let historyStack = ['home'];
    let pOpen = false;
    let role = 'host';
    let pState = 'disconnected';
    let inEditMode = false;
    let currentSort = 'Recently Added';
    let currentHomeFilter = 'all';

    const FALLBACK_GRADIENT = 'linear-gradient(135deg, #302b63, #24243e)';
    const MAX_QUEUE_SIZE = 160;
    const QUEUE_RENDER_WINDOW = 80;
    const DEFAULT_QUEUE_SIZE = 8;
    const REPLAY_THRESHOLD_SEC = 3;
    const PLAY_ICON_PATH = 'M8 5v14l11-7z';
    const PAUSE_ICON_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
    const DEBUG = false;
    const ARTIST_NAME = 'Unknown Artist';
    const STORAGE_VERSION = '20260419-runtime-refactor-v1';
    const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const EQ_BAND_TYPES = ['lowshelf','peaking','peaking','peaking','peaking','peaking','peaking','peaking','peaking','highshelf'];
    const GAPLESS_PRELOAD_SECONDS = 15;
    const STORAGE_KEYS = Object.freeze({
        storageVersion: 'auralis_storage_version',
        sort: 'auralis_sort',
        onboarded: 'auralis_onboarded',
        setupDone: 'auralis_setup_done',
        homeLayout: 'auralis_home_layout_v2',
        volume: 'auralis_volume',
        previousVolume: 'auralis_prev_volume',
        speed: 'auralis_speed',
        crossfade: 'auralis_crossfade',
        replayGain: 'auralis_replaygain',
        playCounts: 'auralis_playcounts',
        lastPlayed: 'auralis_lastplayed',
        likedTracks: 'auralis_liked',
        trackRatings: 'auralis_ratings',
        userPlaylists: 'auralis_user_playlists',
        metadataOverrides: 'auralis_metadata_overrides',
        albumProgress: 'auralis_album_progress',
        queue: 'auralis_queue',
        libraryCache: 'auralis_library_cache_v2',
        homeSubtext: 'auralis_home_subtext_v1',
        homeTitleMode: 'auralis_home_title_mode_v1',
        homeProfiles: 'auralis_home_profiles_v1',
        homeActiveProfile: 'auralis_home_active_profile_v1',
        entitySubtext: 'auralis_entity_subtext_v1',
        gapless: 'auralis_gapless',
        eq: 'auralis_eq',
        eqBands: 'auralis_eq_bands',
        durationCache: 'auralis_duration_cache_v1'
    });
    const ONBOARDED_KEY = STORAGE_KEYS.onboarded;
    const SETUP_DONE_KEY = STORAGE_KEYS.setupDone;
    const HOME_LAYOUT_KEY = STORAGE_KEYS.homeLayout;
    let SEARCH_DATA = [];
    let LIBRARY_ALBUMS = [];
    let LIBRARY_TRACKS = [];
    let LIBRARY_ARTISTS = [];
    let LIBRARY_PLAYLISTS = [];
    const albumByTitle = new Map();
    const albumByIdentity = new Map();
    const trackByKey = new Map();
    const artistByKey = new Map();
    const playlistById = new Map();
    let queueTracks = [];
    let nowPlaying = null;
    let queueIndex = 0;
    let isShuffleEnabled = false;
    let repeatMode = 'off'; // 'off' | 'all' | 'one'
    let isPlaying = false;
    let isSeeking = false;
    let audioEngine = null;
    let activeAlbumTitle = '';
    let activeAlbumArtist = '';
    let activePlaylistId = '';
    let activePlaybackCollectionType = '';
    let activePlaybackCollectionKey = '';
    let activeArtistName = '';
    let homeSections = [];
    let sectionConfigContextId = '';
    // Safe localStorage wrapper (handles private browsing / quota exceeded)
    const safeStorage = {
        getItem(key) {
            try { return localStorage.getItem(key); } catch (_) { return null; }
        },
        setItem(key, value) {
            try { localStorage.setItem(key, value); } catch (_) {}
        },
        removeItem(key) {
            try { localStorage.removeItem(key); } catch (_) {}
        },
        clearKnownKeys() {
            Object.values(STORAGE_KEYS).forEach((key) => {
                try { localStorage.removeItem(key); } catch (_) {}
            });
        },
        getJson(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return fallback;
                return JSON.parse(raw);
            } catch (_) {
                return fallback;
            }
        },
        setJson(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
        }
    };

    function createEmitter() {
        const listenersByEvent = new Map();
        return {
            on(eventName, handler) {
                if (!eventName || typeof handler !== 'function') return () => {};
                let listeners = listenersByEvent.get(eventName);
                if (!listeners) {
                    listeners = new Set();
                    listenersByEvent.set(eventName, listeners);
                }
                if (DEBUG && listeners.has(handler)) {
                    console.warn('[Auralis] duplicate emitter subscription for', eventName);
                }
                listeners.add(handler);
                return () => this.off(eventName, handler);
            },
            off(eventName, handler) {
                const listeners = listenersByEvent.get(eventName);
                if (!listeners) return;
                listeners.delete(handler);
                if (!listeners.size) listenersByEvent.delete(eventName);
            },
            emit(eventName, payload) {
                const listeners = listenersByEvent.get(eventName);
                if (!listeners || !listeners.size) return;
                Array.from(listeners).forEach((handler) => {
                    try {
                        handler(payload);
                    } catch (err) {
                        if (DEBUG) console.error('[Auralis] emitter handler failed for', eventName, err);
                    }
                });
            }
        };
    }

    const APP_STATE = createEmitter();

    function bridgeStateProp(target, key, getter, setter) {
        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: true,
            get: getter,
            set: setter
        });
    }

    APP_STATE.playback = {};
    APP_STATE.library = {};
    APP_STATE.userData = {};
    APP_STATE.ui = {};

    function initializeStorageVersion() {
        const storedVersion = safeStorage.getItem(STORAGE_KEYS.storageVersion);
        if (storedVersion === STORAGE_VERSION) return false;
        safeStorage.clearKnownKeys();
        safeStorage.setItem(STORAGE_KEYS.storageVersion, STORAGE_VERSION);
        return true;
    }

    if (DEBUG) {
        APP_STATE.on('storage:reset', (payload) => {
            console.log('[Auralis] storage reset', payload);
        });
    }

    const storageWasReset = initializeStorageVersion();
    if (storageWasReset) {
        APP_STATE.emit('storage:reset', { version: STORAGE_VERSION, timestamp: Date.now() });
    }
    currentSort = safeStorage.getItem(STORAGE_KEYS.sort) || 'Recently Added';

    // ── Volume, Speed, Sleep, Crossfade, ReplayGain ──
    let currentVolume = parseFloat(safeStorage.getItem(STORAGE_KEYS.volume) ?? '1');
    let playbackRate = parseFloat(safeStorage.getItem(STORAGE_KEYS.speed) ?? '1');
    let sleepTimerId = null;
    let sleepTimerEnd = 0;
    let crossfadeEnabled = safeStorage.getItem(STORAGE_KEYS.crossfade) === '1';
    const CROSSFADE_DURATION = 3;
    let crossfadeAudio = null;
    let replayGainEnabled = safeStorage.getItem(STORAGE_KEYS.replayGain) !== '0';
    let audioContext = null;
    let gainNode = null;
    let sourceNode = null;
    let activeLoadToken = 0;
    let crossfadeState = null;
    let gaplessEnabled = safeStorage.getItem(STORAGE_KEYS.gapless) === '1';
    let gaplessPreloading = false;
    let eqEnabled = safeStorage.getItem(STORAGE_KEYS.eq) === '1';
    let eqNodes = [];
    let eqBandGains = (() => {
        const stored = safeStorage.getJson(STORAGE_KEYS.eqBands, null);
        if (Array.isArray(stored) && stored.length === 10) return stored.map(Number);
        return new Array(10).fill(0);
    })();

    // ── Play Counts, Liked, Ratings ──
    const playCounts = new Map(Object.entries(safeStorage.getJson(STORAGE_KEYS.playCounts, {})));
    const lastPlayed = new Map(Object.entries(safeStorage.getJson(STORAGE_KEYS.lastPlayed, {})));
    const likedTracks = new Set(safeStorage.getJson(STORAGE_KEYS.likedTracks, []));
    const trackRatings = new Map(Object.entries(safeStorage.getJson(STORAGE_KEYS.trackRatings, {})));
    const durationCache = new Map(Object.entries(safeStorage.getJson(STORAGE_KEYS.durationCache, {})));

    // ── Metadata Overrides (user-edited tags) ──
    let metadataOverrides = new Map(
        Object.entries(safeStorage.getJson(STORAGE_KEYS.metadataOverrides, {}))
    );

    function persistMetadataOverrides() {
        const obj = {};
        metadataOverrides.forEach((v, k) => { obj[k] = v; });
        safeStorage.setJson(STORAGE_KEYS.metadataOverrides, obj);
    }

    // Apply any user-saved tag overrides onto a track object (mutates in-place).
    // Called during library snapshot build so every render sees fresh data.
    function applyMetadataOverride(track) {
        if (!track) return track;
        const key = trackKey(track.title, track.artist);
        const ov = metadataOverrides.get(key);
        if (!ov) return track;
        if (ov.title       !== undefined) track.title       = ov.title;
        if (ov.artist      !== undefined) track.artist      = ov.artist;
        if (ov.albumArtist !== undefined) track.albumArtist = ov.albumArtist;
        if (ov.album       !== undefined) track.albumTitle  = ov.album;
        if (ov.year        !== undefined) track.year        = ov.year;
        if (ov.genre       !== undefined) track.genre       = ov.genre;
        return track;
    }

    // Persist an override.  oldKey is title::artist BEFORE any edits.
    function saveMetadataOverride(oldKey, fields) {
        if (!fields || !oldKey) return;
        const existing = metadataOverrides.get(oldKey) || {};
        const merged = Object.assign({}, existing, fields);
        metadataOverrides.set(oldKey, merged);
        // Also index under the new key so future lookups work
        const newTitle  = String(merged.title  || '').trim();
        const newArtist = String(merged.artist || '').trim();
        if (newTitle || newArtist) {
            const newKey = trackKey(
                newTitle  || oldKey.split('::')[0],
                newArtist || oldKey.split('::')[1]
            );
            if (newKey !== oldKey) metadataOverrides.set(newKey, merged);
        }
        persistMetadataOverrides();
    }

    // ── User Playlists ──
    let userPlaylists = safeStorage.getJson(STORAGE_KEYS.userPlaylists, []);
    // Seed LIBRARY_PLAYLISTS and playlistById from persisted userPlaylists at startup
    if (Array.isArray(userPlaylists) && userPlaylists.length) {
        LIBRARY_PLAYLISTS = userPlaylists.slice();
        userPlaylists.forEach(pl => { if (pl?.id) playlistById.set(pl.id, pl); });
    }

    // Track currently targeted by the action sheet
    let sheetTrack = null;

    const searchFilters = new Set(['all']);
    let searchQuery = '';

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

    // File handle cache: maps normalized filename â†’ FileSystemFileHandle
    const fileHandleCache = new Map();
    // Blob URL cache: maps trackKey â†’ blob URL (avoids re-creating blobs)
    const blobUrlCache = new Map();
    // Art handle cache: maps subDir/folderName â†’ FileSystemFileHandle for album art images
    const artHandleCache = new Map();
    const playbackBlobUrls = new Set();
    const domRefCache = new Map();
    const trackUiRegistry = new Map();

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
    bridgeStateProp(APP_STATE.userData, 'userPlaylists', () => userPlaylists, (value) => { userPlaylists = Array.isArray(value) ? value : []; });
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
        try { URL.revokeObjectURL(url); } catch (_) {}
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
        return nowPlaying ? trackKey(nowPlaying.title, nowPlaying.artist) : '';
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
        btn.dataset.trackKey = track ? trackKey(track.title, track.artist) : '';
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
        safeStorage.setJson(STORAGE_KEYS.userPlaylists, userPlaylists);
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
            const qData = { tracks: queueTracks.map(t => ({ title: t.title, artist: t.artist, albumTitle: t.albumTitle, duration: t.duration, durationSec: t.durationSec, trackNo: t.no || t.trackNo, artUrl: '', _handleKey: t._handleKey || '' })), index: queueIndex };
            safeStorage.setJson(STORAGE_KEYS.queue, qData);
        } catch (_) {}
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

    function albumKey(raw) {
        return normalizeAlbumTitle(raw).toLowerCase();
    }

    function getAlbumPrimaryArtistName(albumLike, fallbackArtist = '') {
        const albumArtist = String(albumLike?.albumArtist || '').trim();
        const artist = String(albumLike?.artist || fallbackArtist || '').trim();
        if (albumArtist && !isLikelyPlaceholderArtist(albumArtist)) return albumArtist;
        if (artist) return artist;
        return '';
    }

    function albumIdentityKey(title, artist = '') {
        const normalizedTitle = normalizeAlbumTitle(title);
        const stableTitle = normalizedTitle && normalizedTitle !== 'Unknown Album'
            ? normalizedTitle
            : String(title || '').trim();
        const titleKey = albumKey(stableTitle);
        const artistKey = toArtistKey(artist);
        return artistKey ? `${titleKey}::${artistKey}` : titleKey;
    }

    function getAlbumIdentityKey(albumLike, fallbackArtist = '') {
        const rawTitle = albumLike?.title || albumLike?.albumTitle || albumLike?.id || '';
        return albumIdentityKey(rawTitle, getAlbumPrimaryArtistName(albumLike, fallbackArtist));
    }

    function albumMatchesArtistHint(album, artistHint = '') {
        const normalizedHint = toArtistKey(artistHint);
        if (!normalizedHint) return true;
        if (toArtistKey(album?.artist || '') === normalizedHint) return true;
        if (toArtistKey(getAlbumPrimaryArtistName(album)) === normalizedHint) return true;
        return Array.isArray(album?.tracks) && album.tracks.some((track) => (
            toArtistKey(track?.artist || '') === normalizedHint
            || toArtistKey(track?.albumArtist || '') === normalizedHint
        ));
    }

    function trackKey(title, artist) {
        return `${String(title || '').trim().toLowerCase()}::${String(artist || '').trim().toLowerCase()}`;
    }

    function normalizeRelativeDir(raw) {
        return String(raw || '')
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '')
            .trim();
    }

    function joinRelativeDir(parentDir, childName) {
        const parent = normalizeRelativeDir(parentDir);
        const child = String(childName || '').trim();
        if (!child) return parent;
        return parent ? `${parent}/${child}` : child;
    }

    function getHandleCacheKey(folderId, subDir, name) {
        const normalizedName = String(name || '').trim().toLowerCase();
        if (!normalizedName) return '';
        return `${String(folderId || '').trim().toLowerCase()}::${normalizeRelativeDir(subDir).toLowerCase()}::${normalizedName}`;
    }

    function getScannedFileHandleKey(file) {
        return getHandleCacheKey(file?.folderId, file?.subDir, file?.name);
    }

    function getArtCacheKey(folderId, subDir) {
        const normalizedFolder = String(folderId || '').trim().toLowerCase();
        const normalizedDir = normalizeRelativeDir(subDir).toLowerCase();
        return `${normalizedFolder}::${normalizedDir || '__root__'}::art`;
    }

    function getAlbumFolderName(subDir, fallback = '') {
        const normalizedDir = normalizeRelativeDir(subDir);
        if (!normalizedDir) return String(fallback || '');
        const parts = normalizedDir.split('/').filter(Boolean);
        return parts[parts.length - 1] || String(fallback || '');
    }

    function getAlbumParentName(subDir, fallback = '') {
        const normalizedDir = normalizeRelativeDir(subDir);
        if (!normalizedDir) return String(fallback || '');
        const parts = normalizedDir.split('/').filter(Boolean);
        return parts.length > 1 ? parts[parts.length - 2] : String(fallback || '');
    }

    // Returns true when a field value is a known fallback / synthesised placeholder
    // rather than real embedded tag data.  Used to drive red error labels in the UI.
    function isMissingMetadata(value, type) {
        const v = String(value || '').trim();
        if (!v) return true;
        if (type === 'artist') return v === ARTIST_NAME || isLikelyPlaceholderArtist(v);
        if (type === 'album')  return v === 'Unknown Album';
        // 'year': caller passes the raw value; empty string = missing
        return false;
    }

    function isLikelyPlaceholderArtist(name) {
        const key = toArtistKey(name);
        if (!key) return true;
        if (key === 'unknown artist' || key === 'unknown folder' || key === 'selected folder') return true;
        if (key === 'music' || key === 'songs' || key === 'audio' || key === 'downloads') return true;
        return mediaFolders.some((folder) => toArtistKey(folder?.name) === key);
    }

    function getCanonicalTrackArtistName(track, fallbackArtist = '') {
        const albumArtist = String(track?.albumArtist || '').trim();
        const trackArtist = String(track?.artist || '').trim();
        const fallback = String(fallbackArtist || '').trim();
        // Prefer the track's own artist tag first — never let albumArtist override it.
        if (trackArtist && !isLikelyPlaceholderArtist(trackArtist)) return trackArtist;
        if (albumArtist && !isLikelyPlaceholderArtist(albumArtist)) return albumArtist;
        if (fallback && !isLikelyPlaceholderArtist(fallback)) return fallback;
        if (trackArtist) return trackArtist;
        return ARTIST_NAME;
    }

    function setNowPlayingMarqueeText(el, text) {
        if (!el) return;
        let rail = el.firstElementChild;
        if (!rail || !rail.classList.contains('np-marquee-rail')) {
            rail = document.createElement('span');
            rail.className = 'np-marquee-rail';
            const track = document.createElement('span');
            track.className = 'np-marquee-track';
            rail.appendChild(track);
            el.textContent = '';
            el.appendChild(rail);
        }
        const track = rail.querySelector('.np-marquee-track');
        if (!track) return;
        track.textContent = text || '';
        rail.dataset.overflow = '0';
        rail.style.removeProperty('--marquee-shift');
    }

    function updateNowPlayingMarquee(scope = document) {
        const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
        root.querySelectorAll('.np-marquee-rail').forEach((rail) => {
            const track = rail.querySelector('.np-marquee-track');
            if (!track) return;
            const overflow = track.scrollWidth - rail.clientWidth;
            if (overflow > 8) {
                rail.dataset.overflow = '1';
                rail.style.setProperty('--marquee-shift', `${Math.ceil(overflow) + 16}px`);
            } else {
                rail.dataset.overflow = '0';
                rail.style.removeProperty('--marquee-shift');
            }
        });
    }

    function scheduleNowPlayingMarquee(scope = document) {
        if (nowPlayingMarqueeRaf) cancelAnimationFrame(nowPlayingMarqueeRaf);
        nowPlayingMarqueeRaf = requestAnimationFrame(() => {
            nowPlayingMarqueeRaf = null;
            updateNowPlayingMarquee(scope);
        });
    }

    function toDurationLabel(sec) {
        if (!Number.isFinite(sec) || sec <= 0) return '--:--';
        const whole = Math.round(sec);
        const min = Math.floor(whole / 60);
        const rem = whole % 60;
        return `${min}:${String(rem).padStart(2, '0')}`;
    }

    function toLibraryDurationTotal(tracks) {
        const totalSec = tracks.reduce((sum, t) => sum + (t.durationSec || 0), 0);
        if (!totalSec) return '--';
        return `${Math.floor(totalSec / 3600)}h ${Math.floor((totalSec % 3600) / 60)}m`;
    }

    function toDurationSeconds(label) {
        const match = String(label || '').trim().match(/^(\d+):(\d{2})$/);
        if (!match) return 0;
        return (Number(match[1]) * 60) + Number(match[2]);
    }

    function getTrackDurationCacheKey(track) {
        if (!track) return '';
        return String(
            track._handleKey
            || track.path
            || [track.albumTitle || '', track.title || '', track.artist || ''].join('::')
        ).trim().toLowerCase();
    }

    function persistDurationCache() {
        const entries = [...durationCache.entries()]
            .filter(([, value]) => Number(value) > 0)
            .slice(-25000);
        safeStorage.setJson(STORAGE_KEYS.durationCache, Object.fromEntries(entries));
    }

    function cacheTrackDuration(track, seconds, options = {}) {
        const sec = Math.round(Number(seconds || 0));
        if (!track || !Number.isFinite(sec) || sec <= 0) return false;
        track.durationSec = sec;
        track.duration = toDurationLabel(sec);
        const cacheKey = getTrackDurationCacheKey(track);
        if (cacheKey) durationCache.set(cacheKey, sec);
        if (options.persist !== false) persistDurationCache();
        return true;
    }

    function hydrateTrackDurationFromCache(track) {
        if (!track) return 0;
        const current = Number(track.durationSec || 0);
        if (Number.isFinite(current) && current > 0) {
            cacheTrackDuration(track, current, { persist: false });
            return current;
        }
        const fromLabel = toDurationSeconds(track.duration);
        if (fromLabel > 0) {
            cacheTrackDuration(track, fromLabel, { persist: false });
            return fromLabel;
        }
        const cacheKey = getTrackDurationCacheKey(track);
        const cached = Number(cacheKey ? durationCache.get(cacheKey) : 0);
        if (Number.isFinite(cached) && cached > 0) {
            cacheTrackDuration(track, cached, { persist: false });
            return cached;
        }
        return 0;
    }

    function getTrackDurationSeconds(track) {
        if (!track) return 0;
        const sec = Number(track.durationSec || 0);
        if (Number.isFinite(sec) && sec > 0) return sec;
        return hydrateTrackDurationFromCache(track);
    }

    function getTrackDurationDisplay(track) {
        const sec = getTrackDurationSeconds(track);
        return sec > 0 ? toDurationLabel(sec) : '--:--';
    }

    function escapeTrackKeySelectorValue(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
        return String(value || '').replace(/["\\]/g, '\\$&');
    }

    function syncTrackDurationElements(track) {
        if (!track) return;
        const key = trackKey(track.title, track.artist);
        const label = getTrackDurationDisplay(track);
        const escapedKey = escapeTrackKeySelectorValue(key);
        const selectors = [
            `.list-item[data-track-key="${escapedKey}"]`,
            `[data-track-key="${escapedKey}"]`
        ];
        document.querySelectorAll(selectors.join(',')).forEach((row) => {
            row.querySelectorAll('.album-track-duration, .zenith-time-pill').forEach((timeEl) => {
                timeEl.dataset.originalDuration = label;
                if (!row.classList.contains('playing-row')) timeEl.textContent = label;
            });
        });
    }

    function getAlbumTotalDurationSeconds(albumMeta) {
        if (!albumMeta || !Array.isArray(albumMeta.tracks)) return 0;
        return albumMeta.tracks.reduce((sum, track) => sum + getTrackDurationSeconds(track), 0);
    }

    function getArtistSummary(artistName) {
        const key = toArtistKey(artistName || '');
        const albums = LIBRARY_ALBUMS.filter(album => toArtistKey(album.artist) === key);
        const tracks = LIBRARY_TRACKS.filter(track => toArtistKey(track.artist) === key);
        return {
            albumCount: albums.length,
            trackCount: tracks.length
        };
    }

    function getTopTrackForArtist(artistName) {
        const key = toArtistKey(artistName || '');
        const tracks = LIBRARY_TRACKS
            .filter(track => toArtistKey(track.artist) === key)
            .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
        return tracks[0] || null;
    }

    function showZenithActionSheet(title, sub, actions) {
        if (typeof presentActionSheet === 'function') {
            presentActionSheet(title, sub, actions);
            return;
        }
        const rows = Array.from(document.querySelectorAll('#action-sheet .sheet-action'));
        rows.forEach((row, index) => {
            const action = Array.isArray(actions) ? actions[index] : null;
            if (!action) {
                row.style.display = 'none';
                row.onclick = null;
                return;
            }
            row.style.display = 'flex';
            row.style.color = action.danger ? 'var(--sys-error)' : '';
            row.innerHTML = `
                <div style="display:flex; flex-direction:column; width:100%;">
                    <div style="font-weight:700;">${action.label || 'Action'}</div>
                    <div style="font-size:12px; color:var(--text-secondary);">${action.description || ''}</div>
                </div>
            `;
            row.onclick = () => {
                if (typeof action.onSelect === 'function') action.onSelect();
                if (!action.keepOpen) closeSheet();
            };
        });
        openSheet(title, sub);
    }

    function queueTrackNextSmart(track) {
        if (!track) return;
        const currentIdx = Math.max(0, getCurrentQueueIndex());
        queueTracks.splice(Math.min(currentIdx + 1, queueTracks.length), 0, track);
        renderQueue();
        toast(`"${track.title}" queued next`);
    }

    function addTrackToQueueSmart(track) {
        if (!track) return;
        queueTracks.push(track);
        renderQueue();
        toast(`Added "${track.title}" to queue`);
    }

    function addAlbumToQueueSmart(albumMeta) {
        if (!albumMeta || !Array.isArray(albumMeta.tracks) || albumMeta.tracks.length === 0) return;
        const ordered = albumMeta.tracks.slice().sort((a, b) =>
            Number(a.discNo || 1) - Number(b.discNo || 1)
            || Number(a.no || 0) - Number(b.no || 0)
        );
        queueTracks.push(...ordered);
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(-MAX_QUEUE_SIZE);
        renderQueue();
        toast(`Queued ${ordered.length} tracks from "${albumMeta.title}"`);
    }

    function openTrackZenithMenu(track) {
        if (!track) return;
        sheetTrack = track; // remember for share/remove actions

        // Build context-aware action list
        const actions = [
            {
                label: 'Play Next',
                description: 'Insert this track right after the current one.',
                icon: 'next',
                onSelect: () => queueTrackNextSmart(track)
            },
            {
                label: 'Add to Queue',
                description: 'Append this song to the current queue.',
                icon: 'queue',
                onSelect: () => addTrackToQueueSmart(track)
            },
            {
                label: 'Open Album',
                description: track.albumTitle || 'Jump to source album.',
                icon: 'album',
                onSelect: () => routeToAlbumDetail(track.albumTitle, track.artist)
            },
            {
                label: 'Open Artist',
                description: `Go to ${track.artist}.`,
                icon: 'artist',
                onSelect: () => routeToArtistProfile(track.artist)
            },
            {
                label: 'Edit Info',
                description: 'Fix title, artist, album artist, year, genre.',
                icon: 'manage',
                onSelect: () => {
                    if (typeof openTrackMetadataEditor === 'function') openTrackMetadataEditor(track);
                }
            },
            {
                label: 'Share',
                description: 'Copy track info or share via system sheet.',
                icon: 'share',
                onSelect: () => shareTrackAction(track)
            }
        ];

        // Show "Remove from Playlist" only when inside a user playlist
        if (activePlaylistId) {
            const pl = userPlaylists.find(p => p.id === activePlaylistId);
            if (pl) {
                const trackIdx = pl.tracks.findIndex(t => t.title === track.title && t.artist === track.artist);
                if (trackIdx >= 0) {
                    actions.push({
                        label: `Remove from "${pl.name}"`,
                        description: 'Remove this track from the current playlist.',
                        icon: 'trash',
                        danger: true,
                        onSelect: () => {
                            showConfirm(
                                `Remove from "${pl.name}"?`,
                                `"${track.title}" will be removed from this playlist.`,
                                'Remove',
                                () => { removeTrackFromUserPlaylist(activePlaylistId, trackIdx); setLibraryRenderDirty(true); renderLibraryViews({ force: true }); }
                            );
                        }
                    });
                }
            }
        }

        showZenithActionSheet(
            track.title,
            `${track.artist} - ${track.albumTitle} - ${track.duration || '--:--'}`,
            actions
        );
    }

    // Share a track via Web Share API or clipboard fallback
    function shareTrackAction(track) {
        if (!track) return;
        const parts = [track.title, track.artist, track.albumTitle].filter(Boolean);
        const text = parts.join(' \u00b7 ');
        if (navigator.share) {
            navigator.share({ title: track.title, text }).catch(() => {});
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                toast('Track info copied to clipboard');
            }).catch(() => {
                toast('Could not copy \u2014 share unavailable');
            });
            return;
        }
        toast('Share not available on this device');
    }

    function openArtistZenithMenu(artistName) {
        const name = artistName || ARTIST_NAME;
        const topTrack = getTopTrackForArtist(name);
        const summary = getArtistSummary(name);

        showZenithActionSheet(
            name,
            `${summary.trackCount} tracks - ${summary.albumCount} albums`,
            [
                {
                    label: 'Open Artist',
                    description: 'View artist profile and top tracks.',
                    icon: 'open',
                    onSelect: () => routeToArtistProfile(name)
                },
                {
                    label: topTrack ? `Play "${topTrack.title}"` : 'Play Artist',
                    description: topTrack ? 'Start with the most-played track.' : 'Play unavailable (no tracks).',
                    icon: 'music',
                    onSelect: () => {
                        if (!topTrack) return;
                        playTrack(topTrack.title, topTrack.artist, topTrack.albumTitle);
                    }
                },
                {
                    label: topTrack ? 'Queue Top Track' : 'Queue Artist',
                    description: topTrack ? 'Add the top track to your queue.' : 'No tracks available to queue.',
                    icon: 'queue',
                    onSelect: () => {
                        if (!topTrack) return;
                        addTrackToQueueSmart(topTrack);
                    }
                },
            ]
        );
    }

    function openAlbumZenithMenu(albumMeta) {
        if (!albumMeta) return;
        const totalDuration = toLibraryDurationTotal(albumMeta.tracks || []);
        const displayArtist = albumMeta.artist || ARTIST_NAME;
        const artistStats = getArtistSummary(displayArtist);
        showZenithActionSheet(
            albumMeta.title,
            `${displayArtist} - ${albumMeta.year || 'Unknown Year'} - ${albumMeta.trackCount || 0} tracks - ${totalDuration}`,
            [
                {
                    label: 'Play Album',
                    description: 'Start from track 1 in album order.',
                    icon: 'music',
                    onSelect: () => playAlbumInOrder(albumMeta.title, 0, albumMeta.artist)
                },
                {
                    label: 'Open Artist',
                    description: `${artistStats.trackCount} tracks - ${artistStats.albumCount} albums`,
                    icon: 'artist',
                    onSelect: () => routeToArtistProfile(displayArtist)
                },
                {
                    label: 'Queue Album',
                    description: `Append all ${albumMeta.trackCount || 0} tracks to queue.`,
                    icon: 'queue',
                    onSelect: () => addAlbumToQueueSmart(albumMeta)
                },
                {
                    label: 'Edit Album Info',
                    description: 'Fix album artist, year, genre for all tracks.',
                    icon: 'manage',
                    onSelect: () => {
                        if (typeof openAlbumMetadataEditor === 'function') openAlbumMetadataEditor(albumMeta);
                    }
                }
            ]
        );
    }

    function wireAlbumDetailHeaderInteractions(albumMeta) {
        const artEl = getEl('alb-art');
        const titleEl = getEl('alb-title');
        const artistEl = getEl('alb-artist');
        const metaEl = getEl('alb-meta');

        if (artEl) {
            artEl.tabIndex = 0;
            artEl.setAttribute('role', 'button');
            artEl.setAttribute('aria-label', `Open artwork for ${albumMeta.title}`);
            artEl.onclick = () => openAlbumArtViewer(albumMeta);
            artEl.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openAlbumArtViewer(albumMeta);
                }
            };
            bindLongPressAction(artEl, () => openAlbumZenithMenu(albumMeta));
        }

        if (titleEl) {
            titleEl.tabIndex = 0;
            titleEl.setAttribute('role', 'button');
            titleEl.onclick = () => playAlbumInOrder(albumMeta.title, 0, albumMeta.artist);
            titleEl.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    playAlbumInOrder(albumMeta.title, 0, albumMeta.artist);
                }
            };
            bindLongPressAction(titleEl, () => openAlbumZenithMenu(albumMeta));
        }

        if (artistEl) {
            artistEl.tabIndex = 0;
            artistEl.setAttribute('role', 'button');
            artistEl.onclick = () => routeToArtistProfile(albumMeta.artist);
            artistEl.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    routeToArtistProfile(albumMeta.artist);
                }
            };
            bindLongPressAction(artistEl, () => openArtistZenithMenu(albumMeta.artist));
        }

        if (metaEl) {
            metaEl.tabIndex = 0;
            metaEl.setAttribute('role', 'button');
            metaEl.onclick = () => openAlbumZenithMenu(albumMeta);
            metaEl.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openAlbumZenithMenu(albumMeta);
                }
            };
            bindLongPressAction(metaEl, () => openAlbumZenithMenu(albumMeta));
        }
    }

    function renderAlbumProgressNotches(albumMeta) {
        const notchesEl = getEl('alb-progress-notches');
        if (!notchesEl) return;
        notchesEl.innerHTML = '';

        const tracks = Array.isArray(albumMeta?.tracks) ? albumMeta.tracks : [];
        if (!tracks.length) return;
        const total = Math.max(1, getAlbumTotalDurationSeconds(albumMeta));
        let elapsed = 0;

        tracks.forEach((track, idx) => {
            const notch = document.createElement('span');
            notch.className = 'album-progress-notch';
            const ratio = Math.max(0, Math.min(1, elapsed / total));
            notch.style.left = `${ratio * 100}%`;
            notch.title = `${idx + 1}. ${track.title}`;
            notch.dataset.trackIndex = String(idx);
            notchesEl.appendChild(notch);
            elapsed += Math.max(1, getTrackDurationSeconds(track));
        });
    }

    function seekAlbumProgress(ratio) {
        const albumMeta = resolveAlbumMeta(activeAlbumTitle, activeAlbumArtist);
        if (!albumMeta || !Array.isArray(albumMeta.tracks) || !albumMeta.tracks.length) return;
        const total = getAlbumTotalDurationSeconds(albumMeta);
        if (total <= 0) return;

        const clamped = Math.max(0, Math.min(1, ratio));
        const targetSeconds = clamped * total;
        let elapsed = 0;
        let targetIndex = 0;
        let offset = 0;

        for (let i = 0; i < albumMeta.tracks.length; i += 1) {
            const segment = Math.max(1, getTrackDurationSeconds(albumMeta.tracks[i]));
            if (targetSeconds <= elapsed + segment || i === albumMeta.tracks.length - 1) {
                targetIndex = i;
                offset = Math.max(0, targetSeconds - elapsed);
                break;
            }
            elapsed += segment;
        }

        playAlbumInOrder(albumMeta.title, targetIndex, albumMeta.artist);
        const engine = ensureAudioEngine();
        const applyOffset = () => {
            const localEngine = ensureAudioEngine();
            if (!localEngine) return;
            const fallbackDuration = getTrackDurationSeconds(albumMeta.tracks[targetIndex]);
            const maxDuration = Number.isFinite(localEngine.duration) && localEngine.duration > 0
                ? localEngine.duration
                : fallbackDuration;
            if (maxDuration > 0) {
                localEngine.currentTime = Math.max(0, Math.min(offset, Math.max(0, maxDuration - 0.1)));
                updateProgressUI(localEngine.currentTime, maxDuration);
            }
        };
        if (engine) {
            const onLoaded = () => {
                applyOffset();
                engine.removeEventListener('loadedmetadata', onLoaded);
            };
            engine.addEventListener('loadedmetadata', onLoaded);
        }
        setTimeout(applyOffset, 120);
    }

    function ensureAlbumProgressBinding() {
        const trackEl = getEl('alb-progress-track');
        if (!trackEl || trackEl.dataset.bound === '1') return;
        trackEl.dataset.bound = '1';
        trackEl.addEventListener('click', (event) => {
            const rect = trackEl.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
            seekAlbumProgress(ratio);
        });
    }

    function updateAlbumProgressLine(currentSeconds = 0, durationSeconds = 0) {
        const shell = getEl('alb-progress-shell');
        const fillEl = getEl('alb-progress-fill');
        const notchesEl = getEl('alb-progress-notches');
        if (!shell || !fillEl || !notchesEl) return;

        const albumMeta = resolveAlbumMeta(activeAlbumTitle, activeAlbumArtist);
        if (!albumMeta || !Array.isArray(albumMeta.tracks) || !albumMeta.tracks.length) {
            shell.style.display = 'none';
            fillEl.style.width = '0%';
            notchesEl.innerHTML = '';
            return;
        }

        shell.style.display = 'block';
        const albumKeyValue = getAlbumIdentityKey(albumMeta, albumMeta.artist);
        if (notchesEl.dataset.albumKey !== albumKeyValue) {
            renderAlbumProgressNotches(albumMeta);
            notchesEl.dataset.albumKey = albumKeyValue;
        }

        const total = getAlbumTotalDurationSeconds(albumMeta);
        if (total <= 0) {
            fillEl.style.width = '0%';
            return;
        }

        const currentKey = nowPlaying ? trackKey(nowPlaying.title, nowPlaying.artist) : '';
        const currentTrackIndex = albumMeta.tracks.findIndex(track => trackKey(track.title, track.artist) === currentKey);
        let elapsedBefore = 0;
        for (let i = 0; i < Math.max(0, currentTrackIndex); i += 1) {
            elapsedBefore += getTrackDurationSeconds(albumMeta.tracks[i]);
        }

        const segmentDuration = currentTrackIndex >= 0
            ? Math.max(1, getTrackDurationSeconds(albumMeta.tracks[currentTrackIndex]) || Number(durationSeconds || 0))
            : 0;
        const inTrack = currentTrackIndex >= 0
            ? Math.max(0, Math.min(segmentDuration, Number(currentSeconds || 0)))
            : 0;
        const elapsedAlbum = currentTrackIndex >= 0
            ? Math.max(0, Math.min(total, elapsedBefore + inTrack))
            : 0;
        const remainingAlbum = Math.max(0, total - elapsedAlbum);
        const ratio = currentTrackIndex >= 0
            ? Math.max(0, Math.min(1, elapsedAlbum / total))
            : 0;
        fillEl.style.width = `${ratio * 100}%`;

        Array.from(notchesEl.children).forEach((notch, idx) => {
            notch.classList.toggle('passed', currentTrackIndex >= 0 && idx < currentTrackIndex);
            notch.classList.toggle('current', currentTrackIndex >= 0 && idx === currentTrackIndex);
        });

        // Zenith specific: album-level elapsed/remaining with current track context
        const elapsedEl = document.getElementById('alb-progress-elapsed');
        const remainEl = document.getElementById('alb-progress-remaining');
        const currentTrackEl = document.getElementById('alb-progress-current-track');
        if (elapsedEl && remainEl && currentTrackEl) {
            elapsedEl.textContent = toDurationLabel(elapsedAlbum);
            remainEl.textContent = `-${toDurationLabel(remainingAlbum)}`;
            if (currentTrackIndex >= 0) {
                const track = albumMeta.tracks[currentTrackIndex];
                currentTrackEl.textContent = `${track.no || currentTrackIndex + 1}. ${track.title}`;
            } else {
                currentTrackEl.textContent = '';
            }
        }
    }

    function openInferredLongPressMenu(title, sub) {
        const label = String(title || '').trim();
        const subtitle = String(sub || '').trim();
        if (!label) return false;

        const artistHint = subtitle.split('-')[0].trim();
        const trackFromKey = artistHint ? trackByKey.get(trackKey(label, artistHint)) : null;
        if (trackFromKey) {
            openTrackZenithMenu(trackFromKey);
            return true;
        }

        const albumMeta = resolveAlbumMeta(label, artistHint);
        if (albumMeta) {
            openAlbumZenithMenu(albumMeta);
            return true;
        }

        const maybeTrack = LIBRARY_TRACKS.find(track => track.title === label && (!artistHint || toArtistKey(track.artist) === toArtistKey(artistHint)));
        if (maybeTrack) {
            openTrackZenithMenu(maybeTrack);
            return true;
        }

        const maybeArtist = artistByKey.get(toArtistKey(label))
            || artistByKey.get(toArtistKey(artistHint))
            || LIBRARY_ARTISTS.find(artist => toArtistKey(artist.name) === toArtistKey(label));
        if (maybeArtist) {
            openArtistZenithMenu(maybeArtist.name || label);
            return true;
        }

        return false;
    }

    function toSafeId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function toArtistKey(name) {
        return String(name || '').trim().toLowerCase();
    }

    function toPlaylistId(raw) {
        return `pl-${albumKey(raw)}`;
    }

    function getSectionCatalog() {
        return [
            // ── Core (defaults) ──
            { type: 'recent_activity', title: 'Recent Activity', itemType: 'songs', layout: 'list', density: 'compact', limit: 6, core: true },
            { type: 'recently_added', title: 'Recently Added', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8, core: true },
            // ── Most Played ──
            { type: 'most_played_songs', title: 'Most Played Songs', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'most_played_artists', title: 'Most Played Artists', itemType: 'artists', layout: 'carousel', density: 'large', limit: 8 },
            { type: 'most_played_albums', title: 'Most Played Albums', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8 },
            // ── Jump Back In (in-progress albums) ──
            { type: 'jump_back_in', title: 'Jump Back In', itemType: 'albums', layout: 'carousel', density: 'large', limit: 6 },
            // ── Forgotten / rediscover ──
            { type: 'forgotten_songs', title: 'Forgotten Songs', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'forgotten_albums', title: 'Forgotten Albums', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8 },
            // ── Playlists ──
            { type: 'playlist_spotlight', title: 'Playlist Spotlight', itemType: 'playlists', layout: 'carousel', density: 'large', limit: 6 },
            // ── Never Played ──
            { type: 'never_played_songs', title: 'Never Played', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'never_played_albums', title: 'Unplayed Albums', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8 },
            // ── Liked / Ratings ──
            { type: 'liked_songs', title: 'Liked Songs', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'top_rated', title: 'Top Rated', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            // ── Shuffle Mix ──
            { type: 'shuffle_mix', title: 'Shuffle Mix', itemType: 'songs', layout: 'carousel', density: 'large', limit: 8 },
            // ── In Progress Albums ──
            { type: 'in_progress_albums', title: 'In Progress', itemType: 'albums', layout: 'carousel', density: 'large', limit: 6 }
        ];
    }

    function getDefaultHomeSections() {
        return getSectionCatalog().filter(s => s.core).map(s => ({
            id: toSafeId(s.type),
            type: s.type,
            title: s.title,
            itemType: s.itemType,
            layout: s.layout,
            density: s.density,
            limit: s.limit,
            enabled: true,
            core: Boolean(s.core)
        }));
    }

    function resolveArtUrlForContext(artUrl) {
        const raw = String(artUrl || '').trim();
        if (!raw) return '';
        const isHttpCtx = location.protocol === 'http:' || location.protocol === 'https:';
        if (isHttpCtx && /^file:\/\//i.test(raw)) return '';
        return raw;
    }

    function resolveMediaSourceForContext(fileUrl) {
        const raw = String(fileUrl || '').trim();
        if (!raw) return '';
        const isHttpCtx = location.protocol === 'http:' || location.protocol === 'https:';
        if (isHttpCtx && /^file:\/\//i.test(raw)) return '';
        return raw;
    }

    // Resolve a playable URL for a track: try blob cache â†’ handle key â†’ file handle lookup â†’ raw URL
    async function resolvePlayableUrl(track) {
        const key = trackKey(track.title, track.artist);
        if (DEBUG) console.log('[Auralis] resolvePlayableUrl:', track.title, '| _handleKey:', track._handleKey, '| handleCacheSize:', fileHandleCache.size);

        // 1. Check blob URL cache
        if (blobUrlCache.has(key)) return trackPlaybackBlobUrl(blobUrlCache.get(key));

        // 2. Direct handle key (scanned tracks have this)
        if (track._handleKey && fileHandleCache.has(track._handleKey)) {
            try {
                const handle = fileHandleCache.get(track._handleKey);
                // Fallback shim from <input webkitdirectory>
                if (handle && handle._blobUrl) {
                    blobUrlCache.set(key, handle._blobUrl);
                    return trackPlaybackBlobUrl(handle._blobUrl);
                }
                const file = await handle.getFile();
                const blobUrl = URL.createObjectURL(file);
                blobUrlCache.set(key, blobUrl);
                return trackPlaybackBlobUrl(blobUrl);
            } catch (e) {
                console.warn('Could not read file handle for', track._handleKey, e);
            }
        }

        // 3. Check if raw fileUrl works directly (non file:// in HTTP context)
        const direct = resolveMediaSourceForContext(track.fileUrl);
        if (direct) return direct;

        // 4. Try to find a matching file handle from scanned folders by filename
        const filename = extractFilename(track);
        if (filename && fileHandleCache.has(filename)) {
            try {
                const handle = fileHandleCache.get(filename);
                // Fallback shim from <input webkitdirectory>
                if (handle && handle._blobUrl) {
                    blobUrlCache.set(key, handle._blobUrl);
                    return trackPlaybackBlobUrl(handle._blobUrl);
                }
                const file = await handle.getFile();
                const blobUrl = URL.createObjectURL(file);
                blobUrlCache.set(key, blobUrl);
                return trackPlaybackBlobUrl(blobUrl);
            } catch (e) {
                console.warn('Could not read file handle for', filename, e);
            }
        }

        // 5. Fuzzy match: try matching by title keywords in filename
        if (track.title) {
            const titleNorm = track.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const [fname, handle] of fileHandleCache) {
                const fnameNorm = fname.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (fnameNorm.includes(titleNorm) || titleNorm.includes(fnameNorm)) {
                    try {
                        // Fallback shim
                        if (handle && handle._blobUrl) {
                            blobUrlCache.set(key, handle._blobUrl);
                            return trackPlaybackBlobUrl(handle._blobUrl);
                        }
                        const file = await handle.getFile();
                        const blobUrl = URL.createObjectURL(file);
                        blobUrlCache.set(key, blobUrl);
                        fileHandleCache.set(filename || fname, handle);
                        return trackPlaybackBlobUrl(blobUrl);
                    } catch (_) {}
                }
            }
        }

        return '';
    }

    // Extract a normalized filename from a track's path or fileUrl
    function extractFilename(track) {
        const src = track.path || track.fileUrl || '';
        if (!src) return '';
        try {
            // Handle file:// URLs
            const decoded = decodeURIComponent(src.replace(/^file:\/\/\//i, ''));
            const parts = decoded.replace(/\\/g, '/').split('/');
            return parts[parts.length - 1].toLowerCase();
        } catch (_) {
            return '';
        }
    }

    // Count how many indexed files currently have a matching file handle.
    function countPlayableLibraryTracks() {
        if (!Array.isArray(scannedFiles) || scannedFiles.length === 0 || fileHandleCache.size === 0) return 0;
        let count = 0;
        for (const file of scannedFiles) {
            const handleKey = getScannedFileHandleKey(file);
            const fname = String(file?.name || '').trim().toLowerCase();
            if ((handleKey && fileHandleCache.has(handleKey)) || (fname && fileHandleCache.has(fname))) count++;
        }
        return count;
    }

    function getPlaybackHealthStatus() {
        const scannedTrackCount = Array.isArray(scannedFiles) ? scannedFiles.length : 0;
        const playableTrackCount = countPlayableLibraryTracks();
        const needsRescan = scannedTrackCount > 0 && playableTrackCount === 0;
        const partiallyPlayable = scannedTrackCount > 0 && playableTrackCount > 0 && playableTrackCount < scannedTrackCount;
        const warningMessage = needsRescan
            ? 'Cached tracks are currently hidden because file access is stale. Open Settings and tap Rescan Library.'
            : (partiallyPlayable
                ? `Only ${playableTrackCount} of ${scannedTrackCount} indexed tracks are currently playable. Rescan Library to refresh handles.`
                : '');
        return {
            scannedTrackCount,
            playableTrackCount,
            needsRescan,
            partiallyPlayable,
            warningMessage
        };
    }

    function updatePlaybackHealthWarnings() {
        const status = getPlaybackHealthStatus();
        const showWarning = Boolean(status.warningMessage);

        const settingsWarning = getEl('settings-playback-warning');
        const settingsWarningText = getEl('settings-playback-warning-text');
        if (settingsWarning) settingsWarning.style.display = showWarning ? 'flex' : 'none';
        if (settingsWarningText && showWarning) settingsWarningText.textContent = status.warningMessage;

        const homeWarning = getEl('home-playback-warning');
        const homeWarningText = getEl('home-playback-warning-text');
        if (homeWarning) homeWarning.style.display = showWarning ? 'flex' : 'none';
        if (homeWarningText && showWarning) homeWarningText.textContent = status.warningMessage;
    }


