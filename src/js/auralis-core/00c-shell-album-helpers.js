/*
 * Auralis JS shard: 00c-shell-album-helpers.js
 * Purpose: album key/identity helpers, track key helpers, path helpers, metadata quality
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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

