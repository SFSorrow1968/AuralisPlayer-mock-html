/*
 * Auralis JS shard: 03b-playback-controls.js
 * Purpose: seek, playback toggle, shuffle, next/prev, speed, sleep timer, EQ nodes
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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
                        toast('Tap play to start ï¿½ browsers require a user gesture first');
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

        if (fromEnded && repeatMode === 'one') {
            if (repeatPlayCount < 1) {
                repeatPlayCount++;
                const track = queueTracks[idx];
                if (track) loadTrackIntoEngine(track, true);
                return;
            }
            repeatPlayCount = 0; // exhausted repeats ï¿½ fall through to advance
        }

        if (idx >= queueTracks.length - 1) {
            if (fromEnded && repeatMode === 'all') {
                idx = 0; // cycle queue back to start
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
        const modes = ['off', 'all', 'one'];
        repeatMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
        repeatPlayCount = 0;
        const btn = getEl('player-repeat-btn');
        const sub = getEl('player-repeat-sub');
        if (btn) {
            btn.style.fill = repeatMode !== 'off' ? 'var(--sys-primary)' : 'rgba(255,255,255,0.8)';
            btn.style.opacity = repeatMode !== 'off' ? '1' : '';
            btn.classList.toggle('repeat-on', repeatMode !== 'off');
            btn.setAttribute('aria-pressed', repeatMode !== 'off' ? 'true' : 'false');
            const labels = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat once' };
            btn.setAttribute('aria-label', labels[repeatMode]);
            btn.title = labels[repeatMode];
        }
        if (sub) {
            const subMap = { off: '', all: '\u221e', one: '1' };
            sub.textContent = subMap[repeatMode];
            sub.style.display = repeatMode === 'off' ? 'none' : '';
        }
        triggerPlayerControlFeedback(btn);
    }

    // -- Volume Control ----------------------------------------------
    function setVolume(vol) {
        currentVolume = Math.max(0, Math.min(1, parseFloat(vol) || 0));
        const engine = ensureAudioEngine();
        if (engine) engine.volume = currentVolume;
        safeStorage.setItem(STORAGE_KEYS.volume, String(currentVolume));
        const slider = getRef('player-volume-slider');
        if (slider && parseFloat(slider.value) !== currentVolume) slider.value = currentVolume;
        const icon = getEl('player-volume-icon');
        if (icon) {
            if (currentVolume === 0) icon.textContent = '??';
            else if (currentVolume < 0.5) icon.textContent = '??';
            else icon.textContent = '??';
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

    // -- Playback Speed ----------------------------------------------
    function formatPlaybackRateLabel(rate) {
        const value = Math.max(0.25, Math.min(4, parseFloat(rate) || 1));
        return `${value.toFixed(2).replace(/\.?0+$/, '')}x`;
    }

    function setPlaybackSpeed(rate) {
        playbackRate = Math.max(0.25, Math.min(4, parseFloat(rate) || 1));
        const engine = ensureAudioEngine();
        if (engine) engine.playbackRate = playbackRate;
        safeStorage.setItem(STORAGE_KEYS.speed, String(playbackRate));
        const label = getRef('player-speed-label');
        if (label) label.textContent = formatPlaybackRateLabel(playbackRate);
        toast(`Speed: ${formatPlaybackRateLabel(playbackRate)}`);
    }

    function cyclePlaybackSpeed() {
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const idx = speeds.indexOf(playbackRate);
        const next = idx >= 0 ? speeds[(idx + 1) % speeds.length] : 1;
        setPlaybackSpeed(next);
    }

    // -- Sleep Timer -------------------------------------------------
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
            toast('Sleep timer ended ï¿½ playback paused');
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

    // -- Like / Rate / Play Count Helpers ----------------------------
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
            btn.textContent = liked ? '?' : '?';
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
            toast(`Rated "${track.title}" ${rating}?`);
        }
        persistRatings();
    }

    function getPlayCount(track) {
        if (!track) return 0;
        return Number(getTrackMapValue(playCounts, track) || 0);
    }

    // -- ReplayGain Normalization (Web Audio API) --------------------
    // -- Web Audio Graph builder -------------------------------------
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
        try { sourceNode.disconnect(); } catch (_) { /* benign: cleanup */ }
        try { gainNode.disconnect(); } catch (_) { /* benign: cleanup */ }
        eqNodes.forEach(n => { try { n.disconnect(); } catch (_) { /* benign: cleanup */ } });
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
            if (gainNode) { try { gainNode.gain.value = 1; } catch (_) { /* benign: cleanup */ } }
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
        } catch (_) { /* benign: cleanup */ }
    }

    function disconnectReplayGain() {
        if (gainNode) { try { gainNode.gain.value = 1; } catch (_) { /* benign: cleanup */ } }
    }

    function toggleReplayGain() {
        replayGainEnabled = !replayGainEnabled;
        safeStorage.setItem(STORAGE_KEYS.replayGain, replayGainEnabled ? '1' : '0');
        if (nowPlaying) applyReplayGain(nowPlaying);
        toast(replayGainEnabled ? 'ReplayGain enabled' : 'ReplayGain disabled');
    }

    // -- Equalizer --------------------------------------------------
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
            try { node.gain.value = eqBandGains[i] || 0; } catch (_) { /* benign: cleanup */ }
        });
        renderEqSliders();
    }

    function setEqBand(bandIndex, gainDb) {
        const i = Number(bandIndex);
        const g = Math.max(-12, Math.min(12, Number(gainDb) || 0));
        if (i < 0 || i >= EQ_FREQUENCIES.length) return;
        eqBandGains[i] = g;
        if (eqNodes[i]) { try { eqNodes[i].gain.value = g; } catch (_) { /* benign: cleanup */ } }
        persistEq();
        renderEqSliders();
    }

