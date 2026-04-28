/*
 * Auralis JS shard: 10b-zenith-library-songs.js
 * Purpose: library song window, sort, metadata subscriber, artist profile
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */


    function getActiveLibraryTabName() {
        const activeScreenSection = getLibrarySectionFromScreen(activeId);
        if (activeScreenSection) return activeScreenSection;
        const activeButton = document.querySelector('#library-nav-container .library-nav-item.active[id^="lib-btn-"]');
        return activeButton?.dataset?.section || 'playlists';
    }

    function syncLibraryTabSemantics(tab = getActiveLibraryTabName()) {
        tab = normalizeLibrarySection(tab);
        LIBRARY_SECTIONS.forEach((name) => {
            const button = getEl('lib-btn-' + name);
            const screen = getEl(getLibraryScreenId(name));
            const isActive = name === tab;
            if (button) {
                button.classList.toggle('active', isActive);
                if (isActive) button.setAttribute('aria-current', 'page');
                else button.removeAttribute('aria-current');
            }
            if (screen) {
                screen.setAttribute('aria-hidden', String(activeId !== getLibraryScreenId(name)));
            }
        });
    }

    function ensureChipVisibility(button, inline = 'nearest') {
        if (!button || typeof button.scrollIntoView !== 'function') return;
        const row = button.closest('.filter-row, .library-nav-list');
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const isVerticalList = row.classList.contains('library-nav-list');
        const needsScroll = isVerticalList
            ? buttonRect.top < rowRect.top + 12 || buttonRect.bottom > rowRect.bottom - 12
            : buttonRect.left < rowRect.left + 12 || buttonRect.right > rowRect.right - 12;
        if (!needsScroll) return;
        requestAnimationFrame(() => {
            try {
                button.scrollIntoView({ block: 'nearest', inline, behavior: 'smooth' });
            } catch (_) {
                button.scrollIntoView();
            }
        });
    }

    function syncLibrarySongSortState() {
        const row = getEl('lib-songs-sort-row');
        if (!row) return;
        row.setAttribute('role', 'tablist');
        let activeButton = null;
        row.querySelectorAll('.filter-chip').forEach((button) => {
            const isActive = button.dataset.sort === libSongsSortMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(isActive));
            button.setAttribute('tabindex', isActive ? '0' : '-1');
            if (isActive) activeButton = button;
        });
        ensureChipVisibility(activeButton, 'center');
    }

    function appendLibraryPlaylistEmptyState(container) {
        const box = createScreenEmptyState({
            className: 'screen-empty-state library-empty-state',
            title: 'No playlists',
            body: 'Create or import one.',
            iconName: 'listMusic'
        });
        box.querySelector('.screen-empty-title')?.classList.add('library-empty-title');
        box.querySelector('.screen-empty-copy')?.classList.add('library-empty-copy');

        const actions = document.createElement('div');
        actions.className = 'library-empty-actions';

        const createButton = document.createElement('button');
        createButton.type = 'button';
        createButton.className = 'library-empty-action primary';
        createButton.dataset.action = 'openCreatePlaylistDialog';
        createButton.textContent = 'Create Playlist';

        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.className = 'library-empty-action';
        importButton.dataset.action = 'importM3U';
        importButton.textContent = 'Import M3U';

        actions.appendChild(createButton);
        actions.appendChild(importButton);
        box.appendChild(actions);
        container.appendChild(box);
    }

    function appendLibraryEmptyState(container, { title, body, iconName }) {
        const box = createScreenEmptyState({
            className: 'screen-empty-state library-empty-state',
            title,
            body,
            iconName
        });
        box.querySelector('.screen-empty-title')?.classList.add('library-empty-title');
        box.querySelector('.screen-empty-copy')?.classList.add('library-empty-copy');
        container.appendChild(box);
    }

    let libSongsSortMode = 'alpha';
    const LIBRARY_SONG_INITIAL_RENDER = 80;
    const LIBRARY_SONG_RENDER_CHUNK = 120;
    let librarySongRenderToken = 0;
    let librarySongObserver = null;

    function scheduleLibrarySongWork(task) {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(task, { timeout: 160 });
        } else {
            requestAnimationFrame(task);
        }
    }

    function renderLibrarySongWindow(container, tracks) {
        librarySongRenderToken++;
        const token = librarySongRenderToken;
        if (librarySongObserver) {
            librarySongObserver.disconnect();
            librarySongObserver = null;
        }
        clearNodeChildren(container);
        container.dataset.virtualized = tracks.length > LIBRARY_SONG_INITIAL_RENDER ? 'true' : 'false';

        if (!tracks.length) {
            appendLibraryEmptyState(container, {
                title: 'No songs',
                body: 'Add music to fill this view.',
                iconName: 'music'
            });
            return;
        }

        let cursor = 0;
        const status = document.createElement('div');
        status.className = 'library-virtual-status';

        const appendChunk = () => {
            if (token !== librarySongRenderToken) return;
            const oldSentinel = container.querySelector('.library-virtual-sentinel');
            if (oldSentinel) oldSentinel.remove();

            const end = Math.min(
                tracks.length,
                cursor === 0 ? LIBRARY_SONG_INITIAL_RENDER : cursor + LIBRARY_SONG_RENDER_CHUNK
            );
            const frag = document.createDocumentFragment();
            for (let idx = cursor; idx < end; idx++) {
                const row = createLibrarySongRow(tracks[idx], true, {
                    compact: true,
                    hideAlbum: false,
                    showDuration: true,
                    metaContext: 'library'
                });
                if (idx === tracks.length - 1) row.style.border = 'none';
                frag.appendChild(row);
            }
            cursor = end;
            container.appendChild(frag);

            if (tracks.length > LIBRARY_SONG_INITIAL_RENDER) {
                status.textContent = `Showing ${cursor} of ${tracks.length} songs`;
                container.appendChild(status);
            }

            if (cursor < tracks.length) {
                const sentinel = document.createElement('button');
                sentinel.type = 'button';
                sentinel.className = 'library-virtual-sentinel';
                sentinel.textContent = 'Show more songs';
                sentinel.addEventListener('click', () => scheduleLibrarySongWork(appendChunk));
                container.appendChild(sentinel);
                if ('IntersectionObserver' in window) {
                    librarySongObserver = new IntersectionObserver((entries) => {
                        if (entries.some(entry => entry.isIntersecting)) scheduleLibrarySongWork(appendChunk);
                    }, { rootMargin: '600px 0px' });
                    librarySongObserver.observe(sentinel);
                }
            } else if (librarySongObserver) {
                librarySongObserver.disconnect();
                librarySongObserver = null;
            }

            scheduleTitleMotion(container);
        };

        appendChunk();
    }

    function switchLibSongsSort(mode) {
        libSongsSortMode = mode || 'alpha';
        syncLibrarySongSortState();
        const songsList = getEl('lib-songs-list');
        if (!songsList) return;
        renderLibrarySongWindow(songsList, getSortedTracks(libSongsSortMode));
    }

    let _libraryMetadataSubscriberBound = false;
    function bindLibraryMetadataSubscriber() {
        if (_libraryMetadataSubscriberBound) return;
        _libraryMetadataSubscriberBound = true;
        APP_STATE.on('library:metadata-refined', ({ trackKey: refinedTrackKey, previousTrackKey, albumKey: refinedAlbumKey }) => {
            const candidateKeys = [previousTrackKey, refinedTrackKey].filter(Boolean);
            const track = trackByKey.get(refinedTrackKey) || candidateKeys.map((key) => trackByKey.get(key)).find(Boolean);
            if (!track) return;
            const resolvedTrackKey = getTrackIdentityKey(track);

            candidateKeys.forEach((candidateKey) => {
                getTrackUiBindings(candidateKey).forEach((binding) => {
                    if (binding?.row) {
                        binding.row.dataset.trackKey = resolvedTrackKey;
                        binding.row.dataset.trackId = getStableTrackIdentity(track);
                        binding.row.dataset.metadataQuality = getTrackMetadataQuality(track);
                    }
                    if (binding?.click) {
                        binding.click.dataset.trackKey = resolvedTrackKey;
                        binding.click.dataset.trackId = getStableTrackIdentity(track);
                        binding.click.dataset.title = track.title;
                        binding.click.dataset.artist = track.artist;
                        binding.click.dataset.album = track.albumTitle;
                    }
                    const titleTrack = binding?.title?.querySelector('.zenith-title-track');
                    if (titleTrack) titleTrack.textContent = track.title || '';
                    (binding?.durations || []).forEach((timeEl) => {
                        if (!timeEl) return;
                        timeEl.dataset.originalDuration = getTrackDurationDisplay(track);
                        if (!(binding?.row?.classList?.contains('playing-row'))) {
                            timeEl.textContent = timeEl.dataset.originalDuration;
                        }
                    });
                    (binding?.arts || []).forEach((artEl) => applyArtBackground(artEl, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track')));
                    unregisterTrackUi(candidateKey, binding);
                    registerTrackUi(resolvedTrackKey, binding);
                });
            });

            document.querySelectorAll('.media-card[data-album-key], .list-item[data-album-key]').forEach((el) => {
                if (String(el.dataset.albumKey || '') !== String(refinedAlbumKey || '')) return;
                const artTarget = el.querySelector('.media-cover, .item-icon');
                if (artTarget) applyArtBackground(artTarget, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
            });
            scheduleTitleMotion(document);
        });
    }

    // ── Artist Profile Section System ────────────────────────────────────────

    function saveArtistProfileLayout() {
        safeStorage.setJson(STORAGE_KEYS.artistProfileLayout, artistProfileSections);
    }

    function loadArtistProfileLayout() {
        const raw = safeStorage.getJson(STORAGE_KEYS.artistProfileLayout, null);
        if (!Array.isArray(raw) || !raw.length) {
            artistProfileSections = getDefaultArtistProfileSections();
        } else {
            // Merge saved sections with defaults (ensure all core sections exist)
            const defaults = getDefaultArtistProfileSections();
            artistProfileSections = raw.map(s => ({ ...s }));
            defaults.forEach(def => {
                if (!artistProfileSections.find(s => s.id === def.id)) {
                    artistProfileSections.push(def);
                }
            });
        }
    }

    function getArtistSectionItems(section, artistName) {
        const key = toArtistKey(artistName || '');
        const limit = Math.max(1, Number(section.limit || 8));
        let items = [];
        if (section.type === 'artist_top_songs' || section.itemType === 'songs') {
            items = LIBRARY_TRACKS
                .filter(t => toArtistKey(getCanonicalTrackArtistName(t)) === key)
                .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
        } else {
            items = LIBRARY_ALBUMS
                .filter(album => toArtistKey(album.artist) === key)
                .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
        }
        return items.slice(0, limit);
    }

    function updateArtistSection(sectionId, patch) {
        const idx = artistProfileSections.findIndex(s => s.id === sectionId);
        if (idx < 0) return;
        const next = { ...artistProfileSections[idx], ...patch };
        if (next.itemType === 'songs') next.layout = ensureSongLayoutForDensity(next.layout, next.density);
        artistProfileSections[idx] = next;
        saveArtistProfileLayout();
        renderArtistProfileSections(viewedArtistName || activeArtistName);
    }

    function showArtistSectionConfigMenu(sectionId) {
        const section = artistProfileSections.find(s => s.id === sectionId);
        if (!section) return;
        const nextDensity = section.density === 'compact' ? 'large' : 'compact';
        const layoutLabels = { list: 'Track Column', carousel: 'Carousel', grid: 'Poster Grid' };
        const layoutOptions = section.itemType === 'songs'
            ? [{ value: 'list', label: 'Track Column' }, { value: 'carousel', label: 'Carousel' }]
            : [{ value: 'list', label: 'Track Column' }, { value: 'carousel', label: 'Carousel' }, { value: 'grid', label: 'Poster Grid' }];
        const countOptions = [4, 5, 6, 8, 10, 12, 16, 20, 25];

        presentActionSheet(`${section.title} Settings`, 'Artist section controls', [
            {
                label: `Presentation (${layoutLabels[section.layout] || section.layout})`,
                description: 'Switch between list, carousel, and grid.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => {
                    const actions = layoutOptions.map(opt => ({
                        label: opt.label,
                        icon: opt.value === 'carousel' ? 'carousel' : opt.value === 'grid' ? 'grid' : 'stack',
                        onSelect: () => updateArtistSection(sectionId, { layout: opt.value })
                    }));
                    presentActionSheet('Presentation Mode', section.title, actions);
                }
            },
            {
                label: `Item Count (${section.limit})`,
                description: 'How many items to show.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => {
                    const actions = countOptions.map(n => ({
                        label: `${n} items`,
                        icon: 'stack',
                        onSelect: () => updateArtistSection(sectionId, { limit: n })
                    }));
                    presentActionSheet('Item Count', section.title, actions);
                }
            },
            {
                label: `Density: ${section.density} → ${nextDensity}`,
                description: 'Compact boosts scan speed; large emphasises artwork.',
                icon: 'density',
                onSelect: () => {
                    const patch = { density: nextDensity };
                    if (section.itemType === 'songs') patch.layout = ensureSongLayoutForDensity(section.layout, nextDensity);
                    updateArtistSection(sectionId, patch);
                }
            }
        ]);
    }

    function openArtistProfileSectionMenu() {
        const actions = artistProfileSections.map(s => ({
            label: s.title,
            description: `${s.limit} items · ${s.layout} · ${s.density}`,
            icon: 'manage',
            keepOpen: true,
            onSelect: () => showArtistSectionConfigMenu(s.id)
        }));
        presentActionSheet('Artist Page Sections', 'Tap a section to configure it', actions);
    }

    function renderArtistProfileSections(artistName) {
        const root = getEl('artist-sections-root');
        if (!root || !artistName) return;
        clearNodeChildren(root);

        const visible = artistProfileSections.filter(s => s.enabled !== false);
        const blocks = [];
        visible.forEach(section => {
            const items = getArtistSectionItems(section, artistName);
            if (!items.length) return;

            const block = document.createElement('div');
            block.className = 'home-section';
            block.dataset.sectionId = section.id;

            const header = document.createElement('div');
            header.className = 'section-header';
            const left = document.createElement('div');
            left.className = 'section-header-left';
            const titleWrap = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.textContent = section.title;
            titleWrap.appendChild(h2);
            left.appendChild(titleWrap);
            bindLongPressAction(left, () => showArtistSectionConfigMenu(section.id));
            header.appendChild(left);
            block.appendChild(header);
            block.appendChild(createHomeSectionContent(section, items));
            blocks.push(block);
        });
        appendFragment(root, blocks);

        scheduleTitleMotion(root);
    }

    function renderArtistProfileView() {
        const artistScreen = getEl('artist_profile');
        if (!artistScreen) return;
        const fallback = LIBRARY_ARTISTS[0]?.name || ARTIST_NAME;
        const selected = viewedArtistName || activeArtistName || fallback;
        const selectedKey = toArtistKey(selected);
        const fallbackKey = toArtistKey(fallback);
        const artist = artistByKey.get(selectedKey)
            || LIBRARY_ARTISTS.find((entry) => toArtistKey(entry?.name) === selectedKey)
            || artistByKey.get(fallbackKey)
            || LIBRARY_ARTISTS.find((entry) => toArtistKey(entry?.name) === fallbackKey);
        if (!artist) return;
        viewedArtistName = artist.name;

        applyArtBackground(artistScreen.querySelector('.artist-bg'), artist.artUrl, getStableArtworkFallback(artist.name, 'artist'));
        const nameEl = getEl('art-name');
        if (nameEl) {
            nameEl.textContent = artist.name;
            nameEl.title = artist.name;
        }
        const metaEl = getEl('art-meta');
        if (metaEl) {
            const summary = getArtistSummary(artist.name);
            const albumLabel = `${summary.albumCount} album${summary.albumCount === 1 ? '' : 's'}`;
            const trackLabel = `${summary.trackCount} track${summary.trackCount === 1 ? '' : 's'}`;
            metaEl.textContent = `${albumLabel} • ${trackLabel}`;
            metaEl.title = metaEl.textContent;
        }

        renderArtistProfileSections(artist.name);
    }

    function renderSearchBrowseGrid() {
        const grid = getEl('search-cat-grid');
        if (!grid) return;
        clearNodeChildren(grid);
        const cards = getSortedAlbums('recent').slice(0, 8).map((album, idx) => {
            const card = document.createElement('div');
            card.className = 'cat-card';
            card.draggable = true;
            card.dataset.added = String(Math.max(1, 100 - idx));
            card.dataset.plays = String(Number(album.plays || 0));
            card.dataset.duration = String(album.tracks?.[0]?.durationSec || 0);
            card.dataset.albumTitle = album.title;
            applyArtBackground(card, album.artUrl, getStableArtworkFallback(album.title || album.id, 'album'));
            if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, card);
            card.style.border = '1px solid rgba(255,255,255,0.2)';
            card.onclick = () => routeToAlbum(album.title, album.artist, getAlbumSourceIdentity(album));
            bindLongPressAction(card, () => {
                if (typeof openAlbumZenithMenu !== 'function') return;
                const albumMeta = typeof resolveAlbumMeta === 'function' ? resolveAlbumMeta(album.title, album.artist) : album;
                if (albumMeta) openAlbumZenithMenu(albumMeta);
            });
            const span = document.createElement('span');
            span.textContent = album.title;
            span.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
            card.appendChild(span);
            return card;
        });
        appendFragment(grid, cards);
    }

