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
    let searchViewMode = 'list';
    const UI_PREFS_VERSION = 1;
    const UI_PREFERENCE_DEFAULTS = Object.freeze({
        libraryTab: '',
        homeProfile: '',
        searchQuery: '',
        searchFilters: [],
        searchViewMode: 'list',
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
            searchViewMode: ['list', 'grid', 'carousel'].includes(source.searchViewMode) ? source.searchViewMode : UI_PREFERENCE_DEFAULTS.searchViewMode,
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

