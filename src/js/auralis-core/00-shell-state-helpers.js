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
    let currentSort = localStorage.getItem('auralis_sort') || 'Recently Added';
    let currentHomeFilter = 'all';

    const ONBOARDED_KEY = 'auralis_onboarded';
    const SETUP_DONE_KEY = 'auralis_setup_done';
    const HOME_LAYOUT_KEY = 'auralis_home_layout_v2';
    const FALLBACK_GRADIENT = 'linear-gradient(135deg, #302b63, #24243e)';
    const MAX_QUEUE_SIZE = 160;
    const QUEUE_RENDER_WINDOW = 80;
    const DEFAULT_QUEUE_SIZE = 8;
    const REPLAY_THRESHOLD_SEC = 3;
    const PLAY_ICON_PATH = 'M8 5v14l11-7z';
    const PAUSE_ICON_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
    const DEBUG = false;
    const ARTIST_NAME = 'Unknown Artist';
    let SEARCH_DATA = [];
    let LIBRARY_ALBUMS = [];
    let LIBRARY_TRACKS = [];
    let LIBRARY_ARTISTS = [];
    let LIBRARY_PLAYLISTS = [];
    const albumByTitle = new Map();
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
    let activePlaylistId = '';
    let activePlaybackCollectionType = '';
    let activePlaybackCollectionKey = '';
    let activeArtistName = '';
    let homeSections = [];
    let sectionConfigContextId = '';
    const searchFilters = new Set(['all']);
    let searchQuery = '';

    let lpTimer = null;
    let longPressFiredAt = 0;
    const longPressBindingCleanup = new WeakMap();
    let queueDragSuppressUntil = 0;
    let albumArtViewerOpen = false;
    let albumArtViewerLastFocus = null;
    let nowPlayingMarqueeRaf = null;

    // File handle cache: maps normalized filename â†’ FileSystemFileHandle
    const fileHandleCache = new Map();
    // Blob URL cache: maps trackKey â†’ blob URL (avoids re-creating blobs)
    const blobUrlCache = new Map();
    // Art handle cache: maps subDir/folderName â†’ FileSystemFileHandle for album art images
    const artHandleCache = new Map();

    // Shared Helpers
    function getEl(id) {
        return document.getElementById(id);
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
        document.querySelectorAll('.track-state-btn').forEach((btn) => {
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
        }
    };

    function clearDemoMarkup() {
        [
            'lib-albums-grid',
            'lib-artists-list',
            'lib-songs-list',
            'playlist-track-list',
            'album-track-list'
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

    function getTrackDurationSeconds(track) {
        if (!track) return 0;
        const sec = Number(track.durationSec || 0);
        if (Number.isFinite(sec) && sec > 0) return sec;
        return toDurationSeconds(track.duration);
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
        const ordered = albumMeta.tracks.slice().sort((a, b) => Number(a.no || 0) - Number(b.no || 0));
        queueTracks.push(...ordered);
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(-MAX_QUEUE_SIZE);
        renderQueue();
        toast(`Queued ${ordered.length} tracks from "${albumMeta.title}"`);
    }

    function openTrackZenithMenu(track) {
        if (!track) return;
        showZenithActionSheet(
            track.title,
            `${track.artist} - ${track.albumTitle} - ${track.duration || '--:--'}`,
            [
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
                }
            ]
        );
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
        const artistStats = getArtistSummary(albumMeta.artist);
        showZenithActionSheet(
            albumMeta.title,
            `${albumMeta.artist} - ${albumMeta.year || 'Unknown Year'} - ${albumMeta.trackCount || 0} tracks - ${totalDuration}`,
            [
                {
                    label: 'Play Album',
                    description: 'Start from track 1 in album order.',
                    icon: 'music',
                    onSelect: () => playAlbumInOrder(albumMeta.title, 0)
                },
                {
                    label: 'Open Artist',
                    description: `${artistStats.trackCount} tracks - ${artistStats.albumCount} albums`,
                    icon: 'artist',
                    onSelect: () => routeToArtistProfile(albumMeta.artist)
                },
                {
                    label: 'Queue Album',
                    description: `Append all ${albumMeta.trackCount || 0} tracks to queue.`,
                    icon: 'queue',
                    onSelect: () => addAlbumToQueueSmart(albumMeta)
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
            titleEl.onclick = () => playAlbumInOrder(albumMeta.title, 0);
            titleEl.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    playAlbumInOrder(albumMeta.title, 0);
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
        const albumMeta = albumByTitle.get(albumKey(activeAlbumTitle));
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

        playAlbumInOrder(albumMeta.title, targetIndex);
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

        const albumMeta = albumByTitle.get(albumKey(activeAlbumTitle));
        if (!albumMeta || !Array.isArray(albumMeta.tracks) || !albumMeta.tracks.length) {
            shell.style.display = 'none';
            fillEl.style.width = '0%';
            notchesEl.innerHTML = '';
            return;
        }

        shell.style.display = 'block';
        const albumKeyValue = albumKey(albumMeta.title);
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

        const albumMeta = albumByTitle.get(albumKey(label));
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
            { type: 'recent_activity', title: 'Recent Activity', itemType: 'songs', layout: 'list', density: 'compact', limit: 6, core: true },
            { type: 'recently_added', title: 'Recently Added', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8, core: true },
            { type: 'most_played_songs', title: 'Most Played Songs', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'most_played_artists', title: 'Most Played Artists', itemType: 'artists', layout: 'carousel', density: 'large', limit: 8 },
            { type: 'most_played_albums', title: 'Most Played Albums', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8 }
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
        if (blobUrlCache.has(key)) return blobUrlCache.get(key);

        // 2. Direct handle key (scanned tracks have this)
        if (track._handleKey && fileHandleCache.has(track._handleKey)) {
            try {
                const handle = fileHandleCache.get(track._handleKey);
                // Fallback shim from <input webkitdirectory>
                if (handle && handle._blobUrl) {
                    blobUrlCache.set(key, handle._blobUrl);
                    return handle._blobUrl;
                }
                const file = await handle.getFile();
                const blobUrl = URL.createObjectURL(file);
                blobUrlCache.set(key, blobUrl);
                return blobUrl;
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
                    return handle._blobUrl;
                }
                const file = await handle.getFile();
                const blobUrl = URL.createObjectURL(file);
                blobUrlCache.set(key, blobUrl);
                return blobUrl;
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
                            return handle._blobUrl;
                        }
                        const file = await handle.getFile();
                        const blobUrl = URL.createObjectURL(file);
                        blobUrlCache.set(key, blobUrl);
                        fileHandleCache.set(filename || fname, handle);
                        return blobUrl;
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


