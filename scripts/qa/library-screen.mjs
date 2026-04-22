import {
    assertScreenHealthy,
    buildFixtureSet,
    clearClientState,
    installRichLibrary,
    reloadApp,
    seedPersistedState,
    switchToRootScreen,
    withQaSession
} from './shared.mjs';

const fixture = await buildFixtureSet([
    "da' Skunk Junkies/Mental Masturbation (1998)",
    'EELS/Electro-Shock Blues',
    'Enya/Watermark',
    'Minutemen/3-Way Tie (For Last)',
    'Minutemen/Double Nickels On The Dime',
    'Minutemen/The Punch Line',
    'Minutemen/What Makes A Man Start Fires_'
]);

async function assertChipVisible(page, chipSelector, rowSelector, assert, label) {
    const metrics = await page.evaluate(({ chipSelector, rowSelector }) => {
        const chip = document.querySelector(chipSelector);
        const row = document.querySelector(rowSelector);
        if (!chip || !row) return null;
        const chipRect = chip.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        return {
            chipLeft: chipRect.left,
            chipRight: chipRect.right,
            rowLeft: rowRect.left,
            rowRight: rowRect.right
        };
    }, { chipSelector, rowSelector });

    assert.ok(metrics, `Missing chip metrics for ${label}.`);
    assert.ok(metrics.chipLeft >= metrics.rowLeft - 1, `${label} should not overflow the row on the left.`);
    assert.ok(metrics.chipRight <= metrics.rowRight + 1, `${label} should not overflow the row on the right.`);
}

async function assertLibraryTabState(page, assert, tab) {
    const state = await page.evaluate((name) => {
        const button = document.getElementById(`lib-btn-${name}`);
        const view = document.getElementById(`lib-view-${name}`);
        return {
            active: button?.classList.contains('active') || false,
            selected: button?.getAttribute('aria-selected') || '',
            display: view ? getComputedStyle(view).display : ''
        };
    }, tab);
    assert.equal(state.active, true, `${tab} tab should be active.`);
    assert.equal(state.selected, 'true', `${tab} tab should be aria-selected.`);
    assert.notEqual(state.display, 'none', `${tab} view should be visible.`);
}

await withQaSession('qa:library', async ({ assert, page, step }) => {
    step('Loading the seeded fixture library and opening the Library screen.');
    await clearClientState(page);
    await seedPersistedState(page, fixture);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);
    await switchToRootScreen(page, 'library');
    await page.waitForTimeout(200);

    const title = (await page.locator('#library .top-bar h1').textContent()) || '';
    assert.equal(title.trim(), 'Your Library');
    const libraryMetrics = await assertScreenHealthy(assert, page, '#library', 'Library screen');
    assert.ok(libraryMetrics.width > 300, 'Library should render within the emulator viewport.');

    step('Checking the playlist empty state uses guided actions instead of a dead-end message.');
    await assertLibraryTabState(page, assert, 'playlists');
    const playlistState = await page.evaluate(() => ({
        text: document.getElementById('lib-playlists-list')?.textContent || '',
        actions: Array.from(document.querySelectorAll('#lib-playlists-list .library-empty-action')).map((button) => button.textContent.trim())
    }));
    assert.match(playlistState.text, /No playlists yet/i);
    assert.deepEqual(playlistState.actions, ['Create Playlist', 'Import M3U']);
    await assertChipVisible(page, '#lib-btn-playlists', '#library > .filter-row', assert, 'Playlists tab');

    step('Creating and opening a playlist detail view.');
    const playlistName = await page.evaluate(() => {
        const library = window.AuralisApp._getLibrary();
        const playlist = window.AuralisApp.createUserPlaylist('QA Detail Mix');
        library.tracks.slice(0, 2).forEach((track) => window.AuralisApp.addTrackToUserPlaylist(playlist.id, track));
        window.AuralisApp._applyBackendPayload({ userState: window.AuralisApp._exportBackendPayload().userState });
        return playlist.name;
    });
    await page.waitForFunction((name) => document.getElementById('lib-playlists-list')?.textContent?.includes(name), playlistName);
    await page.locator('#lib-playlists-list .item-clickable', { hasText: playlistName }).click();
    await page.waitForFunction(() => document.getElementById('playlist_detail')?.classList.contains('active'));
    const playlistDetail = await assertScreenHealthy(assert, page, '#playlist_detail', 'Playlist detail');
    assert.ok(playlistDetail.visibleRows > 0, 'Playlist detail should render track rows.');
    assert.ok(((await page.locator('#playlist-track-list').textContent()) || '').trim().length > 0, 'Playlist detail track list should not be empty.');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Verifying album routing and tab visibility.');
    await page.locator('#lib-btn-albums').click();
    await page.waitForFunction(() => document.getElementById('lib-view-albums') && getComputedStyle(document.getElementById('lib-view-albums')).display !== 'none');
    await assertLibraryTabState(page, assert, 'albums');
    await assertChipVisible(page, '#lib-btn-albums', '#library > .filter-row', assert, 'Albums tab');
    const albumsText = (await page.locator('#lib-albums-grid').textContent()) || '';
    assert.match(albumsText, /Watermark/);
    await page.locator('#lib-albums-grid .media-card, #lib-albums-grid .zenith-media-card').first().click();
    await page.waitForFunction(() => document.getElementById('album_detail')?.classList.contains('active'));
    const albumDetail = await assertScreenHealthy(assert, page, '#album_detail', 'Album detail');
    assert.ok(albumDetail.visibleRows > 0, 'Album detail should render track rows.');
    assert.ok(((await page.locator('#album-track-list').textContent()) || '').trim().length > 0, 'Album track list should not be empty.');
    assert.ok(((await page.locator('#alb-title').textContent()) || '').trim().length > 0, 'Album detail should show the selected album.');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Verifying artist routing and counts.');
    await page.locator('#lib-btn-artists').click();
    await page.waitForFunction(() => document.getElementById('lib-view-artists') && getComputedStyle(document.getElementById('lib-view-artists')).display !== 'none');
    await assertLibraryTabState(page, assert, 'artists');
    await assertChipVisible(page, '#lib-btn-artists', '#library > .filter-row', assert, 'Artists tab');
    await page.locator('#lib-artists-list .item-clickable').first().click();
    await page.waitForFunction(() => document.getElementById('artist_profile')?.classList.contains('active'));
    const artistDetail = await assertScreenHealthy(assert, page, '#artist_profile', 'Artist profile');
    assert.ok(artistDetail.visibleRows > 0, 'Artist profile should render section rows or cards.');
    const artistMeta = (await page.locator('#art-meta').textContent()) || '';
    assert.match(artistMeta, /album/);
    assert.match(artistMeta, /track/);
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Checking songs sort controls stay active and visible across tab changes.');
    await page.locator('#lib-btn-songs').click();
    await page.waitForFunction(() => document.getElementById('lib-view-songs') && getComputedStyle(document.getElementById('lib-view-songs')).display !== 'none');
    await assertLibraryTabState(page, assert, 'songs');
    await assertChipVisible(page, '#lib-btn-songs', '#library > .filter-row', assert, 'Songs tab');
    await page.locator('#lib-songs-sort-row [data-sort=\"added\"]').click();
    await assertChipVisible(page, '#lib-songs-sort-row [data-sort=\"added\"]', '#lib-songs-sort-row', assert, 'Recently Added sort chip');
    const addedSortActive = await page.locator('#lib-songs-sort-row [data-sort="added"]').evaluate((node) => node.classList.contains('active'));
    assert.equal(addedSortActive, true);
    await page.locator('#lib-btn-albums').click();
    await page.locator('#lib-btn-songs').click();
    const persistedSortActive = await page.locator('#lib-songs-sort-row [data-sort="added"]').evaluate((node) => node.classList.contains('active'));
    assert.equal(persistedSortActive, true, 'The selected songs sort should survive tab switches.');

    step('Treating genre-less libraries as an empty tagged state, not an Unknown bucket.');
    await page.locator('#lib-btn-genres').click();
    await page.waitForFunction(() => document.getElementById('lib-view-genres') && getComputedStyle(document.getElementById('lib-view-genres')).display !== 'none');
    await assertLibraryTabState(page, assert, 'genres');
    await assertChipVisible(page, '#lib-btn-genres', '#library > .filter-row', assert, 'Genres tab');
    const genresText = (await page.locator('#lib-view-genres').textContent()) || '';
    assert.match(genresText, /Add genre tags to tracks/i);
    assert.doesNotMatch(genresText, /^Unknown/i);

    step('Checking folder grouping and album routing from the folder browser.');
    await page.locator('#lib-btn-folders').click();
    await page.waitForFunction(() => document.getElementById('lib-view-folders') && getComputedStyle(document.getElementById('lib-view-folders')).display !== 'none');
    await assertLibraryTabState(page, assert, 'folders');
    await assertChipVisible(page, '#lib-btn-folders', '#library > .filter-row', assert, 'Folders tab');
    const folderLabels = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#lib-folders-tree > div:nth-child(odd) span'))
            .map((el) => el.textContent.trim())
            .filter(Boolean)
    );
    assert.ok(folderLabels.includes("da' Skunk Junkies"), 'Folder browser should group albums by their parent folder.');
    assert.ok(folderLabels.includes('Minutemen'), 'Folder browser should expose more than a single Root bucket.');
    await page.locator('#lib-folders-tree > div').first().click();
    await page.waitForFunction(() => document.querySelectorAll('#lib-folders-tree [data-action=\"routeToAlbum\"]').length > 0);
    await page.locator('#lib-folders-tree [data-action="routeToAlbum"]').first().click();
    await page.waitForFunction(() => document.getElementById('album_detail')?.classList.contains('active'));
    assert.ok(((await page.locator('#alb-title').textContent()) || '').trim().length > 0, 'Folder browser albums should route to album detail.');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Returning to Playlists should bring the leading tab back into view.');
    await page.locator('#lib-btn-playlists').click();
    await assertChipVisible(page, '#lib-btn-playlists', '#library > .filter-row', assert, 'Playlists tab after returning from later tabs');
});
