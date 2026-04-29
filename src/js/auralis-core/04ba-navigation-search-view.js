/*
 * Auralis JS shard: 04ba-navigation-search-view.js
 * Purpose: search result view modes and card rendering
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function normalizeSearchViewMode(mode) {
        return ['list', 'grid', 'carousel'].includes(mode) ? mode : 'list';
    }

    function syncSearchViewModeControls() {
        searchViewMode = normalizeSearchViewMode(searchViewMode);
        const row = getEl('search-view-row');
        if (!row) return;
        row.querySelectorAll('[data-search-view]').forEach((chip) => {
            const isActive = chip.dataset.searchView === searchViewMode;
            chip.classList.toggle('active', isActive);
            chip.setAttribute('aria-selected', String(isActive));
            chip.setAttribute('tabindex', isActive ? '0' : '-1');
        });
    }

    function setSearchViewMode(mode) {
        searchViewMode = normalizeSearchViewMode(mode);
        setUiPreference('searchViewMode', searchViewMode);
        syncSearchViewModeControls();
        renderSearchState();
    }

    function buildSearchCard(item) {
        if (item?.type === 'songs' && typeof createSongPreviewCard === 'function') {
            const track = resolveTrackMeta(item.title, item.artist, item.albumTitle);
            const card = createSongPreviewCard(track, 'compact', searchViewMode === 'carousel', 'search');
            card.dataset.type = 'songs';
            return card;
        }

        if (item?.type === 'albums' && typeof createCollectionTile === 'function') {
            const albumItem = resolveAlbumMeta(item.albumTitle || item.title, item.artist) || {
                title: item.title,
                artist: item.artist || ARTIST_NAME,
                year: item.year || '',
                trackCount: Number(item.trackCount || 0),
                genre: item.genre || '',
                artUrl: item.artUrl || '',
                tracks: Array.isArray(item.tracks) ? item.tracks.slice() : []
            };
            const card = createCollectionTile('album', albumItem, { density: 'compact', forGrid: true, context: 'search' });
            card.dataset.type = 'albums';
            return card;
        }

        if (item?.type === 'artists' && typeof createCollectionTile === 'function') {
            const key = toArtistKey(item.name || item.artist || item.title);
            const artistItem = artistByKey.get(key) || LIBRARY_ARTISTS.find((artist) => toArtistKey(artist.name) === key) || {
                name: item.name || item.artist || item.title || ARTIST_NAME,
                artUrl: item.artUrl || '',
                albumCount: Number(item.albumCount || 0),
                trackCount: Number(item.trackCount || 0),
                plays: Number(item.plays || 0)
            };
            const card = createCollectionTile('artist', artistItem, { density: 'compact', forGrid: true, context: 'search' });
            card.dataset.type = 'artists';
            return card;
        }

        return buildSearchRow(item);
    }
