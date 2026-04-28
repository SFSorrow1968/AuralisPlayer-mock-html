    }
/*
 * Auralis JS shard: 04d-navigation-queue-dialogs.js
 * Purpose: queue long press, queue UI, edit mode, tags, sheets, dialogs, sidebar
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */


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
            ? `${getCanonicalTrackArtistName(track, track.artist || ARTIST_NAME) || ARTIST_NAME}${track.albumTitle ? ` â€¢ ${track.albumTitle}` : ''}`
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
                ? `${upcomingCount} tracks queued after now playing â€¢ ${remainingLabel}`
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
                const libraryTab = getEl('tabs')?.querySelectorAll('.nav-item')[1];
                switchTab('library', libraryTab);
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
        focusFirstAction(getEl('action-sheet'));
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

    // â”€â”€ Create-Playlist Dialog â”€â”€
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

        // Always prioritize the playing track's own album â€” never show a
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

