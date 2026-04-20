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
    }

    function syncTrackActiveStates(currentSeconds, durationSeconds) {
        const titleTarget = nowPlaying ? String(nowPlaying.title).toLowerCase().trim() : '';
        const nowKey = getNowPlayingTrackKey();
        const snapshot = getProgressSnapshot(currentSeconds, durationSeconds);

        if (nowKey) {
            const bindings = getTrackUiBindings(nowKey);
            if (bindings.length) {
                Array.from(trackUiRegistry.keys()).forEach((trackKeyValue) => {
                    getTrackUiBindings(trackKeyValue).forEach((binding) => {
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
                if (/^blob:/i.test(String(resolvedSrc || ''))) revokePlaybackBlobUrl(resolvedSrc);
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

        const key = trackKey(track.title, track.artist);
        const sourceChanged = engine.dataset.trackKey !== key || engine.src !== resolvedSrc;
        if (sourceChanged) {
            const previousSrc = String(engine.src || '');
            if (/^blob:/i.test(previousSrc) && previousSrc !== resolvedSrc) {
                revokePlaybackBlobUrl(previousSrc);
            }
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

        // Crossfade: fade out current engine before loading next
        if (crossfadeEnabled && fromEnded) {
            beginCrossfade(ensureAudioEngine());
        }

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
        const key = trackKey(track.title, track.artist);
        if (likedTracks.has(key)) {
            likedTracks.delete(key);
            toast(`Removed "${track.title}" from liked`);
        } else {
            likedTracks.add(key);
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
        const key = trackKey(track.title, track.artist);
        const rating = Math.max(0, Math.min(5, parseInt(stars, 10) || 0));
        if (rating === 0) {
            trackRatings.delete(key);
            toast(`Cleared rating for "${track.title}"`);
        } else {
            trackRatings.set(key, rating);
            toast(`Rated "${track.title}" ${rating}★`);
        }
        persistRatings();
    }

    function getPlayCount(track) {
        if (!track) return 0;
        return playCounts.get(trackKey(track.title, track.artist)) || 0;
    }

    // ── ReplayGain Normalization (Web Audio API) ────────────────────
    function applyReplayGain(track) {
        if (!replayGainEnabled) {
            disconnectReplayGain();
            return;
        }
        const engine = ensureAudioEngine();
        if (!engine) return;
        try {
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') audioContext.resume();
            if (!sourceNode) {
                sourceNode = audioContext.createMediaElementSource(engine);
                gainNode = audioContext.createGain();
                sourceNode.connect(gainNode);
                gainNode.connect(audioContext.destination);
            }
            // Prefer track gain, fall back to album gain, then 0 dB
            const gainDb = Number.isFinite(track?.replayGainTrack) ? track.replayGainTrack
                         : Number.isFinite(track?.replayGainAlbum) ? track.replayGainAlbum
                         : 0;
            gainNode.gain.value = Math.pow(10, gainDb / 20);
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

    // ── Crossfade / Gapless ─────────────────────────────────────────
    function toggleCrossfade() {
        crossfadeEnabled = !crossfadeEnabled;
        safeStorage.setItem(STORAGE_KEYS.crossfade, crossfadeEnabled ? '1' : '0');
        toast(crossfadeEnabled ? 'Crossfade enabled' : 'Crossfade disabled');
    }

    // ── Lyrics Display ──────────────────────────────────────────────
    function showLyrics() {
        const panel = getEl('lyrics-panel');
        if (!panel) return;
        const content = getEl('lyrics-content');
        if (!content) return;
        const track = nowPlaying;
        if (!track) { content.textContent = 'No track playing'; panel.style.display = 'block'; return; }
        const key = trackKey(track.title, track.artist);
        const stored = trackByKey.get(key);
        const lyrics = stored?.lyrics || track.lyrics || '';
        content.textContent = lyrics || 'No lyrics available for this track';
        panel.style.display = 'block';
    }

    function hideLyrics() {
        const panel = getEl('lyrics-panel');
        if (panel) panel.style.display = 'none';
    }

    function toggleLyrics() {
        const panel = getEl('lyrics-panel');
        if (panel && panel.style.display !== 'none' && panel.style.display !== '') hideLyrics();
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
        pl.tracks.push({ title: track.title, artist: track.artist, albumTitle: track.albumTitle, duration: track.duration, durationSec: track.durationSec, no: track.no || track.trackNo });
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
            tracks = tracks.filter(t => lastPlayed.has(trackKey(t.title, t.artist)))
                .sort((a, b) => (lastPlayed.get(trackKey(b.title, b.artist)) || 0) - (lastPlayed.get(trackKey(a.title, a.artist)) || 0)).slice(0, 50);
        } else if (r === 'liked') {
            tracks = tracks.filter(t => likedTracks.has(trackKey(t.title, t.artist)));
        } else if (r === 'top-rated') {
            tracks = tracks.filter(t => (trackRatings.get(trackKey(t.title, t.artist)) || 0) >= 4)
                .sort((a, b) => (trackRatings.get(trackKey(b.title, b.artist)) || 0) - (trackRatings.get(trackKey(a.title, a.artist)) || 0));
        } else if (r === 'never-played') {
            tracks = tracks.filter(t => !playCounts.has(trackKey(t.title, t.artist)));
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
            queueTracks = data.tracks;
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

