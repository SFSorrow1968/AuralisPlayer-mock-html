/*
 * Auralis JS shard: 08-zenith-components.js
 * Purpose: Zenith row/card factories and entity metadata render helpers
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    }

    function createPlayButton(onClick, label = 'Play') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zenith-play-btn';
        btn.setAttribute('aria-label', label);
        btn.innerHTML = getPlaybackIconSvg(false);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onClick === 'function') onClick();
        });
        return btn;
    }

    function createOptionButton(onClick, label = 'More options') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zenith-option-btn';
        btn.setAttribute('aria-label', label);
        btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onClick === 'function') onClick();
        });
        return btn;
    }

    function clearNodeChildren(root) {
        if (!root) return;
        clearTrackUiRegistryForRoot(root);
        root.replaceChildren();
    }

    function appendFragment(parent, children) {
        if (!parent || !Array.isArray(children) || !children.length) return;
        const frag = document.createDocumentFragment();
        children.forEach((child) => {
            if (child) frag.appendChild(child);
        });
        parent.appendChild(frag);
    }

    function createScreenEmptyState({ className = 'home-section-empty', title = '', body = '', iconName = '' } = {}) {
        const box = document.createElement('div');
        box.className = className;
        if (iconName) {
            const icon = document.createElement('div');
            icon.className = 'screen-empty-icon';
            icon.innerHTML = getIconSvg(iconName);
            box.appendChild(icon);
        }
        if (title) {
            const heading = document.createElement('strong');
            heading.className = 'screen-empty-title';
            heading.textContent = title;
            box.appendChild(heading);
        }
        if (body) {
            const copy = document.createElement('p');
            copy.className = 'screen-empty-copy';
            copy.textContent = body;
            box.appendChild(copy);
        }
        return box;
    }

    function resolvePlaylistLeadTrack(playlist) {
        if (!playlist) return null;
        const first = Array.isArray(playlist.tracks) ? playlist.tracks[0] : null;
        if (!first) return null;
        if (typeof first === 'string') {
            return LIBRARY_TRACKS.find((track) => track.title === first) || null;
        }
        if (first.title) {
            return resolveTrackMeta(first.title, first.artist || playlist.artist || ARTIST_NAME, first.albumTitle || playlist.title);
        }
        return null;
    }

    function resolveCollectionLeadTrack(kind, item) {
        if (!item) return null;
        if (kind === 'album') {
            const first = Array.isArray(item.tracks) ? item.tracks[0] : null;
            if (!first || !first.title) return null;
            return resolveTrackMeta(first.title, first.artist || item.artist || ARTIST_NAME, first.albumTitle || item.title);
        }
        if (kind === 'playlist') return resolvePlaylistLeadTrack(item);
        if (kind === 'artist') {
            const tracks = LIBRARY_TRACKS
                .filter((track) => String(track.artist || '').toLowerCase() === String(item.name || '').toLowerCase())
                .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
            return tracks[0] || null;
        }
        return null;
    }

    function normalizeCollectionEntity(kind, item) {
        if (kind === 'playlist' && item && !item.title && item.name) {
            item = { ...item, title: item.name };
        }
        if (kind !== 'playlist' || !item || item.sourceType !== 'album_proxy') {
            return { kind, item };
        }
        const resolvedAlbum = typeof resolveAlbumMeta === 'function'
            ? resolveAlbumMeta(item.sourceAlbumTitle || item.title, item.artist)
            : null;
        const albumItem = resolvedAlbum || {
            title: item.sourceAlbumTitle || item.title || 'Album',
            artist: item.sourceAlbumArtist || item.artist || ARTIST_NAME,
            artUrl: item.artUrl || '',
            tracks: Array.isArray(item.tracks) ? item.tracks.slice() : [],
            trackCount: Number(item.trackCount || item.tracks?.length || 0),
            year: item.year || '',
            genre: item.genre || ''
        };
        return { kind: 'album', item: albumItem };
    }

    function playCollectionLead(kind, item) {
        if (kind === 'album') {
            if (typeof playAlbumInOrder === 'function') {
                playAlbumInOrder(item.title, 0, item.artist);
                return;
            }
        } else if (kind === 'playlist') {
            if (typeof playPlaylistInOrder === 'function') {
                playPlaylistInOrder(item.id, 0);
                return;
            }
        }
        const track = resolveCollectionLeadTrack(kind, item);
        if (!track) {
            toast('No playable track found');
            return;
        }
        playTrack(track.title, track.artist, track.albumTitle, getStableTrackIdentity(track));
    }

    function queueTrackNext(track) {
        if (!track) return;
        const currentIdx = Math.max(0, getCurrentQueueIndex());
        queueTracks.splice(Math.min(currentIdx + 1, queueTracks.length), 0, track);
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(0, MAX_QUEUE_SIZE);
        renderQueue();
        toast(`"${track.title}" queued next`);
    }

    // ── Swipe-to-action on track rows ──────────────────────────────────
    function pickPlaylistForTrack(track) {
        if (!track) return;
        const playlists = LIBRARY_PLAYLISTS;
        if (!playlists.length) { toast('No playlists available'); return; }
        const actions = playlists.map(pl => ({
            label: pl.title,
            description: `${pl.tracks?.length || 0} tracks`,
            icon: 'playlist',
            onSelect: () => {
                if (!pl.tracks) pl.tracks = [];
                pl.tracks.push(track);
                toast(`Added "${track.title}" to ${pl.title}`);
            }
        }));
        presentActionSheet('Add to Playlist', track.title, actions);
    }

    function makeSwipeable(row, options = {}) {
        const { onSwipeLeft, onSwipeRight, leftLabel, rightLabel } = options;
        if (!onSwipeLeft && !onSwipeRight) return;

        row.classList.add('swipeable');
        row.style.overflow = 'hidden';

        // Wrap existing contents in a rigid container
        const inner = document.createElement('div');
        inner.className = 'swipe-inner';
        while (row.firstChild) {
            inner.appendChild(row.firstChild);
        }
        row.appendChild(inner);

        // Build action indicators behind content
        if (onSwipeRight) {
            const a = document.createElement('div');
            a.className = 'swipe-reveal swipe-reveal-right';
            a.textContent = rightLabel || 'Playlist';
            row.insertBefore(a, row.firstChild);
        }
        if (onSwipeLeft) {
            const a = document.createElement('div');
            a.className = 'swipe-reveal swipe-reveal-left';
            a.textContent = leftLabel || 'Remove';
            row.insertBefore(a, row.firstChild);
        }

        let startX = 0, startY = 0, deltaX = 0, tracking = false, locked = false;
        const THRESHOLD = 72;
        const MAX = 110;

        row.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            deltaX = 0;
            tracking = false;
            locked = false;
            // Remove transition so drag feels instant
            const inner = row.querySelector('.swipe-inner');
            if (inner) inner.style.transition = 'none';
        }, { passive: true });

        row.addEventListener('touchmove', (e) => {
            if (locked) return;
            const t = e.touches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;

            // First significant movement decides axis
            if (!tracking && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
                locked = true; return; // vertical scroll — bail
            }
            if (!tracking && Math.abs(dx) > 10) { tracking = true; row.classList.add('is-swiping'); }
            if (!tracking) return;

            // Restrict to allowed directions
            if (dx > 0 && !onSwipeRight) { locked = true; return; }
            if (dx < 0 && !onSwipeLeft) { locked = true; return; }

            e.preventDefault();
            deltaX = Math.max(-MAX, Math.min(MAX, dx));

            // Translate all non-reveal children
            for (let i = 0; i < row.children.length; i++) {
                const ch = row.children[i];
                if (!ch.classList.contains('swipe-reveal')) ch.style.transform = `translateX(${deltaX}px)`;
            }
            const rr = row.querySelector('.swipe-reveal-right');
            const rl = row.querySelector('.swipe-reveal-left');
            if (rr) rr.classList.toggle('ready', deltaX > THRESHOLD);
            if (rl) rl.classList.toggle('ready', deltaX < -THRESHOLD);
        }, { passive: false });

        const settle = () => {
            // Re-enable transitions
            const inner = row.querySelector('.swipe-inner');
            if (inner) {
                inner.style.transition = 'transform 0.22s ease';
                inner.style.transform = '';
            }
            const rr = row.querySelector('.swipe-reveal-right');
            const rl = row.querySelector('.swipe-reveal-left');
            if (rr) rr.classList.remove('ready');
            if (rl) rl.classList.remove('ready');

            if (deltaX > THRESHOLD && onSwipeRight) onSwipeRight();
            else if (deltaX < -THRESHOLD && onSwipeLeft) onSwipeLeft();
            tracking = false;
            deltaX = 0;
            row.classList.remove('is-swiping');
        };
        row.addEventListener('touchend', settle);
        row.addEventListener('touchcancel', settle);
    }

    function addTrackToQueue(track) {
        if (!track) return;
        if (queueTracks.length >= MAX_QUEUE_SIZE) {
            toast(`Queue limit reached (${MAX_QUEUE_SIZE} tracks)`);
            return;
        }
        queueTracks.push(track);
        renderQueue();
        toast(`Added "${track.title}" to queue`);
    }

    function openTrackActionMenu(track, context = 'library') {
        const ctx = toEntityContext(context);
        const kindLabel = getEntityKindLabel('song');
        presentActionSheet(track.title, `${track.artist} - ${track.albumTitle || 'Unknown Album'}`, [
            { label: 'Play Next', description: 'Insert right after the current song.', icon: 'next', onSelect: () => queueTrackNext(track) },
            { label: 'Add to Queue', description: 'Keep this track in the current run.', icon: 'queue', onSelect: () => addTrackToQueue(track) },
            {
                label: 'Open Album',
                description: track.albumTitle || 'Go to source album.',
                icon: 'album',
                onSelect: () => routeToAlbum(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track))
            },
            {
                label: `Customize ${kindLabel} Subtext`,
                description: `${getEntityContextLabel(ctx)} controls: fields, separator, and interactivity.`,
                icon: 'manage',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('song', ctx)
            }
        ]);
    }

    function openCollectionActionMenu(kind, item, context = 'library') {
        const normalized = normalizeCollectionEntity(kind, item);
        kind = normalized.kind;
        item = normalized.item;
        const ctx = toEntityContext(context);
        const isAlbum = kind === 'album';
        const isPlaylist = kind === 'playlist';
        const title = isAlbum ? item.title : isPlaylist ? item.title : item.name;
        const subtitle = isAlbum ? item.artist : isPlaylist ? item.subtitle : `${item.trackCount || 0} tracks`;
        const subtextKind = isAlbum ? 'album' : isPlaylist ? 'playlist' : 'artist';

        const actions = [
            {
                label: 'Play',
                description: 'Start playback from this collection.',
                icon: 'music',
                onSelect: () => playCollectionLead(kind, item)
            },
            {
                label: isAlbum ? 'Open Album' : isPlaylist ? 'Open Playlist' : 'Open Artist',
                description: 'Jump directly to this view.',
                icon: 'open',
                onSelect: () => {
                    if (isAlbum) routeToAlbum(item.title, item.artist, getAlbumSourceIdentity(item));
                    else if (isPlaylist) routeToPlaylist(item.id);
                    else routeToArtist(item.name);
                }
            },
            {
                label: `Customize ${getEntityKindLabel(subtextKind)} Subtext`,
                description: `${getEntityContextLabel(ctx)} controls: fields, separator, and interactivity.`,
                icon: 'manage',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu(subtextKind, ctx)
            }
        ];

        // Export M3U — available for user playlists only
        if (isPlaylist && typeof exportPlaylistAsM3U === 'function') {
            actions.push({
                label: 'Export as M3U',
                description: 'Download this playlist as a .m3u file.',
                icon: 'share',
                onSelect: () => exportPlaylistAsM3U(item)
            });
        }

        presentActionSheet(title, subtitle, actions);
    }

    function createActionZone({ playButton, stateButton, heartButton, duration, metadataStatus = '' }) {
        const zone = document.createElement('div');
        zone.className = 'zenith-action-zone';
        const transportButton = stateButton || playButton || null;
        if (duration) {
            const time = document.createElement('span');
            time.className = 'zenith-time-pill';
            time.textContent = duration;
            time.dataset.originalDuration = duration;
            if (metadataStatus) time.dataset.metadataStatus = metadataStatus;
            zone.appendChild(time);
        }
        if (transportButton) zone.appendChild(transportButton);
        if (heartButton) zone.appendChild(heartButton);
        if (!zone.childElementCount) zone.classList.add('is-empty');
        return zone;
    }

    function getSongMetaParts(track, options = {}) {
        const context = toEntityContext(options.metaContext || 'library');
        const prefs = getEntitySubtextPrefs('song', context);
        const fields = prefs.fields || {};
        const parts = [];
        const canonicalArtist = getCanonicalTrackArtistName(track);
        if (fields.artist && canonicalArtist) {
            parts.push({
                label: canonicalArtist,
                onClick: () => routeToArtist(canonicalArtist),
                onLongPress: () => {
                    if (typeof openArtistZenithMenu === 'function') openArtistZenithMenu(canonicalArtist);
                }
            });
        }
        if (!options.hideAlbum && fields.album && track.albumTitle) {
            parts.push({
                label: track.albumTitle,
                onClick: () => routeToAlbum(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track)),
                onLongPress: () => {
                    if (typeof openAlbumZenithMenu !== 'function' || typeof resolveAlbumMeta !== 'function') return;
                            const albumMeta = resolveAlbumMeta(track.albumTitle, track.artist);
                    if (albumMeta) openAlbumZenithMenu(albumMeta);
                }
            });
        }
        const genre = resolveTrackGenre(track);
        if (fields.genre && genre) {
            parts.push({
                label: genre,
                onClick: () => routeToGenre(genre)
            });
        }
        const qualityLabel = getTrackMetadataQualityLabel(track);
        if (qualityLabel) {
            const quality = getTrackMetadataQuality(track);
            parts.push({
                label: qualityLabel,
                className: `metadata-quality-pill is-${quality}`,
                title: getTrackMetadataQualityDescription(track),
                onClick: () => {
                    if (typeof openTrackMetadataEditor === 'function') openTrackMetadataEditor(track);
                }
            });
        }
        return parts;
    }

    function getAlbumMetaParts(album, options = {}) {
        const context = toEntityContext(options.metaContext || 'library');
        const prefs = getEntitySubtextPrefs('album', context);
        const fields = prefs.fields || {};
        const parts = [];
        const albumArtist = Array.isArray(album?.tracks) && album.tracks.length
            ? getCanonicalTrackArtistName(album.tracks[0], album.artist)
            : String(album?.artist || '').trim();
        if (fields.artist && albumArtist) {
            parts.push({
                label: albumArtist,
                onClick: () => routeToArtist(albumArtist),
                onLongPress: () => {
                    if (typeof openArtistZenithMenu === 'function') openArtistZenithMenu(albumArtist);
                }
            });
        }
        if (fields.year && album.year) parts.push({ label: String(album.year) });
        if (fields.tracks) parts.push({ label: `${Number(album.trackCount || album.tracks?.length || 0)} tracks` });
        const genre = resolveAlbumGenre(album);
        if (fields.genre && genre) {
            parts.push({
                label: genre,
                onClick: () => routeToGenre(genre)
            });
        }
        return parts;
    }

    function getPlaylistMetaParts(playlist, options = {}) {
        const context = toEntityContext(options.metaContext || 'library');
        const prefs = getEntitySubtextPrefs('playlist', context);
        const fields = prefs.fields || {};
        const parts = [];
        const trackCount = Number(playlist?.tracks?.length || 0);
        if (fields.subtitle && playlist?.subtitle) {
            parts.push({
                label: playlist.subtitle,
                onClick: () => routeToPlaylist(playlist.id)
            });
        }
        if (fields.tracks) {
            parts.push({
                label: `${trackCount} tracks`,
                onClick: () => routeToPlaylist(playlist.id)
            });
        }
        return parts;
    }

    function getArtistMetaParts(artist, options = {}) {
        const context = toEntityContext(options.metaContext || 'library');
        const prefs = getEntitySubtextPrefs('artist', context);
        const fields = prefs.fields || {};
        const parts = [];
        if (fields.albums) {
            parts.push({
                label: `${Number(artist?.albumCount || 0)} albums`,
                onClick: () => routeToArtist(artist?.name)
            });
        }
        if (fields.tracks) {
            parts.push({
                label: `${Number(artist?.trackCount || 0)} tracks`,
                onClick: () => routeToArtist(artist?.name)
            });
        }
        return parts;
    }

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

        const click = document.createElement('button');
        click.type = 'button';
        click.className = 'item-clickable';
        setDelegatedAction(click, 'playTrack', {
            title: track.title,
            artist: track.artist,
            album: track.albumTitle,
            trackId: getStableTrackIdentity(track)
        });
        bindLongPressAction(click, () => openTrackActionMenu(track, metaContext));

        let icon = null;
        if (includeArt) {
            icon = document.createElement('div');
            icon.className = 'item-icon';
            applyArtBackground(icon, track.artUrl, FALLBACK_GRADIENT);
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
            { ...getEntitySubtextPrefs('song', metaContext), interactive: false }
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

        // Swipe actions — right: add to playlist, left: remove (editable contexts only)
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
        if (options.reorderable) row.classList.add('queue-upnext-row');

        const click = document.createElement('button');
        click.type = 'button';
        click.className = 'item-clickable';
        click.addEventListener('click', (evt) => {
            evt.preventDefault();
            if (typeof options.onActivate === 'function') options.onActivate(evt);
        });
        if (typeof options.onLongPress === 'function') bindLongPressAction(click, options.onLongPress);

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        applyArtBackground(icon, track.artUrl, FALLBACK_GRADIENT);
        if (!track.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(track, icon);
        click.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'item-content';
        const h3 = document.createElement('h3');
        h3.appendChild(createTitleRail(track.title || 'Untitled Track'));
        content.appendChild(h3);
        click.appendChild(content);
        row.appendChild(click);
        row.appendChild(createActionZone({
            duration: options.showDuration === false ? '' : getTrackDurationDisplay(track),
            metadataStatus: getTrackMetadataStatus(track)
        }));

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

    function createCollectionRow(kind, item, metaContext = 'library') {
        const normalized = normalizeCollectionEntity(kind, item);
        kind = normalized.kind;
        item = normalized.item;
        const context = toEntityContext(metaContext);
        const row = document.createElement('div');
        row.className = 'list-item zenith-row';
        row.style.borderColor = 'var(--border-default)';

        const click = document.createElement('button');
        click.type = 'button';
        click.className = 'item-clickable';

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (kind === 'artist') icon.style.borderRadius = '50%';
        applyArtBackground(icon, item.artUrl, FALLBACK_GRADIENT);

        const content = document.createElement('div');
        content.className = 'item-content';
        const h3 = document.createElement('h3');
        let metaLine = null;

        if (kind === 'album') {
            h3.appendChild(createTitleRail(item.title));
            row.dataset.albumKey = albumKey(item.title);
            row.dataset.sourceAlbumId = getAlbumSourceIdentity(item);
            setDelegatedAction(click, 'navToAlbum', { album: item.title, artist: item.artist, sourceAlbumId: getAlbumSourceIdentity(item) });
            metaLine = createMetaLine(getAlbumMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('album', context));
        } else if (kind === 'playlist') {
            h3.appendChild(createTitleRail(item.title));
            row.dataset.playlistId = item.id;
            setDelegatedAction(click, 'routeToPlaylist', { playlistId: item.id });
            metaLine = createMetaLine(getPlaylistMetaParts(item, { metaContext: context }), getEntitySubtextPrefs('playlist', context));
        } else {
            h3.appendChild(createTitleRail(item.name));
            row.dataset.artistKey = toArtistKey(item.name);
            setDelegatedAction(click, 'routeToArtistProfile', { artist: item.name });
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
        applyArtBackground(cover, item.artUrl, FALLBACK_GRADIENT);
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
        applyArtBackground(art, track.artUrl, FALLBACK_GRADIENT);

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
        applyArtBackground(art, track.artUrl, FALLBACK_GRADIENT);

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

