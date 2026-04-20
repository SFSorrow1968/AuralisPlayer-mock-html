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
                    // MEDIA_ERR_SRC_NOT_SUPPORTED — usually means file path is inaccessible, not format
                    const raw = String(nowPlaying?.fileUrl || '').trim();
                    const isFileProto = /^file:\/\//i.test(raw);
                    if (isFileProto && fileHandleCache.size === 0) {
                        toast(`Add a music folder in Settings to play local files`);
                    } else if (isFileProto) {
                        toast(`"${trackTitle}" not found in scanned folders — try rescanning`);
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

    function buildSearchSubtextLine(item) {
        const line = document.createElement('div');
        line.className = 'zenith-meta zenith-meta-row';
        if (item.type === 'songs') {
            appendSearchMetaToken(line, item.artist || '', () => routeToArtistProfile(item.artist));
            appendSearchMetaToken(line, item.albumTitle || '', () => routeToAlbumDetail(item.albumTitle, item.artist, getTrackSourceAlbumIdentity(item)));
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
            const resolvedAlbum = resolveAlbumMeta(item.albumTitle || item.title, item.artist);
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
        const q = normalizeSearchText(searchQuery);

        let filtered = SEARCH_DATA.map((item) => {
            if (!activeTypes.includes(item.type)) return false;
            if (q.length > 0) {
                const score = getSearchMatchScore(item, searchQuery);
                return score > 0 ? { ...item, _searchScore: score } : false;
            }
            return item;
        }).filter(Boolean);

        filtered = sortItems(filtered, { queryActive: q.length > 0 });
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

    function playAlbumInOrder(albumTitle, startTrackIndex = 0, albumArtist = '') {
        const albumMeta = resolveAlbumMeta(albumTitle, albumArtist || activeAlbumArtist);
        if (!albumMeta || !albumMeta.tracks.length) return;
        activeAlbumTitle = albumMeta.title;
        activeAlbumArtist = getAlbumPrimaryArtistName(albumMeta, albumArtist);
        setPlaybackCollection('album', getAlbumIdentityKey(albumMeta, albumArtist));
        queueTracks = albumMeta.tracks.slice().sort((a, b) =>
            Number(a.discNo || 1) - Number(b.discNo || 1)
            || Number(a.no || 0) - Number(b.no || 0)
        );
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
        renderArtistProfileView();
    }

    function routeToArtistProfile(name) {
        if (!name) return;
        const normalized = toArtistKey(name);
        const resolved = artistByKey.get(normalized)
            || LIBRARY_ARTISTS.find((artist) => toArtistKey(artist?.name) === normalized)
            || LIBRARY_ALBUMS.find((album) => toArtistKey(album?.artist) === normalized);
        if (!resolved) {
            toast('Artist unavailable');
            return;
        }
        openArtistProfile(resolved.name || resolved.artist || name);
    }

    function routeToAlbumDetail(title, artist, sourceAlbumId = '') {
        if (!title) return;
        navToAlbum(title, artist, sourceAlbumId);
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

        const cover   = getEl('playlist-hero-cover');
        const titleEl = getEl('playlist-title');
        const subEl   = getEl('playlist-subtitle');
        const playBtn = getEl('playlist-play-btn');
        const list    = getEl('playlist-track-list');

        applyArtBackground(cover, playlist.artUrl, FALLBACK_GRADIENT);
        if (titleEl) titleEl.textContent = playlist.title || playlist.name;
        if (subEl) {
            const tc = playlist.tracks.length;
            subEl.textContent = `${tc} ${tc === 1 ? 'song' : 'songs'}`;
        }
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
            playlist.tracks.slice(0, 200).forEach((track, idx) => {
                const row = document.createElement('div');
                row.className = 'list-item album-track-row';
                row.dataset.trackKey = trackKey(track.title, track.artist);
                row.dataset.metadataStatus = getTrackMetadataStatus(track);
                if (idx === Math.min(playlist.tracks.length, 200) - 1) row.style.borderBottom = 'none';

                const click = document.createElement('button');
                click.className = 'item-clickable';
                click.type = 'button';
                click.addEventListener('click', () => playPlaylistInOrder(playlist.id, idx));
                bindLongPressAction(click, () => openTrackZenithMenu(track));

                const numEl = document.createElement('span');
                numEl.className = 'track-num';
                numEl.textContent = String(idx + 1);

                const content = document.createElement('div');
                content.className = 'item-content';
                const titleNode = document.createElement('h3');
                titleNode.textContent = track.title;
                const artistNode = document.createElement('span');
                artistNode.style.cssText = 'font-size:12px; color:var(--text-secondary);';
                artistNode.textContent = track.artist || '';
                content.appendChild(titleNode);
                if (track.artist) content.appendChild(artistNode);

                const durationEl = document.createElement('span');
                durationEl.className = 'album-track-duration';
                durationEl.textContent = getTrackDurationDisplay(track);
                durationEl.dataset.originalDuration = durationEl.textContent;
                durationEl.dataset.metadataStatus = getTrackMetadataStatus(track);

                const stateBtn = createTrackStateButton(track, () => playPlaylistInOrder(playlist.id, idx), { compact: true });
                stateBtn.classList.add('album-track-state-btn');

                click.appendChild(numEl);
                click.appendChild(content);
                click.appendChild(durationEl);
                click.appendChild(stateBtn);
                row.appendChild(click);
                registerTrackUi(trackKey(track.title, track.artist), { row, click, stateButton: stateBtn, durations: [durationEl] });
                list.appendChild(row);
            });
        }

        setPlayButtonState(isPlaying);
        push('playlist_detail');
        ensureAccessibility();
    }

    // ── Playlist zenith menu (3-dot) ──────────────────────────────────
    function openPlaylistZenithMenu() {
        const pl = userPlaylists.find(p => p.id === activePlaylistId);
        if (!pl) return;
        showZenithActionSheet(
            pl.name || pl.title,
            `${pl.tracks.length} songs`,
            [
                {
                    label: 'Add Songs',
                    description: 'Browse your library and add tracks.',
                    icon: 'queue',
                    onSelect: () => openAddSongsToPlaylist()
                },
                {
                    label: 'Rename Playlist',
                    description: 'Give this playlist a new name.',
                    icon: 'manage',
                    onSelect: () => {
                        const newName = prompt('New name:', pl.name || pl.title);
                        if (newName && newName.trim()) {
                            if (typeof renameUserPlaylist === 'function') renameUserPlaylist(pl.id, newName.trim());
                            const titleEl = getEl('playlist-title');
                            if (titleEl) titleEl.textContent = newName.trim();
                        }
                    }
                },
                {
                    label: 'Delete Playlist',
                    description: 'Permanently remove this playlist.',
                    icon: 'trash',
                    danger: true,
                    onSelect: () => {
                        showConfirm(
                            `Delete "${pl.name || pl.title}"?`,
                            'This playlist will be permanently deleted.',
                            'Delete',
                            () => {
                                deleteUserPlaylist(pl.id);
                                activePlaylistId = '';
                                pop();
                                setLibraryRenderDirty(true);
                                renderLibraryViews({ force: true });
                            }
                        );
                    }
                }
            ]
        );
    }

    // ── Add Songs to Playlist overlay ────────────────────────────────
    function openAddSongsToPlaylist() {
        const scrim = getEl('add-songs-scrim');
        const searchInput = getEl('add-songs-search');
        const listEl = getEl('add-songs-list');
        if (!scrim || !listEl) return;

        function renderSongList(query) {
            listEl.innerHTML = '';
            const q = (query || '').toLowerCase();
            const tracks = Array.isArray(LIBRARY_TRACKS) ? LIBRARY_TRACKS : [];
            const filtered = q ? tracks.filter(t =>
                (t.title || '').toLowerCase().includes(q) ||
                (t.artist || '').toLowerCase().includes(q)
            ) : tracks;
            if (!filtered.length) {
                const empty = document.createElement('p');
                empty.style.cssText = 'color:var(--text-tertiary); font-size:14px; padding:12px 0;';
                empty.textContent = q ? 'No matching songs.' : 'No songs in library yet.';
                listEl.appendChild(empty);
                return;
            }
            filtered.slice(0, 300).forEach(track => {
                const row = document.createElement('div');
                row.className = 'list-item album-track-row';
                row.style.cssText = 'padding:10px 0 !important; cursor:pointer;';
                const btn = document.createElement('button');
                btn.className = 'item-clickable';
                btn.type = 'button';
                btn.style.cssText = 'gap:12px; align-items:center; width:100%;';
                const content = document.createElement('div');
                content.className = 'item-content';
                const t = document.createElement('h3');
                t.style.fontSize = '14px';
                t.textContent = track.title;
                const a = document.createElement('span');
                a.style.cssText = 'font-size:12px; color:var(--text-secondary);';
                a.textContent = track.artist || '';
                content.appendChild(t);
                if (track.artist) content.appendChild(a);
                const addIcon = document.createElement('span');
                addIcon.innerHTML = '<svg viewBox="0 0 24 24" width="20" fill="currentColor" style="color:var(--sys-primary);"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
                addIcon.style.marginLeft = 'auto';
                btn.appendChild(content);
                btn.appendChild(addIcon);
                btn.addEventListener('click', () => {
                    addTrackToUserPlaylist(activePlaylistId, track);
                    // Re-render the playlist track list live
                    const pl = userPlaylists.find(p => p.id === activePlaylistId);
                    if (pl) {
                        if (typeof openPlaylist === 'function') openPlaylist(activePlaylistId);
                    }
                    closeAddSongsToPlaylist();
                    push('playlist_detail');
                });
                row.appendChild(btn);
                listEl.appendChild(row);
            });
        }

        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => renderSongList(searchInput.value);
        }
        renderSongList('');
        scrim.classList.add('show');
        if (searchInput) setTimeout(() => searchInput.focus(), 50);
    }

    function closeAddSongsToPlaylist() {
        const scrim = getEl('add-songs-scrim');
        if (scrim) scrim.classList.remove('show');
    }

    function resolveAlbumMeta(inputTitle, inputArtist = '', inputSourceAlbumId = '') {
        if (inputTitle == null && !LIBRARY_ALBUMS.length) return null;
        const rawSourceId = inputSourceAlbumId || (typeof inputTitle === 'object' && inputTitle ? getAlbumSourceIdentity(inputTitle) : '');
        if (rawSourceId && albumBySourceId.has(rawSourceId)) return albumBySourceId.get(rawSourceId);
        const rawTitle = typeof inputTitle === 'string'
            ? inputTitle
            : (inputTitle && typeof inputTitle === 'object' ? inputTitle.title : '');
        const rawArtist = typeof inputTitle === 'object' && inputTitle
            ? (inputTitle.albumArtist || inputTitle.artist || inputArtist || '')
            : inputArtist;
        if (typeof getCanonicalBackendAlbumMeta === 'function') {
            const canonicalBackendAlbum = getCanonicalBackendAlbumMeta(inputTitle, inputArtist);
            if (canonicalBackendAlbum) return canonicalBackendAlbum;
            if (typeof scheduleCanonicalLibraryBackendHydration === 'function') {
                void scheduleCanonicalLibraryBackendHydration('resolveAlbumMeta');
            }
        }
        const normalizedTitle = normalizeAlbumTitle(rawTitle);
        const normalizedKey = albumKey(normalizedTitle);
        const normalizedArtist = toArtistKey(rawArtist);
        if (normalizedKey && normalizedArtist) {
            const exactByIdentity = albumByIdentity.get(albumIdentityKey(normalizedTitle, rawArtist));
            if (exactByIdentity) return exactByIdentity;
            const exactByArtist = LIBRARY_ALBUMS.find((album) => (
                albumKey(album?.title || '') === normalizedKey
                && albumMatchesArtistHint(album, rawArtist)
            ));
            if (exactByArtist) return exactByArtist;
        }

        const exact = albumByTitle.get(normalizedKey);
        if (exact && (!normalizedArtist || albumMatchesArtistHint(exact, rawArtist))) return exact;

        // Exact title match only — no fuzzy substring matching
        if (normalizedKey) {
            const exactTitleMatch = LIBRARY_ALBUMS.find((album) => {
                if (albumKey(album?.title || '') !== normalizedKey) return false;
                return albumMatchesArtistHint(album, rawArtist);
            });
            if (exactTitleMatch) return exactTitleMatch;
        }

        return null;
    }

    function renderAlbumDetail(albumMeta) {
        if (!albumMeta) return;
        activeAlbumTitle = albumMeta.title;
        activeAlbumArtist = getAlbumPrimaryArtistName(albumMeta, albumMeta.artist);
        viewedAlbumTitle = activeAlbumTitle;
        viewedAlbumArtist = activeAlbumArtist;

        const at = getEl('alb-title');
        const aa = getEl('alb-artist');
        const am = getEl('alb-meta');
        const trackCount = albumMeta.tracks?.length || Number(albumMeta.trackCount || 0);

        const albumMetaDone = Array.isArray(albumMeta.tracks) && albumMeta.tracks.length > 0 && albumMeta.tracks.every(t => t._metaDone);
        const titleMissing  = albumMetaDone && isMissingMetadata(albumMeta.title,  'album');
        const artistMissing = albumMetaDone && isMissingMetadata(albumMeta.artist, 'artist');
        const yearMissing   = albumMetaDone && !albumMeta.year;

        if (at) {
            at.textContent = titleMissing  ? 'No Album Tag'  : albumMeta.title;
            at.classList.toggle('metadata-error', titleMissing);
        }
        if (aa) {
            aa.textContent = artistMissing ? 'No Artist Tag' : albumMeta.artist;
            aa.classList.toggle('metadata-error', artistMissing);
        }
        if (am) {
            renderAlbumMetadataLine(albumMeta, am);
        }
        const albArtEl = getEl('alb-art');
        applyArtBackground(albArtEl, albumMeta.artUrl, FALLBACK_GRADIENT);
        if (!albumMeta.artUrl && albArtEl && typeof lazyLoadArt === 'function') lazyLoadArt(albumMeta, albArtEl);
        wireAlbumDetailHeaderInteractions(albumMeta);
        ensureAlbumProgressBinding();

        const playBtn = getEl('alb-play-btn');
        if (playBtn && albumMeta.tracks?.[0]) {
            // Clear any stale data-action/data-title/data-artist left from HTML placeholder
            // so the delegated ACTION_MAP handler does not intercept this click.
            playBtn.removeAttribute('data-action');
            playBtn.removeAttribute('data-title');
            playBtn.removeAttribute('data-artist');
            playBtn.dataset.collectionType = 'album';
            playBtn.dataset.collectionKey = getAlbumIdentityKey(albumMeta, albumMeta.artist);
            playBtn.onclick = (evt) => {
                if (isCollectionActive('album', getAlbumIdentityKey(albumMeta, albumMeta.artist))) {
                    togglePlayback(evt);
                    return;
                }
                playAlbumInOrder(albumMeta.title, 0, albumMeta.artist);
            };
        }

        const list = getEl('album-track-list');
        if (list) {
            clearTrackUiRegistryForRoot(list);
            list.innerHTML = '';
            const tracks = (Array.isArray(albumMeta.tracks) ? albumMeta.tracks : []).slice().sort((a, b) =>
                Number(a.discNo || 1) - Number(b.discNo || 1)
                || Number(a.no || 0) - Number(b.no || 0)
            );
            tracks.forEach((track, idx) => {
                const row = document.createElement('div');
                row.className = 'list-item album-track-row';
                row.dataset.trackKey = trackKey(track.title, track.artist);
                row.dataset.trackId = getStableTrackIdentity(track);
                row.dataset.metadataStatus = getTrackMetadataStatus(track);
                row.dataset.metadataQuality = getTrackMetadataQuality(track);
                if (idx === tracks.length - 1) row.style.borderBottom = 'none';

                const click = document.createElement('button');
                click.className = 'item-clickable';
                click.type = 'button';
                click.addEventListener('click', () => playAlbumInOrder(albumMeta.title, idx, albumMeta.artist));
                bindLongPressAction(click, () => openTrackZenithMenu(track));

                const numEl = document.createElement('span');
                numEl.className = 'track-num';
                numEl.textContent = String(track.no || idx + 1);

                const content = document.createElement('div');
                content.className = 'item-content';
                const titleEl = document.createElement('h3');
                titleEl.textContent = track.title;
                content.appendChild(titleEl);
                const qualityLabel = getTrackMetadataQualityLabel(track);
                if (qualityLabel) {
                    const qualityEl = document.createElement('span');
                    qualityEl.className = `metadata-quality-pill is-${getTrackMetadataQuality(track)}`;
                    qualityEl.textContent = qualityLabel;
                    qualityEl.title = getTrackMetadataQualityDescription(track);
                    content.appendChild(qualityEl);
                }

                const durationEl = document.createElement('span');
                durationEl.className = 'album-track-duration';
                durationEl.textContent = getTrackDurationDisplay(track);
                durationEl.dataset.originalDuration = durationEl.textContent;
                durationEl.dataset.metadataStatus = getTrackMetadataStatus(track);
                const stateBtn = createTrackStateButton(track, () => playAlbumInOrder(albumMeta.title, idx, albumMeta.artist), { compact: true });
                stateBtn.classList.add('album-track-state-btn');

                click.appendChild(numEl);
                click.appendChild(content);
                click.appendChild(durationEl);
                click.appendChild(stateBtn);
                row.appendChild(click);
                registerTrackUi(trackKey(track.title, track.artist), { row, click, stateButton: stateBtn, durations: [durationEl] });
                list.appendChild(row);
            });
        }

        const engine = ensureAudioEngine();
        const currentSeconds = engine && Number.isFinite(engine.currentTime) ? engine.currentTime : 0;
        const currentDuration = engine && Number.isFinite(engine.duration) && engine.duration > 0
            ? engine.duration
            : (nowPlaying?.durationSec || 0);
        updateAlbumProgressLine(currentSeconds, currentDuration);
        setPlayButtonState(isPlaying);
        push('album_detail');
        ensureAccessibility();
    }

    function navToAlbum(album, artist, sourceAlbumId = '') {
        const resolved = resolveAlbumMeta(album, artist, sourceAlbumId);
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
                card.addEventListener('click', () => navToAlbum(album.title, album.artist, getAlbumSourceIdentity(album)));
                card.addEventListener('mousedown', (e) => startLongPress(e, album.title, album.artist));
                card.addEventListener('mouseup', clearLongPress);
                card.addEventListener('mouseleave', clearLongPress);

                const span = document.createElement('span');
                span.textContent = album.title;
                span.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
                card.appendChild(span);
                const jbKey = getAlbumIdentityKey(album, album.artist);
                const jbPlayBtn = document.createElement('div');
                jbPlayBtn.className = 'catalog-play-btn';
                jbPlayBtn.dataset.collectionType = 'album';
                jbPlayBtn.dataset.collectionKey = jbKey;
                jbPlayBtn.innerHTML = getPlaybackIconSvg(isCollectionPlaying('album', jbKey));
                jbPlayBtn.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    if (isCollectionActive('album', jbKey)) { togglePlayback(evt); }
                    else { playAlbumInOrder(album.title, 0, album.artist); }
                });
                card.appendChild(jbPlayBtn);
                mod.appendChild(card);
                return;
            }

            const card = document.createElement('div');
            card.className = 'media-card';
            card.addEventListener('click', () => navToAlbum(album.title, album.artist, getAlbumSourceIdentity(album)));
            card.addEventListener('mousedown', (e) => startLongPress(e, album.title, album.artist));
            card.addEventListener('mouseup', clearLongPress);
            card.addEventListener('mouseleave', clearLongPress);
            card.addEventListener('touchstart', (e) => startLongPress(e, album.title, album.artist), { passive: true });
            card.addEventListener('touchend', clearLongPress, { passive: true });

            const cover = document.createElement('div');
            cover.className = 'media-cover';
            applyArtBackground(cover, album.artUrl, FALLBACK_GRADIENT);
            if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, cover);
            const jbKey = getAlbumIdentityKey(album, album.artist);
            const jbPlayBtn = document.createElement('div');
            jbPlayBtn.className = 'catalog-play-btn';
            jbPlayBtn.dataset.collectionType = 'album';
            jbPlayBtn.dataset.collectionKey = jbKey;
            jbPlayBtn.innerHTML = getPlaybackIconSvg(isCollectionPlaying('album', jbKey));
            jbPlayBtn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                if (isCollectionActive('album', jbKey)) { togglePlayback(evt); }
                else { playAlbumInOrder(album.title, 0, album.artist); }
            });
            cover.appendChild(jbPlayBtn);

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

    function getQueueViewModel() {
        if (!Array.isArray(queueTracks) || queueTracks.length === 0) {
            return {
                currentIdx: -1,
                currentEntry: null,
                upNextEntries: [],
                inlineEntries: []
            };
        }
        const currentIdx = getCurrentQueueIndex();
        const safeIndex = currentIdx >= 0 ? currentIdx : 0;
        const currentTrack = queueTracks[safeIndex] || null;
        const currentEntry = currentTrack ? { track: currentTrack, index: safeIndex } : null;
        const upNextEntries = queueTracks
            .slice(safeIndex + 1)
            .map((track, offset) => ({ track, index: safeIndex + 1 + offset }));
        return {
            currentIdx: safeIndex,
            currentEntry,
            upNextEntries,
            inlineEntries: upNextEntries
        };
    }

    function playQueueTrackAt(index, autoplay = true) {
        const safeIndex = Number(index);
        if (!Number.isFinite(safeIndex)) return;
        if (safeIndex < 0 || safeIndex >= queueTracks.length) return;
        const track = queueTracks[safeIndex];
        if (!track) return;
        queueIndex = safeIndex;
        // GAP 8: clear stale collection key when jumping to a track from a different album
        if (activePlaybackCollectionType === 'album' && activePlaybackCollectionKey) {
            const rawAlbum = String(track.albumTitle || '').trim();
            if (rawAlbum) {
                const tKey = normalizeCollectionKey('album', getAlbumIdentityKey({ title: rawAlbum }, track.artist || ''));
                if (tKey !== activePlaybackCollectionKey) setPlaybackCollection('', '');
            }
        }
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

    function createQueueSectionHeading(title, detail = '') {
        const head = document.createElement('div');
        head.className = 'queue-section-heading';

        const heading = document.createElement('h3');
        heading.className = 'queue-section-title';
        heading.textContent = title;
        head.appendChild(heading);

        if (detail) {
            const meta = document.createElement('div');
            meta.className = 'queue-section-detail';
            meta.textContent = detail;
            head.appendChild(meta);
        }
        return head;
    }

    function createQueueEmptyState(message, ctaLabel = '', onClick = null) {
        const card = document.createElement('div');
        card.className = 'queue-empty-card';

        const copy = document.createElement('div');
        copy.className = 'queue-empty-copy';
        copy.textContent = message;
        card.appendChild(copy);

        if (ctaLabel && typeof onClick === 'function') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'queue-utility-btn is-primary';
            btn.textContent = ctaLabel;
            btn.addEventListener('click', onClick);
            card.appendChild(btn);
        }

        return card;
    }

    function createQueueOverviewCard(track, upcomingCount, totalCount, remainingLabel) {
        const card = document.createElement('div');
        card.className = 'queue-overview-card';

        const eyebrow = document.createElement('div');
        eyebrow.className = 'queue-overview-eyebrow';
        eyebrow.textContent = track ? 'Current session' : 'Queue ready';
        card.appendChild(eyebrow);

        const headline = document.createElement('div');
        headline.className = 'queue-overview-headline';
        headline.textContent = track ? (track.title || 'Untitled Track') : 'Start playback to build your queue';
        card.appendChild(headline);

        const subline = document.createElement('div');
        subline.className = 'queue-overview-subline';
        subline.textContent = track
            ? `${getCanonicalTrackArtistName(track, track.artist || ARTIST_NAME) || ARTIST_NAME}${track.albumTitle ? ` • ${track.albumTitle}` : ''}`
            : 'Queue from any song, album, or playlist.';
        card.appendChild(subline);

        const stats = document.createElement('div');
        stats.className = 'queue-overview-stats';
        [
            `${totalCount} total`,
            `${upcomingCount} up next`,
            remainingLabel || 'Ready'
        ].forEach((label) => {
            const pill = document.createElement('span');
            pill.className = 'queue-overview-pill';
            pill.textContent = label;
            stats.appendChild(pill);
        });
        card.appendChild(stats);

        return card;
    }

    function renderQueue() {
        const list = getEl('queue-list');
        const inlineList = getEl('player-inline-queue-list');
        const kickerEl = getEl('queue-kicker');
        const summaryEl = getEl('queue-summary');
        const clearBtn = getEl('queue-clear-btn');
        const engine = ensureAudioEngine();
        if (!list) return;
        clearTrackUiRegistryForRoot(list);
        if (inlineList) clearTrackUiRegistryForRoot(inlineList);
        list.innerHTML = '';
        if (inlineList) inlineList.innerHTML = '';

        const { currentIdx, currentEntry, upNextEntries, inlineEntries } = getQueueViewModel();
        const hasQueue = queueTracks.length > 0;
        const currentTrack = currentEntry?.track || null;
        const upcomingCount = upNextEntries.length;
        const currentSeconds = engine && Number.isFinite(engine.currentTime) ? engine.currentTime : 0;
        const currentDuration = engine && Number.isFinite(engine.duration) && engine.duration > 0
            ? engine.duration
            : (nowPlaying?.durationSec || 0);
        const remainingLabel = hasQueue
            ? getQueueMetaTimeLabel(Math.max(0, currentIdx), currentSeconds, currentDuration)
            : '';
        if (kickerEl) kickerEl.textContent = hasQueue ? 'Playback Queue' : 'Queue';
        if (summaryEl) {
            if (!hasQueue) summaryEl.textContent = 'Queue is empty';
            else summaryEl.textContent = upcomingCount
                ? `${upcomingCount} tracks queued after now playing • ${remainingLabel}`
                : 'No tracks are queued after the current song';
        }
        if (clearBtn) {
            clearBtn.disabled = !hasQueue || upcomingCount === 0;
            clearBtn.setAttribute('aria-label', upcomingCount ? 'Clear up next' : 'Clear up next unavailable');
            clearBtn.title = upcomingCount ? 'Clear Up Next' : 'Nothing queued after the current song';
        }

        if (!hasQueue) {
            list.appendChild(createQueueEmptyState('Queue is empty. Find something to play and it will appear here.', 'Find Music', () => {
                if (activeId === 'queue') pop();
                const searchTab = getEl('tabs')?.querySelectorAll('.nav-item')[1];
                switchTab('search', searchTab);
            }));
            if (inlineList) {
                const inlineEmpty = document.createElement('div');
                inlineEmpty.className = 'queue-inline-empty';
                inlineEmpty.textContent = 'No tracks queued yet.';
                inlineList.appendChild(inlineEmpty);
            }
            bindQueueInteractions();
            ensureAccessibility();
            return;
        }

        list.appendChild(createQueueOverviewCard(currentTrack, upcomingCount, queueTracks.length, remainingLabel));

        if (currentEntry) {
            list.appendChild(createQueueSectionHeading('Now Playing', currentTrack?.duration || ''));
            list.appendChild(createQueueTrackRow(currentEntry.track, {
                queueIndex: currentEntry.index,
                isCurrent: true,
                supportingText: 'Playback continues while you reorder what comes next.',
                badgeLabel: isPlaying ? 'Playing now' : 'Ready to resume',
                badgeTone: isPlaying ? 'live' : 'muted',
                onActivate: () => {
                    if (Date.now() < queueDragSuppressUntil) return;
                    playQueueTrackAt(currentEntry.index, true);
                },
                onLongPress: () => openQueueTrackMenu(currentEntry.track, currentEntry.index),
                onMenu: () => openQueueTrackMenu(currentEntry.track, currentEntry.index)
            }));
        }

        list.appendChild(createQueueSectionHeading('Up Next', upcomingCount ? `${upcomingCount} tracks` : 'Nothing queued'));
        if (!upNextEntries.length) {
            list.appendChild(createQueueEmptyState('You are at the end of the queue. Add more music or shuffle another album.'));
        } else {
            upNextEntries.forEach(({ track, index }, offset) => {
                const row = createQueueTrackRow(track, {
                    queueIndex: index,
                    reorderable: true,
                    badgeLabel: offset === 0 ? 'Next' : `#${offset + 2}`,
                    badgeTone: offset === 0 ? 'next' : 'muted',
                    onActivate: () => {
                        if (Date.now() < queueDragSuppressUntil) return;
                        playQueueTrackAt(index, true);
                    },
                    onLongPress: () => openQueueTrackMenu(track, index),
                    onMenu: () => openQueueTrackMenu(track, index)
                });
                makeSwipeable(row, {
                    onSwipeRight: () => pickPlaylistForTrack(track),
                    onSwipeLeft: () => removeQueueTrack(index),
                    leftLabel: 'Remove'
                });
                list.appendChild(row);
            });
        }

        if (inlineList) {
            if (!inlineEntries.length) {
                const inlineEmpty = document.createElement('div');
                inlineEmpty.className = 'queue-inline-empty';
                inlineEmpty.textContent = 'Nothing queued after the current track.';
                inlineList.appendChild(inlineEmpty);
            } else {
                inlineEntries.forEach(({ track, index }, offset) => {
                    inlineList.appendChild(createQueueTrackRow(track, {
                        queueIndex: index,
                        compact: true,
                        badgeLabel: offset === 0 ? 'Next' : '',
                        badgeTone: 'next',
                        showDuration: false,
                        onActivate: () => playQueueTrackAt(index, true)
                    }));
                });
            }
        }

        const footer = document.createElement('div');
        footer.className = 'queue-footer-actions';
        const shuffleBtn = document.createElement('button');
        shuffleBtn.type = 'button';
        shuffleBtn.className = 'queue-utility-btn';
        shuffleBtn.textContent = 'Shuffle Up Next';
        shuffleBtn.disabled = upcomingCount < 2;
        shuffleBtn.addEventListener('click', shuffleQueueUpNext);
        const clearUpNextBtn = document.createElement('button');
        clearUpNextBtn.type = 'button';
        clearUpNextBtn.className = 'queue-utility-btn';
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
        // Restore data-action attrs that presentActionSheet saved before removing them
        document.querySelectorAll('#action-sheet .sheet-action').forEach(row => {
            if ('savedAction' in row.dataset) {
                if (row.dataset.savedAction) row.dataset.action = row.dataset.savedAction;
                delete row.dataset.savedAction;
            }
        });
    }

    // ── Create-Playlist Dialog ──
    function openCreatePlaylistDialog() {
        const scrim = getEl('create-playlist-scrim');
        const input = getEl('create-playlist-input');
        const err = getEl('create-playlist-error');
        if (!scrim || !input) return;
        input.value = '';
        if (err) err.textContent = '';
        scrim.classList.add('show');
        // Use a short delay so the animation starts before focus
        setTimeout(() => input.focus(), 50);
    }

    function closeCreatePlaylistDialog() {
        const scrim = getEl('create-playlist-scrim');
        if (scrim) scrim.classList.remove('show');
    }

    function submitCreatePlaylist() {
        const input = getEl('create-playlist-input');
        const err = getEl('create-playlist-error');
        if (!input) return;
        const name = input.value.trim();
        if (!name) {
            if (err) err.textContent = 'Please enter a name.';
            input.focus();
            return;
        }
        if (err) err.textContent = '';
        const pl = createUserPlaylist(name);
        closeCreatePlaylistDialog();
        toast(`Playlist "${pl.name}" created`);
        // Navigate to the new playlist if in the library
        if (typeof routeToPlaylistDetail === 'function') routeToPlaylistDetail(pl.id);
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
            actions[2].onclick = () => { closeSheet(); openPlaceholderScreen('Section Filters', 'Advanced section filters are still a placeholder in this build.'); };
            actions[3].onclick = () => { closeSheet(); openPlaceholderScreen('Remove Section', 'Section removal from this legacy sheet is still a placeholder here.'); };
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
        const hintedAlbum = nowPlaying.albumTitle ? resolveAlbumMeta(nowPlaying.albumTitle, nowPlaying.artist) : null;
        if (hintedAlbum) return hintedAlbum;

        // activeAlbumTitle reflects the last *browsed* album and should only
        // be used as a fallback when it belongs to the same artist as the
        // currently playing track, to avoid cross-album bleed.
        if (activeAlbumTitle) {
            const activeMeta = resolveAlbumMeta(activeAlbumTitle, activeAlbumArtist || nowPlaying?.artist || '');
            if (activeMeta && albumMatchesArtistHint(activeMeta, nowPlaying?.artist || '')) return activeMeta;
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

