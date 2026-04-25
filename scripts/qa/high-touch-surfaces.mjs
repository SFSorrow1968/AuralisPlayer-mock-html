import {
    assertNoVisualDefects,
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
    { dir: "da' Skunk Junkies/Mental Masturbation (1998)", genre: 'Underground Hip-Hop' },
    { dir: 'EELS/Electro-Shock Blues', genre: 'Alternative Rock' },
    { dir: 'Enya/Watermark', genre: 'New Age' },
    { dir: 'Minutemen/Double Nickels On The Dime', genre: 'Post-Punk' }
]);

await withQaSession('qa:high-touch', async ({ assert, page, step }) => {
    step('Installing real fixture music for the five highest-use surfaces.');
    await clearClientState(page);
    await seedPersistedState(page, fixture);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    step('1/5 Library category gateway stays clear.');
    await switchToRootScreen(page, 'library');
    await assertScreenHealthy(assert, page, '#library', 'Library gateway');
    const gatewayText = (await page.locator('#library-nav-container').textContent()) || '';
    ['Playlists', 'Albums', 'Artists', 'Songs', 'Genres', 'Folders'].forEach((label) => {
        assert.match(gatewayText, new RegExp(label), `Library gateway should show ${label}.`);
    });

    step('2/5 Library search returns useful rows and visible fallback icons.');
    await page.fill('#search-input', 'Double Nickels');
    await page.waitForFunction(() => {
        const results = document.getElementById('search-results');
        return Boolean(results && getComputedStyle(results).display !== 'none' && results.textContent.includes('Double Nickels'));
    });
    const searchFallbackState = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#search-results .list-item'));
        const folderRow = rows.find(row => row.dataset.type === 'folders' && row.textContent.includes('Minutemen / Double Nickels On The Dime'));
        const icon = folderRow?.querySelector('.item-icon');
        const svg = icon?.querySelector('svg');
        return {
            rowFound: Boolean(folderRow),
            hasFallbackClass: Boolean(icon?.classList.contains('item-icon-fallback')),
            hasSvg: Boolean(svg),
            svgBox: svg ? svg.getBoundingClientRect().toJSON() : null
        };
    });
    assert.equal(searchFallbackState.rowFound, true, 'Folder-style search result should be present.');
    assert.equal(searchFallbackState.hasFallbackClass, true, 'Folder result should use an explicit fallback icon class.');
    assert.equal(searchFallbackState.hasSvg, true, 'Fallback tile should contain a visible icon SVG.');
    assert.ok(searchFallbackState.svgBox?.width > 8 && searchFallbackState.svgBox?.height > 8, 'Fallback icon should be visible, not an empty color tile.');
    await assertNoVisualDefects(assert, page, '#library', 'Library search results');

    step('3/5 Albums view settings remain configurable.');
    await page.click('#search-clear-btn');
    await page.waitForFunction(() => document.getElementById('search-input')?.value === '');
    await page.evaluate(() => window.exitSearchMode?.());
    await page.waitForFunction(() => !document.getElementById('library')?.classList.contains('search-mode'));
    await page.locator('#lib-btn-albums').click();
    await page.waitForSelector('#library-screen-albums.active');
    await page.locator('#library-screen-albums .category-appearance-edit-btn').click();
    await page.waitForSelector('#library-screen-albums .settings-choice-toolbar');
    await page.locator('#library-screen-albums .settings-choice[aria-label="albums grid view"]').click();
    await page.locator('#library-screen-albums .settings-choice[aria-label="2 columns"]').click();
    const albumSettingsState = await page.locator('#library-screen-albums .settings-choice-toolbar').evaluate((toolbar) => ({
        columns: getComputedStyle(toolbar).gridTemplateColumns.split(' ').length,
        groups: Array.from(toolbar.querySelectorAll('.settings-choice-group')).map(group => group.querySelector('.settings-choice-label span')?.textContent?.trim() || ''),
        gridColumns: getComputedStyle(document.getElementById('lib-albums-grid')).gridTemplateColumns.split(' ').length
    }));
    assert.equal(albumSettingsState.columns, 2, 'Album appearance toolbar should be two columns.');
    assert.deepEqual(albumSettingsState.groups, ['View', 'Size', 'Columns', 'Sort'], 'Album grid settings should expose relevant groups.');
    assert.equal(albumSettingsState.gridColumns, 2, 'Album grid should honor two columns.');

    step('4/5 Home first impression shows real music above the fold.');
    await switchToRootScreen(page, 'home');
    await assertScreenHealthy(assert, page, '#home', 'Home');
    const homeText = (await page.locator('#home').textContent()) || '';
    assert.match(homeText, /Recent Activity/, 'Home should show Recent Activity.');
    assert.match(homeText, /Recently Added/, 'Home should show Recently Added.');
    await assertNoVisualDefects(assert, page, '#home', 'Home');

    step('5/5 Full player queue remains useful.');
    const album = fixture.albums.find(item => item.title === 'Double Nickels On The Dime') || fixture.albums[0];
    await page.evaluate(({ title, artist }) => {
        window.AuralisApp.playAlbumInOrder(title, 0, artist);
        window.AuralisApp.toggleOverlay('player');
    }, { title: album.title, artist: album.artist });
    await page.waitForSelector('#player.active');
    await page.waitForSelector('#player-inline-queue-list .queue-row');
    const queueState = await page.evaluate(() => ({
        nowPlaying: document.getElementById('player-title')?.textContent?.trim() || '',
        firstQueued: document.querySelector('#player-inline-queue-list .queue-row h3')?.textContent?.trim() || '',
        queuedRows: document.querySelectorAll('#player-inline-queue-list .queue-row').length,
        standaloneQueueScreen: Boolean(document.getElementById('queue')),
        queueNavItems: document.querySelectorAll('[data-tab="queue"]').length
    }));
    assert.ok(queueState.queuedRows > 0, 'Full player should show upcoming tracks.');
    assert.notEqual(queueState.firstQueued, queueState.nowPlaying, 'Inline queue should not duplicate the current track as first upcoming.');
    assert.equal(queueState.standaloneQueueScreen, false, 'Standalone Queue screen should stay removed.');
    assert.equal(queueState.queueNavItems, 0, 'Bottom nav should not expose a Queue tab.');
    await assertNoVisualDefects(assert, page, '#player', 'Full player queue');
});
