/*
 * Auralis JS shard: 08b-zenith-row-cards.js
 * Purpose: song rows, queue rows, track rows, collection rows, cards and tiles
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function createLibrarySongRow(track, includeArt = true, options = {}) {
        const metaContext = toEntityContext(options.metaContext || 'library');
        const trackKeyValue = getTrackIdentityKey(track);
        const row = document.createElement('div');
        row.className = `list-item zenith-row${options.compact ? ' is-compact' : ''}`;
        row.dataset.trackKey = trackKeyValue;
        row.dataset.trackId = getStableTrackIdentity(track);
        row.dataset.metadataStatus = getTrackMetadataStatus(track);
        row.dataset.metadataQuality = getTrackMetadataQuality(track);
        row.style.borderColor = 'var(--border-default)';
        if (nowPlaying && isSameTrack(track, nowPlaying)) {
            row.classList.add('is-now-playing', 'playing-row');
            row.setAttribute('aria-current', 'true');
        }

        const click = document.createElement('div');
        click.tabIndex = 0;
        click.setAttribute('role', 'button');
        click.className = 'item-clickable';
        setDelegatedAction(click, 'playTrack', {
            title: track.title,
            artist: track.artist,
            album: track.albumTitle,
            trackId: getStableTrackIdentity(track)
        });
        click.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            playTrack(track.title, track.artist, track.albumTitle, getStableTrackIdentity(track));
        });
        bindLongPressAction(click, () => openTrackActionMenu(track, metaContext));

        let icon = null;
        if (includeArt) {
            icon = document.createElement('div');
            icon.className = 'item-icon';
            applyArtBackground(icon, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
            if (!track.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(track, icon);
            click.appendChild(icon);
        }

        const content = document.createElement('div');
        content.className = 'item-content';
        const h3 = document.createElement('h3');
        h3.appendChild(createTitleRail(track.title));
        content.appendChild(h3);
        const metaLine = createMetaLine(
            getSongMetaParts(track, { ...options, metaContext }),
            getEntitySubtextPrefs('song', metaContext)
        );
        if (metaLine) content.appendChild(metaLine);
        click.appendChild(content);

        row.appendChild(click);
        const stateButton = createTrackStateButton(
            track,
            () => playTrack(track.title, track.artist, track.albumTitle),
            { compact: Boolean(options.compact) }
        );
        row.appendChild(createActionZone({
            stateButton,
            duration: options.showDuration === false ? '' : getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track),
            heartButton: null
        }));
        registerTrackUi(trackKeyValue, {
            row,
            click,
            title: h3,
            durations: Array.from(row.querySelectorAll('.album-track-duration, .zenith-time-pill')),
            stateButton,
            arts: icon ? [icon] : []
        });

        // Swipe actions Ã¢â‚¬â€ right: add to playlist, left: remove (editable contexts only)
        const swipeOpts = { onSwipeRight: () => pickPlaylistForTrack(track) };
        if (metaContext === 'playlist_detail' && options._playlistRef) {
            swipeOpts.onSwipeLeft = () => {
                const pl = options._playlistRef;
                const idx = pl.tracks?.indexOf(track);
                if (idx >= 0) {
                    pl.tracks.splice(idx, 1);
                    toast(`Removed "${track.title}" from ${pl.title}`);
                    renderPlaylistDetail(pl);
                }
            };
            swipeOpts.leftLabel = 'Remove';
        }
        makeSwipeable(row, swipeOpts);

        return row;
    }

    function createQueueTrackRow(track, options = {}) {
        const trackKeyValue = getTrackIdentityKey(track);
        const row = document.createElement('div');
        row.className = `list-item zenith-row queue-row${options.compact ? ' is-compact' : ''}`;
        row.dataset.trackKey = trackKeyValue;
        row.dataset.trackId = getStableTrackIdentity(track);
        row.dataset.metadataStatus = getTrackMetadataStatus(track);
        row.dataset.metadataQuality = getTrackMetadataQuality(track);
        
        if (Number.isFinite(Number(options.queueIndex))) {
            row.dataset.queueIndex = String(Number(options.queueIndex));
        }
        
        row.dataset.queueReorderable = options.reorderable ? '1' : '0';
        row.style.borderColor = 'var(--border-default)';
        
        if (options.isCurrent) row.classList.add('playing-row', 'queue-current-row');
        if (nowPlaying && isSameTrack(track, nowPlaying)) {
            row.classList.add('is-now-playing', 'playing-row');
            row.setAttribute('aria-current', 'true');
        }
        if (options.reorderable) row.classList.add('queue-upnext-row');

        const click = document.createElement('div');
        click.tabIndex = 0;
        click.setAttribute('role', 'button');
        click.className = 'item-clickable';
        click.addEventListener('click', (evt) => {
            evt.preventDefault();
            if (typeof options.onActivate === 'function') options.onActivate(evt);
        });
        click.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (typeof options.onActivate === 'function') options.onActivate(event);
        });
        if (typeof options.onLongPress === 'function') bindLongPressAction(click, options.onLongPress);

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        applyArtBackground(icon, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
        if (!track.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(track, icon);
        click.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'item-content';
        const h3 = document.createElement('h3');
        h3.appendChild(createTitleRail(track.title || 'Untitled Track'));
        content.appendChild(h3);
        click.appendChild(content);
        row.appendChild(click);
        const actionZone = createActionZone({
            duration: options.showDuration === false ? '' : getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track)
        });
        if (options.reorderable) {
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'queue-drag-handle';
            handle.setAttribute('aria-label', `Reorder ${track.title || 'track'}`);
            handle.innerHTML = getIconSvg('manage');
            if (typeof options.onMenu === 'function') handle.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                options.onMenu(evt);
            });
            actionZone.insertBefore(handle, actionZone.firstChild);
        }
        row.appendChild(actionZone);

        registerTrackUi(trackKeyValue, {
            row,
            click,
            title: h3,
            durations: Array.from(row.querySelectorAll('.album-track-duration, .zenith-time-pill')),
            stateButton: null,
            arts: [icon]
        });
        
        return row;
    }


    // â”€â”€ Album / Playlist detail track row factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function makeAlbumTrackRow(track, idx, opts = {}) {
        const row = document.createElement('div');
        row.className = 'list-item album-track-row';
        row.dataset.trackKey = trackKey(track.title, track.artist);
        row.dataset.trackId = getStableTrackIdentity(track);
        row.dataset.metadataStatus = getTrackMetadataStatus(track);
        row.dataset.metadataQuality = getTrackMetadataQuality(track);
        if (opts.isLast) row.style.borderBottom = 'none';

        const click = document.createElement('button');
        click.className = 'item-clickable';
        click.type = 'button';
        click.addEventListener('click', () => {
            if (typeof opts.onActivate === 'function') opts.onActivate(idx);
        });
        if (typeof opts.onLongPress === 'function') bindLongPressAction(click, opts.onLongPress);

        const numEl = document.createElement('span');
        numEl.className = 'track-num';
        numEl.textContent = String(opts.numDisplay != null ? opts.numDisplay : idx + 1);

        const content = document.createElement('div');
        content.className = 'item-content';
        const titleEl = document.createElement('h3');
        titleEl.textContent = track.title;
        content.appendChild(titleEl);

        if (opts.showQuality) {
            const qualityLabel = getTrackMetadataQualityLabel(track);
            if (qualityLabel) {
                const qualityEl = document.createElement('span');
                qualityEl.className = `metadata-quality-pill is-${getTrackMetadataQuality(track)}`;
                qualityEl.textContent = qualityLabel;
                qualityEl.title = getTrackMetadataQualityDescription(track);
                content.appendChild(qualityEl);
            }
        }

        if (opts.showArtist && track.artist) {
            const artistNode = document.createElement('span');
            artistNode.style.cssText = 'font-size:12px; color:var(--text-secondary);';
            artistNode.textContent = track.artist;
            content.appendChild(artistNode);
        }

        const durationEl = document.createElement('span');
        durationEl.className = 'album-track-duration';
        durationEl.textContent = getTrackDurationDisplay(track);
        durationEl.dataset.originalDuration = durationEl.textContent;
        durationEl.dataset.metadataStatus = getTrackMetadataStatus(track);

        const stateBtn = createTrackStateButton(
            track,
            () => { if (typeof opts.onActivate === 'function') opts.onActivate(idx); },
            { compact: true }
        );
        stateBtn.classList.add('album-track-state-btn');

        click.appendChild(numEl);
        click.appendChild(content);
        click.appendChild(durationEl);
        click.appendChild(stateBtn);
        row.appendChild(click);

        registerTrackUi(trackKey(track.title, track.artist), {
            row, click, stateButton: stateBtn, durations: [durationEl]
        });
        return row;
    }

    function createCollectionRow(kind, item, metaContext = 'library') {
        const normalized = normalizeCollectionEntity(kind, item);
        kind = normalized.kind;
        item = normalized.item;
        const context = toEntityContext(metaContext);
        const row = document.createElement('div');
        row.className = 'list-item zenith-row';
        row.style.borderColor = 'var(--border-default)';

        const click = document.createElement('div');
        click.tabIndex = 0;
        click.setAttribute('role', 'button');
        click.className = 'item-clickable';

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (kind === 'artist') icon.style.borderRadius = '50%';
        applyArtBackground(icon, item.artUrl, getStableArtworkFallback(item.title || item.name || item.id, kind));

        const content = document.createElement('div');
        content.className = 'item-content';
        const h3 = document.createElement('h3');
        let metaLine = null;

        if (kind === 'album') {
            h3.appendChild(createTitleRail(item.title));
            row.dataset.albumKey = albumKey(item.title);
            row.dataset.sourceAlbumId = getAlbumSourceIdentity(item);
            setDelegatedAction(click, 'navToAlbum', { album: item.title, artist: item.artist, sourceAlbumId: getAlbumSourceIdentity(item) });
            click.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                routeToAlbum(item.title, item.artist, getAlbumSourceIdentity(item));
            });
            metaLine = createMetaLine(getAlbumMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('album', context));
        } else if (kind === 'playlist') {
            h3.appendChild(createTitleRail(item.title));
            row.dataset.playlistId = item.id;
            setDelegatedAction(click, 'routeToPlaylist', { playlistId: item.id });
            click.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                routeToPlaylist(item.id);
            });
            metaLine = createMetaLine(getPlaylistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('playlist', context));
        } else {
            h3.appendChild(createTitleRail(item.name));
            row.dataset.artistKey = toArtistKey(item.name);
            setDelegatedAction(click, 'routeToArtistProfile', { artist: item.name });
            click.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                routeToArtistProfile(item.name);
            });
            metaLine = createMetaLine(getArtistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('artist', context));
        }

        bindLongPressAction(click, () => openCollectionActionMenu(kind, item, context));
        content.appendChild(h3);
        if (metaLine) content.appendChild(metaLine);
        click.appendChild(icon);
        click.appendChild(content);
        row.appendChild(click);
        row.appendChild(createActionZone({
            playButton: null
        }));
        return row;
    }

    function createCollectionCard(kind, item, density = 'large', forGrid = false, metaContext = 'library') {
        const normalized = normalizeCollectionEntity(kind, item);
        kind = normalized.kind;
        item = normalized.item;
        const context = toEntityContext(metaContext);
        const card = document.createElement('div');
        card.className = kind === 'artist' ? 'media-card zenith-media-card artist-card' : 'media-card zenith-media-card';
        card.classList.add(density === 'compact' ? 'density-compact' : 'density-large');
        if (forGrid) {
            card.style.flex = '1 1 auto';
            card.style.width = '100%';
        }

        const cover = document.createElement('div');
        cover.className = 'media-cover';
        if (kind === 'artist') cover.style.borderRadius = '50%';
        applyArtBackground(cover, item.artUrl, getStableArtworkFallback(item.title || item.name || item.id, kind));
        if (!item.artUrl && (kind === 'album' || kind === 'playlist') && typeof lazyLoadArt === 'function') {
            lazyLoadArt(item, cover);
        }

        if (kind === 'album' || kind === 'playlist') {
            const playBtn = document.createElement('div');
            playBtn.className = 'catalog-play-btn';
            const collectionType = kind === 'album' ? 'album' : 'playlist';
            const collectionKey = kind === 'album'
                ? (typeof getAlbumIdentityKey === 'function' ? getAlbumIdentityKey(item, item.artist) : String(item.title || '').toLowerCase())
                : String(item.id || '').toLowerCase();
            playBtn.dataset.collectionType = collectionType;
            playBtn.dataset.collectionKey = collectionKey;
            const shouldPause = typeof isCollectionPlaying === 'function'
                ? isCollectionPlaying(collectionType, collectionKey)
                : (typeof isCollectionActive === 'function' && isCollectionActive(collectionType, collectionKey));
            playBtn.classList.toggle('is-playing', shouldPause);
            playBtn.setAttribute('aria-pressed', shouldPause ? 'true' : 'false');
            playBtn.innerHTML = getPlaybackIconSvg(shouldPause);
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (typeof isCollectionActive === 'function' && isCollectionActive(collectionType, collectionKey)) {
                    if (typeof togglePlayback === 'function') togglePlayback(e);
                    return;
                }
                if (kind === 'album') playAlbumInOrder(item.title, 0, item.artist);
                else playPlaylistInOrder(item.id, 0);
            };
            cover.appendChild(playBtn);
        }

        const footer = document.createElement('div');
        footer.className = 'zenith-card-footer';
        const textWrap = document.createElement('div');
        textWrap.className = 'zenith-card-text';
        const title = document.createElement('div');
        title.className = 'media-title';
        let sub = null;

        if (kind === 'album') {
            title.appendChild(createTitleRail(item.title, forGrid ? '' : 'force-marquee'));
            sub = createMetaLine(getAlbumMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('album', context));
            card.dataset.albumKey = albumKey(item.title);
            card.dataset.sourceAlbumId = getAlbumSourceIdentity(item);
            setDelegatedAction(card, 'navToAlbum', { album: item.title, artist: item.artist, sourceAlbumId: getAlbumSourceIdentity(item) });
        } else if (kind === 'playlist') {
            title.appendChild(createTitleRail(item.title));
            sub = createMetaLine(getPlaylistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('playlist', context));
            card.dataset.playlistId = item.id;
            setDelegatedAction(card, 'routeToPlaylist', { playlistId: item.id });
        } else {
            title.appendChild(createTitleRail(item.name));
            sub = createMetaLine(getArtistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('artist', context));
            card.dataset.artistKey = toArtistKey(item.name);
            setDelegatedAction(card, 'routeToArtistProfile', { artist: item.name });
        }
        if (sub) sub.classList.add('media-sub');

        bindLongPressAction(card, () => openCollectionActionMenu(kind, item, context));
        textWrap.appendChild(title);
        if (sub) textWrap.appendChild(sub);
        footer.appendChild(textWrap);
        footer.appendChild(createActionZone({
            playButton: null
        }));
        card.appendChild(cover);
        card.appendChild(footer);
        return card;
    }

    function createCollectionTile(kind, item, options = {}) {
        const density = options.density || 'large';
        const context = options.context || options.metaContext || 'library';
        return createCollectionCard(kind, item, density, Boolean(options.forGrid), context);
    }

    function createSongPreviewCard(track, density = 'large', asCarousel = false, metaContext = 'home') {
        const context = toEntityContext(metaContext);
        const card = document.createElement('div');
        card.className = `song-preview-card zenith-song-card ${density === 'compact' ? 'compact' : 'large'}${asCarousel ? ' carousel' : ''}`;
        card.dataset.trackKey = getTrackIdentityKey(track);
        card.dataset.trackId = getStableTrackIdentity(track);
        setDelegatedAction(card, 'playTrack', {
            title: track.title,
            artist: track.artist,
            album: track.albumTitle,
            trackId: getStableTrackIdentity(track)
        });
        bindLongPressAction(card, () => openTrackActionMenu(track, context));

        const art = document.createElement('div');
        art.className = 'art';
        applyArtBackground(art, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));

        const text = document.createElement('div');
        text.className = 'text';
        const h3 = document.createElement('h3');
        h3.appendChild(createTitleRail(track.title));
        const p = createMetaLine(
            getSongMetaParts(track, { hideAlbum: false, metaContext: context }),
            getEntitySubtextPrefs('song', context)
        );
        if (p) p.classList.add('zenith-song-meta');
        text.appendChild(h3);
        if (p) text.appendChild(p);

        card.appendChild(art);
        card.appendChild(text);
        card.appendChild(createActionZone({
            playButton: null,
            duration: getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track),
            heartButton: null
        }));
        return card;
    }

    function createCompactSongRailItem(track, metaContext = 'home') {
        const context = toEntityContext(metaContext);
        const item = document.createElement('div');
        item.className = 'zenith-song-rail-item';
        item.dataset.trackKey = getTrackIdentityKey(track);
        item.dataset.trackId = getStableTrackIdentity(track);
        setDelegatedAction(item, 'playTrack', {
            title: track.title,
            artist: track.artist,
            album: track.albumTitle,
            trackId: getStableTrackIdentity(track)
        });
        bindLongPressAction(item, () => openTrackActionMenu(track, context));

        const art = document.createElement('div');
        art.className = 'art';
        applyArtBackground(art, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));

        const text = document.createElement('div');
        text.className = 'text';
        const title = document.createElement('div');
        title.appendChild(createTitleRail(track.title));
        const meta = createMetaLine(
            getSongMetaParts(track, { hideAlbum: false, metaContext: context }),
            getEntitySubtextPrefs('song', context)
        );
        if (meta) meta.classList.add('zenith-song-meta');
        text.appendChild(title);
        if (meta) text.appendChild(meta);

        item.appendChild(art);
        item.appendChild(text);
        item.appendChild(createActionZone({
            playButton: null,
            duration: getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track),
            heartButton: null,
        }));

