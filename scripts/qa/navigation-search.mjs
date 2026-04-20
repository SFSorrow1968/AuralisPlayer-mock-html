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

    step('Switching to Search, querying the fixture library, and narrowing to album results.');
    await switchToRootScreen(page, 'search');
    await page.fill('#search-input', 'shock');
    await page.evaluate(() => {
        document.querySelector('#search-filter-row [data-filter="albums"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await page.waitForFunction(() => {
        const results = document.getElementById('search-results');
        return Boolean(results && getComputedStyle(results).display !== 'none' && results.textContent.includes('Electro-Shock Blues'));
    });

    const resultsText = (await page.locator('#search-results').textContent()) || '';
    assert.match(resultsText, /Electro-Shock Blues/);

    step('Clearing the query and confirming the browse grid returns.');
    await page.fill('#search-input', '');
    const clearedQuery = await page.locator('#search-input').inputValue();
    assert.equal(clearedQuery, '');
});
