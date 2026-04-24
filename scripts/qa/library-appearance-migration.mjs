import {
    clearClientState,
    installRichLibrary,
    reloadApp,
    seedPersistedState,
    switchToRootScreen,
    withQaSession
} from './shared.mjs';

const LEGACY_LIBRARY_APPEARANCE = {
    version: 1,
    libraryAppearance: {
        playlists: { mode: 'compact' },
        albums: { mode: 'compact' },
        artists: { mode: 'twoRow' }
    }
};

const albums = [
    {
        id: 'album-eels-electro-shock-blues',
        title: 'Electro-Shock Blues',
        artist: 'EELS',
        albumArtist: 'EELS',
        year: 1998,
        genre: 'Alternative',
        trackCount: 1,
        totalDurationLabel: '3:14',
        _sourceAlbumId: 'album-eels-electro-shock-blues',
        _sourceAlbumTitle: 'Electro-Shock Blues',
        tracks: [{
            no: 1,
            title: 'Elizabeth on the Bathroom Floor',
            artist: 'EELS',
            albumTitle: 'Electro-Shock Blues',
            albumArtist: 'EELS',
            year: 1998,
            genre: 'Alternative',
            duration: '3:14',
            durationSec: 194,
            ext: 'flac',
            discNo: 1,
            path: 'Music/EELS/Electro-Shock Blues/01 Elizabeth on the Bathroom Floor.flac',
            _trackId: 'track-eels-elizabeth-on-the-bathroom-floor',
            _sourceAlbumId: 'album-eels-electro-shock-blues',
            _sourceAlbumTitle: 'Electro-Shock Blues',
            _scanned: true,
            _metaDone: true
        }]
    },
    {
        id: 'album-enya-watermark',
        title: 'Watermark',
        artist: 'Enya',
        albumArtist: 'Enya',
        year: 1988,
        genre: 'New Age',
        trackCount: 1,
        totalDurationLabel: '2:25',
        _sourceAlbumId: 'album-enya-watermark',
        _sourceAlbumTitle: 'Watermark',
        tracks: [{
            no: 1,
            title: 'Watermark',
            artist: 'Enya',
            albumTitle: 'Watermark',
            albumArtist: 'Enya',
            year: 1988,
            genre: 'New Age',
            duration: '2:25',
            durationSec: 145,
            ext: 'flac',
            discNo: 1,
            path: 'Music/Enya/Watermark/01 Watermark.flac',
            _trackId: 'track-enya-watermark',
            _sourceAlbumId: 'album-enya-watermark',
            _sourceAlbumTitle: 'Watermark',
            _scanned: true,
            _metaDone: true
        }]
    },
    {
        id: 'album-minutemen-punch-line',
        title: 'The Punch Line',
        artist: 'Minutemen',
        albumArtist: 'Minutemen',
        year: 1981,
        genre: 'Punk',
        trackCount: 1,
        totalDurationLabel: '1:32',
        _sourceAlbumId: 'album-minutemen-punch-line',
        _sourceAlbumTitle: 'The Punch Line',
        tracks: [{
            no: 1,
            title: 'Search',
            artist: 'Minutemen',
            albumTitle: 'The Punch Line',
            albumArtist: 'Minutemen',
            year: 1981,
            genre: 'Punk',
            duration: '1:32',
            durationSec: 92,
            ext: 'flac',
            discNo: 1,
            path: 'Music/Minutemen/The Punch Line/01 Search.flac',
            _trackId: 'track-minutemen-search',
            _sourceAlbumId: 'album-minutemen-punch-line',
            _sourceAlbumTitle: 'The Punch Line',
            _scanned: true,
            _metaDone: true
        }]
    }
];

await withQaSession('qa:library-appearance', async ({ assert, page, step }) => {
    step('Booting with legacy library appearance preferences from before the follow-up cleanup.');
    await clearClientState(page);
    await seedPersistedState(page, {
        localStorageEntries: {
            auralis_ui_preferences_v1: LEGACY_LIBRARY_APPEARANCE
        }
    });
    await reloadApp(page);
    await installRichLibrary(page, albums);
    await switchToRootScreen(page, 'library');
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Checking old compact and two-row modes remap to the supported layouts.');
    const appearanceState = await page.evaluate(() => ({
        playlists: {
            appearance: document.getElementById('lib-playlists-list')?.dataset.appearance || '',
            className: document.getElementById('lib-playlists-list')?.className || ''
        },
        albums: {
            appearance: document.getElementById('lib-albums-grid')?.dataset.appearance || '',
            className: document.getElementById('lib-albums-grid')?.className || ''
        },
        artists: {
            appearance: document.getElementById('lib-artists-list')?.dataset.appearance || '',
            className: document.getElementById('lib-artists-list')?.className || ''
        }
    }));
    assert.equal(appearanceState.playlists.appearance, 'grid', 'Legacy playlist compact mode should fall forward to grid.');
    assert.match(appearanceState.playlists.className, /library-view-grid/, 'Playlists should render with the grid class after migration.');
    assert.equal(appearanceState.albums.appearance, 'carousel', 'Legacy album compact mode should fall forward to carousel.');
    assert.match(appearanceState.albums.className, /library-view-carousel/, 'Albums should render with the carousel class after migration.');
    assert.equal(appearanceState.artists.appearance, 'grid', 'Legacy artist two-row mode should fall forward to grid.');
    assert.match(appearanceState.artists.className, /library-view-grid/, 'Artists should render with the grid class after migration.');

    step('Opening album appearance editing to confirm only the supported controls remain.');
    await page.locator('#lib-btn-albums').click();
    await page.waitForFunction(() => document.getElementById('library-screen-albums')?.classList.contains('active'));
    await page.locator('#library-screen-albums .category-appearance-edit-btn').click();
    const toolbarState = await page.evaluate(() => {
        const toolbar = document.querySelector('#library-screen-albums .library-appearance-toolbar');
        const buttons = toolbar ? Array.from(toolbar.querySelectorAll('button')).map((button) => ({
            label: button.getAttribute('aria-label') || '',
            active: button.classList.contains('active')
        })) : [];
        return {
            count: buttons.length,
            labels: buttons.map((button) => button.label),
            activeLabels: buttons.filter((button) => button.active).map((button) => button.label)
        };
    });
    assert.equal(toolbarState.count, 3, 'Album appearance editing should only show the supported three modes.');
    assert.deepEqual(toolbarState.labels, [
        'albums list view',
        'albums grid view',
        'albums carousel view'
    ]);
    assert.deepEqual(toolbarState.activeLabels, ['albums carousel view'], 'The migrated album mode should remain selected in the toolbar.');
});
