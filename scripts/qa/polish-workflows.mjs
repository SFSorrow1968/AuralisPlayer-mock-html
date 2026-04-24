import {
    buildFixtureSet,
    clearClientState,
    installRichLibrary,
    reloadApp,
    seedPersistedState,
    withQaSession
} from './shared.mjs';

const fixture = await buildFixtureSet([
    { dir: "da' Skunk Junkies/Mental Masturbation (1998)", genre: 'Underground Hip-Hop' },
    { dir: 'EELS/Electro-Shock Blues', genre: 'Alternative Rock' },
    { dir: 'Enya/Watermark', genre: 'New Age' },
    { dir: 'Minutemen/The Punch Line', genre: 'Hardcore Punk' }
]);

await withQaSession('qa:polish-workflows', async ({ assert, page, step }) => {
    step('Installing a fixture library and creating an empty playlist.');
    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    const playlistId = await page.evaluate(() => {
        const playlist = window.AuralisApp.createUserPlaylist('QA Batch Add');
        window.AuralisApp.routeToPlaylistDetail(playlist.id);
        return playlist.id;
    });

    step('Selecting multiple media items for a playlist without closing the picker.');
    await page.waitForSelector('#playlist_detail.active');
    await page.locator('#playlist-track-list [data-action="openAddSongsToPlaylist"]').click();
    await page.waitForSelector('#add-songs-scrim.show');
    await page.locator('[data-picker-type="songs"]').click();
    await page.locator('#add-songs-list [data-picker-track-key]').nth(0).click();
    await page.locator('#add-songs-list [data-picker-track-key]').nth(1).click();

    assert.equal(await page.locator('#add-songs-scrim.show').count(), 1, 'The picker should remain open while selecting several tracks.');
    assert.match(await page.locator('#add-songs-selected-summary').innerText(), /2 selected/);

    await page.locator('#add-songs-add-selected').click();
    const playlistCount = await page.evaluate((id) => {
        const playlist = window.AuralisApp._getLibrary().playlists.find((entry) => entry.id === id);
        return playlist?.tracks?.length || 0;
    }, playlistId);
    assert.equal(playlistCount, 2, 'Add Selected should add all selected tracks at once.');
    assert.equal(await page.locator('#add-songs-scrim.show').count(), 1, 'The picker should stay open after adding a batch.');

    step('Checking search workspace behavior and mini-player persistence.');
    await page.locator('[data-action="closeAddSongsToPlaylist"]').click();
    await page.evaluate(() => window.AuralisApp.switchTab('library'));
    await page.locator('#search-input').fill('Watermark');
    await page.waitForSelector('#library.search-mode');
    assert.equal(await page.locator('[data-search-section="quickFilters"]').count(), 0, 'Quick Filters should not render in the search workspace.');
    await page.locator('#library-edit-toggle-btn').click();
    assert.equal(await page.locator('#library.search-mode').count(), 1, 'Editing search sections should not cancel search mode.');
    assert.ok(await page.locator('[data-search-section="history"]').count() >= 1, 'Search edit mode should expose configurable sections.');
    await page.locator('.mini-player').click();
    assert.equal(await page.locator('#library.search-mode').count(), 1, 'Mini-player interaction should not cancel search mode.');
    await page.evaluate(() => document.getElementById('player')?.classList.remove('active'));

    step('Checking fixture songs do not show false partial-tag warnings.');
    await page.evaluate(() => {
        window.AuralisApp.switchTab('home');
        window.AuralisApp.switchTab('library');
    });
    await page.locator('#lib-btn-songs').click();
    await page.waitForSelector('#library-screen-songs.active');
    assert.equal(await page.locator('#lib-songs-list .metadata-quality-pill.is-partial').count(), 0, 'Trusted fixture songs should not show Partial tags.');

    step('Checking player utility labels are readable.');
    await page.evaluate(() => window.AuralisApp.setPlaybackSpeed(1.25));
    assert.equal(await page.locator('#player-speed-label').innerText(), '1.25x');
});
