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
        viewedArtistName = activeArtistName;
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
