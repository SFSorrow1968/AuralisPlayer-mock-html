/*
 * Auralis JS shard: 04-navigation-renderers.js
 * Purpose: screen navigation, search, album/playlist/artist rendering, inline queue rendering
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
                cacheTrackDuration(nowPlaying, engine.duration);
                syncTrackDurationElements(nowPlaying);
                activeTrackUiSyncSignature = '';
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
        const speedLabel = getRef('player-speed-label');
        if (speedLabel && typeof formatPlaybackRateLabel === 'function') speedLabel.textContent = formatPlaybackRateLabel(playbackRate);

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
    function resetToastInteraction(t) {
        if (!t) return;
        t.classList.remove('toast-undo');
        t.removeAttribute('role');
        t.removeAttribute('tabindex');
        t.removeAttribute('aria-label');
        t.onclick = null;
        t.onkeydown = null;
    }

    function toast(msg, durationMs = 2200) {
        const t = getEl('toast');
        if (!t) return;
        resetToastInteraction(t);
        if (_toastActive) {
            // Replace current toast immediately if one is showing
            _toastQueue.length = 0;
            t.classList.remove('show');
            // Brief pause so the transition resets before showing next
            requestAnimationFrame(() => requestAnimationFrame(() => {
                _showToast(t, msg, durationMs);
            }));
        } else {
            _showToast(t, msg, durationMs);
        }
    }
    function _showToast(t, msg, durationMs = 2200) {
        _toastActive = true;
        t.innerText = msg;
        t.classList.add('show');
        setTimeout(() => {
            t.classList.remove('show');
            resetToastInteraction(t);
            _toastActive = false;
            if (_toastQueue.length) _showToast(t, _toastQueue.shift());
        }, Math.max(1200, Number(durationMs) || 2200));
    }

    // Navigation
    const SCREEN_REGISTRY = Object.freeze({
        home: { root: true, navTab: 'home' },
        library: { root: true, navTab: 'library' },
        search: { root: true },
        settings: { onEnter: () => renderSettingsFolderList() },
        album_detail: {},
        artist_profile: {},
        playlist_detail: {},
        placeholder_screen: {}
    });

    function getScreenConfig(id) {
        return SCREEN_REGISTRY[id] || {};
    }

    function runScreenEnterHook(id) {
        const onEnter = getScreenConfig(id).onEnter;
        if (typeof onEnter === 'function') onEnter();
    }

    function syncRootScreenNav(id, explicitEl = null) {
        const tabs = getEl('tabs');
        if (!tabs) return;
        tabs.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const tabName = getScreenConfig(id).navTab || id;
        const target = explicitEl || tabs.querySelector(`[data-tab="${tabName}"]`);
        target?.classList.add('active');
    }

    function switchTab(id, el) {
        if (id === activeId) return;
        // Exit search mode when leaving library
        if (activeId === 'library' && typeof exitSearchMode === 'function') exitSearchMode();
        if (activeId === 'home' && id !== 'home' && typeof exitHomeEditMode === 'function') {
            exitHomeEditMode({ announce: false });
        }
        const outgoing = getEl(activeId);
        const incoming = getEl(id);
        if (!incoming || !outgoing) return;

        outgoing.classList.remove('active');
        outgoing.classList.add('behind');

        syncRootScreenNav(id, el);

        incoming.classList.remove('behind');
        // Double-rAF ensures the browser commits the initial state before triggering transition
        requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.add('active')));

        activeId = id;
        historyStack = [id];
        syncBottomNavVisibility();
        runScreenEnterHook(id);
    }

    function openSettingsPanel(panelName) {
        const settings = getEl('settings');
        if (!settings) return;
        const safePanel = String(panelName || 'root').trim() || 'root';
        settings.dataset.settingsPanel = safePanel;
        settings.querySelectorAll('.settings-detail-panel').forEach(panel => {
            panel.hidden = panel.dataset.settingsPanel !== safePanel;
        });
        const root = getEl('settings-root-panel');
        if (root) root.hidden = safePanel !== 'root';
        settings.scrollTop = 0;
    }

    function openSettingsRoot() {
        openSettingsPanel('root');
    }

    function push(id) {
        const incoming = getEl(id);
        const outgoing = getEl(activeId);
        if (!incoming || !outgoing || id === activeId) return;

        outgoing.classList.remove('active');
        outgoing.classList.add('behind');

        incoming.classList.remove('behind');
        requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.add('active')));

        historyStack.push(id);
        activeId = id;
        syncBottomNavVisibility();
        runScreenEnterHook(id);
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

    function openSpeakerSyncPanel() {
        const volume = Math.round((Number(currentVolume) || 0) * 100);
        const outputLabel = document.hidden ? 'Background-ready output' : 'This device output';
        presentActionSheet('Speaker Sync', 'Local playback is active on this device. Remote speakers are unavailable in this mock build.', [
            {
                label: 'This Device',
                description: `${outputLabel} - ${volume}% volume`,
                icon: 'source',
                keepOpen: true,
                onSelect: () => toast('This device is already selected')
            },
            {
                label: 'Remote Devices',
                description: 'No paired Auralis devices are available on this network.',
                icon: 'library',
                keepOpen: true,
                onSelect: () => toast('No remote devices available')
            },
            {
                label: nowPlaying ? 'Queue This Device' : 'Start Playback First',
                description: nowPlaying ? `${nowPlaying.title || 'Current track'} is playing locally.` : 'Choose music before syncing output.',
                icon: 'queue',
                keepOpen: true,
                onSelect: () => {
                    if (nowPlaying) toast('Local speaker queue is up to date');
                    else toast('Start playback first');
                }
            }
        ]);
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

    const SEARCH_SCOPE_TYPES = ['songs', 'albums', 'artists', 'playlists', 'genres', 'folders'];

    function getActiveFilterTypes() {
        if (searchFilters.has('all')) return SEARCH_SCOPE_TYPES.slice();
        return Array.from(searchFilters).filter(type => SEARCH_SCOPE_TYPES.includes(type));
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
