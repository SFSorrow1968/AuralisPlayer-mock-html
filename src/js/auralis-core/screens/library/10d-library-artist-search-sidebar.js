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

    function renderSidebarPlaylists() {
        const list = getEl('sidebar-playlists-list');
        if (!list) return;
        clearNodeChildren(list);
        const playlists = LIBRARY_PLAYLISTS.slice(0, 10);
        if (!playlists.length) {
            const empty = createScreenEmptyState({
                className: 'screen-empty-state sidebar-empty-state',
                title: 'No playlists yet',
                body: 'Create one, then choose songs from your library.',
                iconName: 'listMusic'
            });
            const actions = document.createElement('div');
            actions.className = 'sidebar-empty-actions';

            const createButton = document.createElement('button');
            createButton.type = 'button';
            createButton.className = 'sidebar-empty-action primary';
            createButton.dataset.action = 'createPlaylistFromSidebar';
            createButton.textContent = 'New Playlist';

            const songsButton = document.createElement('button');
            songsButton.type = 'button';
            songsButton.className = 'sidebar-empty-action';
            songsButton.dataset.action = 'openLibrarySongsFromSidebar';
            songsButton.textContent = 'Browse Songs';

            actions.appendChild(createButton);
            actions.appendChild(songsButton);
            empty.appendChild(actions);
            list.appendChild(empty);
            scheduleTitleMotion(list);
            return;
        }
        appendFragment(list, playlists.map((playlist, idx) => {
            const row = createCollectionRow('playlist', playlist, 'sidebar');
            row.style.padding = '14px 0';
            if (idx === playlists.length - 1) row.style.border = 'none';
            row.querySelector('.item-clickable')?.addEventListener('click', () => closeSidebar(), { once: true });
            return row;
        }));
        scheduleTitleMotion(list);
    }
