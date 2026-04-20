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

    function resolveTrackMeta(title, artist, albumHint) {
        const key = trackKey(title, artist);
        let found = trackByKey.get(key);

        if (!found && albumHint) {
            const album = albumByTitle.get(albumKey(albumHint));
            if (album) {
                found = album.tracks.find(t => t.title === title || trackKey(t.title, t.artist) === key);
            }
        }

        if (!found) {
            found = LIBRARY_TRACKS.find(t => t.title === title)
                || LIBRARY_TRACKS.find(t => trackKey(t.title, t.artist) === key)
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
            plays: 0
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
                tracks
            };
        }).filter(album => album.tracks.length > 0);
        installLibrarySnapshot(hydratedAlbums, { force: true });

        if (queueTracks.length === 0 || !nowPlaying) {
            resetPlaybackState();
        }
    }

    function setNowPlaying(meta, showToastMessage = true) {
        if (!meta) return;
        nowPlaying = meta;
        activeArtistName = meta.artist || ARTIST_NAME;
        const idx = queueTracks.findIndex(track => trackKey(track.title, track.artist) === trackKey(meta.title, meta.artist));
        if (idx >= 0) queueIndex = idx;

        document.querySelectorAll('.mini-title').forEach(el => { setNowPlayingMarqueeText(el, meta.title); });
        document.querySelectorAll('.mini-artist').forEach(el => { setNowPlayingMarqueeText(el, meta.artist); });

        const pt = getEl('player-title') || document.querySelector('.player-titles h1');
        const pa = getEl('player-artist') || document.querySelector('.player-titles p');
        if (pt) setNowPlayingMarqueeText(pt, meta.title);
        if (pa) setNowPlayingMarqueeText(pa, meta.artist);
        scheduleNowPlayingMarquee(document);

        syncNowPlayingArt(meta);

        const quality = getEl('player-quality-badge');
        const format = getEl('player-format-badge');
        const isLossless = meta.ext === 'flac' || meta.ext === 'wav';
        if (quality) quality.textContent = isLossless ? 'LOSSLESS' : 'COMPRESSED';
        if (format) format.textContent = meta.ext ? meta.ext.toUpperCase() : 'AUDIO';

        const elapsed = getEl('player-elapsed');
        const remaining = getEl('player-remaining');
        if (elapsed) elapsed.textContent = '0:00';
        if (remaining) remaining.textContent = meta.duration && meta.duration !== '--:--' ? `-${meta.duration}` : '--:--';

        updateAlbumProgressLine(0, meta.durationSec || 0);
        syncTrackActiveStates(0, meta.durationSec || 0);
        if (showToastMessage) toast(`Playing ${meta.title}`);

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

        // Persist queue state on track change
        persistQueue();
    }

    function normalizeCollectionKey(type, value) {
        const normalizedType = String(type || '').trim().toLowerCase();
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (normalizedType === 'album') return albumKey(raw);
        return raw.toLowerCase();
    }

