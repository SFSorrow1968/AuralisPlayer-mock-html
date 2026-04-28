/*
 * GENERATED FILE. Do not edit directly.
 * Source shards live in src/js/auralis-core/.
 * Rebuild with: powershell -ExecutionPolicy Bypass -File scripts/build-core.ps1
 */

/* >>> 00-shell-state-helpers.js */
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
        user: 'user',
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

    // AuralisDiagnostics, AuralisStrings, and AURALIS_LOG_LIMIT are defined in shard 00a-runtime-logger.js
    // and 00b-strings.js, which load after this shard inside the same IIFE.

    const LOCAL_STORAGE_WARN_BYTES = 1024;

    function estimateStorageBytes(value) {
        const text = String(value == null ? '' : value);
        if (typeof Blob === 'function') return new Blob([text]).size;
        return text.length;
    }

    function reportStorageIssue(level, messageKey, details, storageError) {
        // AuralisDiagnostics and AuralisStrings are initialized in shard 00a (loads after this shard).
        // Errors during the brief IIFE startup window before 00a runs are silently dropped.
        try {
            const message = AuralisStrings[messageKey] || messageKey;
            if (level === 'error') {
                AuralisDiagnostics.error(message, storageError, details);
                return;
            }
            AuralisDiagnostics.warn(message, details || null);
        } catch (_notYetInitialized) { /* diagnostics not yet available during IIFE startup */ }
    }

    function warnIfLargeStorageWrite(key, value) {
        const byteSize = estimateStorageBytes(value);
        if (byteSize <= LOCAL_STORAGE_WARN_BYTES) return;
        reportStorageIssue('warn', 'storageLargeWrite', { key, byteSize }, null);
    }

    // Safe localStorage wrapper (handles private browsing / quota exceeded)
    const safeStorage = {
        getItem(key) {
            try {
                return localStorage.getItem(key);
            } catch (error) {
                reportStorageIssue('warn', 'storageReadFailed', { key }, error);
                return null;
            }
        },
        setItem(key, value) {
            try {
                warnIfLargeStorageWrite(key, value);
                localStorage.setItem(key, value);
            } catch (error) {
                reportStorageIssue('error', 'storageWriteFailed', { key }, error);
            }
        },
        removeItem(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                reportStorageIssue('warn', 'storageRemoveFailed', { key }, error);
            }
        },
        clearKnownKeys() {
            Object.values(STORAGE_KEYS).forEach((key) => {
                try {
                    localStorage.removeItem(key);
                } catch (error) {
                    reportStorageIssue('warn', 'storageClearFailed', { key }, error);
                }
            });
        },
        getJson(key, fallback) {
            const raw = safeStorage.getItem(key);
            if (!raw) return fallback;
            try {
                return JSON.parse(raw);
            } catch (error) {
                reportStorageIssue('warn', 'storageJsonParseFailed', { key }, error);
                return fallback;
            }
        },
        setJson(key, value) {
            let serialized;
            try {
                serialized = JSON.stringify(value);
            } catch (error) {
                reportStorageIssue('error', 'storageJsonStringifyFailed', { key }, error);
                return;
            }
            safeStorage.setItem(key, serialized);
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

    // ── Metadata Overrides (user-edited tags) ──
    let metadataOverrides = new Map(
        Object.entries(safeStorage.getJson(STORAGE_KEYS.metadataOverrides, {}))
    );

    function persistMetadataOverrides() {
        const obj = {};
        metadataOverrides.forEach((v, k) => { obj[k] = v; });
        safeStorage.setJson(STORAGE_KEYS.metadataOverrides, obj);
    }

    function getTrackMetadataOverrideKey(track) {
        return getTrackIdentityKey(track);
    }

    // Apply any user-saved tag overrides onto a track object (mutates in-place).
    // Called during library snapshot build so every render sees fresh data.
    function applyMetadataOverride(track) {
        if (!track) return track;
        const key = getTrackMetadataOverrideKey(track);
        const legacyKey = trackKey(track.title, track.artist);
        const ov = metadataOverrides.get(key) || metadataOverrides.get(legacyKey);
        if (!ov) return track;
        if (ov.title       !== undefined) track.title       = ov.title;
        if (ov.artist      !== undefined) track.artist      = ov.artist;
        if (ov.albumArtist !== undefined) track.albumArtist = ov.albumArtist;
        if (ov.album       !== undefined) track.albumTitle  = ov.album;
        if (ov.year        !== undefined) track.year        = ov.year;
        if (ov.genre       !== undefined) track.genre       = ov.genre;
        setTrackMetadataQuality(track, METADATA_QUALITY.user, 'user_override');
        return track;
    }

    // Persist an override. oldKey should be the most stable key available for the track.
    function saveMetadataOverride(oldKey, fields, track = null) {
        if (!fields || !oldKey) return;
        const existing = metadataOverrides.get(oldKey) || {};
        const merged = Object.assign({}, existing, fields);
        metadataOverrides.set(oldKey, merged);
        if (track) {
            const nextTrack = {
                ...track,
                title: fields.title || track.title,
                artist: fields.artist || track.artist,
                albumArtist: fields.albumArtist !== undefined ? fields.albumArtist : track.albumArtist,
                albumTitle: fields.album || track.albumTitle,
                year: fields.year !== undefined ? fields.year : track.year,
                genre: fields.genre !== undefined ? fields.genre : track.genre
            };
            const newKey = getTrackMetadataOverrideKey(nextTrack);
            if (newKey && newKey !== oldKey) metadataOverrides.set(newKey, merged);
        } else {
            // Legacy fallback for older callers that only have a title/artist key.
            const newTitle  = String(merged.title  || '').trim();
            const newArtist = String(merged.artist || '').trim();
            if (newTitle || newArtist) {
                const newKey = trackKey(
                    newTitle  || oldKey.split('::')[0],
                    newArtist || oldKey.split('::')[1]
                );
                if (newKey !== oldKey) metadataOverrides.set(newKey, merged);
            }
        }
        persistMetadataOverrides();
    }

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
        if (track._metadataQuality === METADATA_QUALITY.user || track._metadataSource === 'user_override') {
            return METADATA_QUALITY.user;
        }
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

    function getTrackMetadataQualityLabel(track) {
        const quality = getTrackMetadataQuality(track);
        if (quality === METADATA_QUALITY.guessed) return 'Guessed tags';
        if (quality === METADATA_QUALITY.partial) return 'Partial tags';
        if (quality === METADATA_QUALITY.user) return 'Edited tags';
        if (quality === METADATA_QUALITY.unknown) return 'Unknown tags';
        return '';
    }

    function getTrackMetadataQualityDescription(track) {
        const quality = getTrackMetadataQuality(track);
        if (quality === METADATA_QUALITY.guessed) return 'Metadata is inferred from the filename or folder.';
        if (quality === METADATA_QUALITY.partial) return 'Embedded metadata was found, but one or more core tags are missing.';
        if (quality === METADATA_QUALITY.user) return 'Metadata has a saved user override.';
        if (quality === METADATA_QUALITY.embedded) return 'Metadata came from embedded audio tags.';
        return 'Metadata source is unknown.';
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
        const yearMissing = albumMetaDone && !albumMeta.year;
        const totalDuration = refreshAlbumTotalDurationLabel(albumMeta);

        metaEl.textContent = '';
        metaEl.removeAttribute('class');
        const yearSpan = document.createElement('span');
        if (yearMissing) {
            yearSpan.textContent = 'No Year';
            yearSpan.className = 'metadata-error';
        } else {
            yearSpan.textContent = albumMeta.year || 'Unknown Year';
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
                    } catch (_) { /* benign: cleanup */ }
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
/* <<< 00-shell-state-helpers.js */

/* >>> 00a-runtime-logger.js */
/*
 * Auralis JS shard: 00a-runtime-logger.js
 * Purpose: Central runtime diagnostics used by storage, verification, and future debug UI.
 * Loads inside the IIFE opened by 00-shell-state-helpers.js, before library/playback shards.
 */
    const AURALIS_LOG_LIMIT = 250;
    const AuralisDiagnostics = (() => {
        const entries = [];

        function normalizeLevel(level) {
            return ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info';
        }

        function normalizeError(error) {
            if (!error) return null;
            if (error instanceof Error) {
                return { name: error.name, message: error.message, stack: error.stack || '' };
            }
            return { name: 'NonError', message: String(error), stack: '' };
        }

        function write(level, message, details) {
            const entry = Object.freeze({
                level: normalizeLevel(level),
                message: String(message || 'Auralis diagnostic event'),
                details: details || null,
                timestamp: Date.now()
            });
            entries.push(entry);
            if (entries.length > AURALIS_LOG_LIMIT) entries.shift();
            return entry;
        }

        function log(level, message, details) {
            return write(level, message, details || null);
        }

        function warn(message, details) {
            return write('warn', message, details || null);
        }

        function error(message, errorValue, details) {
            return write('error', message, Object.assign({}, details || {}, {
                error: normalizeError(errorValue)
            }));
        }

        function snapshot() {
            return entries.slice();
        }

        function clear() {
            entries.splice(0, entries.length);
        }

        return Object.freeze({ log, warn, error, snapshot, clear });
    })();

    const AuralisStrings = {};
    const AuralisRuntime = {
        diagnostics: AuralisDiagnostics,
        strings: AuralisStrings
    };
/* <<< 00a-runtime-logger.js */

/* >>> 00b-strings.js */
/*
 * Auralis JS shard: 00b-strings.js
 * Purpose: Shared user-facing and diagnostic text for the runtime.
 * Populates AuralisStrings (initialized as {} in 00a-runtime-logger.js).
 *
 * Style rules:
 *  - All keys use camelCase.
 *  - Template-style strings (needing interpolation) are functions that return a string.
 *  - Duplicates found across shards are the highest priority: one source of truth.
 *  - Aria-labels and tooltips live in their own sub-objects for clarity.
 */
    Object.assign(AuralisStrings, {

        /* ── Storage diagnostics (consumed by 00-shell-state-helpers.js) ────── */
        storageReadFailed:          'Browser storage could not be read.',
        storageWriteFailed:         'Browser storage could not be updated.',
        storageRemoveFailed:        'Browser storage entry could not be removed.',
        storageClearFailed:         'Browser storage cleanup could not remove an entry.',
        storageJsonParseFailed:     'Saved browser storage data could not be parsed.',
        storageJsonStringifyFailed: 'Saved browser storage data could not be prepared.',
        storageLargeWrite:          'A large browser storage write was detected.',
        verificationReady:          'Auralis runtime verification is available.',

        /* ── Playback feedback toasts ───────────────────────────────────────── */
        playBlockedGesture:         'Tap play to start \u2014 browsers require a user gesture first',
        playNoFolderNotSupported:   'Add a music folder in Settings so Auralis can access your files',
        playNoFolderHttp:           'Add a music folder in Settings to play local files',
        playOpenSettings:           'Open Settings and tap Scan Library to enable playback',
        playNoTrackFound:           'No playable track found',
        sleepTimerEnded:            'Sleep timer ended \u2014 playback paused',
        replayGainEnabled:          'ReplayGain enabled',
        replayGainDisabled:         'ReplayGain disabled',
        eqEnabled:                  'Equalizer on',
        eqDisabled:                 'Equalizer bypassed',
        gaplessEnabled:             'Gapless playback enabled',
        gaplessDisabled:            'Gapless playback disabled',
        crossfadeEnabled:           'Crossfade enabled',
        crossfadeDisabled:          'Crossfade disabled',
        darkThemeEnabled:           'Dark theme enabled',
        darkThemeDisabled:          'Dark theme disabled',
        hqAudioEnabled:             'High quality audio enabled',
        hqAudioDisabled:            'High quality audio disabled',

        /* ── Queue & playlist toasts ────────────────────────────────────────── */
        noPlaylistsAvailable:       'No playlists available',
        addFolderFirst:             'Add a folder first',
        notEnoughTracksToShuffle:   'Not enough tracks to shuffle',
        queueOrderShuffled:         'Queue order shuffled',
        queueAlreadyEmpty:          'Queue is already empty',
        trackMovedToTop:            'Track moved to top of queue',
        trackAlreadyPlaying:        'Track is already playing',
        trackWillPlayNext:          'Track will play next',
        trackAlreadyNext:           'Track is already next',
        removeOnlyFromPlaylistOrQueue: 'Remove is only available from playlists or the queue',

        /* ── Navigation toasts ──────────────────────────────────────────────── */
        artistUnavailable:          'Artist unavailable',
        playlistUnavailable:        'Playlist unavailable',
        noGenreMetadata:            'No genre metadata found',
        noArtworkAvailable:         'No artwork available',
        invalidJoinCode:            'Invalid join code',
        workspaceEditorUnlocked:    'Workspace Editor Unlocked',
        layoutSettingsSaved:        'Layout Settings Saved',
        noFiltersForType:           'No filters available for this type',
        smartPlaylistsComing:       'Smart playlists coming soon',
        playlistFoldersComing:      'Playlist folders coming soon',
        atLeastOneHomeRequired:     'At least one Home is required',

        /* ── Undo toasts ────────────────────────────────────────────────────── */
        undone:                     'Undone',
        nothingToUndo:              'Nothing to undo',
        queueNowEmpty:              'Queue is now empty',
        clearedUpcomingTracks:      'Cleared upcoming tracks',
        queueCleared:               'Queue cleared',
        undoLabel:                  'Undo',

        /* ── Share / clipboard toasts ───────────────────────────────────────── */
        trackInfoCopied:            'Track info copied to clipboard',
        shareNotAvailable:          'Share not available on this device',

        /* ── Metadata editor toasts ─────────────────────────────────────────── */
        tagsUpdated:                'Tags updated',
        metadataEditorSaved:        'Saved!',

        /* ── M3U import/export toasts ───────────────────────────────────────── */
        playlistIsEmpty:            'Playlist is empty',
        queueIsEmpty:               'Queue is empty',
        m3uCouldNotReadFile:        'Could not read file',
        m3uNoTracksFound:           'No tracks found in M3U file',

        /* ── Backend / sync toasts ──────────────────────────────────────────── */
        backendRemoteStateApplied:  'Remote library state applied',
        backendSyncComplete:        'Backend sync complete',
        backendConflictResolved:    'Backend conflict resolved using remote state',
        backendAccountCreated:      'Backend account created',
        backendSignedIn:            'Signed into backend',
        backendSessionCleared:      'Backend session cleared',
        backendNotConnected:        'Not connected',

        /* ── Scan / status labels ───────────────────────────────────────────── */
        scanning:                   'Scanning...',
        scanError:                  'Scan error \u2014 some files may be missing',
        scanContinueAnyway:         'Continue Anyway',
        scanComplete:               'Scan complete!',
        scanSelected:               'Scan Selected',
        scanLibrary:                'Scan Library',
        usingIndexedContents:       'Using indexed folder contents...',
        noLibrarySetup:             'Add a folder and run Scan Library',
        folderAccessUnsupported:    'This browser does not support folder access. Use desktop Chrome, Edge, or Opera.',

        /* ── Scan / status template strings (call as functions) ─────────────── */
        scanningFolder:             function(name) { return 'Scanning ' + name + '...'; },
        tracksAddedToLibrary:       function(n) { return n + ' tracks added to your library'; },
        durationProbeFailed:        function(n) { return n + ' track(s) could not be probed for duration'; },

        /* ── Empty states ───────────────────────────────────────────────────── */
        emptySongs:                 'No songs yet.',
        emptyPlaylists:             'No playlists yet.',
        emptyGenres:                'No tagged genres yet.',
        emptyFolders:               'No folders found. Scan a music library to browse by folder.',
        emptyNoMatchingSongs:       'No matching songs.',
        emptyNoSongsInLibrary:      'No songs in library yet.',
        emptySearchHint:            'Try another filter or clear your query.',
        emptyLibraryHint:           'Your local library has no matching items. Try browsing to add more.',
        emptyQueueFull:             'Queue is empty. Find something to play and it will appear here.',
        emptyQueueInline:           'No tracks queued yet.',
        emptyUpNext:                'Nothing queued after the current track.',
        emptyQueueEnd:              'You are at the end of the queue. Add more music or shuffle another album.',
        emptyPlaylist:              'This playlist is empty',
        emptyLyricsNoTrack:         'No track playing',
        emptyLyricsNoData:          'No lyrics available for this track',
        emptyHomeTitle:             'Your Home is Empty',
        emptyHomeBody:              'Add a section to make this profile useful.',
        emptyHomeSectionsTitle:     'Nothing to show yet',
        emptyHomeSectionsBody:      'Add music or edit this Home.',
        emptyFoldersAdded:          'No folders added yet.',
        emptyBackendSessions:       'No active sessions published yet.',
        emptyBackendMetrics:        'Metrics unavailable.',
        emptyBackendAudit:          'No audit events yet.',

        /* ── Empty state section labels (template) ──────────────────────────── */
        emptySectionTitle:          function(label) { return 'No ' + label; },

        /* ── Browse / catalog CTAs ──────────────────────────────────────────── */
        browseCatalog:              'Browse Catalog',
        findMusic:                  'Find Music',
        showMoreSongs:              'Show more songs',

        /* ── Sort & filter labels ───────────────────────────────────────────── */
        sortSheet:                  'Sort & Order',
        sortRecentlyAdded:          'Recently Added',
        sortAlphabetical:           'A-Z',
        sortMostPlayed:             'Most Played',
        sortDuration:               'Duration',

        /* ── Settings / folder labels ───────────────────────────────────────── */
        mediaFoldersHeading:        'Media Folders',
        addMusicFolder:             'Add music folder',
        removeFolder:               'Remove folder',

        /* ── Home profile dialogs ───────────────────────────────────────────── */
        nameThisHome:               'Name this Home',
        dialogCancel:               'Cancel',
        dialogDone:                 'Done',

        /* ── Metadata editor headings ───────────────────────────────────────── */
        editTrackInfo:              'Edit Track Info',
        editAlbumInfo:              'Edit Album Info',

        /* ── Home section context menu labels ───────────────────────────────── */
        displayAsGrid:              'Display as Grid',
        displayAsList:              'Display as List',
        editFilters:                'Edit Filters...',
        removeSection:              'Remove Section',

        /* ── Queue screen button labels ─────────────────────────────────────── */
        shuffleUpNext:              'Shuffle Up Next',
        clearUpNext:                'Clear Up Next',

        /* ── Player status labels ───────────────────────────────────────────── */
        statusReady:                'READY',
        statusAudio:                'AUDIO',
        timeZero:                   '0:00',
        timePlaceholder:            '--:--',

        /* ── Action sheet descriptions ──────────────────────────────────────── */
        actionPlayNext:             'Insert this track right after the current one.',
        actionAddToQueue:           'Append this song to the current queue.',
        actionOpenAlbum:            'Jump to source album.',
        actionEditInfo:             'Fix title, artist, album artist, year, genre.',
        actionShare:                'Copy track info or share via system sheet.',
        actionRemoveFromPlaylist:   'Remove this track from the current playlist.',
        actionOpenArtist:           'View artist profile and top tracks.',
        actionPlayArtist:           'Start with the most-played track.',
        actionPlayArtistUnavailable:'Play unavailable (no tracks).',
        actionQueueArtist:          'Add the top track to your queue.',
        actionQueueArtistUnavailable:'No tracks available to queue.',
        actionPlayAlbum:            'Start from track 1 in album order.',

        /* ── Aria-labels ─────────────────────────────────────────────────────── */
        ariaLabels: {
            shuffleQueue:           'Shuffle queue',
            repeatOff:              'Repeat off',
            repeatAll:              'Repeat all',
            repeatOnce:             'Repeat once',
            unlike:                 'Unlike',
            like:                   'Like',
            clearUpNext:            'Clear up next',
            clearUpNextUnavailable: 'Clear up next unavailable',
            cycleDensity:           'Cycle density',
            itemCount:              'Item count',
            sectionSettings:        'Section settings',
            removeSectionAria:      'Remove section',
            reorderTrack:           function(title) { return 'Reorder ' + (title || 'track'); },
            openArtwork:            function(albumTitle) { return 'Open artwork for ' + albumTitle; }
        },

        /* ── Tooltip (title) attributes ──────────────────────────────────────── */
        tooltips: {
            shuffle:                'Shuffle',
            repeatOff:              'Repeat off',
            repeatAll:              'Repeat all',
            repeatOnce:             'Repeat once',
            removeFolder:           'Remove folder',
            longPressForOptions:    'Long press for metadata options',
            cycleDensity:           'Cycle Density',
            itemCount:              'Item Count',
            settings:               'Settings',
            remove:                 'Remove'
        },

        /* ── Confirm dialog templates ────────────────────────────────────────── */
        confirmRemoveFromPlaylist:  function(plName, trackTitle) {
            return {
                title:  'Remove from \u201c' + plName + '\u201d?',
                body:   '\u201c' + trackTitle + '\u201d will be removed from this playlist.',
                action: 'Remove'
            };
        },
        confirmRemoveFromQueue:     function(trackTitle) {
            return {
                title:  'Remove from queue?',
                body:   '\u201c' + trackTitle + '\u201d will be removed from the queue.',
                action: 'Remove'
            };
        },
        confirmRemoveFolder:        function(folderName, count) {
            return {
                title:  'Remove \u201c' + folderName + '\u201d?',
                body:   'This will remove the folder and its ' + count + ' indexed files from your library. No files will be deleted from your device.',
                action: 'Remove'
            };
        },
        confirmDeletePlaylist:      function(plName) {
            return {
                title:  'Delete \u201c' + plName + '\u201d?',
                body:   'This playlist will be permanently deleted.',
                action: 'Delete'
            };
        }
    });
/* <<< 00b-strings.js */

/* >>> 01-library-scan-metadata.js */
/*
 * Auralis JS shard: 01-library-scan-metadata.js
 * Purpose: scan-to-library merge, duration probing, artwork, featured albums
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    // ── Build library entries from scanned files ──

    function parseTrackFilename(filename) {
        // Strip extension
        const base = filename.replace(/\.[^.]+$/, '');
        // Try "NN Title" or "NN. Title" or "NN - Title" patterns
        const numMatch = base.match(/^(\d{1,3})[\s.\-_]+(.+)$/);
        if (numMatch) {
            return { no: parseInt(numMatch[1], 10), title: numMatch[2].trim() };
        }
        // Try "Artist - Title" pattern
        const dashMatch = base.match(/^(.+?)\s*-\s*(.+)$/);
        if (dashMatch) {
            return { no: 0, title: dashMatch[2].trim(), parsedArtist: dashMatch[1].trim() };
        }
        return { no: 0, title: base.trim() };
    }

    function resetPlaybackState() {
        queueTracks = LIBRARY_TRACKS.slice(0, DEFAULT_QUEUE_SIZE);
        queueIndex = 0;
        nowPlaying = queueTracks[0] || null;
        if (nowPlaying) {
            setNowPlaying(nowPlaying, false);
        } else {
            clearNowPlayingState();
        }
        renderQueue();
    }

    function clearNowPlayingState() {
        nowPlaying = null;
        setPlaybackCollection('', '');
        activeArtistName = LIBRARY_ARTISTS[0]?.name || ARTIST_NAME;
        document.body.dataset.noTrack = '1';

        document.querySelectorAll('.mini-title').forEach(el => { setNowPlayingMarqueeText(el, 'No track selected'); });
        document.querySelectorAll('.mini-artist').forEach(el => { setNowPlayingMarqueeText(el, 'Add a folder and run Scan Library'); });

        const pt = getEl('player-title') || document.querySelector('.player-titles h1');
        const pa = getEl('player-artist') || document.querySelector('.player-titles p');
        if (pt) setNowPlayingMarqueeText(pt, 'No track selected');
        if (pa) setNowPlayingMarqueeText(pa, 'Add a folder and run Scan Library');
        scheduleNowPlayingMarquee(document);

        const quality = getEl('player-quality-badge');
        const format = getEl('player-format-badge');
        if (quality) quality.textContent = 'READY';
        if (format) format.textContent = 'AUDIO';

        const elapsed = getEl('player-elapsed');
        const remaining = getEl('player-remaining');
        if (elapsed) elapsed.textContent = '0:00';
        if (remaining) remaining.textContent = '--:--';

        syncNowPlayingArt(null);
        updateProgressUI(0, 0);
        setPlayButtonState(false);
        if (typeof syncLyricsPanel === 'function') syncLyricsPanel(null);
    }

    function normalizeSearchText(value) {
        const normalized = String(value ?? '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[’'`]/g, '')
            .replace(/&/g, ' and ')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        return normalized.replace(/\s+/g, ' ');
    }

    function uniqueSearchValues(values) {
        const seen = new Set();
        const out = [];
        values.flat(Infinity).forEach((value) => {
            const text = String(value ?? '').trim();
            if (!text) return;
            const key = normalizeSearchText(text);
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(text);
        });
        return out;
    }

    function createSearchIndex(fields) {
        const weightedFields = Object.fromEntries(
            Object.entries(fields).map(([name, values]) => [
                name,
                uniqueSearchValues(Array.isArray(values) ? values : [values]).flatMap((value) => {
                    const normalized = normalizeSearchText(value);
                    const compact = normalized.replace(/\s+/g, '');
                    return compact && compact !== normalized ? [normalized, compact] : [normalized];
                })
            ])
        );
        return {
            fields: weightedFields,
            text: Object.values(weightedFields).flat().join(' ')
        };
    }

    function rebuildSearchData() {
        const featuredAlbums = getFeaturedAlbums();
        const fallbackArtistArt = featuredAlbums[0]?.artUrl || '';
        const totalTracks = LIBRARY_TRACKS.length;
        const totalAlbums = LIBRARY_ALBUMS.length;
        const tracksByArtistKey = new Map();
        const albumsByArtistKey = new Map();

        function addSearchRelation(map, key, value) {
            if (!key || !value) return;
            if (!map.has(key)) map.set(key, []);
            const list = map.get(key);
            if (!list.includes(value)) list.push(value);
        }

        LIBRARY_TRACKS.forEach((track) => {
            [
                getCanonicalTrackArtistName(track),
                track.artist,
                track.albumArtist
            ].forEach((artist) => addSearchRelation(tracksByArtistKey, toArtistKey(artist), track));
        });

        LIBRARY_ALBUMS.forEach((album) => {
            [
                getAlbumPrimaryArtistName(album, album.artist),
                album.artist,
                album.albumArtist
            ].forEach((artist) => addSearchRelation(albumsByArtistKey, toArtistKey(artist), album));
        });

        const songResults = LIBRARY_TRACKS.map((track, i) => {
            const duration = getTrackDurationSeconds(track);
            const entry = {
                title: track.title || 'Unknown Track',
                subtitle: `${track.artist || ARTIST_NAME} - ${duration > 0 ? toDurationLabel(duration) : '--:--'}`,
                artist: track.artist || ARTIST_NAME,
                albumTitle: track.albumTitle || 'Unknown Album',
                year: track.year || '',
                genre: track.genre || '',
                type: 'songs',
                plays: Number(track.plays || 0),
                duration,
                added: Math.max(1, totalTracks - i),
                artUrl: track.artUrl || '',
                action: () => playTrack(track.title, track.artist, track.albumTitle, getStableTrackIdentity(track))
            };
            entry._searchIndex = createSearchIndex({
                title: entry.title,
                artist: [entry.artist, track.albumArtist || ''],
                album: entry.albumTitle,
                genre: entry.genre,
                year: entry.year,
                path: [track.path || '', track.fileName || '', track._handleKey || '']
            });
            return entry;
        });

        const albumResults = LIBRARY_ALBUMS.map((album, i) => {
            const tracks = Array.isArray(album.tracks) ? album.tracks : [];
            const albumArtist = getAlbumPrimaryArtistName(album, album.artist);
            const genreValues = uniqueSearchValues([
                album.genre || '',
                tracks.map((track) => track.genre || '')
            ]);
            const entry = {
                title: album.title || 'Unknown Album',
                subtitle: `${albumArtist || ARTIST_NAME} - ${Number(album.trackCount || tracks.length || 0)} tracks`,
                artist: albumArtist || ARTIST_NAME,
                albumTitle: album.title || 'Unknown Album',
                year: album.year || '',
                tracks: tracks.slice(),
                trackCount: Number(album.trackCount || tracks.length || 0),
                genre: album.genre || genreValues[0] || '',
                type: 'albums',
                plays: tracks.reduce((total, track) => total + Number(track.plays || 0), 0),
                duration: getAlbumTotalDurationSeconds(album),
                added: Math.max(1, totalAlbums - i),
                artUrl: album.artUrl || tracks.find((track) => track.artUrl)?.artUrl || '',
                action: () => navToAlbum(album.title, album.artist, getAlbumSourceIdentity(album))
            };
            entry._searchIndex = createSearchIndex({
                title: entry.title,
                artist: [entry.artist, album.artist || '', album.albumArtist || ''],
                tracks: tracks.map((track) => track.title || ''),
                genre: genreValues,
                year: entry.year,
                path: [album.path || '', album.subDir || '']
            });
            return entry;
        });

        const artistResults = LIBRARY_ARTISTS.map((artist, i) => {
            const artistName = artist.name || ARTIST_NAME;
            const artistKey = toArtistKey(artistName);
            const albums = albumsByArtistKey.get(artistKey) || [];
            const tracks = tracksByArtistKey.get(artistKey) || [];
            const entry = {
                title: artistName,
                subtitle: `Artist - ${Number(artist.albumCount || albums.length || 0)} albums`,
                artist: artistName,
                name: artistName,
                albumCount: Number(artist.albumCount || albums.length || 0),
                trackCount: Number(artist.trackCount || tracks.length || 0),
                type: 'artists',
                plays: Number(artist.plays || tracks.reduce((total, track) => total + Number(track.plays || 0), 0)),
                duration: 0,
                added: Math.max(1, LIBRARY_ARTISTS.length - i),
                artUrl: artist.artUrl || albums.find((album) => album.artUrl)?.artUrl || tracks.find((track) => track.artUrl)?.artUrl || fallbackArtistArt,
                action: () => routeToArtistProfile(artistName)
            };
            entry._searchIndex = createSearchIndex({
                title: entry.title,
                albums: albums.map((album) => album.title || ''),
                tracks: tracks.map((track) => track.title || ''),
                genre: uniqueSearchValues(tracks.map((track) => track.genre || ''))
            });
            return entry;
        });

        SEARCH_DATA = [
            ...songResults,
            ...albumResults,
            ...artistResults
        ];
    }

    async function syncLibraryFromMediaState() {
        if (scannedFiles.length > 0) {
            if (fileHandleCache.size === 0) {
                // Keep stale caches out of view until handles can be rebuilt or user rescans.
                hydrateLibraryData();
                resetPlaybackState();
                renderHomeSections();
                renderLibraryViews();
                syncEmptyState();
                updatePlaybackHealthWarnings();
                return;
            }
            await mergeScannedIntoLibrary();
            return;
        }
        if (fileHandleCache.size > 0) {
            await mergeScannedIntoLibrary();
            return;
        }
        clearDemoMarkup();
        hydrateLibraryData();
        resetPlaybackState();
        renderHomeSections();
        renderLibraryViews();
        syncEmptyState();
        updatePlaybackHealthWarnings();
    }

    let activeLibraryScanOperation = null;
    let nextLibraryScanOperationId = 0;

    function snapshotStructuralSignature(albums) {
        return JSON.stringify((Array.isArray(albums) ? albums : []).map((album) => ({
            albumKey: getAlbumIdentityKey(album),
            tracks: (Array.isArray(album?.tracks) ? album.tracks : []).map((track) => trackKey(track?.title, track?.artist))
        })));
    }
    function isLibrarySnapshotStructurallyDifferent(albums) {
        return snapshotStructuralSignature(albums) !== libraryStructureSignature;
    }

    function beginLibraryScanOperation() {
        if (activeLibraryScanOperation) {
            activeLibraryScanOperation.canceled = true;
            revokeUrlSet(activeLibraryScanOperation.createdBlobUrls);
        }
        const operation = {
            id: ++nextLibraryScanOperationId,
            canceled: false,
            createdBlobUrls: new Set(),
            lastCommitAt: Date.now()
        };
        activeLibraryScanOperation = operation;
        return operation;
    }

    function isLibraryScanActive(operation) {
        return Boolean(operation && !operation.canceled && activeLibraryScanOperation === operation);
    }

    function ensureLibraryScanActive(operation) {
        if (!isLibraryScanActive(operation)) {
            throw new Error('__AURALIS_SCAN_CANCELED__');
        }
    }

    function finishLibraryScanOperation(operation) {
        if (activeLibraryScanOperation === operation) {
            activeLibraryScanOperation = null;
        }
    }

    function updateLibrarySnapshotArtworkOwnership(albums, scanOperation = null) {
        const nextUrls = collectSnapshotArtworkUrls(albums);
        librarySnapshotArtworkUrls.forEach((url) => {
            if (!nextUrls.has(url)) revokeObjectUrl(url);
        });
        librarySnapshotArtworkUrls = nextUrls;
        if (scanOperation) {
            nextUrls.forEach((url) => scanOperation.createdBlobUrls.delete(url));
        }
    }

    function sortAlbumTracks(tracks = []) {
        return tracks.slice().sort((a, b) =>
            Number(a?.discNo || 1) - Number(b?.discNo || 1)
            || Number(a?.no || 0) - Number(b?.no || 0)
            || String(a?.title || '').localeCompare(String(b?.title || ''), undefined, { sensitivity: 'base' })
        );
    }

    function getAlbumTrackIdentity(track) {
        if (track?._handleKey) return `handle:${track._handleKey}`;
        if (track?.path) return `path:${track.path}`;
        return `meta:${track?.discNo || 1}:${track?.no || 0}:${trackKey(track?.title, track?.artist)}`;
    }

    function mergeAlbumTracks(baseTracks = [], incomingTracks = []) {
        const merged = new Map();
        [...baseTracks, ...incomingTracks].forEach((track) => {
            if (!track) return;
            const key = getAlbumTrackIdentity(track);
            const existing = merged.get(key);
            if (!existing) {
                merged.set(key, track);
                return;
            }
            if (!existing.artUrl && track.artUrl) existing.artUrl = track.artUrl;
            if (!existing.durationSec && track.durationSec) existing.durationSec = track.durationSec;
            if ((!existing.duration || existing.duration === '--:--') && track.duration) existing.duration = track.duration;
            if (!existing.albumArtist && track.albumArtist) existing.albumArtist = track.albumArtist;
            if (!existing.year && track.year) existing.year = track.year;
            if (!existing.genre && track.genre) existing.genre = track.genre;
        });
        return sortAlbumTracks(Array.from(merged.values()));
    }

    function splitAlbumsBySourceIdentity(albums = []) {
        const result = [];
        (Array.isArray(albums) ? albums : []).forEach((album) => {
            const tracks = Array.isArray(album?.tracks) ? album.tracks : [];
            if (!album || !tracks.length || !album._scanned) {
                if (album) result.push(album);
                return;
            }
            const groups = new Map();
            tracks.forEach((track) => {
                const sourceId = getTrackSourceAlbumIdentity(track, album) || getAlbumSourceIdentity(album) || album.id || '';
                if (!groups.has(sourceId)) {
                    groups.set(sourceId, {
                        sourceId,
                        sourceTitle: getTrackSourceAlbumTitle(track, album._sourceAlbumTitle || album.title),
                        tracks: []
                    });
                }
                groups.get(sourceId).tracks.push(track);
            });
            if (groups.size <= 1) {
                const sourceId = getAlbumSourceIdentity(album) || groups.keys().next().value || album.id || '';
                const sourceTitle = album._sourceAlbumTitle || groups.values().next().value?.sourceTitle || album.title;
                album._sourceAlbumId = sourceId;
                album._sourceAlbumTitle = sourceTitle;
                tracks.forEach((track) => {
                    track._sourceAlbumId = sourceId;
                    track._sourceAlbumTitle = sourceTitle;
                });
                result.push(album);
                return;
            }
            groups.forEach((group, index) => {
                const sourceTitle = group.sourceTitle || album.title;
                const clone = {
                    ...album,
                    id: group.sourceId || `${album.id || 'album'}__source${index}`,
                    _sourceAlbumId: group.sourceId || `${album.id || 'album'}__source${index}`,
                    _sourceAlbumTitle: sourceTitle,
                    title: isGenericAlbumSourceTitle(sourceTitle) ? album.title : sourceTitle,
                    tracks: group.tracks
                };
                clone.tracks.forEach((track) => {
                    track._sourceAlbumId = clone._sourceAlbumId;
                    track._sourceAlbumTitle = clone._sourceAlbumTitle;
                    if (!isGenericAlbumSourceTitle(clone._sourceAlbumTitle)) track.albumTitle = clone._sourceAlbumTitle;
                });
                clone.trackCount = clone.tracks.length;
                clone.totalDurationLabel = toLibraryDurationTotal(clone.tracks);
                result.push(clone);
            });
        });
        return result;
    }

    function mergeAlbumsByIdentity(albums = []) {
        const mergedAlbums = new Map();
        splitAlbumsBySourceIdentity(albums).forEach((album) => {
            // Retroactively repair placeholder album.artist / album.title that may be
            // stale from the IDB cache (pre-fix scans) or from untagged root-level files.

            // 1. Fix album.artist from majority of non-placeholder track artists.
            if (isLikelyPlaceholderArtist(album.artist) && Array.isArray(album.tracks) && album.tracks.length) {
                const realArtists = album.tracks.map(t => String(t.artist || '').trim()).filter(a => a && !isLikelyPlaceholderArtist(a));
                if (realArtists.length) {
                    album.artist = majorityVote(realArtists) || album.artist;
                }
            }

            // 2. Fix album.title from majority of valid track albumTitles.
            // Only update when we actually find real non-placeholder titles from the tracks.
            // Never overwrite track.albumTitle with 'Unknown Album' — that corrupts the
            // data before pass-2 can set the real value from embedded tags.
            const albumTitleIsBad = !album.title || album.title === 'Unknown Album' || isLikelyPlaceholderArtist(album.title);
            if (albumTitleIsBad && Array.isArray(album.tracks) && album.tracks.length) {
                const sourceTitleHint = String(album._sourceAlbumTitle || '').trim();
                if (sourceTitleHint && !isGenericAlbumSourceTitle(sourceTitleHint)) {
                    album.title = sourceTitleHint;
                    album.tracks.forEach((t) => {
                        if (!t._embeddedAlbumTitle) t.albumTitle = sourceTitleHint;
                    });
                }
                const realTitles = album.tracks.map(t => String(t.albumTitle || '').trim())
                    .filter(v => v && v !== 'Unknown Album' && !isLikelyPlaceholderArtist(v));
                const resolved = majorityVote(realTitles);
                if (resolved) {
                    album.title = resolved;
                    album.tracks.forEach(t => { t.albumTitle = resolved; });
                }
                // If no real title found, leave album.title and track.albumTitle as-is —
                // pass-2 embedded tag reading will overwrite them with real values.
            }

            if (album.title && album.title !== 'Unknown Album' && Array.isArray(album.tracks)) {
                album.tracks.forEach((t) => {
                    if ((!t.albumTitle || t.albumTitle === 'Unknown Album') && !t._embeddedAlbumTitle) {
                        t.albumTitle = album.title;
                    }
                });
            }

            const hintedArtist = inferArtistFromAlbumHints(album);
            const albumArtistLooksBad = isLikelyPlaceholderArtist(album.artist)
                || isSuspiciousAlbumMirrorArtist(album.artist, album.title);
            if (hintedArtist && albumArtistLooksBad) {
                album.artist = hintedArtist;
            }

            // 2b. Repair album.year from track years if the album has no year yet.
            if (!album.year && Array.isArray(album.tracks) && album.tracks.length) {
                const years = album.tracks.map(t => String(t.year || '').trim()).filter(y => y);
                const resolvedYear = majorityVote(years);
                if (resolvedYear) album.year = resolvedYear;
            }

            // 3. Propagate resolved album.artist to tracks whose artist is still a
            //    placeholder (e.g. inherited "Music" from the root folder name).
            if (!isLikelyPlaceholderArtist(album.artist) && Array.isArray(album.tracks)) {
                album.tracks.forEach(t => {
                    const trackArtistLooksBad = isLikelyPlaceholderArtist(t.artist)
                        || isSuspiciousAlbumMirrorArtist(t.artist, t.albumTitle || album.title);
                    if (trackArtistLooksBad) t.artist = album.artist;
                });
            }

            album.tracks = sortAlbumTracks(Array.isArray(album.tracks) ? album.tracks : []);
            album.trackCount = album.tracks.length;
            album.totalDurationLabel = toLibraryDurationTotal(album.tracks);
            if (album.tracks.length && typeof finaliseAlbumArtist === 'function') {
                finaliseAlbumArtist(album, album.tracks);
            }

            const identityKey = getAlbumMergeIdentityKey(album, album.artist);
            const existingAlbum = mergedAlbums.get(identityKey);
            if (!existingAlbum) {
                mergedAlbums.set(identityKey, album);
                return;
            }

            existingAlbum.tracks = mergeAlbumTracks(existingAlbum.tracks, album.tracks);
            existingAlbum.trackCount = existingAlbum.tracks.length;
            existingAlbum.totalDurationLabel = toLibraryDurationTotal(existingAlbum.tracks);
            if (!existingAlbum.artUrl && album.artUrl) existingAlbum.artUrl = album.artUrl;
            if (!existingAlbum.year && album.year) existingAlbum.year = album.year;
            if (!existingAlbum.genre && album.genre) existingAlbum.genre = album.genre;
            if (isLikelyPlaceholderArtist(existingAlbum.artist) && !isLikelyPlaceholderArtist(album.artist)) {
                existingAlbum.artist = album.artist;
            }
            if ((!existingAlbum.albumArtist || isLikelyPlaceholderArtist(existingAlbum.albumArtist)) && album.albumArtist) {
                existingAlbum.albumArtist = album.albumArtist;
            }
            if (existingAlbum.tracks.length && typeof finaliseAlbumArtist === 'function') {
                finaliseAlbumArtist(existingAlbum, existingAlbum.tracks);
            }
        });
        return Array.from(mergedAlbums.values());
    }

    function buildLibrarySnapshotIndexes(albums = LIBRARY_ALBUMS) {
        const snapshotAlbums = mergeAlbumsByIdentity(albums);
        const nextAlbumByTitle = new Map();
        const nextAlbumByIdentity = new Map();
        const nextAlbumBySourceId = new Map();
        const nextTrackByKey = new Map();
        const nextTrackByStableId = new Map();
        const nextTrackLegacyKeyCounts = new Map();
        const nextTracks = [];

        snapshotAlbums.forEach((album) => {
            const titleKey = albumKey(album.title);
            if (titleKey && !nextAlbumByTitle.has(titleKey)) nextAlbumByTitle.set(titleKey, album);
            if (!nextAlbumByIdentity.has(getAlbumIdentityKey(album, album.artist))) {
                nextAlbumByIdentity.set(getAlbumIdentityKey(album, album.artist), album);
            }
            const sourceId = getAlbumSourceIdentity(album);
            if (sourceId) nextAlbumBySourceId.set(sourceId, album);
            album.tracks = sortAlbumTracks(Array.isArray(album.tracks) ? album.tracks : []);
            album.trackCount = album.tracks.length;
            album.totalDurationLabel = toLibraryDurationTotal(album.tracks);

            (Array.isArray(album.tracks) ? album.tracks : []).forEach((track) => {
                // Apply user metadata overrides before indexing
                if (typeof applyMetadataOverride === 'function') applyMetadataOverride(track);
                track._trackId = getStableTrackIdentity(track);
                nextTracks.push(track);
                const key = trackKey(track.title, track.artist);
                nextTrackLegacyKeyCounts.set(key, Number(nextTrackLegacyKeyCounts.get(key) || 0) + 1);
                if (!nextTrackByKey.has(key)) nextTrackByKey.set(key, track);
                if (track._trackId && !nextTrackByStableId.has(track._trackId)) nextTrackByStableId.set(track._trackId, track);
            });
        });

        // Build artist index keyed by track.artist — each track contributes to
        // its own artist profile. albumArtist / compilation flags are intentionally
        // ignored here so that tracks never accumulate under "Various Artists" or
        // a folder-derived placeholder like "Music".
        const artistMap = new Map();
        snapshotAlbums.forEach((album) => {
            (Array.isArray(album.tracks) ? album.tracks : []).forEach((track) => {
                const artistName = String(track.artist || '').trim() || album.artist || ARTIST_NAME;
                if (isLikelyPlaceholderArtist(artistName)) return;
                const key = toArtistKey(artistName);
                if (!key) return;
                if (!artistMap.has(key)) {
                    artistMap.set(key, {
                        name: artistName,
                        artUrl: '',
                        trackCount: 0,
                        albumSet: new Set(),
                        plays: 0,
                        lastPlayedDays: 999
                    });
                }
                const meta = artistMap.get(key);
                meta.trackCount += 1;
                meta.albumSet.add(track.albumTitle || album.title);
                meta.plays += Number(track.plays || 0);
                meta.lastPlayedDays = Math.min(meta.lastPlayedDays, Number(track.lastPlayedDays || 999));
                if (!meta.artUrl && (track.artUrl || album.artUrl)) meta.artUrl = track.artUrl || album.artUrl;
            });
        });

        const nextArtists = Array.from(artistMap.values()).map((artist) => ({
            name: artist.name,
            artUrl: artist.artUrl,
            trackCount: artist.trackCount,
            albumCount: artist.albumSet.size,
            plays: artist.plays,
            lastPlayedDays: artist.lastPlayedDays
        })).sort((a, b) => b.plays - a.plays);

        const nextArtistByKey = new Map();
        nextArtists.forEach((artist) => nextArtistByKey.set(toArtistKey(artist.name), artist));

        const nextPlaylists = [];
        const nextPlaylistById = new Map();

        return {
            albums: snapshotAlbums,
            tracks: nextTracks,
            artists: nextArtists,
            playlists: nextPlaylists,
            albumByTitle: nextAlbumByTitle,
            albumByIdentity: nextAlbumByIdentity,
            albumBySourceId: nextAlbumBySourceId,
            trackByKey: nextTrackByKey,
            trackByStableId: nextTrackByStableId,
            trackLegacyKeyCounts: nextTrackLegacyKeyCounts,
            artistByKey: nextArtistByKey,
            playlistById: nextPlaylistById
        };
    }

    function commitLibrarySnapshot(snapshot) {
        LIBRARY_ALBUMS = snapshot.albums;
        LIBRARY_TRACKS = snapshot.tracks;
        LIBRARY_ARTISTS = snapshot.artists;
        LIBRARY_PLAYLISTS = snapshot.playlists;
        albumByTitle.clear();
        snapshot.albumByTitle.forEach((value, key) => albumByTitle.set(key, value));
        albumByIdentity.clear();
        snapshot.albumByIdentity.forEach((value, key) => albumByIdentity.set(key, value));
        albumBySourceId.clear();
        snapshot.albumBySourceId.forEach((value, key) => albumBySourceId.set(key, value));
        trackByKey.clear();
        snapshot.trackByKey.forEach((value, key) => trackByKey.set(key, value));
        trackByStableId.clear();
        snapshot.trackByStableId.forEach((value, key) => trackByStableId.set(key, value));
        trackLegacyKeyCounts.clear();
        snapshot.trackLegacyKeyCounts.forEach((value, key) => trackLegacyKeyCounts.set(key, value));
        artistByKey.clear();
        snapshot.artistByKey.forEach((value, key) => artistByKey.set(key, value));
        playlistById.clear();
        snapshot.playlistById.forEach((value, key) => playlistById.set(key, value));
        rebuildSearchData();
        libraryStructureSignature = snapshotStructuralSignature(snapshot.albums);
        if (typeof scheduleCanonicalLibraryBackendSync === 'function') {
            scheduleCanonicalLibraryBackendSync('commitLibrarySnapshot');
        }
    }

    function installLibrarySnapshot(albums, options = {}) {
        const {
            scanOperation = null,
            resetPlayback = false,
            renderHome = false,
            renderLibrary = false,
            syncEmpty = false,
            updateHealth = false,
            force = false
        } = options;
        const changed = force || isLibrarySnapshotStructurallyDifferent(albums);
        const snapshot = buildLibrarySnapshotIndexes(albums);
        commitLibrarySnapshot(snapshot);
        updateLibrarySnapshotArtworkOwnership(snapshot.albums, scanOperation);
        if (changed) setLibraryRenderDirty(true);
        if (resetPlayback) resetPlaybackState();
        else if (reconcilePlaybackStateWithLibrary()) renderQueue();
        if (renderHome) renderHomeSections();
        if (renderLibrary) renderLibraryViews();
        if (syncEmpty) syncEmptyState();
        if (updateHealth) updatePlaybackHealthWarnings();
        // If the user is currently viewing an album detail screen, refresh it so
        // structural changes (e.g. regroupAlbumsByTag splitting tracks) are visible
        // without requiring a manual navigation away and back.
        if (changed && activeId === 'album_detail' && viewedAlbumTitle) {
            const refreshed = resolveAlbumMeta(viewedAlbumTitle, viewedAlbumArtist || '');
            if (refreshed) renderAlbumDetail(refreshed);
        }
        return changed;
    }

    async function mergeScannedIntoLibrary() {
        if (fileHandleCache.size === 0 && scannedFiles.length === 0) return;
        const scanOperation = beginLibraryScanOperation();
        try {
        if (DEBUG) console.log('[Auralis] mergeScannedIntoLibrary (two-pass): scannedFiles=' + scannedFiles.length + ', fileHandleCache=' + fileHandleCache.size + ', artHandleCache=' + artHandleCache.size);
        updateLibraryScanProgress('indexing', {
            processed: 0,
            total: Math.max(scannedFiles.length, fileHandleCache.size),
            percent: 8,
            countText: `${Math.max(scannedFiles.length, fileHandleCache.size)} files queued`
        });

        // Group scanned files by subdirectory (each subfolder = an album)
        const folderMap = new Map();
        for (const folder of mediaFolders) {
            folderMap.set(folder.id, folder);
        }

        const albumMap = new Map(); // folderId + relative subDir → album grouping
        for (const file of scannedFiles) {
            const normalizedDir = normalizeRelativeDir(file.subDir);
            const groupKey = normalizedDir ? `${file.folderId}::${normalizedDir}` : String(file.folderId);
            if (!albumMap.has(groupKey)) {
                const folder = folderMap.get(file.folderId);
                albumMap.set(groupKey, {
                    albumName: getAlbumFolderName(file.subDir, folder ? folder.name : 'Unknown Folder'),
                    parentFolderName: getAlbumParentName(file.subDir, folder ? folder.name : ''),
                    artKey: getArtCacheKey(file.folderId, file.subDir),
                    files: []
                });
            }
            albumMap.get(groupKey).files.push(file);
        }

        // Fallback: if scannedFiles empty but handles exist (boot rebuild without IDB scanned files)
        if (albumMap.size === 0 && fileHandleCache.size > 0) {
            albumMap.set('_handles', {
                albumName: mediaFolders.length > 0 ? mediaFolders[0].name : 'Music',
                parentFolderName: '',
                files: (Array.from(fileHandleCache.keys()).filter((key) => key.includes('::')).length > 0
                    ? Array.from(fileHandleCache.keys()).filter((key) => key.includes('::'))
                    : Array.from(fileHandleCache.keys())
                ).map((cacheKey) => ({
                    name: cacheKey.includes('::') ? cacheKey.split('::').pop() : cacheKey,
                    folderId: '_handles',
                    subDir: '',
                    size: 0,
                    type: 'audio/' + ((cacheKey.includes('::') ? cacheKey.split('::').pop() : cacheKey).split('.').pop() || 'unknown'),
                    lastModified: Date.now()
                }))
            });
        }

        if (DEBUG) console.log('[Auralis] Album groups found:', albumMap.size, Array.from(albumMap.keys()));

        // ── PASS 1: Build placeholder albums from filenames only (no file I/O) ──
        const newAlbums = [];
        let trackIdx = 0;
        for (const [groupKey, group] of albumMap) {
                const sorted = group.files.slice().sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
            );
            const sourceAlbumId = '_scanned_' + groupKey;
            const sourceAlbumTitle = group.albumName;
            const parentGuess = String(group.parentFolderName || '').trim();
            let artistGuess = isLikelyPlaceholderArtist(parentGuess)
                ? group.albumName
                : (parentGuess || group.albumName);
            // When the best guess is still a placeholder (e.g. files at the root of the
            // "Music" folder), default to ARTIST_NAME rather than polluting with the
            // folder name.  Real artist tags from metadata will overwrite this in pass 2.
            if (isLikelyPlaceholderArtist(artistGuess)) artistGuess = ARTIST_NAME;
            const tracks = [];
            for (let idx = 0; idx < sorted.length; idx++) {
                const file = sorted[idx];
                const parsed = parseTrackFilename(file.name);
                const ext = file.name.split('.').pop().toLowerCase();
                const handleKey = getScannedFileHandleKey(file) || file.name.toLowerCase();
                trackIdx++;
                const track = {
                    no:             parsed.no || (idx + 1),
                    title:          parsed.title,
                    artist:         parsed.parsedArtist || artistGuess,
                    albumTitle:     group.albumName,
                    year:           '',
                    genre:          '',
                    duration:       '--:--',
                    durationSec:    0,
                    ext,
                    artUrl:         '',
                    fileUrl:        '',
                    path:           normalizeRelativeDir(file.subDir)
                                        ? normalizeRelativeDir(file.subDir) + '/' + file.name
                                        : file.name,
                    _fileSize:      Number(file.size || 0),
                    _lastModified:  Number(file.lastModified || 0),
                    plays:          100 + trackIdx,
                    addedRank:      1000 + trackIdx,
                    lastPlayedDays: 1,
                    _scanned:       true,
                    _handleKey:     handleKey,
                    _trackId:       `handle:${handleKey}`,
                    _sourceAlbumId: sourceAlbumId,
                    _sourceAlbumTitle: sourceAlbumTitle,
                    _embeddedAlbumTitle: '',
                    _metaDone:      false,
                    _metadataSource: 'filename_guess',
                    _metadataQuality: METADATA_QUALITY.guessed
                };
                hydrateTrackDurationFromCache(track);
                tracks.push(track);
            }
            if (tracks.length === 0) continue;
            newAlbums.push({
                id:                sourceAlbumId,
                title:             group.albumName,
                artist:            artistGuess,
                year:              '',
                genre:             '',
                artUrl:            '',
                trackCount:        tracks.length,
                totalDurationLabel: toLibraryDurationTotal(tracks),
                tracks,
                _sourceAlbumId:    sourceAlbumId,
                _sourceAlbumTitle: group.albumName,
                _parentFolderName: parentGuess,
                _artKey:           group.artKey,
                _scanned:          true,
                _metaDone:         false
            });
        }

        if (newAlbums.length === 0) return;

        // Resolve sidecar album art (cover.jpg / folder.png) quickly
        updateLibraryScanProgress('artwork', {
            processed: 0,
            total: newAlbums.length,
            percent: 32,
            countText: `${newAlbums.length} albums queued`
        });
        const sidecarBlobCache = new Map();
        for (let albumIdx = 0; albumIdx < newAlbums.length; albumIdx++) {
            const album = newAlbums[albumIdx];
            ensureLibraryScanActive(scanOperation);
            updateLibraryScanProgress('artwork', {
                processed: albumIdx + 1,
                total: newAlbums.length,
                percent: 32 + Math.round(((albumIdx + 1) / Math.max(1, newAlbums.length)) * 18)
            });
            if (album._artKey && sidecarBlobCache.has(album._artKey)) {
                const cachedUrl = sidecarBlobCache.get(album._artKey);
                album.artUrl = cachedUrl;
                album.tracks.forEach(t => { if (!t.artUrl) t.artUrl = cachedUrl; });
                continue;
            }
            const artHandle = album._artKey ? artHandleCache.get(album._artKey) : null;
            if (!artHandle) continue;
            try {
                let artBlobUrl;
                if (artHandle._blobUrl) {
                    artBlobUrl = artHandle._blobUrl;
                } else {
                    const artFile = await artHandle.getFile();
                    artBlobUrl = URL.createObjectURL(artFile);
                    scanOperation.createdBlobUrls.add(artBlobUrl);
                }
                album.artUrl = artBlobUrl;
                album.tracks.forEach(t => { if (!t.artUrl) t.artUrl = artBlobUrl; });
                if (album._artKey) sidecarBlobCache.set(album._artKey, artBlobUrl);
                if (DEBUG) console.log('[Auralis]   Sidecar art for "' + album.title + '"');
            } catch (e) {
                console.warn('[Auralis]   Could not load sidecar art for "' + album.title + '":', e);
            }
        }

        // Install placeholder library and render UI immediately
        installLibrarySnapshot(newAlbums, {
            scanOperation,
            resetPlayback: true,
            renderHome: true,
            renderLibrary: true,
            syncEmpty: true,
            updateHealth: true,
            force: true
        });
        if (DEBUG) console.log('[Auralis] Pass 1 complete: ' + LIBRARY_ALBUMS.length + ' albums, ' + LIBRARY_TRACKS.length + ' tracks (placeholder)');

        // -- PASS 2: Background metadata + art extraction --
        const allTracks = newAlbums.flatMap(a => a.tracks);
        updateLibraryScanProgress('tags', {
            processed: 0,
            total: allTracks.length,
            percent: 52,
            countText: `${allTracks.length} tracks queued`
        });
        await backgroundMetadataPass(allTracks, newAlbums, scanOperation);

        } catch (err) {
            if (!err || err.message !== '__AURALIS_SCAN_CANCELED__') throw err;
        } finally {
            if (scanOperation.canceled) revokeUrlSet(scanOperation.createdBlobUrls);
            finishLibraryScanOperation(scanOperation);
        }
    }

    // -- Library index rebuilder (shared by pass 1 and pass 2) --

    function rebuildLibraryIndexes() {
        commitLibrarySnapshot(buildLibrarySnapshotIndexes(LIBRARY_ALBUMS));
    }

    // Majority-vote helper: most frequent non-empty string
    function majorityVote(values) {
        const counts = new Map();
        for (const v of values) {
            const s = String(v || '').trim();
            if (!s) continue;
            counts.set(s, (counts.get(s) || 0) + 1);
        }
        let best = '';
        let bestCount = 0;
        for (const [val, count] of counts) {
            if (count > bestCount) { best = val; bestCount = count; }
        }
        return best;
    }

    function inferArtistFromAlbumHints(album = {}) {
        const isUsableArtistHint = (value) => {
            const key = toArtistKey(value);
            if (!key) return false;
            return !['unknown artist', 'unknown folder', 'selected folder', 'music', 'songs', 'audio', 'downloads'].includes(key);
        };
        const albumTitleKey = toArtistKey(album.title || album._sourceAlbumTitle || '');
        const parentHint = String(album._parentFolderName || '').trim();
        if (parentHint && isUsableArtistHint(parentHint)) {
            const parentKey = toArtistKey(parentHint);
            if (parentKey && parentKey !== albumTitleKey) return parentHint;
        }

        const sourceTitle = String(album._sourceAlbumTitle || album.title || '').trim();
        if (!sourceTitle) return '';
        const sourcePatterns = [
            /^(.+?)\s+-\s+\[\d{4}\]\s+.+$/,
            /^(.+?)\s+-\s+.+$/
        ];
        for (const pattern of sourcePatterns) {
            const match = sourceTitle.match(pattern);
            const candidate = String(match?.[1] || '').trim();
            if (!candidate || !isUsableArtistHint(candidate)) continue;
            const candidateKey = toArtistKey(candidate);
            if (candidateKey && candidateKey !== albumTitleKey) return candidate;
        }
        return '';
    }

    function isSuspiciousAlbumMirrorArtist(artist, albumTitle) {
        const artistKey = toArtistKey(artist);
        const albumKeyValue = toArtistKey(albumTitle);
        return Boolean(artistKey && albumKeyValue && artistKey === albumKeyValue);
    }

    // -- Post-scan diagnostics --
    // Runs after every full scan and logs to the browser console so album
    // grouping correctness can be verified without a debugger.  Also exposes
    // window._auralisDebug for interactive inspection.
    function runPostScanDiagnostics() {
        try {
            // --- Pass 1: find misplaced (embedded title ≠ album title) ---
            const misplaced = [];
            for (const album of LIBRARY_ALBUMS) {
                for (const track of album.tracks) {
                    if (track._embeddedAlbumTitle
                            && normalizeAlbumComparisonTitle(track._embeddedAlbumTitle)
                               !== normalizeAlbumComparisonTitle(album.title)) {
                        misplaced.push({ album: album.title, track: track.title, embedded: track._embeddedAlbumTitle });
                    }
                }
            }

            // --- Pass 2: find albums with duplicate disc+track combos ---
            const dupeAlbums = [];
            for (const album of LIBRARY_ALBUMS) {
                const seen = new Map();
                for (const t of album.tracks) {
                    const k = (t.discNo || 1) + ':' + (t.no || 0);
                    if (t.no) { // ignore untagged (no=0)
                        seen.set(k, (seen.get(k) || 0) + 1);
                    }
                }
                const dupes = [...seen.entries()].filter(([, n]) => n > 1);
                if (dupes.length) dupeAlbums.push({ title: album.title, dupes });
            }

            console.group('[Auralis] Post-scan album report (' + LIBRARY_ALBUMS.length + ' albums)');
            LIBRARY_ALBUMS.forEach(a => {
                const partial = a.tracks.filter(t => t._metaDone && (!t.title || !t.artist || !t.albumTitle || !t.year)).length;
                const noEmbed = a.tracks.filter(t => t._metaDone && !t._embeddedAlbumTitle).length;
                const flag = partial || noEmbed;
                const method = flag ? 'warn' : 'log';
                const src = a._sourceAlbumId || a._sourceAlbumTitle || '';
                console[method]('  [' + (flag ? '!' : 'ok') + '] ' + a.title + ' (' + a.tracks.length + ' tracks)'
                    + (flag ? ' — partial=' + partial + ' no-embed-album=' + noEmbed : '')
                    + (src ? '  src=' + src : ''));

                // Auto-print track details for flagged albums so the file paths
                // and extensions are visible without manual console commands.
                if (flag) {
                    console.group('    Track details for "' + a.title + '"');
                    a.tracks.forEach(t => {
                        const ext = (t._handleKey || '').split('.').pop().toLowerCase() || t.ext || '?';
                        const path = (t._handleKey || t.title || '(unknown)');
                        const tags = [
                            t.title ? 'T:' + t.title : 'T:—',
                            t.artist ? 'AR:' + t.artist : 'AR:—',
                            t._embeddedAlbumTitle ? 'AL:' + t._embeddedAlbumTitle : 'AL:—',
                            t.year ? 'Y:' + t.year : 'Y:—',
                            t.no ? '#' + t.no : '#—'
                        ].join(' | ');
                        console.log('      [' + ext + '] ' + path + '\n        → ' + tags);
                    });
                    console.groupEnd();
                }
            });

            if (dupeAlbums.length) {
                console.warn('[Auralis] Albums with duplicate track numbers (likely merged from multiple source albums):');
                dupeAlbums.forEach(d => console.warn('    "' + d.title + '" dupes: ' + d.dupes.map(([k, n]) => 'disc:track=' + k + ' ×' + n).join(', ')));
            }

            if (misplaced.length) {
                console.warn('[Auralis] Tracks with embedded album ≠ current album (' + misplaced.length + '):');
                misplaced.forEach(m => console.warn('    "' + m.track + '" in "' + m.album + '" — embedded says "' + m.embedded + '"'));
            } else {
                console.log('[Auralis] TEST PASS: No tracks found with mismatched embedded album titles.');
            }
            console.groupEnd();

            // Expose for runtime inspection from console: window._auralisDebug.albums()
            if (typeof window !== 'undefined') {
                window._auralisDebug = {
                    albums: () => LIBRARY_ALBUMS.map(a => ({
                        title: a.title, tracks: a.tracks.length, artist: a.artist, _sourceAlbumId: a._sourceAlbumId
                    })),
                    tracksIn: (albumTitleFragment) => {
                        const frag = albumTitleFragment.toLowerCase();
                        const found = LIBRARY_ALBUMS.filter(a => a.title.toLowerCase().includes(frag));
                        return found.flatMap(a => a.tracks.map(t => ({
                            no: t.no, discNo: t.discNo, title: t.title, artist: t.artist,
                            albumTitle: t.albumTitle, _embeddedAlbumTitle: t._embeddedAlbumTitle,
                            _handleKey: t._handleKey, ext: (t._handleKey || '').split('.').pop(),
                            _metaDone: t._metaDone, _metadataQuality: t._metadataQuality
                        })));
                    },
                    misplaced: () => misplaced,
                    dupeTrackNos: () => dupeAlbums
                };
                console.log('[Auralis] Debug helpers: window._auralisDebug.albums() | .tracksIn("title") | .misplaced() | .dupeTrackNos()');
            }
        } catch (_) { /* benign: cleanup */ }
    }

    // -- Background metadata pass --
    // Reads embedded tags + art one track at a time in non-blocking batches.
    // After processing, updates album models and re-renders the UI so artwork
    // appears progressively. Persists extracted art into IndexedDB.

    async function backgroundMetadataPass(allTracks, albums, scanOperation) {
        const BATCH_SIZE = 3;
        const COMMIT_TRACK_COUNT = 12;
        const COMMIT_MAX_MS = 250;
        const YIELD_MS = 0;

        let artCacheBlobs = new Map();
        try { artCacheBlobs = await loadArtCacheIndex(); } catch (_) { /* benign: cleanup */ }

        const albumForTrack = new Map();
        for (const album of albums) {
            for (const track of album.tracks) {
                albumForTrack.set(track, album);
            }
        }

        let processed = 0;
        let artUpdated = false;
        let processedSinceCommit = 0;
        let lastAlbumCommitKey = '';
        const pendingTrackKeys = new Set();

        const commitMetadataCheckpoint = () => {
            ensureLibraryScanActive(scanOperation);
            if (!pendingTrackKeys.size && !isLibrarySnapshotStructurallyDifferent(LIBRARY_ALBUMS)) return;
            updateLibrarySnapshotArtworkOwnership(LIBRARY_ALBUMS, scanOperation);
            const structuralChanged = isLibrarySnapshotStructurallyDifferent(LIBRARY_ALBUMS);
            if (structuralChanged) {
                installLibrarySnapshot(LIBRARY_ALBUMS, {
                    scanOperation,
                    renderHome: true,
                    renderLibrary: true,
                    syncEmpty: true,
                    updateHealth: true
                });
            } else {
                pendingTrackKeys.forEach((payload) => {
                    APP_STATE.emit('library:metadata-refined', JSON.parse(payload));
                });
            }
            pendingTrackKeys.clear();
            processedSinceCommit = 0;
            scanOperation.lastCommitAt = Date.now();
        };

        for (let i = 0; i < allTracks.length; i += BATCH_SIZE) {
            const batch = allTracks.slice(i, i + BATCH_SIZE);

            for (const track of batch) {
                ensureLibraryScanActive(scanOperation);
                if (track._metaDone) continue;
                const handleKey = track._handleKey;
                if (!handleKey) { track._metaDone = true; continue; }
                const handle = fileHandleCache.get(handleKey) || fileHandleCache.get(track.title?.toLowerCase());
                if (!handle || typeof handle.getFile !== 'function') { track._metaDone = true; continue; }

                try {
                    const previousTrackKey = trackKey(track.title, track.artist);
                    const fileObj = await handle.getFile();
                    if (!fileObj) { track._metaDone = true; continue; }
                    const meta = await readEmbeddedMetadata(fileObj);
                    const hasEmbeddedTags = Boolean(
                        meta.title || meta.artist || meta.album || meta.year || meta.genre
                        || meta.trackNo || meta.albumArtist || meta.discNo
                    );

                    if (meta.title)   track.title      = meta.title;
                    if (meta.artist)  track.artist      = meta.artist;
                    if (meta.album) {
                        track.albumTitle = meta.album;
                        track._embeddedAlbumTitle = meta.album;
                    }
                    if (meta.year)    track.year         = meta.year;
                    if (meta.genre)   track.genre        = meta.genre;
                    if (meta.trackNo) track.no           = meta.trackNo;
                    if (meta.albumArtist) track.albumArtist = meta.albumArtist;
                    if (meta.discNo)  track.discNo       = meta.discNo;
                    if (meta.lyrics)  track.lyrics       = meta.lyrics;
                    if (Number.isFinite(meta.replayGainTrack)) track.replayGainTrack = meta.replayGainTrack;
                    if (Number.isFinite(meta.replayGainAlbum)) track.replayGainAlbum = meta.replayGainAlbum;

                    if (meta.artBlobUrl) {
                        track.artUrl = meta.artBlobUrl;
                        if (/^blob:/i.test(meta.artBlobUrl)) scanOperation.createdBlobUrls.add(meta.artBlobUrl);
                    } else if (!track.artUrl) {
                        const cacheKey = artCacheKey(track.artist, track.albumTitle);
                        const cachedBlob = artCacheBlobs.get(cacheKey);
                        if (cachedBlob) {
                            track.artUrl = URL.createObjectURL(cachedBlob);
                            scanOperation.createdBlobUrls.add(track.artUrl);
                        }
                    }

                    track._metaDone = true;
                    setTrackMetadataQuality(
                        track,
                        hasEmbeddedTags ? METADATA_QUALITY.embedded : METADATA_QUALITY.guessed,
                        hasEmbeddedTags ? 'embedded_tags' : 'filename_guess'
                    );
                    processed++;
                    processedSinceCommit++;
                    pendingTrackKeys.add(JSON.stringify({
                        trackKey: trackKey(track.title, track.artist),
                        previousTrackKey,
                        albumKey: albumKey(track.albumTitle)
                    }));

                    const album = albumForTrack.get(track);
                    if (album && !album.artUrl && track.artUrl) {
                        album.artUrl = track.artUrl;
                        album.tracks.forEach(t => { if (!t.artUrl) t.artUrl = track.artUrl; });
                        artUpdated = true;
                        try {
                            const resp = await fetch(track.artUrl);
                            const blob = await resp.blob();
                            putCachedArt(album.artist, album.title, blob);
                        } catch (_) { /* benign: cleanup */ }
                    }

                    const currentAlbumCommitKey = albumKey(album?.title || track.albumTitle);
                    const albumBoundary = Boolean(lastAlbumCommitKey && currentAlbumCommitKey !== lastAlbumCommitKey);
                    lastAlbumCommitKey = currentAlbumCommitKey;
                    const timeBudgetExceeded = Date.now() - scanOperation.lastCommitAt >= COMMIT_MAX_MS;
                    if (albumBoundary || processedSinceCommit >= COMMIT_TRACK_COUNT || timeBudgetExceeded) {
                        commitMetadataCheckpoint();
                    }
                } catch (e) {
                    if (DEBUG) console.warn('[Auralis] Background meta failed for', track._handleKey, e);
                    track._metaDone = true;
                }
            }

            updateLibraryScanProgress('tags', {
                processed: Math.min(i + batch.length, allTracks.length),
                total: allTracks.length,
                percent: 52 + Math.round((Math.min(i + batch.length, allTracks.length) / Math.max(1, allTracks.length)) * 28)
            });
            await new Promise(r => setTimeout(r, YIELD_MS));
        }

        // Regroup albums by embedded tags
        ensureLibraryScanActive(scanOperation);
        regroupAlbumsByTag(albums);

        if (DEBUG) console.log('[Auralis] Pass 2 complete: processed ' + processed + ' tracks, artUpdated=' + artUpdated);
        commitMetadataCheckpoint();

        // Persist library model to localStorage for instant next-boot
        saveLibraryCache();

        // ── Post-scan runtime test ──────────────────────────────────
        // Verifies album grouping correctness and surfaces misplaced tracks
        // so console output can confirm whether the fix worked.
        runPostScanDiagnostics();

        probeDurationsInBackground(allTracks);
    }

    // ── Library Model Cache ─────────────────────────────────────────
    const LIBRARY_CACHE_SCHEMA_VERSION = 4;

    function saveLibraryCache() {
        try {
            const stripped = LIBRARY_ALBUMS.filter(a => a._scanned).map(a => ({
                _cacheSchema: LIBRARY_CACHE_SCHEMA_VERSION,
                id: a.id, title: a.title, artist: a.artist, year: a.year, genre: a.genre,
                trackCount: a.trackCount, totalDurationLabel: a.totalDurationLabel,
                _sourceAlbumId: a._sourceAlbumId || getAlbumSourceIdentity(a),
                _sourceAlbumTitle: a._sourceAlbumTitle || a.title,
                tracks: a.tracks.map(t => ({
                    no: t.no, title: t.title, artist: t.artist, albumTitle: t.albumTitle,
                    year: t.year, genre: t.genre, duration: t.duration, durationSec: t.durationSec,
                    ext: t.ext, discNo: t.discNo || 0, albumArtist: t.albumArtist || '',
                    _handleKey: t._handleKey || '', _trackId: getStableTrackIdentity(t),
                    _sourceAlbumId: t._sourceAlbumId || getTrackSourceAlbumIdentity(t, a),
                    _sourceAlbumTitle: t._sourceAlbumTitle || getTrackSourceAlbumTitle(t, a._sourceAlbumTitle || a.title),
                    _embeddedAlbumTitle: t._embeddedAlbumTitle || '',
                    _fileSize: Number(t._fileSize || 0), _lastModified: Number(t._lastModified || 0),
                    _metadataSource: t._metadataSource || '', _metadataQuality: getTrackMetadataQuality(t),
                    _scanned: true, _metaDone: true
                }))
            }));
            safeStorage.setJson(STORAGE_KEYS.libraryCache, {
                schema: LIBRARY_CACHE_SCHEMA_VERSION,
                albums: stripped
            });
        } catch (_) { /* benign: cleanup */ }
    }

    function loadLibraryCache() {
        try {
            const raw = safeStorage.getJson(STORAGE_KEYS.libraryCache, null);
            const cached = Array.isArray(raw) ? raw : raw?.albums;
            const schema = Array.isArray(raw) ? 0 : Number(raw?.schema || 0);
            if (!Array.isArray(cached) || cached.length === 0) return false;
            if (schema < LIBRARY_CACHE_SCHEMA_VERSION) return false;
            for (const a of cached) {
                a._scanned = true;
                a._metaDone = true;
                if (a.tracks) a.tracks.forEach(t => {
                    t._scanned = true;
                    t._metaDone = true;
                    t.artUrl = '';
                    t._embeddedAlbumTitle = t._embeddedAlbumTitle || '';
                });
                a.artUrl = '';
            }
            installLibrarySnapshot(cached, { force: true });
            return true;
        } catch (_) { return false; }
    }

    // Derive a stable albumArtist for an album and auto-detect compilations.
    // A compilation is an album where >2 unique track-artist values exist but
    // a single Album Artist tag (or no tag at all) ties them together.
    function finaliseAlbumArtist(album, tracks) {
        const albumArtistTags = tracks.map(t => String(t.albumArtist || '').trim()).filter(Boolean);
        const majorityAlbumArtist = majorityVote(albumArtistTags);
        const uniqueTrackArtistKeys = new Set(
            tracks.map(t => toArtistKey(String(t.artist || '').trim())).filter(Boolean)
        );
        if (majorityAlbumArtist) {
            album.albumArtist = majorityAlbumArtist;
            // Compilation: tagged albumArtist differs from all/most individual artists
            album.isCompilation = uniqueTrackArtistKeys.size > 1;
        } else if (uniqueTrackArtistKeys.size > 2) {
            // Auto-detect: no albumArtist tag but clearly many contributors
            album.albumArtist    = 'Various Artists';
            album.isCompilation  = true;
        } else {
            album.albumArtist   = album.artist || '';
            album.isCompilation = false;
        }
        return album;
    }

    function regroupAlbumsByTag(albums) {
        // Normalize album tag for grouping: strip trailing punctuation so folder names
        // like "What Makes A Man Start Fires_" and embedded tags like
        // "What Makes A Man Start Fires?" collapse to the same group.
        const tagGroupKey = (title) => normalizeAlbumComparisonTitle(title);
        const trustedAlbumTitle = (album, track) => {
            const embeddedTitle = track._embeddedAlbumTitle || track.albumTitle || '';
            if (shouldPreferEmbeddedAlbumTitle(album, embeddedTitle)) return embeddedTitle;
            return album._sourceAlbumTitle || album.title || embeddedTitle;
        };

        for (let ai = albums.length - 1; ai >= 0; ai--) {
            const album = albums[ai];
            album._sourceAlbumId = album._sourceAlbumId || getAlbumSourceIdentity(album);
            album._sourceAlbumTitle = album._sourceAlbumTitle || album.title;
            const tagGroups = new Map();
            for (const track of album.tracks) {
                track._sourceAlbumId = track._sourceAlbumId || album._sourceAlbumId;
                track._sourceAlbumTitle = track._sourceAlbumTitle || album._sourceAlbumTitle;
                const tag = tagGroupKey(trustedAlbumTitle(album, track));
                if (!tagGroups.has(tag)) tagGroups.set(tag, []);
                tagGroups.get(tag).push(track);
            }
            if (tagGroups.size <= 1) {
                const realTitles1 = album.tracks.map(t => trustedAlbumTitle(album, t)).filter(v => v && v !== 'Unknown Album' && !isLikelyPlaceholderArtist(v));
                const origTitle1  = (!album.title || album.title === 'Unknown Album' || isLikelyPlaceholderArtist(album.title)) ? '' : album.title;
                album.title  = majorityVote(realTitles1) || origTitle1 || 'Unknown Album';
                album.artist = majorityVote(album.tracks.map(t => t.artist).filter(a => !isLikelyPlaceholderArtist(a))) || album.artist;
                album.year   = majorityVote(album.tracks.map(t => t.year).filter(y => y))   || album.year;
                album.genre  = majorityVote(album.tracks.map(t => t.genre).filter(g => g))  || album.genre;
                // Sync track.albumTitle to the resolved album title so the mini-player
                // and navigation stay consistent.
                album.tracks.forEach(t => { t.albumTitle = album.title; });
                finaliseAlbumArtist(album, album.tracks);
                // Sort by disc then track number
                album.tracks.sort((a, b) => (a.discNo || 1) - (b.discNo || 1) || (a.no || 999) - (b.no || 999));
                album._metaDone = true;
                continue;
            }
            let first = true;
            for (const [tag, subTracks] of tagGroups) {
                subTracks.sort((a, b) => (a.discNo || 1) - (b.discNo || 1) || (a.no || 999) - (b.no || 999));
                const subArt = subTracks.find(t => t.artUrl)?.artUrl || album.artUrl;
                if (subArt) subTracks.forEach(t => { if (!t.artUrl) t.artUrl = subArt; });
                if (first) {
                    album.tracks     = subTracks;
                    const realTitles2 = subTracks.map(t => trustedAlbumTitle(album, t)).filter(v => v && v !== 'Unknown Album' && !isLikelyPlaceholderArtist(v));
                    const origTitle2  = (!album.title || album.title === 'Unknown Album' || isLikelyPlaceholderArtist(album.title)) ? '' : album.title;
                    album.title      = majorityVote(realTitles2) || origTitle2 || 'Unknown Album';
                    album.artist     = majorityVote(subTracks.map(t => t.artist).filter(a => !isLikelyPlaceholderArtist(a))) || album.artist;
                    album.year       = majorityVote(subTracks.map(t => t.year).filter(y => y))   || album.year;
                    album.genre      = majorityVote(subTracks.map(t => t.genre).filter(g => g))  || album.genre;
                    subTracks.forEach(t => { t.albumTitle = album.title; });
                    finaliseAlbumArtist(album, subTracks);
                    album.artUrl     = subArt;
                    album.trackCount = subTracks.length;
                    album._metaDone  = true;
                    first = false;
                } else {
                    const realTitles3 = subTracks.map(t => trustedAlbumTitle(album, t)).filter(v => v && v !== 'Unknown Album' && !isLikelyPlaceholderArtist(v));
                    const origTitle3  = (!album.title || album.title === 'Unknown Album' || isLikelyPlaceholderArtist(album.title)) ? '' : album.title;
                    const subTitle = majorityVote(realTitles3) || origTitle3 || 'Unknown Album';
                    const subArtist = majorityVote(subTracks.map(t => t.artist).filter(a => !isLikelyPlaceholderArtist(a))) || album.artist;
                    const subSourceId = (album._sourceAlbumId || album.id || 'album') + '::tag::' + tag;

                    // Before creating an orphaned sub-album, check whether an existing album
                    // in the list is the real home for these tracks.  A common case: files
                    // are in the wrong folder (e.g. "My First Bells") but their embedded
                    // TALB tag says "Acoustic Blowout", while the real album folder
                    // "Minutemen - [1985] Acoustic Blowout!" is already in the list.
                    // We match when the sub-title key is a word-boundary suffix of the
                    // candidate's key (length ≥ 8 prevents spurious single-word matches).
                    const subKey = tagGroupKey(subTitle);
                    const subArtKey = toArtistKey(subArtist);
                    let mergeTarget = null;
                    if (subKey && subKey !== 'unknown album') {
                        for (let mi = 0; mi < albums.length; mi++) {
                            if (mi === ai || albums[mi] === album) continue;
                            const cand = albums[mi];
                            const cKey = tagGroupKey(cand.title || '');
                            if (!cKey) continue;
                            // Exact match or sub-title is a word-boundary suffix of candidate key
                            const exactMatch = cKey === subKey;
                            const suffixMatch = subKey.length >= 8 && (
                                cKey.endsWith(' ' + subKey) || cKey.endsWith('-' + subKey)
                            );
                            if (!exactMatch && !suffixMatch) continue;
                            // Artist check: if both sides have a known artist they must match
                            if (subArtKey && !isLikelyPlaceholderArtist(cand.artist || '')) {
                                const cArtKey = toArtistKey(cand.artist || cand.albumArtist || '');
                                if (cArtKey && cArtKey !== subArtKey) continue;
                            }
                            mergeTarget = cand;
                            break;
                        }
                    }

                    if (mergeTarget) {
                        // Absorb the misplaced sub-tracks into the existing album
                        subTracks.forEach(t => {
                            t.albumTitle      = mergeTarget.title;
                            t._sourceAlbumId  = mergeTarget._sourceAlbumId;
                            t._sourceAlbumTitle = mergeTarget._sourceAlbumTitle;
                        });
                        mergeTarget.tracks = mergeAlbumTracks(mergeTarget.tracks, subTracks);
                        mergeTarget.trackCount = mergeTarget.tracks.length;
                        mergeTarget.totalDurationLabel = toLibraryDurationTotal(mergeTarget.tracks);
                        if (!mergeTarget.artUrl && subArt) mergeTarget.artUrl = subArt;
                        finaliseAlbumArtist(mergeTarget, mergeTarget.tracks);
                        if (DEBUG) console.log('[Auralis] regroupAlbumsByTag: merged ' + subTracks.length + ' tracks from "' + album.title + '" into existing "' + mergeTarget.title + '"');
                    } else {
                        subTracks.forEach(t => {
                            t.albumTitle = subTitle;
                            t._sourceAlbumId = subSourceId;
                            t._sourceAlbumTitle = subTitle;
                        });
                        const subAlbum = {
                            id:                album.id + '__sub' + albums.length,
                            title:             subTitle,
                            artist:            subArtist,
                            year:              majorityVote(subTracks.map(t => t.year).filter(y => y))   || '',
                            genre:             majorityVote(subTracks.map(t => t.genre).filter(g => g))  || '',
                            artUrl:            subArt,
                            trackCount:        subTracks.length,
                            totalDurationLabel: toLibraryDurationTotal(subTracks),
                            tracks:            subTracks,
                            _sourceAlbumId:     subSourceId,
                            _sourceAlbumTitle:  subTitle,
                            _artKey:           album._artKey,
                            _scanned:          true,
                            _metaDone:         true
                        };
                        finaliseAlbumArtist(subAlbum, subTracks);
                        albums.push(subAlbum);
                        if (DEBUG) console.log('[Auralis] regroupAlbumsByTag: created sub-album "' + subTitle + '" from "' + album.title + '" (' + subTracks.length + ' tracks)');
                    }
                }
            }
        }

        // ── Second pass: dupe-track-number split ─────────────────────────────
        // When an album ends up with duplicate disc+track numbers, it likely
        // contains physically co-located files from two different albums: some
        // with embedded album tags and some without. Separate the untagged
        // tracks into their own "Unknown Album" group so the user can correct
        // them via the metadata editor rather than having them silently mixed in.
        for (let ai = albums.length - 1; ai >= 0; ai--) {
            const album = albums[ai];
            if (!album || !album._scanned || !Array.isArray(album.tracks) || album.tracks.length < 2) continue;

            // Detect duplicate disc+track number combos
            const seenNums = new Map();
            for (const t of album.tracks) {
                if (!t.no) continue;
                const k = (t.discNo || 1) + ':' + t.no;
                seenNums.set(k, (seenNums.get(k) || 0) + 1);
            }
            if (![...seenNums.values()].some(n => n > 1)) continue; // no dupes

            // Split into tracks that have an embedded album title vs those that don't
            const hasTag = album.tracks.filter(t => t._embeddedAlbumTitle && normalizeAlbumComparisonTitle(t._embeddedAlbumTitle));
            const noTag  = album.tracks.filter(t => !t._embeddedAlbumTitle || !normalizeAlbumComparisonTitle(t._embeddedAlbumTitle));

            if (!hasTag.length || !noTag.length) continue; // must be a clean tagged/untagged split

            // Keep tagged tracks in the main album
            album.tracks     = sortAlbumTracks(hasTag);
            album.trackCount = hasTag.length;
            album.totalDurationLabel = toLibraryDurationTotal(hasTag);
            finaliseAlbumArtist(album, hasTag);

            // Derive a meaningful title for the orphan group
            const orphanArtist = majorityVote(noTag.map(t => t.artist).filter(a => !isLikelyPlaceholderArtist(a))) || album.artist;
            const orphanTitle  = (orphanArtist && !isLikelyPlaceholderArtist(orphanArtist))
                ? orphanArtist + ' \u2014 Unknown Album'
                : 'Unknown Album';
            const orphanSourceId = (album._sourceAlbumId || album.id || 'album') + '::untagged';
            const orphanArt = noTag.find(t => t.artUrl)?.artUrl || '';

            noTag.forEach(t => {
                t.albumTitle          = orphanTitle;
                t._embeddedAlbumTitle = '';
                t._sourceAlbumId      = orphanSourceId;
                t._sourceAlbumTitle   = orphanTitle;
            });

            const orphanAlbum = {
                id:                 album.id + '__untagged',
                title:              orphanTitle,
                artist:             orphanArtist || album.artist,
                year:               '',
                genre:              majorityVote(noTag.map(t => t.genre).filter(g => g)) || '',
                artUrl:             orphanArt,
                trackCount:         noTag.length,
                totalDurationLabel: toLibraryDurationTotal(noTag),
                tracks:             sortAlbumTracks(noTag),
                _sourceAlbumId:      orphanSourceId,
                _sourceAlbumTitle:   orphanTitle,
                _artKey:            album._artKey,
                _scanned:           true,
                _metaDone:          true
            };
            finaliseAlbumArtist(orphanAlbum, noTag);
            albums.push(orphanAlbum);
            if (DEBUG) console.log('[Auralis] regroupAlbumsByTag [dupe-split]: moved ' + noTag.length + ' untagged tracks out of "' + album.title + '" → "' + orphanTitle + '"');
        }

        LIBRARY_ALBUMS = albums;
    }

    // Background duration probing via hidden Audio element
    async function probeDurationsInBackground(tracks, options = {}) {
        if (!tracks || tracks.length === 0) return { changedCount: 0, failedCount: 0, skippedCount: 0 };
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        let failedCount = 0;
        let changedCount = 0;
        let skippedCount = 0;
        let processedCount = 0;
        updateLibraryScanProgress('durations', {
            processed: 0,
            total: tracks.length,
            percent: 82,
            countText: `${tracks.length} tracks queued`
        });

        for (const track of tracks) {
            processedCount++;
            if (hydrateTrackDurationFromCache(track) > 0) {
                syncTrackDurationElements(track);
                if (processedCount % 8 === 0 || processedCount === tracks.length) {
                    updateLibraryScanProgress('durations', {
                        processed: processedCount,
                        total: tracks.length,
                        percent: 82 + Math.round((processedCount / Math.max(1, tracks.length)) * 16)
                    });
                }
                continue;
            }
            if (!canProbeTrackDuration(track, options)) {
                skippedCount++;
                syncTrackDurationElements(track);
                if (processedCount % 8 === 0 || processedCount === tracks.length) {
                    updateLibraryScanProgress('durations', {
                        processed: processedCount,
                        total: tracks.length,
                        percent: 82 + Math.round((processedCount / Math.max(1, tracks.length)) * 16)
                    });
                }
                continue;
            }
            const handleKey = track._handleKey;
            if (!handleKey) {
                recordDurationProbeFailure(track, 'No file handle available for duration probe');
                syncTrackDurationElements(track);
                failedCount++;
                continue;
            }

            let blobUrl = null;
            let createdBlob = false;

            try {
                if (blobUrlCache.has(handleKey)) {
                    blobUrl = blobUrlCache.get(handleKey);
                } else if (fileHandleCache.has(handleKey)) {
                    const handle = fileHandleCache.get(handleKey);
                    if (handle && handle._blobUrl) {
                        blobUrl = handle._blobUrl;
                    } else if (handle && typeof handle.getFile === 'function') {
                        const file = await handle.getFile();
                        blobUrl = URL.createObjectURL(file);
                        createdBlob = true;
                    }
                } else {
                    recordDurationProbeFailure(track, 'No cached file source available for duration probe');
                    syncTrackDurationElements(track);
                    failedCount++;
                    continue;
                }

                if (!blobUrl) {
                    recordDurationProbeFailure(track, 'No playable source available for duration probe');
                    syncTrackDurationElements(track);
                    failedCount++;
                    continue;
                }

                await new Promise((resolve) => {
                    let settled = false;
                    let timeoutId = 0;
                    const cleanup = () => {
                        if (settled) return;
                        settled = true;
                        if (timeoutId) clearTimeout(timeoutId);
                        if (createdBlob) URL.revokeObjectURL(blobUrl);
                        audio.removeEventListener('loadedmetadata', onMeta);
                        audio.removeEventListener('error', onErr);
                        audio.src = '';
                        resolve();
                    };
                    const onMeta = () => {
                        if (Number.isFinite(audio.duration) && audio.duration > 0) {
                            if (cacheTrackDuration(track, audio.duration, { persist: false })) {
                                changedCount++;
                                syncTrackDurationElements(track);
                            }
                        } else {
                            failedCount++;
                            recordDurationProbeFailure(track, 'Audio metadata loaded without a valid duration');
                            syncTrackDurationElements(track);
                        }
                        cleanup();
                    };
                    const onErr = () => {
                        failedCount++;
                        recordDurationProbeFailure(track, 'Audio element could not read duration metadata');
                        syncTrackDurationElements(track);
                        cleanup();
                    };
                    audio.addEventListener('loadedmetadata', onMeta, { once: true });
                    audio.addEventListener('error', onErr, { once: true });
                    audio.src = blobUrl;
                    audio.load();
                    timeoutId = setTimeout(() => {
                        failedCount++;
                        recordDurationProbeFailure(track, 'Duration probe timed out');
                        syncTrackDurationElements(track);
                        cleanup();
                    }, 8000);
                });
            } catch (err) {
                failedCount++;
                recordDurationProbeFailure(track, err?.message || 'Duration probe failed');
                syncTrackDurationElements(track);
                continue;
            }
            if (processedCount % 8 === 0 || processedCount === tracks.length) {
                updateLibraryScanProgress('durations', {
                    processed: processedCount,
                    total: tracks.length,
                    percent: 82 + Math.round((processedCount / Math.max(1, tracks.length)) * 16)
                });
            }
        }

        if (failedCount > 0) {
            toast(failedCount + ' track' + (failedCount > 1 ? 's' : '') + ' could not be probed for duration');
        }

        LIBRARY_ALBUMS.filter(a => a._scanned).forEach(album => {
            refreshAlbumTotalDurationLabel(album);
        });
        refreshVisibleAlbumDurationMetadata();
        if (changedCount > 0) {
            persistDurationCache();
            saveLibraryCache();
        }

        renderHomeSections();
        renderLibraryViews();
        updateLibraryScanProgress('complete', {
            processed: tracks.length,
            total: tracks.length,
            percent: 100,
            countText: `${tracks.length} tracks indexed`
        });
        return { changedCount, failedCount, skippedCount };
    }

    function applyArtBackground(el, artUrl, fallback = FALLBACK_GRADIENT) {
        if (!el) return;
        const resolvedUrl = resolveArtUrlForContext(artUrl);
        const fallbackBackground = fallback || getStableArtworkFallback(
            el.dataset?.trackId || el.dataset?.albumKey || el.dataset?.playlistId || el.dataset?.artistKey || el.textContent,
            el.dataset?.trackId ? 'track' : 'collection'
        );
        if (resolvedUrl) {
            el.style.background = '';
            el.style.backgroundImage = `linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.25)), url("${resolvedUrl}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat = 'no-repeat';
        } else if (fallbackBackground) {
            el.style.backgroundImage = '';
            el.style.background = fallbackBackground;
        }
    }

    // Lazily extract embedded artwork from the first available track handle when an
    // album card or song row renders with no stored art. Updates `item.artUrl` and
    // back-fills sibling track objects so subsequent renders are instant.
    async function lazyLoadArt(item, coverEl) {
        if (item.artUrl) return;
        // Albums: search their tracks for a handle key. Tracks: use their own.
        const handleKey = item._handleKey
            || item.tracks?.find(t => t._handleKey)?._handleKey;
        if (!handleKey) return;
        const handle = fileHandleCache.get(handleKey);
        if (!handle || typeof handle.getFile !== 'function') return;
        try {
            const file = await handle.getFile();
            if (!file) return;
            const meta = await readEmbeddedMetadata(file);
            if (!meta.artBlobUrl) return;
            item.artUrl = meta.artBlobUrl;
            // Back-fill sibling tracks so the album detail view also benefits
            if (item.tracks) item.tracks.forEach(t => { if (!t.artUrl) t.artUrl = meta.artBlobUrl; });
            applyArtBackground(coverEl, meta.artBlobUrl, FALLBACK_GRADIENT);
        } catch (_) { /* benign: cleanup */ }
    }

    function getNowPlayingArtUrl(meta = nowPlaying) {
        if (!meta) return '';
        const direct = resolveArtUrlForContext(meta.artUrl || '');
        if (direct) return direct;

        const hintedAlbum = meta.albumTitle || '';
        if (hintedAlbum) {
            const albumMeta = resolveAlbumMeta(hintedAlbum, meta.artist);
            if (albumMeta?.artUrl) {
                const albumArt = resolveArtUrlForContext(albumMeta.artUrl);
                if (albumArt) return albumArt;
            }
        }

        const keyed = trackByStableId.get(getTrackIdentityKey(meta))
            || trackByKey.get(trackKey(meta.title, meta.artist));
        const keyedArt = resolveArtUrlForContext(keyed?.artUrl || '');
        if (keyedArt) return keyedArt;

        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0 && currentIdx < queueTracks.length) {
            const queueArt = resolveArtUrlForContext(queueTracks[currentIdx]?.artUrl || '');
            if (queueArt) return queueArt;
        }
        return '';
    }

    function syncNowPlayingArt(meta = nowPlaying) {
        const artUrl = getNowPlayingArtUrl(meta);
        const fallbackArt = FALLBACK_GRADIENT;
        const fallbackBg = 'radial-gradient(ellipse at top, #302b63 0%, #0f0f0f 70%)';

        const miniArt = getEl('mini-art');
        const playerArt = getEl('player-art');
        const playerBg = getEl('player-bg');

        applyArtBackground(miniArt, artUrl, fallbackArt);
        applyArtBackground(playerArt, artUrl, fallbackArt);
        applyArtBackground(playerBg, artUrl, fallbackBg);

        if (playerArt) {
            playerArt.style.display = 'block';
            playerArt.style.opacity = '1';
        }
    }

    function getFeaturedAlbums() {
        const featured = [];
        const seen = new Set();
        LIBRARY_ALBUMS.forEach(album => {
            if (featured.length >= 8) return;
            const key = getAlbumIdentityKey(album, album.artist);
            if (seen.has(key)) return;
            seen.add(key);
            featured.push(album);
        });

        return featured;
    }
/* <<< 01-library-scan-metadata.js */

/* >>> 02-layout-favorites-hydration.js */
/*
 * Auralis JS shard: 02-layout-favorites-hydration.js
 * Purpose: home layout persistence, metadata hydration, now-playing display
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function saveHomeLayout() {
        safeStorage.setJson(HOME_LAYOUT_KEY, homeSections);
    }

    function loadHomeLayout() {
        try {
            const parsed = safeStorage.getJson(HOME_LAYOUT_KEY, null);
            if (Array.isArray(parsed) && parsed.length) {
                homeSections = parsed.map(section => ({
                    id: section.id || toSafeId(section.type || 'section'),
                    type: section.type || 'recent_activity',
                    title: section.title || 'Custom Section',
                    itemType: section.itemType || 'songs',
                    layout: section.layout || 'list',
                    density: section.density || 'compact',
                    limit: Number(section.limit || 8),
                    enabled: section.enabled !== false,
                    core: Boolean(section.core)
                }));
                if (!homeSections.some((section) => section.enabled !== false)) {
                    homeSections = getDefaultHomeSections();
                    saveHomeLayout();
                }
                return;
            }
        } catch (_) {
            // Ignore malformed local state
        }
        homeSections = getDefaultHomeSections();
        saveHomeLayout();
    }

    function resolveTrackMeta(title, artist, albumHint, trackId = '') {
        const lookupKeys = getTrackLookupKeys({ trackId, title, artist });
        let found = null;

        found = lookupKeys.map((key) => trackByStableId.get(key)).find(Boolean)
            || null;

        // Check trackByKey before album-based lookup so that locally-indexed tracks
        // (which carry the correct _trackId from installLibrarySnapshot) are always
        // preferred over canonical backend album tracks whose _trackId may be undefined.
        if (!found) {
            found = lookupKeys.map((key) => trackByKey.get(key)).find(Boolean)
                || null;
        }

        if (!found && albumHint) {
            const album = resolveAlbumMeta(albumHint, artist);
            if (album) {
                found = album.tracks.find((candidate) => (
                    lookupKeys.includes(getTrackIdentityKey(candidate))
                    || (
                        String(candidate?.title || '').trim() === String(title || '').trim()
                        && (!artist || trackKey(candidate?.title, candidate?.artist) === trackKey(title, artist))
                    )
                )) || null;
            }
        }

        if (!found) {
            found = LIBRARY_TRACKS.find((candidate) => lookupKeys.includes(getTrackIdentityKey(candidate)))
                || LIBRARY_TRACKS.find((candidate) => trackKey(candidate.title, candidate.artist) === trackKey(title, artist))
                || LIBRARY_TRACKS.find((candidate) => candidate.title === title)
                || null;
        }

        if (found) return found;

        return {
            title: title || 'Unknown Track',
            artist: artist || ARTIST_NAME,
            albumTitle: albumHint || 'Unknown Album',
            year: '',
            duration: '--:--',
            durationSec: 0,
            ext: '',
            artUrl: '',
            fileUrl: '',
            plays: 0,
            _trackId: String(trackId || '').trim()
        };
    }

    function hydrateLibraryData() {
        const rawAlbums = [];
        const hydratedAlbums = rawAlbums.map((album, albumIndex) => {
            const title = normalizeAlbumTitle(album.title || album.id || `Album ${albumIndex + 1}`);
            const artist = album.artist || ARTIST_NAME;
            const year = String(album.year || '').trim();
            const artUrl = album.artUrl || '';
            const tracks = (Array.isArray(album.tracks) ? album.tracks : []).map((track, trackIndex) => ({
                no: Number(track.no || trackIndex + 1),
                title: track.title || `Track ${trackIndex + 1}`,
                artist: track.artist || artist,
                albumTitle: title,
                year,
                genre: String(track.genre || '').trim(),
                duration: track.duration || toDurationLabel(Number(track.durationSec || 0)),
                durationSec: Number(track.durationSec || 0),
                ext: (track.ext || '').toLowerCase(),
                artUrl,
                fileUrl: track.fileUrl || '',
                path: track.path || '',
                _handleKey: track._handleKey || '',
                _trackId: track._trackId || '',
                _sourceAlbumId: track._sourceAlbumId || '',
                _sourceAlbumTitle: track._sourceAlbumTitle || '',
                _embeddedAlbumTitle: track._embeddedAlbumTitle || '',
                _fileSize: Number(track._fileSize || 0),
                _lastModified: Number(track._lastModified || 0),
                _metadataSource: track._metadataSource || '',
                _metadataQuality: track._metadataQuality || '',
                _scanned: Boolean(track._scanned),
                plays: Math.max(10, 260 - ((albumIndex * 7) + trackIndex)),
                addedRank: Math.max(1, 220 - ((albumIndex * 11) + trackIndex)),
                lastPlayedDays: ((albumIndex * 13 + trackIndex * 7) % 260) + 1
            }));

            return {
                id: album.id || title,
                title,
                artist,
                year,
                genre: String(album.genre || '').trim(),
                artUrl,
                trackCount: Number(album.trackCount || tracks.length || 0),
                totalDurationLabel: album.totalDurationLabel || toLibraryDurationTotal(tracks),
                tracks,
                _sourceAlbumId: album._sourceAlbumId || '',
                _sourceAlbumTitle: album._sourceAlbumTitle || title
            };
        }).filter(album => album.tracks.length > 0);
        installLibrarySnapshot(hydratedAlbums, { force: true });

        if (queueTracks.length === 0 || !nowPlaying) {
            resetPlaybackState();
        }
    }

    function refreshNowPlayingDisplay(meta, options = {}) {
        if (!meta) return;
        activeArtistName = meta.artist || ARTIST_NAME;

        document.querySelectorAll('.mini-title').forEach(el => { setNowPlayingMarqueeText(el, meta.title); });

        const artistIsError = meta._metaDone && isMissingMetadata(meta.artist, 'artist');
        const artistDisplay = artistIsError ? 'No Artist Tag' : meta.artist;
        document.querySelectorAll('.mini-artist').forEach(el => {
            setNowPlayingMarqueeText(el, artistDisplay);
            el.classList.toggle('metadata-error', artistIsError);
        });

        const pt = getEl('player-title') || document.querySelector('.player-titles h1');
        const pa = getEl('player-artist') || document.querySelector('.player-titles p');
        if (pt) setNowPlayingMarqueeText(pt, meta.title);
        if (pa) {
            setNowPlayingMarqueeText(pa, artistDisplay);
            pa.classList.toggle('metadata-error', artistIsError);
        }
        scheduleNowPlayingMarquee(document);

        syncNowPlayingArt(meta);

        const quality = getEl('player-quality-badge');
        const format = getEl('player-format-badge');
        const isLossless = meta.ext === 'flac' || meta.ext === 'wav';
        if (quality) quality.textContent = isLossless ? 'LOSSLESS' : 'COMPRESSED';
        if (format) format.textContent = meta.ext ? meta.ext.toUpperCase() : 'AUDIO';

        if (options.preserveProgress) {
            const engine = typeof ensureAudioEngine === 'function' ? ensureAudioEngine() : null;
            const currentSeconds = engine && Number.isFinite(engine.currentTime) ? engine.currentTime : 0;
            const durationSeconds = engine && Number.isFinite(engine.duration) && engine.duration > 0
                ? engine.duration
                : (meta.durationSec || 0);
            updateProgressUI(currentSeconds, durationSeconds);
            updateAlbumProgressLine(currentSeconds, durationSeconds);
            syncTrackActiveStates(currentSeconds, durationSeconds);
        } else {
            const elapsed = getEl('player-elapsed');
            const remaining = getEl('player-remaining');
            if (elapsed) elapsed.textContent = '0:00';
            if (remaining) remaining.textContent = meta.duration && meta.duration !== '--:--' ? `-${meta.duration}` : '--:--';
            updateAlbumProgressLine(0, meta.durationSec || 0);
            syncTrackActiveStates(0, meta.durationSec || 0);
        }
        if (options.showToast) toast(`Playing ${meta.title}`);

        // Update MediaSession metadata for OS integration
        if ('mediaSession' in navigator) {
            const artUrl = getNowPlayingArtUrl(meta);
            const artwork = artUrl ? [{ src: artUrl, sizes: '512x512', type: 'image/jpeg' }] : [];
            navigator.mediaSession.metadata = new MediaMetadata({
                title: meta.title || 'Unknown Track',
                artist: meta.artist || ARTIST_NAME,
                album: meta.albumTitle || '',
                artwork
            });
        }

        syncLikeButtons();
        if (typeof syncLyricsPanel === 'function') syncLyricsPanel(meta);
    }

    function setNowPlaying(meta, showToastMessage = true) {
        if (!meta) return;
        nowPlaying = meta;
        delete document.body.dataset.noTrack;
        const nowKey = getTrackIdentityKey(meta);
        const idx = queueTracks.findIndex((track) => getTrackIdentityKey(track) === nowKey);
        if (idx >= 0) queueIndex = idx;
        refreshNowPlayingDisplay(meta, { showToast: showToastMessage });

        // Persist queue state on track change
        persistQueue();
    }

    function normalizeCollectionKey(type, value) {
        const normalizedType = String(type || '').trim().toLowerCase();
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (normalizedType === 'album') return raw.includes('::') ? raw.toLowerCase() : albumKey(raw);
        return raw.toLowerCase();
    }
/* <<< 02-layout-favorites-hydration.js */

/* >>> 03-playback-engine.js */
/*
 * Auralis JS shard: 03-playback-engine.js
 * Purpose: collection state, progress UI, active rows, audio engine, transport controls
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function setPlaybackCollection(type, value) {
        const normalizedType = String(type || '').trim().toLowerCase();
        if (normalizedType !== 'album' && normalizedType !== 'playlist') {
            activePlaybackCollectionType = '';
            activePlaybackCollectionKey = '';
            return;
        }
        activePlaybackCollectionType = normalizedType;
        activePlaybackCollectionKey = normalizeCollectionKey(normalizedType, value);
    }

    function isCollectionActive(type, value) {
        const normalizedType = String(type || '').trim().toLowerCase();
        const normalizedKey = normalizeCollectionKey(normalizedType, value);
        if (!normalizedType || !normalizedKey) return false;
        return normalizedType === activePlaybackCollectionType && normalizedKey === activePlaybackCollectionKey;
    }

    function isCollectionPlaying(type, value) {
        if (!isPlaying) return false;
        return isCollectionActive(type, value);
    }

    function syncCollectionPlayButtons() {
        document.querySelectorAll('.catalog-play-btn').forEach((btn) => {
            const type = String(btn.dataset.collectionType || '').trim().toLowerCase();
            const key = String(btn.dataset.collectionKey || '').trim();
            const active = type && key ? isCollectionPlaying(type, key) : false;
            setPlaybackIcon(btn, active);
        });

        const albumPlay = getEl('alb-play-btn');
        if (albumPlay) {
            const active = isCollectionPlaying('album', albumPlay.dataset.collectionKey || albumIdentityKey(activeAlbumTitle, activeAlbumArtist));
            setPlaybackIcon(albumPlay, active);
        }

        const playlistPlay = getEl('playlist-play-btn');
        if (playlistPlay) {
            const active = isCollectionPlaying('playlist', playlistPlay.dataset.collectionKey || activePlaylistId);
            setPlaybackIcon(playlistPlay, active);
            if (!playlistPlay.querySelector('svg path')) {
                playlistPlay.textContent = active ? 'Pause' : 'Play';
            }
        }
    }

    function getProgressSnapshot(currentSeconds, durationSeconds) {
        const duration = Number.isFinite(durationSeconds) && durationSeconds > 0
            ? durationSeconds
            : (nowPlaying?.durationSec || 0);
        const current = Math.max(0, Number.isFinite(currentSeconds) ? currentSeconds : 0);
        const ratio = (Number.isFinite(duration) && duration > 0)
            ? Math.max(0, Math.min(1, current / duration))
            : 0;
        return {
            duration,
            current,
            ratio,
            pct: `${ratio * 100}%`,
            elapsedLabel: toDurationLabel(current),
            remainingLabel: duration > 0
                ? `-${toDurationLabel(Math.max(0, duration - current))}`
                : '--:--'
        };
    }

    function clearCrossfadeState() {
        if (!crossfadeState) return;
        try { clearInterval(crossfadeState.intervalId); } catch (_) { /* benign: cleanup */ }
        const oldEngine = crossfadeState.engine;
        if (oldEngine) {
            try { oldEngine.volume = currentVolume; } catch (_) { /* benign: cleanup */ }
        }
        crossfadeState = null;
    }

    function beginCrossfade(engine) {
        clearCrossfadeState();
        if (!engine || engine.paused) return;
        const fadeStep = 50;
        const steps = Math.max(1, Math.round((CROSSFADE_DURATION * 1000) / fadeStep));
        const startVolume = Number(engine.volume || currentVolume || 1);
        let step = 0;
        const intervalId = setInterval(() => {
            step += 1;
            try {
                engine.volume = Math.max(0, startVolume * (1 - (step / steps)));
            } catch (_) { /* benign: cleanup */ }
            if (step >= steps) {
                clearCrossfadeState();
            }
        }, fadeStep);
        crossfadeState = { engine, intervalId };
    }

    function setPlayButtonState(playing) {
        isPlaying = Boolean(playing);

        const miniIcon = getRef('mini-toggle-icon');
        const mainIcon = getRef('player-main-icon');
        if (miniIcon) setPlaybackIcon(miniIcon, isPlaying);
        if (mainIcon) setPlaybackIcon(mainIcon, isPlaying);
        const miniCardIcon = document.querySelector('#mini-play-icon path');
        if (miniCardIcon) setPlaybackIcon(miniCardIcon, isPlaying);
        syncCollectionPlayButtons();
        syncTrackStateButtons();
    }

    let _progressRafId = null;
    let _progressPending = null;
    function updateProgressUI(currentSeconds, durationSeconds) {
        _progressPending = [currentSeconds, durationSeconds];
        if (_progressRafId) return;
        _progressRafId = requestAnimationFrame(() => {
            _progressRafId = null;
            if (!_progressPending) return;
            const [cs, ds] = _progressPending;
            _progressPending = null;
            _updateProgressUIImpl(cs, ds);
        });
    }
    function _updateProgressUIImpl(currentSeconds, durationSeconds) {
        const elapsedEl = getRef('player-elapsed');
        const remainEl = getRef('player-remaining');
        const miniFill = getRef('mini-progress-fill');
        const fullFill = getRef('player-progress-fill');
        const thumb = getRef('player-progress-thumb');
        const snapshot = getProgressSnapshot(currentSeconds, durationSeconds);

        if (miniFill) miniFill.style.width = snapshot.pct;
        if (fullFill) fullFill.style.width = snapshot.pct;
        if (thumb && !isSeeking) thumb.style.left = `calc(${snapshot.pct} - 7px)`;

        if (elapsedEl) elapsedEl.textContent = snapshot.elapsedLabel;
        if (remainEl) remainEl.textContent = snapshot.remainingLabel;
        updateAlbumProgressLine(snapshot.current, snapshot.duration);
        syncTrackActiveStates(snapshot.current, snapshot.duration);

        // Gapless: pre-resolve next track URL while current track nears its end
        if (gaplessEnabled && !isSeeking && snapshot.duration > 0) {
            const remaining = Math.max(0, snapshot.duration - snapshot.current);
            if (remaining > 0 && remaining < GAPLESS_PRELOAD_SECONDS) {
                scheduleGaplessPreload(getNextQueueTrack());
            }
        }
    }

    function syncTrackActiveStates(currentSeconds, durationSeconds) {
        const titleTarget = nowPlaying ? String(nowPlaying.title).toLowerCase().trim() : '';
        const nowKey = getNowPlayingTrackKey();
        const snapshot = getProgressSnapshot(currentSeconds, durationSeconds);
        const syncSignature = [
            nowKey || titleTarget,
            Math.floor(snapshot.current),
            Math.floor(snapshot.duration),
            trackUiRegistryRevision
        ].join('|');
        if (syncSignature === activeTrackUiSyncSignature) return;
        activeTrackUiSyncSignature = syncSignature;
        const registryHandledKeys = new Set();

        if (nowKey) {
            const bindings = getTrackUiBindings(nowKey);
            if (bindings.length) {
                Array.from(trackUiRegistry.keys()).forEach((trackKeyValue) => {
                    const trackBindings = getTrackUiBindings(trackKeyValue);
                    if (!trackBindings.length) return;
                    registryHandledKeys.add(trackKeyValue);
                    trackBindings.forEach((binding) => {
                        const row = binding?.row;
                        if (row) {
                            const isActiveTrack = trackKeyValue === nowKey;
                            row.classList.toggle('playing-row', isActiveTrack);
                            row.classList.toggle('is-now-playing', isActiveTrack);
                            if (isActiveTrack) row.setAttribute('aria-current', 'true');
                            else row.removeAttribute('aria-current');
                        }
                        (binding?.durations || []).forEach((timeEl) => {
                            if (!timeEl) return;
                            if (!timeEl.dataset.originalDuration) {
                                timeEl.dataset.originalDuration = timeEl.textContent || '';
                            }
                            timeEl.textContent = trackKeyValue === nowKey
                                ? snapshot.remainingLabel
                                : (timeEl.dataset.originalDuration || '');
                        });
                    });
                });
            }
        }

        document.querySelectorAll('.item-clickable').forEach(click => {
            const row = click.closest('.list-item') || click;
            const rowTrackKey = String(row?.dataset?.trackKey || '').trim();
            if (rowTrackKey && registryHandledKeys.has(rowTrackKey)) return;

            const h3 = click.querySelector('h3');
            if(!h3) return;

            const rowTitle = h3.textContent.toLowerCase().trim();
            if (rowTitle === 'clear queue') return;
            const isPlayingRow = nowKey
                ? (rowTrackKey ? rowTrackKey === nowKey : rowTitle === titleTarget)
                : false;

            row.classList.toggle('playing-row', isPlayingRow);
            row.classList.toggle('is-now-playing', isPlayingRow);
            if (isPlayingRow) row.setAttribute('aria-current', 'true');
            else row.removeAttribute('aria-current');

            const liveRemainingLabel = isPlayingRow && snapshot.duration > 0
                ? snapshot.remainingLabel
                : '';

            row.querySelectorAll('.album-track-duration, .zenith-time-pill').forEach((timeEl) => {
                if (!timeEl.dataset.originalDuration) {
                    timeEl.dataset.originalDuration = timeEl.textContent || '';
                }
                timeEl.textContent = liveRemainingLabel || timeEl.dataset.originalDuration;
            });
        });

        // GAP 4: song/carousel cards with data-track-key but not covered by registry or item-clickable paths
        document.querySelectorAll('[data-track-key]').forEach(el => {
            if (!el.isConnected) return;
            const rowTrackKey = String(el.dataset.trackKey || '').trim();
            if (!rowTrackKey || registryHandledKeys.has(rowTrackKey)) return;
            if (el.querySelector('.item-clickable')) return;
            const isPlayingCard = Boolean(nowKey && rowTrackKey === nowKey);
            el.classList.toggle('playing-row', isPlayingCard);
            el.classList.toggle('is-now-playing', isPlayingCard);
            if (isPlayingCard) el.setAttribute('aria-current', 'true');
            else el.removeAttribute('aria-current');
            const liveLabel = isPlayingCard && snapshot.duration > 0 ? snapshot.remainingLabel : '';
            el.querySelectorAll('.album-track-duration, .zenith-time-pill').forEach(timeEl => {
                if (!timeEl.dataset.originalDuration) timeEl.dataset.originalDuration = timeEl.textContent || '';
                timeEl.textContent = liveLabel || timeEl.dataset.originalDuration;
            });
        });

        syncTrackStateButtons();
        document.querySelectorAll('[data-collection-type][data-collection-key]').forEach((node) => {
            const type = node.dataset.collectionType || '';
            const key = node.dataset.collectionKey || '';
            const active = Boolean(type && key && isCollectionActive(type, key));
            node.classList.toggle('is-playing', active);
            node.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function ensureAudioEngine() {
        if (!audioEngine) audioEngine = getEl('audio-engine');
        return audioEngine;
    }

    function loadTrackIntoEngine(track, autoplay = true, startAtBeginning = false) {
        const engine = ensureAudioEngine();
        if (!engine || !track) return;

        const key = getTrackPlaybackCacheKey(track);
        const loadToken = ++activeLoadToken;
        engine.dataset.pendingTrackKey = key;
        engine.dataset.pendingLoadToken = String(loadToken);

        // Show loading state while resolving blob URL
        const playBtn = getRef('play-pause-btn');
        if (playBtn) playBtn.classList.add('loading');

        // Use async resolution to find playable source (blob URL or direct)
        resolvePlayableUrl(track).then(resolvedSrc => {
            if (playBtn) playBtn.classList.remove('loading');
            // Guard: if another track was requested while resolving, skip this one
            if (engine.dataset.pendingTrackKey !== key || engine.dataset.pendingLoadToken !== String(loadToken)) {
                return;
            }
            _loadResolvedTrack(engine, track, resolvedSrc, autoplay, startAtBeginning);
        }).catch(() => {
            if (playBtn) playBtn.classList.remove('loading');
            if (engine.dataset.pendingTrackKey !== key || engine.dataset.pendingLoadToken !== String(loadToken)) return;
            setPlayButtonState(false);
            _showPlaybackError(track);
        });
    }

    function _loadResolvedTrack(engine, track, resolvedSrc, autoplay, startAtBeginning) {
        const hasSrc = !!resolvedSrc;
        if (!hasSrc) {
            setPlayButtonState(false);
            _showPlaybackError(track);
            return;
        }

        const key = getTrackPlaybackCacheKey(track);
        const sourceChanged = engine.dataset.trackKey !== key || engine.src !== resolvedSrc;
        if (sourceChanged) {
            engine.dataset.trackKey = key;
            engine.src = trackPlaybackBlobUrl(resolvedSrc);
            engine.load();
            // Apply ReplayGain for the new track
            applyReplayGain(track);
            // Ensure playback speed persists across tracks
            engine.playbackRate = playbackRate;
        }

        if (startAtBeginning || sourceChanged) {
            const resetToStart = () => {
                try {
                    engine.currentTime = 0;
                } catch (_) {
                    // Ignore seek timing edge cases while media is loading.
                }
                updateProgressUI(0, Number.isFinite(engine.duration) && engine.duration > 0 ? engine.duration : (track.durationSec || 0));
            };
            if (Number.isFinite(engine.duration) && engine.duration > 0) {
                resetToStart();
            } else {
                engine.addEventListener('loadedmetadata', resetToStart, { once: true });
                updateProgressUI(0, track.durationSec || 0);
            }
        } else {
            updateProgressUI(0, track.durationSec || 0);
        }

        if (autoplay) {
            const playPromise = engine.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => setPlayButtonState(true)).catch((err) => {
                    setPlayButtonState(false);
                    if (err && err.name === 'NotAllowedError') {
                        toast('Tap play to start ï¿½ browsers require a user gesture first');
                    } else if (err && err.name === 'NotSupportedError') {
                        // NotSupportedError from play() means source couldn't be loaded, not format issue
                        if (fileHandleCache.size === 0) {
                            toast('Add a music folder in Settings so Auralis can access your files');
                        } else {
                            toast(`Could not load source for "${track.title}" ï¿½ try rescanning`);
                        }
                    } else {
                        toast('Could not play ï¿½ ' + (err?.message || 'unknown error'));
                    }
                });
            } else {
                setPlayButtonState(!engine.paused);
            }
        }
    }

    function _showPlaybackError(track) {
        const raw = String(track.fileUrl || '').trim();
        const isFileProto = /^file:\/\//i.test(raw);
        const isHttpCtx = location.protocol === 'http:' || location.protocol === 'https:';

        if (track._scanned && fileHandleCache.size === 0) {
            toast(`Open Settings and tap Scan Library to enable playback`);
        } else if (track._scanned && track._handleKey && !fileHandleCache.has(track._handleKey)) {
            toast(`"${track.title}" ï¿½ file handle lost, try rescanning`);
        } else if (!raw && !track._scanned) {
            toast(`No audio source for "${track.title}"`);
        } else if (isFileProto && isHttpCtx) {
            if (fileHandleCache.size === 0) {
                toast(`Add a music folder in Settings to play local files`);
            } else {
                toast(`"${track.title}" not found in scanned folders`);
            }
        } else {
            toast(`Cannot load "${track.title}"`);
        }
    }

    function getCurrentQueueIndex() {
        if (!queueTracks.length) return -1;
        if (!nowPlaying) return Math.max(0, Math.min(queueIndex, queueTracks.length - 1));
        const key = getTrackIdentityKey(nowPlaying);
        const idx = queueTracks.findIndex((track) => getTrackIdentityKey(track) === key);
        return idx >= 0 ? idx : Math.max(0, Math.min(queueIndex, queueTracks.length - 1));
    }

    function getQueueRemainingSecondsFromIndex(index, currentSeconds = 0, durationSeconds = 0) {
        if (!Array.isArray(queueTracks) || queueTracks.length === 0) return 0;
        const start = Math.max(0, Math.min(Number(index) || 0, queueTracks.length - 1));
        const currentIdx = getCurrentQueueIndex();
        const currentDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
            ? durationSeconds
            : (nowPlaying?.durationSec || 0);
        const currentElapsed = Math.max(0, Number(currentSeconds || 0));
        let total = 0;

        for (let i = start; i < queueTracks.length; i += 1) {
            const track = queueTracks[i];
            if (!track) continue;
            const baseDuration = getTrackDurationSeconds(track);
            if (i === currentIdx && currentIdx >= 0) {
                const effectiveDuration = Math.max(1, currentDuration || baseDuration);
                const elapsed = Math.max(0, Math.min(effectiveDuration, currentElapsed));
                total += Math.max(0, effectiveDuration - elapsed);
            } else {
                total += Math.max(0, baseDuration);
            }
        }
        return Math.max(0, total);
    }

    function getQueueMetaTimeLabel(index, currentSeconds = 0, durationSeconds = 0) {
        // Cumulative queue timing for meta timeline/summary only.
        const total = getQueueRemainingSecondsFromIndex(index, currentSeconds, durationSeconds);
        return total > 0 ? toDurationLabel(total) : '0:00';
    }

    function seekToRatio(ratio) {
        const engine = ensureAudioEngine();
        if (!engine || !Number.isFinite(engine.duration) || engine.duration <= 0) return;
        const clamped = Math.max(0, Math.min(1, ratio));
        engine.currentTime = clamped * engine.duration;
        updateProgressUI(engine.currentTime, engine.duration);
    }

    function togglePlayback(evt) {
        if (evt) {
            evt.preventDefault();
            evt.stopPropagation();
        }
        const engine = ensureAudioEngine();
        if (!engine || !nowPlaying) return;

        const needsInitialLoad = !engine.src || engine.dataset.trackKey !== getTrackPlaybackCacheKey(nowPlaying);
        if (needsInitialLoad) {
            loadTrackIntoEngine(nowPlaying, true);
            return;
        }

        if (engine.paused) {
            const playPromise = engine.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => setPlayButtonState(true)).catch((err) => {
                    setPlayButtonState(false);
                    if (err && err.name === 'NotAllowedError') {
                        toast('Tap play to start ï¿½ browsers require a user gesture first');
                    } else {
                        toast('Unable to resume: ' + (err?.message || 'unknown error'));
                    }
                });
            }
        } else {
            engine.pause();
            setPlayButtonState(false);
        }
    }

    function shuffleTrackListInPlace(tracks) {
        if (!Array.isArray(tracks) || tracks.length < 2) return tracks;
        for (let i = tracks.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
        return tracks;
    }

    function shuffleQueueOrder() {
        if (!Array.isArray(queueTracks) || queueTracks.length < 2) return false;
        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0) {
            const prefix = queueTracks.slice(0, currentIdx + 1);
            const upcoming = queueTracks.slice(currentIdx + 1);
            if (upcoming.length < 2) return false;
            shuffleTrackListInPlace(upcoming);
            queueTracks = [...prefix, ...upcoming];
            queueIndex = currentIdx;
            return true;
        }
        queueTracks = shuffleTrackListInPlace(queueTracks.slice());
        queueIndex = Math.max(0, Math.min(queueIndex, queueTracks.length - 1));
        return true;
    }

    function playNext(fromEnded = false) {
        if (!queueTracks.length) return;
        let idx = getCurrentQueueIndex();
        if (idx < 0) idx = 0;

        if (fromEnded && repeatMode === 'one') {
            if (repeatPlayCount < 1) {
                repeatPlayCount++;
                const track = queueTracks[idx];
                if (track) loadTrackIntoEngine(track, true);
                return;
            }
            repeatPlayCount = 0; // exhausted repeats ï¿½ fall through to advance
        }

        if (idx >= queueTracks.length - 1) {
            if (fromEnded && repeatMode === 'all') {
                idx = 0; // cycle queue back to start
            } else if (fromEnded) {
                setPlayButtonState(false);
                return;
            } else {
                idx = 0;
            }
        } else {
            idx += 1;
        }

        queueIndex = idx;
        const track = queueTracks[idx];
        if (!track) return;

        // Crossfade: fade out current engine before loading next
        if (crossfadeEnabled && fromEnded) {
            beginCrossfade(ensureAudioEngine());
        }

        // GAP 8: clear stale collection key when queue advances to a different album
        if (activePlaybackCollectionType === 'album' && activePlaybackCollectionKey && activeAlbumTitle) {
            const rawAlbum = String(track.albumTitle || '').trim();
            if (rawAlbum && albumKey(rawAlbum) !== albumKey(activeAlbumTitle)) {
                setPlaybackCollection('', '');
            }
        }

        repeatPlayCount = 0;
        setNowPlaying(track, !fromEnded);
        loadTrackIntoEngine(track, true);
        renderQueue();
    }

    function playPrevious() {
        if (!queueTracks.length) return;
        const engine = ensureAudioEngine();
        if (engine && engine.currentTime > REPLAY_THRESHOLD_SEC) {
            engine.currentTime = 0;
            updateProgressUI(0, engine.duration || nowPlaying?.durationSec || 0);
            return;
        }

        let idx = getCurrentQueueIndex();
        if (idx < 0) idx = 0;
        idx = idx === 0 ? queueTracks.length - 1 : idx - 1;
        queueIndex = idx;

        const track = queueTracks[idx];
        if (!track) return;

        // GAP 8: clear stale collection key when going back to a different album
        if (activePlaybackCollectionType === 'album' && activePlaybackCollectionKey && activeAlbumTitle) {
            const rawAlbum = String(track.albumTitle || '').trim();
            if (rawAlbum && albumKey(rawAlbum) !== albumKey(activeAlbumTitle)) {
                setPlaybackCollection('', '');
            }
        }

        repeatPlayCount = 0;
        setNowPlaying(track, true);
        loadTrackIntoEngine(track, true);
        renderQueue();
    }

    function triggerPlayerControlFeedback(button) {
        if (!button) return;
        button.classList.remove('player-control-feedback');
        void button.offsetWidth;
        button.classList.add('player-control-feedback');
        if (button._controlFeedbackTimer) clearTimeout(button._controlFeedbackTimer);
        button._controlFeedbackTimer = setTimeout(() => {
            button.classList.remove('player-control-feedback');
            button._controlFeedbackTimer = null;
        }, 320);
    }

    function toggleShuffle() {
        const btn = getEl('player-shuffle-btn');
        if (btn) {
            btn.style.fill = 'rgba(255,255,255,0.8)';
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('aria-label', 'Shuffle queue');
            btn.title = 'Shuffle';
        }
        const didShuffle = shuffleQueueOrder();
        if (didShuffle) renderQueue();
        triggerPlayerControlFeedback(btn);
    }

    function toggleRepeatMode() {
        const modes = ['off', 'all', 'one'];
        repeatMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
        repeatPlayCount = 0;
        const btn = getEl('player-repeat-btn');
        const sub = getEl('player-repeat-sub');
        if (btn) {
            btn.style.fill = repeatMode !== 'off' ? 'var(--sys-primary)' : 'rgba(255,255,255,0.8)';
            btn.style.opacity = repeatMode !== 'off' ? '1' : '';
            btn.classList.toggle('repeat-on', repeatMode !== 'off');
            btn.setAttribute('aria-pressed', repeatMode !== 'off' ? 'true' : 'false');
            const labels = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat once' };
            btn.setAttribute('aria-label', labels[repeatMode]);
            btn.title = labels[repeatMode];
        }
        if (sub) {
            const subMap = { off: '', all: '\u221e', one: '1' };
            sub.textContent = subMap[repeatMode];
            sub.style.display = repeatMode === 'off' ? 'none' : '';
        }
        triggerPlayerControlFeedback(btn);
    }

    // -- Volume Control ----------------------------------------------
    function setVolume(vol) {
        currentVolume = Math.max(0, Math.min(1, parseFloat(vol) || 0));
        const engine = ensureAudioEngine();
        if (engine) engine.volume = currentVolume;
        safeStorage.setItem(STORAGE_KEYS.volume, String(currentVolume));
        const slider = getRef('player-volume-slider');
        if (slider && parseFloat(slider.value) !== currentVolume) slider.value = currentVolume;
        const icon = getEl('player-volume-icon');
        if (icon) {
            if (currentVolume === 0) icon.textContent = '??';
            else if (currentVolume < 0.5) icon.textContent = '??';
            else icon.textContent = '??';
        }
    }

    function toggleMute() {
        if (currentVolume > 0) {
            safeStorage.setItem(STORAGE_KEYS.previousVolume, String(currentVolume));
            setVolume(0);
        } else {
            setVolume(parseFloat(safeStorage.getItem(STORAGE_KEYS.previousVolume) || '1'));
        }
    }

    // -- Playback Speed ----------------------------------------------
    function formatPlaybackRateLabel(rate) {
        const value = Math.max(0.25, Math.min(4, parseFloat(rate) || 1));
        return `${value.toFixed(2).replace(/\.?0+$/, '')}x`;
    }

    function setPlaybackSpeed(rate) {
        playbackRate = Math.max(0.25, Math.min(4, parseFloat(rate) || 1));
        const engine = ensureAudioEngine();
        if (engine) engine.playbackRate = playbackRate;
        safeStorage.setItem(STORAGE_KEYS.speed, String(playbackRate));
        const label = getRef('player-speed-label');
        if (label) label.textContent = playbackRate === 1 ? '1ï¿½' : playbackRate.toFixed(2).replace(/0$/, '') + 'ï¿½';
        toast(`Speed: ${playbackRate}ï¿½`);
    }

    function setPlaybackSpeed(rate) {
        playbackRate = Math.max(0.25, Math.min(4, parseFloat(rate) || 1));
        const engine = ensureAudioEngine();
        if (engine) engine.playbackRate = playbackRate;
        safeStorage.setItem(STORAGE_KEYS.speed, String(playbackRate));
        const label = getRef('player-speed-label');
        if (label) label.textContent = formatPlaybackRateLabel(playbackRate);
        toast(`Speed: ${formatPlaybackRateLabel(playbackRate)}`);
    }

    function cyclePlaybackSpeed() {
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const idx = speeds.indexOf(playbackRate);
        const next = idx >= 0 ? speeds[(idx + 1) % speeds.length] : 1;
        setPlaybackSpeed(next);
    }

    // -- Sleep Timer -------------------------------------------------
    function startSleepTimer(minutes) {
        cancelSleepTimer();
        if (!minutes || minutes <= 0) return;
        const ms = minutes * 60 * 1000;
        sleepTimerEnd = Date.now() + ms;
        sleepTimerId = setTimeout(() => {
            const engine = ensureAudioEngine();
            if (engine && !engine.paused) {
                engine.pause();
                setPlayButtonState(false);
            }
            sleepTimerId = null;
            sleepTimerEnd = 0;
            toast('Sleep timer ended ï¿½ playback paused');
            updateSleepTimerUI();
        }, ms);
        toast(`Sleep timer: ${minutes} min`);
        updateSleepTimerUI();
    }

    function cancelSleepTimer() {
        if (sleepTimerId) {
            clearTimeout(sleepTimerId);
            sleepTimerId = null;
        }
        sleepTimerEnd = 0;
        updateSleepTimerUI();
    }

    function updateSleepTimerUI() {
        const label = getEl('sleep-timer-label');
        if (!label) return;
        if (sleepTimerEnd > 0) {
            const remaining = Math.max(0, Math.ceil((sleepTimerEnd - Date.now()) / 60000));
            label.textContent = remaining + 'm';
            label.style.display = '';
        } else {
            label.textContent = '';
            label.style.display = 'none';
        }
    }

    // -- Like / Rate / Play Count Helpers ----------------------------
    function toggleLikeTrack(track) {
        if (!track) return;
        if (hasTrackSetValue(likedTracks, track)) {
            deleteTrackSetValue(likedTracks, track);
            toast(`Removed "${track.title}" from liked`);
        } else {
            addTrackSetValue(likedTracks, track);
            toast(`Liked "${track.title}"`);
        }
        persistLiked();
        syncLikeButtons();
    }

    function syncLikeButtons() {
        const nowKey = getNowPlayingTrackKey();
        document.querySelectorAll('.like-btn').forEach(btn => {
            const key = btn.dataset.trackKey || nowKey;
            const liked = likedTracks.has(key);
            btn.classList.toggle('is-liked', liked);
            btn.textContent = liked ? '?' : '?';
            btn.setAttribute('aria-label', liked ? 'Unlike' : 'Like');
        });
    }

    function rateTrack(track, stars) {
        if (!track) return;
        const rating = Math.max(0, Math.min(5, parseInt(stars, 10) || 0));
        if (rating === 0) {
            deleteTrackMapValue(trackRatings, track);
            toast(`Cleared rating for "${track.title}"`);
        } else {
            setTrackMapValue(trackRatings, track, rating);
            toast(`Rated "${track.title}" ${rating}?`);
        }
        persistRatings();
    }

    function getPlayCount(track) {
        if (!track) return 0;
        return Number(getTrackMapValue(playCounts, track) || 0);
    }

    // -- ReplayGain Normalization (Web Audio API) --------------------
    // -- Web Audio Graph builder -------------------------------------
    function ensureEqNodes() {
        if (!audioContext || eqNodes.length === EQ_FREQUENCIES.length) return;
        eqNodes = EQ_FREQUENCIES.map((freq, i) => {
            const node = audioContext.createBiquadFilter();
            node.type = EQ_BAND_TYPES[i];
            node.frequency.value = freq;
            node.gain.value = eqBandGains[i] || 0;
            if (node.type === 'peaking') node.Q.value = 1.41;
            return node;
        });
    }

    function rebuildAudioGraph() {
        if (!audioContext || !sourceNode || !gainNode) return;
        try { sourceNode.disconnect(); } catch (_) { /* benign: cleanup */ }
        try { gainNode.disconnect(); } catch (_) { /* benign: cleanup */ }
        eqNodes.forEach(n => { try { n.disconnect(); } catch (_) { /* benign: cleanup */ } });
        sourceNode.connect(gainNode);
        if (eqEnabled && eqNodes.length === EQ_FREQUENCIES.length) {
            gainNode.connect(eqNodes[0]);
            for (let i = 0; i < eqNodes.length - 1; i++) eqNodes[i].connect(eqNodes[i + 1]);
            eqNodes[eqNodes.length - 1].connect(audioContext.destination);
        } else {
            gainNode.connect(audioContext.destination);
        }
    }

    function applyReplayGain(track) {
        if (!replayGainEnabled && !eqEnabled) {
            if (gainNode) { try { gainNode.gain.value = 1; } catch (_) { /* benign: cleanup */ } }
            return;
        }
        const engine = ensureAudioEngine();
        if (!engine) return;
        try {
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') audioContext.resume();
            const needsInit = !sourceNode;
            if (needsInit) {
                sourceNode = audioContext.createMediaElementSource(engine);
                gainNode = audioContext.createGain();
            }
            // Prefer track gain, fall back to album gain, then 0 dB
            const gainDb = replayGainEnabled
                ? (Number.isFinite(track?.replayGainTrack) ? track.replayGainTrack
                   : Number.isFinite(track?.replayGainAlbum) ? track.replayGainAlbum : 0)
                : 0;
            gainNode.gain.value = Math.pow(10, gainDb / 20);
            if (needsInit || eqNodes.length !== EQ_FREQUENCIES.length) {
                ensureEqNodes();
                rebuildAudioGraph();
            }
        } catch (_) { /* benign: cleanup */ }
    }

    function disconnectReplayGain() {
        if (gainNode) { try { gainNode.gain.value = 1; } catch (_) { /* benign: cleanup */ } }
    }

    function toggleReplayGain() {
        replayGainEnabled = !replayGainEnabled;
        safeStorage.setItem(STORAGE_KEYS.replayGain, replayGainEnabled ? '1' : '0');
        if (nowPlaying) applyReplayGain(nowPlaying);
        toast(replayGainEnabled ? 'ReplayGain enabled' : 'ReplayGain disabled');
    }

    // -- Equalizer --------------------------------------------------
    const EQ_PRESETS = {
        flat:         [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        bass_boost:   [8, 7, 6, 4, 2, 0, 0, 0, 0, 0],
        treble_boost: [0, 0, 0, 0, 0, 0, 2, 4, 6, 8],
        vocal:        [-2, -2, 0, 2, 5, 6, 5, 3, 2, 1],
        electronic:   [6, 5, 1, 0, -3, -2, 0, 2, 4, 6],
        rock:         [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
    };

    function persistEq() {
        safeStorage.setJson(STORAGE_KEYS.eqBands, eqBandGains);
    }

    function applyEqValues() {
        eqNodes.forEach((node, i) => {
            try { node.gain.value = eqBandGains[i] || 0; } catch (_) { /* benign: cleanup */ }
        });
        renderEqSliders();
    }

    function setEqBand(bandIndex, gainDb) {
        const i = Number(bandIndex);
        const g = Math.max(-12, Math.min(12, Number(gainDb) || 0));
        if (i < 0 || i >= EQ_FREQUENCIES.length) return;
        eqBandGains[i] = g;
        if (eqNodes[i]) { try { eqNodes[i].gain.value = g; } catch (_) { /* benign: cleanup */ } }
        persistEq();
        renderEqSliders();
    }

    function toggleEq() {
        eqEnabled = !eqEnabled;
        safeStorage.setItem(STORAGE_KEYS.eq, eqEnabled ? '1' : '0');
        if (eqEnabled) {
            const engine = ensureAudioEngine();
            if (engine && !audioContext) {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (audioContext.state === 'suspended') audioContext.resume();
                    sourceNode = audioContext.createMediaElementSource(engine);
                    gainNode = audioContext.createGain();
                    gainNode.gain.value = 1;
                } catch (_) { /* benign: cleanup */ }
            }
            ensureEqNodes();
        }
        rebuildAudioGraph();
        renderEqPanel();
        toast(eqEnabled ? 'Equalizer on' : 'Equalizer bypassed');
    }

    function setEqPreset(name) {
        const gains = EQ_PRESETS[name];
        if (!gains) return;
        eqBandGains = [...gains];
        applyEqValues();
        persistEq();
        document.querySelectorAll('#eq-presets .filter-chip').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.preset === name));
        const label = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        toast(`EQ: ${label}`);
    }

    function renderEqSliders() {
        const container = getEl('eq-bands');
        if (!container) return;
        container.querySelectorAll('.eq-band-slider').forEach((slider, i) => {
            if (parseFloat(slider.value) !== eqBandGains[i]) slider.value = String(eqBandGains[i] || 0);
            const valueEl = slider.closest('.eq-band')?.querySelector('.eq-band-value');
            if (valueEl) {
                const g = eqBandGains[i] || 0;
                valueEl.textContent = (g > 0 ? '+' : '') + g + 'dB';
            }
        });
    }

    function renderEqPanel() {
        const toggle = getEl('eq-toggle-btn');
        if (toggle) toggle.classList.toggle('active', eqEnabled);
        const container = getEl('eq-bands');
        if (!container) return;
        if (container.children.length > 0) { renderEqSliders(); return; }
        EQ_FREQUENCIES.forEach((freq, i) => {
            const band = document.createElement('div');
            band.className = 'eq-band';
            const g = eqBandGains[i] || 0;
            const valueEl = document.createElement('div');
            valueEl.className = 'eq-band-value';
            valueEl.textContent = (g > 0 ? '+' : '') + g + 'dB';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'eq-band-slider';
            slider.min = '-12'; slider.max = '12'; slider.step = '0.5';
            slider.value = String(g);
            slider.dataset.band = String(i);
            slider.addEventListener('input', e => setEqBand(i, parseFloat(e.target.value)));
            const label = document.createElement('div');
            label.className = 'eq-band-label';
            label.textContent = freq >= 1000 ? (freq / 1000) + 'k' : String(freq);
            band.appendChild(valueEl);
            band.appendChild(slider);
            band.appendChild(label);
            container.appendChild(band);
        });
    }

    function openEq() {
        const panel = getEl('eq-panel');
        if (!panel) return;
        panel.style.display = 'flex';
        renderEqPanel();
        const eqBtn = getEl('player-eq-btn');
        if (eqBtn) eqBtn.classList.add('eq-active');
        document.querySelectorAll('#eq-presets .filter-chip').forEach(btn => {
            const preset = EQ_PRESETS[btn.dataset.preset];
            btn.classList.toggle('active', !!preset && preset.every((v, i) => Math.abs(v - (eqBandGains[i] || 0)) < 0.1));
        });
    }

    function closeEq() {
        const panel = getEl('eq-panel');
        if (panel) panel.style.display = 'none';
        const eqBtn = getEl('player-eq-btn');
        if (eqBtn) eqBtn.classList.remove('eq-active');
    }

    // -- Gapless Playback -------------------------------------------
    function getNextQueueTrack() {
        if (!queueTracks.length || repeatMode === 'one') return null;
        const idx = getCurrentQueueIndex();
        if (idx < 0) return null;
        if (idx >= queueTracks.length - 1) return repeatMode === 'all' ? queueTracks[0] : null;
        return queueTracks[idx + 1];
    }

    function scheduleGaplessPreload(track) {
        if (!track || gaplessPreloading) return;
        const key = getTrackIdentityKey(track);
        if (blobUrlCache.has(key)) return;
        gaplessPreloading = true;
        resolvePlayableUrl(track).then(() => { gaplessPreloading = false; }).catch(() => { gaplessPreloading = false; });
    }

    function toggleGapless() {
        gaplessEnabled = !gaplessEnabled;
        safeStorage.setItem(STORAGE_KEYS.gapless, gaplessEnabled ? '1' : '0');
        const toggle = getEl('settings-gapless-toggle');
        if (toggle) {
            toggle.classList.toggle('active', gaplessEnabled);
            toggle.setAttribute('aria-checked', String(gaplessEnabled));
        }
        toast(gaplessEnabled ? 'Gapless playback enabled' : 'Gapless playback disabled');
    }

    // -- Crossfade ---------------------------------------------------
    function toggleCrossfade() {
        crossfadeEnabled = !crossfadeEnabled;
        safeStorage.setItem(STORAGE_KEYS.crossfade, crossfadeEnabled ? '1' : '0');
        toast(crossfadeEnabled ? 'Crossfade enabled' : 'Crossfade disabled');
    }

    // -- Lyrics Display ----------------------------------------------
    function isLyricsPanelVisible() {
        const panel = getEl('lyrics-panel');
        return Boolean(panel && panel.style.display !== 'none' && panel.style.display !== '');
    }

    function resolveLyricsTrack(track = nowPlaying) {
        const candidates = [];
        if (track) candidates.push(track);

        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0 && currentIdx < queueTracks.length) {
            const currentQueueTrack = queueTracks[currentIdx];
            if (currentQueueTrack && !candidates.some((candidate) => isSameTrack(candidate, currentQueueTrack))) {
                candidates.push(currentQueueTrack);
            }
        }

        let fallback = null;
        for (const candidate of candidates) {
            const hydrated = hydratePlaybackTrack(candidate);
            if (hydrated?.lyrics) return hydrated;
            if (candidate?.lyrics) return candidate;
            if (!fallback && hydrated) fallback = hydrated;
            if (!fallback && candidate) fallback = candidate;
        }

        return fallback;
    }

    function renderLyricsContent(track = nowPlaying) {
        const content = getEl('lyrics-content');
        if (!content) return;

        const lyricsTrack = resolveLyricsTrack(track);
        if (!lyricsTrack) {
            content.textContent = 'No track playing';
            return;
        }

        const lyrics = String(lyricsTrack.lyrics || '').trim();
        content.textContent = lyrics || 'No lyrics available for this track';
    }

    function syncLyricsPanel(track = nowPlaying) {
        if (!isLyricsPanelVisible()) return;
        renderLyricsContent(track);
    }

    function showLyrics() {
        const panel = getEl('lyrics-panel');
        if (!panel) return;
        renderLyricsContent(nowPlaying);
        panel.style.display = 'block';
    }

    function hideLyrics() {
        const panel = getEl('lyrics-panel');
        if (panel) panel.style.display = 'none';
    }

    function toggleLyrics() {
        if (isLyricsPanelVisible()) hideLyrics();
        else showLyrics();
    }

    // -- User Playlists CRUD -----------------------------------------
    function createUserPlaylist(name) {
        const id = 'upl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const pl = { id, name: String(name || 'New Playlist').trim(), tracks: [], created: Date.now() };
        userPlaylists.push(pl);
        persistUserPlaylists();
        toast(`Created playlist "${pl.name}"`);
        return pl;
    }

    function createPlaylistDetailTrackRow(playlist, track, idx, totalCount) {
        const row = document.createElement('div');
        row.className = 'list-item album-track-row';
        row.dataset.trackKey = trackKey(track.title, track.artist);
        row.dataset.metadataStatus = getTrackMetadataStatus(track);
        if (idx === Math.min(Number(totalCount) || 0, 200) - 1) row.style.borderBottom = 'none';

        const click = document.createElement('button');
        click.className = 'item-clickable';
        click.type = 'button';
        click.addEventListener('click', () => playPlaylistInOrder(playlist.id, idx));
        bindLongPressAction(click, () => openTrackZenithMenu(track));

        const numEl = document.createElement('span');
        numEl.className = 'track-num';
        numEl.textContent = String(idx + 1);

        const content = document.createElement('div');
        content.className = 'item-content';
        const titleNode = document.createElement('h3');
        titleNode.textContent = track.title;
        const artistNode = document.createElement('span');
        artistNode.style.cssText = 'font-size:12px; color:var(--text-secondary);';
        artistNode.textContent = track.artist || '';
        content.appendChild(titleNode);
        if (track.artist) content.appendChild(artistNode);

        const durationEl = document.createElement('span');
        durationEl.className = 'album-track-duration';
        durationEl.textContent = getTrackDurationDisplay(track);
        durationEl.dataset.originalDuration = durationEl.textContent;
        durationEl.dataset.metadataStatus = getTrackMetadataStatus(track);

        const stateBtn = createTrackStateButton(track, () => playPlaylistInOrder(playlist.id, idx), { compact: true });
        stateBtn.classList.add('album-track-state-btn');

        click.appendChild(numEl);
        click.appendChild(content);
        click.appendChild(durationEl);
        click.appendChild(stateBtn);
        row.appendChild(click);
        registerTrackUi(trackKey(track.title, track.artist), { row, click, stateButton: stateBtn, durations: [durationEl] });
        return row;
    }

    function refreshUserPlaylistSurfaces(playlist) {
        setLibraryRenderDirty(true);
        renderLibraryViews({ force: true });
        if (!playlist || activePlaylistId !== playlist.id || !getEl('playlist_detail')?.classList.contains('active')) return;

        const titleEl = getEl('playlist-title');
        const subEl = getEl('playlist-subtitle');
        const list = getEl('playlist-track-list');
        const playlistTracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
        const totalSeconds = playlistTracks.reduce((sum, track) => sum + Number(track.durationSec || toDurationSeconds(track.duration) || 0), 0);
        if (titleEl) {
            titleEl.textContent = playlist.title || playlist.name || 'Playlist';
            titleEl.title = titleEl.textContent;
        }
        if (subEl) {
            const trackCount = playlistTracks.length;
            const durationLabel = totalSeconds > 0 ? ` - ${toDurationLabel(totalSeconds)}` : '';
            subEl.textContent = `${trackCount} ${trackCount === 1 ? 'song' : 'songs'}${durationLabel}`;
            subEl.title = subEl.textContent;
        }
        if (list) {
            clearNodeChildren(list);
            if (!playlistTracks.length) {
                list.appendChild(createScreenEmptyState({
                    title: 'This playlist is empty',
                    body: 'Add songs from Search, Library, or the Queue.',
                    iconName: 'playlist',
                    action: { label: 'Add Songs', action: 'openAddSongsToPlaylist' }
                }));
            } else {
                const tracks = playlistTracks.slice(0, 200);
                appendFragment(list, tracks.map((track, idx) => createPlaylistDetailTrackRow(playlist, track, idx, playlistTracks.length)));
            }
        }
        setPlayButtonState(isPlaying);
        ensureAccessibility();
    }

    function deleteUserPlaylist(id) {
        const idx = userPlaylists.findIndex(p => p.id === id);
        if (idx < 0) return;
        const removedPlaylist = cloneBackendValue(userPlaylists[idx]);
        const name = removedPlaylist.name || removedPlaylist.title || 'Playlist';
        userPlaylists.splice(idx, 1);
        persistUserPlaylists();
        refreshUserPlaylistSurfaces(null);
        presentUndoToast(`Deleted playlist "${name}"`, 'Undo', () => {
            if (userPlaylists.some((playlist) => playlist.id === removedPlaylist.id)) return;
            userPlaylists.splice(Math.min(idx, userPlaylists.length), 0, cloneBackendValue(removedPlaylist));
            persistUserPlaylists();
            refreshUserPlaylistSurfaces(playlistById.get(removedPlaylist.id));
        });
    }

    function renameUserPlaylist(id, newName) {
        const pl = userPlaylists.find(p => p.id === id);
        if (!pl) return;
        pl.name = String(newName || pl.name).trim();
        persistUserPlaylists();
        toast(`Renamed to "${pl.name}"`);
    }

    function addTrackToUserPlaylist(playlistId, track, options = {}) {
        const pl = userPlaylists.find(p => p.id === playlistId);
        if (!pl || !track) return;
        const playlistTrack = hydratePlaybackTrack(track);
        if (!playlistTrack) return;
        pl.tracks.push(playlistTrack);
        persistUserPlaylists();
        if (!options.silent) toast(`Added "${track.title}" to "${pl.name}"`);
    }

    function removeTrackFromUserPlaylist(playlistId, trackIndex) {
        const pl = userPlaylists.find(p => p.id === playlistId);
        if (!pl || trackIndex < 0 || trackIndex >= pl.tracks.length) return;
        const removed = pl.tracks.splice(trackIndex, 1)[0];
        persistUserPlaylists();
        refreshUserPlaylistSurfaces(pl);
        presentUndoToast(`Removed "${removed?.title || 'track'}" from "${pl.name}"`, 'Undo', () => {
            const target = userPlaylists.find((playlist) => playlist.id === playlistId);
            if (!target || !removed) return;
            target.tracks.splice(Math.min(trackIndex, target.tracks.length), 0, removed);
            persistUserPlaylists();
            refreshUserPlaylistSurfaces(target);
        });
    }

    // -- Smart / Dynamic Playlists -----------------------------------
    function generateSmartPlaylist(rule) {
        let tracks = [...LIBRARY_TRACKS];
        const r = String(rule || '').toLowerCase();
        if (r === 'most-played') {
            tracks = tracks.filter(t => getPlayCount(t) > 0).sort((a, b) => getPlayCount(b) - getPlayCount(a)).slice(0, 50);
        } else if (r === 'recently-played') {
            tracks = tracks.filter((track) => getTrackMapValue(lastPlayed, track))
                .sort((a, b) => (getTrackMapValue(lastPlayed, b) || 0) - (getTrackMapValue(lastPlayed, a) || 0))
                .slice(0, 50);
        } else if (r === 'liked') {
            tracks = tracks.filter((track) => hasTrackSetValue(likedTracks, track));
        } else if (r === 'top-rated') {
            tracks = tracks.filter((track) => Number(getTrackMapValue(trackRatings, track) || 0) >= 4)
                .sort((a, b) => (getTrackMapValue(trackRatings, b) || 0) - (getTrackMapValue(trackRatings, a) || 0));
        } else if (r === 'never-played') {
            tracks = tracks.filter((track) => !getTrackMapValue(playCounts, track));
        } else if (r === 'short') {
            tracks = tracks.filter(t => t.durationSec > 0 && t.durationSec <= 180);
        } else if (r === 'long') {
            tracks = tracks.filter(t => t.durationSec > 600);
        }
        return tracks;
    }

    // -- Queue Persistence -------------------------------------------
    function restoreQueue() {
        try {
            const raw = safeStorage.getItem(STORAGE_KEYS.queue);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!Array.isArray(data.tracks) || data.tracks.length === 0) return;
            queueTracks = data.tracks.map((track) => hydratePlaybackTrack(track)).filter(Boolean);
            if (!queueTracks.length) return;
            queueIndex = Math.max(0, Math.min(data.index || 0, queueTracks.length - 1));
            const track = queueTracks[queueIndex];
            if (track) setNowPlaying(track, false);
        } catch (_) { /* benign: cleanup */ }
    }

    // -- Audio Format Details ----------------------------------------
    function updateFormatDetails() {
        const engine = ensureAudioEngine();
        const badge = getEl('player-format-badge');
        const qualBadge = getEl('player-quality-badge');
        if (!engine || !nowPlaying) return;
        const ext = (nowPlaying.ext || '').toUpperCase();
        const isLossless = ext === 'FLAC' || ext === 'WAV' || ext === 'ALAC';
        if (badge) badge.textContent = ext || 'AUDIO';
        if (qualBadge) qualBadge.textContent = isLossless ? 'LOSSLESS' : 'LOSSY';
    }

    function bindAudioEngine() {
/* <<< 03-playback-engine.js */

/* >>> 04-navigation-renderers.js */
/*
 * Auralis JS shard: 04-navigation-renderers.js
 * Purpose: screen navigation, search, album/playlist/artist rendering, queue views
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        const engine = ensureAudioEngine();
        if (!engine || engine.dataset.bound === '1') return;
        engine.dataset.bound = '1';

        engine.addEventListener('play', () => setPlayButtonState(true));
        engine.addEventListener('pause', () => setPlayButtonState(false));
        engine.addEventListener('timeupdate', () => {
            if (isSeeking) return;
            updateProgressUI(engine.currentTime, engine.duration || nowPlaying?.durationSec || 0);
            // Record album progress for Jump Back In / In Progress sections
            if (nowPlaying && activePlaybackCollectionType === 'album' && activeAlbumTitle) {
                recordAlbumProgress(activeAlbumTitle, queueIndex, engine.currentTime, engine.duration || nowPlaying.durationSec || 0, activeAlbumArtist);
            }
        });
        engine.addEventListener('loadedmetadata', () => {
            if (!nowPlaying) return;
            if (Number.isFinite(engine.duration) && engine.duration > 0) {
                nowPlaying.durationSec = Math.round(engine.duration);
                nowPlaying.duration = toDurationLabel(nowPlaying.durationSec);
                updateProgressUI(engine.currentTime, engine.duration);
                renderQueue();
            }
        });
        engine.addEventListener('ended', () => {
            // Increment play count for completed track
            if (nowPlaying) {
                const nextCount = Number(getTrackMapValue(playCounts, nowPlaying) || 0) + 1;
                setTrackMapValue(playCounts, nowPlaying, nextCount);
                setTrackMapValue(lastPlayed, nowPlaying, Date.now());
                persistPlayCounts();
                persistLastPlayed();
                // Project live stats onto the track object for section sorting
                nowPlaying.plays = nextCount;
                nowPlaying.lastPlayedDays = 0;
            }
            // Clear album progress if we just finished the last track
            if (activePlaybackCollectionType === 'album' && activeAlbumTitle && queueIndex >= queueTracks.length - 1) {
                clearAlbumProgress(activeAlbumTitle, activeAlbumArtist);
            }
            playNext(true);
        });
        engine.addEventListener('error', () => {
            const err = engine.error;
            const trackTitle = nowPlaying?.title || 'current track';
            if (err) {
                const code = err.code;
                if (code === 4) {
                    // MEDIA_ERR_SRC_NOT_SUPPORTED â€” usually means file path is inaccessible, not format
                    const raw = String(nowPlaying?.fileUrl || '').trim();
                    const isFileProto = /^file:\/\//i.test(raw);
                    if (isFileProto && fileHandleCache.size === 0) {
                        toast(`Add a music folder in Settings to play local files`);
                    } else if (isFileProto) {
                        toast(`"${trackTitle}" not found in scanned folders â€” try rescanning`);
                    } else {
                        toast(`Source not loadable for "${trackTitle}"`);
                    }
                } else {
                    const codes = { 1: 'Load aborted', 2: 'Network error', 3: 'Decode failed' };
                    const reason = codes[code] || ('Error code ' + code);
                    toast(`${reason} for "${trackTitle}"`);
                }
            } else {
                toast(`Playback failed for "${trackTitle}"`);
            }
        });

        const miniTrack = getEl('mini-progress-track');
        if (miniTrack && miniTrack.dataset.bound !== '1') {
            miniTrack.dataset.bound = '1';
            miniTrack.addEventListener('click', (e) => {
                e.stopPropagation();
                const rect = miniTrack.getBoundingClientRect();
                seekToRatio((e.clientX - rect.left) / Math.max(1, rect.width));
            });
        }

        const fullTrack = getEl('player-progress-track');
        if (fullTrack && fullTrack.dataset.bound !== '1') {
            fullTrack.dataset.bound = '1';
            const thumb = getEl('player-progress-thumb');
            fullTrack.addEventListener('pointerdown', (e) => {
                isSeeking = true;
                fullTrack.setPointerCapture(e.pointerId);
                if (thumb) thumb.style.opacity = '1';
                const rect = fullTrack.getBoundingClientRect();
                seekToRatio((e.clientX - rect.left) / Math.max(1, rect.width));
            });
            fullTrack.addEventListener('pointermove', (e) => {
                if (!isSeeking) return;
                const rect = fullTrack.getBoundingClientRect();
                seekToRatio((e.clientX - rect.left) / Math.max(1, rect.width));
            });
            fullTrack.addEventListener('pointerup', () => {
                isSeeking = false;
                if (thumb) thumb.style.opacity = '';
            });
            fullTrack.addEventListener('pointercancel', () => {
                isSeeking = false;
                if (thumb) thumb.style.opacity = '';
            });
        }

        // Apply persisted volume
        engine.volume = Math.max(0, Math.min(1, currentVolume));
        const volSlider = getEl('player-volume-slider');
        if (volSlider) {
            volSlider.value = engine.volume;
            if (volSlider.dataset.bound !== '1') {
                volSlider.dataset.bound = '1';
                volSlider.addEventListener('input', () => setVolume(volSlider.value));
            }
        }

        // Apply persisted playback speed
        engine.playbackRate = playbackRate;

        // MediaSession API integration
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => { if (engine.paused) togglePlayback(); });
            navigator.mediaSession.setActionHandler('pause', () => { if (!engine.paused) togglePlayback(); });
            navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
            navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime != null && Number.isFinite(details.seekTime)) {
                    engine.currentTime = details.seekTime;
                    updateProgressUI(engine.currentTime, engine.duration || 0);
                }
            });
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                engine.currentTime = Math.max(0, engine.currentTime - (details.seekOffset || 10));
            });
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                engine.currentTime = Math.min(engine.duration || 0, engine.currentTime + (details.seekOffset || 10));
            });
        }
    }

    function isOnboardingVisible() {
        const ob = getEl('onboarding');
        return !!ob && ob.style.display !== 'none';
    }

    function isSetupVisible() {
        const setup = getEl('first-time-setup');
        return !!setup && setup.style.display !== 'none';
    }

    function syncBottomNavVisibility() {
        const nav = getEl('bottom-nav');
        if (!nav) return;

        const playerOpen = getEl('player')?.classList.contains('active');
        const onboardingOpen = isOnboardingVisible();
        const setupOpen = isSetupVisible();
        nav.classList.toggle('hidden', Boolean(playerOpen || onboardingOpen || setupOpen || albumArtViewerOpen));
    }

    let _toastQueue = [];
    let _toastActive = false;
    function toast(msg) {
        const t = getEl('toast');
        if (!t) return;
        if (_toastActive) {
            // Replace current toast immediately if one is showing
            _toastQueue.length = 0;
            t.classList.remove('show');
            // Brief pause so the transition resets before showing next
            requestAnimationFrame(() => requestAnimationFrame(() => {
                _showToast(t, msg);
            }));
        } else {
            _showToast(t, msg);
        }
    }
    function _showToast(t, msg) {
        _toastActive = true;
        t.innerText = msg;
        t.classList.add('show');
        setTimeout(() => {
            t.classList.remove('show');
            _toastActive = false;
            if (_toastQueue.length) _showToast(t, _toastQueue.shift());
        }, 2200);
    }

    // Navigation
    function switchTab(id, el) {
        if (id === activeId) return;
        // Exit search mode when leaving library
        if (activeId === 'library' && typeof exitSearchMode === 'function') exitSearchMode();
        const outgoing = getEl(activeId);
        const incoming = getEl(id);
        if (!incoming || !outgoing) return;

        outgoing.classList.remove('active');
        outgoing.classList.add('behind');

        getEl('tabs')?.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        if (el) el.classList.add('active');

        incoming.classList.remove('behind');
        // Double-rAF ensures the browser commits the initial state before triggering transition
        requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.add('active')));

        activeId = id;
        historyStack = [id];
        syncBottomNavVisibility();
    }

    function push(id) {
        const incoming = getEl(id);
        const outgoing = getEl(activeId);
        if (!incoming || !outgoing || id === activeId) return;

        // Queue should take over interaction focus from full-player overlay.
        if (id === 'queue') {
            const player = getEl('player');
            if (player?.classList.contains('active')) {
                player.classList.remove('active');
                pOpen = false;
            }
        }

        outgoing.classList.remove('active');
        outgoing.classList.add('behind');

        incoming.classList.remove('behind');
        requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.add('active')));

        historyStack.push(id);
        activeId = id;
        syncBottomNavVisibility();

        // Screen-enter hooks
        if (id === 'settings') renderSettingsFolderList();
    }

    function pop() {
        if (historyStack.length <= 1) return;
        const outId = historyStack.pop();
        const inId = historyStack[historyStack.length - 1];
        const outgoing = getEl(outId);
        const incoming = getEl(inId);
        if (!outgoing || !incoming) return;

        // Reverse-slide the outgoing screen off to the right
        outgoing.style.transition = 'opacity 0.22s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        outgoing.style.transform = 'translateX(30px)';
        outgoing.style.opacity = '0';

        incoming.classList.remove('behind');
        incoming.style.transition = 'opacity 0.22s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        incoming.style.transform = 'translateX(0)';
        incoming.style.opacity = '1';
        incoming.classList.add('active');

        activeId = inId;
        syncBottomNavVisibility();

        // Clean up outgoing after transition completes
        const cleanup = () => {
            outgoing.classList.remove('active');
            outgoing.classList.add('behind');
            outgoing.style.removeProperty('transition');
            outgoing.style.removeProperty('transform');
            outgoing.style.removeProperty('opacity');
            incoming.style.removeProperty('transition');
            incoming.style.removeProperty('transform');
            incoming.style.removeProperty('opacity');
            outgoing.removeEventListener('transitionend', cleanup);
        };
        outgoing.addEventListener('transitionend', cleanup, { once: true });
        // Fallback in case transitionend doesn't fire
        setTimeout(cleanup, 350);
    }

    function openPlaceholderScreen(title = 'Placeholder', description = 'This part of the app does not have working logic yet.') {
        const titleEl = getEl('placeholder-feature-title');
        const copyEl = getEl('placeholder-feature-copy');
        if (titleEl) titleEl.textContent = String(title || 'Placeholder');
        if (copyEl) copyEl.textContent = String(description || 'This part of the app does not have working logic yet.');
        push('placeholder_screen');
    }

    function toggleOverlay(id) {
        const el = getEl(id);
        if (!el) return;
        pOpen = !el.classList.contains('active');
        el.classList.toggle('active', pOpen);
        if (id === 'player' && pOpen) {
            el.scrollTop = 0;
            syncNowPlayingArt();
        }
        syncBottomNavVisibility();
        scheduleNowPlayingMarquee(document);
    }

    // Party
    function setRole(r) {
        if (pState !== 'disconnected') return;
        role = r;
        getEl('btn-host')?.classList.toggle('active', r === 'host');
        getEl('btn-guest')?.classList.toggle('active', r === 'guest');
        getEl('join-code-box').style.display = r === 'guest' ? 'flex' : 'none';
        getEl('party-action-btn').innerText = r === 'host' ? 'Create Session' : 'Join Session';
        setJoinCodeError('');
    }

    function setJoinCodeError(msg) {
        let err = getEl('join-code-error');
        const box = getEl('join-code-box');
        if (!box) return;

        if (!err) {
            err = document.createElement('div');
            err.id = 'join-code-error';
            err.style.cssText = 'font-size:12px; color:var(--sys-error); margin:8px 2px 0; min-height:16px;';
            box.insertAdjacentElement('afterend', err);
        }

        err.textContent = msg || '';
    }

    function slog(msg, color = 'var(--sys-success)') {
        const log = getEl('party-log');
        if (!log) return;
        const d = document.createElement('div');
        d.className = 'trace-line';
        d.style.color = color;
        d.innerText = `[${new Date().toISOString().substring(11, 19)}] ${msg}`;
        log.prepend(d);
    }

    function validateGuestCode() {
        const input = getEl('join-code-input');
        if (!input) return null;
        const code = input.value.trim().toUpperCase();
        input.value = code;

        if (!/^[A-Z0-9]{4,6}$/.test(code)) {
            setJoinCodeError('Enter 4-6 uppercase letters or numbers.');
            input.style.borderColor = 'var(--sys-error)';
            input.focus();
            toast('Invalid join code');
            return null;
        }

        input.style.borderColor = '';
        setJoinCodeError('');
        return code;
    }

    function startParty() { /* Party sessions removed */ }

    function leaveParty() { /* Party sessions removed */ }
    // Search + Sort
    function normalizeSortLabel(v) {
        if (v === 'A ? Z' || v === 'A -> Z') return 'A-Z';
        return v;
    }

    currentSort = normalizeSortLabel(currentSort);

    function getActiveFilterTypes() {
        if (searchFilters.has('all')) return ['songs', 'albums', 'artists'];
        return Array.from(searchFilters);
    }

    function compareItemsForCurrentSort(a, b) {
        const titleA = String(a.title || '');
        const titleB = String(b.title || '');
        let diff = 0;
        switch (currentSort) {
            case 'A-Z':
                diff = titleA.localeCompare(titleB);
                break;
            case 'Most Played':
                diff = (b.plays || 0) - (a.plays || 0);
                break;
            case 'Duration':
                diff = (b.duration || 0) - (a.duration || 0);
                break;
            default:
                diff = (b.added || 0) - (a.added || 0);
                break;
        }
        return diff || titleA.localeCompare(titleB);
    }

    function sortItems(items, options = {}) {
        const copy = [...items];
        if (options.queryActive) {
            copy.sort((a, b) => (
                (b._searchScore || 0) - (a._searchScore || 0)
                || compareItemsForCurrentSort(a, b)
            ));
            return copy;
        }
        copy.sort(compareItemsForCurrentSort);
        return copy;
    }

    function getSearchTerms(query) {
        const normalized = normalizeSearchText(query);
        return normalized ? normalized.split(' ').filter(Boolean) : [];
    }

    function getSearchFieldScore(value, fullQuery, terms, weight) {
        const text = normalizeSearchText(value);
        if (!text) return 0;

        let score = 0;
        if (fullQuery) {
            if (text === fullQuery) score += weight * 8;
            else if (text.startsWith(fullQuery)) score += weight * 6;
            else if (text.includes(fullQuery)) score += weight * 4;
        }

        terms.forEach((term) => {
            if (text === term) score += weight * 5;
            else if (text.startsWith(term)) score += weight * 3;
            else if (text.includes(term)) score += weight;
        });
        return score;
    }

    function getSearchMatchScore(item, query) {
        const fullQuery = normalizeSearchText(query);
        const terms = getSearchTerms(query);
        if (!fullQuery || terms.length === 0) return 1;

        const index = item?._searchIndex || createSearchIndex({
            title: item?.title || '',
            subtitle: item?.subtitle || '',
            artist: item?.artist || item?.name || '',
            album: item?.albumTitle || '',
            genre: item?.genre || '',
            year: item?.year || ''
        });
        const haystack = index.text || '';
        if (!terms.every((term) => haystack.includes(term))) return 0;

        const weights = {
            title: 100,
            artist: 75,
            album: 65,
            albums: 55,
            tracks: 50,
            subtitle: 35,
            genre: 25,
            year: 20,
            path: 5
        };
        return Object.entries(index.fields || {}).reduce((total, [field, values]) => {
            const weight = weights[field] || 10;
            return total + (Array.isArray(values) ? values : [values]).reduce(
                (fieldTotal, value) => fieldTotal + getSearchFieldScore(value, fullQuery, terms, weight),
                0
            );
        }, 0);
    }

    function appendSearchMetaToken(line, label, onClick) {
        if (!label) return;
        if (line.childElementCount > 0) {
            const sep = document.createElement('span');
            sep.className = 'zenith-meta-sep';
            line.appendChild(sep);
        }
        if (typeof onClick === 'function') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'zenith-meta-link';
            btn.textContent = label;
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                onClick();
            });
            line.appendChild(btn);
            return;
        }
        const text = document.createElement('span');
        text.textContent = label;
        line.appendChild(text);
    }

    function buildSearchSubtextLine(item) {
        const line = document.createElement('div');
        line.className = 'zenith-meta zenith-meta-row';
        if (item.type === 'songs') {
            appendSearchMetaToken(line, item.artist || '', () => routeToArtistProfile(item.artist));
            appendSearchMetaToken(line, item.albumTitle || '', () => routeToAlbumDetail(item.albumTitle, item.artist, getTrackSourceAlbumIdentity(item)));
            if (item.genre) appendSearchMetaToken(line, item.genre, () => routeToGenreBrowse(item.genre));
            if (item.duration > 0) appendSearchMetaToken(line, toDurationLabel(item.duration));
            return line;
        }
        if (item.type === 'albums') {
            appendSearchMetaToken(line, item.artist || '', () => routeToArtistProfile(item.artist));
            appendSearchMetaToken(line, `${Number(item.trackCount || 0)} tracks`);
            if (item.genre) appendSearchMetaToken(line, item.genre, () => routeToGenreBrowse(item.genre));
            return line;
        }
        appendSearchMetaToken(line, item.subtitle || '');
        return line;
    }

    function buildSearchRow(item) {
        if (item?.type === 'songs' && typeof createLibrarySongRow === 'function') {
            const track = resolveTrackMeta(item.title, item.artist, item.albumTitle);
            const row = createLibrarySongRow(track, true, {
                compact: true,
                showDuration: true,
                hideAlbum: false,
                metaContext: 'search'
            });
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'songs';
            return row;
        }

        if (item?.type === 'albums' && typeof createCollectionRow === 'function') {
            const resolvedAlbum = resolveAlbumMeta(item.albumTitle || item.title, item.artist);
            const albumItem = resolvedAlbum || {
                title: item.title,
                artist: item.artist || ARTIST_NAME,
                year: item.year || '',
                trackCount: Number(item.trackCount || 0),
                genre: item.genre || '',
                artUrl: item.artUrl || '',
                tracks: Array.isArray(item.tracks) ? item.tracks.slice() : []
            };
            const row = createCollectionRow('album', albumItem, 'search');
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'albums';
            return row;
        }

        if (item?.type === 'artists' && typeof createCollectionRow === 'function') {
            const key = toArtistKey(item.name || item.artist || item.title);
            const resolvedArtist = artistByKey.get(key) || LIBRARY_ARTISTS.find((artist) => toArtistKey(artist.name) === key);
            const artistItem = resolvedArtist || {
                name: item.name || item.artist || item.title || ARTIST_NAME,
                artUrl: item.artUrl || '',
                albumCount: Number(item.albumCount || 0),
                trackCount: Number(item.trackCount || 0),
                plays: Number(item.plays || 0)
            };
            const row = createCollectionRow('artist', artistItem, 'search');
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'artists';
            return row;
        }

        const row = document.createElement('div');
        row.className = 'list-item';
        row.style.cssText = 'padding:12px 0; border-color:var(--border-default);';
        row.dataset.type = item.type;

        const clickable = document.createElement('button');
        clickable.className = 'item-clickable';
        clickable.type = 'button';

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        applyArtBackground(
            icon,
            item.artUrl || '',
            item.type === 'songs'
                ? 'linear-gradient(135deg, #FF6B6B, #818CF8)'
                : item.type === 'albums'
                    ? FALLBACK_GRADIENT
                    : 'linear-gradient(135deg, #0ea5e9, #14b8a6)'
        );

        const content = document.createElement('div');
        content.className = 'item-content';

        const h3 = document.createElement('h3');
        h3.textContent = item.title;

        content.appendChild(h3);
        content.appendChild(buildSearchSubtextLine(item));
        clickable.appendChild(icon);
        clickable.appendChild(content);

        clickable.addEventListener('click', item.action);
        clickable.addEventListener('mousedown', (e) => startLongPress(e, item.title, item.subtitle));
        clickable.addEventListener('mouseup', clearLongPress);
        clickable.addEventListener('mouseleave', clearLongPress);
        clickable.addEventListener('touchstart', (e) => startLongPress(e, item.title, item.subtitle), { passive: true });
        clickable.addEventListener('touchend', clearLongPress, { passive: true });

        row.appendChild(clickable);
        return row;
    }

    function renderSearchResults() {
        const resultsEl = getEl('search-results');
        if (!resultsEl) return;

        const activeTypes = getActiveFilterTypes();
        const q = normalizeSearchText(searchQuery);

        let filtered = SEARCH_DATA.map((item) => {
            if (!activeTypes.includes(item.type)) return false;
            if (q.length > 0) {
                const score = getSearchMatchScore(item, searchQuery);
                return score > 0 ? { ...item, _searchScore: score } : false;
            }
            return item;
        }).filter(Boolean);

        filtered = sortItems(filtered, { queryActive: q.length > 0 });
        clearTrackUiRegistryForRoot(resultsEl);
        resultsEl.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'list-wrap';
        wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'card';
            empty.style.cssText = 'padding:20px; text-align:center;';
            const title = document.createElement('h3');
            title.style.marginBottom = '8px';
            title.textContent = searchQuery ? `No results for "${searchQuery}"` : 'No matching media';
            const copy = document.createElement('p');
            copy.style.margin = '0';
            copy.textContent = 'Try another filter or clear your query.';
            empty.appendChild(title);
            empty.appendChild(copy);
            resultsEl.appendChild(empty);
            return;
        }

        filtered.forEach(item => wrap.appendChild(buildSearchRow(item)));
        resultsEl.appendChild(wrap);
    }

    function applySortToBrowseGrid() {
        const grid = getEl('search-cat-grid');
        if (!grid) return;

        const cards = Array.from(grid.querySelectorAll('.cat-card'));
        const decorated = cards.map((card, index) => {
            if (!card.dataset.added) card.dataset.added = String(cards.length - index);
            if (!card.dataset.plays) card.dataset.plays = String((index + 1) * 10);
            if (!card.dataset.duration) card.dataset.duration = String(180 + index * 12);
            return {
                card,
                title: card.innerText.trim(),
                added: Number(card.dataset.added),
                plays: Number(card.dataset.plays),
                duration: Number(card.dataset.duration)
            };
        });

        switch (currentSort) {
            case 'A-Z':
                decorated.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'Most Played':
                decorated.sort((a, b) => b.plays - a.plays);
                break;
            case 'Duration':
                decorated.sort((a, b) => b.duration - a.duration);
                break;
            default:
                decorated.sort((a, b) => b.added - a.added);
                break;
        }

        decorated.forEach(item => grid.appendChild(item.card));
    }

    function updateSortIndicators() {
        document.querySelectorAll('.sort-indicator').forEach(node => {
            node.textContent = currentSort;
            node.title = `Sort: ${currentSort}`;
        });
    }

    function ensureSortIndicators() {
        const triggers = Array.from(document.querySelectorAll('div.icon-btn[onclick="openSearchSort()"]'));
        triggers.forEach(btn => {
            const parent = btn.parentElement;
            if (!parent) return;
            let indicator = parent.querySelector('.sort-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'sort-indicator';
                indicator.style.cssText = 'font-size:11px; color:var(--text-tertiary); margin-left:8px; white-space:nowrap;';
                parent.appendChild(indicator);
            }
        });
        updateSortIndicators();
    }

    function renderSearchState() {
        const results = getEl('search-results');
        const browse = getEl('search-browse');
        const libTabs = getEl('lib-tabs-container');
        const searchFilterRow = getEl('search-filter-row');
        const searchTagRow = getEl('search-tag-row');
        if (!results || !browse) return;

        const libScreen = getEl('library');
        const inSearchMode = typeof searchModeActive !== 'undefined' && searchModeActive;

        if (inSearchMode) {
            if (libScreen) libScreen.classList.add('search-mode');
            browse.style.display = 'none';
            // show results only when there is an actual query
            results.style.display = searchQuery.length > 0 ? 'block' : 'none';
            if (searchQuery.length > 0) renderSearchResults();
        } else {
            if (libScreen) libScreen.classList.remove('search-mode');
            browse.style.display = 'none';
            results.style.display = 'none';
            if (libTabs) libTabs.style.display = 'block';
        }

        updateSortIndicators();
    }

    function setSort(sortName) {
        currentSort = normalizeSortLabel(sortName);
        safeStorage.setItem(STORAGE_KEYS.sort, currentSort);
        toast(`Sorting: ${currentSort}`);
        renderSearchState();
        updateSortIndicators();
    }

    function openSearchSort() {
        getEl('sheet-title').innerText = 'Sort & Order';
        getEl('sheet-sub').innerText = `Current: ${currentSort}`;
        const actions = document.querySelectorAll('#action-sheet .sheet-action');

        if (actions.length > 3) {
            actions[0].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg> Recently Added';
            actions[1].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg> A-Z';
            actions[2].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Most Played';
            actions[3].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> Duration';

            actions[0].onclick = () => { setSort('Recently Added'); closeSheet(); };
            actions[1].onclick = () => { setSort('A-Z'); closeSheet(); };
            actions[2].onclick = () => { setSort('Most Played'); closeSheet(); };
            actions[3].onclick = () => { setSort('Duration'); closeSheet(); };
        }

        openSheet('Sort & Order', `Current: ${currentSort}`);
    }

    function toggleSearchFilter(chip) {
        const row = getEl('search-filter-row');
        if (!row || !chip) return;
        const filter = chip.dataset.filter;

        // Radio-style: one selection at a time; clicking active non-all â†’ back to all
        if (filter === 'all' || searchFilters.has(filter)) {
            searchFilters.clear();
            searchFilters.add('all');
        } else {
            searchFilters.clear();
            searchFilters.add(filter);
        }

        row.querySelectorAll('.filter-chip').forEach(node => {
            const f = node.dataset.filter;
            node.classList.toggle('active', searchFilters.has(f));
        });

        renderSearchState();
    }
    // Player / Media
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

    function openPlaylist(playlistId) {
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
            const tc = playlist.tracks.length;
            subEl.textContent = `${tc} ${tc === 1 ? 'song' : 'songs'}`;
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
            playlist.tracks.slice(0, 200).forEach((track, idx) => {
                list.appendChild(makeAlbumTrackRow(track, idx, {
                    onActivate: () => playPlaylistInOrder(playlist.id, idx),
                    onLongPress: () => openTrackZenithMenu(track),
                    isLast: idx === Math.min(playlist.tracks.length, 200) - 1,
                    showArtist: true
                }));
            });
        }

        setPlayButtonState(isPlaying);
        push('playlist_detail');
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

    function createQueueSectionHeading(title, detail = '') {
        const head = document.createElement('div');
        head.className = 'queue-section-heading';

        const heading = document.createElement('h3');
        heading.className = 'queue-section-title';
        heading.textContent = title;
        head.appendChild(heading);

        if (detail) {
            const meta = document.createElement('div');
            meta.className = 'queue-section-detail';
            meta.textContent = detail;
            head.appendChild(meta);
        }
        return head;
    }

    function createQueueEmptyState(message, ctaLabel = '', onClick = null) {
        const card = document.createElement('div');
        card.className = 'queue-empty-card';

        const copy = document.createElement('div');
        copy.className = 'queue-empty-copy';
        copy.textContent = message;
        card.appendChild(copy);

        if (ctaLabel && typeof onClick === 'function') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'queue-utility-btn is-primary';
            btn.textContent = ctaLabel;
            btn.addEventListener('click', onClick);
            card.appendChild(btn);
        }

        return card;
    }

    function createQueueOverviewCard(track, upcomingCount, totalCount, remainingLabel) {
        const card = document.createElement('div');
        card.className = 'queue-overview-card';

        const eyebrow = document.createElement('div');
        eyebrow.className = 'queue-overview-eyebrow';
        eyebrow.textContent = track ? 'Current session' : 'Queue ready';
        card.appendChild(eyebrow);

        const headline = document.createElement('div');
        headline.className = 'queue-overview-headline';
        headline.textContent = track ? (track.title || 'Untitled Track') : 'Start playback to build your queue';
        card.appendChild(headline);

        const subline = document.createElement('div');
        subline.className = 'queue-overview-subline';
        subline.textContent = track
            ? `${getCanonicalTrackArtistName(track, track.artist || ARTIST_NAME) || ARTIST_NAME}${track.albumTitle ? ` â€¢ ${track.albumTitle}` : ''}`
            : 'Queue from any song, album, or playlist.';
        card.appendChild(subline);

        const stats = document.createElement('div');
        stats.className = 'queue-overview-stats';
        [
            `${totalCount} total`,
            `${upcomingCount} up next`,
            remainingLabel || 'Ready'
        ].forEach((label) => {
            const pill = document.createElement('span');
            pill.className = 'queue-overview-pill';
            pill.textContent = label;
            stats.appendChild(pill);
        });
        card.appendChild(stats);

        return card;
    }

    function renderQueue() {
        const list = getEl('queue-list');
        const inlineList = getEl('player-inline-queue-list');
        const kickerEl = getEl('queue-kicker');
        const summaryEl = getEl('queue-summary');
        const clearBtn = getEl('queue-clear-btn');
        const engine = ensureAudioEngine();
        if (!list) return;
        clearTrackUiRegistryForRoot(list);
        if (inlineList) clearTrackUiRegistryForRoot(inlineList);
        list.innerHTML = '';
        if (inlineList) inlineList.innerHTML = '';

        const { currentIdx, currentEntry, upNextEntries, inlineEntries } = getQueueViewModel();
        const hasQueue = queueTracks.length > 0;
        const currentTrack = currentEntry?.track || null;
        const upcomingCount = upNextEntries.length;
        const currentSeconds = engine && Number.isFinite(engine.currentTime) ? engine.currentTime : 0;
        const currentDuration = engine && Number.isFinite(engine.duration) && engine.duration > 0
            ? engine.duration
            : (nowPlaying?.durationSec || 0);
        const remainingLabel = hasQueue
            ? getQueueMetaTimeLabel(Math.max(0, currentIdx), currentSeconds, currentDuration)
            : '';
        if (kickerEl) kickerEl.textContent = hasQueue ? 'Playback Queue' : 'Queue';
        if (summaryEl) {
            if (!hasQueue) summaryEl.textContent = 'Queue is empty';
            else summaryEl.textContent = upcomingCount
                ? `${upcomingCount} tracks queued after now playing â€¢ ${remainingLabel}`
                : 'No tracks are queued after the current song';
        }
        if (clearBtn) {
            clearBtn.disabled = !hasQueue || upcomingCount === 0;
            clearBtn.setAttribute('aria-label', upcomingCount ? 'Clear up next' : 'Clear up next unavailable');
            clearBtn.title = upcomingCount ? 'Clear Up Next' : 'Nothing queued after the current song';
        }

        if (!hasQueue) {
            list.appendChild(createQueueEmptyState('Queue is empty. Find something to play and it will appear here.', 'Find Music', () => {
                if (activeId === 'queue') pop();
                const libraryTab = getEl('tabs')?.querySelectorAll('.nav-item')[1];
                switchTab('library', libraryTab);
            }));
            if (inlineList) {
                const inlineEmpty = document.createElement('div');
                inlineEmpty.className = 'queue-inline-empty';
                inlineEmpty.textContent = 'No tracks queued yet.';
                inlineList.appendChild(inlineEmpty);
            }
            bindQueueInteractions();
            ensureAccessibility();
            return;
        }

        list.appendChild(createQueueOverviewCard(currentTrack, upcomingCount, queueTracks.length, remainingLabel));

        if (currentEntry) {
            list.appendChild(createQueueSectionHeading('Now Playing', currentTrack?.duration || ''));
            list.appendChild(createQueueTrackRow(currentEntry.track, {
                queueIndex: currentEntry.index,
                isCurrent: true,
                supportingText: 'Playback continues while you reorder what comes next.',
                badgeLabel: isPlaying ? 'Playing now' : 'Ready to resume',
                badgeTone: isPlaying ? 'live' : 'muted',
                onActivate: () => {
                    if (Date.now() < queueDragSuppressUntil) return;
                    playQueueTrackAt(currentEntry.index, true);
                },
                onLongPress: () => openQueueTrackMenu(currentEntry.track, currentEntry.index),
                onMenu: () => openQueueTrackMenu(currentEntry.track, currentEntry.index)
            }));
        }

        list.appendChild(createQueueSectionHeading('Up Next', upcomingCount ? `${upcomingCount} tracks` : 'Nothing queued'));
        if (!upNextEntries.length) {
            list.appendChild(createQueueEmptyState('You are at the end of the queue. Add more music or shuffle another album.'));
        } else {
            upNextEntries.forEach(({ track, index }, offset) => {
                const row = createQueueTrackRow(track, {
                    queueIndex: index,
                    reorderable: true,
                    badgeLabel: offset === 0 ? 'Next' : `#${offset + 2}`,
                    badgeTone: offset === 0 ? 'next' : 'muted',
                    onActivate: () => {
                        if (Date.now() < queueDragSuppressUntil) return;
                        playQueueTrackAt(index, true);
                    },
                    onLongPress: () => openQueueTrackMenu(track, index),
                    onMenu: () => openQueueTrackMenu(track, index)
                });
                makeSwipeable(row, {
                    onSwipeRight: () => pickPlaylistForTrack(track),
                    onSwipeLeft: () => removeQueueTrack(index),
                    leftLabel: 'Remove'
                });
                list.appendChild(row);
            });
        }

        if (inlineList) {
            if (!inlineEntries.length) {
                const inlineEmpty = document.createElement('div');
                inlineEmpty.className = 'queue-inline-empty';
                inlineEmpty.textContent = 'Nothing queued after the current track.';
                inlineList.appendChild(inlineEmpty);
            } else {
                inlineEntries.forEach(({ track, index }, offset) => {
                    inlineList.appendChild(createQueueTrackRow(track, {
                        queueIndex: index,
                        compact: true,
                        badgeLabel: offset === 0 ? 'Next' : '',
                        badgeTone: 'next',
                        showDuration: false,
                        onActivate: () => playQueueTrackAt(index, true)
                    }));
                });
            }
        }

        const footer = document.createElement('div');
        footer.className = 'queue-footer-actions';
        const shuffleBtn = document.createElement('button');
        shuffleBtn.type = 'button';
        shuffleBtn.className = 'queue-utility-btn';
        shuffleBtn.textContent = 'Shuffle Up Next';
        shuffleBtn.disabled = upcomingCount < 2;
        shuffleBtn.addEventListener('click', shuffleQueueUpNext);
        const clearUpNextBtn = document.createElement('button');
        clearUpNextBtn.type = 'button';
        clearUpNextBtn.className = 'queue-utility-btn';
        clearUpNextBtn.textContent = 'Clear Up Next';
        clearUpNextBtn.disabled = upcomingCount === 0;
        clearUpNextBtn.addEventListener('click', clearQueue);
        footer.appendChild(shuffleBtn);
        footer.appendChild(clearUpNextBtn);
        list.appendChild(footer);

        bindQueueInteractions();
        ensureAccessibility();
    }

    function toggleEditMode() {
        inEditMode = !inEditMode;
        const home = getEl('home');
        const btn = getEl('edit-home-btn');
        if (!home || !btn) return;

        if (inEditMode) {
            home.classList.add('home-editor-active');
            btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
            btn.style.background = 'var(--sys-success)';
            toast('Workspace Editor Unlocked');
        } else {
            home.classList.remove('home-editor-active');
            btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>';
            btn.style.background = 'rgba(255,255,255,0.1)';
            toast('Layout Settings Saved');
        }
    }

    // Search tags
    function toggleSearchTag(el, tagText) {
        el.classList.toggle('active');
        const searchInput = getEl('search-input');
        if (!searchInput) return;
        const container = searchInput.parentElement;

        if (el.classList.contains('active')) {
            const span = document.createElement('div');
            span.className = 'search-inline-tag';
            span.innerText = '# ' + tagText;
            span.onclick = (e) => {
                e.stopPropagation();
                span.remove();
                el.classList.remove('active');
            };
            container.insertBefore(span, searchInput);
        } else {
            container.querySelectorAll('.search-inline-tag').forEach(t => {
                if (t.innerText === '# ' + tagText) t.remove();
            });
        }
    }

    function openTagCreator() {
        getEl('tag-creator-scrim').classList.add('show');
        getEl('tag-creator').classList.add('show');
        setTimeout(() => getEl('new-tag-input')?.focus(), 250);
    }

    function closeTagCreator() {
        getEl('tag-creator-scrim').classList.remove('show');
        getEl('tag-creator').classList.remove('show');
    }

    function createTag() {
        const input = getEl('new-tag-input');
        const name = (input?.value || '').trim();
        if (!name) return;

        const row = getEl('search-tag-row');
        const addBtn = getEl('add-tag-btn');
        if (!row || !addBtn) return;

        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.draggable = true;
        chip.dataset.tag = name;
        chip.style.cssText = 'background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; gap:8px; cursor:pointer;';

        const hash = document.createElement('span');
        hash.style.cssText = 'color:var(--sys-primary); font-weight:800;';
        hash.textContent = '#';

        chip.appendChild(hash);
        chip.appendChild(document.createTextNode(' ' + name));
        chip.onclick = function () { toggleSearchTag(this, name); };

        row.insertBefore(chip, addBtn);
        input.value = '';
        closeTagCreator();
        toast(`Tag "#${name}" created`);

        bindDragAndDrop('#search-tag-row .filter-chip[draggable="true"]');
        bindTouchReorder('#search-tag-row .filter-chip[draggable="true"]');
        ensureAccessibility();
    }

    // Sheet / Sidebar
    function openSheet(title, sub) {
        getEl('sheet-title').innerText = title;
        getEl('sheet-sub').innerText = sub;
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
        // Navigate to the new playlist if in the library
        if (typeof routeToPlaylistDetail === 'function') routeToPlaylistDetail(pl.id);
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
/* <<< 04-navigation-renderers.js */

/* >>> 05-media-folder-idb.js */
/*
 * Auralis JS shard: 05-media-folder-idb.js
 * Purpose: IndexedDB media folders, scanning, fallback folder picker plumbing
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        const scrim = getEl('image-viewer-scrim');
        if (!scrim) return;
        scrim.classList.remove('show');
        albumArtViewerOpen = false;
        syncBottomNavVisibility();
        const focusTarget = albumArtViewerLastFocus;
        albumArtViewerLastFocus = null;
        if (focusTarget && typeof focusTarget.focus === 'function') {
            setTimeout(() => focusTarget.focus({ preventScroll: true }), 0);
        }
    }

    // Onboarding
    function dismissOnboarding() {
        const ob = getEl('onboarding');
        if (!ob) return;
        safeStorage.setItem(ONBOARDED_KEY, '1');
        ob.classList.remove('active');
        setTimeout(() => {
            ob.style.display = 'none';
        if (safeStorage.getItem(SETUP_DONE_KEY) !== '1') {
                showFirstTimeSetup();
            } else {
                syncBottomNavVisibility();
            }
        }, 500);
    }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Â§ MEDIA FOLDER SYSTEM â€” Real File System Access + IndexedDB
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    const AUDIO_EXTENSIONS = new Set(['mp3','flac','wav','ogg','opus','aac','m4a','wma','aiff','alac','ape','webm']);
    const IMAGE_EXTENSIONS = new Set(['jpg','jpeg','png','webp','gif','bmp']);
    const ART_FILENAME_PATTERNS = ['cover','folder','album art','front','albumart','albumartsmall','thumb','artwork','scan','booklet','image','art','jacket','sleeve','insert','disc','cd','back','inlay'];

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Â§ LIGHTWEIGHT METADATA PARSER â€” ID3v2, Vorbis Comment, MP4 atoms
    // Reads embedded artwork + full tags from File objects (ArrayBuffer).
    // Zero external dependencies.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Parse as many bytes as we need from the start of a File.
     * ID3v2 headers are at offset 0, so we read a safe chunk upfront.
     */
    async function readFileChunk(file, maxBytes = 0) {
        const size = maxBytes > 0 ? Math.min(file.size, maxBytes) : file.size;
        const buf = await file.slice(0, size).arrayBuffer();
        return new Uint8Array(buf);
    }

    /**
     * Read the last N bytes of a File (needed for ID3v1 tags at EOF).
     */
    async function readFileTail(file, tailBytes = 128) {
        if (file.size < tailBytes) return new Uint8Array(0);
        const buf = await file.slice(file.size - tailBytes).arrayBuffer();
        return new Uint8Array(buf);
    }

    /**
     * Decode a syncsafe integer (ID3v2.4 uses these for tag/frame sizes).
     */
    function decodeSyncsafe(b0, b1, b2, b3) {
        return ((b0 & 0x7F) << 21) | ((b1 & 0x7F) << 14) | ((b2 & 0x7F) << 7) | (b3 & 0x7F);
    }

    /**
     * Read a null-terminated or fixed-length Latin-1/UTF-8/UTF-16 string
     * from a Uint8Array at offset `start` with length `len`.
     * `encoding`: 0=Latin-1, 1=UTF-16 BOM, 2=UTF-16 BE, 3=UTF-8
     */
    function decodeID3String(bytes, start, len, encoding) {
        const slice = bytes.subarray(start, start + len);
        try {
            if (encoding === 1 || encoding === 2) {
                // UTF-16: strip BOM if present, find null terminator (two 0x00)
                let s = start;
                let hasBom = false;
                let isBE = encoding === 2;
                if (encoding === 1 && s + 1 < start + len) {
                    if (bytes[s] === 0xFF && bytes[s + 1] === 0xFE) { s += 2; hasBom = true; isBE = false; }
                    else if (bytes[s] === 0xFE && bytes[s + 1] === 0xFF) { s += 2; hasBom = true; isBE = true; }
                }
                const end = Math.min(start + len, bytes.length);
                const subSlice = bytes.subarray(s, end);
                return new TextDecoder(isBE ? 'utf-16be' : 'utf-16le').decode(subSlice).replace(/\0.*$/, '');
            }
            if (encoding === 3) {
                return new TextDecoder('utf-8').decode(slice).replace(/\0.*$/, '');
            }
            // Latin-1
            return new TextDecoder('latin1').decode(slice).replace(/\0.*$/, '');
        } catch (_) {
            return '';
        }
    }

    /**
     * Parse ID3v2.2, 2.3 or 2.4 tags from the given bytes.
     * Returns { title, artist, album, year, genre, trackNo, pictureMime, pictureData }
     */
    function parseID3v2(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0, lyrics: '', replayGainTrack: NaN, replayGainAlbum: NaN };
        if (bytes.length < 10) return result;
        // Check header
        if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return result; // 'ID3'
        const majorVersion = bytes[3]; // 2, 3 or 4
        const flags = bytes[5];
        const hasExtHeader = (flags & 0x40) !== 0;
        const tagSize = decodeSyncsafe(bytes[6], bytes[7], bytes[8], bytes[9]);

        let pos = 10;
        if (hasExtHeader) {
            // Skip extended header
            const extSize = majorVersion === 4
                ? decodeSyncsafe(bytes[10], bytes[11], bytes[12], bytes[13])
                : ((bytes[10] << 24) | (bytes[11] << 16) | (bytes[12] << 8) | bytes[13]);
            pos += extSize;
        }

        const end = Math.min(10 + tagSize, bytes.length);
        const isV22 = majorVersion === 2;
        const frameIdLen = isV22 ? 3 : 4;
        const frameSizeLen = isV22 ? 3 : 4;

        let pictureMime = '';
        let pictureData = null;

        while (pos + frameIdLen + frameSizeLen < end) {
            // Frame ID
            const frameId = String.fromCharCode(...bytes.subarray(pos, pos + frameIdLen));
            pos += frameIdLen;
            if (frameId === '\0\0\0\0' || frameId === '\0\0\0') break; // padding

            // Frame size
            let frameSize;
            if (isV22) {
                frameSize = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
                pos += 3;
            } else if (majorVersion === 4) {
                frameSize = decodeSyncsafe(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
                pos += 4;
                pos += 2; // flags
            } else {
                frameSize = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
                pos += 4;
                pos += 2; // flags
            }

            if (frameSize <= 0 || pos + frameSize > end) break;

            const dataStart = pos;
            const encoding = bytes[dataStart];

            // Text frames
            const textFrames = isV22
                ? { TT2: 'title', TP1: 'artist', TP2: 'albumArtist', TAL: 'album', TYE: 'year', TCO: 'genre', TRK: 'trackNo', TPA: 'discNo' }
                : { TIT2: 'title', TPE1: 'artist', TPE2: 'albumArtist', TALB: 'album', TDRC: 'year', TYER: 'year', TCON: 'genre', TRCK: 'trackNo', TPOS: 'discNo' };

            if (textFrames[frameId]) {
                const str = decodeID3String(bytes, dataStart + 1, frameSize - 1, encoding).trim();
                if (textFrames[frameId] === 'trackNo') {
                    result.trackNo = parseInt(str.split('/')[0], 10) || 0;
                } else if (textFrames[frameId] === 'discNo') {
                    result.discNo = parseInt(str.split('/')[0], 10) || 0;
                } else if (textFrames[frameId] === 'genre') {
                    // Strip ID3v1 numeric genre codes like "(17)" â†’ "Rock"
                    result.genre = str.replace(/^\((\d+)\).*/, (_, n) => ID3_GENRES[parseInt(n, 10)] || str).trim();
                } else if (!result[textFrames[frameId]]) {
                    result[textFrames[frameId]] = str;
                }
            }

            // Picture frame
            const picFrame = isV22 ? 'PIC' : 'APIC';
            if (frameId === picFrame && !pictureData) {
                let p = dataStart + 1; // skip encoding byte
                if (isV22) {
                    // ID3v2.2 PIC: encoding(1) + image_format(3) + picture_type(1) + description + null + data
                    const imgFmt = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2]).toUpperCase();
                    p += 3;
                    pictureMime = imgFmt === 'PNG' ? 'image/png' : 'image/jpeg';
                } else {
                    // APIC: encoding(1) + mime_string + null(1) + picture_type(1) + description + null + data
                    let mimeEnd = p;
                    while (mimeEnd < pos + frameSize && bytes[mimeEnd] !== 0) mimeEnd++;
                    pictureMime = new TextDecoder('latin1').decode(bytes.subarray(p, mimeEnd));
                    if (!pictureMime || pictureMime === 'PNG') pictureMime = 'image/png';
                    if (pictureMime === 'JPG') pictureMime = 'image/jpeg';
                    if (!pictureMime.startsWith('image/')) pictureMime = 'image/jpeg';
                    p = mimeEnd + 1; // skip null terminator
                }
                const picType = bytes[p]; p++; // picture type (3 = front cover)
                // Skip description (null-terminated, respect encoding)
                const nullStride = (encoding === 1 || encoding === 2) ? 2 : 1;
                while (p < pos + frameSize - nullStride) {
                    if (nullStride === 2 ? (bytes[p] === 0 && bytes[p + 1] === 0) : bytes[p] === 0) { p += nullStride; break; }
                    p += nullStride;
                }
                // Only use front cover (type 3) unless no other found
                if (p < pos + frameSize && (picType === 3 || !pictureData)) {
                    const candidateData = bytes.slice(p, pos + frameSize);
                    // Validate image magic: JPEG (FF D8) or PNG (89 50 4E 47)
                    const isJpeg = candidateData.length > 2 && candidateData[0] === 0xFF && candidateData[1] === 0xD8;
                    const isPng  = candidateData.length > 4 && candidateData[0] === 0x89 && candidateData[1] === 0x50 && candidateData[2] === 0x4E && candidateData[3] === 0x47;
                    if (isJpeg || isPng) {
                        pictureData = candidateData;
                        result._pictureMime = pictureMime;
                        result._pictureData = pictureData;
                    }
                }
            }

            // TXXX user-defined text frame (ReplayGain lives here)
            const txxxFrame = isV22 ? 'TXX' : 'TXXX';
            if (frameId === txxxFrame) {
                const str = decodeID3String(bytes, dataStart + 1, frameSize - 1, encoding);
                const nullIdx = str.indexOf('\0');
                if (nullIdx >= 0) {
                    const desc = str.slice(0, nullIdx).toUpperCase().trim();
                    const val = str.slice(nullIdx + 1).trim();
                    if (desc === 'REPLAYGAIN_TRACK_GAIN') result.replayGainTrack = parseFloat(val) || NaN;
                    else if (desc === 'REPLAYGAIN_ALBUM_GAIN') result.replayGainAlbum = parseFloat(val) || NaN;
                }
            }

            // USLT unsynchronized lyrics
            const usltFrame = isV22 ? 'ULT' : 'USLT';
            if (frameId === usltFrame && !result.lyrics) {
                let p = dataStart + 1; // skip encoding byte
                p += 3; // skip language code
                // skip content descriptor (null-terminated)
                const nullStride2 = (encoding === 1 || encoding === 2) ? 2 : 1;
                while (p < pos + frameSize - nullStride2) {
                    if (nullStride2 === 2 ? (bytes[p] === 0 && bytes[p + 1] === 0) : bytes[p] === 0) { p += nullStride2; break; }
                    p += nullStride2;
                }
                if (p < pos + frameSize) {
                    result.lyrics = decodeID3String(bytes, p, pos + frameSize - p, encoding).trim();
                }
            }

            pos += frameSize;
        }

        return result;
    }

    /**
     * Parse Vorbis Comment block (used in FLAC, OGG Vorbis, OGG Opus).
     * For FLAC: starts with 4-byte block header. We look for the VORBIS_COMMENT block (type 4).
     */
    function parseVorbisComment(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0, lyrics: '', replayGainTrack: NaN, replayGainAlbum: NaN };
        if (bytes.length < 4) return result;

        // Find FLAC fLaC marker
        let pos = 0;
        const isFlac = bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43;
        if (!isFlac) return result;
        pos = 4;

        while (pos + 4 <= bytes.length) {
            const blockTypeByte = bytes[pos];
            const isLast = (blockTypeByte & 0x80) !== 0;
            const blockType = blockTypeByte & 0x7F;
            // Valid FLAC block types: 0-6 and 127. Anything else means
            // we've run past metadata into audio frames â€” stop parsing.
            if (blockType > 6 && blockType !== 127) break;
            const blockLen = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;
            if (blockLen < 0 || pos + blockLen > bytes.length) break;

            if (blockType === 4) {
                // VORBIS_COMMENT block â€” little-endian
                let p = pos;
                // vendor string length
                const vendorLen = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
                p += 4 + vendorLen;
                // comment count
                const commentCount = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
                p += 4;
                for (let i = 0; i < commentCount && p + 4 <= pos + blockLen; i++) {
                    const len = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
                    p += 4;
                    const comment = new TextDecoder('utf-8').decode(bytes.subarray(p, p + len));
                    p += len;
                    const eq = comment.indexOf('=');
                    if (eq < 0) continue;
                    const key = comment.slice(0, eq).toUpperCase();
                    const val = comment.slice(eq + 1).trim();
                    if (key === 'TITLE' && !result.title) result.title = val;
                    else if (key === 'ARTIST' && !result.artist) result.artist = val;
                    else if (key === 'ALBUM' && !result.album) result.album = val;
                    else if ((key === 'DATE' || key === 'YEAR') && !result.year) result.year = val.slice(0, 4);
                    else if (key === 'GENRE' && !result.genre) result.genre = val;
                    else if (key === 'TRACKNUMBER' && !result.trackNo) result.trackNo = parseInt(val, 10) || 0;
                    else if (key === 'ALBUMARTIST' && !result.albumArtist) result.albumArtist = val;
                    else if (key === 'DISCNUMBER' && !result.discNo) result.discNo = parseInt(val, 10) || 0;
                    else if ((key === 'LYRICS' || key === 'UNSYNCEDLYRICS') && !result.lyrics) result.lyrics = val;
                    else if (key === 'REPLAYGAIN_TRACK_GAIN') result.replayGainTrack = parseFloat(val) || NaN;
                    else if (key === 'REPLAYGAIN_ALBUM_GAIN') result.replayGainAlbum = parseFloat(val) || NaN;
                }
            }

            // PICTURE block in FLAC (type 6)
            if (blockType === 6 && !result._pictureData) {
                let p = pos;
                if (p + 32 <= pos + blockLen) { // minimum viable PICTURE header
                    const picType = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]; p += 4;
                    const mimeLen = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]; p += 4;
                    if (mimeLen >= 0 && mimeLen < 256 && p + mimeLen <= pos + blockLen) {
                        const mimeStr = new TextDecoder('latin1').decode(bytes.subarray(p, p + mimeLen)); p += mimeLen;
                        const descLen = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]; p += 4;
                        if (descLen >= 0 && descLen < 65536 && p + descLen + 16 + 4 <= pos + blockLen) {
                            p += descLen;
                            p += 16; // width, height, depth, colors
                            const dataLen = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]; p += 4;
                            // Only extract if we have the full picture data (not truncated by chunk boundary)
                            if (dataLen > 0 && p + dataLen <= bytes.length) {
                                const picBytes = bytes.subarray(p, p + dataLen);
                                // Validate image magic: JPEG (FF D8) or PNG (89 50 4E 47)
                                const isJpeg = picBytes[0] === 0xFF && picBytes[1] === 0xD8;
                                const isPng  = picBytes[0] === 0x89 && picBytes[1] === 0x50 && picBytes[2] === 0x4E && picBytes[3] === 0x47;
                                if ((isJpeg || isPng) && (picType === 3 || !result._pictureData)) {
                                    result._pictureMime = mimeStr || (isPng ? 'image/png' : 'image/jpeg');
                                    result._pictureData = picBytes.slice();
                                }
                            }
                        }
                    }
                }
            }

            pos += blockLen;
            if (isLast) break;
        }

        return result;
    }

    /**
     * Minimal ID3v1 fallback (128 bytes at end of MP3).
     */
    function parseID3v1(bytes) {
        if (bytes.length < 128) return null;
        const tag = bytes.subarray(bytes.length - 128);
        if (tag[0] !== 0x54 || tag[1] !== 0x41 || tag[2] !== 0x47) return null; // 'TAG'
        const latin1 = s => new TextDecoder('latin1').decode(s).replace(/\0.*$/, '').trim();
        const trackNo = tag[126] !== 0 && tag[125] === 0 ? tag[126] : 0;
        const genreIdx = tag[127];
        return {
            title:   latin1(tag.subarray(3, 33)),
            artist:  latin1(tag.subarray(33, 63)),
            album:   latin1(tag.subarray(63, 93)),
            year:    latin1(tag.subarray(93, 97)),
            genre:   ID3_GENRES[genreIdx] || '',
            trackNo
        };
    }

    /**
     * Parse Vorbis Comments from OGG Vorbis / OGG Opus containers.
     * Searches OGG pages for the comment header packet.
     */
    function parseOggVorbisComment(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0, lyrics: '', replayGainTrack: NaN, replayGainAlbum: NaN };
        if (bytes.length < 28) return result;

        // Find comment packet by scanning for markers:
        // Vorbis: \x03vorbis  (7 bytes)
        // Opus:   OpusTags    (8 bytes)
        let commentStart = -1;
        for (let i = 0; i < Math.min(bytes.length - 8, 65536); i++) {
            // \x03vorbis
            if (bytes[i] === 0x03 && bytes[i+1] === 0x76 && bytes[i+2] === 0x6F &&
                bytes[i+3] === 0x72 && bytes[i+4] === 0x62 && bytes[i+5] === 0x69 && bytes[i+6] === 0x73) {
                commentStart = i + 7;
                break;
            }
            // OpusTags
            if (bytes[i] === 0x4F && bytes[i+1] === 0x70 && bytes[i+2] === 0x75 && bytes[i+3] === 0x73 &&
                bytes[i+4] === 0x54 && bytes[i+5] === 0x61 && bytes[i+6] === 0x67 && bytes[i+7] === 0x73) {
                commentStart = i + 8;
                break;
            }
        }
        if (commentStart < 0 || commentStart + 8 > bytes.length) return result;

        let p = commentStart;
        // vendor string length (little-endian 32-bit)
        const vendorLen = bytes[p] | (bytes[p+1] << 8) | (bytes[p+2] << 16) | (bytes[p+3] << 24);
        p += 4;
        if (vendorLen < 0 || p + vendorLen + 4 > bytes.length) return result;
        p += vendorLen;
        // comment count
        const commentCount = bytes[p] | (bytes[p+1] << 8) | (bytes[p+2] << 16) | (bytes[p+3] << 24);
        p += 4;
        if (commentCount < 0 || commentCount > 10000) return result;

        for (let i = 0; i < commentCount && p + 4 <= bytes.length; i++) {
            const len = bytes[p] | (bytes[p+1] << 8) | (bytes[p+2] << 16) | (bytes[p+3] << 24);
            p += 4;
            if (len < 0 || len > 100000 || p + len > bytes.length) break;
            const comment = new TextDecoder('utf-8').decode(bytes.subarray(p, p + len));
            p += len;
            const eq = comment.indexOf('=');
            if (eq < 0) continue;
            const key = comment.slice(0, eq).toUpperCase();
            const val = comment.slice(eq + 1).trim();
            if (key === 'TITLE' && !result.title) result.title = val;
            else if (key === 'ARTIST' && !result.artist) result.artist = val;
            else if (key === 'ALBUMARTIST' && !result.albumArtist) result.albumArtist = val;
            else if (key === 'ALBUM' && !result.album) result.album = val;
            else if ((key === 'DATE' || key === 'YEAR') && !result.year) result.year = val.slice(0, 4);
            else if (key === 'GENRE' && !result.genre) result.genre = val;
            else if (key === 'TRACKNUMBER' && !result.trackNo) result.trackNo = parseInt(val, 10) || 0;
            else if (key === 'DISCNUMBER' && !result.discNo) result.discNo = parseInt(val, 10) || 0;
            else if ((key === 'LYRICS' || key === 'UNSYNCEDLYRICS') && !result.lyrics) result.lyrics = val;
            else if (key === 'REPLAYGAIN_TRACK_GAIN') result.replayGainTrack = parseFloat(val) || NaN;
            else if (key === 'REPLAYGAIN_ALBUM_GAIN') result.replayGainAlbum = parseFloat(val) || NaN;
        }
        return result;
    }

    /**
     * Read embedded metadata from an audio File object.
     * Returns a partial track meta object.
     */
    async function readEmbeddedMetadata(file) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, artBlobUrl: '', albumArtist: '', discNo: 0, lyrics: '', replayGainTrack: NaN, replayGainAlbum: NaN };
        let bytes;
        try {
            bytes = await readFileChunk(file); // Read full file for reliable embedded art
        } catch (_) { return result; }

        let parsed = null;

        if (ext === 'mp3') {
            parsed = parseID3v2(bytes);
            // Fallback to ID3v1 if ID3v2 yielded nothing useful
            if (!parsed.title && !parsed.artist) {
                try {
                    const tailBytes = await readFileTail(file, 128);
                    const v1 = parseID3v1(tailBytes);
                    if (v1) parsed = { ...parsed, ...Object.fromEntries(Object.entries(v1).filter(([,v]) => v)) };
                } catch (_) { /* benign: cleanup */ }
            }
        } else if (ext === 'flac') {
            parsed = parseVorbisComment(bytes);
        } else if (ext === 'ogg' || ext === 'opus') {
            parsed = parseOggVorbisComment(bytes);
        } else if (ext === 'm4a' || ext === 'aac' || ext === 'mp4') {
            parsed = parseMP4Meta(bytes);
        }

        if (!parsed) return result;

        result.title   = parsed.title   || '';
        result.artist  = parsed.artist  || '';
        result.album   = parsed.album   || '';
        result.year    = (parsed.year   || '').slice(0, 4);
        result.genre   = parsed.genre   || '';
        result.trackNo = parsed.trackNo || 0;
        result.albumArtist = parsed.albumArtist || '';
        result.discNo  = parsed.discNo  || 0;
        result.lyrics  = parsed.lyrics  || '';
        result.replayGainTrack = parsed.replayGainTrack ?? NaN;
        result.replayGainAlbum = parsed.replayGainAlbum ?? NaN;

        // Convert embedded picture bytes to a blob URL
        if (parsed._pictureData && parsed._pictureData.length > 0) {
            try {
                const blob = new Blob([parsed._pictureData], { type: parsed._pictureMime || 'image/jpeg' });
                result.artBlobUrl = URL.createObjectURL(blob);
            } catch (_) { /* benign: cleanup */ }
        }

        return result;
    }

    /**
     * Parse M4A/MP4 metadata (iTunes ilst atoms).
     * Enough to get title, artist, album, year, genre, track #, and cover art.
     */
    function parseMP4Meta(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0 };
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        function readUint32(offset) { try { return view.getUint32(offset, false); } catch (_) { return 0; } }
        function readStr(start, len) { return new TextDecoder('utf-8').decode(bytes.subarray(start, start + len)).trim(); }

        function walkAtoms(start, end, depth) {
            let pos = start;
            while (pos + 8 <= end) {
                const size = readUint32(pos);
                if (size < 8 || pos + size > end) break;
                const name = readStr(pos + 4, 4);
                const dataStart = pos + 8;
                const dataEnd = pos + size;

                if (name === 'moov' || name === 'udta' || name === 'meta' || name === 'ilst') {
                    const skip = name === 'meta' ? 4 : 0; // meta has a 4-byte version/flags prefix
                    walkAtoms(dataStart + skip, dataEnd, depth + 1);
                } else if (name === '\xA9nam' || name === '\xA9ART' || name === '\xA9alb' || name === '\xA9day'
                        || name === '\xA9gen' || name === 'trkn' || name === 'covr' || name === 'aART' || name === 'disk') {
                    // Find 'data' child atom
                    let p = dataStart;
                    while (p + 8 <= dataEnd) {
                        const ds = readUint32(p);
                        const dn = readStr(p + 4, 4);
                        if (dn === 'data' && ds >= 16) {
                            const type = readUint32(p + 8);
                            const val = bytes.subarray(p + 16, p + ds);
                            if (name === '\xA9nam') result.title  = result.title  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9ART') result.artist = result.artist || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9alb') result.album  = result.album  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9day') result.year   = result.year   || new TextDecoder('utf-8').decode(val).trim().slice(0, 4);
                            if (name === '\xA9gen') result.genre  = result.genre  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === 'trkn' && val.length >= 4) result.trackNo = (val[2] << 8) | val[3];
                            if (name === 'disk' && val.length >= 4) result.discNo = (val[2] << 8) | val[3];
                            if (name === 'aART') result.albumArtist = result.albumArtist || new TextDecoder('utf-8').decode(val).trim();
                            if (name === 'covr' && !result._pictureData) {
                                result._pictureMime = type === 13 ? 'image/jpeg' : 'image/png';
                                result._pictureData = val.slice();
                            }
                        }
                        p += Math.max(8, ds);
                    }
                }
                pos += size;
            }
        }
        walkAtoms(0, bytes.length, 0);
        return result;
    }

    /**
     * Standard ID3v1 genre list (abbreviated â€” first 80 entries cover most common genres).
     */
    const ID3_GENRES = [
        'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop',
        'Jazz','Metal','New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock',
        'Techno','Industrial','Alternative','Ska','Death Metal','Pranks','Soundtrack',
        'Euro-Techno','Ambient','Trip-Hop','Vocal','Jazz+Funk','Fusion','Trance',
        'Classical','Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise',
        'AlternRock','Bass','Soul','Punk','Space','Meditative','Instrumental Pop',
        'Instrumental Rock','Ethnic','Gothic','Darkwave','Techno-Industrial','Electronic',
        'Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta','Top 40',
        'Christian Rap','Pop/Funk','Jungle','Native American','Cabaret','New Wave',
        'Psychedelic','Rave','Showtunes','Trailer','Lo-Fi','Tribal','Acid Punk',
        'Acid Jazz','Polka','Retro','Musical','Rock & Roll','Hard Rock'
    ];
    const IDB_NAME = 'auralis_media_db';
    const IDB_VERSION = 3;
    const FOLDER_STORE = 'folders';
    const FILES_STORE = 'scanned_files';
    const ART_STORE = 'album_art';
    const BACKEND_META_STORE = 'backend_meta';
    const BACKEND_SOURCES_STORE = 'backend_media_sources';
    const BACKEND_FILES_STORE = 'backend_media_files';
    const BACKEND_RAW_TAGS_STORE = 'backend_raw_tag_snapshots';
    const BACKEND_ARTISTS_STORE = 'backend_artists';
    const BACKEND_TRACKS_STORE = 'backend_tracks';
    const BACKEND_RELEASES_STORE = 'backend_releases';
    const BACKEND_RELEASE_TRACKS_STORE = 'backend_release_tracks';
    const BACKEND_ARTWORK_STORE = 'backend_artwork_assets';
    const BACKEND_RELEASE_ARTWORK_STORE = 'backend_release_artwork';
    const BACKEND_SESSIONS_STORE = 'backend_playback_sessions';
    const BACKEND_QUEUE_STORE = 'backend_playback_queue';
    const BACKEND_SCHEMA_VERSION = '20260420_canonical_library_v2';
    const CANONICAL_CACHE_SOURCE_ID = 'source:cache-library';
    const CANONICAL_SESSION_ID = 'session:local-device';

    // In-memory state
    let mediaFolders = [];       // { id, name, handle, fileCount, lastScanned }
    let scannedFiles = [];       // { name, path, size, type, lastModified, folderId }
    let scanInProgress = false;
    let confirmCallback = null;
    let canonicalLibrarySyncTimer = 0;
    let canonicalLibrarySyncReason = '';
    let canonicalLibraryCachePromise = null;
    let canonicalLibraryCacheLoaded = false;
    let canonicalLibraryCacheRevision = 0;
    let canonicalLibraryCacheUpdatedAt = '';
    let canonicalLibraryAlbums = [];
    const canonicalLibraryAlbumByIdentity = new Map();
    const canonicalLibraryAlbumByReleaseId = new Map();
    const pickerPermissionGrantedHandles = new WeakSet();

    // â”€â”€ IndexedDB helpers â”€â”€

    function openMediaDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(FOLDER_STORE)) {
                    db.createObjectStore(FOLDER_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(FILES_STORE)) {
                    const fs = db.createObjectStore(FILES_STORE, { keyPath: 'id', autoIncrement: true });
                    fs.createIndex('folderId', 'folderId', { unique: false });
                }
                if (!db.objectStoreNames.contains(ART_STORE)) {
                    db.createObjectStore(ART_STORE, { keyPath: 'key' });
                }
                ensureCanonicalBackendStores(db);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function ensureCanonicalBackendStores(db) {
        if (!db.objectStoreNames.contains(BACKEND_META_STORE)) {
            db.createObjectStore(BACKEND_META_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(BACKEND_SOURCES_STORE)) {
            db.createObjectStore(BACKEND_SOURCES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_FILES_STORE)) {
            const store = db.createObjectStore(BACKEND_FILES_STORE, { keyPath: 'id' });
            store.createIndex('sourceId', 'sourceId', { unique: false });
            store.createIndex('relativePath', 'relativePath', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RAW_TAGS_STORE)) {
            const store = db.createObjectStore(BACKEND_RAW_TAGS_STORE, { keyPath: 'id' });
            store.createIndex('fileId', 'fileId', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_ARTISTS_STORE)) {
            const store = db.createObjectStore(BACKEND_ARTISTS_STORE, { keyPath: 'id' });
            store.createIndex('normalizedName', 'normalizedName', { unique: true });
        }
        if (!db.objectStoreNames.contains(BACKEND_TRACKS_STORE)) {
            const store = db.createObjectStore(BACKEND_TRACKS_STORE, { keyPath: 'id' });
            store.createIndex('artistId', 'canonicalArtistId', { unique: false });
            store.createIndex('normalizedTitle', 'normalizedTitle', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASES_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASES_STORE, { keyPath: 'id' });
            store.createIndex('albumArtistId', 'albumArtistId', { unique: false });
            store.createIndex('normalizedTitle', 'normalizedTitle', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASE_TRACKS_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASE_TRACKS_STORE, { keyPath: 'id' });
            store.createIndex('releaseId', 'releaseId', { unique: false });
            store.createIndex('fileId', 'fileId', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_ARTWORK_STORE)) {
            db.createObjectStore(BACKEND_ARTWORK_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASE_ARTWORK_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASE_ARTWORK_STORE, { keyPath: 'id' });
            store.createIndex('releaseId', 'releaseId', { unique: true });
        }
        if (!db.objectStoreNames.contains(BACKEND_SESSIONS_STORE)) {
            db.createObjectStore(BACKEND_SESSIONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_QUEUE_STORE)) {
            const store = db.createObjectStore(BACKEND_QUEUE_STORE, { keyPath: 'id' });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('ordinal', 'ordinal', { unique: false });
        }
    }

    function idbPut(db, storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(item);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbDelete(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbGetAll(db, storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function idbClearByIndex(db, storeName, indexName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const idx = store.index(indexName);
            const req = idx.openCursor(IDBKeyRange.only(key));
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { cursor.delete(); cursor.continue(); }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbClearStore(db, storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbGet(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    function canonicalArtistId(name) {
        const normalized = toArtistKey(name || ARTIST_NAME);
        return normalized ? `artist:${normalized}` : `artist:${toArtistKey(ARTIST_NAME)}`;
    }

    function canonicalTrackId(track, fallbackArtist = '') {
        const stableId = getStableTrackIdentity(track);
        if (stableId) return `track:${stableId}`;
        const artistName = String(track?.artist || fallbackArtist || ARTIST_NAME).trim() || ARTIST_NAME;
        return `track:${trackKey(track?.title || 'unknown-track', artistName)}`;
    }

    function canonicalReleaseId(album) {
        return `release:${getAlbumMergeIdentityKey(album, album?.artist || '')}`;
    }

    function canonicalArtworkId(seed) {
        return `art:${String(seed || '').trim().toLowerCase()}`;
    }

    function canonicalSourceId(folder) {
        return folder?.id ? `source:${folder.id}` : CANONICAL_CACHE_SOURCE_ID;
    }

    function canonicalScannedFileId(file) {
        const handleKey = getHandleCacheKey(file?.folderId, file?.subDir, file?.name);
        if (handleKey) return `file:${handleKey}`;
        const pathKey = normalizeRelativeDir(file?.path || joinRelativeDir(file?.subDir, file?.name)).toLowerCase();
        if (file?.folderId && pathKey) return `file:${String(file.folderId).toLowerCase()}::${pathKey}`;
        return '';
    }

    function toCanonicalReleasePayload(album) {
        return {
            id: String(album?.id || '').trim(),
            schema: LIBRARY_CACHE_SCHEMA_VERSION,
            title: album?.title || 'Unknown Album',
            artist: album?.artist || ARTIST_NAME,
            albumArtist: album?.albumArtist || getAlbumPrimaryArtistName(album, album?.artist || ARTIST_NAME) || ARTIST_NAME,
            year: String(album?.year || '').trim(),
            genre: String(album?.genre || '').trim(),
            artUrl: album?.artUrl || '',
            isCompilation: Boolean(album?.isCompilation),
            _sourceAlbumId: album?._sourceAlbumId || getAlbumSourceIdentity(album),
            _sourceAlbumTitle: album?._sourceAlbumTitle || album?.title || '',
            trackCount: Number(album?.trackCount || (Array.isArray(album?.tracks) ? album.tracks.length : 0) || 0),
            totalDurationLabel: album?.totalDurationLabel || ''
        };
    }

    function toCanonicalReleaseTrackPayload(track, album) {
        return {
            title: track?.title || '',
            artist: track?.artist || album?.artist || ARTIST_NAME,
            albumTitle: track?.albumTitle || album?.title || '',
            albumArtist: track?.albumArtist || album?.albumArtist || '',
            year: String(track?.year || album?.year || '').trim(),
            genre: String(track?.genre || album?.genre || '').trim(),
            no: Number(track?.no || 0),
            discNo: Number(track?.discNo || 1) || 1,
            duration: track?.duration || '',
            durationSec: Number(track?.durationSec || 0),
            artUrl: track?.artUrl || album?.artUrl || '',
            path: track?.path || '',
            plays: Number(track?.plays || 0),
            addedRank: Number(track?.addedRank || 0),
            lastPlayedDays: Number(track?.lastPlayedDays || 0),
            ext: track?.ext || '',
            lyrics: track?.lyrics || '',
            replayGainTrack: Number.isFinite(track?.replayGainTrack) ? Number(track.replayGainTrack) : null,
            replayGainAlbum: Number.isFinite(track?.replayGainAlbum) ? Number(track.replayGainAlbum) : null,
            isFavorite: Boolean(track?.isFavorite),
            _handleKey: track?._handleKey || '',
            _sourceAlbumId: track?._sourceAlbumId || getTrackSourceAlbumIdentity(track, album),
            _sourceAlbumTitle: track?._sourceAlbumTitle || getTrackSourceAlbumTitle(track, album?._sourceAlbumTitle || album?.title || ''),
            _embeddedAlbumTitle: track?._embeddedAlbumTitle || '',
            _metaDone: Boolean(track?._metaDone)
        };
    }

    function parseCanonicalPayloadJson(rawValue, fallback = {}) {
        if (typeof rawValue !== 'string' || !rawValue) return fallback;
        try {
            return JSON.parse(rawValue);
        } catch (_) {
            return fallback;
        }
    }

    function materializeCanonicalLibraryCache(dataset = {}, meta = {}) {
        const artistsById = new Map((Array.isArray(dataset.artists) ? dataset.artists : []).map((row) => [row.id, row]));
        const tracksById = new Map((Array.isArray(dataset.tracks) ? dataset.tracks : []).map((row) => [row.id, row]));
        const rawTagsByFileId = new Map((Array.isArray(dataset.rawTags) ? dataset.rawTags : []).map((row) => [row.fileId, row]));
        const artworkById = new Map((Array.isArray(dataset.artwork) ? dataset.artwork : []).map((row) => [row.id, row]));
        const artworkByReleaseId = new Map();
        (Array.isArray(dataset.releaseArtwork) ? dataset.releaseArtwork : []).forEach((row) => {
            const artwork = artworkById.get(row?.artworkId);
            if (artwork) artworkByReleaseId.set(row.releaseId, artwork);
        });

        const releaseTracksByReleaseId = new Map();
        (Array.isArray(dataset.releaseTracks) ? dataset.releaseTracks : []).forEach((row) => {
            if (!releaseTracksByReleaseId.has(row.releaseId)) releaseTracksByReleaseId.set(row.releaseId, []);
            releaseTracksByReleaseId.get(row.releaseId).push(row);
        });

        const nextAlbums = [];
        const nextByIdentity = new Map();
        const nextByReleaseId = new Map();

        (Array.isArray(dataset.releases) ? dataset.releases : []).forEach((release) => {
            const releasePayload = parseCanonicalPayloadJson(release?.payloadJson, {});
            const releaseArtwork = artworkByReleaseId.get(release?.id);
            const albumArtistName = artistsById.get(release?.albumArtistId)?.name
                || releasePayload.albumArtist
                || releasePayload.artist
                || ARTIST_NAME;
            const album = {
                id: releasePayload.id || release?.sourceGroupKey || release?.id || '',
                title: releasePayload.title || release?.title || 'Unknown Album',
                artist: releasePayload.artist || albumArtistName,
                albumArtist: releasePayload.albumArtist || albumArtistName,
                year: releasePayload.year || String(release?.releaseYear || '').trim(),
                genre: releasePayload.genre || '',
                artUrl: releasePayload.artUrl || releaseArtwork?.storagePath || '',
                isCompilation: Boolean(releasePayload.isCompilation || release?.releaseType === 'compilation'),
                trackCount: Number(releasePayload.trackCount || release?.trackCount || 0),
                totalDurationLabel: releasePayload.totalDurationLabel || release?.totalDurationLabel || '',
                tracks: [],
                _sourceAlbumId: releasePayload._sourceAlbumId || release?.sourceGroupKey || '',
                _sourceAlbumTitle: releasePayload._sourceAlbumTitle || releasePayload.title || release?.title || ''
            };

            const releaseTracks = (releaseTracksByReleaseId.get(release?.id) || []).slice().sort((a, b) =>
                Number(a?.discNumber || 1) - Number(b?.discNumber || 1)
                || Number(a?.trackNumber || 0) - Number(b?.trackNumber || 0)
            );

            album.tracks = releaseTracks.map((releaseTrack, index) => {
                const trackPayload = parseCanonicalPayloadJson(releaseTrack?.payloadJson, {});
                const tagRow = rawTagsByFileId.get(releaseTrack?.fileId);
                const rawPayload = parseCanonicalPayloadJson(tagRow?.payloadJson, {});
                const trackRow = tracksById.get(releaseTrack?.trackId);
                const artistName = artistsById.get(releaseTrack?.displayArtistId)?.name
                    || artistsById.get(trackRow?.canonicalArtistId)?.name
                    || trackPayload.artist
                    || tagRow?.artist
                    || album.artist
                    || ARTIST_NAME;
                const durationSec = Number(trackPayload.durationSec || 0) || Math.round(Number(releaseTrack?.durationMs || tagRow?.durationMs || trackRow?.durationMs || 0) / 1000);
                return {
                    title: trackPayload.title || releaseTrack?.displayTitle || trackRow?.title || tagRow?.title || `Track ${index + 1}`,
                    artist: artistName,
                    albumTitle: trackPayload.albumTitle || tagRow?.album || album.title,
                    albumArtist: trackPayload.albumArtist || tagRow?.albumArtist || album.albumArtist || album.artist,
                    year: trackPayload.year || String(tagRow?.releaseYear || album.year || '').trim(),
                    genre: trackPayload.genre || String(tagRow?.genre || album.genre || '').trim(),
                    no: Number(trackPayload.no || tagRow?.trackNumber || releaseTrack?.trackNumber || index + 1) || (index + 1),
                    discNo: Number(trackPayload.discNo || tagRow?.discNumber || releaseTrack?.discNumber || 1) || 1,
                    duration: trackPayload.duration || toDurationLabel(durationSec),
                    durationSec,
                    artUrl: trackPayload.artUrl || album.artUrl || '',
                    path: trackPayload.path || rawPayload.path || '',
                    plays: Number(trackPayload.plays || 0),
                    addedRank: Number(trackPayload.addedRank || 0),
                    lastPlayedDays: Number(trackPayload.lastPlayedDays || 0),
                    ext: trackPayload.ext || rawPayload.ext || '',
                    lyrics: trackPayload.lyrics || '',
                    replayGainTrack: Number.isFinite(trackPayload.replayGainTrack) ? Number(trackPayload.replayGainTrack) : NaN,
                    replayGainAlbum: Number.isFinite(trackPayload.replayGainAlbum) ? Number(trackPayload.replayGainAlbum) : NaN,
                    isFavorite: Boolean(trackPayload.isFavorite),
                    _handleKey: trackPayload._handleKey || rawPayload.handleKey || '',
                    _sourceAlbumId: trackPayload._sourceAlbumId || album._sourceAlbumId || '',
                    _sourceAlbumTitle: trackPayload._sourceAlbumTitle || album._sourceAlbumTitle || album.title || '',
                    _embeddedAlbumTitle: trackPayload._embeddedAlbumTitle || tagRow?.album || '',
                    _metaDone: trackPayload._metaDone !== undefined ? Boolean(trackPayload._metaDone) : true,
                    _backendReleaseId: release?.id || '',
                    _backendReleaseTrackId: releaseTrack?.id || ''
                };
            });

            album.trackCount = album.tracks.length || album.trackCount;
            album.totalDurationLabel = album.totalDurationLabel || toLibraryDurationTotal(album.tracks);
            if (album.tracks.length && typeof finaliseAlbumArtist === 'function') {
                finaliseAlbumArtist(album, album.tracks);
            }

            nextAlbums.push(album);
            nextByReleaseId.set(release?.id, album);
            nextByIdentity.set(getAlbumIdentityKey(album, album.artist), album);
        });

        canonicalLibraryAlbums = nextAlbums;
        canonicalLibraryAlbumByIdentity.clear();
        nextByIdentity.forEach((value, key) => canonicalLibraryAlbumByIdentity.set(key, value));
        canonicalLibraryAlbumByReleaseId.clear();
        nextByReleaseId.forEach((value, key) => canonicalLibraryAlbumByReleaseId.set(key, value));
        canonicalLibraryCacheLoaded = true;
        canonicalLibraryCacheRevision = Math.max(0, Number(meta?.revision || 0));
        canonicalLibraryCacheUpdatedAt = meta?.updatedAt || '';
        return nextAlbums;
    }

    function getCanonicalBackendAlbumMeta(inputTitle, inputArtist = '') {
        try {
            if (!canonicalLibraryCacheLoaded && !canonicalLibraryAlbums.length) return null;
        } catch (_) {
            return null; // canonical state not yet initialized (called during early IIFE boot)
        }
        if (inputTitle && typeof inputTitle === 'object' && inputTitle._backendReleaseId) {
            const releaseMatch = canonicalLibraryAlbumByReleaseId.get(inputTitle._backendReleaseId);
            if (releaseMatch) return releaseMatch;
        }

        const rawTitle = typeof inputTitle === 'string'
            ? inputTitle
            : (inputTitle && typeof inputTitle === 'object' ? inputTitle.title : '');
        const rawArtist = typeof inputTitle === 'object' && inputTitle
            ? (inputTitle.albumArtist || inputTitle.artist || inputArtist || '')
            : inputArtist;
        const normalizedTitle = normalizeAlbumTitle(rawTitle);
        const normalizedKey = albumKey(normalizedTitle);
        const normalizedArtist = toArtistKey(rawArtist);

        if (normalizedKey && normalizedArtist) {
            const exact = canonicalLibraryAlbumByIdentity.get(albumIdentityKey(normalizedTitle, rawArtist));
            if (exact) return exact;
        }

        if (!normalizedKey) return null;
        return canonicalLibraryAlbums.find((album) => (
            albumKey(album?.title || '') === normalizedKey
            && albumMatchesArtistHint(album, rawArtist)
        )) || null;
    }

    async function hydrateCanonicalLibraryBackendCache(reason = 'cache_read') {
        let db;
        try {
            db = await openMediaDB();
            const [metaRows, artists, tracks, releases, releaseTracks, artwork, releaseArtwork, rawTags] = await Promise.all([
                idbGetAll(db, BACKEND_META_STORE),
                idbGetAll(db, BACKEND_ARTISTS_STORE),
                idbGetAll(db, BACKEND_TRACKS_STORE),
                idbGetAll(db, BACKEND_RELEASES_STORE),
                idbGetAll(db, BACKEND_RELEASE_TRACKS_STORE),
                idbGetAll(db, BACKEND_ARTWORK_STORE),
                idbGetAll(db, BACKEND_RELEASE_ARTWORK_STORE),
                idbGetAll(db, BACKEND_RAW_TAGS_STORE)
            ]);
            const metaMap = new Map((metaRows || []).map((row) => [row.key, row.value]));
            if (metaMap.get('schema_version') !== BACKEND_SCHEMA_VERSION) {
                canonicalLibraryAlbums = [];
                canonicalLibraryAlbumByIdentity.clear();
                canonicalLibraryAlbumByReleaseId.clear();
                canonicalLibraryCacheLoaded = true;
                canonicalLibraryCacheRevision = 0;
                canonicalLibraryCacheUpdatedAt = '';
                return;
            }
            materializeCanonicalLibraryCache({
                artists,
                tracks,
                releases,
                releaseTracks,
                artwork,
                releaseArtwork,
                rawTags
            }, {
                revision: metaMap.get('library_revision'),
                updatedAt: metaMap.get('updated_at')
            });
        } catch (e) {
            console.warn('[Auralis] canonical backend hydration failed:', reason, e);
        } finally {
            if (db) db.close();
        }
    }

    function scheduleCanonicalLibraryBackendHydration(reason = 'cache_read') {
        try { if (canonicalLibraryCacheLoaded) return Promise.resolve(canonicalLibraryAlbums); } catch (_) { return Promise.resolve([]); }
        if (canonicalLibraryCachePromise) return canonicalLibraryCachePromise;
        canonicalLibraryCachePromise = hydrateCanonicalLibraryBackendCache(reason)
            .finally(() => {
                canonicalLibraryCachePromise = null;
            });
        return canonicalLibraryCachePromise;
    }

    function buildCanonicalLibraryBackendPayload() {
        const sourceRows = [];
        const sourceIdSet = new Set();
        (Array.isArray(mediaFolders) ? mediaFolders : []).forEach((folder) => {
            const sourceId = canonicalSourceId(folder);
            sourceIdSet.add(sourceId);
            sourceRows.push({
                id: sourceId,
                kind: 'local_folder',
                rootUri: `folder://${folder.id || folder.name || 'unknown'}`,
                displayName: folder?.name || 'Local Folder',
                status: 'active',
                lastScanAt: folder?.lastScanned ? new Date(folder.lastScanned).toISOString() : ''
            });
        });
        if (!sourceIdSet.has(CANONICAL_CACHE_SOURCE_ID)) {
            sourceRows.push({
                id: CANONICAL_CACHE_SOURCE_ID,
                kind: 'local_cache',
                rootUri: 'cache://library',
                displayName: 'Cached Library',
                status: 'active',
                lastScanAt: ''
            });
        }

        const mediaFileRows = [];
        const mediaFileByHandle = new Map();
        const mediaFileByPath = new Map();
        (Array.isArray(scannedFiles) ? scannedFiles : []).forEach((file) => {
            const fileId = canonicalScannedFileId(file);
            if (!fileId) return;
            const relativePath = normalizeRelativeDir(file?.path || joinRelativeDir(file?.subDir, file?.name));
            const row = {
                id: fileId,
                sourceId: canonicalSourceId({ id: file?.folderId }),
                relativePath,
                sizeBytes: Number(file?.size || 0),
                mtimeMs: Number(file?.lastModified || 0),
                extension: String(file?.name || '').split('.').pop().toLowerCase(),
                contentHash: '',
                audioFingerprint: '',
                scanStatus: 'indexed'
            };
            mediaFileRows.push(row);
            if (file?.folderId && file?.subDir !== undefined && file?.name) {
                mediaFileByHandle.set(getHandleCacheKey(file.folderId, file.subDir, file.name), fileId);
            }
            if (relativePath) {
                mediaFileByPath.set(relativePath.toLowerCase(), fileId);
            }
        });

        const artistRows = new Map();
        const trackRows = new Map();
        const releaseRows = new Map();
        const releaseTrackRows = [];
        const artworkRows = new Map();
        const releaseArtworkRows = [];
        const rawTagRows = new Map();
        const releaseTrackIdByFileId = new Map();
        const releaseTrackIdByTrackKey = new Map();

        function ensureArtist(name) {
            const resolvedName = String(name || ARTIST_NAME).trim() || ARTIST_NAME;
            const id = canonicalArtistId(resolvedName);
            if (!artistRows.has(id)) {
                artistRows.set(id, {
                    id,
                    name: resolvedName,
                    sortName: resolvedName,
                    normalizedName: toArtistKey(resolvedName)
                });
            }
            return id;
        }

        function ensureVirtualMediaFile(track, album, ordinal) {
            const fileId = `file:virtual:${canonicalReleaseId(album)}:${ordinal}`;
            if (!mediaFileRows.some((row) => row.id === fileId)) {
                mediaFileRows.push({
                    id: fileId,
                    sourceId: CANONICAL_CACHE_SOURCE_ID,
                    relativePath: normalizeRelativeDir(track?.path || `${album?.title || 'album'}/${track?.title || ordinal}`),
                    sizeBytes: 0,
                    mtimeMs: 0,
                    extension: String(track?.ext || '').toLowerCase(),
                    contentHash: '',
                    audioFingerprint: '',
                    scanStatus: 'virtual'
                });
            }
            return fileId;
        }

        (Array.isArray(LIBRARY_ALBUMS) ? LIBRARY_ALBUMS : []).forEach((album) => {
            const releaseId = canonicalReleaseId(album);
            const albumArtistName = getAlbumPrimaryArtistName(album, album?.artist || ARTIST_NAME) || ARTIST_NAME;
            const albumArtistId = ensureArtist(albumArtistName);
            const orderedTracks = (Array.isArray(album?.tracks) ? album.tracks : []).slice().sort((a, b) =>
                Number(a?.discNo || 1) - Number(b?.discNo || 1)
                || Number(a?.no || 0) - Number(b?.no || 0)
            );

            releaseRows.set(releaseId, {
                id: releaseId,
                title: album?.title || 'Unknown Album',
                sortTitle: normalizeAlbumTitle(album?.title || 'Unknown Album'),
                normalizedTitle: albumKey(album?.title || 'Unknown Album'),
                albumArtistId,
                releaseYear: String(album?.year || '').trim(),
                releaseType: album?.isCompilation ? 'compilation' : 'album',
                sourceGroupKey: String(album?.id || '').trim(),
                trackCount: orderedTracks.length,
                totalDurationLabel: album?.totalDurationLabel || toLibraryDurationTotal(orderedTracks),
                payloadJson: JSON.stringify(toCanonicalReleasePayload(album))
            });

            if (album?.artUrl) {
                const artworkId = canonicalArtworkId(releaseId);
                artworkRows.set(artworkId, {
                    id: artworkId,
                    hash: String(album.artUrl),
                    mimeType: '',
                    width: 0,
                    height: 0,
                    storagePath: String(album.artUrl)
                });
                releaseArtworkRows.push({
                    id: `release_art:${releaseId}`,
                    releaseId,
                    artworkId
                });
            }

            orderedTracks.forEach((track, index) => {
                const displayArtistName = String(track?.artist || album?.artist || ARTIST_NAME).trim() || ARTIST_NAME;
                const displayArtistId = ensureArtist(displayArtistName);
                const trackId = canonicalTrackId(track, displayArtistName);
                if (!trackRows.has(trackId)) {
                    trackRows.set(trackId, {
                        id: trackId,
                        title: track?.title || `Track ${index + 1}`,
                        sortTitle: String(track?.title || `Track ${index + 1}`),
                        normalizedTitle: String(track?.title || `Track ${index + 1}`).trim().toLowerCase(),
                        canonicalArtistId: displayArtistId,
                        durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                        isrc: '',
                        fingerprint: ''
                    });
                }

                const relativePath = normalizeRelativeDir(track?.path || '');
                const fileId = (track?._handleKey && mediaFileByHandle.get(track._handleKey))
                    || (relativePath ? mediaFileByPath.get(relativePath.toLowerCase()) : '')
                    || ensureVirtualMediaFile(track, album, index + 1);
                const discNumber = Number(track?.discNo || 1) || 1;
                const trackNumber = Number(track?.no || index + 1) || (index + 1);
                const releaseTrackId = `${releaseId}::d${String(discNumber).padStart(2, '0')}::t${String(trackNumber).padStart(3, '0')}::${trackId}`;

                releaseTrackRows.push({
                    id: releaseTrackId,
                    releaseId,
                    trackId,
                    fileId,
                    discNumber,
                    trackNumber,
                    displayTitle: track?.title || `Track ${index + 1}`,
                    displayArtistId,
                    durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                    payloadJson: JSON.stringify(toCanonicalReleaseTrackPayload(track, album))
                });
                releaseTrackIdByFileId.set(fileId, releaseTrackId);
                releaseTrackIdByTrackKey.set(`${trackKey(track?.title, displayArtistName)}::${albumKey(track?.albumTitle || album?.title || '')}`, releaseTrackId);

                if (!rawTagRows.has(fileId)) {
                    rawTagRows.set(fileId, {
                        id: `raw:${fileId}`,
                        fileId,
                        extractorVersion: STORAGE_VERSION,
                        title: track?.title || '',
                        artist: displayArtistName,
                        album: track?.albumTitle || album?.title || '',
                        albumArtist: track?.albumArtist || albumArtistName,
                        trackNumber,
                        trackTotal: orderedTracks.length,
                        discNumber,
                        discTotal: 0,
                        releaseYear: String(track?.year || album?.year || '').trim(),
                        genre: String(track?.genre || album?.genre || '').trim(),
                        durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                        payloadJson: JSON.stringify({
                            ext: track?.ext || '',
                            path: track?.path || '',
                            handleKey: track?._handleKey || '',
                            sourceAlbumId: track?._sourceAlbumId || getTrackSourceAlbumIdentity(track, album),
                            sourceAlbumTitle: track?._sourceAlbumTitle || getTrackSourceAlbumTitle(track, album?._sourceAlbumTitle || album?.title || ''),
                            embeddedAlbumTitle: track?._embeddedAlbumTitle || ''
                        }),
                        createdAt: new Date().toISOString()
                    });
                }
            });
        });

        const currentReleaseId = nowPlaying ? `release:${albumIdentityKey(nowPlaying.albumTitle || activeAlbumTitle, activeAlbumArtist || nowPlaying.artist || '')}` : '';
        const currentQueueTrackKey = nowPlaying
            ? `${trackKey(nowPlaying.title, nowPlaying.artist)}::${albumKey(nowPlaying.albumTitle || activeAlbumTitle || '')}`
            : '';
        const currentReleaseTrackId = releaseTrackIdByTrackKey.get(currentQueueTrackKey) || '';
        const sessionRows = [{
            id: CANONICAL_SESSION_ID,
            deviceName: 'Auralis Local Device',
            currentReleaseId,
            currentReleaseTrackId,
            positionMs: 0,
            repeatMode: repeatMode || 'off',
            shuffleMode: false,
            queueRevision: Date.now(),
            updatedAt: new Date().toISOString()
        }];
        const queueRows = (Array.isArray(queueTracks) ? queueTracks : []).map((track, index) => {
            const queueKey = `${trackKey(track?.title, track?.artist)}::${albumKey(track?.albumTitle || '')}`;
            return {
                id: `queue:${CANONICAL_SESSION_ID}:${index}`,
                sessionId: CANONICAL_SESSION_ID,
                ordinal: index,
                releaseTrackId: releaseTrackIdByTrackKey.get(queueKey) || '',
                trackTitle: track?.title || '',
                trackArtist: track?.artist || '',
                albumTitle: track?.albumTitle || ''
            };
        });

        return {
            sources: sourceRows,
            files: mediaFileRows,
            rawTags: Array.from(rawTagRows.values()),
            artists: Array.from(artistRows.values()),
            tracks: Array.from(trackRows.values()),
            releases: Array.from(releaseRows.values()),
            releaseTracks: releaseTrackRows,
            artwork: Array.from(artworkRows.values()),
            releaseArtwork: releaseArtworkRows,
            sessions: sessionRows,
            queue: queueRows
        };
    }

    function replaceCanonicalLibraryBackend(db, payload, meta = {}) {
        const storeNames = [
            BACKEND_META_STORE,
            BACKEND_SOURCES_STORE,
            BACKEND_FILES_STORE,
            BACKEND_RAW_TAGS_STORE,
            BACKEND_ARTISTS_STORE,
            BACKEND_TRACKS_STORE,
            BACKEND_RELEASES_STORE,
            BACKEND_RELEASE_TRACKS_STORE,
            BACKEND_ARTWORK_STORE,
            BACKEND_RELEASE_ARTWORK_STORE,
            BACKEND_SESSIONS_STORE,
            BACKEND_QUEUE_STORE
        ];
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeNames, 'readwrite');
            tx.onerror = () => reject(tx.error);
            tx.oncomplete = () => resolve();

            [
                BACKEND_SOURCES_STORE,
                BACKEND_FILES_STORE,
                BACKEND_RAW_TAGS_STORE,
                BACKEND_ARTISTS_STORE,
                BACKEND_TRACKS_STORE,
                BACKEND_RELEASES_STORE,
                BACKEND_RELEASE_TRACKS_STORE,
                BACKEND_ARTWORK_STORE,
                BACKEND_RELEASE_ARTWORK_STORE,
                BACKEND_SESSIONS_STORE,
                BACKEND_QUEUE_STORE,
                BACKEND_META_STORE
            ].forEach((storeName) => tx.objectStore(storeName).clear());

            const putMany = (storeName, rows) => {
                const store = tx.objectStore(storeName);
                (Array.isArray(rows) ? rows : []).forEach((row) => store.put(row));
            };

            putMany(BACKEND_SOURCES_STORE, payload.sources);
            putMany(BACKEND_FILES_STORE, payload.files);
            putMany(BACKEND_RAW_TAGS_STORE, payload.rawTags);
            putMany(BACKEND_ARTISTS_STORE, payload.artists);
            putMany(BACKEND_TRACKS_STORE, payload.tracks);
            putMany(BACKEND_RELEASES_STORE, payload.releases);
            putMany(BACKEND_RELEASE_TRACKS_STORE, payload.releaseTracks);
            putMany(BACKEND_ARTWORK_STORE, payload.artwork);
            putMany(BACKEND_RELEASE_ARTWORK_STORE, payload.releaseArtwork);
            putMany(BACKEND_SESSIONS_STORE, payload.sessions);
            putMany(BACKEND_QUEUE_STORE, payload.queue);

            const metaStore = tx.objectStore(BACKEND_META_STORE);
            metaStore.put({ key: 'schema_version', value: BACKEND_SCHEMA_VERSION });
            metaStore.put({ key: 'library_revision', value: Number(meta.revision || 1) });
            metaStore.put({ key: 'last_sync_reason', value: String(meta.reason || 'unspecified') });
            metaStore.put({ key: 'updated_at', value: meta.updatedAt || new Date().toISOString() });
        });
    }

    async function syncCanonicalLibraryBackend(reason = 'library_snapshot') {
        let db;
        try {
            const payload = buildCanonicalLibraryBackendPayload();
            db = await openMediaDB();
            const revisionRecord = await idbGet(db, BACKEND_META_STORE, 'library_revision');
            const nextRevision = Math.max(0, Number(revisionRecord?.value || 0)) + 1;
            const updatedAt = new Date().toISOString();
            await replaceCanonicalLibraryBackend(db, payload, {
                revision: nextRevision,
                reason,
                updatedAt
            });
            materializeCanonicalLibraryCache(payload, { revision: nextRevision, updatedAt });
        } catch (e) {
            console.warn('[Auralis] canonical backend sync failed:', e);
        } finally {
            if (db) db.close();
        }
    }

    function scheduleCanonicalLibraryBackendSync(reason = 'library_snapshot') {
        canonicalLibrarySyncReason = reason;
        if (canonicalLibrarySyncTimer) return;
        canonicalLibrarySyncTimer = window.setTimeout(async () => {
            const syncReason = canonicalLibrarySyncReason || 'library_snapshot';
            canonicalLibrarySyncReason = '';
            canonicalLibrarySyncTimer = 0;
            await syncCanonicalLibraryBackend(syncReason);
        }, 120);
    }

    async function getCanonicalLibraryBackendSummary() {
        let db;
        try {
            db = await openMediaDB();
            const [meta, sources, files, artists, tracks, releases, releaseTracks, sessions, queue] = await Promise.all([
                idbGetAll(db, BACKEND_META_STORE),
                idbGetAll(db, BACKEND_SOURCES_STORE),
                idbGetAll(db, BACKEND_FILES_STORE),
                idbGetAll(db, BACKEND_ARTISTS_STORE),
                idbGetAll(db, BACKEND_TRACKS_STORE),
                idbGetAll(db, BACKEND_RELEASES_STORE),
                idbGetAll(db, BACKEND_RELEASE_TRACKS_STORE),
                idbGetAll(db, BACKEND_SESSIONS_STORE),
                idbGetAll(db, BACKEND_QUEUE_STORE)
            ]);
            const metaMap = new Map((meta || []).map((entry) => [entry.key, entry.value]));
            return {
                schemaVersion: metaMap.get('schema_version') || '',
                libraryRevision: Number(metaMap.get('library_revision') || 0),
                updatedAt: metaMap.get('updated_at') || '',
                counts: {
                    sources: (sources || []).length,
                    files: (files || []).length,
                    artists: (artists || []).length,
                    tracks: (tracks || []).length,
                    releases: (releases || []).length,
                    releaseTracks: (releaseTracks || []).length,
                    sessions: (sessions || []).length,
                    queueItems: (queue || []).length
                },
                currentSession: (sessions || [])[0] || null
            };
        } catch (e) {
            console.warn('[Auralis] canonical backend summary failed:', e);
            return null;
        } finally {
            if (db) db.close();
        }
    }

    function getCanonicalLibraryBackendCacheSummary() {
        return {
            loaded: canonicalLibraryCacheLoaded,
            revision: canonicalLibraryCacheRevision,
            updatedAt: canonicalLibraryCacheUpdatedAt,
            albumCount: canonicalLibraryAlbums.length
        };
    }

    // â”€â”€ Persistent album art cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // Key format: lowercase "artist\0album" to deduplicate across sessions.
    function artCacheKey(artist, albumTitle) {
        return (String(artist || '').trim() + '\0' + String(albumTitle || '').trim()).toLowerCase();
    }

    // Retrieve cached artwork blob URL from IDB. Returns '' if not found.
    async function getCachedArt(artist, albumTitle) {
        const key = artCacheKey(artist, albumTitle);
        let db;
        try {
            db = await openMediaDB();
            const record = await idbGet(db, ART_STORE, key);
            if (record && record.blob) {
                return URL.createObjectURL(record.blob);
            }
        } catch (_) { /* benign: cleanup */ } finally { if (db) db.close(); }
        return '';
    }

    // Persist artwork blob to IDB for future sessions.
    async function putCachedArt(artist, albumTitle, blob) {
        if (!blob) return;
        const key = artCacheKey(artist, albumTitle);
        let db;
        try {
            db = await openMediaDB();
            await idbPut(db, ART_STORE, { key, blob, ts: Date.now() });
        } catch (_) { /* benign: cleanup */ } finally { if (db) db.close(); }
    }

    // Bulk-load all cached art keys (for quick "has art?" checks without per-album round-trips).
    async function loadArtCacheIndex() {
        let db;
        try {
            db = await openMediaDB();
            const all = await idbGetAll(db, ART_STORE);
            const map = new Map();
            for (const rec of all) {
                if (rec.key && rec.blob) map.set(rec.key, rec.blob);
            }
            return map;
        } catch (_) { return new Map(); } finally { if (db) db.close(); }
    }

    function toPersistedScannedFileRecord(file) {
        const normalized = {
            name: String(file?.name || ''),
            size: Number(file?.size || 0),
            type: String(file?.type || ''),
            lastModified: Number(file?.lastModified || 0),
            folderId: String(file?.folderId || ''),
            subDir: String(file?.subDir || '')
        };
        if (file?.path) normalized.path = String(file.path);
        return normalized;
    }

    async function rewritePersistedScannedFiles(files) {
        let db;
        try {
            db = await openMediaDB();
            await idbClearStore(db, FILES_STORE);
            for (const file of files) {
                await idbPut(db, FILES_STORE, toPersistedScannedFileRecord(file));
            }
        } catch (e) {
            console.warn('Failed to rewrite scanned file cache:', e);
        } finally {
            if (db) db.close();
        }
    }

    // â”€â”€ Check API support â”€â”€

    function hasFileSystemAccess() {
        return typeof window.showDirectoryPicker === 'function' && window.isSecureContext;
    }

    function hasFallbackFolderInput() {
        const inp = document.createElement('input');
        return typeof inp.webkitdirectory !== 'undefined';
    }

    function getFolderAccessUnsupportedMessage() {
        // If native File System Access API is available and will work, no message needed
        if (shouldUseNativePicker()) return '';
        // If fallback <input webkitdirectory> works, no message needed either
        if (hasFallbackFolderInput()) return '';
        // Truly unsupported â€” no way to pick folders
        return 'This browser does not support folder access. Use desktop Chrome, Edge, or Opera.';
    }

    // â”€â”€ Load persisted folders from IDB on boot â”€â”€

    async function loadMediaFolders() {
        let db;
        try {
            db = await openMediaDB();
            mediaFolders = await idbGetAll(db, FOLDER_STORE);
            scannedFiles = await idbGetAll(db, FILES_STORE);
        } catch (e) {
            console.warn('Failed to load media folders from IndexedDB:', e);
            mediaFolders = [];
            scannedFiles = [];
        } finally {
            if (db) db.close();
        }

        // Prune stale fallback-only folders: added via <input webkitdirectory> in a
        // previous session with no native handle â€” their File objects are gone and
        // they can never be rescanned. Remove them so they don't silently produce
        // zero results on every scan.
        const scannedFileIdsInIDB = new Set((Array.isArray(scannedFiles) ? scannedFiles : []).map(f => f.folderId));
        const staleFallbackIds = mediaFolders
            .filter(f => !f.handle && !scannedFileIdsInIDB.has(f.id))
            .map(f => f.id);
        if (staleFallbackIds.length > 0) {
            console.warn('[Auralis] Pruning', staleFallbackIds.length, 'stale fallback folder(s) from IDB (no handle, no scanned files):', staleFallbackIds);
            let pruneDb;
            try {
                pruneDb = await openMediaDB();
                for (const id of staleFallbackIds) {
                    await idbDelete(pruneDb, FOLDER_STORE, id);
                }
            } catch (e) {
                console.warn('[Auralis] Failed to prune stale fallback folders:', e);
            } finally {
                if (pruneDb) pruneDb.close();
            }
            mediaFolders = mediaFolders.filter(f => !staleFallbackIds.includes(f.id));
        }

        const activeFolderIds = new Set(mediaFolders.map(folder => folder.id));
        const normalizedFiles = (Array.isArray(scannedFiles) ? scannedFiles : [])
            .map(toPersistedScannedFileRecord)
            .filter(file => file.folderId && activeFolderIds.has(file.folderId));
        if (normalizedFiles.length !== scannedFiles.length) {
            scannedFiles = normalizedFiles;
            await rewritePersistedScannedFiles(scannedFiles);
        } else {
            scannedFiles = normalizedFiles;
        }

        if (DEBUG) console.log('[Auralis] loadMediaFolders: mediaFolders=' + mediaFolders.length + ', scannedFiles=' + scannedFiles.length);

        // Also try to rebuild file handle cache for playback (needs permission)
        if (mediaFolders.length > 0) {
            await rebuildFileHandleCache();
        }

        await syncLibraryFromMediaState();
        void scheduleCanonicalLibraryBackendHydration('loadMediaFolders');
        updatePlaybackHealthWarnings();
    }

    // Re-walk stored folder handles to rebuild fileHandleCache without full rescan
    async function rebuildFileHandleCache() {
        for (const folder of mediaFolders) {
            if (!folder.handle) continue;
            try {
                const perm = await folder.handle.queryPermission({ mode: 'read' });
                if (perm !== 'granted') continue;
                await walkHandlesOnly(folder.handle, folder.id, '');
            } catch (e) {
                console.warn('Could not rebuild handles for', folder.name, e);
            }
        }
        if (DEBUG) console.log('[Auralis] rebuildFileHandleCache: rebuilt ' + fileHandleCache.size + ' handles');
        return fileHandleCache.size;
    }

    // Lightweight walk: only caches file handles, doesn't read file contents
    async function walkHandlesOnly(dirHandle, folderId, parentDir) {
        const dirPath = normalizeRelativeDir(parentDir);
        let fallbackImageEntry = null;
        try {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    const ext = entry.name.split('.').pop().toLowerCase();
                    if (AUDIO_EXTENSIONS.has(ext)) {
                        const handleKey = getHandleCacheKey(folderId, dirPath, entry.name);
                        fileHandleCache.set(handleKey, entry);
                        if (!fileHandleCache.has(entry.name.toLowerCase())) fileHandleCache.set(entry.name.toLowerCase(), entry);
                    } else if (IMAGE_EXTENSIONS.has(ext)) {
                        const baseName = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
                        const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                        const artKey = getArtCacheKey(folderId, dirPath);
                        if (isArtFile && !artHandleCache.has(artKey)) {
                            artHandleCache.set(artKey, entry);
                        } else if (!fallbackImageEntry) {
                            fallbackImageEntry = entry;
                        }
                    }
                } else if (entry.kind === 'directory') {
                    await walkHandlesOnly(entry, folderId, joinRelativeDir(dirPath, entry.name));
                }
            }
            // Fallback: use any image file in the directory if no named art was found
            const artKey = getArtCacheKey(folderId, dirPath);
            if (!artHandleCache.has(artKey) && fallbackImageEntry) {
                artHandleCache.set(artKey, fallbackImageEntry);
            }
        } catch (_) {
            // Silently skip inaccessible directories
        }
    }

    // â”€â”€ Recursive directory scan â”€â”€

    async function scanDirectoryHandle(dirHandle, folderId, onFileFound, parentDir) {
        const dirPath = normalizeRelativeDir(parentDir);
        let fallbackImageEntry = null;
        try {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const ext = entry.name.split('.').pop().toLowerCase();
                if (AUDIO_EXTENSIONS.has(ext)) {
                    let file;
                    try { file = await entry.getFile(); } catch (_) { continue; }
                    if (!file) continue;
                    const record = {
                        name: file.name,
                        size: file.size,
                        type: file.type || ('audio/' + ext),
                        lastModified: file.lastModified,
                        folderId: folderId,
                        subDir: dirPath
                    };
                    // Cache the file handle for later playback resolution
                    const handleKey = getScannedFileHandleKey(record);
                    if (handleKey) fileHandleCache.set(handleKey, entry);
                    if (!fileHandleCache.has(file.name.toLowerCase())) fileHandleCache.set(file.name.toLowerCase(), entry);
                    if (onFileFound) onFileFound(record);
                } else if (IMAGE_EXTENSIONS.has(ext)) {
                    // Cache art image handle for this directory
                    const baseName = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
                    const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                    const artKey = getArtCacheKey(folderId, dirPath);
                    if (isArtFile && !artHandleCache.has(artKey)) {
                        artHandleCache.set(artKey, entry);
                    } else if (!fallbackImageEntry) {
                        fallbackImageEntry = entry;
                    }
                }
            } else if (entry.kind === 'directory') {
                await scanDirectoryHandle(entry, folderId, onFileFound, joinRelativeDir(dirPath, entry.name));
            }
        }
        // Fallback: use any image file in the directory if no named art was found
        const artKey = getArtCacheKey(folderId, dirPath);
        if (!artHandleCache.has(artKey) && fallbackImageEntry) {
            artHandleCache.set(artKey, fallbackImageEntry);
        }
        } catch (e) {
            console.warn('[Auralis] Error scanning directory "' + (dirPath || dirHandle.name) + '":', e);
        }
    }

    async function scanFolder(folder, onProgress) {
        // Fallback path: folder was added via <input webkitdirectory>
        if (folder._fallbackFiles && Array.isArray(folder._fallbackFiles)) {
            const files = [];
            for (const file of folder._fallbackFiles) {
                const ext = file.name.split('.').pop().toLowerCase();
                const relPath = file.webkitRelativePath || file.name;
                const parts = relPath.split(/[\\\/]/);
                const subDir = normalizeRelativeDir(parts.length > 1 ? parts.slice(1, -1).join('/') : '');

                // Cache sidecar image files for album art (cover.jpg, folder.jpeg, etc.)
                if (IMAGE_EXTENSIONS.has(ext)) {
                    const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase();
                    const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                    const artKey = getArtCacheKey(folder.id, subDir);
                    if (isArtFile && !artHandleCache.has(artKey)) {
                        // Store a File-object shim in artHandleCache that supports .getFile()
                        const artBlobUrl = URL.createObjectURL(file);
                        artHandleCache.set(artKey, {
                            _file: file,
                            _blobUrl: artBlobUrl,
                            getFile: async () => file
                        });
                    } else if (!artHandleCache.has(getArtCacheKey(folder.id, subDir))) {
                        // Fallback: use any image if no named art pattern matched
                        const artBlobUrl = URL.createObjectURL(file);
                        artHandleCache.set(artKey, {
                            _file: file,
                            _blobUrl: artBlobUrl,
                            getFile: async () => file
                        });
                    }
                    continue; // not an audio file
                }

                if (!AUDIO_EXTENSIONS.has(ext)) continue;

                const record = {
                    name: file.name,
                    size: file.size,
                    type: file.type || ('audio/' + ext),
                    lastModified: file.lastModified,
                    folderId: folder.id,
                    subDir: subDir
                };
                // Cache a blob URL for playback and a getFile() shim so
                // mergeScannedIntoLibrary can read embedded metadata/artwork.
                const blobUrl = URL.createObjectURL(file);
                const cacheKey = getScannedFileHandleKey(record);
                const shimHandle = {
                    _blobUrl: blobUrl,
                    getFile: async () => file
                };
                if (cacheKey) {
                    fileHandleCache.set(cacheKey, shimHandle);
                    blobUrlCache.set(cacheKey, blobUrl);
                }
                if (!fileHandleCache.has(file.name.toLowerCase())) fileHandleCache.set(file.name.toLowerCase(), shimHandle);
                if (!blobUrlCache.has(file.name.toLowerCase())) blobUrlCache.set(file.name.toLowerCase(), blobUrl);
                files.push(record);
                if (onProgress) onProgress(files.length);
            }
            return files;
        }

        // Native File System Access path
        if (!folder.handle) {
            toast('Cannot scan "' + folder.name + '" â€” handle unavailable');
            return [];
        }
        const perm = pickerPermissionGrantedHandles.has(folder.handle) || await verifyPermission(folder.handle);
        if (!perm) {
            toast('Permission denied for ' + folder.name);
            return [];
        }
        const files = [];
        await scanDirectoryHandle(folder.handle, folder.id, (record) => {
            files.push(record);
            if (onProgress) onProgress(files.length);
        });
        return files;
    }

    async function verifyPermission(handle) {
        if (!handle || !handle.queryPermission) return false;
        let perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') return true;
        try {
            perm = await handle.requestPermission({ mode: 'read' });
            return perm === 'granted';
        } catch (_) {
            return false;
        }
    }

    // â”€â”€ Pick a folder via browser dialog â”€â”€

    // Determine upfront whether native File System Access API is likely to work.
    // On file:// in Chrome, showDirectoryPicker exists and isSecureContext is true,
    // but the API still throws SecurityError. We detect this scenario and skip native.
    function shouldUseNativePicker() {
        if (typeof window.showDirectoryPicker !== 'function') return false;
        if (!window.isSecureContext) return false;
        // file:// pages in Chrome report isSecureContext = true but
        // showDirectoryPicker throws SecurityError. Avoid the native path.
        if (location.protocol === 'file:') return false;
        return true;
    }

    async function pickFolder() {
        const canFallback = hasFallbackFolderInput();
        console.log('[Auralis][FolderPicker] pickFolder: shouldUseNative=', shouldUseNativePicker(), 'canFallback=', canFallback);

        if (shouldUseNativePicker()) {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'read' });
                const hasReadPermission = await verifyPermission(handle);
                if (!hasReadPermission) {
                    toast('Permission denied for ' + handle.name);
                    return null;
                }
                pickerPermissionGrantedHandles.add(handle);
                // Deduplicate: check if already added
                for (const existing of mediaFolders) {
                    if (existing.handle && await existing.handle.isSameEntry(handle)) {
                        toast('"' + handle.name + '" is already added');
                        return null;
                    }
                }
                return handle;
            } catch (e) {
                if (e.name === 'AbortError') {
                    return null;
                }
                console.warn('[Auralis] showDirectoryPicker failed:', e.name, e.message);
                toast('Could not access folder: ' + e.message);
                return null;
            }
        }

        // Fallback: <input type="file" webkitdirectory>
        // This path is reached synchronously from the click handler,
        // so user activation is still valid for input.click().
        if (canFallback) {
            console.log('[Auralis][FolderPicker] Using <input webkitdirectory> fallback');
            return pickFolderViaInput();
        }

        toast('Folder access is not supported in this browser. Use desktop Chrome, Edge, or Opera.');
        return null;
    }

    function pickFolderViaInput() {
        console.log('[Auralis][FolderPicker] pickFolderViaInput: creating hidden input and calling .click()');
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.multiple = true;
            // Use offscreen positioning instead of display:none â€” some browsers
            // silently ignore .click() on hidden inputs.
            input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
            document.body.appendChild(input);
            console.log('[Auralis][FolderPicker] input appended to body, about to call input.click()');

            let resolved = false;

            input.addEventListener('change', () => {
                resolved = true;
                const files = Array.from(input.files || []);
                input.remove();
                if (files.length === 0) {
                    toast('No files selected');
                    resolve(null);
                    return;
                }
                // Derive folder name from webkitRelativePath (handle both / and \ separators)
                const firstPath = files[0].webkitRelativePath || '';
                const folderName = firstPath.split(/[\\\/]/)[0] || 'Selected Folder';
                // Check for duplicate by name
                const existing = mediaFolders.find(f => f.name === folderName);
                if (existing) {
                    toast('"' + folderName + '" is already added');
                    resolve(null);
                    return;
                }
                resolve({ name: folderName, _files: files, _fallback: true });
            });

            // Chrome 91+ fires 'cancel' event
            input.addEventListener('cancel', () => {
                if (!resolved) {
                    resolved = true;
                    input.remove();
                    resolve(null);
                }
            });

            input.click();
        });
    }

    // â”€â”€ Add a folder to the store â”€â”€

    async function addFolderFromHandle(handle) {
        const folder = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: handle.name,
            handle: handle._fallback ? null : handle,
            fileCount: 0,
            lastScanned: null,
            _fallbackFiles: handle._fallback ? handle._files : null
        };
        mediaFolders.push(folder);
        let db;
        try {
            db = await openMediaDB();
            // Don't persist _fallbackFiles (File objects aren't serializable to IDB structured clone in all browsers)
            const storable = { id: folder.id, name: folder.name, handle: folder.handle, fileCount: folder.fileCount, lastScanned: folder.lastScanned };
            await idbPut(db, FOLDER_STORE, storable);
        } catch (e) {
            console.warn('IDB put failed:', e);
        } finally {
            if (db) db.close();
        }
        return folder;
    }

    function getCachedFilesForFolder(folderId) {
        return (Array.isArray(scannedFiles) ? scannedFiles : [])
            .filter(file => file && file.folderId === folderId)
            .map(toPersistedScannedFileRecord);
    }

    function folderHasLiveScanSource(folder) {
        return Boolean(
            folder?.handle ||
            (Array.isArray(folder?._fallbackFiles) && folder._fallbackFiles.length > 0)
        );
    }

    function toStorableFolder(folder) {
        return {
            id: folder.id,
            name: folder.name,
            handle: folder.handle || null,
            fileCount: Number(folder.fileCount || 0),
            failedCount: Number(folder.failedCount || 0),
            lastScanned: folder.lastScanned || null
        };
    }

    async function persistFolderScanResult(folder, files, existingDb = null) {
        const ownsDb = !existingDb;
        let db = existingDb;
        const normalizedFiles = (Array.isArray(files) ? files : []).map(toPersistedScannedFileRecord);
        folder.fileCount = normalizedFiles.length;
        folder.lastScanned = Date.now();
        try {
            if (!db) db = await openMediaDB();
            await idbClearByIndex(db, FILES_STORE, 'folderId', folder.id);
            for (const file of normalizedFiles) await idbPut(db, FILES_STORE, file);
            await idbPut(db, FOLDER_STORE, toStorableFolder(folder));
        } catch (e) {
            console.warn('[Auralis] Failed to persist folder scan result:', e);
        } finally {
            if (ownsDb && db) db.close();
        }
        scannedFiles = (Array.isArray(scannedFiles) ? scannedFiles : [])
            .filter(file => file.folderId !== folder.id)
            .concat(normalizedFiles);
        return normalizedFiles;
    }

    async function scanAndPersistFolder(folder, options = {}) {
        if (!folder) return [];
        const files = await scanFolder(folder, options.onProgress || null);
        const persisted = await persistFolderScanResult(folder, files);
        if (options.mergeLibrary) {
            await syncLibraryFromMediaState();
        }
        renderSettingsFolderList();
        syncEmptyState();
        return persisted;
    }

    // â”€â”€ Remove a folder from the store â”€â”€

    async function removeFolderById(folderId) {
        mediaFolders = mediaFolders.filter(f => f.id !== folderId);
        scannedFiles = scannedFiles.filter(f => f.folderId !== folderId);

        for (const url of blobUrlCache.values()) {
            try { URL.revokeObjectURL(url); } catch (_) { /* benign: cleanup */ }
        }
        blobUrlCache.clear();
        fileHandleCache.clear();
        artHandleCache.clear();

        let db;
        try {
            db = await openMediaDB();
            await idbDelete(db, FOLDER_STORE, folderId);
            await idbClearByIndex(db, FILES_STORE, 'folderId', folderId);
        } catch (e) {
            console.warn('IDB delete failed:', e);
        } finally {
            if (db) db.close();
        }

        if (mediaFolders.length > 0) {
            await rebuildFileHandleCache();
        }
    }

    // â”€â”€ Full scan of all folders â”€â”€

    async function scanAllFolders(progressUI) {
        if (scanInProgress) return;
        scanInProgress = true;

        // Clear stale blob URLs on rescan
        for (const url of blobUrlCache.values()) {
            try { URL.revokeObjectURL(url); } catch (_) { /* benign: cleanup */ }
        }
        blobUrlCache.clear();
        fileHandleCache.clear();
        artHandleCache.clear();

        const allFiles = [];
        let totalFound = 0;
        let foldersScanned = 0;
        const totalFolders = mediaFolders.length;

        let db;
        try {
            db = await openMediaDB();
        } catch (e) {
            console.warn('Could not open IDB for scan:', e);
            scanInProgress = false;
            return [];
        }

        try {
            for (const folder of mediaFolders) {
                let files = [];
                const hasLiveSource = folderHasLiveScanSource(folder);

                if (hasLiveSource) {
                    files = await scanFolder(folder, (count) => {
                        totalFound = allFiles.length + count;
                        if (progressUI) progressUI(totalFound, folder.name, foldersScanned, totalFolders);
                    });
                    await persistFolderScanResult(folder, files, db);
                } else {
                    files = getCachedFilesForFolder(folder.id);
                    if (files.length > 0) {
                        folder.fileCount = files.length;
                        console.warn('[Auralis] Keeping cached scan for "' + folder.name + '" because no live folder handle is available.');
                    } else {
                        files = await scanFolder(folder, (count) => {
                            totalFound = allFiles.length + count;
                            if (progressUI) progressUI(totalFound, folder.name, foldersScanned, totalFolders);
                        });
                        await persistFolderScanResult(folder, files, db);
                    }
                }

                allFiles.push(...files);
                foldersScanned++;
                if (progressUI) progressUI(allFiles.length, folder.name, foldersScanned, totalFolders);
            }
        } finally {
            if (db) db.close();
            scannedFiles = allFiles;
            scanInProgress = false;
        }

        return allFiles;
    }

    // â”€â”€ Confirm dialog â”€â”€

    function showConfirm(title, body, acceptLabel, callback) {
        const scrim = getEl('confirm-scrim');
        if (!scrim) return;
        const titleEl = getEl('confirm-title');
        const bodyEl = getEl('confirm-body');
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.textContent = body;
        const acceptBtn = getEl('confirm-accept-btn');
        if (acceptBtn) acceptBtn.textContent = acceptLabel;
        confirmCallback = callback;
        scrim.classList.add('show');
        // Focus the cancel button for keyboard accessibility
        setTimeout(() => {
            const cancelBtn = scrim.querySelector('.confirm-cancel');
            if (cancelBtn) cancelBtn.focus();
        }, 50);
    }

    function confirmCancel() {
        const scrim = getEl('confirm-scrim');
        if (scrim) scrim.classList.remove('show');
        confirmCallback = null;
    }

    async function confirmAccept() {
        const scrim = getEl('confirm-scrim');
        if (scrim) scrim.classList.remove('show');
        if (confirmCallback) { const cb = confirmCallback; confirmCallback = null; await cb(); }
    }

    // Escape key dismisses confirm dialog
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && getEl('confirm-scrim')?.classList.contains('show')) {
            e.stopPropagation();
            confirmCancel();
        }
    });

    // â”€â”€ UI: Render setup folder list â”€â”€

    function createFolderIcon(className) {
        const icon = document.createElement('div');
        icon.className = className;
        icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
        return icon;
    }

    function createSetupFolderEmptyHint() {
        const empty = document.createElement('div');
        empty.className = 'setup-folder-empty-hint';
        empty.appendChild(createFolderIcon(''));
        const copy = document.createElement('p');
        copy.appendChild(document.createTextNode('No folders added yet.'));
        copy.appendChild(document.createElement('br'));
        copy.appendChild(document.createTextNode('Tap below to browse.'));
        empty.appendChild(copy);
        return empty;
    }

    function createSetupFolderItem(folder) {
        const el = document.createElement('div');
        el.className = 'setup-folder-item selected';
        el.dataset.folderId = folder.id;
        el.dataset.action = 'toggleSetupFolder';
        el.tabIndex = 0;
        el.setAttribute('role', 'checkbox');
        el.setAttribute('aria-checked', 'true');
        el.setAttribute('aria-label', folder.name);

        const info = document.createElement('div');
        info.className = 'folder-info';
        const title = document.createElement('h3');
        title.textContent = folder.name;
        const count = document.createElement('span');
        count.textContent = folder.fileCount > 0 ? `${folder.fileCount} audio files` : 'Not scanned yet';
        info.appendChild(title);
        info.appendChild(count);

        const check = document.createElement('div');
        check.className = 'folder-check';
        check.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

        el.appendChild(createFolderIcon('folder-icon'));
        el.appendChild(info);
        el.appendChild(check);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSetupFolder(el);
            }
        });
        return el;
    }

    function createSettingsFolderItem(folder) {
        const el = document.createElement('div');
        el.className = 'settings-folder-item';
        el.dataset.folderId = folder.id;

        const failedCount = Number(folder.failedCount || 0);
        const fileCount = Number(folder.fileCount || 0);
        const countText = fileCount > 0
            ? `${fileCount} audio file${fileCount === 1 ? '' : 's'}${failedCount ? ` - ${failedCount} failed` : ''}`
            : (folder.lastScanned ? 'No audio files found' : 'Not scanned yet');
        const scanDate = folder.lastScanned
            ? ` Â· Scanned ${new Date(folder.lastScanned).toLocaleDateString()}`
            : '';

        const info = document.createElement('div');
        info.className = 'settings-folder-info';
        const title = document.createElement('h3');
        title.textContent = folder.name;
        const meta = document.createElement('span');
        meta.textContent = countText + scanDate;
        const status = document.createElement('div');
        status.className = 'settings-folder-status';
        const lastScanned = Number(folder.lastScanned || 0);
        status.textContent = lastScanned
            ? `Last scanned ${new Date(lastScanned).toLocaleDateString()}`
            : 'Ready to scan';
        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(status);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'settings-folder-remove';
        remove.dataset.action = 'removeSettingsFolder';
        remove.dataset.folderId = folder.id;
        remove.title = 'Remove folder';
        remove.setAttribute('aria-label', `Remove ${folder.name}`);
        remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

        el.appendChild(createFolderIcon('settings-folder-icon'));
        el.appendChild(info);
        el.appendChild(remove);
        return el;
    }

    function renderSetupFolderList() {
        const list = getEl('setup-folder-list');
        if (!list) return;
        clearNodeChildren(list);
        if (mediaFolders.length === 0) {
            list.appendChild(createSetupFolderEmptyHint());
        } else {
            appendFragment(list, mediaFolders.map((folder) => createSetupFolderItem(folder)));
        }
        syncSetupConfirmBtn();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function syncSetupConfirmBtn() {
        const btn = getEl('setup-confirm-btn');
        if (!btn) return;
        const selected = document.querySelectorAll('#setup-folder-list .setup-folder-item.selected');
        if (selected.length > 0) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.pointerEvents = 'none';
        }
    }

    // â”€â”€ UI: Render settings folder list â”€â”€

    function renderSettingsFolderList() {
        const wrap = getEl('settings-media-folders');
        if (!wrap) return;
        // Remove all folder items (keep the add button and empty state)
        wrap.querySelectorAll('.settings-folder-item').forEach(el => el.remove());
        const addBtn = wrap.querySelector('.settings-add-folder');
        const emptyEl = getEl('settings-folder-empty');
        const unsupportedBanner = getEl('settings-api-unsupported');
        const unsupportedBannerText = getEl('settings-api-unsupported-text');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();

        if (unsupportedBanner) {
            unsupportedBanner.style.display = unsupportedMessage ? 'flex' : 'none';
        }
        if (unsupportedBannerText && unsupportedMessage) {
            unsupportedBannerText.textContent = unsupportedMessage;
        }
        if (addBtn) {
            addBtn.classList.toggle('is-disabled', Boolean(unsupportedMessage));
            addBtn.setAttribute('aria-disabled', unsupportedMessage ? 'true' : 'false');
            addBtn.title = unsupportedMessage || 'Add music folder';
        }

        if (mediaFolders.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            if (emptyEl) {
                const messageEl = emptyEl.querySelector('p');
                if (messageEl) {
                    messageEl.textContent = unsupportedMessage || 'No folders added yet';
                    messageEl.style.color = unsupportedMessage ? 'var(--sys-warning)' : 'var(--text-tertiary)';
                }
            }
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            const fragment = document.createDocumentFragment();
            mediaFolders.forEach((folder) => fragment.appendChild(createSettingsFolderItem(folder)));
            if (addBtn) wrap.insertBefore(fragment, addBtn);
            else wrap.appendChild(fragment);
        }

        // Update rescan button state
        const rescanBtn = getEl('settings-rescan-btn');
        if (rescanBtn) {
            if (mediaFolders.length === 0 || scanInProgress) {
                rescanBtn.style.opacity = '0.4';
                rescanBtn.style.pointerEvents = 'none';
            } else {
                rescanBtn.style.opacity = '1';
                rescanBtn.style.pointerEvents = 'auto';
            }
        }

        // Update header with folder/file count
        const header = getEl('settings-media-header');
        if (header) {
            const totalFiles = scannedFiles.length;
            if (mediaFolders.length === 0) {
                header.textContent = 'Media Folders';
            } else {
                header.textContent = 'Media Folders (' + mediaFolders.length + ')' +
                    (totalFiles > 0 ? ' Â· ' + totalFiles + ' files' : '');
            }
        }

        updatePlaybackHealthWarnings();
    }

    // â”€â”€ UI: Sync empty state (driven by real data) â”€â”€

    function syncEmptyState() {
        const emptyState = getEl('home-empty-state');
        const sectionsRoot = getEl('home-sections-root');
        const addBtn = document.querySelector('#home-music-section > .add-section-btn[data-action="openAddHomeSection"]');
        if (!emptyState) return;

        const hasMedia = scannedFiles.length > 0 || (LIBRARY_TRACKS && LIBRARY_TRACKS.length > 0);

        if (!hasMedia && mediaFolders.length === 0) {
            emptyState.style.display = 'flex';
            if (sectionsRoot) sectionsRoot.style.display = 'none';
            if (addBtn) addBtn.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            if (sectionsRoot) sectionsRoot.style.display = '';
            if (addBtn) addBtn.style.display = addBtn.dataset.forceVisible === '1' ? 'flex' : '';
        }

        updatePlaybackHealthWarnings();
    }

    // â”€â”€ Action handlers â”€â”€

    function showFirstTimeSetup() {
        const setup = getEl('first-time-setup');
        if (!setup) return;

        // Check for API support
        const banner = getEl('setup-api-unsupported');
        const bannerText = banner ? banner.querySelector('span') : null;
        const addBtn = getEl('setup-add-folder-btn');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();
        if (unsupportedMessage) {
            if (banner) banner.style.display = 'flex';
            if (bannerText) bannerText.textContent = unsupportedMessage;
            if (addBtn) { addBtn.style.opacity = '0.4'; addBtn.style.pointerEvents = 'none'; }
        } else {
            if (banner) banner.style.display = 'none';
            if (addBtn) { addBtn.style.opacity = '1'; addBtn.style.pointerEvents = 'auto'; }
        }

        // Reset scan progress UI
        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const btn = getEl('setup-confirm-btn');
        if (progress) progress.style.display = 'none';
        if (fill) fill.style.width = '0%';
        if (btn) { btn.textContent = 'Scan Selected'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; }

        renderSetupFolderList();
        setup.style.display = 'flex';
        setTimeout(() => setup.classList.add('active'), 40);
    }

    function hideFirstTimeSetup() {
        const setup = getEl('first-time-setup');
        if (!setup) return;
        setup.classList.remove('active');
        setTimeout(() => {
            setup.style.display = 'none';
            syncBottomNavVisibility();
            syncEmptyState();
            renderSettingsFolderList();
        }, 500);
    }

    function toggleSetupFolder(el) {
        el.classList.toggle('selected');
        el.setAttribute('aria-checked', el.classList.contains('selected') ? 'true' : 'false');
        syncSetupConfirmBtn();
    }

    async function addFolderViaPicker(options = {}) {
        console.log('[Auralis][FolderPicker] addFolderViaPicker called');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();
        console.log('[Auralis][FolderPicker] unsupportedMessage=', JSON.stringify(unsupportedMessage));
        if (unsupportedMessage) {
            toast(unsupportedMessage);
            if (typeof options.onUnsupported === 'function') options.onUnsupported();
            return null;
        }

        const trigger = options.triggerEl || null;
        if (trigger) {
            trigger.style.pointerEvents = 'none';
            trigger.style.opacity = '0.5';
        }

        try {
            console.log('[Auralis][FolderPicker] calling pickFolder()...');
            const handle = await pickFolder();
            console.log('[Auralis][FolderPicker] pickFolder returned:', handle);
            if (!handle) return null;
            const folder = await addFolderFromHandle(handle);
            if (typeof options.onSelected === 'function') await options.onSelected(folder);

            // Auto-scan fallback folders immediately while File objects are still live.
            // Settings also opts into immediate native-handle scanning so a chosen
            // folder appears in the library without requiring a second tap.
            if ((folder._fallbackFiles && folder._fallbackFiles.length > 0) || options.scanAfterAdd) {
                console.log('[Auralis][FolderPicker] Scanning newly added folder:', folder.name);
                const files = await scanAndPersistFolder(folder, {
                    mergeLibrary: Boolean(options.mergeAfterScan)
                });
                console.log('[Auralis][FolderPicker] Initial scan complete:', files.length, 'files for', folder.name);
            }

            if (typeof options.onAdded === 'function') await options.onAdded(folder);
            return folder;
        } catch (err) {
            console.error('[Auralis][FolderPicker] addFolderViaPicker error:', err);
            toast('Folder error: ' + (err.message || err));
            return null;
        } finally {
            if (trigger) {
                trigger.style.pointerEvents = 'auto';
                trigger.style.opacity = '1';
            }
        }
    }

    async function addSetupFolder() {
        const btn = getEl('setup-add-folder-btn');
        await addFolderViaPicker({
            triggerEl: btn,
            scanAfterAdd: true,
            onSelected: renderSetupFolderList,
            onAdded: renderSetupFolderList
        });
    }

    async function confirmSetup() {
        // Remove deselected folders
        const selectedIds = new Set();
        document.querySelectorAll('#setup-folder-list .setup-folder-item.selected').forEach(el => {
            selectedIds.add(el.dataset.folderId);
        });
        const toRemove = mediaFolders.filter(f => !selectedIds.has(f.id));
        for (const f of toRemove) await removeFolderById(f.id);

        if (mediaFolders.length === 0) {
            toast('Add at least one folder first');
            return;
        }

        safeStorage.setItem(SETUP_DONE_KEY, '1');

        // Show real scan progress
        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const label = getEl('setup-scan-label');
        const count = getEl('setup-scan-count');
        const btn = getEl('setup-confirm-btn');
        if (progress) progress.style.display = 'block';
        if (btn) { btn.textContent = 'Scanning...'; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6'; }

        try {
            await scanAllFolders((totalFiles, folderName, done, total) => {
                const folderPct = total > 0 ? (done / total) * 80 : 0;
                const pct = Math.min(99, folderPct + 10);
                if (fill) fill.style.width = pct + '%';
                if (label) label.textContent = 'Scanning ' + folderName + '...';
                if (count) count.textContent = totalFiles + ' files found';
            });
        } catch (e) {
            console.warn('Scan error:', e);
            if (label) label.textContent = 'Scan error â€” some files may be missing';
            if (btn) { btn.textContent = 'Continue Anyway'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; }
            toast('Scan encountered an error: ' + (e.message || 'unknown'));
        }

        if (fill) fill.style.width = '100%';
        if (label) label.textContent = 'Scan complete!';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';

        // Build playable library entries from scanned files
        await mergeScannedIntoLibrary();

        toast(scannedFiles.length + ' tracks added to your library');
        setTimeout(() => hideFirstTimeSetup(), 800);
    }

    async function confirmSetupSmart() {
        const selectedIds = new Set();
        document.querySelectorAll('#setup-folder-list .setup-folder-item.selected').forEach(el => {
            selectedIds.add(el.dataset.folderId);
        });

        const allSelectedFallbackFolders = mediaFolders.length > 0
            && mediaFolders.every((folder) => selectedIds.has(folder.id))
            && mediaFolders.every((folder) => {
                const hasLiveFallbackFiles = Array.isArray(folder?._fallbackFiles) && folder._fallbackFiles.length > 0;
                if (!hasLiveFallbackFiles) return false;
                return scannedFiles.some((file) => file.folderId === folder.id);
            });

        if (!allSelectedFallbackFolders) {
            return confirmSetup();
        }

        const toRemove = mediaFolders.filter(f => !selectedIds.has(f.id));
        for (const f of toRemove) await removeFolderById(f.id);

        if (mediaFolders.length === 0) {
            toast('Add at least one folder first');
            return;
        }

        safeStorage.setItem(SETUP_DONE_KEY, '1');

        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const label = getEl('setup-scan-label');
        const count = getEl('setup-scan-count');
        const btn = getEl('setup-confirm-btn');

        if (progress) progress.style.display = 'block';
        if (fill) fill.style.width = '100%';
        if (label) label.textContent = 'Using indexed folder contents...';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';
        if (btn) { btn.textContent = 'Scanning...'; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6'; }

        await mergeScannedIntoLibrary();

        if (label) label.textContent = 'Scan complete!';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';

        toast(scannedFiles.length + ' tracks added to your library');
        setTimeout(() => hideFirstTimeSetup(), 800);
    }

    function skipSetup() {
        safeStorage.setItem(SETUP_DONE_KEY, 'skipped');
        hideFirstTimeSetup();
    }

    function openMediaFolderSetup() {
        showFirstTimeSetup();
    }
/* <<< 05-media-folder-idb.js */

/* >>> 06-setup-init-a11y.js */
/*
 * Auralis JS shard: 06-setup-init-a11y.js
 * Purpose: setup flow, dialogs, accessibility, boot/init
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    // Overlay focus helper — moves focus to the first actionable control inside a
    // dialog or sheet, deferred one frame so CSS transitions don't fight focus.
    function focusFirstAction(root) {
        requestAnimationFrame(() => {
            const firstAction = root && root.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (firstAction && typeof firstAction.focus === 'function') {
                firstAction.focus();
            }
        });
    }

    // Settings: add folder
    async function addSettingsFolder() {
        console.log('[Auralis][FolderPicker] addSettingsFolder() called');
        const addBtn = document.querySelector('.settings-add-folder');
        const folder = await addFolderViaPicker({
            triggerEl: addBtn,
            scanAfterAdd: true,
            mergeAfterScan: true,
            onUnsupported: () => {
                renderSettingsFolderList();
            },
            onSelected: () => {
                renderSettingsFolderList();
            },
            onAdded: () => {
                renderSettingsFolderList();
            }
        });
        if (folder) {
            toast('"' + folder.name + '" indexed');
        }
    }

    function runSynchronousFallbackFolderPick(options = {}) {
        const trigger = options.triggerEl || null;
        if (trigger) {
            trigger.style.pointerEvents = 'none';
            trigger.style.opacity = '0.5';
        }

        // Must be invoked directly from a trusted click handler so input.click()
        // happens in the same task as user activation.
        const pickPromise = pickFolderViaInput();

        (async () => {
            try {
                const handle = await pickPromise;
                if (!handle) return;
                const folder = await addFolderFromHandle(handle);
                if (typeof options.onSelected === 'function') {
                    await options.onSelected(folder);
                }

                // IMPORTANT: For <input webkitdirectory> fallback folders, _fallbackFiles
                // (the File objects) only exist in this browser session. They cannot be
                // serialized to IndexedDB. If we defer scanning to "Scan Selected" / "Rescan",
                // a page reload in between will lose the File objects and the scan returns 0.
                // Fix: immediately scan the folder while File objects are still live, and
                // persist the resulting file records to IDB right now.
                if ((folder._fallbackFiles && folder._fallbackFiles.length > 0) || options.scanAfterAdd) {
                    console.log('[Auralis][FolderPicker] Auto-scanning fallback folder while File objects are live:', folder.name);
                    const files = await scanAndPersistFolder(folder, {
                        mergeLibrary: Boolean(options.mergeAfterScan)
                    });
                    console.log('[Auralis][FolderPicker] Auto-scan complete:', files.length, 'audio files indexed for', folder.name);
                }

                if (typeof options.onAdded === 'function') {
                    await options.onAdded(folder);
                }
            } catch (err) {
                console.error('[Auralis][FolderPicker] runSynchronousFallbackFolderPick error:', err);
                toast('Folder error: ' + (err.message || err));
            } finally {
                if (trigger) {
                    trigger.style.pointerEvents = 'auto';
                    trigger.style.opacity = '1';
                }
            }
        })();
    }

    function shouldUseSynchronousFallbackPicker() {
        return hasFallbackFolderInput() && !shouldUseNativePicker();
    }

    function initFolderPickerBindings() {
        const settingsAddBtn = document.querySelector('.settings-add-folder');
        console.log('[Auralis][FolderPicker] initFolderPickerBindings: settingsAddBtn=', settingsAddBtn, 'alreadyBound=', settingsAddBtn?.dataset.boundFolderPicker);
        if (settingsAddBtn && settingsAddBtn.dataset.boundFolderPicker !== '1') {
            settingsAddBtn.dataset.boundFolderPicker = '1';
            settingsAddBtn.addEventListener('click', (e) => {
                console.log('[Auralis][FolderPicker] Settings Add Folder CLICKED (direct binding)');
                e.preventDefault();
                e.stopPropagation();
                if (shouldUseSynchronousFallbackPicker()) {
                    console.log('[Auralis][FolderPicker] Settings Add Folder using synchronous fallback path');
                    runSynchronousFallbackFolderPick({
                        triggerEl: settingsAddBtn,
                        scanAfterAdd: true,
                        mergeAfterScan: true,
                        onSelected: () => {
                            renderSettingsFolderList();
                        },
                        onAdded: (folder) => {
                            renderSettingsFolderList();
                            if (folder) {
                                toast('"' + folder.name + '" indexed');
                            }
                        }
                    });
                    return;
                }
                addSettingsFolder();
            });
        }

        const setupAddBtn = getEl('setup-add-folder-btn');
        console.log('[Auralis][FolderPicker] initFolderPickerBindings: setupAddBtn=', setupAddBtn, 'alreadyBound=', setupAddBtn?.dataset.boundFolderPicker);
        if (setupAddBtn && setupAddBtn.dataset.boundFolderPicker !== '1') {
            setupAddBtn.dataset.boundFolderPicker = '1';
            setupAddBtn.addEventListener('click', (e) => {
                console.log('[Auralis][FolderPicker] Setup Add Folder CLICKED (direct binding)');
                e.preventDefault();
                e.stopPropagation();
                if (shouldUseSynchronousFallbackPicker()) {
                    console.log('[Auralis][FolderPicker] Setup Add Folder using synchronous fallback path');
                    runSynchronousFallbackFolderPick({
                        triggerEl: setupAddBtn,
                        scanAfterAdd: true,
                        onSelected: () => {
                            renderSetupFolderList();
                        },
                        onAdded: () => {
                            renderSetupFolderList();
                        }
                    });
                    return;
                }
                addSetupFolder();
            });
        }

        console.log('[Auralis][FolderPicker] Environment: protocol=', location.protocol, 'isSecureContext=', window.isSecureContext, 'hasShowDirectoryPicker=', typeof window.showDirectoryPicker, 'shouldUseNative=', shouldUseNativePicker(), 'hasFallback=', hasFallbackFolderInput());
    }

    // Settings: remove folder (with confirm)
    function removeSettingsFolder(e, el) {
        e.stopPropagation();
        const folderId = el.dataset.folderId || el.closest('[data-folder-id]')?.dataset.folderId;
        if (!folderId) return;
        const folder = mediaFolders.find(f => f.id === folderId);
        const name = folder ? folder.name : 'this folder';
        const folderIndex = mediaFolders.findIndex(f => f.id === folderId);
        const removedFolder = folder ? { ...folder } : null;
        const removedFiles = scannedFiles
            .filter((file) => file.folderId === folderId)
            .map((file) => ({ ...file }));
        showConfirm(
            'Remove "' + name + '"?',
            'This will remove the folder and its ' + (folder?.fileCount || 0) + ' indexed files from your library. No files will be deleted from your device.',
            'Remove',
            async () => {
                await removeFolderById(folderId);
                await syncLibraryFromMediaState();
                renderSettingsFolderList();
                presentUndoToast('"' + name + '" removed', 'Undo', async () => {
                    if (!removedFolder || mediaFolders.some((candidate) => candidate.id === folderId)) return;
                    mediaFolders.splice(Math.max(0, Math.min(folderIndex, mediaFolders.length)), 0, removedFolder);
                    scannedFiles = scannedFiles.filter((file) => file.folderId !== folderId).concat(removedFiles.map((file) => ({ ...file })));

                    let db;
                    try {
                        db = await openMediaDB();
                        const storable = {
                            id: removedFolder.id,
                            name: removedFolder.name,
                            handle: removedFolder.handle || null,
                            fileCount: removedFolder.fileCount || removedFiles.length,
                            lastScanned: removedFolder.lastScanned || null
                        };
                        await idbPut(db, FOLDER_STORE, storable);
                        await idbClearByIndex(db, FILES_STORE, 'folderId', folderId);
                        for (const file of removedFiles) await idbPut(db, FILES_STORE, file);
                    } catch (restoreError) {
                        console.warn('IDB folder restore failed:', restoreError);
                    } finally {
                        if (db) db.close();
                    }

                    if (mediaFolders.length > 0) await rebuildFileHandleCache();
                    await syncLibraryFromMediaState();
                    renderSettingsFolderList();
                });
            }
        );
    }

    // Settings: rescan all folders
    async function rescanFolders() {
        if (scanInProgress) return;
        if (mediaFolders.length === 0) {
            toast('Add a folder first');
            return;
        }

        const statusEl = getEl('settings-scan-status');
        const fillEl = getEl('settings-scan-fill');
        const labelEl = getEl('settings-scan-label');
        const countEl = getEl('settings-scan-count');
        const rescanBtn = getEl('settings-rescan-btn');
        if (statusEl) statusEl.style.display = 'block';
        if (rescanBtn) { rescanBtn.textContent = 'Scanning...'; rescanBtn.style.pointerEvents = 'none'; rescanBtn.style.opacity = '0.6'; }

        try {
            await scanAllFolders((totalFiles, folderName, done, total) => {
                const folderPct = total > 0 ? (done / total) * 90 : 0;
                const pct = Math.min(95, folderPct + 5);
                if (labelEl) labelEl.textContent = 'Scanning ' + folderName + '...';
                if (countEl) countEl.textContent = totalFiles + ' files';
                if (fillEl) fillEl.style.width = pct + '%';
            });
        } catch (e) {
            console.warn('Rescan error:', e);
        }

        if (fillEl) fillEl.style.width = '100%';
        if (labelEl) labelEl.textContent = 'Scan complete!';
        if (countEl) countEl.textContent = scannedFiles.length + ' audio files';
        if (rescanBtn) { rescanBtn.textContent = 'Scan Library'; rescanBtn.style.pointerEvents = 'auto'; rescanBtn.style.opacity = '1'; }

        // Build playable library entries from scanned files
        await mergeScannedIntoLibrary();
        renderSettingsFolderList();

        toast(scannedFiles.length + ' tracks added to your library');
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2000);
    }

    // Long press (inline handler support)
    function startLongPress(e, title, sub) {
        clearLongPress();
        if (e && e.type === 'mousedown' && e.button !== 0) return;

        lpTimer = setTimeout(() => {
            markLongPressSuppressed(e?.currentTarget || e?.target || null);
            if (navigator.vibrate) navigator.vibrate(40);
            if (openInferredLongPressMenu(title, sub)) return;
            openSheet(title || 'Action Options', sub || 'Media Object');
        }, 600);
    }

    function clearLongPress() {
        if (lpTimer) {
            clearTimeout(lpTimer);
            lpTimer = null;
        }
    }
    // Queue behavior
    function moveQueueTrack(fromIndex, toIndex) {
        const from = Number(fromIndex);
        let to = Number(toIndex);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
        if (from < 0 || from >= queueTracks.length) return false;
        to = Math.max(0, Math.min(to, queueTracks.length - 1));
        if (from === to) return false;

        const currentIdx = getCurrentQueueIndex();
        const [moved] = queueTracks.splice(from, 1);
        queueTracks.splice(to, 0, moved);

        if (currentIdx === from) {
            queueIndex = to;
        } else if (from < currentIdx && to >= currentIdx) {
            queueIndex = Math.max(0, currentIdx - 1);
        } else if (from > currentIdx && to <= currentIdx) {
            queueIndex = Math.min(queueTracks.length - 1, currentIdx + 1);
        } else if (currentIdx >= 0) {
            queueIndex = currentIdx;
        }
        renderQueue();
        return true;
    }

    function moveQueueTrackNext(index) {
        const from = Number(index);
        if (!Number.isFinite(from)) return;
        const currentIdx = getCurrentQueueIndex();
        if (currentIdx < 0) {
            if (moveQueueTrack(from, 0)) {
                renderQueue();
                toast('Track moved to top of queue');
            }
            return;
        }
        if (from === currentIdx) {
            toast('Track is already playing');
            return;
        }
        const target = Math.min(currentIdx + 1, queueTracks.length - 1);
        if (moveQueueTrack(from, target)) {
            renderQueue();
            toast('Track will play next');
        } else {
            toast('Track is already next');
        }
    }

    function removeQueueTrack(index) {
        const idx = Number(index);
        if (!Number.isFinite(idx) || idx < 0 || idx >= queueTracks.length) return;

        const previousQueueTracks = queueTracks.slice();
        const previousQueueIndex = queueIndex;
        const previousNowPlaying = nowPlaying;
        const removed = queueTracks[idx];
        const currentIdx = getCurrentQueueIndex();
        const removingCurrent = idx === currentIdx;
        const engine = ensureAudioEngine();
        const wasPlaying = Boolean(isPlaying && engine && !engine.paused);

        const restoreRemovedTrack = () => {
            const shouldReload = Boolean(previousNowPlaying && !isSameTrack(nowPlaying, previousNowPlaying));
            queueTracks = previousQueueTracks.slice();
            queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
            if (previousNowPlaying) {
                setNowPlaying(previousNowPlaying, false);
                queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
                if (shouldReload) loadTrackIntoEngine(previousNowPlaying, wasPlaying, true);
                else setPlayButtonState(wasPlaying);
            } else {
                clearNowPlayingState();
                setPlayButtonState(false);
            }
            commitQueueChange();
            syncTrackActiveStates();
        };

        queueTracks.splice(idx, 1);
        if (!queueTracks.length) {
            queueIndex = 0;
            if (removingCurrent && engine) {
                engine.pause();
                setPlayButtonState(false);
            }
            commitQueueChange();
            presentUndoToast('Queue is now empty', 'Undo', restoreRemovedTrack);
            return;
        }

        if (removingCurrent) {
            const nextIdx = Math.min(idx, queueTracks.length - 1);
            const nextTrack = queueTracks[nextIdx];
            queueIndex = nextIdx;
            if (nextTrack) {
                setNowPlaying(nextTrack, true);
                loadTrackIntoEngine(nextTrack, wasPlaying, true);
            }
        } else if (idx < currentIdx) {
            queueIndex = Math.max(0, currentIdx - 1);
        }

        commitQueueChange();
        presentUndoToast(`Removed "${removed?.title || 'track'}"`, 'Undo', restoreRemovedTrack);
    }

    function shuffleQueueUpNext() {
        if (!shuffleQueueOrder()) {
            toast('Not enough tracks to shuffle');
            return;
        }
        renderQueue();
        toast('Queue order shuffled');
    }

    function openQueueTrackMenu(track, index) {
        if (!track) return;
        showZenithActionSheet(
            track.title || 'Queue Track',
            `${track.artist || ARTIST_NAME} - ${track.albumTitle || 'Single'} - ${track.duration || '--:--'}`,
            [
                {
                    label: 'Play Now',
                    description: 'Jump to this track immediately.',
                    icon: 'music',
                    onSelect: () => playQueueTrackAt(index, true)
                },
                {
                    label: 'Move Next',
                    description: 'Place this track right after the current song.',
                    icon: 'next',
                    onSelect: () => moveQueueTrackNext(index)
                },
                {
                    label: 'Open Album',
                    description: track.albumTitle || 'Jump to source album.',
                    icon: 'album',
                    onSelect: () => routeToAlbumDetail(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track))
                },
                {
                    label: 'Remove From Queue',
                    description: 'Drop this track from the run list.',
                    icon: 'trash',
                    danger: true,
                    onSelect: () => removeQueueTrack(index)
                }
            ]
        );
    }

    function clearQueue() {
        if (!queueTracks.length) {
            toast('Queue is already empty');
            renderQueue();
            return;
        }
        const previousQueueTracks = queueTracks.slice();
        const previousQueueIndex = queueIndex;
        const previousNowPlaying = nowPlaying;
        const engine = ensureAudioEngine();
        const wasPlaying = Boolean(isPlaying && engine && !engine.paused);

        const restoreClearedQueue = () => {
            const shouldReload = Boolean(previousNowPlaying && !isSameTrack(nowPlaying, previousNowPlaying));
            queueTracks = previousQueueTracks.slice();
            queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
            if (previousNowPlaying) {
                setNowPlaying(previousNowPlaying, false);
                queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
                if (shouldReload) loadTrackIntoEngine(previousNowPlaying, wasPlaying, true);
                else setPlayButtonState(wasPlaying);
            } else {
                clearNowPlayingState();
                setPlayButtonState(false);
            }
            commitQueueChange();
            syncTrackActiveStates();
        };

        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0 && queueTracks[currentIdx]) {
            const currentTrack = queueTracks[currentIdx];
            queueTracks = [currentTrack];
            queueIndex = 0;
            commitQueueChange();
            presentUndoToast('Cleared upcoming tracks', 'Undo', restoreClearedQueue);
            return;
        }
        queueTracks = [];
        queueIndex = 0;
        commitQueueChange();
        presentUndoToast('Queue cleared', 'Undo', restoreClearedQueue);
    }

    function addCurrentToQueue() {
        if (!nowPlaying) return;
        if (!insertTrackInQueue(nowPlaying, 'end')) return;
        commitQueueChange(`Added "${nowPlaying.title}" to queue`);
    }

    function playCurrentNext() {
        if (!nowPlaying) return;
        const key = getTrackIdentityKey(nowPlaying);
        queueTracks = queueTracks.filter((track) => getTrackIdentityKey(track) !== key);
        const currentIdx = Math.max(0, getCurrentQueueIndex());
        queueTracks.splice(Math.min(currentIdx + 1, queueTracks.length), 0, nowPlaying);
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(0, MAX_QUEUE_SIZE);
        commitQueueChange(`"${nowPlaying.title}" will play next`);
    }

    function bindQueueInteractions(container = null) {
        const list = container || getEl('player-inline-queue-list');
        if (!list || list.dataset.queueBound === '1') return;
        list.dataset.queueBound = '1';

        let dragSourceIndex = -1;
        let dragSourceRow = null;

        const clearDropMarkers = () => {
            list.querySelectorAll('.queue-row.queue-drop-before, .queue-row.queue-drop-after').forEach((row) => {
                row.classList.remove('queue-drop-before', 'queue-drop-after');
            });
        };

        list.addEventListener('dragstart', (evt) => {
            const handle = evt.target?.closest('.queue-drag-handle');
            const row = handle?.closest('.queue-row');
            if (!row || row.dataset.queueReorderable !== '1') {
                evt.preventDefault();
                return;
            }
            dragSourceRow = row;
            dragSourceIndex = Number(row.dataset.queueIndex);
            row.classList.add('is-dragging');
            if (evt.dataTransfer) {
                evt.dataTransfer.effectAllowed = 'move';
                evt.dataTransfer.setData('text/plain', String(dragSourceIndex));
            }
        });

        list.addEventListener('dragover', (evt) => {
            const row = evt.target?.closest('.queue-row');
            if (!row || row === dragSourceRow || !list.contains(row) || row.dataset.queueReorderable !== '1') return;
            evt.preventDefault();
            clearDropMarkers();
            const rect = row.getBoundingClientRect();
            const insertAfter = evt.clientY > (rect.top + rect.height / 2);
            row.classList.add(insertAfter ? 'queue-drop-after' : 'queue-drop-before');
        });

        list.addEventListener('drop', (evt) => {
            const row = evt.target?.closest('.queue-row');
            if (!row || row === dragSourceRow || dragSourceIndex < 0 || row.dataset.queueReorderable !== '1') return;
            evt.preventDefault();
            const targetIndex = Number(row.dataset.queueIndex);
            const rect = row.getBoundingClientRect();
            const insertAfter = evt.clientY > (rect.top + rect.height / 2);
            let nextIndex = targetIndex + (insertAfter ? 1 : 0);
            if (dragSourceIndex < nextIndex) nextIndex -= 1;
            if (moveQueueTrack(dragSourceIndex, nextIndex)) {
                queueDragSuppressUntil = Date.now() + 220;
                renderQueue();
            }
        });

        list.addEventListener('dragend', () => {
            clearDropMarkers();
            if (dragSourceRow) dragSourceRow.classList.remove('is-dragging');
            dragSourceRow = null;
            dragSourceIndex = -1;
        });

        let touchDrag = null;
        const cleanupTouchDrag = (applyMove) => {
            if (!touchDrag) return;
            const { row, ghost, placeholder, fromIndex } = touchDrag;
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
            if (row) {
                row.style.visibility = '';
                row.classList.remove('is-dragging');
            }

            if (applyMove && placeholder && list.contains(placeholder)) {
                const previousRow = placeholder.previousElementSibling?.classList?.contains('queue-row')
                    ? placeholder.previousElementSibling
                    : null;
                const nextRow = placeholder.nextElementSibling?.classList?.contains('queue-row')
                    ? placeholder.nextElementSibling
                    : null;
                const nextIndexBeforeRemoval = nextRow
                    ? Number(nextRow.dataset.queueIndex)
                    : queueTracks.length;
                let toIndex = nextIndexBeforeRemoval;
                if (fromIndex < nextIndexBeforeRemoval) toIndex -= 1;
                if (!nextRow && previousRow && !Number.isFinite(toIndex)) {
                    toIndex = Number(previousRow.dataset.queueIndex);
                }
                if (moveQueueTrack(fromIndex, toIndex)) {
                    queueDragSuppressUntil = Date.now() + 220;
                    renderQueue();
                }
            }
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            touchDrag = null;
            clearDropMarkers();
        };

        list.addEventListener('pointerdown', (evt) => {
            if (evt.pointerType === 'mouse') return;
            const handle = evt.target?.closest('.queue-drag-handle');
            const row = handle?.closest('.queue-row');
            if (!row || !list.contains(row) || row.dataset.queueReorderable !== '1') return;
            const fromIndex = Number(row.dataset.queueIndex);
            if (!Number.isFinite(fromIndex)) return;
            evt.preventDefault();

            const rect = row.getBoundingClientRect();
            const ghost = row.cloneNode(true);
            ghost.classList.add('queue-drag-ghost');
            ghost.style.left = `${rect.left}px`;
            ghost.style.top = `${rect.top}px`;
            ghost.style.width = `${rect.width}px`;
            ghost.style.height = `${rect.height}px`;
            document.body.appendChild(ghost);

            const placeholder = document.createElement('div');
            placeholder.className = 'queue-drop-placeholder';
            placeholder.style.height = `${rect.height}px`;
            row.parentNode.insertBefore(placeholder, row.nextSibling);
            row.style.visibility = 'hidden';
            row.classList.add('is-dragging');

            touchDrag = {
                pointerId: evt.pointerId,
                row,
                ghost,
                placeholder,
                fromIndex,
                offsetY: evt.clientY - rect.top,
                offsetX: evt.clientX - rect.left
            };
        });

        list.addEventListener('pointermove', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            evt.preventDefault();
            const { ghost, offsetY, offsetX, row, placeholder } = touchDrag;
            ghost.style.top = `${evt.clientY - offsetY}px`;
            ghost.style.left = `${evt.clientX - offsetX}px`;

            const over = document.elementFromPoint(evt.clientX, evt.clientY);
            const targetRow = over?.closest('.queue-row');
            if (targetRow && targetRow !== row && list.contains(targetRow) && targetRow.dataset.queueReorderable === '1') {
                const rect = targetRow.getBoundingClientRect();
                const insertAfter = evt.clientY > (rect.top + rect.height / 2);
                list.insertBefore(placeholder, insertAfter ? targetRow.nextSibling : targetRow);
            }

            const queueScrollRoot = list?.closest('.player-inline-queue-list') || list;
            if (queueScrollRoot) {
                const bounds = queueScrollRoot.getBoundingClientRect();
                const edge = 72;
                if (evt.clientY < bounds.top + edge) queueScrollRoot.scrollTop -= 12;
                if (evt.clientY > bounds.bottom - edge) queueScrollRoot.scrollTop += 12;
            }
        });

        list.addEventListener('pointerup', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            cleanupTouchDrag(true);
        });
        list.addEventListener('pointercancel', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            cleanupTouchDrag(false);
        });
    }

    // Drag + Drop
    function bindDragAndDrop(selector) {
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.dragBound === '1') return;
            el.dataset.dragBound = '1';

            el.addEventListener('dragstart', (e) => {
                el.classList.add('dragging');
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                const dragging = el.parentElement?.querySelector('.dragging');
                if (!dragging || dragging === el) return;

                const parent = el.parentElement;
                const nodes = Array.from(parent.children);
                const dragIndex = nodes.indexOf(dragging);
                const targetIndex = nodes.indexOf(el);
                if (dragIndex < targetIndex) parent.insertBefore(dragging, el.nextSibling);
                else parent.insertBefore(dragging, el);

                if (navigator.vibrate) navigator.vibrate(20);
            });
        });
    }

    function bindTouchReorder(selector) {
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.touchReorderBound === '1') return;
            el.dataset.touchReorderBound = '1';
        });

        let drag = null;

        const start = (point, target) => {
            const rect = target.getBoundingClientRect();

            const ghost = target.cloneNode(true);
            ghost.style.cssText = `position:fixed; left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; opacity:0.85; z-index:3000; pointer-events:none; transform:scale(1.02);`;
            document.body.appendChild(ghost);

            const placeholder = document.createElement('div');
            placeholder.style.cssText = `width:${rect.width}px; height:${rect.height}px; border:2px dashed var(--sys-primary); border-radius:14px; margin:4px 0;`;

            target.style.opacity = '0.2';
            target.parentNode.insertBefore(placeholder, target.nextSibling);

            drag = {
                item: target,
                ghost,
                placeholder,
                offsetX: point.clientX - rect.left,
                offsetY: point.clientY - rect.top
            };
        };

        const move = (point) => {
            if (!drag) return;
            drag.ghost.style.left = `${point.clientX - drag.offsetX}px`;
            drag.ghost.style.top = `${point.clientY - drag.offsetY}px`;

            const parent = drag.item.parentNode;
            const siblings = Array.from(parent.querySelectorAll(selector)).filter(el => el !== drag.item);
            if (siblings.length === 0) return;

            let closest = null;
            let closestDist = Number.POSITIVE_INFINITY;
            siblings.forEach((sib) => {
                const r = sib.getBoundingClientRect();
                const cx = r.left + (r.width / 2);
                const cy = r.top + (r.height / 2);
                const dist = Math.hypot(point.clientX - cx, point.clientY - cy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = sib;
                }
            });

            if (!closest) return;
            const cRect = closest.getBoundingClientRect();
            const insertAfter = point.clientY > cRect.top + (cRect.height / 2);
            parent.insertBefore(drag.placeholder, insertAfter ? closest.nextSibling : closest);
        };

        const end = () => {
            if (!drag) return;
            const { item, ghost, placeholder } = drag;
            if (placeholder.parentNode) placeholder.parentNode.insertBefore(item, placeholder);
            item.style.opacity = '1';
            placeholder.remove();
            ghost.remove();
            drag = null;
            if (navigator.vibrate) navigator.vibrate(20);
        };

        document.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            const target = e.target.closest(selector);
            if (!target || !target.draggable) return;
            start(e, target);
            e.preventDefault();
        });

        document.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') return;
            move(e);
        });

        document.addEventListener('pointerup', end);
        document.addEventListener('pointercancel', end);

        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest(selector);
            if (!target || !target.draggable) return;
            if (!e.touches || e.touches.length === 0) return;
            start(e.touches[0], target);
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            move(Object.assign({}, e.touches[0], { target: e.target }));
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', end, { passive: true });
        document.addEventListener('touchcancel', end, { passive: true });
    }

    // Accessibility
    function labelFromOnclick(onclickText) {
        if (!onclickText) return '';
        if (onclickText.includes('openSearchSort')) return 'Open sort options';
        if (onclickText.includes('openSidebar')) return 'Open sidebar';
        if (onclickText.includes('toggleOverlay')) return 'Open player';
        if (onclickText.includes('pop(')) return 'Back';
        if (onclickText.includes('startParty')) return 'Start party session';
        if (onclickText.includes('leaveParty')) return 'Leave party session';
        return '';
    }

    function inferAriaLabel(el) {
        const fromOnclick = labelFromOnclick(el.getAttribute('onclick'));
        if (fromOnclick) return fromOnclick;

        if (el.classList.contains('nav-item')) {
            const idx = Array.from(el.parentElement.children).indexOf(el);
            return ['Listen Now', 'Library'][idx] || 'Navigate';
        }

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return text || 'Activate control';
    }

    function updateStatusClock() {
        const clock = getEl('status-clock');
        if (!clock) return;
        clock.textContent = new Intl.DateTimeFormat([], {
            hour: 'numeric',
            minute: '2-digit'
        }).format(new Date());
    }

    function initStatusBarClock() {
        updateStatusClock();
        window.setInterval(updateStatusClock, 30000);
    }

    function syncSettingsToggles() {
        const settings = [
            { id: 'settings-dark-theme-toggle', value: darkThemeEnabled },
            { id: 'settings-hq-audio-toggle', value: hqAudioEnabled },
            { id: 'settings-gapless-toggle', value: gaplessEnabled }
        ];

        settings.forEach(({ id, value }) => {
            const toggle = getEl(id);
            if (!toggle) return;
            toggle.classList.toggle('active', Boolean(value));
            toggle.setAttribute('role', 'switch');
            toggle.setAttribute('aria-checked', String(Boolean(value)));
            if (!toggle.hasAttribute('tabindex')) toggle.setAttribute('tabindex', '0');
        });
    }

    function toggleSettingsPreference(setting) {
        const key = String(setting || '').trim();
        if (key === 'darkTheme') {
            darkThemeEnabled = !darkThemeEnabled;
            safeStorage.setItem(STORAGE_KEYS.darkTheme, darkThemeEnabled ? '1' : '0');
            syncSettingsToggles();
            toast(darkThemeEnabled ? 'Dark theme enabled' : 'Dark theme disabled');
            return;
        }
        if (key === 'hqAudio') {
            hqAudioEnabled = !hqAudioEnabled;
            safeStorage.setItem(STORAGE_KEYS.hqAudio, hqAudioEnabled ? '1' : '0');
            syncSettingsToggles();
            toast(hqAudioEnabled ? 'High quality audio enabled' : 'High quality audio disabled');
        }
    }

    function ensureAccessibility() {
        const targets = document.querySelectorAll('div[onclick], .item-clickable, .media-card, .video-card, .icon-btn, .nav-item, .p-btn, .filter-chip');
        targets.forEach(el => {
            const tag = el.tagName;
            if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
            if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', inferAriaLabel(el));

            if (el.dataset.kbBound !== '1') {
                el.dataset.kbBound = '1';
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        el.click();
                    }
                });
            }
        });
    }

    // Esc / Layer handling
    function closeTopLayer() {
        if (albumArtViewerOpen || getEl('image-viewer-scrim')?.classList.contains('show')) {
            closeAlbumArtViewer();
            return true;
        }
        if (getEl('action-sheet').classList.contains('show')) {
            closeSheet();
            return true;
        }
        if (getEl('tag-creator').classList.contains('show')) {
            closeTagCreator();
            return true;
        }
        if (getEl('create-playlist-scrim')?.classList.contains('show')) {
            closeCreatePlaylistDialog();
            return true;
        }
        if (getEl('sidebar').classList.contains('show')) {
            closeSidebar();
            return true;
        }
        // Close EQ panel if visible (before closing the player overlay)
        const eqPanel = getEl('eq-panel');
        if (eqPanel && eqPanel.style.display !== 'none' && eqPanel.style.display !== '') {
            closeEq();
            return true;
        }
        if (getEl('confirm-scrim')?.classList.contains('show')) {
            confirmCancel();
            return true;
        }
        if (getEl('player').classList.contains('active')) {
            toggleOverlay('player');
            return true;
        }
        if (isOnboardingVisible()) {
            dismissOnboarding();
            return true;
        }
        if (isSetupVisible()) {
            skipSetup();
            return true;
        }
        if (historyStack.length > 1) {
            pop();
            return true;
        }
        return false;
    }

    // Boot
    async function initOnboarding() {
        // Load persisted media folders from IndexedDB first
        await loadMediaFolders();

        const ob = getEl('onboarding');
        if (!ob) return;

        if (safeStorage.getItem(ONBOARDED_KEY) === '1') {
            ob.style.display = 'none';
            ob.classList.remove('active');
            // If onboarding done but setup not done, show setup
            if (safeStorage.getItem(SETUP_DONE_KEY) !== '1' && safeStorage.getItem(SETUP_DONE_KEY) !== 'skipped') {
                showFirstTimeSetup();
            } else {
                syncEmptyState();
                renderSettingsFolderList();
            }
        } else {
            ob.style.display = 'flex';
            setTimeout(() => ob.classList.add('active'), 40);
        }
    }

    let _searchDebounceTimer = null;
    let searchModeActive = false;

    function persistSearchUiState() {
        if (typeof setUiPreference !== 'function') return;
        setUiPreference('searchQuery', String(searchQuery || '').trim());
        const filters = searchFilters && typeof searchFilters.forEach === 'function'
            ? Array.from(searchFilters).filter(Boolean)
            : [];
        setUiPreference('searchFilters', filters.length ? filters : ['all']);
    }

    function enterSearchMode() {
        if (searchModeActive) return;
        searchModeActive = true;
        renderSearchState();
    }

    function exitSearchMode() {
        searchModeActive = false;
        const input = getEl('search-input');
        if (input) { input.value = ''; input.blur(); }
        searchQuery = '';
        if (typeof searchFilters !== 'undefined' && searchFilters && typeof searchFilters.clear === 'function') {
            searchFilters.clear();
            searchFilters.add('all');
        }
        persistSearchUiState();
        renderSearchState();
        window.exitSearchMode = exitSearchMode;
    }
    window.exitSearchMode = exitSearchMode;

    function initSearchBinding() {
        const input = getEl('search-input');
        if (!input) return;
        const clearBtn = getEl('search-clear-btn');

        const syncFilterChipsFromState = () => {
            if (typeof syncSearchFilterControls === 'function') {
                syncSearchFilterControls();
                return;
            }
            document.querySelectorAll('[data-filter]').forEach((chip) => {
                const filter = chip.dataset.filter;
                chip.classList.toggle('active', chip.classList.contains('filter-chip') && searchFilters.has(filter));
            });
        };

        const resetSearchFiltersToAll = () => {
            if (!searchFilters || typeof searchFilters.clear !== 'function') return;
            searchFilters.clear();
            searchFilters.add('all');
            syncFilterChipsFromState();
        };

        const queueSearchRender = (value) => {
            searchQuery = String(value || '').trim();
            if (!searchQuery) resetSearchFiltersToAll();
            persistSearchUiState();
            syncFilterChipsFromState();
            if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(() => {
                _searchDebounceTimer = null;
                renderSearchState();
            }, 150);
        };

        const restoredQuery = String(getUiPreference('searchQuery', '') || '').trim();
        const restoredFilters = getUiPreference('searchFilters', []);
        if (Array.isArray(restoredFilters) && restoredFilters.length) {
            searchFilters.clear();
            restoredFilters.forEach((filter) => searchFilters.add(filter));
            if (!searchFilters.size) searchFilters.add('all');
        }
        searchQuery = restoredQuery;
        input.value = restoredQuery;
        syncFilterChipsFromState();
        if (restoredQuery) {
            searchModeActive = true;
            renderSearchState();
        }

        input.addEventListener('focus', () => enterSearchMode());

        input.addEventListener('input', (e) => {
            queueSearchRender(e.target.value);
        });

        input.addEventListener('search', (e) => {
            queueSearchRender(e.target.value);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                rememberRecentSearch(input.value);
                persistSearchUiState();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                exitSearchMode();
            }
        });

        clearBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            input.value = '';
            clearBtn.hidden = true;
            queueSearchRender('');
            renderSearchState();
            input.focus();
        });

        if (!document.body.dataset.searchOutsideBound) {
            document.body.dataset.searchOutsideBound = '1';
            document.addEventListener('pointerdown', (event) => {
                if (!(typeof searchModeActive !== 'undefined' && searchModeActive)) return;
                if (activeId !== 'library') return;
                const target = event.target;
                if (!(target instanceof Element)) return;
                const keepSearchOpen = target.closest(
                '#library .top-bar, #library-edit-toggle-btn, #search-bar-container, #library-nav-container, #search-tag-row, #search-results, #search-workspace-root, #mini-player, .mini-player, .mini-card, #mini-progress-track, #action-sheet, #sheet-scrim, .tag-creator, .bottom-nav'
            );
                if (keepSearchOpen) return;
                exitSearchMode();
            });
        }
    }

    function initClearQueueBinding() {
        bindQueueInteractions();
        renderQueue();
    }

    function initLongPressSuppressor() {
        document.addEventListener('click', (e) => {
            if (shouldSuppressLongPressClick(e.target)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        ['mouseup', 'mouseleave', 'touchend', 'touchcancel', 'scroll'].forEach(ev => {
            document.addEventListener(ev, clearLongPress, { passive: true });
        });
    }

    function initSwipeGesture() {
        const emu = document.querySelector('.emulator');
        if (!emu) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let swiping = false;

        emu.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            const rect = emu.getBoundingClientRect();
            swiping = (touchStartX - rect.left) < 40;
        }, { passive: true });

        emu.addEventListener('touchmove', (e) => {
            if (!swiping) return;
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
            if (deltaX > 60 && deltaY < 80) {
                openSidebar();
                swiping = false;
            }
        }, { passive: true });

        const edgeEl = getEl('swipe-edge');
        if (!edgeEl) return;

        let edgeStartX = 0;
        edgeEl.addEventListener('mousedown', (e) => {
            edgeStartX = e.clientX;
            e.preventDefault();

            const onMove = (ev) => {
                if (ev.clientX - edgeStartX > 50) {
                    openSidebar();
                    cleanup();
                }
            };

            const cleanup = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', cleanup);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', cleanup);
        });

        edgeEl.addEventListener('touchstart', (e) => {
            edgeStartX = e.touches[0].clientX;
        }, { passive: true });

        edgeEl.addEventListener('touchmove', (e) => {
            if (e.touches[0].clientX - edgeStartX > 50) openSidebar();
        }, { passive: true });
    }

    function init() {
        // Spinner keyframes
        const st = document.createElement('style');
        st.innerHTML = '@keyframes spin { 100% { transform:rotate(360deg); } }';
        document.head.appendChild(st);

        clearDemoMarkup();
        hydrateLibraryData();
        initStatusBarClock();

        // Restore library cache and queue from previous session
        if (loadLibraryCache()) {
            renderHomeSections();
            renderLibraryViews();
        }
        restoreQueue();

        bindAudioEngine();
        renderLibraryViews();
        setNowPlaying(nowPlaying, false);
        updateProgressUI(0, nowPlaying?.durationSec || 0);
        scheduleNowPlayingMarquee(document);

        initOnboarding();
        initSearchBinding();
        initClearQueueBinding();
        initLongPressSuppressor();
        initFolderPickerBindings();

        bindDragAndDrop('#search-cat-grid .cat-card[draggable="true"]');
        bindDragAndDrop('#search-tag-row .filter-chip[draggable="true"]');
        bindTouchReorder('#search-cat-grid .cat-card[draggable="true"], #search-tag-row .filter-chip[draggable="true"]');

        ensureSortIndicators();
        renderSearchState();
        ensureAccessibility();

        syncSettingsToggles();
        const eqToggleBtn = getEl('eq-toggle-btn');
        if (eqToggleBtn) eqToggleBtn.classList.toggle('active', eqEnabled);

        document.addEventListener('keydown', (e) => {
            // Skip if user is typing in an input
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
                if (e.key === 'Escape') { closeTopLayer(); syncBottomNavVisibility(); }
                return;
            }
            if (e.key === 'Escape') {
                closeTopLayer();
                syncBottomNavVisibility();
                return;
            }
            // Space = toggle playback
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                togglePlayback(e);
                return;
            }
            // Arrow keys (no modifier)
            if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const engine = ensureAudioEngine();
                if (engine) { engine.currentTime = Math.min(engine.duration || 0, engine.currentTime + 10); }
                return;
            }
            if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const engine = ensureAudioEngine();
                if (engine) { engine.currentTime = Math.max(0, engine.currentTime - 10); }
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setVolume(currentVolume + 0.05);
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setVolume(currentVolume - 0.05);
                return;
            }
            // N = next, P = previous
            if (e.key === 'n' || e.key === 'N') { playNext(); return; }
            if (e.key === 'p' || e.key === 'P') { playPrevious(); return; }
            // S = toggle shuffle
            if (e.key === 's' || e.key === 'S') { toggleShuffle(); return; }
            // R = cycle repeat
            if (e.key === 'r' || e.key === 'R') { toggleRepeatMode(); return; }
            // M = mute
            if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
            // / = focus search
            if (e.key === '/') {
                e.preventDefault();
                const searchInput = getEl('search-input');
                if (searchInput) searchInput.focus();
                return;
            }
        });

        const joinInput = getEl('join-code-input');
        if (joinInput) {
            joinInput.addEventListener('input', () => {
                joinInput.value = joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                if (joinInput.value.length > 0) setJoinCodeError('');
            });
        }
/* <<< 06-setup-init-a11y.js */

/* >>> 07-zenith-config-profiles.js */
/*
 * Auralis JS shard: 07-zenith-config-profiles.js
 * Purpose: Zenith constants, icon/action-sheet helpers, home profile/subtext config
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

        syncBottomNavVisibility();
        initSwipeGesture();

        applyHomeTitleMode();
        bindHomeTitleEditor();
        renderHomeTitle();
        ensureLibraryHeaderBindings();
        renderHomeProfileNav();
        scheduleTitleMotion(document);
    }

    document.addEventListener('DOMContentLoaded', init);
// ═══════════════════════════════════════════════════════════════════
// § ZENITH OVERRIDES — Enhanced renderers, home sections, entity subtext
// Merged from zenith_overrides.js (originally a separate IIFE)
// Functions declared here override same-named functions from above
// ═══════════════════════════════════════════════════════════════════
    const SHEET_PAGE_SIZE = 3;
    const TYPE_STEP_SIZE = 4;
    const SECTION_TYPE_CHOICES = [
        { key: 'songs', label: 'Songs', description: 'Track-focused sections with dense scan modes.', icon: 'music' },
        { key: 'albums', label: 'Albums', description: 'Album-first discovery and return points.', icon: 'album' },
        { key: 'artists', label: 'Artists', description: 'Artist-driven shelves and quick access.', icon: 'artist' },
        { key: 'playlists', label: 'Playlists', description: 'Curated and dynamic playlist highlights.', icon: 'playlist' }
    ];
    const LAYOUT_LABELS = {
        list: 'Track Column',
        columns: 'Track Column',
        carousel: 'Carousel',
        grid: 'Poster Grid'
    };
    const HOME_SUBTEXT_KEY = STORAGE_KEYS.homeSubtext;
    const DEFAULT_SUBTEXT_PREFS = {
        showCount: true,
        showLayout: false,
        showDensity: false,
        showType: false
    };
    const HOME_TITLE_MODE_KEY = STORAGE_KEYS.homeTitleMode;
    const HOME_TITLE_MODES = ['wrap', 'marquee'];
    const DEFAULT_HOME_TITLE = 'Listen Now';
    const HOME_PROFILES_KEY = STORAGE_KEYS.homeProfiles;
    const HOME_ACTIVE_PROFILE_KEY = STORAGE_KEYS.homeActiveProfile;
    const ENTITY_SUBTEXT_KEY = STORAGE_KEYS.entitySubtext;
    const ENTITY_SUBTEXT_CONTEXTS = ['default', 'home', 'library', 'playlist_detail', 'artist_profile', 'liked', 'sidebar', 'search'];
    const ENTITY_SUBTEXT_CONTEXT_LABELS = {
        default: 'Default',
        home: 'Home',
        library: 'Library',
        playlist_detail: 'Playlist View',
        artist_profile: 'Artist View',
        liked: 'Liked Views',
        sidebar: 'Sidebar',
        search: 'Search'
    };
    const ENTITY_SUBTEXT_SEPARATOR_OPTIONS = [
        { key: 'dot', label: 'Dot', sample: '●' },
        { key: 'bullet', label: 'Bullet', sample: '•' },
        { key: 'middot', label: 'Middle Dot', sample: '·' },
        { key: 'slash', label: 'Slash', sample: '/' },
        { key: 'pipe', label: 'Pipe', sample: '|' },
        { key: 'dash', label: 'Dash', sample: '-' },
        { key: 'none', label: 'None', sample: '' }
    ];
    const ENTITY_SUBTEXT_FIELD_DEFS = {
        song: [
            { key: 'artist', label: 'Artist', description: 'Artist identity under the track title.' },
            { key: 'album', label: 'Album', description: 'Album context under the track title.' },
            { key: 'genre', label: 'Genre', description: 'Genre routing token for browse.' }
        ],
        album: [
            { key: 'artist', label: 'Artist', description: 'Album artist token.' },
            { key: 'year', label: 'Year', description: 'Release year metadata.' },
            { key: 'tracks', label: 'Track Count', description: 'Total tracks in album.' },
            { key: 'genre', label: 'Genre', description: 'Primary genre token.' }
        ],
        playlist: [
            { key: 'subtitle', label: 'Subtitle', description: 'Playlist subtitle / source text.' },
            { key: 'tracks', label: 'Track Count', description: 'Total playlist tracks.' }
        ],
        artist: [
            { key: 'albums', label: 'Album Count', description: 'Total albums for artist.' },
            { key: 'tracks', label: 'Track Count', description: 'Total tracks for artist.' }
        ]
    };
    const DEFAULT_ENTITY_SUBTEXT_PREFS = {
        song: {
            interactive: true,
            separator: 'dot',
            fields: {
                artist: true,
                album: true,
                genre: false
            }
        },
        album: {
            interactive: true,
            separator: 'dot',
            fields: {
                artist: true,
                year: false,
                tracks: false,
                genre: false
            }
        },
        playlist: {
            interactive: true,
            separator: 'dot',
            fields: {
                subtitle: true,
                tracks: true
            }
        },
        artist: {
            interactive: true,
            separator: 'dot',
            fields: {
                albums: true,
                tracks: true
            }
        }
    };
    let marqueeRaf = null;
    let homeSectionSubtextPrefs = {};
    let homeTitleMode = 'wrap';
    let homeProfiles = [];
    let activeHomeProfileId = '';
    let entitySubtextPrefs = {};

    const ICON_PATHS = Object.freeze({
        up: '<path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8z"/>',
        down: '<path d="M4 12l1.41-1.41L11 16.17V4h2v12.17l5.59-5.58L20 12l-8 8-8-8z"/>',
        columns: '<path d="M4 5h7v14H4V5zm9 0h7v14h-7V5z"/>',
        stack: '<path d="M5 6h14v3H5V6zm0 5h14v3H5v-3zm0 5h14v3H5v-3z"/>',
        carousel: '<path d="M4 6h3v12H4V6zm13 0h3v12h-3V6zM9 8h6v8H9V8z"/>',
        grid: '<path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>',
        density: '<path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h8v2H3v-2z"/>',
        spacing: '<path d="M4 5h16v2H4V5zm3 6h10v2H7v-2zm-3 6h16v2H4v-2zM2 9h2v6H2V9zm18 0h2v6h-2V9z"/>',
        number: '<path d="M7 7h2v10H7v-2H5v-2h2V9H5V7h2zm6 0h4a3 3 0 0 1 1.7 5.47L16 15h3v2h-7v-1.65l4.98-4.47A1 1 0 0 0 16.31 9H13V7z"/>',
        tune: '<path d="M4 7h9v2H4V7zm11-2h2v6h-2V9h-2V7h2V5zM4 15h3v2H4v-2zm5-2h2v6H9v-2H7v-2h2v-2zm5 2h6v2h-6v-2zM18 5h2v2h-2V5zm-5 12h2v2h-2v-2z"/>',
        manage: '<path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.49.49 0 0 0-.6-.22l-2.39.96c-.49-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.47-.4h-3.86c-.23 0-.43.17-.47.4l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.3-.06.61-.06.94s.02.64.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.23.24.4.47.4h3.86c.23 0 .43-.17.47-.4l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>',
        trash: '<path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
        undo: '<path d="M12 5c-3.86 0-7 3.14-7 7H2.5l3.25 3.25L9 12H6.5A5.5 5.5 0 1 1 12 17.5c-1.52 0-2.9-.62-3.9-1.62l-1.06 1.06A6.98 6.98 0 0 0 12 19a7 7 0 0 0 0-14z"/>',
        source: '<path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 8.7L5.04 9 12 5.3 18.96 9 12 11.7zM5 13.18 3.03 12.1 12 17l8.97-4.9L19 13.18 12 17l-7-3.82z"/>',
        filter: '<path d="M3 5h18v2H3V5zm4 6h10v2H7v-2zm3 6h4v2h-4v-2z"/>',
        library: '<path d="M4 4h4v16H4V4zm6 0h4v16h-4V4zm6 2 3.5-1 4 14-3.5 1-4-14z"/>',
        listMusic: '<path d="M4 6h10v2H4V6zm0 5h10v2H4v-2zm0 5h7v2H4v-2zm13-9v8.17A3 3 0 1 0 19 18V9h3V7h-5z"/>',
        folder: '<path d="M10 4 12 6h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2L2.01 6A2 2 0 0 1 4 4h6z"/>',
        tag: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a2 2 0 0 0-2 2v5.59A2 2 0 0 0 2.59 12l9.59 9.59a2 2 0 0 0 2.82 0l5.59-5.59a2 2 0 0 0 0-2.59zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z"/>',
        music: '<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>',
        album: '<path d="M12 3a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9zm0 13a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/>',
        artist: '<path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"/>',
        playlist: '<path d="M3 6h12v2H3V6zm0 4h12v2H3v-2zm0 4h8v2H3v-2zm14-8v10.17A3 3 0 1 0 19 19V8h3V6h-5z"/>',
        queue: '<path d="M4 10h12v2H4v-2zm0-4h16v2H4V6zm0 8h8v2H4v-2zm14 0V9h2v5h3l-4 4-4-4h3z"/>',
        next: '<path d="M6 6v12l8.5-6L6 6zm10 0h2v12h-2V6z"/>',
        open: '<path d="M14 3v2h3.59L10 12.59 11.41 14 19 6.41V10h2V3h-7zM5 5h6v2H7v10h10v-4h2v6H5V5z"/>',
        heart: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3 9.24 3 10.91 3.81 12 5.09 13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
        share: '<path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7A3.2 3.2 0 0 0 9 12c0-.24-.03-.47-.09-.7l7.02-4.11a2.99 2.99 0 1 0-.9-1.45L8 9.85A3 3 0 1 0 8 14.15l7.03 4.11a3 3 0 1 0 2.97-2.18z"/>',
        more: '<circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/>'
    });

    function getIconSvg(name) {
        const path = ICON_PATHS[name] || ICON_PATHS.more;
        return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
    }

    function presentActionSheet(title, sub, actions) {
        const rows = Array.from(document.querySelectorAll('#action-sheet .sheet-action'));
        rows.forEach((row, index) => {
            const action = Array.isArray(actions) ? actions[index] : null;
            if (!action) {
                row.style.display = 'none';
                row.onclick = null;
                return;
            }
            row.style.display = 'flex';
            row.dataset.tone = action.danger ? 'danger' : 'default';
            // Save and remove data-action so the global delegation handler doesn’t
            // double-fire alongside the specific onclick we’re about to set.
            if (!('savedAction' in row.dataset)) {
                row.dataset.savedAction = row.dataset.action || '';
            }
            row.removeAttribute('data-action');
            row.innerHTML = `
                <div class="sheet-action-inner">
                    <div class="sheet-action-icon">${getIconSvg(action.icon)}</div>
                    <div class="sheet-action-copy">
                        <div class="sheet-action-title">${action.label || 'Action'}</div>
                        <div class="sheet-action-desc">${action.description || ''}</div>
                    </div>
                    <div class="sheet-action-chevron">${action.keepOpen ? '>' : ''}</div>
                </div>
            `;
            row.onclick = () => {
                if (typeof action.onSelect === 'function') action.onSelect();
                if (!action.keepOpen) closeSheet();
            };
        });
        openSheet(title, sub);
    }

    function getAlbumPlayCount(album) {
        return (album?.tracks || []).reduce((sum, track) => sum + Number(track.plays || 0), 0);
    }

    function getAlbumLastPlayedDays(album) {
        const values = (album?.tracks || []).map(track => Number(track.lastPlayedDays || 999));
        return values.length ? Math.min(...values) : 999;
    }

    function getTrackLastPlayedTimestamp(track) {
        const value = Number(track?.lastPlayedAt || 0);
        return Number.isFinite(value) ? value : 0;
    }

    function getAlbumLastPlayedTimestamp(album) {
        const values = (album?.tracks || []).map(getTrackLastPlayedTimestamp).filter((value) => value > 0);
        return values.length ? Math.max(...values) : 0;
    }

    function getAlbumAddedScore(album) {
        const values = (album?.tracks || []).map(track => Number(track.addedRank || 0));
        return values.length ? Math.max(...values) : 0;
    }

    // Project live play counts and lastPlayed timestamps from Maps onto track objects
    function projectLiveStats(track) {
        const liveCount = getTrackMapValue(playCounts, track);
        if (liveCount !== undefined) track.plays = liveCount;
        const liveTs = getTrackMapValue(lastPlayed, track);
        if (liveTs) {
            track.lastPlayedAt = Number(liveTs) || 0;
            track.lastPlayedDays = Math.max(0, Math.floor((Date.now() - liveTs) / 86400000));
        }
    }

    function getSortedTracks(mode) {
        if (!Array.isArray(LIBRARY_TRACKS)) return [];
        const copy = LIBRARY_TRACKS.slice();
        copy.forEach(projectLiveStats);
        if (mode === 'most_played') copy.sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
        else if (mode === 'forgotten') copy.sort((a, b) => Number(b.lastPlayedDays || 0) - Number(a.lastPlayedDays || 0));
        else if (mode === 'recent') {
            copy.sort((a, b) => {
                const recentDelta = getTrackLastPlayedTimestamp(b) - getTrackLastPlayedTimestamp(a);
                if (recentDelta) return recentDelta;
                return Number(a.lastPlayedDays || 999) - Number(b.lastPlayedDays || 999);
            });
        }
        else if (mode === 'alpha') copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        else copy.sort((a, b) => Number(b.addedRank || 0) - Number(a.addedRank || 0));
        return copy;
    }

    function getSortedAlbums(mode) {
        const copy = LIBRARY_ALBUMS.slice();
        copy.forEach(album => (album.tracks || []).forEach(projectLiveStats));
        if (mode === 'most_played') copy.sort((a, b) => getAlbumPlayCount(b) - getAlbumPlayCount(a));
        else if (mode === 'forgotten') copy.sort((a, b) => getAlbumLastPlayedDays(b) - getAlbumLastPlayedDays(a));
        else if (mode === 'recent') {
            copy.sort((a, b) => {
                const recentDelta = getAlbumLastPlayedTimestamp(b) - getAlbumLastPlayedTimestamp(a);
                if (recentDelta) return recentDelta;
                return getAlbumLastPlayedDays(a) - getAlbumLastPlayedDays(b);
            });
        }
        else copy.sort((a, b) => getAlbumAddedScore(b) - getAlbumAddedScore(a));
        return copy;
    }

    function getSortedArtists(mode) {
        const copy = LIBRARY_ARTISTS.slice();
        if (mode === 'forgotten') copy.sort((a, b) => Number(b.lastPlayedDays || 0) - Number(a.lastPlayedDays || 0));
        else if (mode === 'recent') copy.sort((a, b) => Number(a.lastPlayedDays || 999) - Number(b.lastPlayedDays || 999));
        else copy.sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
        return copy;
    }

    function getSortedPlaylists(mode) {
        const copy = LIBRARY_PLAYLISTS.slice();
        if (mode === 'forgotten') copy.sort((a, b) => Number(b.lastPlayedDays || 0) - Number(a.lastPlayedDays || 0));
        else if (mode === 'recent') copy.sort((a, b) => Number(a.lastPlayedDays || 999) - Number(b.lastPlayedDays || 999));
        else copy.sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
        return copy;
    }

    function getInProgressAlbums() {
        return LIBRARY_ALBUMS.filter(album => {
            const prog = getAlbumProgress(album.title, getAlbumPrimaryArtistName(album, album.artist));
            if (!prog) return false;
            const totalTracks = (album.tracks || []).length;
            // In progress = not on the last track at the end, or position > 0 on any track
            return prog.trackIndex < totalTracks - 1 || (prog.position > 0 && prog.position < prog.total - 1);
        }).sort((a, b) => {
            const pa = getAlbumProgress(a.title, getAlbumPrimaryArtistName(a, a.artist));
            const pb = getAlbumProgress(b.title, getAlbumPrimaryArtistName(b, b.artist));
            return (pb?.timestamp || 0) - (pa?.timestamp || 0);
        });
    }

    function getJumpBackInAlbums() {
        // Albums with recorded progress (in-progress first) + recently played albums
        const inProgress = getInProgressAlbums();
        const inProgressKeys = new Set(inProgress.map(a => albumKey(a.title)));
        const recent = getSortedAlbums('recent').filter(a => !inProgressKeys.has(albumKey(a.title)));
        return [...inProgress, ...recent];
    }

    function getSectionItems(section) {
        if (!section || !section.type) return [];
        const limit = Math.max(1, Number(section.limit || 8));
        let items = [];
        switch (section.type) {
            case 'recent_activity':
                items = getSortedTracks('recent');
                break;
            case 'jump_back_in':
                items = getJumpBackInAlbums();
                break;
            case 'most_played_songs':
                items = getSortedTracks('most_played');
                break;
            case 'most_played_artists':
                items = getSortedArtists('most_played');
                break;
            case 'most_played_albums':
                items = getSortedAlbums('most_played');
                break;
            case 'forgotten_songs':
                items = getSortedTracks('forgotten');
                break;
            case 'forgotten_albums':
                items = getSortedAlbums('forgotten');
                break;
            case 'recently_added':
                items = getSortedAlbums('added');
                break;
            case 'playlist_spotlight':
                items = getSortedPlaylists('most_played');
                break;
            case 'never_played_songs':
                items = LIBRARY_TRACKS.filter((track) => !getTrackMapValue(playCounts, track));
                break;
            case 'never_played_albums':
                items = LIBRARY_ALBUMS.filter(album =>
                    (album.tracks || []).every((track) => !getTrackMapValue(playCounts, track))
                );
                break;
            case 'liked_songs':
                items = LIBRARY_TRACKS.filter((track) => hasTrackSetValue(likedTracks, track));
                break;
            case 'top_rated':
                items = LIBRARY_TRACKS.filter((track) => Number(getTrackMapValue(trackRatings, track) || 0) >= 4)
                    .sort((a, b) => (getTrackMapValue(trackRatings, b) || 0) - (getTrackMapValue(trackRatings, a) || 0));
                break;
            case 'shuffle_mix': {
                const pool = LIBRARY_TRACKS.slice();
                for (let i = pool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                items = pool;
                break;
            }
            case 'in_progress_albums':
                items = getInProgressAlbums();
                break;
            default:
                if (section.itemType === 'songs') items = getSortedTracks('most_played');
                else if (section.itemType === 'albums') items = getSortedAlbums('most_played');
                else if (section.itemType === 'artists') items = getSortedArtists('most_played');
                else items = getSortedPlaylists('most_played');
                break;
        }
        return items.slice(0, limit);
    }

    function sectionMatchesHomeFilter(section) {
        if (!section) return false;
        return true;
    }

    function saveHomeSubtextPrefs() {
        safeStorage.setJson(HOME_SUBTEXT_KEY, homeSectionSubtextPrefs);
    }

    function loadHomeSubtextPrefs() {
        homeSectionSubtextPrefs = {};
        try {
            const parsed = safeStorage.getJson(HOME_SUBTEXT_KEY, null);
            if (!parsed || typeof parsed !== 'object') return;
            Object.entries(parsed).forEach(([key, value]) => {
                if (!value || typeof value !== 'object') return;
                homeSectionSubtextPrefs[key] = {
                    showCount: value.showCount !== false,
                    showLayout: value.showLayout === true,
                    showDensity: value.showDensity === true,
                    showType: value.showType === true
                };
            });
        } catch (_) {
            // Ignore malformed local state
        }
    }

    function getSectionSubtextPrefs(section) {
        if (!section) return { ...DEFAULT_SUBTEXT_PREFS };
        const key = section.id || section.type || section.title;
        const saved = homeSectionSubtextPrefs[key];
        if (!saved) return { ...DEFAULT_SUBTEXT_PREFS };
        return {
            showCount: saved.showCount !== false,
            showLayout: saved.showLayout === true,
            showDensity: saved.showDensity === true,
            showType: saved.showType === true
        };
    }

    function updateSectionSubtextPrefs(sectionId, patch) {
        if (!sectionId) return;
        const section = homeSections.find((s) => s.id === sectionId);
        if (!section) return;
        const key = section.id || section.type || section.title;
        const current = getSectionSubtextPrefs(section);
        homeSectionSubtextPrefs[key] = { ...current, ...patch };
        saveHomeSubtextPrefs();
        renderHomeSections();
    }
/* <<< 07-zenith-config-profiles.js */

/* >>> 07b-zenith-config-entity.js */
/*
 * Auralis JS shard: 07b-zenith-config-entity.js
 * Purpose: entity subtext prefs, meta nodes, long-press, profile layout helpers
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function buildSectionSubtext(section, itemCount) {
        const prefs = getSectionSubtextPrefs(section);
        const parts = [];
        if (prefs.showCount) {
            const count = Number.isFinite(itemCount) ? itemCount : Math.max(1, Number(section.limit || 0));
            parts.push(`${Math.max(0, count)} items`);
        }
        if (prefs.showLayout) parts.push(formatLayoutLabel(section.layout));
        if (prefs.showDensity) parts.push(section.density || 'large');
        if (prefs.showType) parts.push(section.itemType || 'songs');
        if (!parts.length) return '';
        return parts.join(' - ');
    }

    function applyHomeTitleMode() {
        if (document?.body) document.body.dataset.titleMode = homeTitleMode;
    }

    function saveHomeTitleMode() {
        safeStorage.setItem(HOME_TITLE_MODE_KEY, homeTitleMode);
    }

    function loadHomeTitleMode() {
        const raw = String(safeStorage.getItem(HOME_TITLE_MODE_KEY) || '').trim().toLowerCase();
        homeTitleMode = HOME_TITLE_MODES.includes(raw) ? raw : 'wrap';
        applyHomeTitleMode();
    }

    function setHomeTitleMode(mode) {
        if (!HOME_TITLE_MODES.includes(mode) || mode === homeTitleMode) return;
        homeTitleMode = mode;
        saveHomeTitleMode();
        applyHomeTitleMode();
        renderLibraryViews();
    }

    function saveEntitySubtextPrefs() {
        safeStorage.setJson(ENTITY_SUBTEXT_KEY, entitySubtextPrefs);
    }

    function getEntityFieldDefs(kind) {
        return Array.isArray(ENTITY_SUBTEXT_FIELD_DEFS[kind]) ? ENTITY_SUBTEXT_FIELD_DEFS[kind] : [];
    }

    function getEntityKindLabel(kind) {
        if (kind === 'song') return 'Song';
        if (kind === 'album') return 'Album';
        if (kind === 'playlist') return 'Playlist';
        if (kind === 'artist') return 'Artist';
        return 'Media';
    }

    function toEntityContext(context = 'library') {
        const key = String(context || 'library').trim().toLowerCase();
        return ENTITY_SUBTEXT_CONTEXTS.includes(key) ? key : 'library';
    }

    function getEntityContextLabel(context = 'library') {
        const key = toEntityContext(context);
        return ENTITY_SUBTEXT_CONTEXT_LABELS[key] || key;
    }

    function normalizeEntitySeparator(value, fallback = 'dot') {
        const key = String(value || '').trim().toLowerCase();
        if (ENTITY_SUBTEXT_SEPARATOR_OPTIONS.some((opt) => opt.key === key)) return key;
        return String(fallback || 'dot').trim().toLowerCase();
    }

    function getEntitySeparatorOption(separator = 'dot') {
        const key = normalizeEntitySeparator(separator, 'dot');
        return ENTITY_SUBTEXT_SEPARATOR_OPTIONS.find((opt) => opt.key === key) || ENTITY_SUBTEXT_SEPARATOR_OPTIONS[0];
    }

    function createDefaultEntitySubtextState() {
        const state = {};
        Object.entries(DEFAULT_ENTITY_SUBTEXT_PREFS).forEach(([kind, profile]) => {
            state[kind] = {};
            ENTITY_SUBTEXT_CONTEXTS.forEach((context) => {
                state[kind][context] = {
                    interactive: profile.interactive !== false,
                    separator: normalizeEntitySeparator(profile.separator, 'dot'),
                    fields: { ...(profile.fields || {}) }
                };
            });
        });
        return state;
    }

    function normalizeEntitySubtextProfile(kind, profile, fallbackProfile = null) {
        const defs = getEntityFieldDefs(kind);
        const fallback = fallbackProfile && typeof fallbackProfile === 'object'
            ? fallbackProfile
            : DEFAULT_ENTITY_SUBTEXT_PREFS[kind] || { interactive: true, separator: 'dot', fields: {} };
        const fallbackFields = fallback.fields && typeof fallback.fields === 'object' ? fallback.fields : {};
        const source = profile && typeof profile === 'object' ? profile : {};
        const sourceFields = source.fields && typeof source.fields === 'object' ? source.fields : source;
        const fields = {};
        defs.forEach((field) => {
            if (typeof sourceFields[field.key] === 'boolean') fields[field.key] = sourceFields[field.key];
            else fields[field.key] = fallbackFields[field.key] === true;
        });
        return {
            interactive: typeof source.interactive === 'boolean'
                ? source.interactive
                : (typeof source.clickable === 'boolean' ? source.clickable : fallback.interactive !== false),
            separator: normalizeEntitySeparator(source.separator, fallback.separator || 'dot'),
            fields
        };
    }

    function loadEntitySubtextPrefs() {
        entitySubtextPrefs = createDefaultEntitySubtextState();
        try {
            const parsed = safeStorage.getJson(ENTITY_SUBTEXT_KEY, null);
            if (!parsed || typeof parsed !== 'object') return;

            Object.keys(DEFAULT_ENTITY_SUBTEXT_PREFS).forEach((kind) => {
                const kindRaw = parsed[kind];
                if (!kindRaw || typeof kindRaw !== 'object') return;

                const contextLooksPresent = ENTITY_SUBTEXT_CONTEXTS.some((ctx) => kindRaw[ctx] && typeof kindRaw[ctx] === 'object');
                if (!contextLooksPresent) {
                    const normalized = normalizeEntitySubtextProfile(kind, kindRaw, entitySubtextPrefs[kind].default);
                    ENTITY_SUBTEXT_CONTEXTS.forEach((ctx) => {
                        entitySubtextPrefs[kind][ctx] = normalizeEntitySubtextProfile(kind, normalized, entitySubtextPrefs[kind][ctx]);
                    });
                    return;
                }

                ENTITY_SUBTEXT_CONTEXTS.forEach((ctx) => {
                    if (!kindRaw[ctx] || typeof kindRaw[ctx] !== 'object') return;
                    entitySubtextPrefs[kind][ctx] = normalizeEntitySubtextProfile(kind, kindRaw[ctx], entitySubtextPrefs[kind][ctx]);
                });
            });
        } catch (_) {
            // Ignore malformed persisted preferences
        }
    }

    function getEntitySubtextPrefs(kind, context = 'library') {
        if (!DEFAULT_ENTITY_SUBTEXT_PREFS[kind]) return { interactive: true, separator: 'dot', fields: {} };
        const ctx = toEntityContext(context);
        const kindPrefs = entitySubtextPrefs[kind] || {};
        const fallback = normalizeEntitySubtextProfile(kind, DEFAULT_ENTITY_SUBTEXT_PREFS[kind], DEFAULT_ENTITY_SUBTEXT_PREFS[kind]);
        const profile = kindPrefs[ctx] || kindPrefs.default || fallback;
        return normalizeEntitySubtextProfile(kind, profile, fallback);
    }

    function updateEntitySubtextPrefs(kind, context, patch) {
        if (!DEFAULT_ENTITY_SUBTEXT_PREFS[kind]) return;
        const ctx = toEntityContext(context);
        if (!entitySubtextPrefs[kind]) entitySubtextPrefs[kind] = {};
        const current = getEntitySubtextPrefs(kind, ctx);
        const next = normalizeEntitySubtextProfile(kind, {
            ...current,
            ...(patch || {}),
            fields: {
                ...(current.fields || {}),
                ...(((patch || {}).fields) || {})
            }
        }, current);
        entitySubtextPrefs[kind][ctx] = next;
        saveEntitySubtextPrefs();
        renderLibraryViews();
    }

    function resolveTrackGenre(track) {
        const fromTrack = String(track?.genre || '').trim();
        if (fromTrack) return fromTrack;
        const fromAlbum = String(track?.albumGenre || '').trim();
        if (fromAlbum) return fromAlbum;
        return '';
    }

    function resolveAlbumGenre(album) {
        const direct = String(album?.genre || '').trim();
        if (direct) return direct;
        const counts = new Map();
        (Array.isArray(album?.tracks) ? album.tracks : []).forEach((track) => {
            const genre = resolveTrackGenre(track);
            if (!genre) return;
            counts.set(genre, (counts.get(genre) || 0) + 1);
        });
        if (!counts.size) return '';
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }

    function getGenreBuckets() {
        const bucketMap = new Map();
        LIBRARY_TRACKS.forEach((track) => {
            const genre = resolveTrackGenre(track) || 'Unknown';
            if (!bucketMap.has(genre)) {
                bucketMap.set(genre, { name: genre, tracks: [] });
            }
            bucketMap.get(genre).tracks.push(track);
        });
        return Array.from(bucketMap.values())
            .map((bucket) => ({
                ...bucket,
                trackCount: bucket.tracks.length,
                topTrack: bucket.tracks.slice().sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0))[0] || null
            }))
            .sort((a, b) => Number(b.trackCount || 0) - Number(a.trackCount || 0));
    }

    function findTabNavButton(tabId) {
        return document.querySelector(`#tabs .nav-item[data-tab="${tabId}"]`) || null;
    }

    function routeToSearchQuery(query, filters = ['all']) {
        const targetFilters = Array.isArray(filters) && filters.length ? filters : ['all'];
        switchTab('library', findTabNavButton('library'));
        const canUseSearchFilters = typeof searchFilters !== 'undefined' && searchFilters && typeof searchFilters.clear === 'function';
        if (canUseSearchFilters) {
            searchFilters.clear();
            targetFilters.forEach((f) => searchFilters.add(f));
            if (!searchFilters.size) searchFilters.add('all');
        }
        if (typeof syncSearchFilterControls === 'function') {
            syncSearchFilterControls();
        } else {
            const filterRow = getEl('search-filter-row');
            if (filterRow) {
            filterRow.querySelectorAll('.filter-chip').forEach((chip) => {
                const f = chip.dataset.filter;
                chip.classList.toggle('active', canUseSearchFilters ? searchFilters.has(f) : f === 'all');
            });
            }
        }
        const input = getEl('search-input');
        if (input) {
            input.value = query || '';
            searchQuery = String(query || '').trim();
            rememberRecentSearch(searchQuery);
            persistSearchUiState();
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            rememberRecentSearch(query);
            persistSearchUiState();
            renderSearchState();
        }
    }

    function routeToArtist(name) {
        if (!name) return;
        routeToArtistProfile(name);
    }

    function routeToAlbum(title, artist, sourceAlbumId = '') {
        if (!title) return;
        routeToAlbumDetail(title, artist, sourceAlbumId);
    }

    function routeToPlaylist(id) {
        if (!id) return;
        routeToPlaylistDetail(id);
    }

    function routeToGenre(genre) {
        const value = String(genre || '').trim();
        if (!value) {
            toast('No genre metadata found');
            return;
        }
        routeToGenreBrowse(value);
    }

    function getMetaSeparatorText(separator = 'dot') {
        const key = normalizeEntitySeparator(separator, 'dot');
        if (key === 'bullet') return '•';
        if (key === 'middot') return '·';
        if (key === 'slash') return '/';
        if (key === 'pipe') return '|';
        if (key === 'dash') return '-';
        return '';
    }

    function createMetaNode({ label, onClick, onLongPress, interactive = true, className = '', title = '' }) {
        if (!label) return null;
        const canInteract = interactive !== false;
        if (!canInteract || typeof onClick !== 'function') {
            const text = document.createElement('span');
            if (className) text.className = className;
            text.textContent = label;
            if (title) text.title = title;
            return text;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `zenith-meta-link ${className}`.trim();
        btn.textContent = label;
        if (title) btn.title = title;
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        });
        if (canInteract && typeof onLongPress === 'function') {
            bindLongPressAction(btn, () => onLongPress(), 520);
        }
        return btn;
    }

    function createMetaLine(parts, config = {}) {
        const valid = Array.isArray(parts) ? parts.filter((part) => part && part.label) : [];
        if (!valid.length) return null;
        const separator = normalizeEntitySeparator(config.separator, 'dot');
        const interactive = config.interactive !== false;
        const line = document.createElement('div');
        line.className = 'zenith-meta zenith-meta-row';
        valid.forEach((part, idx) => {
            if (idx > 0 && separator !== 'none') {
                const sep = document.createElement('span');
                sep.className = 'zenith-meta-sep';
                if (separator === 'dot') sep.classList.add('is-dot');
                else sep.textContent = getMetaSeparatorText(separator);
                line.appendChild(sep);
            }
            const node = createMetaNode({ ...part, interactive });
            if (node) line.appendChild(node);
        });
        return line;
    }

    function createInlineMetaLink(label, className, onClick, onLongPress) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `zenith-inline-link ${className || ''}`.trim();
        btn.textContent = label || '';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof onClick === 'function') onClick();
        });
        if (typeof onLongPress === 'function') bindLongPressAction(btn, onLongPress, 520);
        return btn;
    }

    function bindLongPress(el, title, sub) {
        if (!el) return;
        el.addEventListener('mousedown', (e) => startLongPress(e, title, sub));
        el.addEventListener('mouseup', clearLongPress);
        el.addEventListener('mouseleave', clearLongPress);
        el.addEventListener('touchstart', (e) => startLongPress(e, title, sub), { passive: true });
        el.addEventListener('touchend', clearLongPress, { passive: true });
    }

    function bindLongPressAction(el, onLongPress, delayMs = 560) {
        if (!el || typeof onLongPress !== 'function') return;
        const cleanupExisting = longPressBindingCleanup.get(el);
        if (typeof cleanupExisting === 'function') cleanupExisting();

        let timer = null;
        let fired = false;

        const clear = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        const start = (event) => {
            if (event && event.type === 'mousedown' && event.button !== 0) return;
            fired = false;
            clear();
            timer = setTimeout(() => {
                timer = null;
                fired = true;
                markLongPressSuppressed(el);
                if (navigator.vibrate) navigator.vibrate(35);
                onLongPress();
            }, delayMs);
        };

        const blockPostLongPressClick = (event) => {
            if (!fired) return;
            event.preventDefault();
            event.stopPropagation();
            fired = false;
        };

        const openContextMenu = (event) => {
            event.preventDefault();
            onLongPress();
        };

        const handleKeyboard = (event) => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                event.preventDefault();
                onLongPress();
            }
        };

        el.addEventListener('mousedown', start);
        el.addEventListener('touchstart', start, { passive: true });
        el.addEventListener('mouseup', clear);
        el.addEventListener('mouseleave', clear);
        el.addEventListener('touchend', clear, { passive: true });
        el.addEventListener('touchcancel', clear, { passive: true });
        el.addEventListener('click', blockPostLongPressClick, true);
        el.addEventListener('contextmenu', openContextMenu);
        el.addEventListener('keydown', handleKeyboard);

        longPressBindingCleanup.set(el, () => {
            clear();
            el.removeEventListener('mousedown', start);
            el.removeEventListener('touchstart', start, { passive: true });
            el.removeEventListener('mouseup', clear);
            el.removeEventListener('mouseleave', clear);
            el.removeEventListener('touchend', clear, { passive: true });
            el.removeEventListener('touchcancel', clear, { passive: true });
            el.removeEventListener('click', blockPostLongPressClick, true);
            el.removeEventListener('contextmenu', openContextMenu);
            el.removeEventListener('keydown', handleKeyboard);
        });
    }

    function formatLayoutLabel(layout) {
        return LAYOUT_LABELS[layout] || 'Track Column';
    }

    function ensureSongLayoutForDensity(layout, density) {
        if (layout === 'columns') return 'list';
        if (density !== 'compact') return layout;
        return layout === 'grid' ? 'list' : layout;
    }

    function createHomeProfileId() {
        if (typeof toSafeId === 'function') return toSafeId('home');
        return `home-${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeSectionForProfile(section, index = 0) {
        const next = { ...(section || {}) };
        next.id = next.id || (typeof toSafeId === 'function' ? toSafeId(next.type || 'section') : `section-${index + 1}`);
        next.type = next.type || 'recent_activity';
        next.title = next.title || 'Section';
        next.itemType = next.itemType || 'songs';
        next.density = next.density || 'compact';
        next.layout = ensureSongLayoutForDensity(next.layout || 'list', next.density);
        next.limit = Math.max(1, Number(next.limit || 8));
        next.enabled = next.enabled !== false;
        next.core = Boolean(next.core);
        return next;
    }

    function cloneSectionsForProfile(sections) {
        const input = Array.isArray(sections) ? sections : [];
        return input.map((section, index) => normalizeSectionForProfile(section, index));
    }

    function normalizeHomeProfile(profile, index = 0) {
        const nameRaw = String(profile?.name || '').trim();
        const name = nameRaw || `Home ${index + 1}`;
        const titleRaw = String(profile?.title || '').trim();
        const sections = cloneSectionsForProfile(profile?.sections);
        return {
            id: String(profile?.id || createHomeProfileId()),
            name,
            title: titleRaw || DEFAULT_HOME_TITLE,
            sections: sections.length ? sections : cloneSectionsForProfile(getDefaultHomeSections())
        };
    }
/* <<< 07b-zenith-config-entity.js */

/* >>> 07c-zenith-config-profiles.js */
/*
 * Auralis JS shard: 07c-zenith-config-profiles.js
 * Purpose: home profile CRUD, title editor, scroll/motion helpers
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function getActiveHomeProfile() {
        return homeProfiles.find((profile) => profile.id === activeHomeProfileId) || null;
    }

    function saveHomeProfiles() {
        const safeProfiles = homeProfiles.map((profile, index) => normalizeHomeProfile(profile, index));
        homeProfiles = safeProfiles;
        safeStorage.setJson(HOME_PROFILES_KEY, safeProfiles);
        safeStorage.setItem(HOME_ACTIVE_PROFILE_KEY, String(activeHomeProfileId || (safeProfiles[0]?.id || '')));
        setUiPreference('homeProfile', String(activeHomeProfileId || (safeProfiles[0]?.id || '')));
    }

    function saveCurrentHomeProfileLayout() {
        const profile = getActiveHomeProfile();
        if (profile) {
            profile.sections = cloneSectionsForProfile(homeSections);
            profile.title = getActiveHomeTitle();
        }
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
    }

    function getActiveHomeTitle() {
        const profile = getActiveHomeProfile();
        return String(profile?.title || DEFAULT_HOME_TITLE).trim() || DEFAULT_HOME_TITLE;
    }

    function setActiveHomeTitle(value) {
        const profile = getActiveHomeProfile();
        if (!profile) return DEFAULT_HOME_TITLE;
        const next = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 42) || DEFAULT_HOME_TITLE;
        profile.title = next;
        saveHomeProfiles();
        renderHomeTitle();
        return next;
    }

    function syncHomeTitleEditability() {
        const title = getEl('home-title');
        if (!title) return;
        const editable = Boolean(inEditMode);
        title.contentEditable = editable ? 'plaintext-only' : 'false';
        title.setAttribute('aria-readonly', String(!editable));
        title.setAttribute('aria-label', editable ? 'Edit Home title' : 'Home title');
        title.tabIndex = editable ? 0 : -1;
    }

    function renderHomeTitle() {
        const title = getEl('home-title');
        if (!title) return;
        if (document.activeElement !== title) title.textContent = getActiveHomeTitle();
        syncHomeTitleEditability();
    }

    function commitHomeTitleEdit() {
        const title = getEl('home-title');
        if (!title) return;
        const before = getActiveHomeTitle();
        const after = setActiveHomeTitle(title.textContent);
        title.textContent = after;
        if (after !== before) toast('Home title updated');
    }

    function bindHomeTitleEditor() {
        const title = getEl('home-title');
        if (!title || title.dataset.homeTitleBound === '1') return;
        title.dataset.homeTitleBound = '1';
        title.addEventListener('blur', () => {
            if (inEditMode) commitHomeTitleEdit();
        });
        title.addEventListener('keydown', (event) => {
            if (!inEditMode) return;
            if (event.key === 'Enter') {
                event.preventDefault();
                commitHomeTitleEdit();
                title.blur();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                title.textContent = getActiveHomeTitle();
                title.blur();
            }
        });
        title.addEventListener('paste', (event) => {
            if (!inEditMode) return;
            event.preventDefault();
            const text = (event.clipboardData || window.clipboardData)?.getData('text/plain') || '';
            document.execCommand('insertText', false, text.replace(/\s+/g, ' '));
        });
        syncHomeTitleEditability();
    }

    function switchHomeProfile(profileId) {
        const profile = homeProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        saveCurrentHomeProfileLayout();
        activeHomeProfileId = profile.id;
        homeSections = cloneSectionsForProfile(profile.sections);
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
        renderHomeProfileNav();
        renderHomeTitle();
        renderHomeSections();
    }

    async function promptForHomeName(seed = '') {
        const initial = String(seed || '').trim() || `Home ${homeProfiles.length + 1}`;
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:99999; opacity:0; transition:all 0.2s ease;';
            
            const modal = document.createElement('div');
            modal.style.cssText = 'background:var(--navbar-bg, #121212); border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:24px; width:85%; max-width:320px; box-shadow:0 20px 40px rgba(0,0,0,0.6); transform:scale(0.95); transition:all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28); display:flex; flex-direction:column; gap:20px;';
            
            const title = document.createElement('div');
            title.innerText = 'Name this Home';
            title.style.cssText = 'font-size:1.15rem; font-weight:700; text-align:center; color:white; letter-spacing:-0.5px;';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = initial;
            input.autocomplete = 'off';
            input.style.cssText = 'width:100%; box-sizing:border-box; padding:14px 18px; border-radius:14px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:white; font-size:1rem; outline:none; transition:all 0.3s; font-family:inherit;';
            input.onfocus = () => { input.style.border = '1px solid rgba(255, 65, 108, 0.6)'; input.style.background = 'rgba(255,255,255,0.08)'; };
            input.onblur = () => { input.style.border = '1px solid rgba(255,255,255,0.12)'; input.style.background = 'rgba(255,255,255,0.04)'; };
            
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex; gap:12px; margin-top:4px;';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Cancel';
            cancelBtn.style.cssText = 'flex:1; padding:14px; border-radius:14px; background:rgba(255,255,255,0.06); border:none; color:#a0a0a0; font-weight:600; font-size:0.95rem; cursor:pointer; transition:background 0.2s;';
            cancelBtn.onmouseover = () => cancelBtn.style.background = 'rgba(255,255,255,0.1)';
            cancelBtn.onmouseout = () => cancelBtn.style.background = 'rgba(255,255,255,0.06)';
            
            const saveBtn = document.createElement('button');
            saveBtn.innerText = 'Done';
            saveBtn.style.cssText = 'flex:1; padding:14px; border-radius:14px; background:linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%); border:none; color:white; font-weight:600; font-size:0.95rem; cursor:pointer; box-shadow:0 4px 15px rgba(255, 65, 108, 0.3); transition:all 0.2s;';
            saveBtn.onmouseover = () => saveBtn.style.transform = 'translateY(-1px)';
            saveBtn.onmouseout = () => saveBtn.style.transform = 'translateY(0)';
            
            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(saveBtn);
            modal.appendChild(title);
            modal.appendChild(input);
            modal.appendChild(btnRow);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
                input.focus();
                input.select();
            });
            
            const cleanup = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.95)';
                setTimeout(() => overlay.remove(), 250);
            };
            
            cancelBtn.onclick = () => {
                cleanup();
                resolve('');
            };
            
            saveBtn.onclick = () => {
                const entered = String(input.value || '').trim().slice(0, 32);
                if (!entered) {
                    input.style.border = '1px solid rgba(255, 65, 108, 0.9)';
                    input.focus();
                    return;
                }
                cleanup();
                resolve(entered);
            };
            
            input.onkeydown = (e) => {
                if (e.key === 'Enter') saveBtn.click();
                if (e.key === 'Escape') cancelBtn.click();
            };
        });
    }

    async function openCreateHomeProfile() {
        const name = await promptForHomeName('');
        if (!name) return;
        const sections = []; // Start fully empty
        const profile = normalizeHomeProfile({ id: createHomeProfileId(), name, sections }, homeProfiles.length);
        homeProfiles.push(profile);
        activeHomeProfileId = profile.id;
        homeSections = cloneSectionsForProfile(profile.sections);
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
        renderHomeProfileNav();
        renderHomeTitle();
        renderHomeSections();
        toast(`Home "${name}" created`);
    }

    async function renameHomeProfile(profileId) {
        const profile = homeProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        const nextName = await promptForHomeName(profile.name);
        if (!nextName) return;
        profile.name = nextName;
        saveHomeProfiles();
        renderHomeProfileNav();
        toast(`Renamed to "${nextName}"`);
    }

    async function duplicateHomeProfile(profileId) {
        const profile = homeProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        const baseName = `${profile.name} Copy`;
        const name = await promptForHomeName(baseName);
        if (!name) return;
        const clone = normalizeHomeProfile({
            id: createHomeProfileId(),
            name,
            sections: cloneSectionsForProfile(profile.sections)
        }, homeProfiles.length);
        homeProfiles.push(clone);
        activeHomeProfileId = clone.id;
        homeSections = cloneSectionsForProfile(clone.sections);
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
        renderHomeProfileNav();
        renderHomeTitle();
        renderHomeSections();
        toast(`Created "${name}"`);
    }

    function deleteHomeProfile(profileId) {
        if (homeProfiles.length <= 1) {
            toast('At least one Home is required');
            return;
        }
        const idx = homeProfiles.findIndex((item) => item.id === profileId);
        if (idx < 0) return;
        const removed = homeProfiles[idx];
        homeProfiles.splice(idx, 1);
        if (activeHomeProfileId === profileId) {
            const fallback = homeProfiles[Math.max(0, idx - 1)] || homeProfiles[0];
            activeHomeProfileId = fallback?.id || '';
            homeSections = cloneSectionsForProfile(fallback?.sections || getDefaultHomeSections());
        }
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
        renderHomeProfileNav();
        renderHomeTitle();
        renderHomeSections();
        toast(`Removed "${removed.name}"`);
    }

    function openHomeProfileMenu(profileId) {
        const profile = homeProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        presentActionSheet(profile.name, 'Home navigation options', [
            {
                label: 'Rename Home',
                description: 'Set a custom name for this Home.',
                icon: 'manage',
                onSelect: () => renameHomeProfile(profile.id)
            },
            {
                label: 'Duplicate Home',
                description: 'Clone this Home with current sections and layout.',
                icon: 'stack',
                onSelect: () => duplicateHomeProfile(profile.id)
            },
            {
                label: 'Delete Home',
                description: 'Remove this Home profile from navigation.',
                icon: 'trash',
                danger: true,
                onSelect: () => deleteHomeProfile(profile.id)
            }
        ]);
    }

    function renderHomeProfileNav() {
        const nav = getEl('home-profile-nav');
        if (!nav) return;
        nav.innerHTML = '';
        homeProfiles.forEach((profile) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'home-profile-nav-item';
            if (profile.id === activeHomeProfileId) chip.classList.add('active');
            chip.textContent = profile.name;
            chip.addEventListener('click', () => switchHomeProfile(profile.id));
            bindLongPressAction(chip, () => openHomeProfileMenu(profile.id));
            nav.appendChild(chip);
        });
    }

    function loadHomeProfiles() {
        let parsedProfiles = [];
        try {
            const parsed = safeStorage.getJson(HOME_PROFILES_KEY, null);
            if (Array.isArray(parsed)) parsedProfiles = parsed;
        } catch (_) {
            parsedProfiles = [];
        }

        if (!parsedProfiles.length) {
            parsedProfiles = [{
                id: createHomeProfileId(),
                name: 'Home',
                sections: cloneSectionsForProfile(homeSections)
            }];
        }

        homeProfiles = parsedProfiles.map((profile, index) => normalizeHomeProfile(profile, index));
        const savedActive = String(getUiPreference('homeProfile', '') || safeStorage.getItem(HOME_ACTIVE_PROFILE_KEY) || '').trim();
        activeHomeProfileId = homeProfiles.some((item) => item.id === savedActive) ? savedActive : homeProfiles[0].id;
        const activeProfile = getActiveHomeProfile();
        homeSections = cloneSectionsForProfile(activeProfile?.sections || getDefaultHomeSections());
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
    }

    function createTitleRail(text, className = '') {
        const rail = document.createElement('div');
        rail.className = `zenith-title-rail ${className}`.trim();
        rail.dataset.mode = homeTitleMode;
        const track = document.createElement('span');
        track.className = 'zenith-title-track';
        track.textContent = text || '';
        rail.appendChild(track);
        return rail;
    }

    function updateTitleMotion(scope = document) {
        const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
        root.querySelectorAll('.zenith-title-rail').forEach((rail) => {
            const track = rail.querySelector('.zenith-title-track');
            if (!track) return;
            const forcedMarquee = rail.classList.contains('force-marquee');
            const marqueeMode = forcedMarquee || homeTitleMode === 'marquee';
            rail.dataset.mode = marqueeMode ? 'marquee' : homeTitleMode;
            if (!marqueeMode) {
                rail.dataset.overflow = '0';
                rail.style.removeProperty('--marquee-shift');
                return;
            }
            const overflow = track.scrollWidth - rail.clientWidth;
            if (overflow > 8) {
                rail.dataset.overflow = '1';
                rail.style.setProperty('--marquee-shift', `${Math.ceil(overflow) + 20}px`);
            } else {
                rail.dataset.overflow = '0';
                rail.style.removeProperty('--marquee-shift');
            }
        });
    }

    function updateScrollerMainCards(scope = document) {
        const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
        const scrollers = root.classList?.contains('horizon-scroller')
            ? [root]
            : Array.from(root.querySelectorAll('.horizon-scroller'));
        scrollers.forEach((scroller) => {
            const cards = Array.from(scroller.querySelectorAll('.zenith-media-card, .zenith-song-rail-item, .song-preview-card, .media-card'));
            cards.forEach((card) => card.classList.remove('is-main'));
            if (!cards.length) return;
            const scrollerCenter = scroller.scrollLeft + (scroller.clientWidth / 2);
            let bestCard = cards[0];
            let bestDistance = Number.POSITIVE_INFINITY;
            cards.forEach((card) => {
                const cardCenter = card.offsetLeft + (card.offsetWidth / 2);
                const distance = Math.abs(cardCenter - scrollerCenter);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestCard = card;
                }
            });
            bestCard.classList.add('is-main');
        });
    }

    function bindScrollerMainTracking(scope = document) {
        const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
        root.querySelectorAll('.horizon-scroller').forEach((scroller) => {
            if (scroller.dataset.mainTrackBound === '1') return;
            scroller.dataset.mainTrackBound = '1';
            let raf = null;
            const refresh = () => {
                if (raf) cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => {
                    raf = null;
                    updateScrollerMainCards(scroller);
                });
            };
            scroller.addEventListener('scroll', refresh, { passive: true });
            refresh();
        });
    }

    function scheduleTitleMotion(scope = document) {
        if (marqueeRaf) cancelAnimationFrame(marqueeRaf);
        marqueeRaf = requestAnimationFrame(() => {
            marqueeRaf = null;
            updateTitleMotion(scope);
            bindScrollerMainTracking(scope);
            updateScrollerMainCards(scope);
        });
/* <<< 07c-zenith-config-profiles.js */

/* >>> 08-zenith-components.js */
/*
 * Auralis JS shard: 08-zenith-components.js
 * Purpose: Zenith row/card factories and entity metadata render helpers
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    }

    function createPlayButton(onClick, label = 'Play') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zenith-play-btn';
        btn.setAttribute('aria-label', label);
        btn.innerHTML = getPlaybackIconSvg(false);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onClick === 'function') onClick();
        });
        return btn;
    }

    function createOptionButton(onClick, label = 'More options') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zenith-option-btn';
        btn.setAttribute('aria-label', label);
        btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onClick === 'function') onClick();
        });
        return btn;
    }

    function clearNodeChildren(root) {
        if (!root) return;
        clearTrackUiRegistryForRoot(root);
        root.replaceChildren();
    }

    function appendFragment(parent, children) {
        if (!parent || !Array.isArray(children) || !children.length) return;
        const frag = document.createDocumentFragment();
        children.forEach((child) => {
            if (child) frag.appendChild(child);
        });
        parent.appendChild(frag);
    }

    function createScreenEmptyState({ className = 'screen-empty-state', title = '', body = '', iconName = '', action = null } = {}) {
        const box = document.createElement('div');
        box.className = className;
        if (iconName) {
            const icon = document.createElement('div');
            icon.className = 'screen-empty-icon';
            icon.innerHTML = getIconSvg(iconName);
            box.appendChild(icon);
        }
        if (title) {
            const heading = document.createElement('strong');
            heading.className = 'screen-empty-title';
            heading.textContent = title;
            box.appendChild(heading);
        }
        if (body) {
            const copy = document.createElement('p');
            copy.className = 'screen-empty-copy';
            copy.textContent = body;
            box.appendChild(copy);
        }
        if (action && action.label && action.action) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'screen-empty-action';
            button.dataset.action = action.action;
            if (action.target) button.dataset.target = action.target;
            button.textContent = action.label;
            box.appendChild(button);
        }
        return box;
    }

    function resolvePlaylistLeadTrack(playlist) {
        if (!playlist) return null;
        const first = Array.isArray(playlist.tracks) ? playlist.tracks[0] : null;
        if (!first) return null;
        if (typeof first === 'string') {
            return LIBRARY_TRACKS.find((track) => track.title === first) || null;
        }
        if (first.title) {
            return resolveTrackMeta(first.title, first.artist || playlist.artist || ARTIST_NAME, first.albumTitle || playlist.title);
        }
        return null;
    }

    function resolveCollectionLeadTrack(kind, item) {
        if (!item) return null;
        if (kind === 'album') {
            const first = Array.isArray(item.tracks) ? item.tracks[0] : null;
            if (!first || !first.title) return null;
            return resolveTrackMeta(first.title, first.artist || item.artist || ARTIST_NAME, first.albumTitle || item.title);
        }
        if (kind === 'playlist') return resolvePlaylistLeadTrack(item);
        if (kind === 'artist') {
            const tracks = LIBRARY_TRACKS
                .filter((track) => String(track.artist || '').toLowerCase() === String(item.name || '').toLowerCase())
                .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
            return tracks[0] || null;
        }
        return null;
    }

    function normalizeCollectionEntity(kind, item) {
        if (kind === 'playlist' && item && !item.title && item.name) {
            item = { ...item, title: item.name };
        }
        if (kind !== 'playlist' || !item || item.sourceType !== 'album_proxy') {
            return { kind, item };
        }
        const resolvedAlbum = typeof resolveAlbumMeta === 'function'
            ? resolveAlbumMeta(item.sourceAlbumTitle || item.title, item.artist)
            : null;
        const albumItem = resolvedAlbum || {
            title: item.sourceAlbumTitle || item.title || 'Album',
            artist: item.sourceAlbumArtist || item.artist || ARTIST_NAME,
            artUrl: item.artUrl || '',
            tracks: Array.isArray(item.tracks) ? item.tracks.slice() : [],
            trackCount: Number(item.trackCount || item.tracks?.length || 0),
            year: item.year || '',
            genre: item.genre || ''
        };
        return { kind: 'album', item: albumItem };
    }

    function playCollectionLead(kind, item) {
        if (kind === 'album') {
            if (typeof playAlbumInOrder === 'function') {
                playAlbumInOrder(item.title, 0, item.artist);
                return;
            }
        } else if (kind === 'playlist') {
            if (typeof playPlaylistInOrder === 'function') {
                playPlaylistInOrder(item.id, 0);
                return;
            }
        }
        const track = resolveCollectionLeadTrack(kind, item);
        if (!track) {
            toast('No playable track found');
            return;
        }
        playTrack(track.title, track.artist, track.albumTitle, getStableTrackIdentity(track));
    }

    function queueTrackNext(track) {
        if (!insertTrackInQueue(track, 'next')) return;
        commitQueueChange(`"${track.title}" queued next`);
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Swipe-to-action on track rows Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function pickPlaylistForTrack(track) {
        if (!track) return;
        const playlists = LIBRARY_PLAYLISTS;
        if (!playlists.length) { toast('No playlists available'); return; }
        const actions = playlists.map(pl => ({
            label: pl.title,
            description: `${pl.tracks?.length || 0} tracks`,
            icon: 'playlist',
            onSelect: () => {
                if (!pl.tracks) pl.tracks = [];
                pl.tracks.push(track);
                toast(`Added "${track.title}" to ${pl.title}`);
            }
        }));
        presentActionSheet('Add to Playlist', track.title, actions);
    }

    function makeSwipeable(row, options = {}) {
        const { onSwipeLeft, onSwipeRight, leftLabel, rightLabel } = options;
        if (!onSwipeLeft && !onSwipeRight) return;

        row.classList.add('swipeable');
        row.style.overflow = 'hidden';

        // Wrap existing contents in a rigid container
        const inner = document.createElement('div');
        inner.className = 'swipe-inner';
        while (row.firstChild) {
            inner.appendChild(row.firstChild);
        }
        row.appendChild(inner);

        // Build action indicators behind content
        if (onSwipeRight) {
            const a = document.createElement('div');
            a.className = 'swipe-reveal swipe-reveal-right';
            a.textContent = rightLabel || 'Playlist';
            row.insertBefore(a, row.firstChild);
        }
        if (onSwipeLeft) {
            const a = document.createElement('div');
            a.className = 'swipe-reveal swipe-reveal-left';
            a.textContent = leftLabel || 'Remove';
            row.insertBefore(a, row.firstChild);
        }

        let startX = 0, startY = 0, deltaX = 0, tracking = false, locked = false;
        const THRESHOLD = 72;
        const MAX = 110;

        row.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            deltaX = 0;
            tracking = false;
            locked = false;
            // Remove transition so drag feels instant
            const inner = row.querySelector('.swipe-inner');
            if (inner) inner.style.transition = 'none';
        }, { passive: true });

        row.addEventListener('touchmove', (e) => {
            if (locked) return;
            const t = e.touches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;

            // First significant movement decides axis
            if (!tracking && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
                locked = true; return; // vertical scroll Ã¢â‚¬â€ bail
            }
            if (!tracking && Math.abs(dx) > 10) { tracking = true; row.classList.add('is-swiping'); }
            if (!tracking) return;

            // Restrict to allowed directions
            if (dx > 0 && !onSwipeRight) { locked = true; return; }
            if (dx < 0 && !onSwipeLeft) { locked = true; return; }

            e.preventDefault();
            deltaX = Math.max(-MAX, Math.min(MAX, dx));

            // Translate all non-reveal children
            for (let i = 0; i < row.children.length; i++) {
                const ch = row.children[i];
                if (!ch.classList.contains('swipe-reveal')) ch.style.transform = `translateX(${deltaX}px)`;
            }
            const rr = row.querySelector('.swipe-reveal-right');
            const rl = row.querySelector('.swipe-reveal-left');
            if (rr) rr.classList.toggle('ready', deltaX > THRESHOLD);
            if (rl) rl.classList.toggle('ready', deltaX < -THRESHOLD);
        }, { passive: false });

        const settle = () => {
            // Re-enable transitions
            const inner = row.querySelector('.swipe-inner');
            if (inner) {
                inner.style.transition = 'transform 0.22s ease';
                inner.style.transform = '';
            }
            const rr = row.querySelector('.swipe-reveal-right');
            const rl = row.querySelector('.swipe-reveal-left');
            if (rr) rr.classList.remove('ready');
            if (rl) rl.classList.remove('ready');

            if (deltaX > THRESHOLD && onSwipeRight) onSwipeRight();
            else if (deltaX < -THRESHOLD && onSwipeLeft) onSwipeLeft();
            tracking = false;
            deltaX = 0;
            row.classList.remove('is-swiping');
        };
        row.addEventListener('touchend', settle);
        row.addEventListener('touchcancel', settle);
    }

    function addTrackToQueue(track) {
        if (!insertTrackInQueue(track, 'end')) return;
        commitQueueChange(`Added "${track.title}" to queue`);
    }

    function openTrackActionMenu(track, context = 'library') {
        const ctx = toEntityContext(context);
        const kindLabel = getEntityKindLabel('song');
        presentActionSheet(track.title, `${track.artist} - ${track.albumTitle || 'Unknown Album'}`, [
            { label: 'Play Next', description: 'Insert right after the current song.', icon: 'next', onSelect: () => queueTrackNext(track) },
            { label: 'Add to Queue', description: 'Keep this track in the current run.', icon: 'queue', onSelect: () => addTrackToQueue(track) },
            {
                label: 'Open Album',
                description: track.albumTitle || 'Go to source album.',
                icon: 'album',
                onSelect: () => routeToAlbum(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track))
            },
            {
                label: `Customize ${kindLabel} Subtext`,
                description: `${getEntityContextLabel(ctx)} controls: fields, separator, and interactivity.`,
                icon: 'manage',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('song', ctx)
            }
        ]);
    }

    function openCollectionActionMenu(kind, item, context = 'library') {
        const normalized = normalizeCollectionEntity(kind, item);
        kind = normalized.kind;
        item = normalized.item;
        const ctx = toEntityContext(context);
        const isAlbum = kind === 'album';
        const isPlaylist = kind === 'playlist';
        const title = isAlbum ? item.title : isPlaylist ? item.title : item.name;
        const subtitle = isAlbum ? item.artist : isPlaylist ? item.subtitle : `${item.trackCount || 0} tracks`;
        const subtextKind = isAlbum ? 'album' : isPlaylist ? 'playlist' : 'artist';

        const actions = [
            {
                label: 'Play',
                description: 'Start playback from this collection.',
                icon: 'music',
                onSelect: () => playCollectionLead(kind, item)
            },
            {
                label: isAlbum ? 'Open Album' : isPlaylist ? 'Open Playlist' : 'Open Artist',
                description: 'Jump directly to this view.',
                icon: 'open',
                onSelect: () => {
                    if (isAlbum) routeToAlbum(item.title, item.artist, getAlbumSourceIdentity(item));
                    else if (isPlaylist) routeToPlaylist(item.id);
                    else routeToArtist(item.name);
                }
            },
            {
                label: `Customize ${getEntityKindLabel(subtextKind)} Subtext`,
                description: `${getEntityContextLabel(ctx)} controls: fields, separator, and interactivity.`,
                icon: 'manage',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu(subtextKind, ctx)
            }
        ];

        // Export M3U Ã¢â‚¬â€ available for user playlists only
        if (isPlaylist && typeof exportPlaylistAsM3U === 'function') {
            actions.push({
                label: 'Export as M3U',
                description: 'Download this playlist as a .m3u file.',
                icon: 'share',
                onSelect: () => exportPlaylistAsM3U(item)
            });
        }

        presentActionSheet(title, subtitle, actions);
    }

    function createActionZone({ playButton, stateButton, heartButton, duration, metadataStatus = '' }) {
        const zone = document.createElement('div');
        zone.className = 'zenith-action-zone';
        const transportButton = stateButton || playButton || null;
        if (duration) {
            const time = document.createElement('span');
            time.className = 'zenith-time-pill';
            time.textContent = duration;
            time.dataset.originalDuration = duration;
            if (metadataStatus) time.dataset.metadataStatus = metadataStatus;
            zone.appendChild(time);
        }
        if (transportButton) zone.appendChild(transportButton);
        if (heartButton) zone.appendChild(heartButton);
        if (!zone.childElementCount) zone.classList.add('is-empty');
        return zone;
    }

    function getSongMetaParts(track, options = {}) {
        const context = toEntityContext(options.metaContext || 'library');
        const prefs = getEntitySubtextPrefs('song', context);
        const fields = prefs.fields || {};
        const parts = [];
        const canonicalArtist = getCanonicalTrackArtistName(track);
        if (fields.artist && canonicalArtist) {
            parts.push({
                label: canonicalArtist,
                onClick: () => routeToArtist(canonicalArtist),
                onLongPress: () => {
                    if (typeof openArtistZenithMenu === 'function') openArtistZenithMenu(canonicalArtist);
                }
            });
        }
        if (!options.hideAlbum && fields.album && track.albumTitle) {
            parts.push({
                label: track.albumTitle,
                onClick: () => routeToAlbum(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track)),
                onLongPress: () => {
                    if (typeof openAlbumZenithMenu !== 'function' || typeof resolveAlbumMeta !== 'function') return;
                            const albumMeta = resolveAlbumMeta(track.albumTitle, track.artist);
                    if (albumMeta) openAlbumZenithMenu(albumMeta);
                }
            });
        }
        const genre = resolveTrackGenre(track);
        if (fields.genre && genre) {
            parts.push({
                label: genre,
                onClick: () => routeToGenre(genre)
            });
        }
        const qualityLabel = getTrackMetadataQualityLabel(track);
        if (qualityLabel) {
            const quality = getTrackMetadataQuality(track);
            parts.push({
                label: qualityLabel,
                className: `metadata-quality-pill is-${quality}`,
                title: getTrackMetadataQualityDescription(track),
                onClick: () => {
                    if (typeof openTrackMetadataEditor === 'function') openTrackMetadataEditor(track);
                }
            });
        }
        return parts;
    }

    function getAlbumMetaParts(album, options = {}) {
        const context = toEntityContext(options.metaContext || 'library');
        const prefs = getEntitySubtextPrefs('album', context);
        const fields = prefs.fields || {};
        const parts = [];
        const albumArtist = Array.isArray(album?.tracks) && album.tracks.length
            ? getCanonicalTrackArtistName(album.tracks[0], album.artist)
            : String(album?.artist || '').trim();
        if (fields.artist && albumArtist) {
            parts.push({
                label: albumArtist,
                onClick: () => routeToArtist(albumArtist),
                onLongPress: () => {
                    if (typeof openArtistZenithMenu === 'function') openArtistZenithMenu(albumArtist);
                }
            });
        }
        if (fields.year && album.year) parts.push({ label: String(album.year) });
        if (fields.tracks) parts.push({ label: `${Number(album.trackCount || album.tracks?.length || 0)} tracks` });
        const genre = resolveAlbumGenre(album);
        if (fields.genre && genre) {
            parts.push({
                label: genre,
                onClick: () => routeToGenre(genre)
            });
        }
        return parts;
    }

    function getPlaylistMetaParts(playlist, options = {}) {
        const context = toEntityContext(options.metaContext || 'library');
        const prefs = getEntitySubtextPrefs('playlist', context);
        const fields = prefs.fields || {};
        const parts = [];
        const trackCount = Number(playlist?.tracks?.length || 0);
        if (fields.subtitle && playlist?.subtitle) {
            parts.push({
                label: playlist.subtitle,
                onClick: () => routeToPlaylist(playlist.id)
            });
        }
        if (fields.tracks) {
            parts.push({
                label: `${trackCount} tracks`,
                onClick: () => routeToPlaylist(playlist.id)
            });
        }
        return parts;
    }

    function getArtistMetaParts(artist, options = {}) {
        const context = toEntityContext(options.metaContext || 'library');
        const prefs = getEntitySubtextPrefs('artist', context);
        const fields = prefs.fields || {};
        const parts = [];
        if (fields.albums) {
            parts.push({
                label: `${Number(artist?.albumCount || 0)} albums`,
                onClick: () => routeToArtist(artist?.name)
            });
        }
        if (fields.tracks) {
            parts.push({
                label: `${Number(artist?.trackCount || 0)} tracks`,
                onClick: () => routeToArtist(artist?.name)
            });
        }
        return parts;
    }
/* <<< 08-zenith-components.js */

/* >>> 08b-zenith-row-cards.js */
/*
 * Auralis JS shard: 08b-zenith-row-cards.js
 * Purpose: song rows, queue rows, track rows, collection rows, cards and tiles
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function createLibrarySongRow(track, includeArt = true, options = {}) {
        const metaContext = toEntityContext(options.metaContext || 'library');
        const trackKeyValue = getTrackIdentityKey(track);
        const row = document.createElement('div');
        row.className = `list-item zenith-row${options.compact ? ' is-compact' : ''}`;
        row.dataset.trackKey = trackKeyValue;
        row.dataset.trackId = getStableTrackIdentity(track);
        row.dataset.metadataStatus = getTrackMetadataStatus(track);
        row.dataset.metadataQuality = getTrackMetadataQuality(track);
        row.style.borderColor = 'var(--border-default)';
        if (nowPlaying && isSameTrack(track, nowPlaying)) {
            row.classList.add('is-now-playing', 'playing-row');
            row.setAttribute('aria-current', 'true');
        }

        const click = document.createElement('div');
        click.tabIndex = 0;
        click.setAttribute('role', 'button');
        click.className = 'item-clickable';
        setDelegatedAction(click, 'playTrack', {
            title: track.title,
            artist: track.artist,
            album: track.albumTitle,
            trackId: getStableTrackIdentity(track)
        });
        click.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            playTrack(track.title, track.artist, track.albumTitle, getStableTrackIdentity(track));
        });
        bindLongPressAction(click, () => openTrackActionMenu(track, metaContext));

        let icon = null;
        if (includeArt) {
            icon = document.createElement('div');
            icon.className = 'item-icon';
            applyArtBackground(icon, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
            if (!track.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(track, icon);
            click.appendChild(icon);
        }

        const content = document.createElement('div');
        content.className = 'item-content';
        const h3 = document.createElement('h3');
        h3.appendChild(createTitleRail(track.title));
        content.appendChild(h3);
        const metaLine = createMetaLine(
            getSongMetaParts(track, { ...options, metaContext }),
            getEntitySubtextPrefs('song', metaContext)
        );
        if (metaLine) content.appendChild(metaLine);
        click.appendChild(content);

        row.appendChild(click);
        const stateButton = createTrackStateButton(
            track,
            () => playTrack(track.title, track.artist, track.albumTitle),
            { compact: Boolean(options.compact) }
        );
        row.appendChild(createActionZone({
            stateButton,
            duration: options.showDuration === false ? '' : getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track),
            heartButton: null
        }));
        registerTrackUi(trackKeyValue, {
            row,
            click,
            title: h3,
            durations: Array.from(row.querySelectorAll('.album-track-duration, .zenith-time-pill')),
            stateButton,
            arts: icon ? [icon] : []
        });

        // Swipe actions Ã¢â‚¬â€ right: add to playlist, left: remove (editable contexts only)
        const swipeOpts = { onSwipeRight: () => pickPlaylistForTrack(track) };
        if (metaContext === 'playlist_detail' && options._playlistRef) {
            swipeOpts.onSwipeLeft = () => {
                const pl = options._playlistRef;
                const idx = pl.tracks?.indexOf(track);
                if (idx >= 0) {
                    pl.tracks.splice(idx, 1);
                    toast(`Removed "${track.title}" from ${pl.title}`);
                    renderPlaylistDetail(pl);
                }
            };
            swipeOpts.leftLabel = 'Remove';
        }
        makeSwipeable(row, swipeOpts);

        return row;
    }

    function createQueueTrackRow(track, options = {}) {
        const trackKeyValue = getTrackIdentityKey(track);
        const row = document.createElement('div');
        row.className = `list-item zenith-row queue-row${options.compact ? ' is-compact' : ''}`;
        row.dataset.trackKey = trackKeyValue;
        row.dataset.trackId = getStableTrackIdentity(track);
        row.dataset.metadataStatus = getTrackMetadataStatus(track);
        row.dataset.metadataQuality = getTrackMetadataQuality(track);
        
        if (Number.isFinite(Number(options.queueIndex))) {
            row.dataset.queueIndex = String(Number(options.queueIndex));
        }
        
        row.dataset.queueReorderable = options.reorderable ? '1' : '0';
        row.style.borderColor = 'var(--border-default)';
        
        if (options.isCurrent) row.classList.add('playing-row', 'queue-current-row');
        if (nowPlaying && isSameTrack(track, nowPlaying)) {
            row.classList.add('is-now-playing', 'playing-row');
            row.setAttribute('aria-current', 'true');
        }
        if (options.reorderable) row.classList.add('queue-upnext-row');

        const click = document.createElement('div');
        click.tabIndex = 0;
        click.setAttribute('role', 'button');
        click.className = 'item-clickable';
        click.addEventListener('click', (evt) => {
            evt.preventDefault();
            if (typeof options.onActivate === 'function') options.onActivate(evt);
        });
        click.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (typeof options.onActivate === 'function') options.onActivate(event);
        });
        if (typeof options.onLongPress === 'function') bindLongPressAction(click, options.onLongPress);

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        applyArtBackground(icon, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
        if (!track.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(track, icon);
        click.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'item-content';
        const h3 = document.createElement('h3');
        h3.appendChild(createTitleRail(track.title || 'Untitled Track'));
        content.appendChild(h3);
        click.appendChild(content);
        row.appendChild(click);
        const actionZone = createActionZone({
            duration: options.showDuration === false ? '' : getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track)
        });
        if (options.reorderable) {
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'queue-drag-handle';
            handle.setAttribute('aria-label', `Reorder ${track.title || 'track'}`);
            handle.innerHTML = getIconSvg('manage');
            if (typeof options.onMenu === 'function') handle.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                options.onMenu(evt);
            });
            actionZone.insertBefore(handle, actionZone.firstChild);
        }
        row.appendChild(actionZone);

        registerTrackUi(trackKeyValue, {
            row,
            click,
            title: h3,
            durations: Array.from(row.querySelectorAll('.album-track-duration, .zenith-time-pill')),
            stateButton: null,
            arts: [icon]
        });
        
        return row;
    }


    // â”€â”€ Album / Playlist detail track row factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function makeAlbumTrackRow(track, idx, opts = {}) {
        const row = document.createElement('div');
        row.className = 'list-item album-track-row';
        row.dataset.trackKey = trackKey(track.title, track.artist);
        row.dataset.trackId = getStableTrackIdentity(track);
        row.dataset.metadataStatus = getTrackMetadataStatus(track);
        row.dataset.metadataQuality = getTrackMetadataQuality(track);
        if (opts.isLast) row.style.borderBottom = 'none';

        const click = document.createElement('button');
        click.className = 'item-clickable';
        click.type = 'button';
        click.addEventListener('click', () => {
            if (typeof opts.onActivate === 'function') opts.onActivate(idx);
        });
        if (typeof opts.onLongPress === 'function') bindLongPressAction(click, opts.onLongPress);

        const numEl = document.createElement('span');
        numEl.className = 'track-num';
        numEl.textContent = String(opts.numDisplay != null ? opts.numDisplay : idx + 1);

        const content = document.createElement('div');
        content.className = 'item-content';
        const titleEl = document.createElement('h3');
        titleEl.textContent = track.title;
        content.appendChild(titleEl);

        if (opts.showQuality) {
            const qualityLabel = getTrackMetadataQualityLabel(track);
            if (qualityLabel) {
                const qualityEl = document.createElement('span');
                qualityEl.className = `metadata-quality-pill is-${getTrackMetadataQuality(track)}`;
                qualityEl.textContent = qualityLabel;
                qualityEl.title = getTrackMetadataQualityDescription(track);
                content.appendChild(qualityEl);
            }
        }

        if (opts.showArtist && track.artist) {
            const artistNode = document.createElement('span');
            artistNode.style.cssText = 'font-size:12px; color:var(--text-secondary);';
            artistNode.textContent = track.artist;
            content.appendChild(artistNode);
        }

        const durationEl = document.createElement('span');
        durationEl.className = 'album-track-duration';
        durationEl.textContent = getTrackDurationDisplay(track);
        durationEl.dataset.originalDuration = durationEl.textContent;
        durationEl.dataset.metadataStatus = getTrackMetadataStatus(track);

        const stateBtn = createTrackStateButton(
            track,
            () => { if (typeof opts.onActivate === 'function') opts.onActivate(idx); },
            { compact: true }
        );
        stateBtn.classList.add('album-track-state-btn');

        click.appendChild(numEl);
        click.appendChild(content);
        click.appendChild(durationEl);
        click.appendChild(stateBtn);
        row.appendChild(click);

        registerTrackUi(trackKey(track.title, track.artist), {
            row, click, stateButton: stateBtn, durations: [durationEl]
        });
        return row;
    }

    function createCollectionRow(kind, item, metaContext = 'library') {
        const normalized = normalizeCollectionEntity(kind, item);
        kind = normalized.kind;
        item = normalized.item;
        const context = toEntityContext(metaContext);
        const row = document.createElement('div');
        row.className = 'list-item zenith-row';
        row.style.borderColor = 'var(--border-default)';

        const click = document.createElement('div');
        click.tabIndex = 0;
        click.setAttribute('role', 'button');
        click.className = 'item-clickable';

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (kind === 'artist') icon.style.borderRadius = '50%';
        applyArtBackground(icon, item.artUrl, getStableArtworkFallback(item.title || item.name || item.id, kind));

        const content = document.createElement('div');
        content.className = 'item-content';
        const h3 = document.createElement('h3');
        let metaLine = null;

        if (kind === 'album') {
            h3.appendChild(createTitleRail(item.title));
            row.dataset.albumKey = albumKey(item.title);
            row.dataset.sourceAlbumId = getAlbumSourceIdentity(item);
            setDelegatedAction(click, 'navToAlbum', { album: item.title, artist: item.artist, sourceAlbumId: getAlbumSourceIdentity(item) });
            click.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                routeToAlbum(item.title, item.artist, getAlbumSourceIdentity(item));
            });
            metaLine = createMetaLine(getAlbumMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('album', context));
        } else if (kind === 'playlist') {
            h3.appendChild(createTitleRail(item.title));
            row.dataset.playlistId = item.id;
            setDelegatedAction(click, 'routeToPlaylist', { playlistId: item.id });
            click.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                routeToPlaylist(item.id);
            });
            metaLine = createMetaLine(getPlaylistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('playlist', context));
        } else {
            h3.appendChild(createTitleRail(item.name));
            row.dataset.artistKey = toArtistKey(item.name);
            setDelegatedAction(click, 'routeToArtistProfile', { artist: item.name });
            click.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                routeToArtistProfile(item.name);
            });
            metaLine = createMetaLine(getArtistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('artist', context));
        }

        bindLongPressAction(click, () => openCollectionActionMenu(kind, item, context));
        content.appendChild(h3);
        if (metaLine) content.appendChild(metaLine);
        click.appendChild(icon);
        click.appendChild(content);
        row.appendChild(click);
        row.appendChild(createActionZone({
            playButton: null
        }));
        return row;
    }

    function createCollectionCard(kind, item, density = 'large', forGrid = false, metaContext = 'library') {
        const normalized = normalizeCollectionEntity(kind, item);
        kind = normalized.kind;
        item = normalized.item;
        const context = toEntityContext(metaContext);
        const card = document.createElement('div');
        card.className = kind === 'artist' ? 'media-card zenith-media-card artist-card' : 'media-card zenith-media-card';
        card.classList.add(density === 'compact' ? 'density-compact' : 'density-large');
        if (forGrid) {
            card.style.flex = '1 1 auto';
            card.style.width = '100%';
        }

        const cover = document.createElement('div');
        cover.className = 'media-cover';
        if (kind === 'artist') cover.style.borderRadius = '50%';
        applyArtBackground(cover, item.artUrl, getStableArtworkFallback(item.title || item.name || item.id, kind));
        if (!item.artUrl && (kind === 'album' || kind === 'playlist') && typeof lazyLoadArt === 'function') {
            lazyLoadArt(item, cover);
        }

        if (kind === 'album' || kind === 'playlist') {
            const playBtn = document.createElement('div');
            playBtn.className = 'catalog-play-btn';
            const collectionType = kind === 'album' ? 'album' : 'playlist';
            const collectionKey = kind === 'album'
                ? (typeof getAlbumIdentityKey === 'function' ? getAlbumIdentityKey(item, item.artist) : String(item.title || '').toLowerCase())
                : String(item.id || '').toLowerCase();
            playBtn.dataset.collectionType = collectionType;
            playBtn.dataset.collectionKey = collectionKey;
            const shouldPause = typeof isCollectionPlaying === 'function'
                ? isCollectionPlaying(collectionType, collectionKey)
                : (typeof isCollectionActive === 'function' && isCollectionActive(collectionType, collectionKey));
            playBtn.classList.toggle('is-playing', shouldPause);
            playBtn.setAttribute('aria-pressed', shouldPause ? 'true' : 'false');
            playBtn.innerHTML = getPlaybackIconSvg(shouldPause);
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (typeof isCollectionActive === 'function' && isCollectionActive(collectionType, collectionKey)) {
                    if (typeof togglePlayback === 'function') togglePlayback(e);
                    return;
                }
                if (kind === 'album') playAlbumInOrder(item.title, 0, item.artist);
                else playPlaylistInOrder(item.id, 0);
            };
            cover.appendChild(playBtn);
        }

        const footer = document.createElement('div');
        footer.className = 'zenith-card-footer';
        const textWrap = document.createElement('div');
        textWrap.className = 'zenith-card-text';
        const title = document.createElement('div');
        title.className = 'media-title';
        let sub = null;

        if (kind === 'album') {
            title.appendChild(createTitleRail(item.title, forGrid ? '' : 'force-marquee'));
            sub = createMetaLine(getAlbumMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('album', context));
            card.dataset.albumKey = albumKey(item.title);
            card.dataset.sourceAlbumId = getAlbumSourceIdentity(item);
            setDelegatedAction(card, 'navToAlbum', { album: item.title, artist: item.artist, sourceAlbumId: getAlbumSourceIdentity(item) });
        } else if (kind === 'playlist') {
            title.appendChild(createTitleRail(item.title));
            sub = createMetaLine(getPlaylistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('playlist', context));
            card.dataset.playlistId = item.id;
            setDelegatedAction(card, 'routeToPlaylist', { playlistId: item.id });
        } else {
            title.appendChild(createTitleRail(item.name));
            sub = createMetaLine(getArtistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('artist', context));
            card.dataset.artistKey = toArtistKey(item.name);
            setDelegatedAction(card, 'routeToArtistProfile', { artist: item.name });
        }
        if (sub) sub.classList.add('media-sub');

        bindLongPressAction(card, () => openCollectionActionMenu(kind, item, context));
        textWrap.appendChild(title);
        if (sub) textWrap.appendChild(sub);
        footer.appendChild(textWrap);
        footer.appendChild(createActionZone({
            playButton: null
        }));
        card.appendChild(cover);
        card.appendChild(footer);
        return card;
    }

    function createCollectionTile(kind, item, options = {}) {
        const density = options.density || 'large';
        const context = options.context || options.metaContext || 'library';
        return createCollectionCard(kind, item, density, Boolean(options.forGrid), context);
    }

    function createSongPreviewCard(track, density = 'large', asCarousel = false, metaContext = 'home') {
        const context = toEntityContext(metaContext);
        const card = document.createElement('div');
        card.className = `song-preview-card zenith-song-card ${density === 'compact' ? 'compact' : 'large'}${asCarousel ? ' carousel' : ''}`;
        card.dataset.trackKey = getTrackIdentityKey(track);
        card.dataset.trackId = getStableTrackIdentity(track);
        setDelegatedAction(card, 'playTrack', {
            title: track.title,
            artist: track.artist,
            album: track.albumTitle,
            trackId: getStableTrackIdentity(track)
        });
        bindLongPressAction(card, () => openTrackActionMenu(track, context));

        const art = document.createElement('div');
        art.className = 'art';
        applyArtBackground(art, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));

        const text = document.createElement('div');
        text.className = 'text';
        const h3 = document.createElement('h3');
        h3.appendChild(createTitleRail(track.title));
        const p = createMetaLine(
            getSongMetaParts(track, { hideAlbum: false, metaContext: context }),
            getEntitySubtextPrefs('song', context)
        );
        if (p) p.classList.add('zenith-song-meta');
        text.appendChild(h3);
        if (p) text.appendChild(p);

        card.appendChild(art);
        card.appendChild(text);
        card.appendChild(createActionZone({
            playButton: null,
            duration: getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track),
            heartButton: null
        }));
        return card;
    }

    function createCompactSongRailItem(track, metaContext = 'home') {
        const context = toEntityContext(metaContext);
        const item = document.createElement('div');
        item.className = 'zenith-song-rail-item';
        item.dataset.trackKey = getTrackIdentityKey(track);
        item.dataset.trackId = getStableTrackIdentity(track);
        setDelegatedAction(item, 'playTrack', {
            title: track.title,
            artist: track.artist,
            album: track.albumTitle,
            trackId: getStableTrackIdentity(track)
        });
        bindLongPressAction(item, () => openTrackActionMenu(track, context));

        const art = document.createElement('div');
        art.className = 'art';
        applyArtBackground(art, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));

        const text = document.createElement('div');
        text.className = 'text';
        const title = document.createElement('div');
        title.appendChild(createTitleRail(track.title));
        const meta = createMetaLine(
            getSongMetaParts(track, { hideAlbum: false, metaContext: context }),
            getEntitySubtextPrefs('song', context)
        );
        if (meta) meta.classList.add('zenith-song-meta');
        text.appendChild(title);
        if (meta) text.appendChild(meta);

        item.appendChild(art);
        item.appendChild(text);
        item.appendChild(createActionZone({
            playButton: null,
            duration: getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track),
            heartButton: null,
        }));
/* <<< 08b-zenith-row-cards.js */

/* >>> 09-zenith-home-sections.js */
/*
 * Auralis JS shard: 09-zenith-home-sections.js
 * Purpose: home section composition and editor actions
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        return item;
    }

    function createHomeSectionContent(section, items) {
        if (!items.length) {
            const typeIcons = { songs: 'music', albums: 'album', artists: 'artist', playlists: 'playlist' };
            const typeLabels = { songs: 'songs', albums: 'albums', artists: 'artists', playlists: 'playlists' };
            const label = typeLabels[section.itemType] || 'items';

            return createScreenEmptyState({
                className: 'home-section-empty zenith-section-empty',
                title: `No ${label}`,
                body: 'Nothing here yet.',
                iconName: typeIcons[section.itemType] || 'library'
            });
        }

        if (section.itemType === 'songs') {
            const density = section.density === 'compact' ? 'compact' : 'large';
            const layout = ensureSongLayoutForDensity(section.layout || 'list', density);

            if (layout === 'carousel') {
                const scroller = document.createElement('div');
                scroller.className = `horizon-scroller ${density === 'compact' ? 'zenith-song-rail' : ''}`;
                appendFragment(scroller, items.map(track => (
                    density === 'compact'
                        ? createCompactSongRailItem(track, 'home')
                        : createSongPreviewCard(track, 'large', true, 'home')
                )));
                return scroller;
            }

            if (layout === 'grid' && density !== 'compact') {
                const grid = document.createElement('div');
                grid.className = 'song-preview-grid';
                grid.style.gridTemplateColumns = '1fr 1fr';
                appendFragment(grid, items.map(track => createSongPreviewCard(track, 'large', false, 'home')));
                return grid;
            }

            const wrap = document.createElement('div');
            wrap.className = 'list-wrap';
            wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';
            appendFragment(wrap, items.map((track, idx) => {
                const row = createLibrarySongRow(track, true, {
                    compact: density === 'compact',
                    hideAlbum: false,
                    showDuration: true,
                    metaContext: 'home'
                });
                if (idx === items.length - 1) row.style.border = 'none';
                return row;
            }));
            return wrap;
        }

        if (section.layout === 'list') {
            const wrap = document.createElement('div');
            wrap.className = 'list-wrap';
            wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';
            const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
            appendFragment(wrap, items.map((item, idx) => {
                const row = createCollectionRow(kind, item, 'home');
                if (idx === items.length - 1) row.style.border = 'none';
                return row;
            }));
            return wrap;
        }

        if (section.layout === 'grid') {
            const grid = document.createElement('div');
            grid.className = 'cat-grid';
            const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
            appendFragment(grid, items.map(item => createCollectionCard(kind, item, section.density, true, 'home')));
            return grid;
        }

        const scroller = document.createElement('div');
        scroller.className = 'horizon-scroller';
        const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
        appendFragment(scroller, items.map(item => createCollectionCard(kind, item, section.density, false, 'home')));
        return scroller;
    }

    function updateHomeSection(sectionId, patch) {
        const idx = homeSections.findIndex(section => section.id === sectionId);
        if (idx < 0) return;
        const next = { ...homeSections[idx], ...patch };
        if (next.itemType === 'songs') next.layout = ensureSongLayoutForDensity(next.layout, next.density);
        homeSections[idx] = next;
        saveCurrentHomeProfileLayout();
        renderHomeSections();
    }

    function moveHomeSection(sectionId, direction) {
        const idx = homeSections.findIndex(section => section.id === sectionId);
        if (idx < 0) return;
        const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= homeSections.length) return;
        const temp = homeSections[idx];
        homeSections[idx] = homeSections[nextIdx];
        homeSections[nextIdx] = temp;
        saveCurrentHomeProfileLayout();
        renderHomeSections();
    }
    function removeHomeSection(sectionId) {
        const idx = homeSections.findIndex(section => section.id === sectionId);
        if (idx < 0) return;
        const removed = { ...homeSections[idx] };
        if (homeSections[idx].core) homeSections[idx].enabled = false;
        else homeSections.splice(idx, 1);
        saveCurrentHomeProfileLayout();
        renderHomeSections();
        presentUndoToast(`${removed.title || 'Section'} removed`, 'Undo', () => {
            const currentIndex = homeSections.findIndex(section => section.id === removed.id);
            if (currentIndex >= 0) {
                homeSections[currentIndex] = { ...homeSections[currentIndex], enabled: true };
            } else {
                homeSections.splice(Math.max(0, Math.min(idx, homeSections.length)), 0, removed);
            }
            saveCurrentHomeProfileLayout();
            renderHomeSections();
        });
    }

    function openItemCountPicker(sectionId, offset = 0) {
        const section = homeSections.find(s => s.id === sectionId);
        if (!section) return;
        const options = [4, 6, 8, 12, 16];
        const page = options.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map(limit => ({
            label: `${limit} items`,
            description: 'Visible before truncation.',
            icon: 'stack',
            onSelect: () => updateHomeSection(sectionId, { limit })
        }));
        if (offset + SHEET_PAGE_SIZE < options.length) {
            actions.push({ label: 'More Counts', description: 'Show larger item limits.', icon: 'down', keepOpen: true, onSelect: () => openItemCountPicker(sectionId, offset + SHEET_PAGE_SIZE) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous counts.', icon: 'up', keepOpen: true, onSelect: () => openItemCountPicker(sectionId, Math.max(0, offset - SHEET_PAGE_SIZE)) });
        }
        presentActionSheet('Item Count', section.title, actions);
    }

    function getLayoutOptionsForSection(section) {
        if (section.itemType !== 'songs') {
            return [
                { value: 'list', label: 'Track Column', description: 'Vertical rows with inline actions.', icon: 'stack' },
                { value: 'carousel', label: 'Carousel', description: 'Horizontal shelf presentation.', icon: 'carousel' },
                { value: 'grid', label: 'Poster Grid', description: 'Visual browsing grid.', icon: 'grid' }
            ];
        }
        return [
            { value: 'list', label: 'Track Column', description: 'Compact rows with artwork and quick actions.', icon: 'stack' },
            { value: 'carousel', label: 'Carousel', description: 'Immersive horizontal song rail.', icon: 'carousel' },
            { value: 'grid', label: 'Poster Grid', description: 'Cover-driven song tiles.', icon: 'grid' }
        ].filter(option => !(section.density === 'compact' && option.value === 'grid'));
    }

    function openLayoutPicker(sectionId, offset = 0) {
        const section = homeSections.find(s => s.id === sectionId);
        if (!section) return;
        const options = getLayoutOptionsForSection(section);
        const page = options.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map(option => ({
            label: option.label,
            description: option.description,
            icon: option.icon,
            onSelect: () => updateHomeSection(sectionId, { layout: option.value })
        }));
        if (offset + SHEET_PAGE_SIZE < options.length) {
            actions.push({ label: 'More Layouts', description: 'Show additional presentation modes.', icon: 'down', keepOpen: true, onSelect: () => openLayoutPicker(sectionId, offset + SHEET_PAGE_SIZE) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous layout options.', icon: 'up', keepOpen: true, onSelect: () => openLayoutPicker(sectionId, Math.max(0, offset - SHEET_PAGE_SIZE)) });
        }
        presentActionSheet('Presentation Mode', section.title, actions);
    }

    function applySectionTemplate(sectionId, template) {
        updateHomeSection(sectionId, {
            type: template.type,
            title: template.title,
            itemType: template.itemType,
            layout: template.layout,
            density: template.density,
            limit: template.limit,
            enabled: true
        });
    }

    function addSectionFromTemplate(template) {
        const existing = homeSections.find(section => section.type === template.type);
        if (existing && existing.enabled !== false) {
            toast(`${template.title} already exists`);
            showSectionConfigMenu(existing.id);
            return;
        }
        if (existing && existing.enabled === false) {
            updateHomeSection(existing.id, { enabled: true });
            toast(`${template.title} restored`);
            return;
        }
        homeSections.push({
            id: toSafeId(template.type),
            type: template.type,
            title: template.title,
            itemType: template.itemType,
            layout: template.layout,
            density: template.density,
            limit: template.limit,
            enabled: true,
            core: Boolean(template.core)
        });
        saveCurrentHomeProfileLayout();
        renderHomeSections();
        toast(`${template.title} added`);
    }

    function openSectionFilterStep({ mode, sectionId = '', itemType, offset = 0 }) {
        const all = getSectionCatalog().filter(template => template.itemType === itemType);
        if (!all.length) {
            toast('No filters available for this type');
            return;
        }
        const page = all.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map(template => {
            const existing = homeSections.find(section => section.type === template.type);
            const alreadyVisible = existing && existing.enabled !== false;
            const isCurrent = mode === 'update' && sectionId && existing && existing.id === sectionId;
            const description = `${formatLayoutLabel(template.layout)} • ${template.limit} items`;
            if (mode === 'add') {
                if (alreadyVisible) {
                    return { label: `${template.title} (Added)`, description, icon: 'filter', onSelect: () => showSectionConfigMenu(existing.id) };
                }
                return { label: template.title, description, icon: 'filter', onSelect: () => addSectionFromTemplate(template) };
            }
            return { label: template.title, description, icon: 'filter', onSelect: () => applySectionTemplate(sectionId, template), active: Boolean(isCurrent) };
        });

        if (offset + SHEET_PAGE_SIZE < all.length) {
            actions.push({ label: 'More Filters', description: 'See additional filter choices.', icon: 'down', keepOpen: true, onSelect: () => openSectionFilterStep({ mode, sectionId, itemType, offset: offset + SHEET_PAGE_SIZE }) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous filters.', icon: 'up', keepOpen: true, onSelect: () => openSectionFilterStep({ mode, sectionId, itemType, offset: Math.max(0, offset - SHEET_PAGE_SIZE) }) });
        } else {
            actions.push({
                label: 'Change Type',
                description: 'Return to step 1.',
                icon: 'source',
                keepOpen: true,
                onSelect: () => {
                    if (mode === 'add') openAddTypeStep(0);
                    else openSectionTypeStep(sectionId, 0);
                }
            });
        }
        presentActionSheet(mode === 'add' ? 'Create Home Section' : 'Section Source', 'Step 2 of 2 • Select filter', actions);
    }

    function openSectionTypeStep(sectionId, offset = 0) {
        const section = homeSections.find(s => s.id === sectionId);
        if (!section) return;
        const page = SECTION_TYPE_CHOICES.slice(offset, offset + TYPE_STEP_SIZE);
        const actions = page.map(choice => ({
            label: choice.label,
            description: choice.description,
            icon: choice.icon,
            onSelect: () => openSectionFilterStep({ mode: 'update', sectionId, itemType: choice.key, offset: 0 }),
            keepOpen: true
        }));
        if (offset + TYPE_STEP_SIZE < SECTION_TYPE_CHOICES.length) {
            actions.push({ label: 'More Types', description: 'Show additional section categories.', icon: 'down', keepOpen: true, onSelect: () => openSectionTypeStep(sectionId, offset + TYPE_STEP_SIZE) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous type choices.', icon: 'up', keepOpen: true, onSelect: () => openSectionTypeStep(sectionId, Math.max(0, offset - TYPE_STEP_SIZE)) });
        }
        presentActionSheet('Section Source', 'Step 1 of 2 • Select type', actions);
    }

    function openAddTypeStep(offset = 0) {
        const page = SECTION_TYPE_CHOICES.slice(offset, offset + TYPE_STEP_SIZE);
        const actions = page.map(choice => ({
            label: choice.label,
            description: choice.description,
            icon: choice.icon,
            keepOpen: true,
            onSelect: () => openSectionFilterStep({ mode: 'add', itemType: choice.key, offset: 0 })
        }));
        if (offset + TYPE_STEP_SIZE < SECTION_TYPE_CHOICES.length) {
            actions.push({ label: 'More Types', description: 'Show additional section categories.', icon: 'down', keepOpen: true, onSelect: () => openAddTypeStep(offset + TYPE_STEP_SIZE) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous type choices.', icon: 'up', keepOpen: true, onSelect: () => openAddTypeStep(Math.max(0, offset - TYPE_STEP_SIZE)) });
        }
        presentActionSheet('Create Home Section', 'Step 1 of 2 • Select type', actions);
    }

    function openSectionSubtextMenu(sectionId) {
        const section = homeSections.find((s) => s.id === sectionId);
        if (!section) return;
        const prefs = getSectionSubtextPrefs(section);
        const toggleAction = (label, description, key, enabled) => ({
            label: `${enabled ? 'Hide' : 'Show'} ${label}`,
            description,
            icon: enabled ? 'down' : 'up',
            keepOpen: true,
            onSelect: () => {
                updateSectionSubtextPrefs(sectionId, { [key]: !enabled });
                openSectionSubtextMenu(sectionId);
            }
        });
        presentActionSheet('Header Subtext', section.title, [
            toggleAction('Item count', 'Primary stat under each section title.', 'showCount', prefs.showCount),
            toggleAction('Type', 'Show section kind: songs, albums, artists, playlists.', 'showType', prefs.showType)
        ]);
    }

    function openTitleModeMenu(sectionId) {
        const section = homeSections.find((s) => s.id === sectionId);
        if (!section) return;
        presentActionSheet('Title Behavior', section.title, [
            {
                label: `Wrap in Area${homeTitleMode === 'wrap' ? ' (Active)' : ''}`,
                description: 'Allow long names to use up to two lines and stay inside each tile/row.',
                icon: 'stack',
                onSelect: () => setHomeTitleMode('wrap')
            },
            {
                label: `Marquee on Focus${homeTitleMode === 'marquee' ? ' (Active)' : ''}`,
                description: 'Keep one line and animate on hover/focus and the main carousel item.',
                icon: 'carousel',
                onSelect: () => setHomeTitleMode('marquee')
            }
        ]);
    }
/* <<< 09-zenith-home-sections.js */

/* >>> 09b-zenith-home-section-menus.js */
/*
 * Auralis JS shard: 09b-zenith-home-section-menus.js
 * Purpose: entity subtext menus, library section menus, subtext preferences UI
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function openEntitySubtextFieldsMenu(kind = 'song', context = 'library', offset = 0) {
        const defs = getEntityFieldDefs(kind);
        if (!defs.length) return;
        const ctx = toEntityContext(context);
        const prefs = getEntitySubtextPrefs(kind, ctx);
        const page = defs.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map((field) => {
            const enabled = prefs.fields?.[field.key] === true;
            return {
                label: `${enabled ? 'Hide' : 'Show'} ${field.label}`,
                description: field.description,
                icon: enabled ? 'down' : 'up',
                keepOpen: true,
                onSelect: () => {
                    updateEntitySubtextPrefs(kind, ctx, { fields: { [field.key]: !enabled } });
                    openEntitySubtextFieldsMenu(kind, ctx, offset);
                }
            };
        });
        if (offset + SHEET_PAGE_SIZE < defs.length) {
            actions.push({
                label: 'More Fields',
                description: 'Show additional metadata tokens.',
                icon: 'down',
                keepOpen: true,
                onSelect: () => openEntitySubtextFieldsMenu(kind, ctx, offset + SHEET_PAGE_SIZE)
            });
        } else if (offset > 0) {
            actions.push({
                label: 'Back',
                description: 'Return to previous field options.',
                icon: 'up',
                keepOpen: true,
                onSelect: () => openEntitySubtextFieldsMenu(kind, ctx, Math.max(0, offset - SHEET_PAGE_SIZE))
            });
        }
        presentActionSheet(`${getEntityKindLabel(kind)} Fields`, `${getEntityContextLabel(ctx)} metadata tokens`, actions);
    }

    function openEntitySubtextSeparatorMenu(kind = 'song', context = 'library', offset = 0) {
        const ctx = toEntityContext(context);
        const prefs = getEntitySubtextPrefs(kind, ctx);
        const page = ENTITY_SUBTEXT_SEPARATOR_OPTIONS.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map((option) => {
            const active = prefs.separator === option.key;
            const separatorLabel = option.sample ? ` "${option.sample}"` : ' no separator';
            return {
                label: `${option.label}${active ? ' (Active)' : ''}`,
                description: `Use${separatorLabel} between subtext items.`,
                icon: active ? 'up' : 'stack',
                keepOpen: true,
                onSelect: () => {
                    updateEntitySubtextPrefs(kind, ctx, { separator: option.key });
                    openEntitySubtextSeparatorMenu(kind, ctx, offset);
                }
            };
        });
        if (offset + SHEET_PAGE_SIZE < ENTITY_SUBTEXT_SEPARATOR_OPTIONS.length) {
            actions.push({
                label: 'More Separators',
                description: 'Show additional separator styles.',
                icon: 'down',
                keepOpen: true,
                onSelect: () => openEntitySubtextSeparatorMenu(kind, ctx, offset + SHEET_PAGE_SIZE)
            });
        } else if (offset > 0) {
            actions.push({
                label: 'Back',
                description: 'Return to previous separator styles.',
                icon: 'up',
                keepOpen: true,
                onSelect: () => openEntitySubtextSeparatorMenu(kind, ctx, Math.max(0, offset - SHEET_PAGE_SIZE))
            });
        }
        presentActionSheet(`${getEntityKindLabel(kind)} Separator`, `${getEntityContextLabel(ctx)} separator style`, actions);
    }

    function openEntitySubtextContextMenu(kind = 'song', currentContext = 'library', offset = 0) {
        const current = toEntityContext(currentContext);
        const contexts = ENTITY_SUBTEXT_CONTEXTS.filter((ctx) => ctx !== 'default').concat('default');
        const page = contexts.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map((ctx) => {
            const isCurrent = ctx === current;
            return {
                label: `${getEntityContextLabel(ctx)}${isCurrent ? ' (Editing)' : ''}`,
                description: `Customize ${getEntityKindLabel(kind).toLowerCase()} subtext for this view.`,
                icon: isCurrent ? 'up' : 'open',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu(kind, ctx)
            };
        });
        if (offset + SHEET_PAGE_SIZE < contexts.length) {
            actions.push({
                label: 'More Views',
                description: 'Show additional view scopes.',
                icon: 'down',
                keepOpen: true,
                onSelect: () => openEntitySubtextContextMenu(kind, current, offset + SHEET_PAGE_SIZE)
            });
        } else if (offset > 0) {
            actions.push({
                label: 'Back',
                description: 'Return to previous scopes.',
                icon: 'up',
                keepOpen: true,
                onSelect: () => openEntitySubtextContextMenu(kind, current, Math.max(0, offset - SHEET_PAGE_SIZE))
            });
        }
        presentActionSheet(`${getEntityKindLabel(kind)} View Scope`, `${getEntityContextLabel(current)} currently selected`, actions);
    }

    function openEntitySubtextMenu(kind = 'song', context = 'library') {
        if (!DEFAULT_ENTITY_SUBTEXT_PREFS[kind]) return;
        const ctx = toEntityContext(context);
        const prefs = getEntitySubtextPrefs(kind, ctx);
        const separator = getEntitySeparatorOption(prefs.separator);
        presentActionSheet(
            `${getEntityKindLabel(kind)} Subtext`,
            `${getEntityContextLabel(ctx)} - ${prefs.interactive ? 'Interactive' : 'Static'} - ${separator.label}`,
            [
                {
                    label: 'Fields',
                    description: 'Insert or remove metadata tokens.',
                    icon: 'filter',
                    keepOpen: true,
                    onSelect: () => openEntitySubtextFieldsMenu(kind, ctx, 0)
                },
                {
                    label: prefs.interactive ? 'Disable Interactivity' : 'Enable Interactivity',
                    description: 'Toggle tap and long-press behavior on subtext tokens.',
                    icon: prefs.interactive ? 'down' : 'up',
                    keepOpen: true,
                    onSelect: () => {
                        updateEntitySubtextPrefs(kind, ctx, { interactive: !prefs.interactive });
                        openEntitySubtextMenu(kind, ctx);
                    }
                },
                {
                    label: 'Separator',
                    description: 'Customize how metadata tokens are separated.',
                    icon: 'stack',
                    keepOpen: true,
                    onSelect: () => openEntitySubtextSeparatorMenu(kind, ctx, 0)
                },
                {
                    label: 'View Scope',
                    description: 'Switch Home, Library, Playlist, Artist, and more.',
                    icon: 'open',
                    keepOpen: true,
                    onSelect: () => openEntitySubtextContextMenu(kind, ctx, 0)
                }
            ]
        );
    }

    function openMetadataDisplayMenu(context = 'home') {
        const ctx = toEntityContext(context);
        presentActionSheet('Metadata Display', `${getEntityContextLabel(ctx)} subtext studio`, [
            {
                label: 'Song Subtext',
                description: 'Configure song metadata tokens.',
                icon: 'music',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('song', ctx)
            },
            {
                label: 'Album Subtext',
                description: 'Configure album metadata tokens.',
                icon: 'album',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('album', ctx)
            },
            {
                label: 'Playlist Subtext',
                description: 'Configure playlist metadata tokens.',
                icon: 'playlist',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('playlist', ctx)
            },
            {
                label: 'Artist Subtext',
                description: 'Configure artist metadata tokens.',
                icon: 'artist',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('artist', ctx)
            }
        ]);
    }

    function openGenreActionMenu(bucket) {
        if (!bucket || !bucket.name) return;
        const topTrack = bucket.topTrack || null;
        const topTracks = Array.isArray(bucket.tracks)
            ? bucket.tracks
                .slice()
                .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0))
                .slice(0, 5)
            : [];
        presentActionSheet(bucket.name, `${bucket.trackCount || topTracks.length} tracks`, [
            {
                label: 'Browse Genre',
                description: 'Open Search focused on this genre.',
                icon: 'open',
                onSelect: () => routeToGenre(bucket.name)
            },
            {
                label: topTrack ? `Play "${topTrack.title}"` : 'Play Top Song',
                description: topTrack ? 'Start with the most-played song in this genre.' : 'No songs available.',
                icon: 'music',
                onSelect: () => {
                    if (!topTrack) return;
                    playTrack(topTrack.title, topTrack.artist, topTrack.albumTitle);
                }
            },
            {
                label: topTracks.length ? `Queue Top ${topTracks.length}` : 'Queue Top Songs',
                description: topTracks.length ? 'Append top songs from this genre to queue.' : 'No songs available.',
                icon: 'queue',
                onSelect: () => {
                    if (!topTracks.length) return;
                    topTracks.forEach((track) => addTrackToQueue(track));
                }
            }
        ]);
    }

    function ensureLibraryHeaderBindings() {
        const headerTitle = document.querySelector('#library .top-bar h1');
        if (!headerTitle || headerTitle.dataset.metaMenuBound === '1') return;
        headerTitle.dataset.metaMenuBound = '1';
        bindLongPressAction(headerTitle, () => openMetadataDisplayMenu('library'), 540);
        headerTitle.title = 'Long press for metadata options';
    }

    function openLibraryCreateMenu() {
        presentActionSheet('Add to Library', 'Choose what to create or bring in', [
            {
                label: 'New Playlist',
                description: 'Create an empty playlist.',
                icon: 'playlist',
                onSelect: () => openCreatePlaylistDialog()
            },
            {
                label: 'Import Playlist',
                description: 'Import an M3U playlist file.',
                icon: 'folder',
                onSelect: () => importM3UFile()
            },
            {
                label: 'Smart Playlist',
                description: 'Rules-based playlists are coming soon.',
                icon: 'filter',
                onSelect: () => toast('Smart playlists coming soon')
            },
            {
                label: 'Playlist Folder',
                description: 'Folder organization placeholder.',
                icon: 'library',
                onSelect: () => toast('Playlist folders coming soon')
            }
        ]);
    }

    function showSectionConfigMenu(sectionRef) {
        const section = homeSections.find(s => s.id === sectionRef) || homeSections.find(s => s.title === sectionRef);
        if (!section) return;
        sectionConfigContextId = section.id;
        const nextDensity = section.density === 'compact' ? 'large' : 'compact';
        presentActionSheet(`${section.title} Settings`, 'Zenith section controls', [
            {
                label: 'Source Builder',
                description: 'Step 1 type, step 2 filter.',
                icon: 'source',
                keepOpen: true,
                onSelect: () => openSectionTypeStep(section.id, 0)
            },
            {
                label: `Presentation (${formatLayoutLabel(section.layout)})`,
                description: 'Switch between track column, carousel, and poster grid.',
                icon: section.layout === 'carousel' ? 'carousel' : section.layout === 'grid' ? 'grid' : 'stack',
                keepOpen: true,
                onSelect: () => openLayoutPicker(section.id, 0)
            },
            {
                label: 'Header Subtext',
                description: 'Choose which stats appear under this section title.',
                icon: 'filter',
                keepOpen: true,
                onSelect: () => openSectionSubtextMenu(section.id)
            },
            {
                label: `Title Behavior (${homeTitleMode === 'wrap' ? 'Wrap' : 'Marquee'})`,
                description: 'Wrap long titles or keep marquee-style motion.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => openTitleModeMenu(section.id)
            }
        ]);
    }

    function openAddHomeSection() {
        openAddTypeStep(0);
    }
/* <<< 09b-zenith-home-section-menus.js */

/* >>> 09c-zenith-home-rendering.js */
/*
 * Auralis JS shard: 09c-zenith-home-rendering.js
 * Purpose: home section rendering, blueprints, drag, DOM sync
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function showCountPopover(section, anchor) {
        // Dismiss any open popover first
        document.querySelectorAll('.count-popover').forEach(p => p.remove());

        const counts = [4, 6, 8, 12, 16];
        const popover = document.createElement('div');
        popover.className = 'count-popover';

        const label = document.createElement('span');
        label.className = 'count-popover-label';
        label.textContent = 'Show';
        popover.appendChild(label);

        counts.forEach(n => {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'count-popover-opt' + (section.limit === n ? ' is-current' : '');
            opt.textContent = n;
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                updateHomeSection(section.id, { limit: n });
                popover.remove();
            });
            popover.appendChild(opt);
        });

        // Append to emulator for correct absolute positioning
        const emulator = anchor.closest('.emulator') || document.querySelector('.emulator');
        const parent = emulator || document.body;
        popover.style.visibility = 'hidden';
        parent.appendChild(popover);

        const anchorRect = anchor.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const popWidth = popover.getBoundingClientRect().width || 220;
        const topPx = anchorRect.bottom - parentRect.top + 6;
        const idealLeft = anchorRect.left - parentRect.left + (anchor.offsetWidth / 2) - (popWidth / 2);
        const leftPx = Math.max(8, Math.min(idealLeft, parentRect.width - popWidth - 8));

        popover.style.top = topPx + 'px';
        popover.style.left = leftPx + 'px';
        popover.style.visibility = '';

        // Close on outside click
        requestAnimationFrame(() => {
            const dismiss = (ev) => {
                if (!popover.contains(ev.target)) {
                    popover.remove();
                    document.removeEventListener('click', dismiss, true);
                }
            };
            document.addEventListener('click', dismiss, true);
        });
    }

    function createSectionBlueprint(section) {
        const layout    = section.layout   || 'list';
        const itemType  = section.itemType || 'albums';
        const density   = section.density  || 'large';
        const limit     = section.limit    || 6;

        const typeIcons   = { songs: 'music', albums: 'album', artists: 'artist', playlists: 'playlist' };
        const typeLabels  = { songs: 'Songs', albums: 'Albums', artists: 'Artists', playlists: 'Playlists' };
        const layoutLabels = { list: 'Column', carousel: 'Carousel', grid: 'Grid' };
        const densityLabels = { compact: 'Compact', large: 'Large' };

        const bp = document.createElement('div');
        bp.className = 'section-blueprint';

        // Header: icon + config description
        const bpHead = document.createElement('div');
        bpHead.className = 'blueprint-head';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'blueprint-icon';
        iconWrap.innerHTML = getIconSvg(typeIcons[itemType] || 'source');

        const desc = document.createElement('div');
        desc.className = 'blueprint-desc';
        const parts = [
            typeLabels[itemType]   || itemType,
            layoutLabels[layout]  || layout,
            densityLabels[density] || density,
            `${limit} items`
        ];
        desc.innerHTML = parts.map(p => `<span class="blueprint-label">${p}</span>`).join('<span class="blueprint-sep"> · </span>');

        bpHead.appendChild(iconWrap);
        bpHead.appendChild(desc);
        bp.appendChild(bpHead);

        // Skeleton preview — shape matches the section's layout
        const preview = document.createElement('div');
        preview.className = `blueprint-preview blueprint-preview--${layout}`;

        const ghostCount = layout === 'grid' ? 4 : 3;
        for (let i = 0; i < ghostCount; i++) {
            const item = document.createElement('div');
            item.className = 'blueprint-ghost-item';

            const art = document.createElement('div');
            art.className = 'blueprint-ghost-art';
            item.appendChild(art);

            if (layout === 'list') {
                const textBlock = document.createElement('div');
                textBlock.className = 'blueprint-ghost-text';
                const l1 = document.createElement('div');
                l1.className = 'blueprint-ghost-line blueprint-ghost-line--primary';
                const l2 = document.createElement('div');
                l2.className = 'blueprint-ghost-line blueprint-ghost-line--secondary';
                textBlock.appendChild(l1);
                textBlock.appendChild(l2);
                item.appendChild(textBlock);
            } else {
                const l1 = document.createElement('div');
                l1.className = 'blueprint-ghost-line blueprint-ghost-line--primary';
                item.appendChild(l1);
            }

            preview.appendChild(item);
        }

        bp.appendChild(preview);
        return bp;
    }

    function renderHomeSections() {
        const root = getEl('home-sections-root');
        const music = getEl('home-music-section');
        const addBtn = document.querySelector('#home-music-section > .add-section-btn[data-action="openAddHomeSection"]');
        if (!root || !music) return;

        music.style.display = 'block';

        // Legacy video section — removed from HTML; ignore gracefully
        const videos = getEl('home-videos-section');
        if (videos) videos.style.display = 'none';

        clearNodeChildren(root);
        const visible = homeSections.filter(section => section.enabled !== false);
        if (addBtn) {
            if (visible.length) {
                delete addBtn.dataset.forceVisible;
                addBtn.style.removeProperty('display');
            } else {
                addBtn.dataset.forceVisible = '1';
                addBtn.style.display = 'flex';
            }
        }
        if (!visible.length) {
            appendFragment(root, [
                createScreenEmptyState({
                    className: 'home-section-empty home-profile-empty',
                    title: 'Your Home is Empty',
                    body: 'Add a section to make this profile useful.',
                    iconName: 'library',
                    action: { label: 'Add Section', action: 'openAddHomeSection' }
                })
            ]);
            ensureAccessibility();
            return;
        }

        const sectionSnapshots = visible.map(section => ({
            section,
            items: getSectionItems(section)
        }));
        const hasVisibleItems = sectionSnapshots.some(snapshot => snapshot.items.length > 0);
        if (!hasVisibleItems && !inEditMode) {
            appendFragment(root, [
                createScreenEmptyState({
                    className: 'home-section-empty home-profile-empty home-overview-empty',
                    title: 'Nothing to show yet',
                    body: 'Add music or edit this Home.',
                    iconName: 'library',
                    action: { label: 'Add Music', action: 'openMediaFolderSetup' }
                })
            ]);
            ensureAccessibility();
            return;
        }

        const sectionNodes = sectionSnapshots.map(({ section, items }) => {
            const block = document.createElement('div');
            block.className = 'home-section drag-target';
            block.dataset.sectionId = section.id;

            const header = document.createElement('div');
            header.className = 'section-header zenith-canvas-header';
            const left = document.createElement('div');
            left.className = 'section-header-left';
            const drag = document.createElement('span');
            drag.className = 'section-config drag-handle';
            drag.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 7h8v2H8V7zm0 4h8v2H8v-2zm0 4h8v2H8v-2z"></path></svg>';
            drag.style.color = 'var(--text-tertiary)';
            const titleWrap = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.textContent = section.title;
            const subtle = document.createElement('div');
            subtle.className = 'section-subtle';
            subtle.textContent = buildSectionSubtext(section, items.length);
            left.appendChild(drag);
            titleWrap.appendChild(h2);
            if (subtle.textContent) titleWrap.appendChild(subtle);
            left.appendChild(titleWrap);
            bindLongPressAction(left, () => showSectionConfigMenu(section.id));

            const actions = document.createElement('div');
            actions.className = 'section-actions zenith-actions';
            
            // Zenith minimalistic iconography for canvas
            
            const densityBtn = document.createElement('div');
            densityBtn.className = 'icon-btn edit-action';
            densityBtn.title = 'Cycle Density';
            densityBtn.setAttribute('aria-label', 'Cycle density');
            densityBtn.innerHTML = getIconSvg('spacing');
            densityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nextDensity = section.density === 'compact' ? 'large' : 'compact';
                const patch = { density: nextDensity };
                if (section.itemType === 'songs') patch.layout = ensureSongLayoutForDensity(section.layout, nextDensity);
                updateHomeSection(section.id, patch);
            });

            const countBtn = document.createElement('div');
            countBtn.className = 'icon-btn edit-action';
            countBtn.title = 'Item Count';
            countBtn.setAttribute('aria-label', 'Item count');
            countBtn.innerHTML = getIconSvg('number');
            countBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showCountPopover(section, countBtn);
            });
            
            const settingsBtn = document.createElement('div');
            settingsBtn.className = 'icon-btn edit-action';
            settingsBtn.title = 'Settings';
            settingsBtn.setAttribute('aria-label', 'Section settings');
            settingsBtn.innerHTML = getIconSvg('manage');
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showSectionConfigMenu(section.id);
            });

            const removeBtn = document.createElement('div');
            removeBtn.className = 'icon-btn edit-action danger-action';
            removeBtn.title = 'Remove';
            removeBtn.setAttribute('aria-label', 'Remove section');
            removeBtn.innerHTML = getIconSvg('trash');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeHomeSection(section.id);
            });

            actions.appendChild(densityBtn);
            actions.appendChild(countBtn);
            actions.appendChild(settingsBtn);
            actions.appendChild(removeBtn);

            header.appendChild(left);
            header.appendChild(actions);
            block.appendChild(header);
            const contentWrap = document.createElement('div');
            contentWrap.className = 'section-content';
            contentWrap.appendChild(createHomeSectionContent(section, items));
            block.appendChild(contentWrap);
            block.appendChild(createSectionBlueprint(section));
            return block;
        });

        appendFragment(root, sectionNodes);
        bindHomeSectionDrag(root);
        ensureAccessibility();
        scheduleTitleMotion(root);
    }

    function syncHomeSectionsFromDOM(root) {
        const domIds = Array.from(root.querySelectorAll('.home-section[data-section-id]'))
            .map(el => el.dataset.sectionId);
        const visible = homeSections.filter(s => s.enabled !== false);
        const hidden = homeSections.filter(s => s.enabled === false);
        const reordered = domIds.map(id => visible.find(s => s.id === id)).filter(Boolean);
        const missing = visible.filter(s => !domIds.includes(s.id));
        homeSections.length = 0;
        reordered.forEach(s => homeSections.push(s));
        missing.forEach(s => homeSections.push(s));
        hidden.forEach(s => homeSections.push(s));
        saveCurrentHomeProfileLayout();
        if (navigator.vibrate) navigator.vibrate(20);
    }

    function bindHomeSectionDrag(root) {
        let draggingEl = null;

        root.querySelectorAll('.home-section.drag-target').forEach(block => {
            if (block.dataset.homeDragBound === '1') return;
            block.dataset.homeDragBound = '1';

            const handle = block.querySelector('.drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', () => { block.draggable = true; });
                handle.addEventListener('touchstart', () => { block.draggable = true; }, { passive: true });
            }

            block.addEventListener('dragstart', (e) => {
                draggingEl = block;
                block.classList.add('home-section-dragging');
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { if (draggingEl) draggingEl.style.opacity = '0.35'; }, 0);
            });

            block.addEventListener('dragend', () => {
                block.draggable = false;
                block.style.opacity = '';
                block.classList.remove('home-section-dragging');
                root.querySelectorAll('.home-section-drop-indicator').forEach(el => el.remove());
                draggingEl = null;
                syncHomeSectionsFromDOM(root);
            });

            block.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggingEl || draggingEl === block) return;
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                const rect = block.getBoundingClientRect();
                const insertAfter = e.clientY > rect.top + rect.height / 2;
                root.insertBefore(draggingEl, insertAfter ? block.nextSibling : block);
            });
        });
    }

    function filterHome(type) {
        currentHomeFilter = 'all';
        renderHomeSections();
    }
/* <<< 09c-zenith-home-rendering.js */

/* >>> 10-zenith-library-views.js */
/*
 * Auralis JS shard: 10-zenith-library-views.js
 * Purpose: favorites, artist, search, sidebar, library render refresh
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    const LIBRARY_SECTIONS = ['playlists', 'albums', 'artists', 'songs', 'genres', 'folders'];
    const LIBRARY_APPEARANCE_MODES = ['list', 'grid', 'carousel'];
    const LIBRARY_DENSITY_MODES = ['compact', 'large'];
    const LIBRARY_SORT_MODES = ['most_played', 'recent', 'forgotten'];
    const LIBRARY_GRID_COLUMN_OPTIONS = [1, 2, 3];
    const LIBRARY_APPEARANCE_GROUPS = ['view', 'size', 'columns', 'sort', 'group'];
    const LIBRARY_COLLECTION_LAYOUT_CLASSES = LIBRARY_APPEARANCE_MODES.map(mode => `library-view-${mode}`).concat(['library-view-compact', 'library-view-two-row']);
    let libraryEditMode = false;
    const categoryAppearanceEditModes = new Set();

    function normalizeLibrarySection(tab) {
        return LIBRARY_SECTIONS.includes(tab) ? tab : 'playlists';
    }

    function getLibraryCategoryOrder() {
        const stored = getUiPreference('libraryCategoryOrder', []);
        const order = Array.isArray(stored) ? stored.filter(section => LIBRARY_SECTIONS.includes(section)) : [];
        return order.concat(LIBRARY_SECTIONS).filter((section, index, list) => list.indexOf(section) === index);
    }

    function persistLibraryCategoryOrder(order) {
        setUiPreference('libraryCategoryOrder', order.filter(section => LIBRARY_SECTIONS.includes(section)));
    }

    function getLibraryAppearancePrefs() {
        const prefs = getUiPreference('libraryAppearance', {});
        return prefs && typeof prefs === 'object' ? prefs : {};
    }

    function getDefaultLibraryAppearance(section) {
        section = normalizeLibrarySection(section);
        return {
            mode: (section === 'albums' || section === 'genres') ? 'grid' : 'list',
            columns: section === 'artists' ? 2 : 2,
            density: 'compact',
            sort: 'most_played',
            groupByArtist: section === 'albums'
        };
    }

    function normalizeLibraryGridColumns(value, fallback = 2) {
        const numeric = Math.round(Number(value));
        if (LIBRARY_GRID_COLUMN_OPTIONS.includes(numeric)) return numeric;
        return fallback;
    }

    function normalizeLibraryCollapsedGroups(value) {
        return Array.isArray(value)
            ? value.filter(group => LIBRARY_APPEARANCE_GROUPS.includes(group))
            : [];
    }

    function getLibraryAppearanceConfig(section) {
        section = normalizeLibrarySection(section);
        const prefs = getLibraryAppearancePrefs();
        const raw = prefs[section] && typeof prefs[section] === 'object' ? prefs[section] : {};
        const defaults = getDefaultLibraryAppearance(section);
        let mode = raw.mode || defaults.mode;
        if (mode === 'compact' || mode === 'twoRow') mode = section === 'albums' ? 'carousel' : 'grid';
        if (!LIBRARY_APPEARANCE_MODES.includes(mode)) mode = defaults.mode;
        const columns = normalizeLibraryGridColumns(raw.columns, defaults.columns);
        const density = LIBRARY_DENSITY_MODES.includes(raw.density) ? raw.density : defaults.density;
        const sort = LIBRARY_SORT_MODES.includes(raw.sort) ? raw.sort : defaults.sort;
        return {
            mode,
            columns,
            density,
            sort,
            groupByArtist: raw.groupByArtist == null ? defaults.groupByArtist : Boolean(raw.groupByArtist),
            collapsedGroups: normalizeLibraryCollapsedGroups(raw.collapsedGroups)
        };
    }

    function setLibraryAppearanceGroupCollapsed(section, groupKey, collapsed) {
        section = normalizeLibrarySection(section);
        if (!LIBRARY_APPEARANCE_GROUPS.includes(groupKey)) return;
        const prefs = getLibraryAppearancePrefs();
        const config = getLibraryAppearanceConfig(section);
        const nextCollapsed = new Set(config.collapsedGroups);
        if (collapsed) nextCollapsed.add(groupKey);
        else nextCollapsed.delete(groupKey);
        prefs[section] = { ...config, collapsedGroups: Array.from(nextCollapsed) };
        setUiPreference('libraryAppearance', prefs);
    }

    function buildSettingsGroup({ label, groupKey, collapsedGroups, onToggle }) {
        const group = document.createElement('details');
        group.className = 'settings-choice-group library-appearance-group';
        group.open = !collapsedGroups.includes(groupKey);

        const summary = document.createElement('summary');
        summary.className = 'settings-choice-label library-appearance-label';
        const title = document.createElement('span');
        title.textContent = label;
        const state = document.createElement('span');
        state.className = 'settings-choice-chevron library-appearance-chevron';
        state.setAttribute('aria-hidden', 'true');
        state.textContent = group.open ? '-' : '+';
        summary.append(title, state);

        const options = document.createElement('div');
        options.className = 'settings-choice-options library-appearance-options';
        group.append(summary, options);
        group.addEventListener('toggle', () => {
            state.textContent = group.open ? '-' : '+';
            if (typeof onToggle === 'function') onToggle(groupKey, !group.open);
        });
        return { group, options };
    }

    function appendSettingsChoice(container, { label = '', title, icon = '', active = false, onClick }) {
        if (!container) return null;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `settings-choice library-appearance-choice${active ? ' active' : ''}`;
        if (!icon) btn.classList.add('is-text');
        btn.title = title;
        btn.setAttribute('aria-label', title);
        btn.innerHTML = icon ? getIconSvg(icon) : `<span>${label}</span>`;
        btn.addEventListener('click', onClick);
        container.appendChild(btn);
        return btn;
    }

    function renderSettingsToolbar(toolbar, groups, collapsedGroups, onToggle) {
        if (!toolbar) return;
        toolbar.replaceChildren();
        groups.forEach((groupConfig) => {
            const { group, options } = buildSettingsGroup({
                label: groupConfig.label,
                groupKey: groupConfig.key,
                collapsedGroups,
                onToggle
            });
            toolbar.appendChild(group);
            groupConfig.choices.forEach(choice => appendSettingsChoice(options, choice));
        });
    }

    function getLibraryHiddenCategories() {
        const prefs = getUiPreference('libraryHiddenCategories', []);
        return new Set(Array.isArray(prefs) ? prefs.filter(section => LIBRARY_SECTIONS.includes(section)) : []);
    }

    function setLibraryCategoryHidden(section, hidden) {
        section = normalizeLibrarySection(section);
        const next = getLibraryHiddenCategories();
        if (hidden) next.add(section);
        else next.delete(section);
        if (next.size >= LIBRARY_SECTIONS.length) next.delete(section);
        setUiPreference('libraryHiddenCategories', Array.from(next));
        syncLibraryCategoryOrder();
    }

    function getLibraryAppearanceMode(section) {
        return getLibraryAppearanceConfig(section).mode;
    }

    function setLibraryAppearanceOption(section, patch) {
        section = normalizeLibrarySection(section);
        const prefs = getLibraryAppearancePrefs();
        prefs[section] = { ...getLibraryAppearanceConfig(section), ...(patch || {}) };
        setUiPreference('libraryAppearance', prefs);
        renderLibraryViews({ force: true });
    }

    function setLibraryAppearance(section, mode) {
        if (!LIBRARY_APPEARANCE_MODES.includes(mode)) return;
        setLibraryAppearanceOption(section, { mode });
    }

    function moveLibraryCategory(section, delta) {
        const order = getLibraryCategoryOrder();
        const index = order.indexOf(normalizeLibrarySection(section));
        const nextIndex = index + Number(delta || 0);
        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
        const [item] = order.splice(index, 1);
        order.splice(nextIndex, 0, item);
        persistLibraryCategoryOrder(order);
        syncLibraryCategoryOrder();
    }

    function toggleLibraryEditMode() {
        libraryEditMode = !libraryEditMode;
        renderLibraryViews({ force: true });
    }

    function toggleCategoryAppearanceEdit(section) {
        section = normalizeLibrarySection(section);
        if (categoryAppearanceEditModes.has(section)) categoryAppearanceEditModes.delete(section);
        else categoryAppearanceEditModes.add(section);
        renderLibraryViews({ force: true });
    }

    function toggleLibraryTopEditMode() {
        if (typeof searchModeActive !== 'undefined' && searchModeActive && typeof toggleSearchWorkspaceEdit === 'function') {
            libraryEditMode = false;
            syncLibraryCategoryOrder();
            toggleSearchWorkspaceEdit();
            ensureLibraryEditControls();
            return;
        }
        toggleLibraryEditMode();
    }

    function syncLibraryCategoryOrder() {
        const nav = getEl('library-nav-container');
        const library = getEl('library');
        if (!nav) return;
        const hidden = getLibraryHiddenCategories();
        const navEditing = libraryEditMode && !(typeof searchModeActive !== 'undefined' && searchModeActive);
        getLibraryCategoryOrder().forEach(section => {
            const button = getEl(`lib-btn-${section}`);
            if (button) nav.appendChild(button);
        });
        nav.classList.toggle('is-editing', navEditing);
        if (library) library.classList.toggle('library-edit-mode', navEditing);
        nav.querySelectorAll('.library-nav-item').forEach((button) => {
            const section = normalizeLibrarySection(button.dataset.section);
            const isHidden = hidden.has(section);
            button.classList.toggle('is-hidden-category', isHidden);
            button.hidden = isHidden && !navEditing;
            let actions = button.querySelector('.library-nav-edit-actions');
            if (!navEditing) {
                actions?.remove();
                return;
            }
            actions?.remove();
            actions = document.createElement('span');
            actions.className = 'library-nav-edit-actions';
            [
                ['Move earlier', 'up', () => moveLibraryCategory(button.dataset.section, -1)],
                ['Move later', 'down', () => moveLibraryCategory(button.dataset.section, 1)],
                [isHidden ? 'Show category' : 'Hide category', isHidden ? 'open' : 'trash', () => setLibraryCategoryHidden(button.dataset.section, !isHidden)]
            ].forEach(([label, icon, handler]) => {
                const action = document.createElement('button');
                action.type = 'button';
                action.setAttribute('aria-label', label);
                action.innerHTML = getIconSvg(icon);
                action.addEventListener('click', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    handler();
                });
                actions.appendChild(action);
            });
            button.appendChild(actions);
        });
    }

    function ensureLibraryEditControls() {
        const topBar = document.querySelector('#library .top-bar');
        const createBtn = topBar?.querySelector('.library-create-btn');
        if (!topBar || !createBtn) return;
        let editBtn = getEl('library-edit-toggle-btn');
        if (!editBtn) {
            editBtn = document.createElement('button');
            editBtn.id = 'library-edit-toggle-btn';
            editBtn.type = 'button';
            editBtn.className = 'icon-btn library-edit-toggle-btn';
            editBtn.dataset.action = 'toggleLibraryTopEditMode';
            topBar.insertBefore(editBtn, createBtn);
        }
        const searchEditing = typeof searchModeActive !== 'undefined' && searchModeActive && typeof searchWorkspaceEditing !== 'undefined' && searchWorkspaceEditing;
        const isActive = searchEditing || libraryEditMode;
        editBtn.classList.toggle('active', isActive);
        editBtn.title = isActive ? 'Finish editing' : 'Edit library';
        editBtn.setAttribute('aria-label', editBtn.title);
        editBtn.innerHTML = getIconSvg(isActive ? 'source' : 'manage');
    }

    function ensureAppearanceToolbar(section) {
        const screen = getEl(getLibraryScreenId(section));
        const topBar = screen?.querySelector('.top-bar');
        if (!screen || !topBar) return;
        let editBtn = screen.querySelector('.category-appearance-edit-btn');
        if (!editBtn) {
            editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'icon-btn category-appearance-edit-btn';
            editBtn.setAttribute('aria-label', 'Edit view appearance');
            topBar.appendChild(editBtn);
        }
        const isEditing = categoryAppearanceEditModes.has(section);
        editBtn.classList.toggle('active', isEditing);
        editBtn.title = isEditing ? 'Finish view settings' : 'View settings';
        editBtn.setAttribute('aria-label', editBtn.title);
        editBtn.innerHTML = getIconSvg('tune');
        editBtn.onclick = () => toggleCategoryAppearanceEdit(section);
        let toolbar = screen.querySelector('.library-appearance-toolbar');
        if (!isEditing) {
            toolbar?.remove();
            return;
        }
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'settings-choice-toolbar library-appearance-toolbar';
            topBar.insertAdjacentElement('afterend', toolbar);
        }
        const config = getLibraryAppearanceConfig(section);
        const groups = [{
            key: 'view',
            label: 'View',
            choices: LIBRARY_APPEARANCE_MODES.map(mode => ({
                title: `${section} ${mode} view`,
                icon: mode === 'grid' ? 'grid' : mode === 'carousel' ? 'carousel' : 'listMusic',
                active: config.mode === mode,
                onClick: () => setLibraryAppearance(section, mode)
            }))
        }];
        if (['grid', 'carousel'].includes(config.mode)) {
            groups.push({
                key: 'size',
                label: 'Size',
                choices: [
                    ['compact', 'S'],
                    ['large', 'L']
                ].map(([density, label]) => ({
                    label,
                    title: `${section} ${density} cards`,
                    active: config.density === density,
                    onClick: () => setLibraryAppearanceOption(section, { density })
                }))
            });
        }

        if (config.mode === 'grid') {
            groups.push({
                key: 'columns',
                label: 'Columns',
                choices: LIBRARY_GRID_COLUMN_OPTIONS.map(columns => ({
                    label: String(columns),
                    title: `${columns} column${columns === 1 ? '' : 's'}`,
                    active: config.columns === columns,
                    onClick: () => setLibraryAppearanceOption(section, { columns })
                }))
            });
        }

        if (['albums', 'artists', 'playlists'].includes(section)) {
            groups.push({
                key: 'sort',
                label: 'Sort',
                choices: [
                    ['most_played', 'Plays'],
                    ['recent', 'Recent'],
                    ['forgotten', 'Old']
                ].map(([sort, label]) => ({
                    label,
                    title: `${section} sorted by ${label.toLowerCase()}`,
                    active: config.sort === sort,
                    onClick: () => setLibraryAppearanceOption(section, { sort })
                }))
            });
        }

        if (section === 'albums' && config.mode === 'carousel') {
            groups.push({
                key: 'group',
                label: 'Group',
                choices: [{
                    label: 'Artist',
                    title: 'Group albums by artist',
                    active: config.groupByArtist,
                    onClick: () => setLibraryAppearanceOption(section, { groupByArtist: !config.groupByArtist })
                }]
            });
        }

        renderSettingsToolbar(
            toolbar,
            groups,
            config.collapsedGroups,
            (groupKey, collapsed) => setLibraryAppearanceGroupCollapsed(section, groupKey, collapsed)
        );
    }

    function applyLibraryAppearance(section, container) {
        if (!container) return;
        const config = getLibraryAppearanceConfig(section);
        const mode = config.mode;
        container.dataset.appearance = mode;
        container.dataset.density = config.density;
        container.style.setProperty('--library-grid-columns', String(config.columns));
        container.classList.remove(...LIBRARY_COLLECTION_LAYOUT_CLASSES);
        container.classList.add(`library-view-${mode}`);
        container.classList.toggle('library-artist-carousel-groups', section === 'albums' && mode === 'carousel' && config.groupByArtist);
    }

    function getAlbumsGroupedByArtist(albums) {
        const groups = new Map();
        albums.forEach((album) => {
            const artist = getAlbumPrimaryArtistName(album, album.artist) || ARTIST_NAME;
            const key = toArtistKey(artist);
            if (!groups.has(key)) groups.set(key, { artist, albums: [] });
            groups.get(key).albums.push(album);
        });
        return Array.from(groups.values()).sort((a, b) => a.artist.localeCompare(b.artist));
    }

    function renderAlbumArtistCarouselGroups(container, albums, density = 'compact') {
        clearNodeChildren(container);
        appendFragment(container, getAlbumsGroupedByArtist(albums).map((group) => {
            const section = document.createElement('section');
            section.className = 'album-artist-carousel-row';
            const header = document.createElement('button');
            header.type = 'button';
            header.className = 'album-artist-carousel-title zenith-meta-link';
            header.textContent = group.artist;
            header.addEventListener('click', () => routeToArtistProfile(group.artist));
            const rail = document.createElement('div');
            rail.className = 'album-artist-carousel-rail';
            appendFragment(rail, group.albums.map(album => createCollectionTile('album', album, { density, forGrid: true, context: 'library' })));
            section.appendChild(header);
            section.appendChild(rail);
            return section;
        }));
    }

    function renderCollectionLibrarySection({ section, container, sourceItems, getSortedItems, emptyState, kind, limit = 12, renderCustom }) {
        if (!container) return;
        applyLibraryAppearance(section, container);
        clearNodeChildren(container);

        const config = getLibraryAppearanceConfig(section);
        const sortedItems = typeof getSortedItems === 'function'
            ? getSortedItems(config.sort)
            : (Array.isArray(sourceItems) ? sourceItems.slice() : []);
        if (!sortedItems.length) {
            if (typeof renderCustom === 'function' && renderCustom({ container, items: sortedItems, config }) === true) return;
            appendLibraryEmptyState(container, emptyState);
            return;
        }

        if (typeof renderCustom === 'function' && renderCustom({ container, items: sortedItems, config }) === true) return;

        const useCards = ['grid', 'carousel'].includes(config.mode);
        const visibleItems = sortedItems.slice(0, limit);
        appendFragment(container, visibleItems.map((item, idx) => {
            const node = useCards
                ? createCollectionTile(kind, item, { density: config.density, forGrid: true, context: 'library' })
                : createCollectionRow(kind, item, 'library');
            if (!useCards && idx === visibleItems.length - 1) node.style.border = 'none';
            return node;
        }));
    }

    function getLibraryScreenId(tab) {
        return 'library-screen-' + normalizeLibrarySection(tab);
    }

    function getLibrarySectionFromScreen(id) {
        const match = String(id || '').match(/^library-screen-(playlists|albums|artists|songs|genres|folders)$/);
        return match ? match[1] : '';
    }

    function switchLib(tab) {
        tab = normalizeLibrarySection(tab);
        if (typeof searchModeActive !== 'undefined' && searchModeActive && activeId === 'library') {
            if (typeof setSearchFilter === 'function') setSearchFilter(tab);
            return;
        }
        setUiPreference('libraryTab', tab);
        syncLibraryTabSemantics(tab);
        ensureChipVisibility(getEl('lib-btn-' + tab), 'center');
        if (tab === 'songs') syncLibrarySongSortState();
        if (tab === 'folders') renderFolderBrowserView();
        if (typeof exitSearchMode === 'function') exitSearchMode();

        const screenId = getLibraryScreenId(tab);
        if (activeId === screenId) return;
        if (activeId !== 'library' && !getLibrarySectionFromScreen(activeId)) {
            const libraryTab = findTabNavButton('library');
            switchTab('library', libraryTab);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                push(screenId);
                syncLibraryTabSemantics(tab);
            }));
            return;
        }
        push(screenId);
        syncLibraryTabSemantics(tab);
    }
    function appendEmptyMessage(container, message) {
        const box = document.createElement('div');
        box.className = 'home-section-empty';
        box.textContent = message;
        container.appendChild(box);
    }
/* <<< 10-zenith-library-views.js */

/* >>> 10b-zenith-library-songs.js */
/*
 * Auralis JS shard: 10b-zenith-library-songs.js
 * Purpose: library song window, sort, metadata subscriber, artist profile
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */


    function getActiveLibraryTabName() {
        const activeScreenSection = getLibrarySectionFromScreen(activeId);
        if (activeScreenSection) return activeScreenSection;
        const activeButton = document.querySelector('#library-nav-container .library-nav-item.active[id^="lib-btn-"]');
        return activeButton?.dataset?.section || 'playlists';
    }

    function syncLibraryTabSemantics(tab = getActiveLibraryTabName()) {
        tab = normalizeLibrarySection(tab);
        LIBRARY_SECTIONS.forEach((name) => {
            const button = getEl('lib-btn-' + name);
            const screen = getEl(getLibraryScreenId(name));
            const isActive = name === tab;
            if (button) {
                button.classList.toggle('active', isActive);
                if (isActive) button.setAttribute('aria-current', 'page');
                else button.removeAttribute('aria-current');
            }
            if (screen) {
                screen.setAttribute('aria-hidden', String(activeId !== getLibraryScreenId(name)));
            }
        });
    }

    function ensureChipVisibility(button, inline = 'nearest') {
        if (!button || typeof button.scrollIntoView !== 'function') return;
        const row = button.closest('.filter-row, .library-nav-list');
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const isVerticalList = row.classList.contains('library-nav-list');
        const needsScroll = isVerticalList
            ? buttonRect.top < rowRect.top + 12 || buttonRect.bottom > rowRect.bottom - 12
            : buttonRect.left < rowRect.left + 12 || buttonRect.right > rowRect.right - 12;
        if (!needsScroll) return;
        requestAnimationFrame(() => {
            try {
                button.scrollIntoView({ block: 'nearest', inline, behavior: 'smooth' });
            } catch (_) {
                button.scrollIntoView();
            }
        });
    }

    function syncLibrarySongSortState() {
        const row = getEl('lib-songs-sort-row');
        if (!row) return;
        row.setAttribute('role', 'tablist');
        let activeButton = null;
        row.querySelectorAll('.filter-chip').forEach((button) => {
            const isActive = button.dataset.sort === libSongsSortMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(isActive));
            button.setAttribute('tabindex', isActive ? '0' : '-1');
            if (isActive) activeButton = button;
        });
        ensureChipVisibility(activeButton, 'center');
    }

    function appendLibraryPlaylistEmptyState(container) {
        const box = createScreenEmptyState({
            className: 'screen-empty-state library-empty-state',
            title: 'No playlists',
            body: 'Create or import one.',
            iconName: 'listMusic'
        });
        box.querySelector('.screen-empty-title')?.classList.add('library-empty-title');
        box.querySelector('.screen-empty-copy')?.classList.add('library-empty-copy');

        const actions = document.createElement('div');
        actions.className = 'library-empty-actions';

        const createButton = document.createElement('button');
        createButton.type = 'button';
        createButton.className = 'library-empty-action primary';
        createButton.dataset.action = 'openCreatePlaylistDialog';
        createButton.textContent = 'Create Playlist';

        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.className = 'library-empty-action';
        importButton.dataset.action = 'importM3U';
        importButton.textContent = 'Import M3U';

        actions.appendChild(createButton);
        actions.appendChild(importButton);
        box.appendChild(actions);
        container.appendChild(box);
    }

    function appendLibraryEmptyState(container, { title, body, iconName }) {
        const box = createScreenEmptyState({
            className: 'screen-empty-state library-empty-state',
            title,
            body,
            iconName
        });
        box.querySelector('.screen-empty-title')?.classList.add('library-empty-title');
        box.querySelector('.screen-empty-copy')?.classList.add('library-empty-copy');
        container.appendChild(box);
    }

    let libSongsSortMode = 'alpha';
    const LIBRARY_SONG_INITIAL_RENDER = 80;
    const LIBRARY_SONG_RENDER_CHUNK = 120;
    let librarySongRenderToken = 0;
    let librarySongObserver = null;

    function scheduleLibrarySongWork(task) {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(task, { timeout: 160 });
        } else {
            requestAnimationFrame(task);
        }
    }

    function renderLibrarySongWindow(container, tracks) {
        librarySongRenderToken++;
        const token = librarySongRenderToken;
        if (librarySongObserver) {
            librarySongObserver.disconnect();
            librarySongObserver = null;
        }
        clearNodeChildren(container);
        container.dataset.virtualized = tracks.length > LIBRARY_SONG_INITIAL_RENDER ? 'true' : 'false';

        if (!tracks.length) {
            appendLibraryEmptyState(container, {
                title: 'No songs',
                body: 'Add music to fill this view.',
                iconName: 'music'
            });
            return;
        }

        let cursor = 0;
        const status = document.createElement('div');
        status.className = 'library-virtual-status';

        const appendChunk = () => {
            if (token !== librarySongRenderToken) return;
            const oldSentinel = container.querySelector('.library-virtual-sentinel');
            if (oldSentinel) oldSentinel.remove();

            const end = Math.min(
                tracks.length,
                cursor === 0 ? LIBRARY_SONG_INITIAL_RENDER : cursor + LIBRARY_SONG_RENDER_CHUNK
            );
            const frag = document.createDocumentFragment();
            for (let idx = cursor; idx < end; idx++) {
                const row = createLibrarySongRow(tracks[idx], true, {
                    compact: true,
                    hideAlbum: false,
                    showDuration: true,
                    metaContext: 'library'
                });
                if (idx === tracks.length - 1) row.style.border = 'none';
                frag.appendChild(row);
            }
            cursor = end;
            container.appendChild(frag);

            if (tracks.length > LIBRARY_SONG_INITIAL_RENDER) {
                status.textContent = `Showing ${cursor} of ${tracks.length} songs`;
                container.appendChild(status);
            }

            if (cursor < tracks.length) {
                const sentinel = document.createElement('button');
                sentinel.type = 'button';
                sentinel.className = 'library-virtual-sentinel';
                sentinel.textContent = 'Show more songs';
                sentinel.addEventListener('click', () => scheduleLibrarySongWork(appendChunk));
                container.appendChild(sentinel);
                if ('IntersectionObserver' in window) {
                    librarySongObserver = new IntersectionObserver((entries) => {
                        if (entries.some(entry => entry.isIntersecting)) scheduleLibrarySongWork(appendChunk);
                    }, { rootMargin: '600px 0px' });
                    librarySongObserver.observe(sentinel);
                }
            } else if (librarySongObserver) {
                librarySongObserver.disconnect();
                librarySongObserver = null;
            }

            scheduleTitleMotion(container);
        };

        appendChunk();
    }

    function switchLibSongsSort(mode) {
        libSongsSortMode = mode || 'alpha';
        syncLibrarySongSortState();
        const songsList = getEl('lib-songs-list');
        if (!songsList) return;
        renderLibrarySongWindow(songsList, getSortedTracks(libSongsSortMode));
    }

    let _libraryMetadataSubscriberBound = false;
    function bindLibraryMetadataSubscriber() {
        if (_libraryMetadataSubscriberBound) return;
        _libraryMetadataSubscriberBound = true;
        APP_STATE.on('library:metadata-refined', ({ trackKey: refinedTrackKey, previousTrackKey, albumKey: refinedAlbumKey }) => {
            const candidateKeys = [previousTrackKey, refinedTrackKey].filter(Boolean);
            const track = trackByKey.get(refinedTrackKey) || candidateKeys.map((key) => trackByKey.get(key)).find(Boolean);
            if (!track) return;
            const resolvedTrackKey = getTrackIdentityKey(track);

            candidateKeys.forEach((candidateKey) => {
                getTrackUiBindings(candidateKey).forEach((binding) => {
                    if (binding?.row) {
                        binding.row.dataset.trackKey = resolvedTrackKey;
                        binding.row.dataset.trackId = getStableTrackIdentity(track);
                        binding.row.dataset.metadataQuality = getTrackMetadataQuality(track);
                    }
                    if (binding?.click) {
                        binding.click.dataset.trackKey = resolvedTrackKey;
                        binding.click.dataset.trackId = getStableTrackIdentity(track);
                        binding.click.dataset.title = track.title;
                        binding.click.dataset.artist = track.artist;
                        binding.click.dataset.album = track.albumTitle;
                    }
                    const titleTrack = binding?.title?.querySelector('.zenith-title-track');
                    if (titleTrack) titleTrack.textContent = track.title || '';
                    (binding?.durations || []).forEach((timeEl) => {
                        if (!timeEl) return;
                        timeEl.dataset.originalDuration = getTrackDurationDisplay(track);
                        if (!(binding?.row?.classList?.contains('playing-row'))) {
                            timeEl.textContent = timeEl.dataset.originalDuration;
                        }
                    });
                    (binding?.arts || []).forEach((artEl) => applyArtBackground(artEl, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track')));
                    unregisterTrackUi(candidateKey, binding);
                    registerTrackUi(resolvedTrackKey, binding);
                });
            });

            document.querySelectorAll('.media-card[data-album-key], .list-item[data-album-key]').forEach((el) => {
                if (String(el.dataset.albumKey || '') !== String(refinedAlbumKey || '')) return;
                const artTarget = el.querySelector('.media-cover, .item-icon');
                if (artTarget) applyArtBackground(artTarget, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
            });
            scheduleTitleMotion(document);
        });
    }

    // ── Artist Profile Section System ────────────────────────────────────────

    function saveArtistProfileLayout() {
        safeStorage.setJson(STORAGE_KEYS.artistProfileLayout, artistProfileSections);
    }

    function loadArtistProfileLayout() {
        const raw = safeStorage.getJson(STORAGE_KEYS.artistProfileLayout, null);
        if (!Array.isArray(raw) || !raw.length) {
            artistProfileSections = getDefaultArtistProfileSections();
        } else {
            // Merge saved sections with defaults (ensure all core sections exist)
            const defaults = getDefaultArtistProfileSections();
            artistProfileSections = raw.map(s => ({ ...s }));
            defaults.forEach(def => {
                if (!artistProfileSections.find(s => s.id === def.id)) {
                    artistProfileSections.push(def);
                }
            });
        }
    }

    function getArtistSectionItems(section, artistName) {
        const key = toArtistKey(artistName || '');
        const limit = Math.max(1, Number(section.limit || 8));
        let items = [];
        if (section.type === 'artist_top_songs' || section.itemType === 'songs') {
            items = LIBRARY_TRACKS
                .filter(t => toArtistKey(getCanonicalTrackArtistName(t)) === key)
                .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
        } else {
            items = LIBRARY_ALBUMS
                .filter(album => toArtistKey(album.artist) === key)
                .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
        }
        return items.slice(0, limit);
    }

    function updateArtistSection(sectionId, patch) {
        const idx = artistProfileSections.findIndex(s => s.id === sectionId);
        if (idx < 0) return;
        const next = { ...artistProfileSections[idx], ...patch };
        if (next.itemType === 'songs') next.layout = ensureSongLayoutForDensity(next.layout, next.density);
        artistProfileSections[idx] = next;
        saveArtistProfileLayout();
        renderArtistProfileSections(viewedArtistName || activeArtistName);
    }

    function showArtistSectionConfigMenu(sectionId) {
        const section = artistProfileSections.find(s => s.id === sectionId);
        if (!section) return;
        const nextDensity = section.density === 'compact' ? 'large' : 'compact';
        const layoutLabels = { list: 'Track Column', carousel: 'Carousel', grid: 'Poster Grid' };
        const layoutOptions = section.itemType === 'songs'
            ? [{ value: 'list', label: 'Track Column' }, { value: 'carousel', label: 'Carousel' }]
            : [{ value: 'list', label: 'Track Column' }, { value: 'carousel', label: 'Carousel' }, { value: 'grid', label: 'Poster Grid' }];
        const countOptions = [4, 5, 6, 8, 10, 12, 16, 20, 25];

        presentActionSheet(`${section.title} Settings`, 'Artist section controls', [
            {
                label: `Presentation (${layoutLabels[section.layout] || section.layout})`,
                description: 'Switch between list, carousel, and grid.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => {
                    const actions = layoutOptions.map(opt => ({
                        label: opt.label,
                        icon: opt.value === 'carousel' ? 'carousel' : opt.value === 'grid' ? 'grid' : 'stack',
                        onSelect: () => updateArtistSection(sectionId, { layout: opt.value })
                    }));
                    presentActionSheet('Presentation Mode', section.title, actions);
                }
            },
            {
                label: `Item Count (${section.limit})`,
                description: 'How many items to show.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => {
                    const actions = countOptions.map(n => ({
                        label: `${n} items`,
                        icon: 'stack',
                        onSelect: () => updateArtistSection(sectionId, { limit: n })
                    }));
                    presentActionSheet('Item Count', section.title, actions);
                }
            },
            {
                label: `Density: ${section.density} → ${nextDensity}`,
                description: 'Compact boosts scan speed; large emphasises artwork.',
                icon: 'density',
                onSelect: () => {
                    const patch = { density: nextDensity };
                    if (section.itemType === 'songs') patch.layout = ensureSongLayoutForDensity(section.layout, nextDensity);
                    updateArtistSection(sectionId, patch);
                }
            }
        ]);
    }

    function openArtistProfileSectionMenu() {
        const actions = artistProfileSections.map(s => ({
            label: s.title,
            description: `${s.limit} items · ${s.layout} · ${s.density}`,
            icon: 'manage',
            keepOpen: true,
            onSelect: () => showArtistSectionConfigMenu(s.id)
        }));
        presentActionSheet('Artist Page Sections', 'Tap a section to configure it', actions);
    }

    function renderArtistProfileSections(artistName) {
        const root = getEl('artist-sections-root');
        if (!root || !artistName) return;
        clearNodeChildren(root);

        const visible = artistProfileSections.filter(s => s.enabled !== false);
        const blocks = [];
        visible.forEach(section => {
            const items = getArtistSectionItems(section, artistName);
            if (!items.length) return;

            const block = document.createElement('div');
            block.className = 'home-section';
            block.dataset.sectionId = section.id;

            const header = document.createElement('div');
            header.className = 'section-header';
            const left = document.createElement('div');
            left.className = 'section-header-left';
            const titleWrap = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.textContent = section.title;
            titleWrap.appendChild(h2);
            left.appendChild(titleWrap);
            bindLongPressAction(left, () => showArtistSectionConfigMenu(section.id));
            header.appendChild(left);
            block.appendChild(header);
            block.appendChild(createHomeSectionContent(section, items));
            blocks.push(block);
        });
        appendFragment(root, blocks);

        scheduleTitleMotion(root);
    }

    function renderArtistProfileView() {
        const artistScreen = getEl('artist_profile');
        if (!artistScreen) return;
        const fallback = LIBRARY_ARTISTS[0]?.name || ARTIST_NAME;
        const selected = viewedArtistName || activeArtistName || fallback;
        const selectedKey = toArtistKey(selected);
        const fallbackKey = toArtistKey(fallback);
        const artist = artistByKey.get(selectedKey)
            || LIBRARY_ARTISTS.find((entry) => toArtistKey(entry?.name) === selectedKey)
            || artistByKey.get(fallbackKey)
            || LIBRARY_ARTISTS.find((entry) => toArtistKey(entry?.name) === fallbackKey);
        if (!artist) return;
        viewedArtistName = artist.name;

        applyArtBackground(artistScreen.querySelector('.artist-bg'), artist.artUrl, getStableArtworkFallback(artist.name, 'artist'));
        const nameEl = getEl('art-name');
        if (nameEl) {
            nameEl.textContent = artist.name;
            nameEl.title = artist.name;
        }
        const metaEl = getEl('art-meta');
        if (metaEl) {
            const summary = getArtistSummary(artist.name);
            const albumLabel = `${summary.albumCount} album${summary.albumCount === 1 ? '' : 's'}`;
            const trackLabel = `${summary.trackCount} track${summary.trackCount === 1 ? '' : 's'}`;
            metaEl.textContent = `${albumLabel} • ${trackLabel}`;
            metaEl.title = metaEl.textContent;
        }

        renderArtistProfileSections(artist.name);
    }

    function renderSearchBrowseGrid() {
        const grid = getEl('search-cat-grid');
        if (!grid) return;
        clearNodeChildren(grid);
        const cards = getSortedAlbums('recent').slice(0, 8).map((album, idx) => {
            const card = document.createElement('div');
            card.className = 'cat-card';
            card.draggable = true;
            card.dataset.added = String(Math.max(1, 100 - idx));
            card.dataset.plays = String(Number(album.plays || 0));
            card.dataset.duration = String(album.tracks?.[0]?.durationSec || 0);
            card.dataset.albumTitle = album.title;
            applyArtBackground(card, album.artUrl, getStableArtworkFallback(album.title || album.id, 'album'));
            if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, card);
            card.style.border = '1px solid rgba(255,255,255,0.2)';
            card.onclick = () => routeToAlbum(album.title, album.artist, getAlbumSourceIdentity(album));
            bindLongPressAction(card, () => {
                if (typeof openAlbumZenithMenu !== 'function') return;
                const albumMeta = typeof resolveAlbumMeta === 'function' ? resolveAlbumMeta(album.title, album.artist) : album;
                if (albumMeta) openAlbumZenithMenu(albumMeta);
            });
            const span = document.createElement('span');
            span.textContent = album.title;
            span.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
            card.appendChild(span);
            return card;
        });
        appendFragment(grid, cards);
    }
/* <<< 10b-zenith-library-songs.js */

/* >>> 10c-zenith-library-render.js */
/*
 * Auralis JS shard: 10c-zenith-library-render.js
 * Purpose: sidebar playlists, main library render, folder browser, section config
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function renderSidebarPlaylists() {
        const list = getEl('sidebar-playlists-list');
        if (!list) return;
        clearNodeChildren(list);
        const playlists = LIBRARY_PLAYLISTS.slice(0, 10);
        if (!playlists.length) {
            const empty = createScreenEmptyState({
                className: 'screen-empty-state sidebar-empty-state',
                title: 'No playlists yet',
                body: 'Create one, then choose songs from your library.',
                iconName: 'listMusic'
            });
            const actions = document.createElement('div');
            actions.className = 'sidebar-empty-actions';

            const createButton = document.createElement('button');
            createButton.type = 'button';
            createButton.className = 'sidebar-empty-action primary';
            createButton.dataset.action = 'createPlaylistFromSidebar';
            createButton.textContent = 'New Playlist';

            const songsButton = document.createElement('button');
            songsButton.type = 'button';
            songsButton.className = 'sidebar-empty-action';
            songsButton.dataset.action = 'openLibrarySongsFromSidebar';
            songsButton.textContent = 'Browse Songs';

            actions.appendChild(createButton);
            actions.appendChild(songsButton);
            empty.appendChild(actions);
            list.appendChild(empty);
            scheduleTitleMotion(list);
            return;
        }
        appendFragment(list, playlists.map((playlist, idx) => {
            const row = createCollectionRow('playlist', playlist, 'sidebar');
            row.style.padding = '14px 0';
            if (idx === playlists.length - 1) row.style.border = 'none';
            row.querySelector('.item-clickable')?.addEventListener('click', () => closeSidebar(), { once: true });
            return row;
        }));
        scheduleTitleMotion(list);
    }

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

    function openSectionConfig(sectionRef) {
        showSectionConfigMenu(sectionRef);
    }

    window.presentActionSheet = presentActionSheet;
    window.createLibrarySongRow = createLibrarySongRow;
    window.createCollectionRow = createCollectionRow;
    window.createCollectionCard = createCollectionCard;
    window.openAddHomeSection = openAddHomeSection;
    window.openCreateHomeProfile = openCreateHomeProfile;
    window.openArtistProfileSectionMenu = openArtistProfileSectionMenu;
    window.filterHome = filterHome;
    window.switchLib = switchLib;
    window.switchLibSongsSort = switchLibSongsSort;
    window.renderLibraryViews = renderLibraryViews;
    window.renderFolderBrowserView = renderFolderBrowserView;
    window.openSectionConfig = openSectionConfig;

    try {
        loadHomeLayout();
        loadHomeProfiles();
        loadHomeSubtextPrefs();
        loadHomeTitleMode();
        loadEntitySubtextPrefs();
        loadArtistProfileLayout();
    } catch (_) {
        // ignore
    }

    window.addEventListener('resize', () => {
        scheduleNowPlayingMarquee(document);
        scheduleTitleMotion(document);
    });

    window.addEventListener('beforeunload', () => {
        blobUrlCache.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) { /* benign: cleanup */ } });
        blobUrlCache.clear();
        revokeUrlSet(playbackBlobUrls);
        revokeUrlSet(librarySnapshotArtworkUrls);
    });

// ═══════════════════════════════════════════════════════════════════
/* <<< 10c-zenith-library-render.js */

/* >>> 11-events-compat.js */
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
        cancelSearch: () => typeof exitSearchMode === 'function' && exitSearchMode(),
        openTagCreator: () => openTagCreator(),
        closeTagCreator: () => closeTagCreator(),
        createTag: () => createTag(),
        toggleEditMode: () => toggleEditMode(),
        openLibraryCreateMenu: () => openLibraryCreateMenu(),
        toggleLibraryEditMode: () => toggleLibraryEditMode(),
        toggleLibraryTopEditMode: () => toggleLibraryTopEditMode(),
        setLibraryNavLayout: (e, el) => setLibraryNavLayout(el.dataset.mode),
        moveLibraryCategory: (e, el) => moveLibraryCategory(el.dataset.section, Number(el.dataset.delta || 0)),
        setLibraryAppearance: (e, el) => setLibraryAppearance(el.dataset.section, el.dataset.mode),
        openSettingsPanel: (e, el) => openSettingsPanel(el.dataset.settingsPanel),
        openSettingsRoot: () => openSettingsRoot(),
        openAddHomeSection: () => openAddHomeSection(),
        openCreateHomeProfile: () => openCreateHomeProfile(),
        openSectionConfig: (e, el) => openSectionConfig(el.dataset.section || el.textContent),
        toggleSearchFilter: (e, el) => toggleSearchFilter(el),
        toggleSearchTag: (e, el) => toggleSearchTag(el, el.dataset.tag),
        switchLib: (e, el) => switchLib(el.dataset.section),
        switchLibSongsSort: (e, el) => switchLibSongsSort(el.dataset.sort),
        filterHome: (e, el) => filterHome(el.dataset.filter),
        undoLastAction: () => runActiveUndoAction(),
        toast: (e, el) => toast(el.dataset.message),
        openPlaceholder: (e, el) => {
            if ((el.dataset.placeholderTitle || '').toLowerCase() === 'speaker sync') {
                openSpeakerSyncPanel();
                return;
            }
            openPlaceholderScreen(
                el.dataset.placeholderTitle || el.dataset.message || 'Placeholder',
                el.dataset.placeholderBody || 'This part of the app does not have working logic yet.'
            );
        },

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
        toggleSelfActive: (e, el) => {
            const isActive = el.classList.toggle('active');
            el.setAttribute('aria-checked', String(isActive));
        },
        toggleSetting: (e, el) => toggleSettingsPreference(el.dataset.setting),
        closeAlbumArtViewer: () => closeAlbumArtViewer(),
        closeImageViewerSelf: (e, el) => { if (e.target === el) closeAlbumArtViewer(); },
        openAlbumMetaZenithMenu: () => openAlbumZenithMenu(resolveAlbumMeta(activeAlbumTitle, activeAlbumArtist) || LIBRARY_ALBUMS[0]),
        openArtistProfileSectionMenu: () => { if (typeof openArtistProfileSectionMenu === 'function') openArtistProfileSectionMenu(); },
        openPlaylistZenithMenu: () => { if (typeof openPlaylistZenithMenu === 'function') openPlaylistZenithMenu(); },
        openAddSongsToPlaylist: () => { if (typeof openAddSongsToPlaylist === 'function') openAddSongsToPlaylist(); },
        closeAddSongsToPlaylist: () => { if (typeof closeAddSongsToPlaylist === 'function') closeAddSongsToPlaylist(); },
        openSpeakerSyncPanel: () => { if (typeof openSpeakerSyncPanel === 'function') openSpeakerSyncPanel(); },

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
        createPlaylistFromSidebar: () => createPlaylistFromSidebar(),
        openLibrarySongsFromSidebar: () => openLibrarySongsFromSidebar(),
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
                shuffleMode: false,
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
    window.Auralis = window.Auralis || {};
    window.AuralisDiagnostics = AuralisDiagnostics;
    window.AuralisStrings = AuralisStrings;
    window.Auralis.diagnostics = AuralisDiagnostics;
    window.Auralis.__runVerification = function runRuntimeVerification() {
        const renderedNodes = typeof document === 'undefined'
            ? 0
            : document.querySelectorAll('*').length;
        return {
            ok: true,
            revision: Date.now(),
            renderedNodes,
            diagnostics: AuralisDiagnostics.snapshot(),
            stringsAvailable: Boolean(AuralisStrings.verificationReady)
        };
    };

    window.AuralisApp = {
        navigate: push,
        back: pop,
        switchTab: switchTab,
        switchLib: switchLib,
        toggleOverlay: toggleOverlay,
        playTrack: playTrack,
        playAlbumInOrder: playAlbumInOrder,
        togglePlayback: togglePlayback,
        playNext: playNext,
        playPrevious: playPrevious,
        renderQueue: renderQueue,
        toast: toast,
        undoLastAction: runActiveUndoAction,
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
        removeTrackFromUserPlaylist: removeTrackFromUserPlaylist,
        routeToPlaylistDetail: routeToPlaylistDetail,
        getQueueSnapshot: () => ({
            tracks: queueTracks.map((track) => serializeTrackForPlaybackState(track)).filter(Boolean),
            index: queueIndex
        }),
        generateSmartPlaylist: generateSmartPlaylist,
        toggleLyrics: toggleLyrics,
        toggleCrossfade: toggleCrossfade,
        toggleReplayGain: toggleReplayGain,
        // Testing / diagnostic hooks
        _installLibrarySnapshot: installLibrarySnapshot,
        _getLibrary: () => ({ albums: LIBRARY_ALBUMS, tracks: LIBRARY_TRACKS, artists: LIBRARY_ARTISTS, playlists: LIBRARY_PLAYLISTS }),
        _resolveAlbumMeta: (title, artist = '') => resolveAlbumMeta(title, artist),
        _exportBackendPayload: exportBackendPayload,
        _applyBackendPayload: applyBackendPayload,
        _syncCanonicalBackend: () => syncCanonicalLibraryBackend('manual'),
        _hydrateCanonicalBackendCache: () => hydrateCanonicalLibraryBackendCache('manual'),
        _getCanonicalBackendSummary: () => getCanonicalLibraryBackendSummary(),
        _getCanonicalBackendCacheSummary: () => getCanonicalLibraryBackendCacheSummary()
    };

})();
/* <<< 11-events-compat.js */

/* >>> 12-metadata-editor.js */
    // ─────────────────────────────────────────────────────────────────────────
    // 12 — Metadata Editor (inline tag editing without leaving the app)
    // ─────────────────────────────────────────────────────────────────────────

    // State private to this module
    let _metaEditorTrack  = null;
    let _metaEditorAlbum  = null;
    let _metaEditorMode   = 'track';   // 'track' | 'album'
    let _metaEditorOrigKey = '';       // trackKey at the moment the editor opened

    function _showMetadataEditor() {
        const scrim  = getEl('metadata-editor-scrim');
        const panel  = getEl('metadata-editor');
        if (!scrim || !panel) return;
        scrim.classList.add('show');
        panel.classList.add('show');
        // Trap focus inside the panel after the animation settles
        setTimeout(() => {
            const first = panel.querySelector('input, button');
            if (first) first.focus();
        }, 320);
    }

    function closeMetadataEditor() {
        const scrim = getEl('metadata-editor-scrim');
        const panel = getEl('metadata-editor');
        if (scrim) scrim.classList.remove('show');
        if (panel) panel.classList.remove('show');
        _metaEditorTrack   = null;
        _metaEditorAlbum   = null;
        _metaEditorOrigKey = '';
    }

    function _fillForm(fields) {
        const ids = ['title','artist','album-artist','album','year','genre'];
        const vals = [fields.title, fields.artist, fields.albumArtist, fields.album, fields.year, fields.genre];
        ids.forEach((id, i) => {
            const el = getEl('meta-edit-' + id);
            if (el) el.value = (vals[i] != null) ? String(vals[i]) : '';
        });
    }

    // Open the editor pre-filled from a single track.
    function openTrackMetadataEditor(track) {
        if (!track) return;
        _metaEditorMode    = 'track';
        _metaEditorTrack   = track;
        _metaEditorAlbum   = null;
        _metaEditorOrigKey = getTrackMetadataOverrideKey(track);

        const heading = getEl('metadata-editor-heading');
        if (heading) heading.textContent = 'Edit Track Info';

        _fillForm({
            title:       track.title,
            artist:      track.artist,
            albumArtist: track.albumArtist || '',
            album:       track.albumTitle,
            year:        track.year,
            genre:       track.genre
        });

        _showMetadataEditor();
    }

    // Open the editor for an entire album (edits apply to all its tracks).
    function openAlbumMetadataEditor(album) {
        if (!album) return;
        _metaEditorMode    = 'album';
        _metaEditorAlbum   = album;
        _metaEditorTrack   = null;
        _metaEditorOrigKey = '';

        const heading = getEl('metadata-editor-heading');
        if (heading) heading.textContent = 'Edit Album Info';

        _fillForm({
            title:       album.title,
            artist:      album.artist,
            albumArtist: album.albumArtist || album.artist || '',
            album:       album.title,
            year:        album.year,
            genre:       album.genre
        });

        _showMetadataEditor();
    }

    // Read back the form values.
    function _readForm() {
        return {
            title:       String(getEl('meta-edit-title')?.value       || '').trim(),
            artist:      String(getEl('meta-edit-artist')?.value      || '').trim(),
            albumArtist: String(getEl('meta-edit-album-artist')?.value|| '').trim(),
            album:       String(getEl('meta-edit-album')?.value       || '').trim(),
            year:        String(getEl('meta-edit-year')?.value        || '').trim(),
            genre:       String(getEl('meta-edit-genre')?.value       || '').trim()
        };
    }

    function saveMetadataEdits() {
        const fields = _readForm();

        if (_metaEditorMode === 'track' && _metaEditorTrack) {
            const track = _metaEditorTrack;

            // Persist the override for future library loads
            saveMetadataOverride(_metaEditorOrigKey, fields, track);

            // Update the live track object so the current session also sees the change
            if (fields.title)       track.title       = fields.title;
            if (fields.artist)      track.artist      = fields.artist;
            if (fields.albumArtist !== undefined) track.albumArtist = fields.albumArtist;
            if (fields.album)       track.albumTitle  = fields.album;
            if (fields.year)        track.year        = fields.year;
            if (fields.genre)       track.genre       = fields.genre;

        } else if (_metaEditorMode === 'album' && _metaEditorAlbum) {
            const album = _metaEditorAlbum;

            // Apply changes to every track in the album
            (Array.isArray(album.tracks) ? album.tracks : []).forEach((track) => {
                const origKey = getTrackMetadataOverrideKey(track);

                // Only override fields the user may have changed at album level:
                // title / albumArtist / year / genre.  Preserve per-track artist.
                const albumFields = {
                    albumArtist: fields.albumArtist,
                    album:       fields.title || album.title,
                    year:        fields.year,
                    genre:       fields.genre
                };
                saveMetadataOverride(origKey, albumFields, track);
                applyMetadataOverride(track);
            });

            // Update the album object itself
            if (fields.title)       album.title       = fields.title;
            if (fields.albumArtist) album.albumArtist = fields.albumArtist;
            if (fields.year)        album.year        = fields.year;
            if (fields.genre)       album.genre       = fields.genre;
        }

        closeMetadataEditor();

        // Re-index and re-render so the library reflects the changes immediately.
        // installLibrarySnapshot will call buildLibrarySnapshotIndexes which applies
        // all metadata overrides before creating the index.
        if (typeof installLibrarySnapshot === 'function') {
            installLibrarySnapshot(LIBRARY_ALBUMS, { renderLibrary: true, renderHome: true, force: true });
        }

        // Brief confirmation toast if available
        if (typeof showToast === 'function') {
            showToast('Tags updated', 'info');
        } else {
            // Fallback: flash the save button text
            const btn = document.querySelector('[data-action="saveMetadataEdits"]');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = 'Saved!';
                setTimeout(() => { btn.textContent = orig; }, 1500);
            }
        }
    }
/* <<< 12-metadata-editor.js */

/* >>> 13-m3u-io.js */
    // ─────────────────────────────────────────────────────────────────────────
    // 13 — M3U Playlist Import / Export
    // ─────────────────────────────────────────────────────────────────────────

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Parse an M3U/M3U8 text blob into an array of entry objects.
    // Each entry: { title, artist, duration, rawPath }
    function parseM3UContent(text) {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        const entries = [];
        let pending = { title: '', artist: '', duration: 0 };

        for (const raw of lines) {
            const line = raw.trim();
            if (!line || line === '#EXTM3U') continue;

            if (line.startsWith('#EXTINF:')) {
                // #EXTINF:<duration>,<artist - title>  OR  #EXTINF:<duration>,<title>
                const rest = line.slice(8); // after "#EXTINF:"
                const commaIdx = rest.indexOf(',');
                pending.duration = commaIdx > -1 ? parseInt(rest.slice(0, commaIdx), 10) || 0 : 0;
                const label = commaIdx > -1 ? rest.slice(commaIdx + 1).trim() : '';
                const dashIdx = label.indexOf(' - ');
                if (dashIdx > -1) {
                    pending.artist = label.slice(0, dashIdx).trim();
                    pending.title  = label.slice(dashIdx + 3).trim();
                } else {
                    pending.artist = '';
                    pending.title  = label;
                }
            } else if (!line.startsWith('#')) {
                // This is a path/URL line
                entries.push({
                    title:    pending.title,
                    artist:   pending.artist,
                    duration: pending.duration,
                    rawPath:  line
                });
                pending = { title: '', artist: '', duration: 0 };
            }
        }
        return entries;
    }

    // Build M3U text from an array of tracks.
    function _buildM3UText(tracks) {
        const lines = ['#EXTM3U', ''];
        for (const track of tracks) {
            const durationSec = Math.round(Number(track.durationSec || 0)) || -1;
            const artist      = String(track.artist || '').trim();
            const title       = String(track.title  || '').trim();
            const label       = (artist && title) ? `${artist} - ${title}` : (title || artist || 'Unknown');
            const path        = String(track.path   || track.fileUrl || '').trim() || track.title || '';
            lines.push(`#EXTINF:${durationSec},${label}`);
            lines.push(path);
        }
        return lines.join('\n');
    }

    // Trigger a file download in the browser.
    function _downloadText(filename, text) {
        const blob = new Blob([text], { type: 'audio/x-mpegurl; charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    // Sanitise a string for use as a filename (remove special chars, collapse spaces).
    function _safeFilename(name) {
        return String(name || 'playlist')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100) || 'playlist';
    }

    // ── Export ────────────────────────────────────────────────────────────────

    // Export a user playlist as an M3U file download.
    function exportPlaylistAsM3U(playlist) {
        if (!playlist) return;
        const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
        if (!tracks.length) {
            if (typeof showToast === 'function') showToast('Playlist is empty', 'warn');
            return;
        }
        const m3u = _buildM3UText(tracks);
        _downloadText(_safeFilename(playlist.name) + '.m3u', m3u);
    }

    // Export the current playback queue as an M3U file download.
    function exportQueueAsM3U() {
        const queue = Array.isArray(window.PLAYBACK_QUEUE) ? window.PLAYBACK_QUEUE
                    : (typeof getPlaybackQueue === 'function' ? getPlaybackQueue() : []);
        if (!queue || !queue.length) {
            if (typeof showToast === 'function') showToast('Queue is empty', 'warn');
            return;
        }
        const m3u = _buildM3UText(queue);
        _downloadText('queue.m3u', m3u);
    }

    // ── Import ────────────────────────────────────────────────────────────────

    // Try to match an M3U entry against the live library.
    // Strategy (in order):
    //   1. Exact title + artist match
    //   2. Title-only match (artist may be spelled differently)
    //   3. Filename match against track.path (basename)
    function _matchEntry(entry) {
        const normTitle  = String(entry.title  || '').toLowerCase().trim();
        const normArtist = String(entry.artist || '').toLowerCase().trim();
        const rawBasename = (entry.rawPath || '').split(/[/\\]/).pop().replace(/\.[^.]+$/, '').toLowerCase().trim();
        const tracks = Array.isArray(LIBRARY_TRACKS) ? LIBRARY_TRACKS : [];

        // 1. Exact title + artist
        if (normTitle && normArtist) {
            const exact = tracks.find((t) =>
                String(t.title  || '').toLowerCase().trim() === normTitle &&
                String(t.artist || '').toLowerCase().trim() === normArtist
            );
            if (exact) return exact;
        }

        // 2. Title-only
        if (normTitle) {
            const byTitle = tracks.find((t) =>
                String(t.title || '').toLowerCase().trim() === normTitle
            );
            if (byTitle) return byTitle;
        }

        // 3. Path basename
        if (rawBasename) {
            const byPath = tracks.find((t) => {
                const tBase = String(t.path || t.title || '').split(/[/\\]/).pop()
                    .replace(/\.[^.]+$/, '').toLowerCase().trim();
                return tBase && tBase === rawBasename;
            });
            if (byPath) return byPath;
        }

        return null;
    }

    // Open a file-picker and import an M3U/M3U8 playlist into the library.
    async function importM3UFile() {
        let fileHandle;
        try {
            if (typeof window.showOpenFilePicker === 'function') {
                const [handle] = await window.showOpenFilePicker({
                    types: [{ description: 'M3U Playlist', accept: { 'audio/x-mpegurl': ['.m3u', '.m3u8'] } }],
                    multiple: false
                });
                fileHandle = await handle.getFile();
            } else {
                // Fallback: hidden <input type="file">
                fileHandle = await new Promise((resolve, reject) => {
                    const input = document.createElement('input');
                    input.type   = 'file';
                    input.accept = '.m3u,.m3u8,audio/x-mpegurl,audio/mpegurl';
                    input.style.display = 'none';
                    document.body.appendChild(input);
                    input.addEventListener('change', () => {
                        document.body.removeChild(input);
                        if (input.files && input.files[0]) resolve(input.files[0]);
                        else reject(new Error('No file selected'));
                    });
                    input.addEventListener('cancel', () => {
                        document.body.removeChild(input);
                        reject(new Error('Cancelled'));
                    });
                    input.click();
                });
            }
        } catch (err) {
            if (err && err.message !== 'Cancelled') {
                console.warn('[M3U Import] File pick cancelled or failed:', err);
            }
            return;
        }

        let text;
        try {
            text = await fileHandle.text();
        } catch (err) {
            console.error('[M3U Import] Could not read file:', err);
            if (typeof showToast === 'function') showToast('Could not read file', 'error');
            return;
        }

        const entries = parseM3UContent(text);
        if (!entries.length) {
            if (typeof showToast === 'function') showToast('No tracks found in M3U file', 'warn');
            return;
        }

        // Derive playlist name from file name
        const rawFilename = String(fileHandle.name || 'Imported Playlist');
        const playlistName = rawFilename.replace(/\.m3u8?$/i, '').replace(/_/g, ' ').trim() || 'Imported Playlist';

        const createdPlaylist = typeof createUserPlaylist === 'function'
            ? createUserPlaylist(playlistName)
            : null;
        const playlistId = typeof createdPlaylist === 'string'
            ? createdPlaylist
            : createdPlaylist?.id || null;

        let matched   = 0;
        let unmatched = 0;

        for (const entry of entries) {
            const track = _matchEntry(entry);
            if (track && playlistId !== null && typeof addTrackToUserPlaylist === 'function') {
                addTrackToUserPlaylist(playlistId, track);
                matched++;
            } else {
                unmatched++;
            }
        }

        // Refresh library UI
        if (typeof renderLibraryViews === 'function') {
            renderLibraryViews({ forceRender: true });
        }

        const msg = unmatched === 0
            ? `Imported "${playlistName}" — ${matched} tracks`
            : `Imported "${playlistName}" — ${matched} matched, ${unmatched} not in library`;

        if (typeof showToast === 'function') {
            showToast(msg, 'info');
        } else {
            console.info('[M3U Import]', msg);
        }
    }
/* <<< 13-m3u-io.js */

/* >>> 14-backend-integration.js */
(function () {
    'use strict';

    const BACKEND_STORAGE_KEYS = Object.freeze({
        auth: 'auralis_backend_auth_v1',
        autoSync: 'auralis_backend_auto_sync_v1',
        deviceId: 'auralis_backend_device_id_v1',
        syncMeta: 'auralis_backend_sync_meta_v1'
    });

    const backendState = {
        auth: loadJson(BACKEND_STORAGE_KEYS.auth, null),
        autoSync: localStorage.getItem(BACKEND_STORAGE_KEYS.autoSync) !== '0',
        syncMeta: loadJson(BACKEND_STORAGE_KEYS.syncMeta, {}),
        syncTimerId: 0,
        syncing: false,
        lastFingerprint: '',
        metrics: null,
        sessions: []
    };

    function loadJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function saveJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getDeviceId() {
        let deviceId = localStorage.getItem(BACKEND_STORAGE_KEYS.deviceId);
        if (!deviceId) {
            deviceId = `device_${Math.random().toString(36).slice(2, 12)}`;
            localStorage.setItem(BACKEND_STORAGE_KEYS.deviceId, deviceId);
        }
        return deviceId;
    }

    function getDeviceName() {
        const platform = navigator.userAgentData?.platform || navigator.platform || 'Browser';
        return `Auralis ${platform}`.trim();
    }

    function backendToast(message) {
        if (typeof window.toast === 'function') {
            window.toast(message);
            return;
        }
        if (typeof toast === 'function') {
            toast(message);
            return;
        }
        if (window.AuralisApp?.toast) window.AuralisApp.toast(message);
    }

    function getEl(id) {
        return document.getElementById(id);
    }

    function setBackendStatus(text, tone = 'muted') {
        const el = getEl('backend-status');
        if (!el) return;
        el.textContent = text;
        el.dataset.tone = tone;
        const colors = {
            muted: 'var(--text-secondary)',
            danger: 'var(--sys-error)',
            success: 'var(--sys-success)',
            warning: 'var(--sys-warning)'
        };
        el.style.color = colors[tone] || colors.muted;
    }

    function getAuthHeaders(includeJson = false) {
        const headers = {};
        if (backendState.auth?.token) headers.Authorization = `Bearer ${backendState.auth.token}`;
        if (includeJson) headers['Content-Type'] = 'application/json';
        return headers;
    }

    async function backendFetch(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {
                ...getAuthHeaders(options.body != null),
                ...(options.headers || {})
            }
        });

        const contentType = response.headers.get('content-type') || '';
        const body = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            const error = new Error(body?.error || response.statusText || 'Request failed');
            error.status = response.status;
            error.payload = body;
            throw error;
        }

        return body;
    }

    function persistAuth(auth) {
        backendState.auth = auth;
        if (auth) saveJson(BACKEND_STORAGE_KEYS.auth, auth);
        else localStorage.removeItem(BACKEND_STORAGE_KEYS.auth);
        renderBackendAuth();
        scheduleBackendSync();
    }

    function persistSyncMeta(sync) {
        backendState.syncMeta = {
            userStateEtag: sync?.userState?.etag || backendState.syncMeta.userStateEtag || '',
            librarySnapshotEtag: sync?.librarySnapshot?.etag || backendState.syncMeta.librarySnapshotEtag || ''
        };
        saveJson(BACKEND_STORAGE_KEYS.syncMeta, backendState.syncMeta);
    }

    function exportBackendPayload() {
        const payload = window.AuralisApp?._exportBackendPayload?.();
        if (!payload) return null;
        if (payload.playbackSession) {
            payload.playbackSession.deviceId = getDeviceId();
            payload.playbackSession.deviceName = getDeviceName();
        }
        return payload;
    }

    function fingerprintPayload(payload) {
        if (!payload) return '';
        const playback = payload.playbackSession || {};
        return JSON.stringify({
            userState: payload.userState || {},
            librarySignature: [
                payload.librarySnapshot?.albums?.length || 0,
                payload.librarySnapshot?.tracks?.length || 0,
                payload.librarySnapshot?.artists?.length || 0
            ],
            playbackSession: {
                nowPlaying: playback.nowPlaying ? [playback.nowPlaying.title, playback.nowPlaying.artist, playback.nowPlaying.albumTitle] : null,
                queueLength: playback.queue?.length || 0,
                queueIndex: playback.queueIndex || 0,
                repeatMode: playback.repeatMode || 'off',
                shuffleMode: false,
                isPlaying: Boolean(playback.isPlaying),
                positionBucket: Math.floor(Number(playback.positionMs || 0) / 5000)
            }
        });
    }

    function applyRemoteSync(sync) {
        if (!sync) return;
        persistSyncMeta(sync);
        window.AuralisApp?._applyBackendPayload?.({
            userState: sync.userState?.payload,
            librarySnapshot: sync.librarySnapshot?.payload,
            playbackSession: sync.playbackSessions?.[0]?.payload || null
        });
        backendState.sessions = Array.isArray(sync.playbackSessions) ? sync.playbackSessions : [];
        renderBackendSessions();
    }

    async function backendPullRemote(options = {}) {
        if (!backendState.auth?.token) return;
        setBackendStatus('Pulling remote state…');
        const result = await backendFetch('/api/sync/full');
        applyRemoteSync(result.sync);
        if (!options.silent) {
            setBackendStatus(`Remote state loaded at ${new Date().toLocaleTimeString()}`, 'success');
            backendToast('Remote library state applied');
        }
    }

    async function backendSyncNow(options = {}) {
        if (!backendState.auth?.token || backendState.syncing) return;
        const payload = exportBackendPayload();
        if (!payload) return;

        const fingerprint = fingerprintPayload(payload);
        if (!options.force && options.silent && fingerprint === backendState.lastFingerprint) {
            return;
        }

        backendState.syncing = true;
        setBackendStatus(options.silent ? 'Background sync running…' : 'Syncing backend…');
        try {
            const result = await backendFetch('/api/sync/full', {
                method: 'PUT',
                body: JSON.stringify({
                    userState: {
                        ifMatch: backendState.syncMeta.userStateEtag || '*',
                        payload: payload.userState
                    },
                    librarySnapshot: {
                        ifMatch: backendState.syncMeta.librarySnapshotEtag || '*',
                        payload: payload.librarySnapshot
                    },
                    playbackSession: {
                        payload: payload.playbackSession
                    }
                })
            });
            backendState.lastFingerprint = fingerprint;
            applyRemoteSync(result.sync);
            setBackendStatus(`Synced at ${new Date().toLocaleTimeString()}`, 'success');
            if (!options.silent) backendToast('Backend sync complete');
        } catch (error) {
            if (error.status === 409 && error.payload?.sync) {
                applyRemoteSync(error.payload.sync);
                backendState.lastFingerprint = fingerprintPayload(exportBackendPayload());
                setBackendStatus('Conflict detected. Remote state was applied.', 'warning');
                backendToast('Backend conflict resolved using remote state');
            } else {
                setBackendStatus(error.message || 'Backend sync failed', 'danger');
                if (!options.silent) backendToast(error.message || 'Backend sync failed');
            }
        } finally {
            backendState.syncing = false;
        }
    }

    async function backendRefreshSessions() {
        if (!backendState.auth?.token) return;
        const result = await backendFetch('/api/playback/sessions');
        backendState.sessions = Array.isArray(result.sessions) ? result.sessions : [];
        renderBackendSessions();
    }

    async function backendRefreshMetrics() {
        const [metrics, audit] = await Promise.all([
            backendFetch('/api/metrics'),
            backendState.auth?.token ? backendFetch('/api/audit?limit=8') : Promise.resolve({ entries: [] })
        ]);
        backendState.metrics = metrics;
        renderBackendMetrics(audit.entries || []);
    }

    async function backendRegister() {
        const email = String(getEl('backend-email')?.value || '').trim();
        const password = String(getEl('backend-password')?.value || '');
        const displayName = String(getEl('backend-display-name')?.value || '').trim();
        const result = await backendFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                displayName,
                deviceId: getDeviceId()
            })
        });
        persistAuth(result);
        setBackendStatus(`Signed in as ${result.user.displayName}`, 'success');
        await backendPullRemote({ silent: true });
        await backendSyncNow({ force: true, silent: true });
        await backendRefreshMetrics();
        backendToast('Backend account created');
    }

    async function backendLogin() {
        const email = String(getEl('backend-email')?.value || '').trim();
        const password = String(getEl('backend-password')?.value || '');
        const result = await backendFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                deviceId: getDeviceId()
            })
        });
        persistAuth(result);
        setBackendStatus(`Signed in as ${result.user.displayName}`, 'success');
        await backendPullRemote({ silent: true });
        await backendSyncNow({ force: true, silent: true });
        await backendRefreshMetrics();
        backendToast('Signed into backend');
    }

    async function backendLogout() {
        if (backendState.auth?.token) {
            await backendFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        }
        persistAuth(null);
        backendState.sessions = [];
        backendState.syncMeta = {};
        backendState.lastFingerprint = '';
        localStorage.removeItem(BACKEND_STORAGE_KEYS.syncMeta);
        renderBackendSessions();
        setBackendStatus('Signed out of backend');
        backendToast('Backend session cleared');
    }

    function renderBackendAuth() {
        const status = getEl('backend-account-status');
        const authOnly = document.querySelectorAll('[data-backend-auth]');
        const guestOnly = document.querySelectorAll('[data-backend-guest]');

        if (status) {
            status.textContent = backendState.auth?.user
                ? `${backendState.auth.user.displayName} (${backendState.auth.user.email})`
                : 'Not connected';
        }

        authOnly.forEach((el) => {
            el.style.display = backendState.auth?.token ? '' : 'none';
        });

        guestOnly.forEach((el) => {
            el.style.display = backendState.auth?.token ? 'none' : '';
        });

        const checkbox = getEl('backend-auto-sync');
        if (checkbox) checkbox.checked = backendState.autoSync;
    }

    function renderBackendSessions() {
        const list = getEl('backend-session-list');
        if (!list) return;
        if (!backendState.sessions.length) {
            list.innerHTML = '<div style="color:var(--text-tertiary); font-size:13px;">No active sessions published yet.</div>';
            return;
        }
        list.innerHTML = backendState.sessions.map((session) => {
            const nowPlaying = session.payload?.nowPlaying;
            const line = nowPlaying
                ? `${nowPlaying.title || 'Unknown Track'} · ${nowPlaying.artist || 'Unknown Artist'}`
                : 'Idle';
            return (
                `<div class="list-item" style="padding:12px 0; border-color:var(--border-default);">` +
                    `<div class="item-content">` +
                        `<h3 style="margin-bottom:4px;">${escapeHtml(session.deviceName || session.payload?.deviceName || 'Auralis Device')}</h3>` +
                        `<span>${escapeHtml(line)}</span>` +
                        `<span style="display:block; margin-top:4px; color:var(--text-tertiary); font-size:11px;">Updated ${escapeHtml(new Date(session.updatedAt || Date.now()).toLocaleTimeString())}</span>` +
                    `</div>` +
                `</div>`
            );
        }).join('');
    }

    function renderBackendMetrics(auditEntries = []) {
        const summary = getEl('backend-metrics-summary');
        const audit = getEl('backend-audit-log');
        if (summary) {
            if (!backendState.metrics) {
                summary.innerHTML = '<span style="color:var(--text-tertiary);">Metrics unavailable.</span>';
            } else {
                const counts = backendState.metrics.counts || {};
                summary.innerHTML =
                    `<div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">` +
                        `<div class="card" style="padding:12px;"><strong>${counts.users || 0}</strong><div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Users</div></div>` +
                        `<div class="card" style="padding:12px;"><strong>${counts.librarySnapshots || 0}</strong><div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Libraries</div></div>` +
                        `<div class="card" style="padding:12px;"><strong>${counts.playbackSessions || 0}</strong><div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Sessions</div></div>` +
                        `<div class="card" style="padding:12px;"><strong>${counts.auditLogs || 0}</strong><div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Audit Logs</div></div>` +
                    `</div>`;
            }
        }
        if (audit) {
            if (!auditEntries.length) {
                audit.innerHTML = '<div style="color:var(--text-tertiary); font-size:13px;">No audit events yet.</div>';
            } else {
                audit.innerHTML = auditEntries.map((entry) => (
                    `<div style="padding:8px 0; border-bottom:1px solid var(--border-default);">` +
                        `<div style="font-size:12px; font-weight:700; color:var(--text-primary);">${escapeHtml(entry.kind)}</div>` +
                        `<div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">${escapeHtml(new Date(entry.createdAt).toLocaleString())}</div>` +
                    `</div>`
                )).join('');
            }
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function scheduleBackendSync() {
        if (backendState.syncTimerId) {
            clearInterval(backendState.syncTimerId);
            backendState.syncTimerId = 0;
        }
        if (!backendState.auth?.token || !backendState.autoSync) return;
        backendState.syncTimerId = window.setInterval(() => {
            void backendSyncNow({ silent: true });
        }, 15000);
    }

    function bindBackendUi() {
        const autoSync = getEl('backend-auto-sync');
        if (autoSync) {
            autoSync.addEventListener('change', () => {
                backendState.autoSync = Boolean(autoSync.checked);
                localStorage.setItem(BACKEND_STORAGE_KEYS.autoSync, backendState.autoSync ? '1' : '0');
                scheduleBackendSync();
            });
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && backendState.auth?.token) {
                void backendPullRemote({ silent: true }).catch(() => {});
                void backendRefreshSessions().catch(() => {});
            }
        });

        window.addEventListener('beforeunload', () => {
            if (backendState.auth?.token) {
                void backendSyncNow({ silent: true, force: true });
            }
        });
    }

    async function initBackendIntegration() {
        renderBackendAuth();
        renderBackendSessions();
        bindBackendUi();

        if (window.location.protocol === 'file:') {
            setBackendStatus('Backend unavailable (file:// origin)', 'muted');
            return;
        }

        if (backendState.auth?.token) {
            try {
                const session = await backendFetch('/api/auth/session');
                backendState.auth.user = session.user;
                persistAuth(backendState.auth);
                await backendPullRemote({ silent: true });
                await backendRefreshSessions();
                await backendRefreshMetrics();
                scheduleBackendSync();
                setBackendStatus(`Connected as ${session.user.displayName}`, 'success');
            } catch (_) {
                persistAuth(null);
                setBackendStatus('Saved backend session expired', 'warning');
            }
        } else {
            setBackendStatus('Backend ready. Sign in to sync.', 'muted');
            await backendRefreshMetrics().catch(() => {});
        }
    }

    window.backendRegister = () => void backendRegister().catch((error) => {
        setBackendStatus(error.message || 'Registration failed', 'danger');
        backendToast(error.message || 'Registration failed');
    });
    window.backendLogin = () => void backendLogin().catch((error) => {
        setBackendStatus(error.message || 'Login failed', 'danger');
        backendToast(error.message || 'Login failed');
    });
    window.backendLogout = () => void backendLogout().catch((error) => {
        setBackendStatus(error.message || 'Logout failed', 'danger');
    });
    window.backendSyncNow = () => void backendSyncNow({ force: true }).catch((error) => {
        setBackendStatus(error.message || 'Sync failed', 'danger');
    });
    window.backendPullRemote = () => void backendPullRemote().catch((error) => {
        setBackendStatus(error.message || 'Remote pull failed', 'danger');
    });
    window.backendRefreshMetrics = () => void backendRefreshMetrics().catch((error) => {
        setBackendStatus(error.message || 'Metrics unavailable', 'warning');
    });
    window.backendRefreshSessions = () => void backendRefreshSessions().catch((error) => {
        setBackendStatus(error.message || 'Session refresh failed', 'warning');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            void initBackendIntegration();
        }, { once: true });
    } else {
        void initBackendIntegration();
    }
})();
/* <<< 14-backend-integration.js */