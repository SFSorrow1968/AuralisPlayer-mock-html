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

    step('Checking annotated follow-up fixes.');
    await page.evaluate(() => window.AuralisApp.switchTab('home'));
    await page.waitForSelector('#home.active');
    await page.locator('.zenith-card-footer .zenith-meta-link', { hasText: 'EELS' }).first().click();
    await page.waitForSelector('#artist_profile.active');
    assert.equal(await page.locator('#art-name').innerText(), 'EELS', 'Artist links should open the artist that was tapped.');

    await page.evaluate(() => {
        window.AuralisApp.back();
        window.AuralisApp.switchTab('library');
    });
    await page.locator('#lib-btn-songs').click();
    await page.waitForSelector('#library-screen-songs.active');
    await page.locator('#lib-songs-list .zenith-row .zenith-meta-link', { hasText: "da' Skunk Junkies" }).first().click();
    await page.waitForSelector('#artist_profile.active');
    assert.equal(await page.locator('#art-name').innerText(), "da' Skunk Junkies", 'Song row artist metadata should be clickable.');

    await page.evaluate(() => {
        window.AuralisApp.back();
        window.AuralisApp.switchTab('library');
    });
    await page.locator('#search-input').fill('New Age');
    await page.waitForSelector('#search-clear-btn:not([hidden])');
    await page.locator('#search-clear-btn').click();
    assert.equal(await page.locator('#search-input').inputValue(), '', 'The search clear button should clear the query.');
    assert.equal(await page.locator('.mini-player .like-btn').count(), 0, 'Mini-player Like button should be removed.');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#library:not(.search-mode)');

    await page.locator('#lib-btn-albums').click();
    await page.waitForSelector('#library-screen-albums.active');
    await page.locator('#library-screen-albums .category-appearance-edit-btn').click();
    assert.equal(await page.locator('#library-screen-albums .settings-choice-group').count(), 4, 'Album grid appearance should expose view, size, columns, and sort groups.');
    await page.locator('#library-screen-albums .settings-choice[aria-label="albums carousel view"]').click();
    await page.waitForSelector('#lib-albums-grid.library-artist-carousel-groups .album-artist-carousel-row');
    assert.ok(await page.locator('#lib-albums-grid .album-artist-carousel-row').count() >= 2, 'Album carousel should group albums into artist rows.');
});
