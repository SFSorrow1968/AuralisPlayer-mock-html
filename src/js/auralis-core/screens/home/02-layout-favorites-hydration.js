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

