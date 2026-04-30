    function scheduleLibrarySongWork(task) {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(task, { timeout: 160 });
        } else {
            requestAnimationFrame(task);
        }
    }

    function renderLibrarySongWindow(container, tracks) {
        librarySongRenderToken++;
        const token = librarySongRenderToken;
        if (librarySongObserver) {
            librarySongObserver.disconnect();
            librarySongObserver = null;
        }
        clearNodeChildren(container);
        container.dataset.virtualized = tracks.length > LIBRARY_SONG_INITIAL_RENDER ? 'true' : 'false';

        if (!tracks.length) {
            appendLibraryEmptyState(container, {
                title: 'No songs',
                body: 'Add music to fill this view.',
                iconName: 'music'
            });
            return;
        }

        let cursor = 0;
        const status = document.createElement('div');
        status.className = 'library-virtual-status';

        const appendChunk = () => {
            if (token !== librarySongRenderToken) return;
            const oldSentinel = container.querySelector('.library-virtual-sentinel');
            if (oldSentinel) oldSentinel.remove();

            const end = Math.min(
                tracks.length,
                cursor === 0 ? LIBRARY_SONG_INITIAL_RENDER : cursor + LIBRARY_SONG_RENDER_CHUNK
            );
            const frag = document.createDocumentFragment();
            for (let idx = cursor; idx < end; idx++) {
                const row = createLibrarySongRow(tracks[idx], true, {
                    compact: true,
                    hideAlbum: false,
                    showDuration: true,
                    metaContext: 'library'
                });
                if (idx === tracks.length - 1) row.style.border = 'none';
                frag.appendChild(row);
            }
            cursor = end;
            container.appendChild(frag);

            if (tracks.length > LIBRARY_SONG_INITIAL_RENDER) {
                status.textContent = `Showing ${cursor} of ${tracks.length} songs`;
                container.appendChild(status);
            }

            if (cursor < tracks.length) {
                const sentinel = document.createElement('button');
                sentinel.type = 'button';
                sentinel.className = 'library-virtual-sentinel';
                sentinel.textContent = 'Show more songs';
                sentinel.addEventListener('click', () => scheduleLibrarySongWork(appendChunk));
                container.appendChild(sentinel);
                if ('IntersectionObserver' in window) {
                    librarySongObserver = new IntersectionObserver((entries) => {
                        if (entries.some(entry => entry.isIntersecting)) scheduleLibrarySongWork(appendChunk);
                    }, { rootMargin: '600px 0px' });
                    librarySongObserver.observe(sentinel);
                }
            } else if (librarySongObserver) {
                librarySongObserver.disconnect();
                librarySongObserver = null;
            }

            scheduleTitleMotion(container);
        };

        appendChunk();
    }

    function switchLibSongsSort(mode) {
        libSongsSortMode = mode || 'alpha';
        syncLibrarySongSortState();
        const songsList = getEl('lib-songs-list');
        if (!songsList) return;
        renderLibrarySongWindow(songsList, getSortedTracks(libSongsSortMode));
    }

    let _libraryMetadataSubscriberBound = false;
    function bindLibraryMetadataSubscriber() {
        if (_libraryMetadataSubscriberBound) return;
        _libraryMetadataSubscriberBound = true;
        APP_STATE.on('library:metadata-refined', ({ trackKey: refinedTrackKey, previousTrackKey, albumKey: refinedAlbumKey }) => {
            const candidateKeys = [previousTrackKey, refinedTrackKey].filter(Boolean);
            const track = trackByKey.get(refinedTrackKey) || candidateKeys.map((key) => trackByKey.get(key)).find(Boolean);
            if (!track) return;
            const resolvedTrackKey = getTrackIdentityKey(track);

            candidateKeys.forEach((candidateKey) => {
                getTrackUiBindings(candidateKey).forEach((binding) => {
                    if (binding?.row) {
                        binding.row.dataset.trackKey = resolvedTrackKey;
                        binding.row.dataset.trackId = getStableTrackIdentity(track);
                        binding.row.dataset.metadataQuality = getTrackMetadataQuality(track);
                    }
                    if (binding?.click) {
                        binding.click.dataset.trackKey = resolvedTrackKey;
                        binding.click.dataset.trackId = getStableTrackIdentity(track);
                        binding.click.dataset.title = track.title;
                        binding.click.dataset.artist = track.artist;
                        binding.click.dataset.album = track.albumTitle;
                    }
                    const titleTrack = binding?.title?.querySelector('.zenith-title-track');
                    if (titleTrack) titleTrack.textContent = track.title || '';
                    (binding?.durations || []).forEach((timeEl) => {
                        if (!timeEl) return;
                        timeEl.dataset.originalDuration = getTrackDurationDisplay(track);
                        if (!(binding?.row?.classList?.contains('playing-row'))) {
                            timeEl.textContent = timeEl.dataset.originalDuration;
                        }
                    });
                    (binding?.arts || []).forEach((artEl) => applyArtBackground(artEl, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track')));
                    unregisterTrackUi(candidateKey, binding);
                    registerTrackUi(resolvedTrackKey, binding);
                });
            });

            document.querySelectorAll('.media-card[data-album-key], .list-item[data-album-key]').forEach((el) => {
                if (String(el.dataset.albumKey || '') !== String(refinedAlbumKey || '')) return;
                const artTarget = el.querySelector('.media-cover, .item-icon');
                if (artTarget) applyArtBackground(artTarget, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
            });
            scheduleTitleMotion(document);
        });
    }

    // ── Artist Profile Section System ────────────────────────────────────────
