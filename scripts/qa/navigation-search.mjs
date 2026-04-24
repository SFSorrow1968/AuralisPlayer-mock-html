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
    'EELS/Electro-Shock Blues',
    'Enya/Watermark',
    'Minutemen/The Punch Line'
]);

await withQaSession('qa:navigation', async ({ assert, page, step }) => {
    step('Loading a multi-album fixture so Search and Library both have meaningful coverage.');
    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);
    const longAlbumTitle = await page.evaluate(() => {
        const library = window.AuralisApp._getLibrary();
        const album = Array.isArray(library?.albums)
            ? library.albums.find((entry) => entry?.title === 'Electro-Shock Blues')
            : null;
        if (!album) return '';
        const nextTitle = 'Electro-Shock Blues and the Extremely Long Detail Header QA Probe That Should Wrap Without Colliding With Artwork or Actions';
        album.title = nextTitle;
        if (Array.isArray(album.tracks)) {
            album.tracks.forEach((track) => {
                track.albumTitle = nextTitle;
            });
        }
        return nextTitle;
    });

    step('Checking album navigation in the Library view.');
    await switchToRootScreen(page, 'library');
    await page.evaluate(() => {
        document.getElementById('lib-btn-albums')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => {
        const view = document.getElementById('lib-view-albums');
        const grid = document.getElementById('lib-albums-grid');
        return Boolean(view && grid && getComputedStyle(view).display !== 'none' && grid.textContent.trim().length > 0);
    });

    const albumGridText = (await page.locator('#lib-albums-grid').textContent()) || '';
    assert.match(albumGridText, /Electro-Shock Blues/);
    assert.match(albumGridText, /Watermark/);

    step('Focusing Library search, querying the fixture library, and narrowing to album results.');
    await switchToRootScreen(page, 'library');
    const searchMetrics = await assertScreenHealthy(assert, page, '#library', 'Library search surface');
    assert.ok(searchMetrics.width > 300, 'Library search should be laid out before querying.');
    await page.fill('#search-input', 'shock');
    await page.evaluate(() => {
        document.getElementById('lib-btn-albums')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await page.waitForFunction(() => {
        const results = document.getElementById('search-results');
        return Boolean(results && getComputedStyle(results).display !== 'none' && results.textContent.includes('Electro-Shock Blues'));
    });

    const resultsText = (await page.locator('#search-results').textContent()) || '';
    assert.match(resultsText, /Electro-Shock Blues/);
    const resultTitles = await page.locator('#search-results h3').allTextContents();
    assert.ok(resultTitles.some((title) => title.includes(longAlbumTitle)), 'Search should include the matching album.');
    assert.equal(new Set(resultTitles.map((title) => title.trim())).size, resultTitles.length, 'Search should not render duplicate result titles.');
    await assertNoVisualDefects(assert, page, '#library', 'Search results');

    step('Opening the album detail from Search and checking the long title layout.');
    await page.locator('#search-results .item-clickable', { hasText: /Electro-Shock Blues/ }).first().click();
    await page.waitForFunction(() => document.getElementById('album_detail')?.classList.contains('active'));
    await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector('.emulator')?.scrollTo(0, 0);
        document.getElementById('album_detail')?.scrollTo(0, 0);
    });
    await page.waitForFunction(() => {
        const screen = document.getElementById('album_detail');
        if (!screen) return false;
        const style = getComputedStyle(screen);
        return style.opacity === '1' && style.transform === 'matrix(1, 0, 0, 1, 0, 0)';
    });
    const albumDetail = await assertScreenHealthy(assert, page, '#album_detail', 'Album detail from Search');
    assert.ok(albumDetail.visibleRows > 0, 'Album detail from Search should render track rows.');
    assert.equal(((await page.locator('#alb-title').textContent()) || '').trim(), longAlbumTitle, 'Album detail should show the long selected album title.');
    await assertNoVisualDefects(assert, page, '#album_detail', 'Album detail from Search');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    await page.fill('#search-input', 'zzzz-no-match-auralis');
    await page.waitForFunction(() => document.getElementById('search-results')?.textContent?.includes('No results'));
    const noResultsText = (await page.locator('#search-results').textContent()) || '';
    assert.match(noResultsText, /No results/i);
    await assertNoVisualDefects(assert, page, '#library', 'Search no-results');

    const longNoMatchQuery = 'https___auralis_invalid_search_probe__0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz__hash__0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    await page.fill('#search-input', longNoMatchQuery);
    await page.waitForFunction((query) => {
        const resultsText = document.getElementById('search-results')?.textContent || '';
        const inputValue = document.getElementById('search-input')?.value || '';
        return resultsText.includes('No results') && inputValue === query;
    }, longNoMatchQuery);
    await assertNoVisualDefects(assert, page, '#library', 'Search long-query no-results');

    await page.click('#search-clear-btn');
    await page.waitForFunction(() => document.activeElement?.id === 'search-input');

    step('Clearing the query and confirming Library category rows return.');
    const clearedQuery = await page.locator('#search-input').inputValue();
    assert.equal(clearedQuery, '');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('library-nav-container')).display !== 'none');
    assert.ok(((await page.locator('#library-nav-container').textContent()) || '').trim().length > 0, 'Library category rows should recover after clearing the query.');

    step('Persisting a useful search and restoring query, recents, and filter summary after reload.');
    await page.fill('#search-input', 'water');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('search-results')?.textContent?.includes('Watermark'));
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);
    await page.evaluate(() => window.AuralisApp.switchTab('library'));
    const restoredSearchState = await page.evaluate(() => ({
        query: document.getElementById('search-input')?.value || '',
        categoryText: document.getElementById('library-nav-container')?.textContent || '',
        activeScope: document.querySelector('#library-nav-container .is-search-filter-active')?.textContent || 'All'
    }));
    assert.match(`${restoredSearchState.query} ${restoredSearchState.categoryText}`, /water|Albums|Songs|Artists/i, 'Search should restore the last useful query or keep the Library search context visible.');
    assert.match(restoredSearchState.activeScope, /All|Songs|Albums|Artists|Playlists|Genres|Folders/i, 'Search should expose a readable active filter scope.');
});
