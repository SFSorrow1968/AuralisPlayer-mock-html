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
        try { clearInterval(crossfadeState.intervalId); } catch (_) {}
        const oldEngine = crossfadeState.engine;
        if (oldEngine) {
            try { oldEngine.volume = currentVolume; } catch (_) {}
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
            } catch (_) {}
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
                        if (row) row.classList.toggle('playing-row', trackKeyValue === nowKey);
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
            const liveLabel = isPlayingCard && snapshot.duration > 0 ? snapshot.remainingLabel : '';
            el.querySelectorAll('.album-track-duration, .zenith-time-pill').forEach(timeEl => {
                if (!timeEl.dataset.originalDuration) timeEl.dataset.originalDuration = timeEl.textContent || '';
                timeEl.textContent = liveLabel || timeEl.dataset.originalDuration;
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
                        toast('Tap play to start — browsers require a user gesture first');
                    } else if (err && err.name === 'NotSupportedError') {
                        // NotSupportedError from play() means source couldn't be loaded, not format issue
                        if (fileHandleCache.size === 0) {
                            toast('Add a music folder in Settings so Auralis can access your files');
                        } else {
                            toast(`Could not load source for "${track.title}" — try rescanning`);
                        }
                    } else {
                        toast('Could not play — ' + (err?.message || 'unknown error'));
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
            toast(`"${track.title}" — file handle lost, try rescanning`);
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

        const needsInitialLoad = !engine.src || engine.dataset.trackKey !== getTrackPlaybackCacheKey(nowPlaying);
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
                        toast('Tap play to start — browsers require a user gesture first');
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

    function shuffleTrackListInPlace(tracks) {
        if (!Array.isArray(tracks) || tracks.length < 2) return tracks;
        for (let i = tracks.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
        return tracks;
    }

    function shuffleQueueOrder() {
        if (!Array.isArray(queueTracks) || queueTracks.length < 2) return false;
        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0) {
            const prefix = queueTracks.slice(0, currentIdx + 1);
            const upcoming = queueTracks.slice(currentIdx + 1);
            if (upcoming.length < 2) return false;
            shuffleTrackListInPlace(upcoming);
            queueTracks = [...prefix, ...upcoming];
            queueIndex = currentIdx;
            return true;
        }
        queueTracks = shuffleTrackListInPlace(queueTracks.slice());
        queueIndex = Math.max(0, Math.min(queueIndex, queueTracks.length - 1));
        return true;
    }

    function playNext(fromEnded = false) {
        if (!queueTracks.length) return;
        let idx = getCurrentQueueIndex();
        if (idx < 0) idx = 0;

        if (fromEnded && (repeatMode === 'one' || repeatMode === 'two')) {
            const maxRepeats = repeatMode === 'one' ? 1 : 2;
            if (repeatPlayCount < maxRepeats) {
                repeatPlayCount++;
                const track = queueTracks[idx];
                if (track) loadTrackIntoEngine(track, true);
                return;
            }
            repeatPlayCount = 0; // exhausted repeats — fall through to advance
        }

        if (idx >= queueTracks.length - 1) {
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

        // Crossfade: fade out current engine before loading next
        if (crossfadeEnabled && fromEnded) {
            beginCrossfade(ensureAudioEngine());
        }

        // GAP 8: clear stale collection key when queue advances to a different album
        if (activePlaybackCollectionType === 'album' && activePlaybackCollectionKey && activeAlbumTitle) {
            const rawAlbum = String(track.albumTitle || '').trim();
            if (rawAlbum && albumKey(rawAlbum) !== albumKey(activeAlbumTitle)) {
                setPlaybackCollection('', '');
            }
        }

        repeatPlayCount = 0;
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

        // GAP 8: clear stale collection key when going back to a different album
        if (activePlaybackCollectionType === 'album' && activePlaybackCollectionKey && activeAlbumTitle) {
            const rawAlbum = String(track.albumTitle || '').trim();
            if (rawAlbum && albumKey(rawAlbum) !== albumKey(activeAlbumTitle)) {
                setPlaybackCollection('', '');
            }
        }

        repeatPlayCount = 0;
        setNowPlaying(track, true);
        loadTrackIntoEngine(track, true);
        renderQueue();
    }

    function triggerPlayerControlFeedback(button) {
        if (!button) return;
        button.classList.remove('player-control-feedback');
        void button.offsetWidth;
        button.classList.add('player-control-feedback');
        if (button._controlFeedbackTimer) clearTimeout(button._controlFeedbackTimer);
        button._controlFeedbackTimer = setTimeout(() => {
            button.classList.remove('player-control-feedback');
            button._controlFeedbackTimer = null;
        }, 320);
    }

    function toggleShuffle() {
        const btn = getEl('player-shuffle-btn');
        if (btn) {
            btn.style.fill = 'rgba(255,255,255,0.8)';
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('aria-label', 'Shuffle queue');
            btn.title = 'Shuffle';
        }
        const didShuffle = shuffleQueueOrder();
        if (didShuffle) renderQueue();
        triggerPlayerControlFeedback(btn);
    }

    function toggleRepeatMode() {
        const modes = ['off', 'one', 'two', 'all'];
        repeatMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
        repeatPlayCount = 0;
        const btn = getEl('player-repeat-btn');
        const sub = getEl('player-repeat-sub');
        if (btn) {
            btn.style.fill = repeatMode !== 'off' ? 'var(--sys-primary)' : 'rgba(255,255,255,0.8)';
            btn.style.opacity = repeatMode !== 'off' ? '1' : '';
            btn.classList.toggle('repeat-on', repeatMode !== 'off');
            btn.setAttribute('aria-pressed', repeatMode !== 'off' ? 'true' : 'false');
            const labels = { off: 'Repeat off', one: 'Repeat once', two: 'Repeat twice', all: 'Repeat all' };
            btn.setAttribute('aria-label', labels[repeatMode]);
            btn.title = labels[repeatMode];
        }
        if (sub) {
            const subMap = { off: '', one: '1', two: '2', all: '\u221e' };
            sub.textContent = subMap[repeatMode];
            sub.style.display = repeatMode === 'off' ? 'none' : '';
        }
        triggerPlayerControlFeedback(btn);
    }

    // ── Volume Control ──────────────────────────────────────────────
    function setVolume(vol) {
        currentVolume = Math.max(0, Math.min(1, parseFloat(vol) || 0));
        const engine = ensureAudioEngine();
        if (engine) engine.volume = currentVolume;
        safeStorage.setItem(STORAGE_KEYS.volume, String(currentVolume));
        const slider = getRef('player-volume-slider');
        if (slider && parseFloat(slider.value) !== currentVolume) slider.value = currentVolume;
        const icon = getEl('player-volume-icon');
        if (icon) {
            if (currentVolume === 0) icon.textContent = '🔇';
            else if (currentVolume < 0.5) icon.textContent = '🔉';
            else icon.textContent = '🔊';
        }
    }

    function toggleMute() {
        if (currentVolume > 0) {
            safeStorage.setItem(STORAGE_KEYS.previousVolume, String(currentVolume));
            setVolume(0);
        } else {
            setVolume(parseFloat(safeStorage.getItem(STORAGE_KEYS.previousVolume) || '1'));
        }
    }

    // ── Playback Speed ──────────────────────────────────────────────
    function setPlaybackSpeed(rate) {
        playbackRate = Math.max(0.25, Math.min(4, parseFloat(rate) || 1));
        const engine = ensureAudioEngine();
        if (engine) engine.playbackRate = playbackRate;
        safeStorage.setItem(STORAGE_KEYS.speed, String(playbackRate));
        const label = getRef('player-speed-label');
        if (label) label.textContent = playbackRate === 1 ? '1×' : playbackRate.toFixed(2).replace(/0$/, '') + '×';
        toast(`Speed: ${playbackRate}×`);
    }

    function cyclePlaybackSpeed() {
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const idx = speeds.indexOf(playbackRate);
        const next = idx >= 0 ? speeds[(idx + 1) % speeds.length] : 1;
        setPlaybackSpeed(next);
    }

    // ── Sleep Timer ─────────────────────────────────────────────────
    function startSleepTimer(minutes) {
        cancelSleepTimer();
        if (!minutes || minutes <= 0) return;
        const ms = minutes * 60 * 1000;
        sleepTimerEnd = Date.now() + ms;
        sleepTimerId = setTimeout(() => {
            const engine = ensureAudioEngine();
            if (engine && !engine.paused) {
                engine.pause();
                setPlayButtonState(false);
            }
            sleepTimerId = null;
            sleepTimerEnd = 0;
            toast('Sleep timer ended — playback paused');
            updateSleepTimerUI();
        }, ms);
        toast(`Sleep timer: ${minutes} min`);
        updateSleepTimerUI();
    }

    function cancelSleepTimer() {
        if (sleepTimerId) {
            clearTimeout(sleepTimerId);
            sleepTimerId = null;
        }
        sleepTimerEnd = 0;
        updateSleepTimerUI();
    }

    function updateSleepTimerUI() {
        const label = getEl('sleep-timer-label');
        if (!label) return;
        if (sleepTimerEnd > 0) {
            const remaining = Math.max(0, Math.ceil((sleepTimerEnd - Date.now()) / 60000));
            label.textContent = remaining + 'm';
            label.style.display = '';
        } else {
            label.textContent = '';
            label.style.display = 'none';
        }
    }

    // ── Like / Rate / Play Count Helpers ────────────────────────────
    function toggleLikeTrack(track) {
        if (!track) return;
        if (hasTrackSetValue(likedTracks, track)) {
            deleteTrackSetValue(likedTracks, track);
            toast(`Removed "${track.title}" from liked`);
        } else {
            addTrackSetValue(likedTracks, track);
            toast(`Liked "${track.title}"`);
        }
        persistLiked();
        syncLikeButtons();
    }

    function syncLikeButtons() {
        const nowKey = getNowPlayingTrackKey();
        document.querySelectorAll('.like-btn').forEach(btn => {
            const key = btn.dataset.trackKey || nowKey;
            const liked = likedTracks.has(key);
            btn.classList.toggle('is-liked', liked);
            btn.textContent = liked ? '♥' : '♡';
            btn.setAttribute('aria-label', liked ? 'Unlike' : 'Like');
        });
    }

    function rateTrack(track, stars) {
        if (!track) return;
        const rating = Math.max(0, Math.min(5, parseInt(stars, 10) || 0));
        if (rating === 0) {
            deleteTrackMapValue(trackRatings, track);
            toast(`Cleared rating for "${track.title}"`);
        } else {
            setTrackMapValue(trackRatings, track, rating);
            toast(`Rated "${track.title}" ${rating}★`);
        }
        persistRatings();
    }

    function getPlayCount(track) {
        if (!track) return 0;
        return Number(getTrackMapValue(playCounts, track) || 0);
    }

    // ── ReplayGain Normalization (Web Audio API) ────────────────────
    // ── Web Audio Graph builder ─────────────────────────────────────
    function ensureEqNodes() {
        if (!audioContext || eqNodes.length === EQ_FREQUENCIES.length) return;
        eqNodes = EQ_FREQUENCIES.map((freq, i) => {
            const node = audioContext.createBiquadFilter();
            node.type = EQ_BAND_TYPES[i];
            node.frequency.value = freq;
            node.gain.value = eqBandGains[i] || 0;
            if (node.type === 'peaking') node.Q.value = 1.41;
            return node;
        });
    }

    function rebuildAudioGraph() {
        if (!audioContext || !sourceNode || !gainNode) return;
        try { sourceNode.disconnect(); } catch (_) {}
        try { gainNode.disconnect(); } catch (_) {}
        eqNodes.forEach(n => { try { n.disconnect(); } catch (_) {} });
        sourceNode.connect(gainNode);
        if (eqEnabled && eqNodes.length === EQ_FREQUENCIES.length) {
            gainNode.connect(eqNodes[0]);
            for (let i = 0; i < eqNodes.length - 1; i++) eqNodes[i].connect(eqNodes[i + 1]);
            eqNodes[eqNodes.length - 1].connect(audioContext.destination);
        } else {
            gainNode.connect(audioContext.destination);
        }
    }

    function applyReplayGain(track) {
        if (!replayGainEnabled && !eqEnabled) {
            if (gainNode) { try { gainNode.gain.value = 1; } catch (_) {} }
            return;
        }
        const engine = ensureAudioEngine();
        if (!engine) return;
        try {
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') audioContext.resume();
            const needsInit = !sourceNode;
            if (needsInit) {
                sourceNode = audioContext.createMediaElementSource(engine);
                gainNode = audioContext.createGain();
            }
            // Prefer track gain, fall back to album gain, then 0 dB
            const gainDb = replayGainEnabled
                ? (Number.isFinite(track?.replayGainTrack) ? track.replayGainTrack
                   : Number.isFinite(track?.replayGainAlbum) ? track.replayGainAlbum : 0)
                : 0;
            gainNode.gain.value = Math.pow(10, gainDb / 20);
            if (needsInit || eqNodes.length !== EQ_FREQUENCIES.length) {
                ensureEqNodes();
                rebuildAudioGraph();
            }
        } catch (_) {}
    }

    function disconnectReplayGain() {
        if (gainNode) { try { gainNode.gain.value = 1; } catch (_) {} }
    }

    function toggleReplayGain() {
        replayGainEnabled = !replayGainEnabled;
        safeStorage.setItem(STORAGE_KEYS.replayGain, replayGainEnabled ? '1' : '0');
        if (nowPlaying) applyReplayGain(nowPlaying);
        toast(replayGainEnabled ? 'ReplayGain enabled' : 'ReplayGain disabled');
    }

    // ── Equalizer ──────────────────────────────────────────────────
    const EQ_PRESETS = {
        flat:         [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        bass_boost:   [8, 7, 6, 4, 2, 0, 0, 0, 0, 0],
        treble_boost: [0, 0, 0, 0, 0, 0, 2, 4, 6, 8],
        vocal:        [-2, -2, 0, 2, 5, 6, 5, 3, 2, 1],
        electronic:   [6, 5, 1, 0, -3, -2, 0, 2, 4, 6],
        rock:         [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
    };

    function persistEq() {
        safeStorage.setJson(STORAGE_KEYS.eqBands, eqBandGains);
    }

    function applyEqValues() {
        eqNodes.forEach((node, i) => {
            try { node.gain.value = eqBandGains[i] || 0; } catch (_) {}
        });
        renderEqSliders();
    }

    function setEqBand(bandIndex, gainDb) {
        const i = Number(bandIndex);
        const g = Math.max(-12, Math.min(12, Number(gainDb) || 0));
        if (i < 0 || i >= EQ_FREQUENCIES.length) return;
        eqBandGains[i] = g;
        if (eqNodes[i]) { try { eqNodes[i].gain.value = g; } catch (_) {} }
        persistEq();
        renderEqSliders();
    }

    function toggleEq() {
        eqEnabled = !eqEnabled;
        safeStorage.setItem(STORAGE_KEYS.eq, eqEnabled ? '1' : '0');
        if (eqEnabled) {
            const engine = ensureAudioEngine();
            if (engine && !audioContext) {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (audioContext.state === 'suspended') audioContext.resume();
                    sourceNode = audioContext.createMediaElementSource(engine);
                    gainNode = audioContext.createGain();
                    gainNode.gain.value = 1;
                } catch (_) {}
            }
            ensureEqNodes();
        }
        rebuildAudioGraph();
        renderEqPanel();
        toast(eqEnabled ? 'Equalizer on' : 'Equalizer bypassed');
    }

    function setEqPreset(name) {
        const gains = EQ_PRESETS[name];
        if (!gains) return;
        eqBandGains = [...gains];
        applyEqValues();
        persistEq();
        document.querySelectorAll('#eq-presets .filter-chip').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.preset === name));
        const label = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        toast(`EQ: ${label}`);
    }

    function renderEqSliders() {
        const container = getEl('eq-bands');
        if (!container) return;
        container.querySelectorAll('.eq-band-slider').forEach((slider, i) => {
            if (parseFloat(slider.value) !== eqBandGains[i]) slider.value = String(eqBandGains[i] || 0);
            const valueEl = slider.closest('.eq-band')?.querySelector('.eq-band-value');
            if (valueEl) {
                const g = eqBandGains[i] || 0;
                valueEl.textContent = (g > 0 ? '+' : '') + g + 'dB';
            }
        });
    }

    function renderEqPanel() {
        const toggle = getEl('eq-toggle-btn');
        if (toggle) toggle.classList.toggle('active', eqEnabled);
        const container = getEl('eq-bands');
        if (!container) return;
        if (container.children.length > 0) { renderEqSliders(); return; }
        EQ_FREQUENCIES.forEach((freq, i) => {
            const band = document.createElement('div');
            band.className = 'eq-band';
            const g = eqBandGains[i] || 0;
            const valueEl = document.createElement('div');
            valueEl.className = 'eq-band-value';
            valueEl.textContent = (g > 0 ? '+' : '') + g + 'dB';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'eq-band-slider';
            slider.min = '-12'; slider.max = '12'; slider.step = '0.5';
            slider.value = String(g);
            slider.dataset.band = String(i);
            slider.addEventListener('input', e => setEqBand(i, parseFloat(e.target.value)));
            const label = document.createElement('div');
            label.className = 'eq-band-label';
            label.textContent = freq >= 1000 ? (freq / 1000) + 'k' : String(freq);
            band.appendChild(valueEl);
            band.appendChild(slider);
            band.appendChild(label);
            container.appendChild(band);
        });
    }

    function openEq() {
        const panel = getEl('eq-panel');
        if (!panel) return;
        panel.style.display = 'flex';
        renderEqPanel();
        const eqBtn = getEl('player-eq-btn');
        if (eqBtn) eqBtn.classList.add('eq-active');
        document.querySelectorAll('#eq-presets .filter-chip').forEach(btn => {
            const preset = EQ_PRESETS[btn.dataset.preset];
            btn.classList.toggle('active', !!preset && preset.every((v, i) => Math.abs(v - (eqBandGains[i] || 0)) < 0.1));
        });
    }

    function closeEq() {
        const panel = getEl('eq-panel');
        if (panel) panel.style.display = 'none';
        const eqBtn = getEl('player-eq-btn');
        if (eqBtn) eqBtn.classList.remove('eq-active');
    }

    // ── Gapless Playback ───────────────────────────────────────────
    function getNextQueueTrack() {
        if (!queueTracks.length || repeatMode === 'one' || repeatMode === 'two') return null;
        const idx = getCurrentQueueIndex();
        if (idx < 0) return null;
        if (idx >= queueTracks.length - 1) return repeatMode === 'all' ? queueTracks[0] : null;
        return queueTracks[idx + 1];
    }

    function scheduleGaplessPreload(track) {
        if (!track || gaplessPreloading) return;
        const key = getTrackIdentityKey(track);
        if (blobUrlCache.has(key)) return;
        gaplessPreloading = true;
        resolvePlayableUrl(track).then(() => { gaplessPreloading = false; }).catch(() => { gaplessPreloading = false; });
    }

    function toggleGapless() {
        gaplessEnabled = !gaplessEnabled;
        safeStorage.setItem(STORAGE_KEYS.gapless, gaplessEnabled ? '1' : '0');
        const toggle = getEl('settings-gapless-toggle');
        if (toggle) toggle.classList.toggle('active', gaplessEnabled);
        toast(gaplessEnabled ? 'Gapless playback enabled' : 'Gapless playback disabled');
    }

    // ── Crossfade ───────────────────────────────────────────────────
    function toggleCrossfade() {
        crossfadeEnabled = !crossfadeEnabled;
        safeStorage.setItem(STORAGE_KEYS.crossfade, crossfadeEnabled ? '1' : '0');
        toast(crossfadeEnabled ? 'Crossfade enabled' : 'Crossfade disabled');
    }

    // ── Lyrics Display ──────────────────────────────────────────────
    function isLyricsPanelVisible() {
        const panel = getEl('lyrics-panel');
        return Boolean(panel && panel.style.display !== 'none' && panel.style.display !== '');
    }

    function resolveLyricsTrack(track = nowPlaying) {
        const candidates = [];
        if (track) candidates.push(track);

        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0 && currentIdx < queueTracks.length) {
            const currentQueueTrack = queueTracks[currentIdx];
            if (currentQueueTrack && !candidates.some((candidate) => isSameTrack(candidate, currentQueueTrack))) {
                candidates.push(currentQueueTrack);
            }
        }

        let fallback = null;
        for (const candidate of candidates) {
            const hydrated = hydratePlaybackTrack(candidate);
            if (hydrated?.lyrics) return hydrated;
            if (candidate?.lyrics) return candidate;
            if (!fallback && hydrated) fallback = hydrated;
            if (!fallback && candidate) fallback = candidate;
        }

        return fallback;
    }

    function renderLyricsContent(track = nowPlaying) {
        const content = getEl('lyrics-content');
        if (!content) return;

        const lyricsTrack = resolveLyricsTrack(track);
        if (!lyricsTrack) {
            content.textContent = 'No track playing';
            return;
        }

        const lyrics = String(lyricsTrack.lyrics || '').trim();
        content.textContent = lyrics || 'No lyrics available for this track';
    }

    function syncLyricsPanel(track = nowPlaying) {
        if (!isLyricsPanelVisible()) return;
        renderLyricsContent(track);
    }

    function showLyrics() {
        const panel = getEl('lyrics-panel');
        if (!panel) return;
        renderLyricsContent(nowPlaying);
        panel.style.display = 'block';
    }

    function hideLyrics() {
        const panel = getEl('lyrics-panel');
        if (panel) panel.style.display = 'none';
    }

    function toggleLyrics() {
        if (isLyricsPanelVisible()) hideLyrics();
        else showLyrics();
    }

    // ── User Playlists CRUD ─────────────────────────────────────────
    function createUserPlaylist(name) {
        const id = 'upl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const pl = { id, name: String(name || 'New Playlist').trim(), tracks: [], created: Date.now() };
        userPlaylists.push(pl);
        persistUserPlaylists();
        toast(`Created playlist "${pl.name}"`);
        return pl;
    }

    function deleteUserPlaylist(id) {
        const idx = userPlaylists.findIndex(p => p.id === id);
        if (idx < 0) return;
        const name = userPlaylists[idx].name;
        userPlaylists.splice(idx, 1);
        persistUserPlaylists();
        toast(`Deleted playlist "${name}"`);
    }

    function renameUserPlaylist(id, newName) {
        const pl = userPlaylists.find(p => p.id === id);
        if (!pl) return;
        pl.name = String(newName || pl.name).trim();
        persistUserPlaylists();
        toast(`Renamed to "${pl.name}"`);
    }

    function addTrackToUserPlaylist(playlistId, track) {
        const pl = userPlaylists.find(p => p.id === playlistId);
        if (!pl || !track) return;
        const playlistTrack = hydratePlaybackTrack(track);
        if (!playlistTrack) return;
        pl.tracks.push(playlistTrack);
        persistUserPlaylists();
        toast(`Added "${track.title}" to "${pl.name}"`);
    }

    function removeTrackFromUserPlaylist(playlistId, trackIndex) {
        const pl = userPlaylists.find(p => p.id === playlistId);
        if (!pl || trackIndex < 0 || trackIndex >= pl.tracks.length) return;
        const removed = pl.tracks.splice(trackIndex, 1)[0];
        persistUserPlaylists();
        toast(`Removed "${removed?.title || 'track'}" from "${pl.name}"`);
    }

    // ── Smart / Dynamic Playlists ───────────────────────────────────
    function generateSmartPlaylist(rule) {
        let tracks = [...LIBRARY_TRACKS];
        const r = String(rule || '').toLowerCase();
        if (r === 'most-played') {
            tracks = tracks.filter(t => getPlayCount(t) > 0).sort((a, b) => getPlayCount(b) - getPlayCount(a)).slice(0, 50);
        } else if (r === 'recently-played') {
            tracks = tracks.filter((track) => getTrackMapValue(lastPlayed, track))
                .sort((a, b) => (getTrackMapValue(lastPlayed, b) || 0) - (getTrackMapValue(lastPlayed, a) || 0))
                .slice(0, 50);
        } else if (r === 'liked') {
            tracks = tracks.filter((track) => hasTrackSetValue(likedTracks, track));
        } else if (r === 'top-rated') {
            tracks = tracks.filter((track) => Number(getTrackMapValue(trackRatings, track) || 0) >= 4)
                .sort((a, b) => (getTrackMapValue(trackRatings, b) || 0) - (getTrackMapValue(trackRatings, a) || 0));
        } else if (r === 'never-played') {
            tracks = tracks.filter((track) => !getTrackMapValue(playCounts, track));
        } else if (r === 'short') {
            tracks = tracks.filter(t => t.durationSec > 0 && t.durationSec <= 180);
        } else if (r === 'long') {
            tracks = tracks.filter(t => t.durationSec > 600);
        }
        return tracks;
    }

    // ── Queue Persistence ───────────────────────────────────────────
    function restoreQueue() {
        try {
            const raw = safeStorage.getItem(STORAGE_KEYS.queue);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!Array.isArray(data.tracks) || data.tracks.length === 0) return;
            queueTracks = data.tracks.map((track) => hydratePlaybackTrack(track)).filter(Boolean);
            if (!queueTracks.length) return;
            queueIndex = Math.max(0, Math.min(data.index || 0, queueTracks.length - 1));
            const track = queueTracks[queueIndex];
            if (track) setNowPlaying(track, false);
        } catch (_) {}
    }

    // ── Audio Format Details ────────────────────────────────────────
    function updateFormatDetails() {
        const engine = ensureAudioEngine();
        const badge = getEl('player-format-badge');
        const qualBadge = getEl('player-quality-badge');
        if (!engine || !nowPlaying) return;
        const ext = (nowPlaying.ext || '').toUpperCase();
        const isLossless = ext === 'FLAC' || ext === 'WAV' || ext === 'ALAC';
        if (badge) badge.textContent = ext || 'AUDIO';
        if (qualBadge) qualBadge.textContent = isLossless ? 'LOSSLESS' : 'LOSSY';
    }

    function bindAudioEngine() {
