/*
 * Auralis JS shard: 03c-playback-lyrics-playlists.js
 * Purpose: EQ UI, lyrics panel, user playlists, queue restore, audio engine binding
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function toggleEq() {
        eqEnabled = !eqEnabled;
        safeStorage.setItem(STORAGE_KEYS.eq, eqEnabled ? '1' : '0');
        if (eqEnabled) {
            const engine = ensureAudioEngine();
            if (engine && !audioContext) {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (audioContext.state === 'suspended') audioContext.resume();
                    sourceNode = audioContext.createMediaElementSource(engine);
                    gainNode = audioContext.createGain();
                    gainNode.gain.value = 1;
                } catch (_) { /* benign: cleanup */ }
            }
            ensureEqNodes();
        }
        rebuildAudioGraph();
        renderEqPanel();
        toast(eqEnabled ? 'Equalizer on' : 'Equalizer bypassed');
    }

    function setEqPreset(name) {
        const gains = EQ_PRESETS[name];
        if (!gains) return;
        eqBandGains = [...gains];
        applyEqValues();
        persistEq();
        document.querySelectorAll('#eq-presets .filter-chip').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.preset === name));
        const label = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        toast(`EQ: ${label}`);
    }

    function renderEqSliders() {
        const container = getEl('eq-bands');
        if (!container) return;
        container.querySelectorAll('.eq-band-slider').forEach((slider, i) => {
            if (parseFloat(slider.value) !== eqBandGains[i]) slider.value = String(eqBandGains[i] || 0);
            const valueEl = slider.closest('.eq-band')?.querySelector('.eq-band-value');
            if (valueEl) {
                const g = eqBandGains[i] || 0;
                valueEl.textContent = (g > 0 ? '+' : '') + g + 'dB';
            }
        });
    }

    function renderEqPanel() {
        const toggle = getEl('eq-toggle-btn');
        if (toggle) toggle.classList.toggle('active', eqEnabled);
        const container = getEl('eq-bands');
        if (!container) return;
        if (container.children.length > 0) { renderEqSliders(); return; }
        EQ_FREQUENCIES.forEach((freq, i) => {
            const band = document.createElement('div');
            band.className = 'eq-band';
            const g = eqBandGains[i] || 0;
            const valueEl = document.createElement('div');
            valueEl.className = 'eq-band-value';
            valueEl.textContent = (g > 0 ? '+' : '') + g + 'dB';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'eq-band-slider';
            slider.min = '-12'; slider.max = '12'; slider.step = '0.5';
            slider.value = String(g);
            slider.dataset.band = String(i);
            slider.addEventListener('input', e => setEqBand(i, parseFloat(e.target.value)));
            const label = document.createElement('div');
            label.className = 'eq-band-label';
            label.textContent = freq >= 1000 ? (freq / 1000) + 'k' : String(freq);
            band.appendChild(valueEl);
            band.appendChild(slider);
            band.appendChild(label);
            container.appendChild(band);
        });
    }

    function openEq() {
        const panel = getEl('eq-panel');
        if (!panel) return;
        panel.style.display = 'flex';
        renderEqPanel();
        const eqBtn = getEl('player-eq-btn');
        if (eqBtn) eqBtn.classList.add('eq-active');
        document.querySelectorAll('#eq-presets .filter-chip').forEach(btn => {
            const preset = EQ_PRESETS[btn.dataset.preset];
            btn.classList.toggle('active', !!preset && preset.every((v, i) => Math.abs(v - (eqBandGains[i] || 0)) < 0.1));
        });
    }

    function closeEq() {
        const panel = getEl('eq-panel');
        if (panel) panel.style.display = 'none';
        const eqBtn = getEl('player-eq-btn');
        if (eqBtn) eqBtn.classList.remove('eq-active');
    }

    // -- Gapless Playback -------------------------------------------
    function getNextQueueTrack() {
        if (!queueTracks.length || repeatMode === 'one') return null;
        const idx = getCurrentQueueIndex();
        if (idx < 0) return null;
        if (idx >= queueTracks.length - 1) return repeatMode === 'all' ? queueTracks[0] : null;
        return queueTracks[idx + 1];
    }

    function scheduleGaplessPreload(track) {
        if (!track || gaplessPreloading) return;
        const key = getTrackIdentityKey(track);
        if (blobUrlCache.has(key)) return;
        gaplessPreloading = true;
        resolvePlayableUrl(track).then(() => { gaplessPreloading = false; }).catch(() => { gaplessPreloading = false; });
    }

    function toggleGapless() {
        gaplessEnabled = !gaplessEnabled;
        safeStorage.setItem(STORAGE_KEYS.gapless, gaplessEnabled ? '1' : '0');
        const toggle = getEl('settings-gapless-toggle');
        if (toggle) {
            toggle.classList.toggle('active', gaplessEnabled);
            toggle.setAttribute('aria-checked', String(gaplessEnabled));
        }
        toast(gaplessEnabled ? 'Gapless playback enabled' : 'Gapless playback disabled');
    }

    // -- Crossfade ---------------------------------------------------
    function toggleCrossfade() {
        crossfadeEnabled = !crossfadeEnabled;
        safeStorage.setItem(STORAGE_KEYS.crossfade, crossfadeEnabled ? '1' : '0');
        toast(crossfadeEnabled ? 'Crossfade enabled' : 'Crossfade disabled');
    }

    // -- Lyrics Display ----------------------------------------------
    function isLyricsPanelVisible() {
        const panel = getEl('lyrics-panel');
        return Boolean(panel && panel.style.display !== 'none' && panel.style.display !== '');
    }

    function resolveLyricsTrack(track = nowPlaying) {
        const candidates = [];
        if (track) candidates.push(track);

        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0 && currentIdx < queueTracks.length) {
            const currentQueueTrack = queueTracks[currentIdx];
            if (currentQueueTrack && !candidates.some((candidate) => isSameTrack(candidate, currentQueueTrack))) {
                candidates.push(currentQueueTrack);
            }
        }

        let fallback = null;
        for (const candidate of candidates) {
            const hydrated = hydratePlaybackTrack(candidate);
            if (hydrated?.lyrics) return hydrated;
            if (candidate?.lyrics) return candidate;
            if (!fallback && hydrated) fallback = hydrated;
            if (!fallback && candidate) fallback = candidate;
        }

        return fallback;
    }

    function renderLyricsContent(track = nowPlaying) {
        const content = getEl('lyrics-content');
        if (!content) return;

        const lyricsTrack = resolveLyricsTrack(track);
        if (!lyricsTrack) {
            content.textContent = 'No track playing';
            return;
        }

        const lyrics = String(lyricsTrack.lyrics || '').trim();
        content.textContent = lyrics || 'No lyrics available for this track';
    }

    function syncLyricsPanel(track = nowPlaying) {
        if (!isLyricsPanelVisible()) return;
        renderLyricsContent(track);
    }

    function showLyrics() {
        const panel = getEl('lyrics-panel');
        if (!panel) return;
        renderLyricsContent(nowPlaying);
        panel.style.display = 'block';
    }

    function hideLyrics() {
        const panel = getEl('lyrics-panel');
        if (panel) panel.style.display = 'none';
    }

    function toggleLyrics() {
        if (isLyricsPanelVisible()) hideLyrics();
        else showLyrics();
    }

    // -- User Playlists CRUD -----------------------------------------
    function createUserPlaylist(name) {
        const id = 'upl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const pl = { id, name: String(name || 'New Playlist').trim(), tracks: [], created: Date.now() };
        userPlaylists.push(pl);
        persistUserPlaylists();
        toast(`Created playlist "${pl.name}"`);
        return pl;
    }

    function createPlaylistDetailTrackRow(playlist, track, idx, totalCount) {
        const row = document.createElement('div');
        row.className = 'list-item album-track-row';
        row.dataset.trackKey = trackKey(track.title, track.artist);
        row.dataset.metadataStatus = getTrackMetadataStatus(track);
        if (idx === Math.min(Number(totalCount) || 0, 200) - 1) row.style.borderBottom = 'none';

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
        return row;
    }

    function refreshUserPlaylistSurfaces(playlist) {
        setLibraryRenderDirty(true);
        renderLibraryViews({ force: true });
        if (!playlist || activePlaylistId !== playlist.id || !getEl('playlist_detail')?.classList.contains('active')) return;

        const titleEl = getEl('playlist-title');
        const subEl = getEl('playlist-subtitle');
        const list = getEl('playlist-track-list');
        const playlistTracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
        const totalSeconds = playlistTracks.reduce((sum, track) => sum + Number(track.durationSec || toDurationSeconds(track.duration) || 0), 0);
        if (titleEl) {
            titleEl.textContent = playlist.title || playlist.name || 'Playlist';
            titleEl.title = titleEl.textContent;
        }
        if (subEl) {
            const trackCount = playlistTracks.length;
            const durationLabel = totalSeconds > 0 ? ` - ${toDurationLabel(totalSeconds)}` : '';
            subEl.textContent = `${trackCount} ${trackCount === 1 ? 'song' : 'songs'}${durationLabel}`;
            subEl.title = subEl.textContent;
        }
        if (list) {
            clearNodeChildren(list);
            if (!playlistTracks.length) {
                list.appendChild(createScreenEmptyState({
                    title: 'This playlist is empty',
                    body: 'Add songs from Search, Library, or the Queue.',
                    iconName: 'playlist',
                    action: { label: 'Add Songs', action: 'openAddSongsToPlaylist' }
                }));
            } else {
                const tracks = playlistTracks.slice(0, 200);
                appendFragment(list, tracks.map((track, idx) => createPlaylistDetailTrackRow(playlist, track, idx, playlistTracks.length)));
            }
        }
        setPlayButtonState(isPlaying);
        ensureAccessibility();
    }

    function deleteUserPlaylist(id) {
        const idx = userPlaylists.findIndex(p => p.id === id);
        if (idx < 0) return;
        const removedPlaylist = cloneBackendValue(userPlaylists[idx]);
        const name = removedPlaylist.name || removedPlaylist.title || 'Playlist';
        userPlaylists.splice(idx, 1);
        persistUserPlaylists();
        refreshUserPlaylistSurfaces(null);
        presentUndoToast(`Deleted playlist "${name}"`, 'Undo', () => {
            if (userPlaylists.some((playlist) => playlist.id === removedPlaylist.id)) return;
            userPlaylists.splice(Math.min(idx, userPlaylists.length), 0, cloneBackendValue(removedPlaylist));
            persistUserPlaylists();
            refreshUserPlaylistSurfaces(playlistById.get(removedPlaylist.id));
        });
    }

    function renameUserPlaylist(id, newName) {
        const pl = userPlaylists.find(p => p.id === id);
        if (!pl) return;
        pl.name = String(newName || pl.name).trim();
        persistUserPlaylists();
        toast(`Renamed to "${pl.name}"`);
    }

    function addTrackToUserPlaylist(playlistId, track, options = {}) {
        const pl = userPlaylists.find(p => p.id === playlistId);
        if (!pl || !track) return;
        const playlistTrack = hydratePlaybackTrack(track);
        if (!playlistTrack) return;
        pl.tracks.push(playlistTrack);
        persistUserPlaylists();
        if (!options.silent) toast(`Added "${track.title}" to "${pl.name}"`);
    }

    function removeTrackFromUserPlaylist(playlistId, trackIndex) {
        const pl = userPlaylists.find(p => p.id === playlistId);
        if (!pl || trackIndex < 0 || trackIndex >= pl.tracks.length) return;
        const removed = pl.tracks.splice(trackIndex, 1)[0];
        persistUserPlaylists();
        refreshUserPlaylistSurfaces(pl);
        presentUndoToast(`Removed "${removed?.title || 'track'}" from "${pl.name}"`, 'Undo', () => {
            const target = userPlaylists.find((playlist) => playlist.id === playlistId);
            if (!target || !removed) return;
            target.tracks.splice(Math.min(trackIndex, target.tracks.length), 0, removed);
            persistUserPlaylists();
            refreshUserPlaylistSurfaces(target);
        });
    }

    // -- Smart / Dynamic Playlists -----------------------------------
    function generateSmartPlaylist(rule) {
        let tracks = [...LIBRARY_TRACKS];
        const r = String(rule || '').toLowerCase();
        if (r === 'most-played') {
            tracks = tracks.filter(t => getPlayCount(t) > 0).sort((a, b) => getPlayCount(b) - getPlayCount(a)).slice(0, 50);
        } else if (r === 'recently-played') {
            tracks = tracks.filter((track) => getTrackMapValue(lastPlayed, track))
                .sort((a, b) => (getTrackMapValue(lastPlayed, b) || 0) - (getTrackMapValue(lastPlayed, a) || 0))
                .slice(0, 50);
        } else if (r === 'liked') {
            tracks = tracks.filter((track) => hasTrackSetValue(likedTracks, track));
        } else if (r === 'top-rated') {
            tracks = tracks.filter((track) => Number(getTrackMapValue(trackRatings, track) || 0) >= 4)
                .sort((a, b) => (getTrackMapValue(trackRatings, b) || 0) - (getTrackMapValue(trackRatings, a) || 0));
        } else if (r === 'never-played') {
            tracks = tracks.filter((track) => !getTrackMapValue(playCounts, track));
        } else if (r === 'short') {
            tracks = tracks.filter(t => t.durationSec > 0 && t.durationSec <= 180);
        } else if (r === 'long') {
            tracks = tracks.filter(t => t.durationSec > 600);
        }
        return tracks;
    }

    // -- Queue Persistence -------------------------------------------
    function restoreQueue() {
        try {
            const raw = safeStorage.getItem(STORAGE_KEYS.queue);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!Array.isArray(data.tracks) || data.tracks.length === 0) return;
            queueTracks = data.tracks.map((track) => hydratePlaybackTrack(track)).filter(Boolean);
            if (!queueTracks.length) return;
            queueIndex = Math.max(0, Math.min(data.index || 0, queueTracks.length - 1));
            const track = queueTracks[queueIndex];
            if (track) setNowPlaying(track, false);
        } catch (_) { /* benign: cleanup */ }
    }

    // -- Audio Format Details ----------------------------------------
    function updateFormatDetails() {
        const engine = ensureAudioEngine();
        const badge = getEl('player-format-badge');
        const qualBadge = getEl('player-quality-badge');
        if (!engine || !nowPlaying) return;
        const ext = (nowPlaying.ext || '').toUpperCase();
        const isLossless = ext === 'FLAC' || ext === 'WAV' || ext === 'ALAC';
        if (badge) badge.textContent = ext || 'AUDIO';
        if (qualBadge) qualBadge.textContent = isLossless ? 'LOSSLESS' : 'LOSSY';
    }

    function bindAudioEngine() {
