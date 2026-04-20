import {
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

    step('Checking the playlist empty state uses guided actions instead of a dead-end message.');
    const playlistState = await page.evaluate(() => ({
        text: document.getElementById('lib-playlists-list')?.textContent || '',
        actions: Array.from(document.querySelectorAll('#lib-playlists-list .library-empty-action')).map((button) => button.textContent.trim())
    }));
    assert.match(playlistState.text, /No playlists yet/i);
    assert.deepEqual(playlistState.actions, ['Create Playlist', 'Import M3U']);
    await assertChipVisible(page, '#lib-btn-playlists', '#library > .filter-row', assert, 'Playlists tab');

    step('Verifying album routing and tab visibility.');
    await page.locator('#lib-btn-albums').click();
    await page.waitForFunction(() => document.getElementById('lib-view-albums') && getComputedStyle(document.getElementById('lib-view-albums')).display !== 'none');
    await assertChipVisible(page, '#lib-btn-albums', '#library > .filter-row', assert, 'Albums tab');
    const albumsText = (await page.locator('#lib-albums-grid').textContent()) || '';
    assert.match(albumsText, /Watermark/);
    await page.locator('#lib-albums-grid .media-card, #lib-albums-grid .zenith-media-card').first().click();
    await page.waitForFunction(() => document.getElementById('album_detail')?.classList.contains('active'));
    assert.ok(((await page.locator('#alb-title').textContent()) || '').trim().length > 0, 'Album detail should show the selected album.');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Verifying artist routing and counts.');
    await page.locator('#lib-btn-artists').click();
    await page.waitForFunction(() => document.getElementById('lib-view-artists') && getComputedStyle(document.getElementById('lib-view-artists')).display !== 'none');
    await assertChipVisible(page, '#lib-btn-artists', '#library > .filter-row', assert, 'Artists tab');
    await page.locator('#lib-artists-list .item-clickable').first().click();
    await page.waitForFunction(() => document.getElementById('artist_profile')?.classList.contains('active'));
    const artistMeta = (await page.locator('#art-meta').textContent()) || '';
    assert.match(artistMeta, /album/);
    assert.match(artistMeta, /track/);
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Checking songs sort controls stay active and visible across tab changes.');
    await page.locator('#lib-btn-songs').click();
    await page.waitForFunction(() => document.getElementById('lib-view-songs') && getComputedStyle(document.getElementById('lib-view-songs')).display !== 'none');
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
    await assertChipVisible(page, '#lib-btn-genres', '#library > .filter-row', assert, 'Genres tab');
    const genresText = (await page.locator('#lib-view-genres').textContent()) || '';
    assert.match(genresText, /Add genre tags to tracks/i);
    assert.doesNotMatch(genresText, /^Unknown/i);

    step('Checking folder grouping and album routing from the folder browser.');
    await page.locator('#lib-btn-folders').click();
    await page.waitForFunction(() => document.getElementById('lib-view-folders') && getComputedStyle(document.getElementById('lib-view-folders')).display !== 'none');
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
