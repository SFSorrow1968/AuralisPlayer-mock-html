/*
 * Auralis JS shard: 00-shell-state-helpers.js
 * Purpose: IIFE shell, app state, shared helpers, action sheets, album progress, playable URL resolution
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
// ═══════════════════════════════════════════════════════════════════
// auralis-core.js — Unified AuralisPlayer Runtime
// Merged from inline script + zenith_overrides.js into single module
// Architecture: IIFE with delegated event system, zero inline handlers
// ═══════════════════════════════════════════════════════════════════
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
    const METADATA_STATUS = Object.freeze({
        pending: 'pending',
        ready: 'ready',
        failed: 'failed',
        stale: 'stale'
    });
    const METADATA_QUALITY = Object.freeze({
        embedded: 'embedded',
        partial: 'partial',
        guessed: 'guessed',
        unknown: 'unknown'
    });
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
        durationCache: 'auralis_duration_cache_v1',
        durationProbeFailures: 'auralis_duration_probe_failures_v1',
        artistProfileLayout: 'auralis_artist_profile_layout_v1',
        uiPreferences: 'auralis_ui_preferences_v1',
        darkTheme: 'auralis_dark_theme',
        hqAudio: 'auralis_hq_audio'
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
    const albumBySourceId = new Map();
    const trackByKey = new Map();
    const trackByStableId = new Map();
    const trackLegacyKeyCounts = new Map();
    const artistByKey = new Map();
    const playlistById = new Map();
    let queueTracks = [];
    let nowPlaying = null;
    let queueIndex = 0;
    let repeatMode = 'off'; // 'off' | 'one' | 'two' | 'all'
    let repeatPlayCount = 0; // auto-repeat plays used for current track ('one'/'two' modes)
    let isPlaying = false;
    let isSeeking = false;
    let audioEngine = null;
    let activeAlbumTitle = '';
    let activeAlbumArtist = '';
    let viewedAlbumTitle = '';  // album currently visible in album_detail screen
    let viewedAlbumArtist = '';
    let activePlaylistId = '';
    let activePlaybackCollectionType = '';
    let activePlaybackCollectionKey = '';
    let activeArtistName = '';
    let viewedArtistName = ''; // artist currently shown in artist_profile screen
    let homeSections = [];
    let artistProfileSections = [];
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
    let darkThemeEnabled = safeStorage.getItem(STORAGE_KEYS.darkTheme) !== '0';
    let hqAudioEnabled = safeStorage.getItem(STORAGE_KEYS.hqAudio) !== '0';
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
    const durationProbeFailures = new Map(Object.entries(safeStorage.getJson(STORAGE_KEYS.durationProbeFailures, {})));

    // ── User Playlists ──
    function hydrateUserPlaylist(playlist) {
        if (!playlist) return null;
        return {
            ...playlist,
            tracks: Array.isArray(playlist.tracks)
                ? playlist.tracks.map((track) => hydratePlaybackTrack(track)).filter(Boolean)
                : []
        };
    }

    function normalizeUserPlaylists(playlists) {
        return (Array.isArray(playlists) ? playlists : [])
            .map((playlist) => hydrateUserPlaylist(playlist))
            .filter((playlist) => playlist && String(playlist.id || '').trim());
    }

    function serializeUserPlaylist(playlist) {
        if (!playlist) return null;
        return {
            ...playlist,
            tracks: Array.isArray(playlist.tracks)
                ? playlist.tracks.map((track) => serializeTrackForPlaybackState(track)).filter(Boolean)
                : []
        };
    }

    let userPlaylists = normalizeUserPlaylists(safeStorage.getJson(STORAGE_KEYS.userPlaylists, []));
    // Seed LIBRARY_PLAYLISTS and playlistById from persisted userPlaylists at startup
    if (Array.isArray(userPlaylists) && userPlaylists.length) {
        LIBRARY_PLAYLISTS = userPlaylists.slice();
        userPlaylists.forEach(pl => { if (pl?.id) playlistById.set(pl.id, pl); });
    }

    // Track currently targeted by the action sheet
    let sheetTrack = null;

    const searchFilters = new Set(['all']);
    let searchQuery = '';
    const UI_PREFS_VERSION = 1;
    const UI_PREFERENCE_DEFAULTS = Object.freeze({
        libraryTab: '',
        homeProfile: '',
        searchQuery: '',
        searchFilters: [],
        recentSearches: [],
        mediaSearchHistory: [],
        searchSections: {},
        homeCollapsedSections: [],
        libraryCategoryOrder: [],
        libraryHiddenCategories: [],
        libraryAppearance: {},
        scroll: {}
    });

    function normalizeUiPreferenceList(value, limit = Infinity) {
        if (!Array.isArray(value)) return [];
        return value
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .slice(0, limit);
    }

    function normalizeUiPreferenceObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function normalizeUiPreferences(raw) {
        const source = raw && typeof raw === 'object' && raw.version === UI_PREFS_VERSION ? raw : {};
        return {
            version: UI_PREFS_VERSION,
            libraryTab: String(source.libraryTab || UI_PREFERENCE_DEFAULTS.libraryTab),
            homeProfile: String(source.homeProfile || UI_PREFERENCE_DEFAULTS.homeProfile),
            searchQuery: String(source.searchQuery || UI_PREFERENCE_DEFAULTS.searchQuery),
            searchFilters: normalizeUiPreferenceList(source.searchFilters || UI_PREFERENCE_DEFAULTS.searchFilters),
            recentSearches: normalizeUiPreferenceList(source.recentSearches || UI_PREFERENCE_DEFAULTS.recentSearches, 5),
            mediaSearchHistory: normalizeUiPreferenceList(source.mediaSearchHistory || UI_PREFERENCE_DEFAULTS.mediaSearchHistory, 12),
            searchSections: normalizeUiPreferenceObject(source.searchSections || UI_PREFERENCE_DEFAULTS.searchSections),
            homeCollapsedSections: normalizeUiPreferenceList(source.homeCollapsedSections || UI_PREFERENCE_DEFAULTS.homeCollapsedSections),
            libraryCategoryOrder: normalizeUiPreferenceList(source.libraryCategoryOrder || UI_PREFERENCE_DEFAULTS.libraryCategoryOrder),
            libraryHiddenCategories: normalizeUiPreferenceList(source.libraryHiddenCategories || UI_PREFERENCE_DEFAULTS.libraryHiddenCategories),
            libraryAppearance: normalizeUiPreferenceObject(source.libraryAppearance || UI_PREFERENCE_DEFAULTS.libraryAppearance),
            scroll: normalizeUiPreferenceObject(source.scroll || UI_PREFERENCE_DEFAULTS.scroll)
        };
    }
    let uiPreferences = normalizeUiPreferences(safeStorage.getJson(STORAGE_KEYS.uiPreferences, {}));

    function persistUiPreferences() {
        uiPreferences = normalizeUiPreferences(uiPreferences);
        safeStorage.setJson(STORAGE_KEYS.uiPreferences, uiPreferences);
    }

    function setUiPreference(key, value) {
        if (!key) return;
        uiPreferences[key] = value;
        persistUiPreferences();
    }

    function getUiPreference(key, fallback = '') {
        return uiPreferences && Object.prototype.hasOwnProperty.call(uiPreferences, key)
            ? uiPreferences[key]
            : fallback;
    }

    function getRecentSearches() {
        const searches = getUiPreference('recentSearches', []);
        return Array.isArray(searches)
            ? searches.map(value => String(value || '').trim()).filter(Boolean).slice(0, 5)
            : [];
    }

    function rememberRecentSearch(query) {
        const value = String(query || '').trim();
        if (!value) return;
        const normalized = value.toLowerCase();
        const next = [value]
            .concat(getRecentSearches().filter(item => item.toLowerCase() !== normalized))
            .slice(0, 5);
        setUiPreference('recentSearches', next);
    }

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
        btn.setAttribute('aria-pressed', shouldShowPause ? 'true' : 'false');
        btn.title = label;
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

    function getAlbumSourceIdentity(albumLike) {
        if (!albumLike) return '';
        if (albumLike._sourceAlbumId) return String(albumLike._sourceAlbumId);
        if (albumLike._scanned && albumLike.id) return String(albumLike.id);
        return '';
    }

    function getAlbumMergeIdentityKey(albumLike, fallbackArtist = '') {
        const sourceId = getAlbumSourceIdentity(albumLike);
        if (sourceId) return `source:${sourceId.trim().toLowerCase()}`;
        return getAlbumIdentityKey(albumLike, fallbackArtist);
    }

    function getTrackSourceAlbumIdentity(track, fallbackAlbum = null) {
        if (!track) return getAlbumSourceIdentity(fallbackAlbum);
        if (track._sourceAlbumId) return String(track._sourceAlbumId);
        const handleKey = String(track._handleKey || '').trim();
        if (handleKey) {
            const parts = handleKey.split('::');
            if (parts.length >= 3) {
                const folderId = parts[0];
                const subDir = normalizeRelativeDir(parts.slice(1, -1).join('::'));
                if (folderId) return `_scanned_${subDir ? `${folderId}::${subDir}` : folderId}`;
            }
        }
        const path = normalizeRelativeDir(track.path || '');
        if (path && path.includes('/')) return `path:${path.split('/').slice(0, -1).join('/')}`;
        return getAlbumSourceIdentity(fallbackAlbum);
    }

    function getTrackSourceAlbumTitle(track, fallbackTitle = '') {
        if (track?._sourceAlbumTitle) return String(track._sourceAlbumTitle);
        const path = normalizeRelativeDir(track?.path || '');
        if (path && path.includes('/')) {
            const parts = path.split('/').filter(Boolean);
            if (parts.length > 1) return parts[parts.length - 2];
        }
        const handleKey = String(track?._handleKey || '').trim();
        if (handleKey) {
            const parts = handleKey.split('::');
            const subDir = normalizeRelativeDir(parts.length >= 3 ? parts.slice(1, -1).join('::') : '');
            if (subDir) {
                const subParts = subDir.split('/').filter(Boolean);
                return subParts[subParts.length - 1] || fallbackTitle;
            }
        }
        return fallbackTitle;
    }

    function normalizeAlbumComparisonTitle(value) {
        return albumKey(value).replace(/[!?.,;:\s]+$/, '');
    }

    function isGenericAlbumSourceTitle(value) {
        const key = normalizeAlbumComparisonTitle(value);
        if (!key) return true;
        if (['music', 'songs', 'audio', 'downloads', 'selected folder', 'unknown album'].includes(key)) return true;
        return /^(disc|disk|cd|side)\s*\d+$/i.test(key);
    }

    function shouldPreferEmbeddedAlbumTitle(albumLike, candidateTitle) {
        const candidateKey = normalizeAlbumComparisonTitle(candidateTitle);
        if (!candidateKey || candidateKey === 'unknown album') return false;
        // Use album-specific generic check (not isLikelyPlaceholderArtist which
        // would incorrectly reject album titles that happen to match folder names).
        if (isGenericAlbumSourceTitle(candidateTitle)) return false;
        return true;
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

    function getTrackIdentityKey(track) {
        if (!track) return '';
        return getStableTrackIdentity(track) || trackKey(track.title, track.artist);
    }

    function getTrackIdentityKeys(track) {
        if (!track) return [];
        const primary = getTrackIdentityKey(track);
        const legacy = trackKey(track.title, track.artist);
        return Array.from(new Set([primary, legacy].filter(Boolean)));
    }

    function getTrackLegacyKeyMatchCount(track) {
        if (!track) return 0;
        const legacy = trackKey(track.title, track.artist);
        return Number(trackLegacyKeyCounts.get(legacy) || 0);
    }

    function canUseLegacyTrackKey(track) {
        if (!track) return false;
        const stable = String(getStableTrackIdentity(track) || '').trim();
        if (!stable) return true;
        return getTrackLegacyKeyMatchCount(track) <= 1;
    }

    function isSameTrack(a, b) {
        if (!a || !b) return false;
        const aStable = String(getStableTrackIdentity(a) || '').trim();
        const bStable = String(getStableTrackIdentity(b) || '').trim();
        if (aStable && bStable) return aStable === bStable;
        const aPrimary = getTrackIdentityKey(a);
        const bPrimary = getTrackIdentityKey(b);
        if (aPrimary && bPrimary) return aPrimary === bPrimary;
        return trackKey(a.title, a.artist) === trackKey(b.title, b.artist);
    }

    function getTrackMapValue(map, track) {
        if (!map || !track) return undefined;
        const primary = getTrackIdentityKey(track);
        if (primary && map.has(primary)) return map.get(primary);
        const legacy = trackKey(track.title, track.artist);
        if (legacy && canUseLegacyTrackKey(track) && map.has(legacy)) return map.get(legacy);
        return undefined;
    }

    function setTrackMapValue(map, track, value) {
        if (!map || !track) return '';
        const [primary, ...aliases] = getTrackIdentityKeys(track);
        if (!primary) return '';
        map.set(primary, value);
        aliases.forEach((key) => {
            if (key !== primary) map.delete(key);
        });
        return primary;
    }

    function deleteTrackMapValue(map, track) {
        if (!map || !track) return;
        getTrackIdentityKeys(track).forEach((key) => map.delete(key));
    }

    function hasTrackSetValue(set, track) {
        if (!set || !track) return false;
        const primary = getTrackIdentityKey(track);
        if (primary && set.has(primary)) return true;
        const legacy = trackKey(track.title, track.artist);
        return Boolean(legacy && canUseLegacyTrackKey(track) && set.has(legacy));
    }

    function addTrackSetValue(set, track) {
        if (!set || !track) return '';
        const [primary, ...aliases] = getTrackIdentityKeys(track);
        if (!primary) return '';
        set.add(primary);
        aliases.forEach((key) => {
            if (key !== primary) set.delete(key);
        });
        return primary;
    }

    function deleteTrackSetValue(set, track) {
        if (!set || !track) return;
        getTrackIdentityKeys(track).forEach((key) => set.delete(key));
    }

    function getTrackLookupKeys({ trackId = '', title = '', artist = '' } = {}) {
        const keys = [];
        const stable = String(trackId || '').trim();
        const legacy = trackKey(title, artist);
        if (stable) keys.push(stable);
        if (legacy && !keys.includes(legacy)) keys.push(legacy);
        return keys;
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
        return false;
    }

    function setTrackMetadataQuality(track, quality, source = '') {
        if (!track) return;
        const nextQuality = Object.prototype.hasOwnProperty.call(METADATA_QUALITY, quality)
            ? quality
            : METADATA_QUALITY.unknown;
        track._metadataQuality = nextQuality;
        track._metadataSource = source || track._metadataSource || nextQuality;
    }

    function getTrackMetadataQuality(track) {
        if (!track) return METADATA_QUALITY.unknown;
        if (track._metadataQuality === METADATA_QUALITY.guessed || track._metadataSource === 'filename_guess') {
            return METADATA_QUALITY.guessed;
        }
        const hasTrustedSource = track._metadataQuality === 'trusted' || track._metadataSource === 'fixture';
        const hasEmbeddedSource = hasTrustedSource || track._metadataQuality === METADATA_QUALITY.embedded || track._metadataSource === 'embedded_tags';
        const missingCoreTags = !String(track.title || '').trim()
            || isMissingMetadata(track.artist, 'artist')
            || isMissingMetadata(track.albumTitle, 'album');
        if (track._metaDone && missingCoreTags) return METADATA_QUALITY.partial;
        if (hasEmbeddedSource || track._metaDone) return METADATA_QUALITY.embedded;
        if (track._scanned) return METADATA_QUALITY.guessed;
        return METADATA_QUALITY.unknown;
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
        const totalSec = tracks.reduce((sum, t) => sum + getTrackDurationSeconds(t), 0);
        if (!totalSec) return '--';
        const hours = Math.floor(totalSec / 3600);
        const minutes = Math.max(1, Math.floor((totalSec % 3600) / 60));
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    function toDurationSeconds(label) {
        const match = String(label || '').trim().match(/^(\d+):(\d{2})$/);
        if (!match) return 0;
        return (Number(match[1]) * 60) + Number(match[2]);
    }

    function parseLibraryDurationLabel(label) {
        const text = String(label || '').trim().toLowerCase();
        if (!text) return 0;
        const trackSeconds = toDurationSeconds(text);
        if (trackSeconds > 0) return trackSeconds;
        const match = text.match(/^(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/i);
        if (!match) return 0;
        const hours = Number(match[1] || 0);
        const minutes = Number(match[2] || 0);
        const total = (hours * 3600) + (minutes * 60);
        return Number.isFinite(total) && total > 0 ? total : 0;
    }

    function normalizeIdentityPart(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getLegacyTrackDurationCacheKey(track) {
        if (!track) return '';
        return String(
            track._handleKey
            || track.path
            || [track.albumTitle || '', track.title || '', track.artist || ''].join('::')
        ).trim().toLowerCase();
    }

    function getStableTrackIdentity(track) {
        if (!track) return '';
        if (track._trackId) return String(track._trackId);
        const handleKey = normalizeIdentityPart(track._handleKey);
        if (handleKey) return `handle:${handleKey}`;
        const path = normalizeIdentityPart(track.path);
        const size = Number(track._fileSize || track.size || track.sizeBytes || 0);
        const modified = Number(track._lastModified || track.lastModified || track.mtimeMs || 0);
        const ext = normalizeIdentityPart(track.ext);
        if (path) return `file:${[path, ext, size || '', modified || ''].join(':')}`;
        const fallback = [
            normalizeIdentityPart(track.albumTitle),
            normalizeIdentityPart(track.title),
            normalizeIdentityPart(track.artist),
            ext
        ].filter(Boolean).join('::');
        return fallback ? `tag:${fallback}` : '';
    }

    function getTrackDurationCacheKey(track) {
        return getStableTrackIdentity(track) || getLegacyTrackDurationCacheKey(track);
    }

    function getTrackPlaybackCacheKey(track) {
        if (!track) return '';
        return getStableTrackIdentity(track) || [
            normalizeIdentityPart(track.albumTitle),
            normalizeIdentityPart(track.title),
            normalizeIdentityPart(track.artist)
        ].filter(Boolean).join('::');
    }

    function getPersistableTrackArtUrl(track) {
        const resolvedUrl = resolveArtUrlForContext(track?.artUrl || '');
        if (!resolvedUrl || /^blob:/i.test(resolvedUrl)) return '';
        return resolvedUrl;
    }

    function getPersistableTrackFileUrl(track) {
        const resolvedUrl = resolveMediaSourceForContext(track?.fileUrl || '', track);
        if (!resolvedUrl || /^blob:/i.test(resolvedUrl)) return '';
        return resolvedUrl;
    }

    function serializeTrackForPlaybackState(track) {
        if (!track) return null;
        const trackNo = Number(track.no || track.trackNo || 0);
        const discNo = Number(track.discNo || 1) || 1;
        const stableId = getStableTrackIdentity(track);
        return {
            title: track.title || 'Unknown Track',
            artist: track.artist || ARTIST_NAME,
            albumTitle: track.albumTitle || '',
            albumArtist: track.albumArtist || '',
            year: String(track.year || '').trim(),
            genre: String(track.genre || '').trim(),
            duration: track.duration || '',
            durationSec: Number(track.durationSec || 0),
            ext: track.ext || '',
            artUrl: getPersistableTrackArtUrl(track),
            fileUrl: getPersistableTrackFileUrl(track),
            path: track.path || '',
            no: trackNo,
            trackNo,
            discNo,
            plays: Number(track.plays || 0),
            addedRank: Number(track.addedRank || 0),
            lastPlayedDays: Number(track.lastPlayedDays || 0),
            lyrics: track.lyrics || '',
            isFavorite: Boolean(track.isFavorite),
            replayGainTrack: Number.isFinite(track.replayGainTrack) ? Number(track.replayGainTrack) : null,
            replayGainAlbum: Number.isFinite(track.replayGainAlbum) ? Number(track.replayGainAlbum) : null,
            _handleKey: track._handleKey || '',
            _trackId: stableId,
            _sourceAlbumId: track._sourceAlbumId || getTrackSourceAlbumIdentity(track),
            _sourceAlbumTitle: track._sourceAlbumTitle || getTrackSourceAlbumTitle(track, track.albumTitle || ''),
            _embeddedAlbumTitle: track._embeddedAlbumTitle || '',
            _fileSize: Number(track._fileSize || track.size || track.sizeBytes || 0),
            _lastModified: Number(track._lastModified || track.lastModified || track.mtimeMs || 0),
            _metadataSource: track._metadataSource || '',
            _metadataQuality: getTrackMetadataQuality(track),
            _scanned: Boolean(track._scanned),
            _metaDone: track._metaDone !== false
        };
    }

    function findTrackInAlbumByPlaybackState(albumMeta, playbackTrack) {
        if (!albumMeta || !Array.isArray(albumMeta.tracks) || !albumMeta.tracks.length || !playbackTrack) return null;
        const stableId = String(playbackTrack._trackId || '').trim();
        if (stableId) {
            const stableMatch = albumMeta.tracks.find((candidate) => getStableTrackIdentity(candidate) === stableId);
            if (stableMatch) return stableMatch;
        }
        const handleKey = String(playbackTrack._handleKey || '').trim();
        if (handleKey) {
            const handleMatch = albumMeta.tracks.find((candidate) => String(candidate?._handleKey || '').trim() === handleKey);
            if (handleMatch) return handleMatch;
        }
        const normalizedPath = normalizeRelativeDir(playbackTrack.path || '');
        if (normalizedPath) {
            const pathMatch = albumMeta.tracks.find((candidate) => normalizeRelativeDir(candidate?.path || '') === normalizedPath);
            if (pathMatch) return pathMatch;
        }
        const normalizedTrackKey = trackKey(playbackTrack.title, playbackTrack.artist);
        const normalizedTrackNo = Number(playbackTrack.no || playbackTrack.trackNo || 0);
        const normalizedDiscNo = Number(playbackTrack.discNo || 1) || 1;
        return albumMeta.tracks.find((candidate) => (
            trackKey(candidate?.title, candidate?.artist) === normalizedTrackKey
            && (normalizedTrackNo <= 0 || Number(candidate?.no || candidate?.trackNo || 0) === normalizedTrackNo)
            && (normalizedDiscNo <= 1 || Number(candidate?.discNo || 1) === normalizedDiscNo)
        )) || null;
    }

    function resolveTrackFromPlaybackState(playbackTrack) {
        if (!playbackTrack) return null;

        const stableId = String(playbackTrack._trackId || '').trim();
        if (stableId && trackByStableId.has(stableId)) {
            const stableMatch = trackByStableId.get(stableId);
            if (stableMatch) return stableMatch;
        }

        const handleKey = String(playbackTrack._handleKey || '').trim();
        if (handleKey) {
            const handleMatch = LIBRARY_TRACKS.find((candidate) => String(candidate?._handleKey || '').trim() === handleKey);
            if (handleMatch) return handleMatch;
        }

        const normalizedPath = normalizeRelativeDir(playbackTrack.path || '');
        if (normalizedPath) {
            const pathMatch = LIBRARY_TRACKS.find((candidate) => normalizeRelativeDir(candidate?.path || '') === normalizedPath);
            if (pathMatch) return pathMatch;
        }

        const albumMeta = resolveAlbumMeta(
            playbackTrack.albumTitle || playbackTrack._sourceAlbumTitle || '',
            playbackTrack.albumArtist || playbackTrack.artist || '',
            playbackTrack._sourceAlbumId || ''
        );
        const albumMatch = findTrackInAlbumByPlaybackState(albumMeta, playbackTrack);
        if (albumMatch) return albumMatch;

        const keyedMatch = trackByKey.get(trackKey(playbackTrack.title, playbackTrack.artist));
        if (keyedMatch) return keyedMatch;

        const resolvedTrack = resolveTrackMeta(playbackTrack.title, playbackTrack.artist, playbackTrack.albumTitle);
        if (resolvedTrack && String(resolvedTrack.title || '').trim()) return resolvedTrack;
        return null;
    }

    function hydratePlaybackTrack(playbackTrack) {
        if (!playbackTrack) return null;
        const resolvedTrack = resolveTrackFromPlaybackState(playbackTrack);
        const serializedFallback = serializeTrackForPlaybackState(playbackTrack) || {};
        if (!resolvedTrack) return serializedFallback;

        const hydratedTrack = {
            ...serializedFallback,
            ...resolvedTrack
        };
        if (!hydratedTrack.artUrl) hydratedTrack.artUrl = serializedFallback.artUrl || '';
        if (!hydratedTrack.fileUrl) hydratedTrack.fileUrl = serializedFallback.fileUrl || '';
        if (!hydratedTrack._trackId) hydratedTrack._trackId = serializedFallback._trackId || getStableTrackIdentity(hydratedTrack);
        if (!hydratedTrack._sourceAlbumId) hydratedTrack._sourceAlbumId = serializedFallback._sourceAlbumId || getTrackSourceAlbumIdentity(hydratedTrack);
        if (!hydratedTrack._sourceAlbumTitle) hydratedTrack._sourceAlbumTitle = serializedFallback._sourceAlbumTitle || getTrackSourceAlbumTitle(hydratedTrack, hydratedTrack.albumTitle || '');
        return hydratedTrack;
    }

    function reconcilePlaybackStateWithLibrary() {
        const previousQueue = Array.isArray(queueTracks) ? queueTracks : [];
        const previousNowPlaying = nowPlaying;
        const nextQueue = previousQueue.map((track) => hydratePlaybackTrack(track)).filter(Boolean);
        const hydratedNowPlaying = previousNowPlaying ? hydratePlaybackTrack(previousNowPlaying) : null;
        const effectiveNowPlaying = hydratedNowPlaying || nextQueue[Math.max(0, Math.min(queueIndex, Math.max(0, nextQueue.length - 1)))] || null;
        const effectiveNowPlayingKey = getTrackIdentityKey(effectiveNowPlaying);
        let nextQueueIndex = nextQueue.length ? Math.max(0, Math.min(queueIndex, nextQueue.length - 1)) : 0;
        if (effectiveNowPlayingKey) {
            const resolvedQueueIndex = nextQueue.findIndex((track) => getTrackIdentityKey(track) === effectiveNowPlayingKey);
            if (resolvedQueueIndex >= 0) nextQueueIndex = resolvedQueueIndex;
        }

        const queueChanged = previousQueue.length !== nextQueue.length
            || nextQueue.some((track, index) => track !== previousQueue[index]);
        const nowPlayingChanged = effectiveNowPlaying !== previousNowPlaying;
        const indexChanged = nextQueueIndex !== queueIndex;
        if (!queueChanged && !nowPlayingChanged && !indexChanged) return false;

        queueTracks = nextQueue;
        queueIndex = nextQueueIndex;

        if (effectiveNowPlaying) {
            nowPlaying = effectiveNowPlaying;
            if (typeof refreshNowPlayingDisplay === 'function') {
                refreshNowPlayingDisplay(effectiveNowPlaying, { preserveProgress: true });
            } else if (typeof syncNowPlayingArt === 'function') {
                syncNowPlayingArt(effectiveNowPlaying);
            }
            persistQueue();
            return true;
        }

        if (previousNowPlaying) {
            clearNowPlayingState();
            persistQueue();
            return true;
        }

        return queueChanged || indexChanged;
    }

    function getTrackDurationCacheSignature(track) {
        if (!track) return '';
        return JSON.stringify({
            path: String(track.path || '').trim().toLowerCase(),
            handleKey: String(track._handleKey || '').trim().toLowerCase(),
            ext: String(track.ext || '').trim().toLowerCase(),
            size: Number(track._fileSize || track.size || track.sizeBytes || 0),
            lastModified: Number(track._lastModified || track.lastModified || track.mtimeMs || 0)
        });
    }

    function readDurationCacheEntry(track) {
        const cacheKey = getTrackDurationCacheKey(track);
        if (!cacheKey) return { seconds: 0, fresh: false, stale: false };
        let raw = durationCache.get(cacheKey);
        if (!raw) {
            const legacyKey = getLegacyTrackDurationCacheKey(track);
            if (legacyKey && legacyKey !== cacheKey) raw = durationCache.get(legacyKey);
        }
        if (!raw) return { seconds: 0, fresh: false, stale: false };

        if (typeof raw === 'number') {
            return { seconds: Number(raw) || 0, fresh: true, stale: false, legacy: true };
        }

        const seconds = Number(raw.seconds || 0);
        const currentSignature = getTrackDurationCacheSignature(track);
        const storedSignature = String(raw.signature || '');
        const canCompare = Boolean(currentSignature && storedSignature);
        const fresh = seconds > 0 && (!canCompare || currentSignature === storedSignature);
        return {
            seconds,
            fresh,
            stale: seconds > 0 && canCompare && currentSignature !== storedSignature,
            legacy: false
        };
    }

    function persistDurationCache() {
        const entries = [...durationCache.entries()]
            .filter(([, value]) => Number(typeof value === 'number' ? value : value?.seconds) > 0)
            .slice(-25000);
        safeStorage.setJson(STORAGE_KEYS.durationCache, Object.fromEntries(entries));
    }

    function persistDurationProbeFailures() {
        const entries = [...durationProbeFailures.entries()]
            .filter(([, value]) => value && Number(value.attempts || 0) > 0)
            .slice(-5000);
        safeStorage.setJson(STORAGE_KEYS.durationProbeFailures, Object.fromEntries(entries));
    }

    function clearDurationProbeFailure(track) {
        const cacheKey = getTrackDurationCacheKey(track);
        if (!cacheKey) return;
        if (durationProbeFailures.delete(cacheKey)) persistDurationProbeFailures();
    }

    function canProbeTrackDuration(track, options = {}) {
        if (options.force) return true;
        const cacheKey = getTrackDurationCacheKey(track);
        if (!cacheKey) return true;
        const failure = durationProbeFailures.get(cacheKey);
        if (!failure) return true;
        track._durationProbeAttempts = Number(failure.attempts || 0);
        track._durationNextRetryAt = Number(failure.nextRetryAt || 0);
        if (Date.now() < Number(failure.nextRetryAt || 0)) {
            track._durationStatus = METADATA_STATUS.failed;
            track._durationError = failure.lastError || 'Duration metadata unavailable';
        }
        return Date.now() >= Number(failure.nextRetryAt || 0);
    }

    function recordDurationProbeFailure(track, reason = 'Duration metadata unavailable') {
        if (!track) return null;
        const cacheKey = getTrackDurationCacheKey(track);
        if (!cacheKey) return null;
        const previous = durationProbeFailures.get(cacheKey) || {};
        const attempts = Math.min(12, Number(previous.attempts || 0) + 1);
        const backoffMs = Math.min(1000 * 60 * 60, Math.max(1000 * 30, 1000 * 30 * Math.pow(2, attempts - 1)));
        const failure = {
            attempts,
            lastError: String(reason || 'Duration metadata unavailable'),
            lastFailedAt: Date.now(),
            nextRetryAt: Date.now() + backoffMs
        };
        durationProbeFailures.set(cacheKey, failure);
        track._durationProbeAttempts = attempts;
        track._durationNextRetryAt = failure.nextRetryAt;
        setTrackMetadataStatus(track, METADATA_STATUS.failed, failure.lastError);
        persistDurationProbeFailures();
        return failure;
    }

    function resetDurationProbeFailure(track) {
        clearDurationProbeFailure(track);
        if (track) {
            track._durationProbeAttempts = 0;
            track._durationNextRetryAt = 0;
            if (getTrackDurationSeconds(track) <= 0) {
                setTrackMetadataStatus(track, METADATA_STATUS.pending, '');
            }
        }
    }

    function cacheTrackDuration(track, seconds, options = {}) {
        const sec = Math.round(Number(seconds || 0));
        if (!track || !Number.isFinite(sec) || sec <= 0) return false;
        track.durationSec = sec;
        track.duration = toDurationLabel(sec);
        track._durationStatus = METADATA_STATUS.ready;
        track._durationError = '';
        track._durationProbeAttempts = 0;
        track._durationNextRetryAt = 0;
        clearDurationProbeFailure(track);
        const cacheKey = getTrackDurationCacheKey(track);
        if (cacheKey) {
            durationCache.set(cacheKey, {
                seconds: sec,
                signature: getTrackDurationCacheSignature(track),
                updatedAt: Date.now()
            });
        }
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
        const cached = readDurationCacheEntry(track);
        if (cached.fresh && cached.seconds > 0) {
            cacheTrackDuration(track, cached.seconds, { persist: false });
            return cached.seconds;
        }
        if (cached.stale) {
            track._durationStatus = METADATA_STATUS.stale;
            track._durationError = 'Cached duration is stale because the file changed.';
            return 0;
        }
        canProbeTrackDuration(track);
        if (!track._durationStatus) track._durationStatus = METADATA_STATUS.pending;
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
        if (sec > 0) return toDurationLabel(sec);
        const status = getTrackMetadataStatus(track);
        if (status === METADATA_STATUS.failed) return '--:--';
        if (status === METADATA_STATUS.stale) return '--:--';
        return '…';
    }

    function getTrackMetadataStatus(track) {
        if (!track) return METADATA_STATUS.failed;
        const status = String(track._durationStatus || '').trim();
        if (Object.prototype.hasOwnProperty.call(METADATA_STATUS, status)) return status;
        return getTrackDurationSeconds(track) > 0 ? METADATA_STATUS.ready : METADATA_STATUS.pending;
    }

    function setTrackMetadataStatus(track, status, error = '') {
        if (!track) return;
        const nextStatus = Object.prototype.hasOwnProperty.call(METADATA_STATUS, status)
            ? status
            : METADATA_STATUS.pending;
        track._durationStatus = nextStatus;
        track._durationError = error ? String(error) : '';
        syncTrackDurationElements(track);
    }

    function escapeTrackKeySelectorValue(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
        return String(value || '').replace(/["\\]/g, '\\$&');
    }

    function syncTrackDurationElements(track) {
        if (!track) return;
        const key = trackKey(track.title, track.artist);
        const stableId = getStableTrackIdentity(track);
        const label = getTrackDurationDisplay(track);
        const escapedKey = escapeTrackKeySelectorValue(key);
        const escapedStableId = escapeTrackKeySelectorValue(stableId);
        const selectors = [
            `.list-item[data-track-key="${escapedKey}"]`,
            `[data-track-key="${escapedKey}"]`
        ];
        if (stableId) selectors.push(`[data-track-id="${escapedStableId}"]`);
        document.querySelectorAll(selectors.join(',')).forEach((row) => {
            const status = getTrackMetadataStatus(track);
            row.dataset.metadataStatus = status;
            row.querySelectorAll('.album-track-duration, .zenith-time-pill').forEach((timeEl) => {
                timeEl.dataset.originalDuration = label;
                timeEl.dataset.metadataStatus = status;
                timeEl.title = status === METADATA_STATUS.failed
                    ? (track._durationError || 'Duration unavailable')
                    : '';
                if (!row.classList.contains('playing-row')) timeEl.textContent = label;
            });
        });
    }

    const LIBRARY_SCAN_PHASES = Object.freeze({
        indexing: 'Indexing audio files',
        artwork: 'Resolving artwork',
        tags: 'Reading embedded tags',
        durations: 'Probing durations',
        complete: 'Scan complete'
    });

    function updateLibraryScanProgress(phase, detail = {}) {
        const labelText = detail.label || LIBRARY_SCAN_PHASES[phase] || 'Scanning library';
        const processed = Number(detail.processed || 0);
        const total = Number(detail.total || 0);
        const percent = Number.isFinite(Number(detail.percent))
            ? Math.max(0, Math.min(100, Number(detail.percent)))
            : (total > 0 ? Math.max(0, Math.min(100, Math.round((processed / total) * 100))) : 0);
        const countText = detail.countText || (total > 0
            ? `${Math.min(processed, total)} / ${total}`
            : '');

        [
            { status: 'settings-scan-status', label: 'settings-scan-label', count: 'settings-scan-count', fill: 'settings-scan-fill' },
            { status: 'setup-scan-progress', label: 'setup-scan-label', count: 'setup-scan-count', fill: 'setup-scan-fill' }
        ].forEach((target) => {
            const statusEl = getEl(target.status);
            const labelEl = getEl(target.label);
            const countEl = getEl(target.count);
            const fillEl = getEl(target.fill);
            if (statusEl && detail.visible !== false) statusEl.style.display = 'block';
            if (labelEl) labelEl.textContent = labelText;
            if (countEl) countEl.textContent = countText;
            if (fillEl) fillEl.style.width = percent + '%';
        });

        APP_STATE.emit('library:scan-progress', { phase, label: labelText, processed, total, percent });
    }

    function getAlbumTotalDurationSeconds(albumMeta) {
        if (!albumMeta) return 0;
        const trackTotal = Array.isArray(albumMeta.tracks)
            ? albumMeta.tracks.reduce((sum, track) => sum + getTrackDurationSeconds(track), 0)
            : 0;
        const labelTotal = parseLibraryDurationLabel(albumMeta.totalDurationLabel);
        if (trackTotal > 0 && labelTotal > 0) return Math.max(trackTotal, labelTotal);
        return trackTotal || labelTotal || 0;
    }

    function normalizeAlbumYearValue(value) {
        const match = String(value || '').trim().match(/\d{4}/);
        return match ? match[0] : '';
    }

    function resolveAlbumYear(albumMeta) {
        if (!albumMeta) return '';
        const direct = normalizeAlbumYearValue(albumMeta.year);
        if (direct) {
            albumMeta.year = direct;
            return direct;
        }
        const trackYears = Array.isArray(albumMeta.tracks)
            ? albumMeta.tracks.map(track => normalizeAlbumYearValue(track.year)).filter(Boolean)
            : [];
        const resolved = typeof majorityVote === 'function'
            ? normalizeAlbumYearValue(majorityVote(trackYears))
            : trackYears[0] || '';
        if (resolved) albumMeta.year = resolved;
        return resolved;
    }

    function refreshAlbumTotalDurationLabel(albumMeta) {
        if (!albumMeta) return '--';
        const computed = Array.isArray(albumMeta.tracks) ? toLibraryDurationTotal(albumMeta.tracks) : '--';
        const fallback = String(albumMeta.totalDurationLabel || '').trim();
        albumMeta.totalDurationLabel = computed !== '--' ? computed : (fallback || '--');
        return albumMeta.totalDurationLabel;
    }

    function renderAlbumMetadataLine(albumMeta, metaEl = getEl('alb-meta')) {
        if (!albumMeta || !metaEl) return;
        const trackCount = albumMeta.tracks?.length || Number(albumMeta.trackCount || 0);
        const albumMetaDone = Array.isArray(albumMeta.tracks) && albumMeta.tracks.length > 0 && albumMeta.tracks.every(t => t._metaDone);
        const albumYear = resolveAlbumYear(albumMeta);
        const yearMissing = albumMetaDone && !albumYear;
        const totalDuration = refreshAlbumTotalDurationLabel(albumMeta);

        metaEl.textContent = '';
        metaEl.removeAttribute('class');
        const yearSpan = document.createElement('span');
        if (yearMissing) {
            yearSpan.textContent = 'No Year';
            yearSpan.className = 'metadata-error';
        } else {
            yearSpan.textContent = albumYear || 'Unknown Year';
        }
        metaEl.append('Album - ', yearSpan, ` - ${trackCount} tracks`);
        if (totalDuration && totalDuration !== '--') metaEl.append(` - ${totalDuration}`);
    }

    function refreshVisibleAlbumDurationMetadata(albumHint = null) {
        const activeAlbum = albumHint || (typeof resolveAlbumMeta === 'function'
            ? resolveAlbumMeta(activeAlbumTitle, activeAlbumArtist)
            : null);
        if (!activeAlbum) return;
        refreshAlbumTotalDurationLabel(activeAlbum);
        if (!activeAlbumTitle || albumKey(activeAlbum.title) !== albumKey(activeAlbumTitle)) return;
        renderAlbumMetadataLine(activeAlbum);
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

    function showZenithActionSheet(title, sub, actions, options = {}) {
        if (typeof presentActionSheet === 'function') {
            presentActionSheet(title, sub, actions, options);
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
        openSheet(title, sub, options);
    }

    function commitQueueChange(message = '') {
        persistQueue();
        renderQueue();
        if (typeof updateNowPlayingUI === 'function') updateNowPlayingUI();
        if (message) toast(message);
    }

    function insertTrackInQueue(track, position = 'end') {
        if (!track) return false;
        if (position !== 'next' && queueTracks.length >= MAX_QUEUE_SIZE) {
            toast(`Queue limit reached (${MAX_QUEUE_SIZE} tracks)`);
            return false;
        }
        if (position === 'next') {
            const currentIdx = Math.max(0, getCurrentQueueIndex());
            queueTracks.splice(Math.min(currentIdx + 1, queueTracks.length), 0, track);
        } else {
            queueTracks.push(track);
        }
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(0, MAX_QUEUE_SIZE);
        return true;
    }

    function queueTrackNextSmart(track) {
        if (!insertTrackInQueue(track, 'next')) return;
        commitQueueChange(`"${track.title}" queued next`);
    }

    function addTrackToQueueSmart(track) {
        if (!insertTrackInQueue(track, 'end')) return;
        commitQueueChange(`Added "${track.title}" to queue`);
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
                onSelect: () => routeToAlbumDetail(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track))
            },
            {
                label: 'Open Artist',
                description: `Go to ${track.artist}.`,
                icon: 'artist',
                onSelect: () => routeToArtistProfile(track.artist)
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
                const trackIdx = pl.tracks.findIndex((candidate) => isSameTrack(candidate, track));
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
            actions,
            {
                artUrl: track.artUrl || (typeof resolveAlbumMeta === 'function'
                    ? resolveAlbumMeta(track.albumTitle, track.artist)?.artUrl
                    : '') || '',
                icon: 'music'
            }
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
        const albumYear = resolveAlbumYear(albumMeta);
        const artistStats = getArtistSummary(displayArtist);
        showZenithActionSheet(
            albumMeta.title,
            `${displayArtist} - ${albumYear || 'Unknown Year'} - ${albumMeta.trackCount || 0} tracks - ${totalDuration}`,
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
            ],
            {
                artUrl: albumMeta.artUrl || albumMeta.tracks?.find(track => track.artUrl)?.artUrl || '',
                icon: 'album'
            }
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
        const trackDurations = tracks.map(track => Math.max(0, getTrackDurationSeconds(track)));
        const knownDurationTotal = trackDurations.reduce((sum, value) => sum + value, 0);
        const total = Math.max(1, knownDurationTotal || getAlbumTotalDurationSeconds(albumMeta));
        let elapsed = 0;

        tracks.forEach((track, idx) => {
            const notch = document.createElement('span');
            notch.className = 'album-progress-notch';
            const ratio = knownDurationTotal > 0
                ? Math.max(0, Math.min(1, elapsed / total))
                : Math.max(0, Math.min(1, idx / tracks.length));
            notch.style.left = `${ratio * 100}%`;
            notch.style.transform = 'translateX(-50%)';
            notch.title = `${idx + 1}. ${track.title}`;
            notch.dataset.trackIndex = String(idx);
            notchesEl.appendChild(notch);
            if (knownDurationTotal > 0) elapsed += Math.max(1, trackDurations[idx]);
        });
    }

    function seekAlbumProgress(ratio) {
        const albumMeta = resolveAlbumMeta(viewedAlbumTitle, viewedAlbumArtist);
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

        const albumMeta = resolveAlbumMeta(viewedAlbumTitle, viewedAlbumArtist);
        if (!albumMeta || !Array.isArray(albumMeta.tracks) || !albumMeta.tracks.length) {
            shell.style.display = 'none';
            fillEl.style.width = '0%';
            notchesEl.innerHTML = '';
            delete notchesEl.dataset.albumKey;
            delete notchesEl.dataset.layoutKey;
            return;
        }

        shell.style.display = 'block';
        const total = getAlbumTotalDurationSeconds(albumMeta);
        const albumKeyValue = getAlbumIdentityKey(albumMeta, albumMeta.artist);
        const layoutKey = `${albumKeyValue}:${albumMeta.tracks.length}:${Math.round(total)}`;
        if (notchesEl.dataset.layoutKey !== layoutKey) {
            renderAlbumProgressNotches(albumMeta);
            notchesEl.dataset.albumKey = albumKeyValue;
            notchesEl.dataset.layoutKey = layoutKey;
        }
        if (total <= 0) {
            fillEl.style.width = '0%';
            return;
        }

        const currentKey = getTrackIdentityKey(nowPlaying);
        const currentTrackIndex = albumMeta.tracks.findIndex((track) => getTrackIdentityKey(track) === currentKey);
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

    function getArtistSectionCatalog() {
        return [
            { type: 'artist_top_songs',  title: 'Top Tracks', itemType: 'songs',  layout: 'list',     density: 'compact', limit: 10, core: true },
            { type: 'artist_releases',   title: 'Releases',   itemType: 'albums', layout: 'carousel', density: 'large',   limit: 5,  core: true }
        ];
    }

    function getDefaultArtistProfileSections() {
        return getArtistSectionCatalog().map(s => ({
            id: toSafeId(s.type),
            type: s.type,
            title: s.title,
            itemType: s.itemType,
            layout: s.layout,
            density: s.density,
            limit: s.limit,
            enabled: true,
            core: true
        }));
    }

    function resolveArtUrlForContext(artUrl) {
        const raw = String(artUrl || '').trim();
        if (!raw) return '';
        const isHttpCtx = location.protocol === 'http:' || location.protocol === 'https:';
        if (isHttpCtx && /^file:\/\//i.test(raw)) return '';
        return raw;
    }

    function encodeMediaPathSegments(rawPath) {
        const normalized = normalizeRelativeDir(rawPath);
        if (!normalized) return '';
        return normalized
            .split('/')
            .filter(Boolean)
            .map(segment => {
                try {
                    return encodeURIComponent(decodeURIComponent(segment));
                } catch {
                    return encodeURIComponent(segment);
                }
            })
            .join('/');
    }

    function buildServedMusicUrl(rawPath) {
        const encodedPath = encodeMediaPathSegments(rawPath);
        return encodedPath ? `/music/${encodedPath}` : '';
    }

    function resolveMediaSourceForContext(fileUrl, track = null) {
        const raw = String(fileUrl || '').trim();
        const isHttpCtx = location.protocol === 'http:' || location.protocol === 'https:';
        if (!raw) return isHttpCtx ? buildServedMusicUrl(track?.path || '') : '';
        if (/^(blob:|data:|https?:)/i.test(raw)) return raw;
        if (isHttpCtx && /^file:\/\//i.test(raw)) return buildServedMusicUrl(track?.path || '');
        const servedMatch = raw.replace(/\\/g, '/').match(/^\/?music\/(.+)$/i);
        if (servedMatch) return buildServedMusicUrl(servedMatch[1]);
        if (isHttpCtx && !/^[a-z]+:/i.test(raw)) {
            return buildServedMusicUrl(track?.path || raw) || raw;
        }
        return raw;
    }

    // Resolve a playable URL for a track: try blob cache → handle key → file handle lookup → raw URL
    async function resolvePlayableUrl(track) {
        const key = getTrackPlaybackCacheKey(track);
        const handleKey = String(track?._handleKey || '').trim();
        const filename = extractFilename(track);
        if (DEBUG) console.log('[Auralis] resolvePlayableUrl:', track.title, '| _handleKey:', track._handleKey, '| handleCacheSize:', fileHandleCache.size);

        // 1. Check blob URL cache
        if (blobUrlCache.has(key)) return trackPlaybackBlobUrl(blobUrlCache.get(key));
        if (handleKey && blobUrlCache.has(handleKey)) {
            const cached = blobUrlCache.get(handleKey);
            if (key) blobUrlCache.set(key, cached);
            return trackPlaybackBlobUrl(cached);
        }
        if (filename && blobUrlCache.has(filename)) {
            const cached = blobUrlCache.get(filename);
            if (key) blobUrlCache.set(key, cached);
            return trackPlaybackBlobUrl(cached);
        }

        // 2. Direct handle key (scanned tracks have this)
        if (handleKey && fileHandleCache.has(handleKey)) {
            try {
                const handle = fileHandleCache.get(handleKey);
                // Fallback shim from <input webkitdirectory>
                if (handle && handle._blobUrl) {
                    if (key) blobUrlCache.set(key, handle._blobUrl);
                    blobUrlCache.set(handleKey, handle._blobUrl);
                    if (filename) blobUrlCache.set(filename, handle._blobUrl);
                    return trackPlaybackBlobUrl(handle._blobUrl);
                }
                const file = await handle.getFile();
                const blobUrl = URL.createObjectURL(file);
                if (key) blobUrlCache.set(key, blobUrl);
                blobUrlCache.set(handleKey, blobUrl);
                if (filename) blobUrlCache.set(filename, blobUrl);
                return trackPlaybackBlobUrl(blobUrl);
            } catch (e) {
                console.warn('Could not read file handle for', handleKey, e);
            }
        }

        // 3. Check if raw fileUrl or scanned relative path works directly.
        const direct = resolveMediaSourceForContext(track.fileUrl, track);
        if (direct) return direct;

        // 4. Try to find a matching file handle from scanned folders by filename
        if (filename && fileHandleCache.has(filename)) {
            try {
                const handle = fileHandleCache.get(filename);
                // Fallback shim from <input webkitdirectory>
                if (handle && handle._blobUrl) {
                    if (key) blobUrlCache.set(key, handle._blobUrl);
                    blobUrlCache.set(filename, handle._blobUrl);
                    if (handleKey) blobUrlCache.set(handleKey, handle._blobUrl);
                    return trackPlaybackBlobUrl(handle._blobUrl);
                }
                const file = await handle.getFile();
                const blobUrl = URL.createObjectURL(file);
                if (key) blobUrlCache.set(key, blobUrl);
                blobUrlCache.set(filename, blobUrl);
                if (handleKey) blobUrlCache.set(handleKey, blobUrl);
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
                            if (key) blobUrlCache.set(key, handle._blobUrl);
                            blobUrlCache.set(fname, handle._blobUrl);
                            if (handleKey) blobUrlCache.set(handleKey, handle._blobUrl);
                            if (filename) blobUrlCache.set(filename, handle._blobUrl);
                            return trackPlaybackBlobUrl(handle._blobUrl);
                        }
                        const file = await handle.getFile();
                        const blobUrl = URL.createObjectURL(file);
                        if (key) blobUrlCache.set(key, blobUrl);
                        blobUrlCache.set(fname, blobUrl);
                        if (handleKey) blobUrlCache.set(handleKey, blobUrl);
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
            ? 'Cached tracks are currently hidden because file access is stale. Open Settings and tap Scan Library.'
            : (partiallyPlayable
                ? `Only ${playableTrackCount} of ${scannedTrackCount} indexed tracks are currently playable. Scan Library to refresh handles.`
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

    }
