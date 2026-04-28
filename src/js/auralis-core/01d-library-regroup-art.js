/*
 * Auralis JS shard: 01d-library-regroup-art.js
 * Purpose: album regrouping by tag, art background helpers, now playing art sync
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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
