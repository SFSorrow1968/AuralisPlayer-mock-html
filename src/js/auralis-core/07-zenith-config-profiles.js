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

