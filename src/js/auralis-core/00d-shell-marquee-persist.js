/*
 * Auralis JS shard: 00d-shell-marquee-persist.js
 * Purpose: now-playing marquee, track state buttons, persist helpers, queue persist
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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

