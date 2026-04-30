/*
 * Auralis JS shard: 01-library-scan-metadata.js
 * Purpose: scan-to-library merge, duration probing, artwork, featured albums
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    // ── Build library entries from scanned files ──

    let localMusicSnapshotLoaded = false;

    function hasLocalMusicSnapshotLibrary() {
        return Boolean(localMusicSnapshotLoaded) || (Array.isArray(LIBRARY_TRACKS) && LIBRARY_TRACKS.some(track =>
            track && track._metadataSource === 'local-music-endpoint'
        ));
    }

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
        if (localMusicSnapshotLoaded) {
            renderHomeSections();
            renderLibraryViews({ force: true });
            syncEmptyState();
            updatePlaybackHealthWarnings();
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
