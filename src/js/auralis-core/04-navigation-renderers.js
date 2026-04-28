/*
 * Auralis JS shard: 04-navigation-renderers.js
 * Purpose: screen navigation, search, album/playlist/artist rendering, queue views
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        const engine = ensureAudioEngine();
        if (!engine || engine.dataset.bound === '1') return;
        engine.dataset.bound = '1';

        engine.addEventListener('play', () => setPlayButtonState(true));
        engine.addEventListener('pause', () => setPlayButtonState(false));
        engine.addEventListener('timeupdate', () => {
            if (isSeeking) return;
            updateProgressUI(engine.currentTime, engine.duration || nowPlaying?.durationSec || 0);
            // Record album progress for Jump Back In / In Progress sections
            if (nowPlaying && activePlaybackCollectionType === 'album' && activeAlbumTitle) {
                recordAlbumProgress(activeAlbumTitle, queueIndex, engine.currentTime, engine.duration || nowPlaying.durationSec || 0, activeAlbumArtist);
            }
        });
        engine.addEventListener('loadedmetadata', () => {
            if (!nowPlaying) return;
            if (Number.isFinite(engine.duration) && engine.duration > 0) {
                nowPlaying.durationSec = Math.round(engine.duration);
                nowPlaying.duration = toDurationLabel(nowPlaying.durationSec);
                updateProgressUI(engine.currentTime, engine.duration);
                renderQueue();
            }
        });
        engine.addEventListener('ended', () => {
            // Increment play count for completed track
            if (nowPlaying) {
                const nextCount = Number(getTrackMapValue(playCounts, nowPlaying) || 0) + 1;
                setTrackMapValue(playCounts, nowPlaying, nextCount);
                setTrackMapValue(lastPlayed, nowPlaying, Date.now());
                persistPlayCounts();
                persistLastPlayed();
                // Project live stats onto the track object for section sorting
                nowPlaying.plays = nextCount;
                nowPlaying.lastPlayedDays = 0;
            }
            // Clear album progress if we just finished the last track
            if (activePlaybackCollectionType === 'album' && activeAlbumTitle && queueIndex >= queueTracks.length - 1) {
                clearAlbumProgress(activeAlbumTitle, activeAlbumArtist);
            }
            playNext(true);
        });
        engine.addEventListener('error', () => {
            const err = engine.error;
            const trackTitle = nowPlaying?.title || 'current track';
            if (err) {
                const code = err.code;
                if (code === 4) {
                    // MEDIA_ERR_SRC_NOT_SUPPORTED â€” usually means file path is inaccessible, not format
                    const raw = String(nowPlaying?.fileUrl || '').trim();
                    const isFileProto = /^file:\/\//i.test(raw);
                    if (isFileProto && fileHandleCache.size === 0) {
                        toast(`Add a music folder in Settings to play local files`);
                    } else if (isFileProto) {
                        toast(`"${trackTitle}" not found in scanned folders â€” try rescanning`);
                    } else {
                        toast(`Source not loadable for "${trackTitle}"`);
                    }
                } else {
                    const codes = { 1: 'Load aborted', 2: 'Network error', 3: 'Decode failed' };
                    const reason = codes[code] || ('Error code ' + code);
                    toast(`${reason} for "${trackTitle}"`);
                }
            } else {
                toast(`Playback failed for "${trackTitle}"`);
            }
        });

        const miniTrack = getEl('mini-progress-track');
        if (miniTrack && miniTrack.dataset.bound !== '1') {
            miniTrack.dataset.bound = '1';
            miniTrack.addEventListener('click', (e) => {
                e.stopPropagation();
                const rect = miniTrack.getBoundingClientRect();
                seekToRatio((e.clientX - rect.left) / Math.max(1, rect.width));
            });
        }

        const fullTrack = getEl('player-progress-track');
        if (fullTrack && fullTrack.dataset.bound !== '1') {
            fullTrack.dataset.bound = '1';
            const thumb = getEl('player-progress-thumb');
            fullTrack.addEventListener('pointerdown', (e) => {
                isSeeking = true;
                fullTrack.setPointerCapture(e.pointerId);
                if (thumb) thumb.style.opacity = '1';
                const rect = fullTrack.getBoundingClientRect();
                seekToRatio((e.clientX - rect.left) / Math.max(1, rect.width));
            });
            fullTrack.addEventListener('pointermove', (e) => {
                if (!isSeeking) return;
                const rect = fullTrack.getBoundingClientRect();
                seekToRatio((e.clientX - rect.left) / Math.max(1, rect.width));
            });
            fullTrack.addEventListener('pointerup', () => {
                isSeeking = false;
                if (thumb) thumb.style.opacity = '';
            });
            fullTrack.addEventListener('pointercancel', () => {
                isSeeking = false;
                if (thumb) thumb.style.opacity = '';
            });
        }

        // Apply persisted volume
        engine.volume = Math.max(0, Math.min(1, currentVolume));
        const volSlider = getEl('player-volume-slider');
        if (volSlider) {
            volSlider.value = engine.volume;
            if (volSlider.dataset.bound !== '1') {
                volSlider.dataset.bound = '1';
                volSlider.addEventListener('input', () => setVolume(volSlider.value));
            }
        }

        // Apply persisted playback speed
        engine.playbackRate = playbackRate;

        // MediaSession API integration
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => { if (engine.paused) togglePlayback(); });
            navigator.mediaSession.setActionHandler('pause', () => { if (!engine.paused) togglePlayback(); });
            navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
            navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime != null && Number.isFinite(details.seekTime)) {
                    engine.currentTime = details.seekTime;
                    updateProgressUI(engine.currentTime, engine.duration || 0);
                }
            });
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                engine.currentTime = Math.max(0, engine.currentTime - (details.seekOffset || 10));
            });
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                engine.currentTime = Math.min(engine.duration || 0, engine.currentTime + (details.seekOffset || 10));
            });
        }
    }

    function isOnboardingVisible() {
        const ob = getEl('onboarding');
        return !!ob && ob.style.display !== 'none';
    }

    function isSetupVisible() {
        const setup = getEl('first-time-setup');
        return !!setup && setup.style.display !== 'none';
    }

    function syncBottomNavVisibility() {
        const nav = getEl('bottom-nav');
        if (!nav) return;

        const playerOpen = getEl('player')?.classList.contains('active');
        const onboardingOpen = isOnboardingVisible();
        const setupOpen = isSetupVisible();
        nav.classList.toggle('hidden', Boolean(playerOpen || onboardingOpen || setupOpen || albumArtViewerOpen));
    }

    let _toastQueue = [];
    let _toastActive = false;
    function toast(msg) {
        const t = getEl('toast');
        if (!t) return;
        if (_toastActive) {
            // Replace current toast immediately if one is showing
            _toastQueue.length = 0;
            t.classList.remove('show');
            // Brief pause so the transition resets before showing next
            requestAnimationFrame(() => requestAnimationFrame(() => {
                _showToast(t, msg);
            }));
        } else {
            _showToast(t, msg);
        }
    }
    function _showToast(t, msg) {
        _toastActive = true;
        t.innerText = msg;
        t.classList.add('show');
        setTimeout(() => {
            t.classList.remove('show');
            _toastActive = false;
            if (_toastQueue.length) _showToast(t, _toastQueue.shift());
        }, 2200);
    }

    // Navigation
    function switchTab(id, el) {
        if (id === activeId) return;
        // Exit search mode when leaving library
        if (activeId === 'library' && typeof exitSearchMode === 'function') exitSearchMode();
        const outgoing = getEl(activeId);
        const incoming = getEl(id);
        if (!incoming || !outgoing) return;

        outgoing.classList.remove('active');
        outgoing.classList.add('behind');

        getEl('tabs')?.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        if (el) el.classList.add('active');

        incoming.classList.remove('behind');
        // Double-rAF ensures the browser commits the initial state before triggering transition
        requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.add('active')));

        activeId = id;
        historyStack = [id];
        syncBottomNavVisibility();
    }

    function push(id) {
        const incoming = getEl(id);
        const outgoing = getEl(activeId);
        if (!incoming || !outgoing || id === activeId) return;

        // Queue should take over interaction focus from full-player overlay.
        if (id === 'queue') {
            const player = getEl('player');
            if (player?.classList.contains('active')) {
                player.classList.remove('active');
                pOpen = false;
            }
        }

        outgoing.classList.remove('active');
        outgoing.classList.add('behind');

        incoming.classList.remove('behind');
        requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.add('active')));

        historyStack.push(id);
        activeId = id;
        syncBottomNavVisibility();

        // Screen-enter hooks
        if (id === 'settings') renderSettingsFolderList();
    }

    function pop() {
        if (historyStack.length <= 1) return;
        const outId = historyStack.pop();
        const inId = historyStack[historyStack.length - 1];
        const outgoing = getEl(outId);
        const incoming = getEl(inId);
        if (!outgoing || !incoming) return;

        // Reverse-slide the outgoing screen off to the right
        outgoing.style.transition = 'opacity 0.22s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        outgoing.style.transform = 'translateX(30px)';
        outgoing.style.opacity = '0';

        incoming.classList.remove('behind');
        incoming.style.transition = 'opacity 0.22s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        incoming.style.transform = 'translateX(0)';
        incoming.style.opacity = '1';
        incoming.classList.add('active');

        activeId = inId;
        syncBottomNavVisibility();

        // Clean up outgoing after transition completes
        const cleanup = () => {
            outgoing.classList.remove('active');
            outgoing.classList.add('behind');
            outgoing.style.removeProperty('transition');
            outgoing.style.removeProperty('transform');
            outgoing.style.removeProperty('opacity');
            incoming.style.removeProperty('transition');
            incoming.style.removeProperty('transform');
            incoming.style.removeProperty('opacity');
            outgoing.removeEventListener('transitionend', cleanup);
        };
        outgoing.addEventListener('transitionend', cleanup, { once: true });
        // Fallback in case transitionend doesn't fire
        setTimeout(cleanup, 350);
    }

    function openPlaceholderScreen(title = 'Placeholder', description = 'This part of the app does not have working logic yet.') {
        const titleEl = getEl('placeholder-feature-title');
        const copyEl = getEl('placeholder-feature-copy');
        if (titleEl) titleEl.textContent = String(title || 'Placeholder');
        if (copyEl) copyEl.textContent = String(description || 'This part of the app does not have working logic yet.');
        push('placeholder_screen');
    }

    function toggleOverlay(id) {
        const el = getEl(id);
        if (!el) return;
        pOpen = !el.classList.contains('active');
        el.classList.toggle('active', pOpen);
        if (id === 'player' && pOpen) {
            el.scrollTop = 0;
            syncNowPlayingArt();
        }
        syncBottomNavVisibility();
        scheduleNowPlayingMarquee(document);
    }

    // Party
    function setRole(r) {
        if (pState !== 'disconnected') return;
        role = r;
        getEl('btn-host')?.classList.toggle('active', r === 'host');
        getEl('btn-guest')?.classList.toggle('active', r === 'guest');
        getEl('join-code-box').style.display = r === 'guest' ? 'flex' : 'none';
        getEl('party-action-btn').innerText = r === 'host' ? 'Create Session' : 'Join Session';
        setJoinCodeError('');
    }

    function setJoinCodeError(msg) {
        let err = getEl('join-code-error');
        const box = getEl('join-code-box');
        if (!box) return;

        if (!err) {
            err = document.createElement('div');
            err.id = 'join-code-error';
            err.style.cssText = 'font-size:12px; color:var(--sys-error); margin:8px 2px 0; min-height:16px;';
            box.insertAdjacentElement('afterend', err);
        }

        err.textContent = msg || '';
    }

    function slog(msg, color = 'var(--sys-success)') {
        const log = getEl('party-log');
        if (!log) return;
        const d = document.createElement('div');
        d.className = 'trace-line';
        d.style.color = color;
        d.innerText = `[${new Date().toISOString().substring(11, 19)}] ${msg}`;
        log.prepend(d);
    }

    function validateGuestCode() {
        const input = getEl('join-code-input');
        if (!input) return null;
        const code = input.value.trim().toUpperCase();
        input.value = code;

        if (!/^[A-Z0-9]{4,6}$/.test(code)) {
            setJoinCodeError('Enter 4-6 uppercase letters or numbers.');
            input.style.borderColor = 'var(--sys-error)';
            input.focus();
            toast('Invalid join code');
            return null;
        }

        input.style.borderColor = '';
        setJoinCodeError('');
        return code;
    }

    function startParty() { /* Party sessions removed */ }

    function leaveParty() { /* Party sessions removed */ }
    // Search + Sort
    function normalizeSortLabel(v) {
        if (v === 'A ? Z' || v === 'A -> Z') return 'A-Z';
        return v;
    }

    currentSort = normalizeSortLabel(currentSort);

    function getActiveFilterTypes() {
        if (searchFilters.has('all')) return ['songs', 'albums', 'artists'];
        return Array.from(searchFilters);
    }

    function compareItemsForCurrentSort(a, b) {
        const titleA = String(a.title || '');
        const titleB = String(b.title || '');
        let diff = 0;
        switch (currentSort) {
            case 'A-Z':
                diff = titleA.localeCompare(titleB);
                break;
            case 'Most Played':
                diff = (b.plays || 0) - (a.plays || 0);
                break;
            case 'Duration':
                diff = (b.duration || 0) - (a.duration || 0);
                break;
            default:
                diff = (b.added || 0) - (a.added || 0);
                break;
        }
        return diff || titleA.localeCompare(titleB);
    }

    function sortItems(items, options = {}) {
        const copy = [...items];
        if (options.queryActive) {
            copy.sort((a, b) => (
                (b._searchScore || 0) - (a._searchScore || 0)
                || compareItemsForCurrentSort(a, b)
            ));
            return copy;
        }
        copy.sort(compareItemsForCurrentSort);
        return copy;
    }

    function getSearchTerms(query) {
        const normalized = normalizeSearchText(query);
        return normalized ? normalized.split(' ').filter(Boolean) : [];
    }

    function getSearchFieldScore(value, fullQuery, terms, weight) {
        const text = normalizeSearchText(value);
        if (!text) return 0;

        let score = 0;
        if (fullQuery) {
            if (text === fullQuery) score += weight * 8;
            else if (text.startsWith(fullQuery)) score += weight * 6;
            else if (text.includes(fullQuery)) score += weight * 4;
        }

        terms.forEach((term) => {
            if (text === term) score += weight * 5;
            else if (text.startsWith(term)) score += weight * 3;
            else if (text.includes(term)) score += weight;
        });
        return score;
    }

    function getSearchMatchScore(item, query) {
        const fullQuery = normalizeSearchText(query);
        const terms = getSearchTerms(query);
        if (!fullQuery || terms.length === 0) return 1;

        const index = item?._searchIndex || createSearchIndex({
            title: item?.title || '',
            subtitle: item?.subtitle || '',
            artist: item?.artist || item?.name || '',
            album: item?.albumTitle || '',
            genre: item?.genre || '',
            year: item?.year || ''
        });
        const haystack = index.text || '';
        if (!terms.every((term) => haystack.includes(term))) return 0;

        const weights = {
            title: 100,
            artist: 75,
            album: 65,
            albums: 55,
            tracks: 50,
            subtitle: 35,
            genre: 25,
            year: 20,
            path: 5
        };
        return Object.entries(index.fields || {}).reduce((total, [field, values]) => {
            const weight = weights[field] || 10;
            return total + (Array.isArray(values) ? values : [values]).reduce(
                (fieldTotal, value) => fieldTotal + getSearchFieldScore(value, fullQuery, terms, weight),
                0
            );
        }, 0);
    }

    function appendSearchMetaToken(line, label, onClick) {
        if (!label) return;
        if (line.childElementCount > 0) {
            const sep = document.createElement('span');
            sep.className = 'zenith-meta-sep';
            line.appendChild(sep);
        }
        if (typeof onClick === 'function') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'zenith-meta-link';
            btn.textContent = label;
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                onClick();
            });
            line.appendChild(btn);
            return;
        }
        const text = document.createElement('span');
        text.textContent = label;
        line.appendChild(text);
    }

