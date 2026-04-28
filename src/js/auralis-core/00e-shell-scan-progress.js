/*
 * Auralis JS shard: 00e-shell-scan-progress.js
 * Purpose: library scan progress, album duration, metadata line, action sheets, zenith menus
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function updateLibraryScanProgress(phase, detail = {}) {
        const labelText = detail.label || LIBRARY_SCAN_PHASES[phase] || 'Scanning library';
        const processed = Number(detail.processed || 0);
        const total = Number(detail.total || 0);
        const percent = Number.isFinite(Number(detail.percent))
            ? Math.max(0, Math.min(100, Number(detail.percent)))
            : (total > 0 ? Math.max(0, Math.min(100, Math.round((processed / total) * 100))) : 0);
        const countText = detail.countText || (total > 0
            ? `${Math.min(processed, total)} / ${total}`
            : '');

        [
            { status: 'settings-scan-status', label: 'settings-scan-label', count: 'settings-scan-count', fill: 'settings-scan-fill' },
            { status: 'setup-scan-progress', label: 'setup-scan-label', count: 'setup-scan-count', fill: 'setup-scan-fill' }
        ].forEach((target) => {
            const statusEl = getEl(target.status);
            const labelEl = getEl(target.label);
            const countEl = getEl(target.count);
            const fillEl = getEl(target.fill);
            if (statusEl && detail.visible !== false) statusEl.style.display = 'block';
            if (labelEl) labelEl.textContent = labelText;
            if (countEl) countEl.textContent = countText;
            if (fillEl) fillEl.style.width = percent + '%';
        });

        APP_STATE.emit('library:scan-progress', { phase, label: labelText, processed, total, percent });
    }

    function getAlbumTotalDurationSeconds(albumMeta) {
        if (!albumMeta) return 0;
        const trackTotal = Array.isArray(albumMeta.tracks)
            ? albumMeta.tracks.reduce((sum, track) => sum + getTrackDurationSeconds(track), 0)
            : 0;
        const labelTotal = parseLibraryDurationLabel(albumMeta.totalDurationLabel);
        if (trackTotal > 0 && labelTotal > 0) return Math.max(trackTotal, labelTotal);
        return trackTotal || labelTotal || 0;
    }

    function refreshAlbumTotalDurationLabel(albumMeta) {
        if (!albumMeta) return '--';
        const computed = Array.isArray(albumMeta.tracks) ? toLibraryDurationTotal(albumMeta.tracks) : '--';
        const fallback = String(albumMeta.totalDurationLabel || '').trim();
        albumMeta.totalDurationLabel = computed !== '--' ? computed : (fallback || '--');
        return albumMeta.totalDurationLabel;
    }

    function renderAlbumMetadataLine(albumMeta, metaEl = getEl('alb-meta')) {
        if (!albumMeta || !metaEl) return;
        const trackCount = albumMeta.tracks?.length || Number(albumMeta.trackCount || 0);
        const albumMetaDone = Array.isArray(albumMeta.tracks) && albumMeta.tracks.length > 0 && albumMeta.tracks.every(t => t._metaDone);
        const yearMissing = albumMetaDone && !albumMeta.year;
        const totalDuration = refreshAlbumTotalDurationLabel(albumMeta);

        metaEl.textContent = '';
        metaEl.removeAttribute('class');
        const yearSpan = document.createElement('span');
        if (yearMissing) {
            yearSpan.textContent = 'No Year';
            yearSpan.className = 'metadata-error';
        } else {
            yearSpan.textContent = albumMeta.year || 'Unknown Year';
        }
        metaEl.append('Album - ', yearSpan, ` - ${trackCount} tracks`);
        if (totalDuration && totalDuration !== '--') metaEl.append(` - ${totalDuration}`);
    }

    function refreshVisibleAlbumDurationMetadata(albumHint = null) {
        const activeAlbum = albumHint || (typeof resolveAlbumMeta === 'function'
            ? resolveAlbumMeta(activeAlbumTitle, activeAlbumArtist)
            : null);
        if (!activeAlbum) return;
        refreshAlbumTotalDurationLabel(activeAlbum);
        if (!activeAlbumTitle || albumKey(activeAlbum.title) !== albumKey(activeAlbumTitle)) return;
        renderAlbumMetadataLine(activeAlbum);
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

    function commitQueueChange(message = '') {
        persistQueue();
        renderQueue();
        if (typeof updateNowPlayingUI === 'function') updateNowPlayingUI();
        if (message) toast(message);
    }

    function insertTrackInQueue(track, position = 'end') {
        if (!track) return false;
        if (position !== 'next' && queueTracks.length >= MAX_QUEUE_SIZE) {
            toast(`Queue limit reached (${MAX_QUEUE_SIZE} tracks)`);
            return false;
        }
        if (position === 'next') {
            const currentIdx = Math.max(0, getCurrentQueueIndex());
            queueTracks.splice(Math.min(currentIdx + 1, queueTracks.length), 0, track);
        } else {
            queueTracks.push(track);
        }
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(0, MAX_QUEUE_SIZE);
        return true;
    }

    function queueTrackNextSmart(track) {
        if (!insertTrackInQueue(track, 'next')) return;
        commitQueueChange(`"${track.title}" queued next`);
    }

    function addTrackToQueueSmart(track) {
        if (!insertTrackInQueue(track, 'end')) return;
        commitQueueChange(`Added "${track.title}" to queue`);
    }

    function addAlbumToQueueSmart(albumMeta) {
        if (!albumMeta || !Array.isArray(albumMeta.tracks) || albumMeta.tracks.length === 0) return;
        const ordered = albumMeta.tracks.slice().sort((a, b) =>
            Number(a.discNo || 1) - Number(b.discNo || 1)
            || Number(a.no || 0) - Number(b.no || 0)
        );
        queueTracks.push(...ordered);
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(-MAX_QUEUE_SIZE);
        renderQueue();
        toast(`Queued ${ordered.length} tracks from "${albumMeta.title}"`);
    }

    function openTrackZenithMenu(track) {
        if (!track) return;
        sheetTrack = track; // remember for share/remove actions

        // Build context-aware action list
        const actions = [
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
                onSelect: () => routeToAlbumDetail(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track))
            },
            {
                label: 'Open Artist',
                description: `Go to ${track.artist}.`,
                icon: 'artist',
                onSelect: () => routeToArtistProfile(track.artist)
            },
            {
                label: 'Edit Info',
                description: 'Fix title, artist, album artist, year, genre.',
                icon: 'manage',
                onSelect: () => {
                    if (typeof openTrackMetadataEditor === 'function') openTrackMetadataEditor(track);
                }
            },
            {
                label: 'Share',
                description: 'Copy track info or share via system sheet.',
                icon: 'share',
                onSelect: () => shareTrackAction(track)
            }
        ];

        // Show "Remove from Playlist" only when inside a user playlist
        if (activePlaylistId) {
            const pl = userPlaylists.find(p => p.id === activePlaylistId);
            if (pl) {
                const trackIdx = pl.tracks.findIndex((candidate) => isSameTrack(candidate, track));
                if (trackIdx >= 0) {
                    actions.push({
                        label: `Remove from "${pl.name}"`,
                        description: 'Remove this track from the current playlist.',
                        icon: 'trash',
                        danger: true,
                        onSelect: () => {
                            showConfirm(
                                `Remove from "${pl.name}"?`,
                                `"${track.title}" will be removed from this playlist.`,
                                'Remove',
                                () => { removeTrackFromUserPlaylist(activePlaylistId, trackIdx); setLibraryRenderDirty(true); renderLibraryViews({ force: true }); }
                            );
                        }
                    });
                }
            }
        }

        showZenithActionSheet(
            track.title,
            `${track.artist} - ${track.albumTitle} - ${track.duration || '--:--'}`,
            actions
        );
    }

    // Share a track via Web Share API or clipboard fallback
    function shareTrackAction(track) {
        if (!track) return;
        const parts = [track.title, track.artist, track.albumTitle].filter(Boolean);
        const text = parts.join(' \u00b7 ');
        if (navigator.share) {
            navigator.share({ title: track.title, text }).catch(() => {});
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                toast('Track info copied to clipboard');
            }).catch(() => {
                toast('Could not copy \u2014 share unavailable');
            });
            return;
        }
        toast('Share not available on this device');
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
        const displayArtist = albumMeta.artist || ARTIST_NAME;
        const artistStats = getArtistSummary(displayArtist);
        showZenithActionSheet(
            albumMeta.title,
            `${displayArtist} - ${albumMeta.year || 'Unknown Year'} - ${albumMeta.trackCount || 0} tracks - ${totalDuration}`,
            [
                {
                    label: 'Play Album',
                    description: 'Start from track 1 in album order.',
                    icon: 'music',
                    onSelect: () => playAlbumInOrder(albumMeta.title, 0, albumMeta.artist)
                },
                {
                    label: 'Open Artist',
                    description: `${artistStats.trackCount} tracks - ${artistStats.albumCount} albums`,
                    icon: 'artist',
                    onSelect: () => routeToArtistProfile(displayArtist)
                },
                {
                    label: 'Queue Album',
                    description: `Append all ${albumMeta.trackCount || 0} tracks to queue.`,
                    icon: 'queue',
                    onSelect: () => addAlbumToQueueSmart(albumMeta)
                },
                {
                    label: 'Edit Album Info',
                    description: 'Fix album artist, year, genre for all tracks.',
                    icon: 'manage',
                    onSelect: () => {
                        if (typeof openAlbumMetadataEditor === 'function') openAlbumMetadataEditor(albumMeta);
                    }
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
            titleEl.onclick = () => playAlbumInOrder(albumMeta.title, 0, albumMeta.artist);
            titleEl.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    playAlbumInOrder(albumMeta.title, 0, albumMeta.artist);
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
        const trackDurations = tracks.map(track => Math.max(0, getTrackDurationSeconds(track)));
        const knownDurationTotal = trackDurations.reduce((sum, value) => sum + value, 0);
        const total = Math.max(1, knownDurationTotal || getAlbumTotalDurationSeconds(albumMeta));
        let elapsed = 0;

        tracks.forEach((track, idx) => {
            const notch = document.createElement('span');
            notch.className = 'album-progress-notch';
            const ratio = knownDurationTotal > 0
                ? Math.max(0, Math.min(1, elapsed / total))
                : Math.max(0, Math.min(1, idx / tracks.length));
            notch.style.left = `${ratio * 100}%`;
            notch.style.transform = 'translateX(-50%)';
            notch.title = `${idx + 1}. ${track.title}`;
            notch.dataset.trackIndex = String(idx);
            notchesEl.appendChild(notch);
            if (knownDurationTotal > 0) elapsed += Math.max(1, trackDurations[idx]);
        });
    }

    function seekAlbumProgress(ratio) {
        const albumMeta = resolveAlbumMeta(viewedAlbumTitle, viewedAlbumArtist);
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

        playAlbumInOrder(albumMeta.title, targetIndex, albumMeta.artist);
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

