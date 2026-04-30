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

        // Exact title match only Ã¢â‚¬â€ no fuzzy substring matching
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
