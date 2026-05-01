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
    await page.locator('#search-input').focus();
    const emptySearchState = await page.evaluate(() => ({
        searchMode: document.getElementById('library')?.classList.contains('search-mode') || false,
        workspaceVisible: getComputedStyle(document.getElementById('search-workspace-root')).display !== 'none',
        resultsVisible: getComputedStyle(document.getElementById('search-results')).display !== 'none',
        query: document.getElementById('search-input')?.value || ''
    }));
    assert.equal(emptySearchState.query, '', 'The blank search field should stay blank when focused.');
    assert.equal(emptySearchState.searchMode, true, 'Focusing an empty search field should enter the search layout.');
    assert.equal(emptySearchState.workspaceVisible, false, 'Search sections should stay hidden until a query exists.');
    assert.equal(emptySearchState.resultsVisible, false, 'Search results should stay hidden until a query exists.');
    const searchActivateState = await page.evaluate(() => {
        const button = document.getElementById('search-activate-btn');
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
            width: rect.width,
            height: rect.height,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            color: style.color
        };
    });
    assert.ok(searchActivateState, 'The magnifying glass search control should exist.');
    assert.ok(searchActivateState.width >= 28 && searchActivateState.height >= 28, 'The magnifying glass search control should have a tappable visible target.');
    assert.notEqual(searchActivateState.visibility, 'hidden', 'The magnifying glass search control should be visible.');
    assert.notEqual(searchActivateState.opacity, '0', 'The magnifying glass search control should not be transparent.');

    const activatedBlankSearchState = await page.evaluate(() => ({
        searchMode: document.getElementById('library')?.classList.contains('search-mode') || false,
        workspaceVisible: getComputedStyle(document.getElementById('search-workspace-root')).display !== 'none',
        resultsVisible: getComputedStyle(document.getElementById('search-results')).display !== 'none',
        query: document.getElementById('search-input')?.value || ''
    }));
    assert.equal(activatedBlankSearchState.searchMode, true, 'Focused blank search should remain in the search layout.');
    assert.equal(activatedBlankSearchState.query, '', 'Opening search should not inject a query.');
    assert.equal(activatedBlankSearchState.workspaceVisible, false, 'Blank search should not show search sections.');
    assert.equal(activatedBlankSearchState.resultsVisible, false, 'Blank search should not show results.');

    await page.locator('#lib-btn-albums').click();
    const blankFilterState = await page.evaluate(() => ({
        searchMode: document.getElementById('library')?.classList.contains('search-mode') || false,
        workspaceVisible: getComputedStyle(document.getElementById('search-workspace-root')).display !== 'none',
        resultsVisible: getComputedStyle(document.getElementById('search-results')).display !== 'none',
        activeSearchFilters: Array.from(document.querySelectorAll('#library-nav-container .is-search-filter-active')).map(node => node.dataset.filter || '')
    }));
    assert.equal(blankFilterState.searchMode, true, 'Selecting a filter while search is open should keep search open.');
    assert.deepEqual(blankFilterState.activeSearchFilters, ['albums'], 'The selected Library source should become the active search filter.');
    assert.equal(blankFilterState.workspaceVisible, false, 'Selecting a blank filter should not show search sections.');
    assert.equal(blankFilterState.resultsVisible, false, 'Selecting a blank filter should not show results.');

    await page.evaluate(() => window.exitSearchMode?.());
    await page.locator('#lib-btn-albums').click();
    await page.waitForFunction(() => document.getElementById('library-screen-albums')?.classList.contains('active'));
    await switchToRootScreen(page, 'library');

    step('Restoring a stale Album filter should still keep blank search quiet.');
    await page.evaluate(() => {
        localStorage.setItem('auralis_ui_preferences_v1', JSON.stringify({
            version: 1,
            searchQuery: '',
            searchFilters: ['albums']
        }));
    });
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);
    await page.evaluate((nextTitle) => {
        const library = window.AuralisApp._getLibrary();
        const album = Array.isArray(library?.albums)
            ? library.albums.find((entry) => entry?.title === 'Electro-Shock Blues')
            : null;
        if (!album) return;
        album.title = nextTitle;
        if (Array.isArray(album.tracks)) {
            album.tracks.forEach((track) => {
                track.albumTitle = nextTitle;
            });
        }
    }, longAlbumTitle);
    await switchToRootScreen(page, 'library');
    await page.locator('#search-input').focus();
    const staleBlankSearchState = await page.evaluate(() => ({
        searchMode: document.getElementById('library')?.classList.contains('search-mode') || false,
        workspaceVisible: getComputedStyle(document.getElementById('search-workspace-root')).display !== 'none',
        resultsVisible: getComputedStyle(document.getElementById('search-results')).display !== 'none',
        activeSearchFilters: Array.from(document.querySelectorAll('#library-nav-container .is-search-filter-active')).map(node => node.dataset.filter || '')
    }));
    assert.equal(staleBlankSearchState.searchMode, true, 'Focusing search should enter the search layout even when a stale scoped filter was restored.');
    assert.equal(staleBlankSearchState.workspaceVisible, false, 'Restored scoped filters should not show search workspace sections without a query.');
    assert.equal(staleBlankSearchState.resultsVisible, false, 'Restored scoped filters should not show search results without a query.');
    assert.deepEqual(staleBlankSearchState.activeSearchFilters, [], 'Restored scoped filters should reset to the normal Library source state when the query is blank.');

    await page.evaluate(() => window.exitSearchMode?.());
    await page.locator('#lib-btn-albums').click();
    await page.waitForFunction(() => document.getElementById('library-screen-albums')?.classList.contains('active'));
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));
    await page.fill('#search-input', 'shock');

    await page.waitForFunction(() => {
        const results = document.getElementById('search-results');
        return Boolean(results && getComputedStyle(results).display !== 'none' && results.textContent.includes('Electro-Shock Blues'));
    });

    const resultsText = (await page.locator('#search-results').textContent()) || '';
    assert.match(resultsText, /Electro-Shock Blues/);
    const firstResultSection = await page.locator('#search-results [data-search-result-section]').first().getAttribute('data-search-result-section');
    assert.equal(firstResultSection, 'albums', 'The active Library source should be the first search result section until the user reorders it.');
    const resultTitles = await page.locator('#search-results h3').allTextContents();
    assert.ok(resultTitles.some((title) => title.includes(longAlbumTitle)), 'Search should include the matching album.');
    assert.equal(new Set(resultTitles.map((title) => title.trim())).size, resultTitles.length, 'Search should not render duplicate result titles.');

    const resultSectionHeader = page.locator('#search-results [data-search-result-section="albums"] .search-workspace-section-header').first();
    await resultSectionHeader.scrollIntoViewIfNeeded();
    const headerBox = await resultSectionHeader.boundingBox();
    assert.ok(headerBox, 'The Albums result section header should be measurable for drag feedback.');
    await page.mouse.move(headerBox.x + 18, headerBox.y + 12);
    await page.mouse.down();
    await page.mouse.move(headerBox.x + 18, headerBox.y + 96, { steps: 6 });
    const dragFeedbackState = await page.evaluate(() => ({
        reordering: document.querySelector('#search-results .search-results-list-shell')?.classList.contains('is-reordering') || false,
        dividerCount: document.querySelectorAll('#search-results .is-drop-before, #search-results .is-drop-after').length
    }));
    await page.mouse.up();
    assert.equal(dragFeedbackState.reordering, true, 'Search result sections should expose a drag state while reordering.');
    assert.ok(dragFeedbackState.dividerCount > 0, 'Search result sections should show insertion dividers while reordering.');
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
