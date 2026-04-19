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
            const active = isCollectionPlaying('album', albumPlay.dataset.collectionKey || activeAlbumTitle);
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

    function setPlayButtonState(playing) {
        isPlaying = Boolean(playing);

        const miniIcon = getEl('mini-toggle-icon');
        const mainIcon = getEl('player-main-icon');
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
        const elapsedEl = getEl('player-elapsed');
        const remainEl = getEl('player-remaining');
        const miniFill = getEl('mini-progress-fill');
        const fullFill = getEl('player-progress-fill');
        const thumb = getEl('player-progress-thumb');

        const duration = Number.isFinite(durationSeconds) && durationSeconds > 0
            ? durationSeconds
            : (nowPlaying?.durationSec || 0);
        const current = Math.max(0, Number.isFinite(currentSeconds) ? currentSeconds : 0);
        const ratio = (Number.isFinite(duration) && duration > 0) ? Math.max(0, Math.min(1, current / duration)) : 0;
        const pct = `${ratio * 100}%`;

        if (miniFill) miniFill.style.width = pct;
        if (fullFill) fullFill.style.width = pct;
        if (thumb && !isSeeking) thumb.style.left = `calc(${pct} - 7px)`;

        if (elapsedEl) elapsedEl.textContent = toDurationLabel(current);
        if (remainEl) remainEl.textContent = duration > 0
            ? `-${toDurationLabel(Math.max(0, duration - current))}`
            : '--:--';
        updateAlbumProgressLine(current, duration);
        syncTrackActiveStates(current, duration);
    }

    function syncTrackActiveStates(currentSeconds, durationSeconds) {
        const titleTarget = nowPlaying ? String(nowPlaying.title).toLowerCase().trim() : '';
        const nowKey = getNowPlayingTrackKey();

        document.querySelectorAll('.item-clickable').forEach(click => {
            const h3 = click.querySelector('h3');
            if(!h3) return;

            const rowTitle = h3.textContent.toLowerCase().trim();
            if (rowTitle === 'clear queue') return;

            const row = click.closest('.list-item') || click;
            const rowTrackKey = String(row?.dataset?.trackKey || '').trim();
            const isPlayingRow = nowKey
                ? (rowTrackKey ? rowTrackKey === nowKey : rowTitle === titleTarget)
                : false;

            row.classList.toggle('playing-row', isPlayingRow);

            const duration = Number.isFinite(durationSeconds) && durationSeconds > 0
                ? durationSeconds
                : (isPlayingRow ? Number(nowPlaying?.durationSec || 0) : 0);
            const current = Math.max(0, Number.isFinite(currentSeconds) ? currentSeconds : 0);
            const liveRemainingLabel = isPlayingRow && duration > 0
                ? `-${toDurationLabel(Math.max(0, duration - current))}`
                : '';

            row.querySelectorAll('.album-track-duration, .zenith-time-pill').forEach((timeEl) => {
                if (!timeEl.dataset.originalDuration) {
                    timeEl.dataset.originalDuration = timeEl.textContent || '';
                }
                timeEl.textContent = liveRemainingLabel || timeEl.dataset.originalDuration;
            });
        });

        syncTrackStateButtons();
    }

    function ensureAudioEngine() {
        if (!audioEngine) audioEngine = getEl('audio-engine');
        return audioEngine;
    }

    function loadTrackIntoEngine(track, autoplay = true, startAtBeginning = false) {
        const engine = ensureAudioEngine();
        if (!engine || !track) return;

        const key = trackKey(track.title, track.artist);
        engine.dataset.pendingTrackKey = key;

        // Show loading state while resolving blob URL
        const playBtn = getEl('play-pause-btn');
        if (playBtn) playBtn.classList.add('loading');

        // Use async resolution to find playable source (blob URL or direct)
        resolvePlayableUrl(track).then(resolvedSrc => {
            if (playBtn) playBtn.classList.remove('loading');
            // Guard: if another track was requested while resolving, skip this one
            if (engine.dataset.pendingTrackKey !== key) return;
            _loadResolvedTrack(engine, track, resolvedSrc, autoplay, startAtBeginning);
        }).catch(() => {
            if (playBtn) playBtn.classList.remove('loading');
            if (engine.dataset.pendingTrackKey !== key) return;
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

        const key = trackKey(track.title, track.artist);
        const sourceChanged = engine.dataset.trackKey !== key || engine.src !== resolvedSrc;
        if (sourceChanged) {
            engine.dataset.trackKey = key;
            engine.src = resolvedSrc;
            engine.load();
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
                        toast('Tap play to start â€” browsers require a user gesture first');
                    } else if (err && err.name === 'NotSupportedError') {
                        // NotSupportedError from play() means source couldn't be loaded, not format issue
                        if (fileHandleCache.size === 0) {
                            toast('Add a music folder in Settings so Auralis can access your files');
                        } else {
                            toast(`Could not load source for "${track.title}" â€” try rescanning`);
                        }
                    } else {
                        toast('Could not play â€” ' + (err?.message || 'unknown error'));
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
            toast(`Rescan your folders in Settings to enable playback`);
        } else if (track._scanned && track._handleKey && !fileHandleCache.has(track._handleKey)) {
            toast(`"${track.title}" â€” file handle lost, try rescanning`);
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
        const key = trackKey(nowPlaying.title, nowPlaying.artist);
        const idx = queueTracks.findIndex(track => trackKey(track.title, track.artist) === key);
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

    function seekToRatio(ratio) {
        const engine = ensureAudioEngine();
        if (!engine || !Number.isFinite(engine.duration) || engine.duration <= 0) return;
        const clamped = Math.max(0, Math.min(1, ratio));
        engine.currentTime = clamped * engine.duration;
        updateProgressUI(engine.currentTime, engine.duration);
    }

    function togglePlayback(evt) {
        if (evt) {
            evt.preventDefault();
            evt.stopPropagation();
        }
        const engine = ensureAudioEngine();
        if (!engine || !nowPlaying) return;

        const needsInitialLoad = !engine.src || engine.dataset.trackKey !== trackKey(nowPlaying.title, nowPlaying.artist);
        if (needsInitialLoad) {
            loadTrackIntoEngine(nowPlaying, true);
            return;
        }

        if (engine.paused) {
            const playPromise = engine.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => setPlayButtonState(true)).catch((err) => {
                    setPlayButtonState(false);
                    if (err && err.name === 'NotAllowedError') {
                        toast('Tap play to start â€” browsers require a user gesture first');
                    } else {
                        toast('Unable to resume: ' + (err?.message || 'unknown error'));
                    }
                });
            }
        } else {
            engine.pause();
            setPlayButtonState(false);
        }
    }

    function playNext(fromEnded = false) {
        if (!queueTracks.length) return;
        let idx = getCurrentQueueIndex();
        if (idx < 0) idx = 0;

        if (fromEnded && repeatMode === 'one') {
            const track = queueTracks[idx];
            if (track) {
                loadTrackIntoEngine(track, true);
            }
            return;
        }

        if (isShuffleEnabled && queueTracks.length > 1) {
            let nextIdx = idx;
            while (nextIdx === idx) {
                nextIdx = Math.floor(Math.random() * queueTracks.length);
            }
            idx = nextIdx;
        } else if (idx >= queueTracks.length - 1) {
            if (fromEnded && repeatMode === 'all') {
                idx = 0;
            } else if (fromEnded) {
                setPlayButtonState(false);
                return;
            } else {
                idx = 0;
            }
        } else {
            idx += 1;
        }

        queueIndex = idx;
        const track = queueTracks[idx];
        if (!track) return;
        setNowPlaying(track, !fromEnded);
        loadTrackIntoEngine(track, true);
        renderQueue();
    }

    function playPrevious() {
        if (!queueTracks.length) return;
        const engine = ensureAudioEngine();
        if (engine && engine.currentTime > REPLAY_THRESHOLD_SEC) {
            engine.currentTime = 0;
            updateProgressUI(0, engine.duration || nowPlaying?.durationSec || 0);
            return;
        }

        let idx = getCurrentQueueIndex();
        if (idx < 0) idx = 0;
        idx = idx === 0 ? queueTracks.length - 1 : idx - 1;
        queueIndex = idx;

        const track = queueTracks[idx];
        if (!track) return;
        setNowPlaying(track, true);
        loadTrackIntoEngine(track, true);
        renderQueue();
    }

    function toggleShuffle() {
        isShuffleEnabled = !isShuffleEnabled;
        const btn = getEl('player-shuffle-btn');
        if (btn) {
            btn.style.fill = isShuffleEnabled ? 'var(--sys-primary)' : 'rgba(255,255,255,0.8)';
        }
        toast(isShuffleEnabled ? 'Shuffle enabled' : 'Shuffle disabled');
    }

    function toggleRepeatMode() {
        const modes = ['off', 'all', 'one'];
        repeatMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
        const btn = getEl('player-repeat-btn');
        if (btn) {
            btn.style.fill = repeatMode !== 'off' ? 'var(--sys-primary)' : 'rgba(255,255,255,0.8)';
            btn.style.opacity = repeatMode === 'one' ? '1' : '';
            btn.title = repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one';
        }
        const labels = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };
        toast(labels[repeatMode]);
    }

    function bindAudioEngine() {

