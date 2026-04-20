/*
 * Auralis JS shard: 07-zenith-config-profiles.js
 * Purpose: Zenith constants, icon/action-sheet helpers, home profile/subtext config
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

        syncBottomNavVisibility();
        initSwipeGesture();

        applyHomeTitleMode();
        ensureLibraryHeaderBindings();
        renderHomeProfileNav();
        scheduleTitleMotion(document);
    }

    document.addEventListener('DOMContentLoaded', init);
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Â§ ZENITH OVERRIDES â€” Enhanced renderers, home sections, entity subtext
// Merged from zenith_overrides.js (originally a separate IIFE)
// Functions declared here override same-named functions from above
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
        { key: 'dot', label: 'Dot', sample: 'â—' },
        { key: 'bullet', label: 'Bullet', sample: 'â€¢' },
        { key: 'middot', label: 'Middle Dot', sample: 'Â·' },
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

    function getIconSvg(name) {
        if (name === 'up') return '<svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8z"/></svg>';
        if (name === 'down') return '<svg viewBox="0 0 24 24"><path d="M4 12l1.41-1.41L11 16.17V4h2v12.17l5.59-5.58L20 12l-8 8-8-8z"/></svg>';
        if (name === 'columns') return '<svg viewBox="0 0 24 24"><path d="M4 5h7v14H4V5zm9 0h7v14h-7V5z"/></svg>';
        if (name === 'stack') return '<svg viewBox="0 0 24 24"><path d="M5 6h14v3H5V6zm0 5h14v3H5v-3zm0 5h14v3H5v-3z"/></svg>';
        if (name === 'carousel') return '<svg viewBox="0 0 24 24"><path d="M4 6h3v12H4V6zm13 0h3v12h-3V6zM9 8h6v8H9V8z"/></svg>';
        if (name === 'grid') return '<svg viewBox="0 0 24 24"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></svg>';
        if (name === 'density') return '<svg viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h8v2H3v-2z"/></svg>';
        if (name === 'manage') return '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.49.49 0 0 0-.6-.22l-2.39.96c-.49-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.47-.4h-3.86c-.23 0-.43.17-.47.4l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.3-.06.61-.06.94s.02.64.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.23.24.4.47.4h3.86c.23 0 .43-.17.47-.4l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>';
        if (name === 'trash') return '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
        if (name === 'source') return '<svg viewBox="0 0 24 24"><path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 8.7L5.04 9 12 5.3 18.96 9 12 11.7zM5 13.18 3.03 12.1 12 17l8.97-4.9L19 13.18 12 17l-7-3.82z"/></svg>';
        if (name === 'filter') return '<svg viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm4 6h10v2H7v-2zm3 6h4v2h-4v-2z"/></svg>';
        if (name === 'music') return '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>';
        if (name === 'album') return '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9zm0 13a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/></svg>';
        if (name === 'artist') return '<svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"/></svg>';
        if (name === 'playlist') return '<svg viewBox="0 0 24 24"><path d="M3 6h12v2H3V6zm0 4h12v2H3v-2zm0 4h8v2H3v-2zm14-8v10.17A3 3 0 1 0 19 19V8h3V6h-5z"/></svg>';
        if (name === 'queue') return '<svg viewBox="0 0 24 24"><path d="M4 10h12v2H4v-2zm0-4h16v2H4V6zm0 8h8v2H4v-2zm14 0V9h2v5h3l-4 4-4-4h3z"/></svg>';
        if (name === 'next') return '<svg viewBox="0 0 24 24"><path d="M6 6v12l8.5-6L6 6zm10 0h2v12h-2V6z"/></svg>';
        if (name === 'open') return '<svg viewBox="0 0 24 24"><path d="M14 3v2h3.59L10 12.59 11.41 14 19 6.41V10h2V3h-7zM5 5h6v2H7v10h10v-4h2v6H5V5z"/></svg>';
        if (name === 'heart') return '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3 9.24 3 10.91 3.81 12 5.09 13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
        if (name === 'share') return '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7A3.2 3.2 0 0 0 9 12c0-.24-.03-.47-.09-.7l7.02-4.11a2.99 2.99 0 1 0-.9-1.45L8 9.85A3 3 0 1 0 8 14.15l7.03 4.11a3 3 0 1 0 2.97-2.18z"/></svg>';
        return '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>';
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

    function getAlbumAddedScore(album) {
        const values = (album?.tracks || []).map(track => Number(track.addedRank || 0));
        return values.length ? Math.max(...values) : 0;
    }

    // Project live play counts and lastPlayed timestamps from Maps onto track objects
    function projectLiveStats(track) {
        const key = trackKey(track.title, track.artist);
        const liveCount = playCounts.get(key);
        if (liveCount !== undefined) track.plays = liveCount;
        const liveTs = lastPlayed.get(key);
        if (liveTs) {
            track.lastPlayedDays = Math.max(0, Math.floor((Date.now() - liveTs) / 86400000));
        }
    }

    function getSortedTracks(mode) {
        if (!Array.isArray(LIBRARY_TRACKS)) return [];
        const copy = LIBRARY_TRACKS.slice();
        copy.forEach(projectLiveStats);
        if (mode === 'most_played') copy.sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
        else if (mode === 'forgotten') copy.sort((a, b) => Number(b.lastPlayedDays || 0) - Number(a.lastPlayedDays || 0));
        else if (mode === 'recent') copy.sort((a, b) => Number(a.lastPlayedDays || 999) - Number(b.lastPlayedDays || 999));
        else copy.sort((a, b) => Number(b.addedRank || 0) - Number(a.addedRank || 0));
        return copy;
    }

    function getSortedAlbums(mode) {
        const copy = LIBRARY_ALBUMS.slice();
        copy.forEach(album => (album.tracks || []).forEach(projectLiveStats));
        if (mode === 'most_played') copy.sort((a, b) => getAlbumPlayCount(b) - getAlbumPlayCount(a));
        else if (mode === 'forgotten') copy.sort((a, b) => getAlbumLastPlayedDays(b) - getAlbumLastPlayedDays(a));
        else if (mode === 'recent') copy.sort((a, b) => getAlbumLastPlayedDays(a) - getAlbumLastPlayedDays(b));
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
            const prog = getAlbumProgress(album.title);
            if (!prog) return false;
            const totalTracks = (album.tracks || []).length;
            // In progress = not on the last track at the end, or position > 0 on any track
            return prog.trackIndex < totalTracks - 1 || (prog.position > 0 && prog.position < prog.total - 1);
        }).sort((a, b) => {
            const pa = getAlbumProgress(a.title);
            const pb = getAlbumProgress(b.title);
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
                items = LIBRARY_TRACKS.filter(t => !playCounts.has(trackKey(t.title, t.artist)));
                break;
            case 'never_played_albums':
                items = LIBRARY_ALBUMS.filter(album =>
                    (album.tracks || []).every(t => !playCounts.has(trackKey(t.title, t.artist)))
                );
                break;
            case 'liked_songs':
                items = LIBRARY_TRACKS.filter(t => likedTracks.has(trackKey(t.title, t.artist)));
                break;
            case 'top_rated':
                items = LIBRARY_TRACKS.filter(t => (trackRatings.get(trackKey(t.title, t.artist)) || 0) >= 4)
                    .sort((a, b) => (trackRatings.get(trackKey(b.title, b.artist)) || 0) - (trackRatings.get(trackKey(a.title, a.artist)) || 0));
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
        return document.querySelector(`#tabs .nav-item[onclick*="'${tabId}'"]`) || null;
    }

    function routeToSearchQuery(query, filters = ['all']) {
        const targetFilters = Array.isArray(filters) && filters.length ? filters : ['all'];
        switchTab('search', findTabNavButton('search'));
        const canUseSearchFilters = typeof searchFilters !== 'undefined' && searchFilters && typeof searchFilters.clear === 'function';
        if (canUseSearchFilters) {
            searchFilters.clear();
            targetFilters.forEach((f) => searchFilters.add(f));
            if (!searchFilters.size) searchFilters.add('all');
        }
        const filterRow = getEl('search-filter-row');
        if (filterRow) {
            filterRow.querySelectorAll('.filter-chip').forEach((chip) => {
                const f = chip.dataset.filter;
                chip.classList.toggle('active', canUseSearchFilters ? searchFilters.has(f) : f === 'all');
            });
        }
        const input = getEl('search-input');
        if (input) {
            input.value = query || '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            renderSearchState();
        }
    }

    function routeToArtist(name) {
        if (!name) return;
        routeToArtistProfile(name);
    }

    function routeToAlbum(title, artist) {
        if (!title) return;
        routeToAlbumDetail(title, artist);
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
        if (key === 'bullet') return 'â€¢';
        if (key === 'middot') return 'Â·';
        if (key === 'slash') return '/';
        if (key === 'pipe') return '|';
        if (key === 'dash') return '-';
        return '';
    }

    function createMetaNode({ label, onClick, onLongPress, interactive = true }) {
        if (!label) return null;
        const canInteract = interactive !== false;
        if (!canInteract || typeof onClick !== 'function') {
            const text = document.createElement('span');
            text.textContent = label;
            return text;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zenith-meta-link';
        btn.textContent = label;
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
        const sections = cloneSectionsForProfile(profile?.sections);
        return {
            id: String(profile?.id || createHomeProfileId()),
            name,
            sections: sections.length ? sections : cloneSectionsForProfile(getDefaultHomeSections())
        };
    }

    function getActiveHomeProfile() {
        return homeProfiles.find((profile) => profile.id === activeHomeProfileId) || null;
    }

    function saveHomeProfiles() {
        const safeProfiles = homeProfiles.map((profile, index) => normalizeHomeProfile(profile, index));
        homeProfiles = safeProfiles;
        safeStorage.setJson(HOME_PROFILES_KEY, safeProfiles);
        safeStorage.setItem(HOME_ACTIVE_PROFILE_KEY, String(activeHomeProfileId || (safeProfiles[0]?.id || '')));
    }

    function saveCurrentHomeProfileLayout() {
        const profile = getActiveHomeProfile();
        if (profile) profile.sections = cloneSectionsForProfile(homeSections);
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
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
            chip.className = 'filter-chip';
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
        const savedActive = String(safeStorage.getItem(HOME_ACTIVE_PROFILE_KEY) || '').trim();
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

