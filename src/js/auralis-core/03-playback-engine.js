/*
 * Auralis JS shard: 03-playback-engine.js
 * Purpose: collection state, progress UI, active rows, audio engine, transport controls
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function setPlaybackCollection(type, value) {
        const normalizedType = String(type || '').trim().toLowerCase();
        if (normalizedType !== 'album' && normalizedType !== 'playlist') {
            activePlaybackCollectionType = '';
            activePlaybackCollectionKey = '';
            return;
        }
        activePlaybackCollectionType = normalizedType;
        activePlaybackCollectionKey = normalizeCollectionKey(normalizedType, value);
    }

    function isCollectionActive(type, value) {
        const normalizedType = String(type || '').trim().toLowerCase();
        const normalizedKey = normalizeCollectionKey(normalizedType, value);
        if (!normalizedType || !normalizedKey) return false;
        return normalizedType === activePlaybackCollectionType && normalizedKey === activePlaybackCollectionKey;
    }

    function isCollectionPlaying(type, value) {
        if (!isPlaying) return false;
        return isCollectionActive(type, value);
    }

    function syncCollectionPlayButtons() {
        document.querySelectorAll('.catalog-play-btn').forEach((btn) => {
            const type = String(btn.dataset.collectionType || '').trim().toLowerCase();
            const key = String(btn.dataset.collectionKey || '').trim();
            const active = type && key ? isCollectionPlaying(type, key) : false;
            setPlaybackIcon(btn, active);
        });

        const albumPlay = getEl('alb-play-btn');
        if (albumPlay) {
            const active = isCollectionPlaying('album', albumPlay.dataset.collectionKey || albumIdentityKey(activeAlbumTitle, activeAlbumArtist));
            setPlaybackIcon(albumPlay, active);
        }

        const playlistPlay = getEl('playlist-play-btn');
        if (playlistPlay) {
            const active = isCollectionPlaying('playlist', playlistPlay.dataset.collectionKey || activePlaylistId);
            setPlaybackIcon(playlistPlay, active);
            if (!playlistPlay.querySelector('svg path')) {
                playlistPlay.textContent = active ? 'Pause' : 'Play';
            }
        }
    }

    function getProgressSnapshot(currentSeconds, durationSeconds) {
        const duration = Number.isFinite(durationSeconds) && durationSeconds > 0
            ? durationSeconds
            : (nowPlaying?.durationSec || 0);
        const current = Math.max(0, Number.isFinite(currentSeconds) ? currentSeconds : 0);
        const ratio = (Number.isFinite(duration) && duration > 0)
            ? Math.max(0, Math.min(1, current / duration))
            : 0;
        return {
            duration,
            current,
            ratio,
            pct: `${ratio * 100}%`,
            elapsedLabel: toDurationLabel(current),
            remainingLabel: duration > 0
                ? `-${toDurationLabel(Math.max(0, duration - current))}`
                : '--:--'
        };
    }

    function clearCrossfadeState() {
        if (!crossfadeState) return;
        try { clearInterval(crossfadeState.intervalId); } catch (_) { /* benign: cleanup */ }
        const oldEngine = crossfadeState.engine;
        if (oldEngine) {
            try { oldEngine.volume = currentVolume; } catch (_) { /* benign: cleanup */ }
        }
        crossfadeState = null;
    }

    function beginCrossfade(engine) {
        clearCrossfadeState();
        if (!engine || engine.paused) return;
        const fadeStep = 50;
        const steps = Math.max(1, Math.round((CROSSFADE_DURATION * 1000) / fadeStep));
        const startVolume = Number(engine.volume || currentVolume || 1);
        let step = 0;
        const intervalId = setInterval(() => {
            step += 1;
            try {
                engine.volume = Math.max(0, startVolume * (1 - (step / steps)));
            } catch (_) { /* benign: cleanup */ }
            if (step >= steps) {
                clearCrossfadeState();
            }
        }, fadeStep);
        crossfadeState = { engine, intervalId };
    }

    function setPlayButtonState(playing) {
        isPlaying = Boolean(playing);

        const miniIcon = getRef('mini-toggle-icon');
        const mainIcon = getRef('player-main-icon');
        if (miniIcon) setPlaybackIcon(miniIcon, isPlaying);
        if (mainIcon) setPlaybackIcon(mainIcon, isPlaying);
        const miniCardIcon = document.querySelector('#mini-play-icon path');
        if (miniCardIcon) setPlaybackIcon(miniCardIcon, isPlaying);
        syncCollectionPlayButtons();
        syncTrackStateButtons();
    }

    let _progressRafId = null;
    let _progressPending = null;
    function updateProgressUI(currentSeconds, durationSeconds) {
        _progressPending = [currentSeconds, durationSeconds];
        if (_progressRafId) return;
        _progressRafId = requestAnimationFrame(() => {
            _progressRafId = null;
            if (!_progressPending) return;
            const [cs, ds] = _progressPending;
            _progressPending = null;
            _updateProgressUIImpl(cs, ds);
        });
    }
    function _updateProgressUIImpl(currentSeconds, durationSeconds) {
        const elapsedEl = getRef('player-elapsed');
        const remainEl = getRef('player-remaining');
        const miniFill = getRef('mini-progress-fill');
        const fullFill = getRef('player-progress-fill');
        const thumb = getRef('player-progress-thumb');
        const snapshot = getProgressSnapshot(currentSeconds, durationSeconds);

        if (miniFill) miniFill.style.width = snapshot.pct;
        if (fullFill) fullFill.style.width = snapshot.pct;
        if (thumb && !isSeeking) thumb.style.left = `calc(${snapshot.pct} - 7px)`;

        if (elapsedEl) elapsedEl.textContent = snapshot.elapsedLabel;
        if (remainEl) remainEl.textContent = snapshot.remainingLabel;
        updateAlbumProgressLine(snapshot.current, snapshot.duration);
        syncTrackActiveStates(snapshot.current, snapshot.duration);

        // Gapless: pre-resolve next track URL while current track nears its end
        if (gaplessEnabled && !isSeeking && snapshot.duration > 0) {
            const remaining = Math.max(0, snapshot.duration - snapshot.current);
            if (remaining > 0 && remaining < GAPLESS_PRELOAD_SECONDS) {
                scheduleGaplessPreload(getNextQueueTrack());
            }
        }
    }

    function syncTrackActiveStates(currentSeconds, durationSeconds) {
        const titleTarget = nowPlaying ? String(nowPlaying.title).toLowerCase().trim() : '';
        const nowKey = getNowPlayingTrackKey();
        const snapshot = getProgressSnapshot(currentSeconds, durationSeconds);
        const syncSignature = [
            nowKey || titleTarget,
            Math.floor(snapshot.current),
            Math.floor(snapshot.duration),
            trackUiRegistryRevision
        ].join('|');
        if (syncSignature === activeTrackUiSyncSignature) return;
        activeTrackUiSyncSignature = syncSignature;
        const registryHandledKeys = new Set();

        if (nowKey) {
            const bindings = getTrackUiBindings(nowKey);
            if (bindings.length) {
                Array.from(trackUiRegistry.keys()).forEach((trackKeyValue) => {
                    const trackBindings = getTrackUiBindings(trackKeyValue);
                    if (!trackBindings.length) return;
                    registryHandledKeys.add(trackKeyValue);
                    trackBindings.forEach((binding) => {
                        const row = binding?.row;
                        if (row) {
                            const isActiveTrack = trackKeyValue === nowKey;
                            row.classList.toggle('playing-row', isActiveTrack);
                            row.classList.toggle('is-now-playing', isActiveTrack);
                            if (isActiveTrack) row.setAttribute('aria-current', 'true');
                            else row.removeAttribute('aria-current');
                        }
                        (binding?.durations || []).forEach((timeEl) => {
                            if (!timeEl) return;
                            if (!timeEl.dataset.originalDuration) {
                                timeEl.dataset.originalDuration = timeEl.textContent || '';
                            }
                            timeEl.textContent = trackKeyValue === nowKey
                                ? snapshot.remainingLabel
                                : (timeEl.dataset.originalDuration || '');
                        });
                    });
                });
            }
        }

        document.querySelectorAll('.item-clickable').forEach(click => {
            const row = click.closest('.list-item') || click;
            const rowTrackKey = String(row?.dataset?.trackKey || '').trim();
            if (rowTrackKey && registryHandledKeys.has(rowTrackKey)) return;

            const h3 = click.querySelector('h3');
            if(!h3) return;

            const rowTitle = h3.textContent.toLowerCase().trim();
            if (rowTitle === 'clear queue') return;
            const isPlayingRow = nowKey
                ? (rowTrackKey ? rowTrackKey === nowKey : rowTitle === titleTarget)
                : false;

            row.classList.toggle('playing-row', isPlayingRow);
            row.classList.toggle('is-now-playing', isPlayingRow);
            if (isPlayingRow) row.setAttribute('aria-current', 'true');
            else row.removeAttribute('aria-current');

            const liveRemainingLabel = isPlayingRow && snapshot.duration > 0
                ? snapshot.remainingLabel
                : '';

            row.querySelectorAll('.album-track-duration, .zenith-time-pill').forEach((timeEl) => {
                if (!timeEl.dataset.originalDuration) {
                    timeEl.dataset.originalDuration = timeEl.textContent || '';
                }
                timeEl.textContent = liveRemainingLabel || timeEl.dataset.originalDuration;
            });
        });

        // GAP 4: song/carousel cards with data-track-key but not covered by registry or item-clickable paths
        document.querySelectorAll('[data-track-key]').forEach(el => {
            if (!el.isConnected) return;
            const rowTrackKey = String(el.dataset.trackKey || '').trim();
            if (!rowTrackKey || registryHandledKeys.has(rowTrackKey)) return;
            if (el.querySelector('.item-clickable')) return;
            const isPlayingCard = Boolean(nowKey && rowTrackKey === nowKey);
            el.classList.toggle('playing-row', isPlayingCard);
            el.classList.toggle('is-now-playing', isPlayingCard);
            if (isPlayingCard) el.setAttribute('aria-current', 'true');
            else el.removeAttribute('aria-current');
            const liveLabel = isPlayingCard && snapshot.duration > 0 ? snapshot.remainingLabel : '';
            el.querySelectorAll('.album-track-duration, .zenith-time-pill').forEach(timeEl => {
                if (!timeEl.dataset.originalDuration) timeEl.dataset.originalDuration = timeEl.textContent || '';
                timeEl.textContent = liveLabel || timeEl.dataset.originalDuration;
            });
        });

        syncTrackStateButtons();
        document.querySelectorAll('[data-collection-type][data-collection-key]').forEach((node) => {
            const type = node.dataset.collectionType || '';
            const key = node.dataset.collectionKey || '';
            const active = Boolean(type && key && isCollectionActive(type, key));
            node.classList.toggle('is-playing', active);
            node.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function ensureAudioEngine() {
        if (!audioEngine) audioEngine = getEl('audio-engine');
        return audioEngine;
    }

    function loadTrackIntoEngine(track, autoplay = true, startAtBeginning = false) {
        const engine = ensureAudioEngine();
        if (!engine || !track) return;

        const key = getTrackPlaybackCacheKey(track);
        const loadToken = ++activeLoadToken;
        engine.dataset.pendingTrackKey = key;
        engine.dataset.pendingLoadToken = String(loadToken);

        // Show loading state while resolving blob URL
        const playBtn = getRef('play-pause-btn');
        if (playBtn) playBtn.classList.add('loading');

        // Use async resolution to find playable source (blob URL or direct)
        resolvePlayableUrl(track).then(resolvedSrc => {
            if (playBtn) playBtn.classList.remove('loading');
            // Guard: if another track was requested while resolving, skip this one
            if (engine.dataset.pendingTrackKey !== key || engine.dataset.pendingLoadToken !== String(loadToken)) {
                return;
            }
            _loadResolvedTrack(engine, track, resolvedSrc, autoplay, startAtBeginning);
        }).catch(() => {
            if (playBtn) playBtn.classList.remove('loading');
            if (engine.dataset.pendingTrackKey !== key || engine.dataset.pendingLoadToken !== String(loadToken)) return;
            setPlayButtonState(false);
            _showPlaybackError(track);
        });
    }

    function _loadResolvedTrack(engine, track, resolvedSrc, autoplay, startAtBeginning) {
        const hasSrc = !!resolvedSrc;
        if (!hasSrc) {
            setPlayButtonState(false);
            _showPlaybackError(track);
            return;
        }

        const key = getTrackPlaybackCacheKey(track);
        const sourceChanged = engine.dataset.trackKey !== key || engine.src !== resolvedSrc;
        if (sourceChanged) {
            engine.dataset.trackKey = key;
            engine.src = trackPlaybackBlobUrl(resolvedSrc);
            engine.load();
            // Apply ReplayGain for the new track
            applyReplayGain(track);
            // Ensure playback speed persists across tracks
            engine.playbackRate = playbackRate;
        }

        if (startAtBeginning || sourceChanged) {
            const resetToStart = () => {
                try {
                    engine.currentTime = 0;
                } catch (_) {
                    // Ignore seek timing edge cases while media is loading.
                }
                updateProgressUI(0, Number.isFinite(engine.duration) && engine.duration > 0 ? engine.duration : (track.durationSec || 0));
            };
            if (Number.isFinite(engine.duration) && engine.duration > 0) {
                resetToStart();
            } else {
                engine.addEventListener('loadedmetadata', resetToStart, { once: true });
                updateProgressUI(0, track.durationSec || 0);
            }
        } else {
            updateProgressUI(0, track.durationSec || 0);
        }

        if (autoplay) {
            const playPromise = engine.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => setPlayButtonState(true)).catch((err) => {
                    setPlayButtonState(false);
                    if (err && err.name === 'NotAllowedError') {
                        toast('Tap play to start ï¿½ browsers require a user gesture first');
                    } else if (err && err.name === 'NotSupportedError') {
                        // NotSupportedError from play() means source couldn't be loaded, not format issue
                        if (fileHandleCache.size === 0) {
                            toast('Add a music folder in Settings so Auralis can access your files');
                        } else {
                            toast(`Could not load source for "${track.title}" ï¿½ try rescanning`);
                        }
                    } else {
                        toast('Could not play ï¿½ ' + (err?.message || 'unknown error'));
                    }
                });
            } else {
                setPlayButtonState(!engine.paused);
            }
        }
    }

    function _showPlaybackError(track) {
        const raw = String(track.fileUrl || '').trim();
        const isFileProto = /^file:\/\//i.test(raw);
        const isHttpCtx = location.protocol === 'http:' || location.protocol === 'https:';

        if (track._scanned && fileHandleCache.size === 0) {
            toast(`Open Settings and tap Scan Library to enable playback`);
        } else if (track._scanned && track._handleKey && !fileHandleCache.has(track._handleKey)) {
            toast(`"${track.title}" ï¿½ file handle lost, try rescanning`);
        } else if (!raw && !track._scanned) {
            toast(`No audio source for "${track.title}"`);
        } else if (isFileProto && isHttpCtx) {
            if (fileHandleCache.size === 0) {
                toast(`Add a music folder in Settings to play local files`);
            } else {
                toast(`"${track.title}" not found in scanned folders`);
            }
        } else {
            toast(`Cannot load "${track.title}"`);
        }
    }

    function getCurrentQueueIndex() {
        if (!queueTracks.length) return -1;
        if (!nowPlaying) return Math.max(0, Math.min(queueIndex, queueTracks.length - 1));
        const key = getTrackIdentityKey(nowPlaying);
        const idx = queueTracks.findIndex((track) => getTrackIdentityKey(track) === key);
        return idx >= 0 ? idx : Math.max(0, Math.min(queueIndex, queueTracks.length - 1));
    }

    function getQueueRemainingSecondsFromIndex(index, currentSeconds = 0, durationSeconds = 0) {
        if (!Array.isArray(queueTracks) || queueTracks.length === 0) return 0;
        const start = Math.max(0, Math.min(Number(index) || 0, queueTracks.length - 1));
        const currentIdx = getCurrentQueueIndex();
        const currentDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
            ? durationSeconds
            : (nowPlaying?.durationSec || 0);
        const currentElapsed = Math.max(0, Number(currentSeconds || 0));
        let total = 0;

        for (let i = start; i < queueTracks.length; i += 1) {
            const track = queueTracks[i];
            if (!track) continue;
            const baseDuration = getTrackDurationSeconds(track);
            if (i === currentIdx && currentIdx >= 0) {
                const effectiveDuration = Math.max(1, currentDuration || baseDuration);
                const elapsed = Math.max(0, Math.min(effectiveDuration, currentElapsed));
                total += Math.max(0, effectiveDuration - elapsed);
            } else {
                total += Math.max(0, baseDuration);
            }
        }
        return Math.max(0, total);
    }

    function getQueueMetaTimeLabel(index, currentSeconds = 0, durationSeconds = 0) {
        // Cumulative queue timing for meta timeline/summary only.
        const total = getQueueRemainingSecondsFromIndex(index, currentSeconds, durationSeconds);
        return total > 0 ? toDurationLabel(total) : '0:00';
    }

