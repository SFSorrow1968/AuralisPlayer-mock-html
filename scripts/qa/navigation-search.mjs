import {
    buildFixtureSet,
    clearClientState,
    installRichLibrary,
    reloadApp,
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
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    step('Checking album navigation in the Library view.');
    await switchToRootScreen(page, 'library');
    await page.click('#lib-btn-albums');
    await page.waitForSelector('#lib-albums-grid .cat-card');

    const albumGridText = (await page.locator('#lib-albums-grid').textContent()) || '';
    assert.match(albumGridText, /Electro-Shock Blues/);
    assert.match(albumGridText, /Watermark/);

    step('Switching to Search, querying the fixture library, and narrowing to album results.');
    await switchToRootScreen(page, 'search');
    await page.fill('#search-input', 'shock');
    await page.click('#search-filter-row [data-filter="albums"]');

    await page.waitForFunction(() => {
        const results = document.getElementById('search-results');
        return Boolean(results && getComputedStyle(results).display !== 'none' && results.textContent.includes('Electro-Shock Blues'));
    });

    const resultsText = (await page.locator('#search-results').textContent()) || '';
    assert.match(resultsText, /Electro-Shock Blues/);

    step('Clearing the query and confirming the browse grid returns.');
    await page.fill('#search-input', '');
    await page.waitForFunction(() => {
        const results = document.getElementById('search-results');
        const browse = document.getElementById('search-browse');
        return Boolean(
            results
            && browse
            && getComputedStyle(results).display === 'none'
            && getComputedStyle(browse).display !== 'none'
        );
    });
});
