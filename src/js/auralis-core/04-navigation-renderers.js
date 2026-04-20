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
                recordAlbumProgress(activeAlbumTitle, queueIndex, engine.currentTime, engine.duration || nowPlaying.durationSec || 0);
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
                const key = trackKey(nowPlaying.title, nowPlaying.artist);
                playCounts.set(key, (playCounts.get(key) || 0) + 1);
                lastPlayed.set(key, Date.now());
                persistPlayCounts();
                persistLastPlayed();
                // Project live stats onto the track object for section sorting
                nowPlaying.plays = playCounts.get(key) || 0;
                nowPlaying.lastPlayedDays = 0;
            }
            // Clear album progress if we just finished the last track
            if (activePlaybackCollectionType === 'album' && activeAlbumTitle && queueIndex >= queueTracks.length - 1) {
                clearAlbumProgress(activeAlbumTitle);
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

    function startParty() {
        if (pState !== 'disconnected') return;

        let sessionCode = 'XJ92';
        if (role === 'guest') {
            const validated = validateGuestCode();
            if (!validated) return;
            sessionCode = validated;
        }

        pState = 'connecting';
        getEl('party-action-btn').innerHTML = '<svg viewBox="0 0 24 24" width="20" style="animation:spin 1s linear infinite; fill:#fff;"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';
        slog('WebSocket connecting...', '#FFF');

        setTimeout(() => {
            pState = 'connected';
            getEl('party-action-btn').innerText = role === 'host' ? 'Session Created' : 'Joined';

            const card = getEl('session-card');
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
            card.style.borderColor = 'var(--sys-success)';

            const badge = getEl('party-status-badge');
            badge.innerText = 'CONNECTED';
            badge.style.background = 'var(--sys-success)';
            badge.style.color = '#000';

            getEl('party-code-disp').innerText = sessionCode;
            getEl('party-members').innerText = role === 'host' ? 'You' : 'You, Host_dKat';

            slog('Connected: 200 OK');
            slog(`RCV - SESSION_STATE {"id":"${sessionCode}"}`);
            toast('Connected to Party');
        }, 1200);
    }

    function leaveParty() {
        pState = 'disconnected';
        getEl('party-action-btn').innerText = role === 'host' ? 'Create Session' : 'Join Session';

        const card = getEl('session-card');
        card.style.opacity = '0.4';
        card.style.pointerEvents = 'none';
        card.style.borderColor = 'transparent';

        const badge = getEl('party-status-badge');
        badge.innerText = 'DISCONNECTED';
        badge.style.background = 'rgba(255,255,255,0.1)';
        badge.style.color = 'var(--text-secondary)';

        getEl('party-code-disp').innerText = '---';
        getEl('party-members').innerText = 'You';

        setJoinCodeError('');
        slog('SND - SESSION_LEAVE {"reason":"user"}', 'var(--sys-warning)');
        slog('Connection terminated.', 'var(--sys-error)');
        toast('Left Party');
    }
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

    function sortItems(items) {
        const copy = [...items];
        switch (currentSort) {
            case 'A-Z':
                copy.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'Most Played':
                copy.sort((a, b) => (b.plays || 0) - (a.plays || 0));
                break;
            case 'Duration':
                copy.sort((a, b) => (b.duration || 0) - (a.duration || 0));
                break;
            default:
                copy.sort((a, b) => (b.added || 0) - (a.added || 0));
                break;
        }
        return copy;
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

    function buildSearchSubtextLine(item) {
        const line = document.createElement('div');
        line.className = 'zenith-meta zenith-meta-row';
        if (item.type === 'songs') {
            appendSearchMetaToken(line, item.artist || '', () => routeToArtistProfile(item.artist));
            appendSearchMetaToken(line, item.albumTitle || '', () => routeToAlbumDetail(item.albumTitle, item.artist));
            if (item.genre) appendSearchMetaToken(line, item.genre, () => routeToGenreBrowse(item.genre));
            if (item.duration > 0) appendSearchMetaToken(line, toDurationLabel(item.duration));
            return line;
        }
        if (item.type === 'albums') {
            appendSearchMetaToken(line, item.artist || '', () => routeToArtistProfile(item.artist));
            appendSearchMetaToken(line, `${Number(item.trackCount || 0)} tracks`);
            if (item.genre) appendSearchMetaToken(line, item.genre, () => routeToGenreBrowse(item.genre));
            return line;
        }
        appendSearchMetaToken(line, item.subtitle || '');
        return line;
    }

    function buildSearchRow(item) {
        if (item?.type === 'songs' && typeof createLibrarySongRow === 'function') {
            const track = resolveTrackMeta(item.title, item.artist, item.albumTitle);
            const row = createLibrarySongRow(track, true, {
                compact: true,
                showDuration: true,
                hideAlbum: false,
                metaContext: 'search'
            });
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'songs';
            return row;
        }

        if (item?.type === 'albums' && typeof createCollectionRow === 'function') {
            const resolvedAlbum = resolveAlbumMeta(item.albumTitle || item.title);
            const albumItem = resolvedAlbum || {
                title: item.title,
                artist: item.artist || ARTIST_NAME,
                year: item.year || '',
                trackCount: Number(item.trackCount || 0),
                genre: item.genre || '',
                artUrl: item.artUrl || '',
                tracks: Array.isArray(item.tracks) ? item.tracks.slice() : []
            };
            const row = createCollectionRow('album', albumItem, 'search');
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'albums';
            return row;
        }

        if (item?.type === 'artists' && typeof createCollectionRow === 'function') {
            const key = toArtistKey(item.name || item.artist || item.title);
            const resolvedArtist = artistByKey.get(key) || LIBRARY_ARTISTS.find((artist) => toArtistKey(artist.name) === key);
            const artistItem = resolvedArtist || {
                name: item.name || item.artist || item.title || ARTIST_NAME,
                artUrl: item.artUrl || '',
                albumCount: Number(item.albumCount || 0),
                trackCount: Number(item.trackCount || 0),
                plays: Number(item.plays || 0)
            };
            const row = createCollectionRow('artist', artistItem, 'search');
            row.style.padding = '12px 0';
            row.style.borderColor = 'var(--border-default)';
            row.dataset.type = 'artists';
            return row;
        }

        const row = document.createElement('div');
        row.className = 'list-item';
        row.style.cssText = 'padding:12px 0; border-color:var(--border-default);';
        row.dataset.type = item.type;

        const clickable = document.createElement('button');
        clickable.className = 'item-clickable';
        clickable.type = 'button';

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        applyArtBackground(
            icon,
            item.artUrl || '',
            item.type === 'songs'
                ? 'linear-gradient(135deg, #FF6B6B, #818CF8)'
                : item.type === 'albums'
                    ? FALLBACK_GRADIENT
                    : 'linear-gradient(135deg, #0ea5e9, #14b8a6)'
        );

        const content = document.createElement('div');
        content.className = 'item-content';

        const h3 = document.createElement('h3');
        h3.textContent = item.title;

        content.appendChild(h3);
        content.appendChild(buildSearchSubtextLine(item));
        clickable.appendChild(icon);
        clickable.appendChild(content);

        clickable.addEventListener('click', item.action);
        clickable.addEventListener('mousedown', (e) => startLongPress(e, item.title, item.subtitle));
        clickable.addEventListener('mouseup', clearLongPress);
        clickable.addEventListener('mouseleave', clearLongPress);
        clickable.addEventListener('touchstart', (e) => startLongPress(e, item.title, item.subtitle), { passive: true });
        clickable.addEventListener('touchend', clearLongPress, { passive: true });

        row.appendChild(clickable);
        return row;
    }

    function renderSearchResults() {
        const resultsEl = getEl('search-results');
        if (!resultsEl) return;

        const activeTypes = getActiveFilterTypes();
        const q = searchQuery.toLowerCase();

        let filtered = SEARCH_DATA.filter(item => {
            if (!activeTypes.includes(item.type)) return false;
            if (q.length > 0) {
                return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
            }
            return true;
        });

        filtered = sortItems(filtered);
        clearTrackUiRegistryForRoot(resultsEl);
        resultsEl.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'list-wrap';
        wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'card';
            empty.style.cssText = 'padding:20px; text-align:center;';
            const title = document.createElement('h3');
            title.style.marginBottom = '8px';
            title.textContent = searchQuery ? `No results for "${searchQuery}"` : 'No matching media';
            const copy = document.createElement('p');
            copy.style.margin = '0';
            copy.textContent = 'Try another filter or clear your query.';
            empty.appendChild(title);
            empty.appendChild(copy);
            resultsEl.appendChild(empty);
            return;
        }

        filtered.forEach(item => wrap.appendChild(buildSearchRow(item)));
        resultsEl.appendChild(wrap);
    }

    function applySortToBrowseGrid() {
        const grid = getEl('search-cat-grid');
        if (!grid) return;

        const cards = Array.from(grid.querySelectorAll('.cat-card'));
        const decorated = cards.map((card, index) => {
            if (!card.dataset.added) card.dataset.added = String(cards.length - index);
            if (!card.dataset.plays) card.dataset.plays = String((index + 1) * 10);
            if (!card.dataset.duration) card.dataset.duration = String(180 + index * 12);
            return {
                card,
                title: card.innerText.trim(),
                added: Number(card.dataset.added),
                plays: Number(card.dataset.plays),
                duration: Number(card.dataset.duration)
            };
        });

        switch (currentSort) {
            case 'A-Z':
                decorated.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'Most Played':
                decorated.sort((a, b) => b.plays - a.plays);
                break;
            case 'Duration':
                decorated.sort((a, b) => b.duration - a.duration);
                break;
            default:
                decorated.sort((a, b) => b.added - a.added);
                break;
        }

        decorated.forEach(item => grid.appendChild(item.card));
    }

    function updateSortIndicators() {
        document.querySelectorAll('.sort-indicator').forEach(node => {
            node.textContent = currentSort;
            node.title = `Sort: ${currentSort}`;
        });
    }

    function ensureSortIndicators() {
        const triggers = Array.from(document.querySelectorAll('div.icon-btn[onclick="openSearchSort()"]'));
        triggers.forEach(btn => {
            const parent = btn.parentElement;
            if (!parent) return;
            let indicator = parent.querySelector('.sort-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'sort-indicator';
                indicator.style.cssText = 'font-size:11px; color:var(--text-tertiary); margin-left:8px; white-space:nowrap;';
                parent.appendChild(indicator);
            }
        });
        updateSortIndicators();
    }

    function renderSearchState() {
        const results = getEl('search-results');
        const browse = getEl('search-browse');
        if (!results || !browse) return;

        const allOnly = searchFilters.size === 1 && searchFilters.has('all');
        const shouldShowBrowse = searchQuery.length === 0 && allOnly;

        if (shouldShowBrowse) {
            browse.style.display = 'block';
            results.style.display = 'none';
            applySortToBrowseGrid();
        } else {
            browse.style.display = 'none';
            results.style.display = 'block';
            renderSearchResults();
        }

        updateSortIndicators();
    }

    function setSort(sortName) {
        currentSort = normalizeSortLabel(sortName);
        safeStorage.setItem(STORAGE_KEYS.sort, currentSort);
        toast(`Sorting: ${currentSort}`);
        renderSearchState();
        updateSortIndicators();
    }

    function openSearchSort() {
        getEl('sheet-title').innerText = 'Sort & Order';
        getEl('sheet-sub').innerText = `Current: ${currentSort}`;
        const actions = document.querySelectorAll('#action-sheet .sheet-action');

        if (actions.length > 3) {
            actions[0].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg> Recently Added';
            actions[1].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg> A-Z';
            actions[2].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Most Played';
            actions[3].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> Duration';

            actions[0].onclick = () => { setSort('Recently Added'); closeSheet(); };
            actions[1].onclick = () => { setSort('A-Z'); closeSheet(); };
            actions[2].onclick = () => { setSort('Most Played'); closeSheet(); };
            actions[3].onclick = () => { setSort('Duration'); closeSheet(); };
        }

        openSheet('Sort & Order', `Current: ${currentSort}`);
    }

    function toggleSearchFilter(chip) {
        const row = getEl('search-filter-row');
        if (!row || !chip) return;
        const filter = chip.dataset.filter;

        if (filter === 'all') {
            searchFilters.clear();
            searchFilters.add('all');
        } else {
            searchFilters.delete('all');
            if (searchFilters.has(filter)) {
                searchFilters.delete(filter);
            } else {
                searchFilters.add(filter);
            }
            if (searchFilters.size === 0) searchFilters.add('all');
        }

        row.querySelectorAll('.filter-chip').forEach(node => {
            const f = node.dataset.filter;
            node.classList.toggle('active', searchFilters.has(f));
        });

        renderSearchState();
    }
    // Player / Media
    function playTrack(title, artist, albumHint) {
        const track = resolveTrackMeta(title, artist, albumHint);
        setPlaybackCollection('', '');
        const idx = queueTracks.findIndex(q => trackKey(q.title, q.artist) === trackKey(track.title, track.artist));
        if (idx >= 0) queueTracks.splice(idx, 1);
        queueTracks.unshift(track);
        if (queueTracks.length > 60) queueTracks = queueTracks.slice(0, 60);
        queueIndex = 0;
        renderQueue();
        setNowPlaying(track, true);
        loadTrackIntoEngine(track, true, true);
    }

    function playAlbumInOrder(albumTitle, startTrackIndex = 0) {
        const albumMeta = albumByTitle.get(albumKey(albumTitle));
        if (!albumMeta || !albumMeta.tracks.length) return;
        activeAlbumTitle = albumMeta.title;
        setPlaybackCollection('album', albumMeta.title);
        queueTracks = albumMeta.tracks.slice().sort((a, b) => (a.no || 0) - (b.no || 0));
        queueIndex = Math.max(0, Math.min(startTrackIndex, queueTracks.length - 1));
        const track = queueTracks[queueIndex];
        setNowPlaying(track, true);
        renderQueue();
        loadTrackIntoEngine(track, true, true);
        updateAlbumProgressLine(0, track.durationSec || 0);
    }

    function playPlaylistInOrder(playlistId, startTrackIndex = 0) {
        const playlist = playlistById.get(playlistId);
        if (!playlist || !playlist.tracks.length) return;
        activePlaylistId = playlist.id;
        setPlaybackCollection('playlist', playlist.id);
        queueTracks = playlist.tracks.slice();
        queueIndex = Math.max(0, Math.min(startTrackIndex, queueTracks.length - 1));
        const track = queueTracks[queueIndex];
        setNowPlaying(track, true);
        renderQueue();
        loadTrackIntoEngine(track, true, true);
    }

    function openArtistProfile(name) {
        activeArtistName = name || ARTIST_NAME;
        push('artist_profile');
        renderLibraryViews();
    }

    function routeToArtistProfile(name) {
        if (!name) return;
        openArtistProfile(name);
    }

    function routeToAlbumDetail(title, artist) {
        if (!title) return;
        navToAlbum(title, artist);
    }

    function routeToPlaylistDetail(id) {
        if (!id) return;
        const playlist = playlistById.get(id);
        if (playlist && playlist.sourceType === 'album_proxy') {
            routeToAlbumDetail(playlist.sourceAlbumTitle || playlist.title, playlist.sourceAlbumArtist || playlist.artist);
            return;
        }
        openPlaylist(id);
    }

    function routeToPlaylistByIndex(index = 0) {
        const list = Array.isArray(LIBRARY_PLAYLISTS) ? LIBRARY_PLAYLISTS : [];
        if (!list.length) {
            toast('No playlists available');
            return;
        }
        const numericIndex = Number(index);
        const safeIndex = Number.isFinite(numericIndex)
            ? Math.max(0, Math.min(Math.round(numericIndex), list.length - 1))
            : 0;
        const playlist = list[safeIndex] || list[0];
        if (!playlist?.id) {
            toast('Playlist unavailable');
            return;
        }
        routeToPlaylistDetail(playlist.id);
    }

    function routeToGenreBrowse(genre) {
        const value = String(genre || '').trim();
        if (!value) {
            toast('No genre metadata found');
            return;
        }
        routeToSearchQuery(value, ['songs', 'albums']);
        toast(`Browsing genre: ${value}`);
    }

    function openPlaylist(playlistId) {
        const playlist = playlistById.get(playlistId);
        if (!playlist) return;
        if (playlist.sourceType === 'album_proxy') {
            navToAlbum(playlist.sourceAlbumTitle || playlist.title, playlist.sourceAlbumArtist || playlist.artist);
            return;
        }
        activePlaylistId = playlist.id;

        const cover = getEl('playlist-hero-cover');
        const title = getEl('playlist-title');
        const subtitle = getEl('playlist-subtitle');
        const playBtn = getEl('playlist-play-btn');
        const list = getEl('playlist-track-list');

        applyArtBackground(cover, playlist.artUrl, FALLBACK_GRADIENT);
        if (title) title.textContent = playlist.title;
        if (subtitle) subtitle.textContent = playlist.subtitle || `${playlist.tracks.length} tracks`;
        if (playBtn) {
            playBtn.dataset.collectionType = 'playlist';
            playBtn.dataset.collectionKey = String(playlist.id || '');
            playBtn.onclick = (evt) => {
                if (isCollectionActive('playlist', playlist.id)) {
                    togglePlayback(evt);
                    return;
                }
                playPlaylistInOrder(playlist.id, 0);
            };
        }

        if (list) {
            clearTrackUiRegistryForRoot(list);
            list.innerHTML = '';
            playlist.tracks.slice(0, 40).forEach((track, idx) => {
                const rowBuilder = createLibrarySongRow;
                const row = rowBuilder(track, true, { metaContext: 'playlist_detail', _playlistRef: playlist });
                row.style.padding = '14px 0';
                row.style.borderColor = 'var(--border-default)';
                row.querySelector('.item-clickable')?.addEventListener('click', () => playPlaylistInOrder(playlist.id, idx));
                if (idx === Math.min(playlist.tracks.length, 40) - 1) row.style.border = 'none';
                list.appendChild(row);
            });
        }

        setPlayButtonState(isPlaying);
        push('playlist_detail');
    }

    function resolveAlbumMeta(inputTitle) {
        if (inputTitle == null && !LIBRARY_ALBUMS.length) return null;
        const rawTitle = typeof inputTitle === 'string'
            ? inputTitle
            : (inputTitle && typeof inputTitle === 'object' ? inputTitle.title : '');
        const normalizedTitle = normalizeAlbumTitle(rawTitle);
        const normalizedKey = albumKey(normalizedTitle);
        const exact = albumByTitle.get(normalizedKey);
        if (exact) return exact;

        // Exact title match only — no fuzzy substring matching
        if (normalizedKey) {
            const exactTitleMatch = LIBRARY_ALBUMS.find((album) => {
                return albumKey(album?.title || '') === normalizedKey;
            });
            if (exactTitleMatch) return exactTitleMatch;
        }

        return null;
    }

    function renderAlbumDetail(albumMeta) {
        if (!albumMeta) return;
        activeAlbumTitle = albumMeta.title;

        const at = getEl('alb-title');
        const aa = getEl('alb-artist');
        const am = getEl('alb-meta');
        const trackCount = Number(albumMeta.trackCount || albumMeta.tracks?.length || 0);
        if (at) at.textContent = albumMeta.title;
        if (aa) aa.textContent = albumMeta.artist || ARTIST_NAME;
        if (am) am.textContent = `Album - ${albumMeta.year || 'Unknown Year'} - ${trackCount} tracks`;
        const albArtEl = getEl('alb-art');
        applyArtBackground(albArtEl, albumMeta.artUrl, FALLBACK_GRADIENT);
        if (!albumMeta.artUrl && albArtEl && typeof lazyLoadArt === 'function') lazyLoadArt(albumMeta, albArtEl);
        wireAlbumDetailHeaderInteractions(albumMeta);
        ensureAlbumProgressBinding();

        const playBtn = getEl('alb-play-btn');
        if (playBtn && albumMeta.tracks?.[0]) {
            playBtn.dataset.collectionType = 'album';
            playBtn.dataset.collectionKey = albumKey(albumMeta.title);
            playBtn.onclick = (evt) => {
                if (isCollectionActive('album', albumMeta.title)) {
                    togglePlayback(evt);
                    return;
                }
                playAlbumInOrder(albumMeta.title, 0);
            };
        }

        const list = getEl('album-track-list');
        if (list) {
            list.innerHTML = '';
            const tracks = Array.isArray(albumMeta.tracks) ? albumMeta.tracks : [];
            tracks.forEach((track, idx) => {
                const row = document.createElement('div');
                row.className = 'list-item album-track-row';
                row.dataset.trackKey = trackKey(track.title, track.artist);
                if (idx === tracks.length - 1) row.style.borderBottom = 'none';

                const click = document.createElement('button');
                click.className = 'item-clickable';
                click.type = 'button';
                click.addEventListener('click', () => playAlbumInOrder(albumMeta.title, idx));
                bindLongPressAction(click, () => openTrackZenithMenu(track));

                const numEl = document.createElement('span');
                numEl.className = 'track-num';
                numEl.textContent = String(track.no || idx + 1);

                const content = document.createElement('div');
                content.className = 'item-content';
                const titleEl = document.createElement('h3');
                titleEl.textContent = track.title;
                content.appendChild(titleEl);

                const durationEl = document.createElement('span');
                durationEl.className = 'album-track-duration';
                durationEl.textContent = track.duration || toDurationLabel(getTrackDurationSeconds(track));
                const stateBtn = createTrackStateButton(track, () => playAlbumInOrder(albumMeta.title, idx), { compact: true });
                stateBtn.classList.add('album-track-state-btn');

                click.appendChild(numEl);
                click.appendChild(content);
                click.appendChild(durationEl);
                click.appendChild(stateBtn);
                row.appendChild(click);
                list.appendChild(row);
            });
        }

        updateAlbumProgressLine(0, nowPlaying?.durationSec || 0);
        setPlayButtonState(isPlaying);
        push('album_detail');
        ensureAccessibility();
    }

    function navToAlbum(album, artist) {
        const resolved = resolveAlbumMeta(album);
        if (!resolved) return;
        const albumMeta = (!resolved.artist && artist) ? { ...resolved, artist } : resolved;
        renderAlbumDetail(albumMeta);
    }

    // Home / Library
    function toggleMarvisLayout() {
        const mod = getEl('marvis-mod-section');
        if (!mod) return;
        isGrid = !isGrid;

        mod.style.opacity = '0';
        setTimeout(() => {
            if (isGrid) {
                mod.className = 'cat-grid';
                mod.style.display = 'grid';
            } else {
                mod.className = 'horizon-scroller';
                mod.style.display = 'flex';
            }
            renderJumpBackSection(getFeaturedAlbums());
            mod.style.opacity = '1';
            applySortToBrowseGrid();
        }, 150);

        toast(isGrid ? 'Marvis: Grid View' : 'Marvis: List View');
    }

    function renderJumpBackSection(featuredAlbums) {
        const mod = getEl('marvis-mod-section');
        if (!mod) return;

        mod.innerHTML = '';
        const albums = Array.isArray(featuredAlbums) ? featuredAlbums.slice(0, 8) : [];
        if (albums.length === 0) return;

        albums.forEach(album => {
            if (isGrid) {
                const card = document.createElement('div');
                card.className = 'cat-card';
                card.draggable = true;
                card.dataset.albumTitle = album.title;
                card.dataset.added = String(album.year || 0);
                card.dataset.plays = String(200);
                card.dataset.duration = String(album.tracks[0]?.durationSec || 0);
                applyArtBackground(card, album.artUrl, FALLBACK_GRADIENT);
                if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, card);
                card.style.border = '1px solid rgba(255,255,255,0.2)';
                card.addEventListener('click', () => navToAlbum(album.title, album.artist));
                card.addEventListener('mousedown', (e) => startLongPress(e, album.title, album.artist));
                card.addEventListener('mouseup', clearLongPress);
                card.addEventListener('mouseleave', clearLongPress);

                const span = document.createElement('span');
                span.textContent = album.title;
                span.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
                card.appendChild(span);
                mod.appendChild(card);
                return;
            }

            const card = document.createElement('div');
            card.className = 'media-card';
            card.addEventListener('click', () => navToAlbum(album.title, album.artist));
            card.addEventListener('mousedown', (e) => startLongPress(e, album.title, album.artist));
            card.addEventListener('mouseup', clearLongPress);
            card.addEventListener('mouseleave', clearLongPress);
            card.addEventListener('touchstart', (e) => startLongPress(e, album.title, album.artist), { passive: true });
            card.addEventListener('touchend', clearLongPress, { passive: true });

            const cover = document.createElement('div');
            cover.className = 'media-cover';
            applyArtBackground(cover, album.artUrl, FALLBACK_GRADIENT);
            if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, cover);

            const wrap = document.createElement('div');
            const t = document.createElement('div');
            t.className = 'media-title';
            t.textContent = album.title;
            const s = document.createElement('div');
            s.className = 'media-sub';
            s.textContent = `${album.artist} - Album`;
            wrap.appendChild(t);
            wrap.appendChild(s);

            card.appendChild(cover);
            card.appendChild(wrap);
            mod.appendChild(card);
        });
    }

    function clearHomePlaceholders() {
        document.querySelectorAll('.home-placeholder').forEach(el => el.remove());
    }

    function createHomePlaceholder(typeLabel) {
        const container = document.createElement('div');
        container.className = 'home-placeholder card';
        container.style.cssText = 'text-align:center; margin-top:16px;';

        const h3 = document.createElement('h3');
        h3.style.cssText = 'margin-bottom:8px; color:var(--text-primary);';
        h3.textContent = `No ${typeLabel} here yet`;

        const p = document.createElement('p');
        p.style.marginBottom = '16px';
        p.textContent = 'Your local library has no matching items. Try browsing to add more.';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.style.cssText = 'width:auto; padding:10px 20px; font-size:13px;';
        btn.textContent = 'Browse Catalog';
        btn.addEventListener('click', () => switchTab('search', getEl('tabs')?.querySelectorAll('.nav-item')[1]));

        container.appendChild(h3);
        container.appendChild(p);
        container.appendChild(btn);
        return container;
    }

    function filterHome(type) {
        const mus = getEl('home-music-section');
        const vid = getEl('home-videos-section');
        if (!mus || !vid) return;

        clearHomePlaceholders();

        if (type === 'all') {
            mus.style.display = 'block';
            vid.style.display = 'block';
            toast('Filtering: All Content');
            return;
        }

        if (type === 'music') {
            mus.style.display = 'block';
            vid.style.display = 'none';
            toast('Filtering: Songs');
            return;
        }

        if (type === 'videos') {
            mus.style.display = 'none';
            vid.style.display = 'block';
            toast('Filtering: Videos');
            return;
        }

        if (type === 'Albums' || type === 'Artists') {
            mus.style.display = 'block';
            vid.style.display = 'none';
            toast(`Filtering: ${type}`);
            return;
        }

        mus.style.display = 'none';
        vid.style.display = 'none';
        getEl('home').appendChild(createHomePlaceholder(type));
        toast(`Filtering: ${type}`);
    }

    function switchLib(tab) {
        document.querySelectorAll('#library .filter-chip').forEach(b => b.classList.remove('active'));
        getEl('lib-btn-' + tab)?.classList.add('active');

        ['playlists', 'albums', 'artists', 'songs', 'genres'].forEach(name => {
            const el = getEl('lib-view-' + name);
            if (el) el.style.display = 'none';
        });

        getEl('lib-view-' + tab).style.display = 'block';
    }

    function getQueueRenderWindow() {
        if (!Array.isArray(queueTracks) || queueTracks.length === 0) {
            return { currentIdx: -1, visibleStart: 0, entries: [] };
        }
        const currentIdx = getCurrentQueueIndex();
        const visibleStart = currentIdx >= 0 ? currentIdx : 0;
        const entries = queueTracks
            .slice(visibleStart, visibleStart + QUEUE_RENDER_WINDOW)
            .map((track, offset) => ({ track, index: visibleStart + offset }));
        return { currentIdx, visibleStart, entries };
    }

    function playQueueTrackAt(index, autoplay = true) {
        const safeIndex = Number(index);
        if (!Number.isFinite(safeIndex)) return;
        if (safeIndex < 0 || safeIndex >= queueTracks.length) return;
        const track = queueTracks[safeIndex];
        if (!track) return;
        queueIndex = safeIndex;
        setNowPlaying(track, true);
        loadTrackIntoEngine(track, autoplay, true);
        renderQueue();
    }

    function bindQueueRowLongPress(target, onLongPress, delayMs = 560) {
        if (!target || typeof onLongPress !== 'function') return;
        let timer = null;
        const clearTimer = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };
        const begin = (evt) => {
            if (evt.type === 'mousedown' && evt.button !== 0) return;
            clearTimer();
            timer = setTimeout(() => {
                markLongPressSuppressed(target);
                if (navigator.vibrate) navigator.vibrate(35);
                onLongPress();
            }, delayMs);
        };

        target.addEventListener('mousedown', begin);
        target.addEventListener('touchstart', begin, { passive: true });
        target.addEventListener('mouseup', clearTimer);
        target.addEventListener('mouseleave', clearTimer);
        target.addEventListener('touchend', clearTimer, { passive: true });
        target.addEventListener('touchcancel', clearTimer, { passive: true });
        target.addEventListener('touchmove', clearTimer, { passive: true });
    }

    function renderQueue() {
        const list = getEl('queue-list');
        const inlineList = getEl('player-inline-queue-list');
        const kickerEl = getEl('queue-kicker');
        const summaryEl = getEl('queue-summary');
        const clearBtn = getEl('queue-clear-btn');
        const engine = ensureAudioEngine();
        if (!list) return;
        list.innerHTML = '';
        if (inlineList) inlineList.innerHTML = '';

        const { currentIdx, entries } = getQueueRenderWindow();
        const hasQueue = queueTracks.length > 0;
        const upcomingTracks = currentIdx >= 0 ? queueTracks.slice(currentIdx + 1) : queueTracks.slice();
        const upcomingCount = Math.max(0, upcomingTracks.length);
        const currentSeconds = engine && Number.isFinite(engine.currentTime) ? engine.currentTime : 0;
        const currentDuration = engine && Number.isFinite(engine.duration) && engine.duration > 0
            ? engine.duration
            : (nowPlaying?.durationSec || 0);
        if (kickerEl) kickerEl.textContent = hasQueue ? 'Now Playing + Up Next' : 'Queue';
        if (summaryEl) {
            if (!hasQueue) summaryEl.textContent = 'Queue is empty';
            else summaryEl.textContent = `${upcomingCount} up next - ${getQueueMetaTimeLabel(Math.max(0, currentIdx), currentSeconds, currentDuration)}`;
        }
        if (clearBtn) clearBtn.disabled = !hasQueue || upcomingCount === 0;

        if (!hasQueue || entries.length === 0) {
            const row = document.createElement('div');
            row.className = 'list-item empty-state-cta';
            row.style.borderBottom = '1px solid var(--border-default)';
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const msg = document.createElement('div');
            msg.style.cssText = 'margin-bottom:12px; color:var(--text-secondary);';
            msg.textContent = 'Queue is empty. Find some music.';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn';
            btn.style.cssText = 'width:auto;';
            btn.textContent = 'Find Music';
            btn.addEventListener('click', () => {
                if (activeId === 'queue') pop();
                const searchTab = getEl('tabs')?.querySelectorAll('.nav-item')[1];
                switchTab('search', searchTab);
            });
            wrap.appendChild(msg);
            wrap.appendChild(btn);
            row.appendChild(wrap);
            list.appendChild(row);
            if (inlineList) {
                const inlineEmpty = document.createElement('div');
                inlineEmpty.className = 'list-item';
                inlineEmpty.style.borderBottom = 'none';
                inlineEmpty.innerHTML = '<div class="item-content"><span>No tracks queued yet.</span></div>';
                inlineList.appendChild(inlineEmpty);
            }
            bindQueueInteractions();
            ensureAccessibility();
            return;
        }

        entries.forEach(({ track, index }) => {
            const row = document.createElement('div');
            row.className = 'list-item queue-row';
            row.dataset.queueIndex = String(index);
            row.dataset.trackKey = trackKey(track.title, track.artist);
            const isCurrent = index === currentIdx;
            if (isCurrent) row.classList.add('playing-row');

            const click = document.createElement('button');
            click.type = 'button';
            click.className = 'item-clickable';
            click.addEventListener('click', () => {
                if (Date.now() < queueDragSuppressUntil) return;
                playQueueTrackAt(index, true);
            });
            bindQueueRowLongPress(click, () => openQueueTrackMenu(track, index));

            const icon = document.createElement('div');
            icon.className = 'item-icon';
            applyArtBackground(icon, track.artUrl, FALLBACK_GRADIENT);

            const content = document.createElement('div');
            content.className = 'item-content';
            const h3 = document.createElement('h3');
            h3.textContent = track.title || 'Untitled Track';
            content.appendChild(h3);

            const meta = document.createElement('div');
            meta.className = 'queue-meta';
            const artistBtn = document.createElement('button');
            artistBtn.type = 'button';
            artistBtn.className = 'queue-meta-link';
            artistBtn.textContent = track.artist || ARTIST_NAME;
            artistBtn.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                routeToArtistProfile(track.artist || ARTIST_NAME);
            });
            meta.appendChild(artistBtn);
            if (track.albumTitle) {
                const sep = document.createElement('span');
                sep.className = 'queue-meta-sep';
                sep.textContent = '-';
                meta.appendChild(sep);
                const albumBtn = document.createElement('button');
                albumBtn.type = 'button';
                albumBtn.className = 'queue-meta-link';
                albumBtn.textContent = track.albumTitle;
                albumBtn.addEventListener('click', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    routeToAlbumDetail(track.albumTitle, track.artist);
                });
                meta.appendChild(albumBtn);
            }
            content.appendChild(meta);

            const stateBtn = createTrackStateButton(track, () => {
                if (Date.now() < queueDragSuppressUntil) return;
                playQueueTrackAt(index, true);
            });
            stateBtn.classList.add('queue-state-btn');

            click.appendChild(icon);
            click.appendChild(content);
            click.appendChild(stateBtn);
            row.appendChild(click);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'queue-remove-btn';
            removeBtn.setAttribute('aria-label', `Remove ${track.title || 'track'} from queue`);
            removeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.29z"></path></svg>';
            removeBtn.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                removeQueueTrack(index);
            });
            row.appendChild(removeBtn);

            const dragBtn = document.createElement('button');
            dragBtn.type = 'button';
            dragBtn.className = 'queue-drag-handle';
            dragBtn.draggable = true;
            dragBtn.setAttribute('aria-label', `Reorder ${track.title || 'track'}`);
            dragBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 7h8v2H8V7zm0 4h8v2H8v-2zm0 4h8v2H8v-2z"></path></svg>';
            row.appendChild(dragBtn);

            // Swipe: right → add to playlist, left → remove from queue
            makeSwipeable(row, {
                onSwipeRight: () => pickPlaylistForTrack(track),
                onSwipeLeft: () => removeQueueTrack(index),
                leftLabel: 'Remove'
            });

            list.appendChild(row);
        });

        if (inlineList) {
            entries.slice(0, 8).forEach(({ track, index }) => {
                const inlineRow = document.createElement('div');
                inlineRow.className = 'list-item queue-row';
                inlineRow.dataset.queueIndex = String(index);
                inlineRow.dataset.trackKey = trackKey(track.title, track.artist);
                if (index === currentIdx) inlineRow.classList.add('playing-row');
                const click = document.createElement('button');
                click.type = 'button';
                click.className = 'item-clickable';
                click.addEventListener('click', () => playQueueTrackAt(index, true));

                const icon = document.createElement('div');
                icon.className = 'item-icon';
                applyArtBackground(icon, track.artUrl, FALLBACK_GRADIENT);
                const content = document.createElement('div');
                content.className = 'item-content';
                const h3 = document.createElement('h3');
                h3.textContent = track.title || 'Untitled Track';
                const sub = document.createElement('span');
                sub.textContent = track.albumTitle
                    ? `${track.artist || ARTIST_NAME} - ${track.albumTitle}`
                    : (track.artist || ARTIST_NAME);
                content.appendChild(h3);
                content.appendChild(sub);

                const stateBtn = createTrackStateButton(track, () => playQueueTrackAt(index, true), { compact: true });
                stateBtn.classList.add('queue-state-btn');
                click.appendChild(icon);
                click.appendChild(content);
                click.appendChild(stateBtn);
                inlineRow.appendChild(click);
                inlineList.appendChild(inlineRow);
            });
        }

        const footer = document.createElement('div');
        footer.className = 'queue-footer-actions';
        const shuffleBtn = document.createElement('button');
        shuffleBtn.type = 'button';
        shuffleBtn.className = 'queue-footer-btn';
        shuffleBtn.textContent = 'Shuffle Up Next';
        shuffleBtn.disabled = upcomingCount < 2;
        shuffleBtn.addEventListener('click', shuffleQueueUpNext);
        const clearUpNextBtn = document.createElement('button');
        clearUpNextBtn.type = 'button';
        clearUpNextBtn.className = 'queue-footer-btn';
        clearUpNextBtn.textContent = 'Clear Up Next';
        clearUpNextBtn.disabled = upcomingCount === 0;
        clearUpNextBtn.addEventListener('click', clearQueue);
        footer.appendChild(shuffleBtn);
        footer.appendChild(clearUpNextBtn);
        list.appendChild(footer);

        bindQueueInteractions();
        ensureAccessibility();
    }

    function toggleEditMode() {
        inEditMode = !inEditMode;
        const home = getEl('home');
        const btn = getEl('edit-home-btn');
        if (!home || !btn) return;

        if (inEditMode) {
            home.classList.add('home-editor-active');
            btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
            btn.style.background = 'var(--sys-success)';
            toast('Workspace Editor Unlocked');
        } else {
            home.classList.remove('home-editor-active');
            btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>';
            btn.style.background = 'rgba(255,255,255,0.1)';
            toast('Layout Settings Saved');
        }
    }

    // Search tags
    function toggleSearchTag(el, tagText) {
        el.classList.toggle('active');
        const searchInput = getEl('search-input');
        if (!searchInput) return;
        const container = searchInput.parentElement;

        if (el.classList.contains('active')) {
            const span = document.createElement('div');
            span.className = 'search-inline-tag';
            span.innerText = '# ' + tagText;
            span.onclick = (e) => {
                e.stopPropagation();
                span.remove();
                el.classList.remove('active');
            };
            container.insertBefore(span, searchInput);
        } else {
            container.querySelectorAll('.search-inline-tag').forEach(t => {
                if (t.innerText === '# ' + tagText) t.remove();
            });
        }
    }

    function openTagCreator() {
        getEl('tag-creator-scrim').classList.add('show');
        getEl('tag-creator').classList.add('show');
        setTimeout(() => getEl('new-tag-input')?.focus(), 250);
    }

    function closeTagCreator() {
        getEl('tag-creator-scrim').classList.remove('show');
        getEl('tag-creator').classList.remove('show');
    }

    function createTag() {
        const input = getEl('new-tag-input');
        const name = (input?.value || '').trim();
        if (!name) return;

        const row = getEl('search-tag-row');
        const addBtn = getEl('add-tag-btn');
        if (!row || !addBtn) return;

        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.draggable = true;
        chip.dataset.tag = name;
        chip.style.cssText = 'background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; gap:8px; cursor:pointer;';

        const hash = document.createElement('span');
        hash.style.cssText = 'color:var(--sys-primary); font-weight:800;';
        hash.textContent = '#';

        chip.appendChild(hash);
        chip.appendChild(document.createTextNode(' ' + name));
        chip.onclick = function () { toggleSearchTag(this, name); };

        row.insertBefore(chip, addBtn);
        input.value = '';
        closeTagCreator();
        toast(`Tag "#${name}" created`);

        bindDragAndDrop('#search-tag-row .filter-chip[draggable="true"]');
        bindTouchReorder('#search-tag-row .filter-chip[draggable="true"]');
        ensureAccessibility();
    }

    // Sheet / Sidebar
    function openSheet(title, sub) {
        getEl('sheet-title').innerText = title;
        getEl('sheet-sub').innerText = sub;
        getEl('sheet-scrim').classList.add('show');
        getEl('action-sheet').classList.add('show');
    }

    function closeSheet() {
        getEl('sheet-scrim').classList.remove('show');
        getEl('action-sheet').classList.remove('show');
    }

    function openSectionConfig(sectionName) {
        const actions = document.querySelectorAll('#action-sheet .sheet-action');
        if (actions.length > 3) {
            actions[0].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/></svg> Display as Grid';
            actions[1].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg> Display as List';
            actions[2].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> Edit Filters...';
            actions[3].innerHTML = '<svg viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> Remove Section';
            actions[0].onclick = () => { toggleMarvisLayout(); closeSheet(); };
            actions[1].onclick = () => { toggleMarvisLayout(); closeSheet(); };
            actions[2].onclick = () => { toast('Opening advanced filters'); closeSheet(); };
            actions[3].onclick = () => { toast('Section removed'); closeSheet(); };
        }

        openSheet(`${sectionName} Settings`, 'Layout & Filters');
    }

    function openSidebar() {
        getEl('sidebar-scrim').classList.add('show');
        getEl('sidebar').classList.add('show');
    }

    function closeSidebar() {
        getEl('sidebar-scrim').classList.remove('show');
        getEl('sidebar').classList.remove('show');
    }

    function openAlbumArtViewer(albumMeta) {
        if (!albumMeta) return;
        const scrim = getEl('image-viewer-scrim');
        const img = getEl('image-viewer-img');
        const title = getEl('image-viewer-title');
        const sub = getEl('image-viewer-sub');
        if (!scrim || !img) return;

        albumArtViewerLastFocus = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;
        if (title) title.textContent = albumMeta.title || 'Album Artwork';
        if (sub) sub.textContent = `${albumMeta.artist || ARTIST_NAME}${albumMeta.year ? ` - ${albumMeta.year}` : ''}`;
        img.src = resolveArtUrlForContext(albumMeta.artUrl) || '';
        img.alt = albumMeta.title ? `${albumMeta.title} cover art` : 'Album artwork';
        scrim.classList.add('show');
        albumArtViewerOpen = true;
        syncBottomNavVisibility();
        setTimeout(() => getEl('image-viewer-close')?.focus({ preventScroll: true }), 0);
    }

    function resolveNowPlayingAlbumMeta() {
        if (!nowPlaying) return null;

        // Always prioritize the playing track's own album — never show a
        // previously-browsed album when the user is in the now-playing view.
        const hintedAlbum = nowPlaying.albumTitle ? resolveAlbumMeta(nowPlaying.albumTitle) : null;
        if (hintedAlbum) return hintedAlbum;

        // activeAlbumTitle reflects the last *browsed* album and should only
        // be used as a fallback when it belongs to the same artist as the
        // currently playing track, to avoid cross-album bleed.
        if (activeAlbumTitle) {
            const activeMeta = resolveAlbumMeta(activeAlbumTitle);
            if (activeMeta && activeMeta.artist === nowPlaying.artist) return activeMeta;
        }

        return {
            title: nowPlaying.albumTitle || nowPlaying.title || 'Now Playing',
            artist: nowPlaying.artist || ARTIST_NAME,
            year: '',
            artUrl: nowPlaying.artUrl || ''
        };
    }

    function openNowPlayingArtViewer(evt) {
        if (evt) {
            evt.preventDefault();
            evt.stopPropagation();
        }
        const albumMeta = resolveNowPlayingAlbumMeta();
        if (!albumMeta || !albumMeta.artUrl) {
            toast('No artwork available');
            return;
        }
        openAlbumArtViewer(albumMeta);
    }

    function closeAlbumArtViewer() {

