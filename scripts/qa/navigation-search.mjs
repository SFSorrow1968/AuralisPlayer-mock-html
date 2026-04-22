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
    const searchMetrics = await assertScreenHealthy(assert, page, '#search', 'Search screen');
    assert.ok(searchMetrics.width > 300, 'Search should be laid out before querying.');
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
    const resultTitles = await page.locator('#search-results h3').allTextContents();
    assert.ok(resultTitles.some((title) => /Electro-Shock Blues/.test(title)), 'Search should include the matching album.');
    assert.equal(new Set(resultTitles.map((title) => title.trim())).size, resultTitles.length, 'Search should not render duplicate result titles.');
    await assertNoVisualDefects(assert, page, '#search', 'Search results');

    await page.fill('#search-input', 'zzzz-no-match-auralis');
    await page.waitForFunction(() => document.getElementById('search-results')?.textContent?.includes('No results'));
    const noResultsText = (await page.locator('#search-results').textContent()) || '';
    assert.match(noResultsText, /No results/i);
    await assertNoVisualDefects(assert, page, '#search', 'Search no-results');

    const longNoMatchQuery = 'https___auralis_invalid_search_probe__0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz__hash__0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    await page.fill('#search-input', longNoMatchQuery);
    await page.waitForFunction((query) => {
        const resultsText = document.getElementById('search-results')?.textContent || '';
        const statusText = document.getElementById('search-status')?.textContent || '';
        return resultsText.includes('No results') && statusText.includes(query);
    }, longNoMatchQuery);
    await assertNoVisualDefects(assert, page, '#search', 'Search long-query no-results');

    await page.click('#search-clear-btn');
    await page.waitForFunction(() => document.activeElement?.id === 'search-input');

    step('Clearing the query and confirming the browse grid returns.');
    const clearedQuery = await page.locator('#search-input').inputValue();
    assert.equal(clearedQuery, '');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('search-browse')).display !== 'none');
    assert.ok(((await page.locator('#search-cat-grid').textContent()) || '').trim().length > 0, 'Search browse grid should recover after clearing the query.');
});
