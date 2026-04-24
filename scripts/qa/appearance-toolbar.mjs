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

await withQaSession('qa:appearance-toolbar', async ({ assert, page, step }) => {
    step('Opening the album appearance toolbar with real fixture albums.');
    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    await page.evaluate(() => window.AuralisApp.switchTab('library'));
    await page.locator('#lib-btn-albums').click();
    await page.waitForSelector('#library-screen-albums.active');
    await page.locator('#library-screen-albums .category-appearance-edit-btn').click();
    await page.waitForSelector('#library-screen-albums .settings-choice-toolbar');

    const gridState = await page.locator('#library-screen-albums .settings-choice-toolbar').evaluate((toolbar) => {
        const style = getComputedStyle(toolbar);
        return {
            columns: style.gridTemplateColumns.split(' ').length,
            groups: Array.from(toolbar.querySelectorAll('.settings-choice-group')).map(group => ({
                label: group.querySelector('.settings-choice-label span')?.textContent?.trim() || '',
                open: group.open,
                buttons: group.querySelectorAll('.settings-choice').length
            })),
            activeButtonColor: getComputedStyle(toolbar.querySelector('.settings-choice.active')).color
        };
    });

    assert.equal(gridState.columns, 2, 'Appearance toolbar should lay settings out in two columns.');
    assert.deepEqual(
        gridState.groups.map(group => group.label),
        ['View', 'Size', 'Columns', 'Sort'],
        'Grid mode should expose only relevant settings groups.'
    );
    assert.ok(gridState.groups.every(group => group.open && group.buttons > 0), 'Every visible settings group should start expanded with choices.');
    assert.notEqual(gridState.activeButtonColor, 'rgb(0, 0, 0)', 'Active toolbar icons/text must stay theme-aware.');

    step('Collapsing a settings row and verifying the preference sticks.');
    await page.locator('#library-screen-albums .settings-choice-label').first().click();
    await page.waitForFunction(() => !document.querySelector('#library-screen-albums .settings-choice-group')?.open);
    await page.waitForFunction(() => {
        const prefs = JSON.parse(localStorage.getItem('auralis_ui_preferences_v1') || '{}');
        return prefs.libraryAppearance?.albums?.collapsedGroups?.includes('view');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.AuralisApp));
    await page.evaluate(() => window.AuralisApp.switchTab('library'));
    await page.locator('#lib-btn-albums').click();
    await page.waitForSelector('#library-screen-albums.active');
    await page.locator('#library-screen-albums .category-appearance-edit-btn').click();
    const firstGroupOpen = await page.locator('#library-screen-albums .settings-choice-group').first().evaluate(group => group.open);
    assert.equal(firstGroupOpen, false, 'Collapsed appearance groups should persist.');

    step('Checking configurable artist grid columns.');
    await page.evaluate(() => window.AuralisApp.switchLib('artists'));
    await page.waitForSelector('#library-screen-artists.active');
    await page.locator('#library-screen-artists .category-appearance-edit-btn').click();
    await page.locator('#library-screen-artists .settings-choice[aria-label="artists grid view"]').click();
    await page.locator('#library-screen-artists .settings-choice[aria-label="2 columns"]').click();
    const artistColumns = await page.locator('#lib-artists-list').evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').length);
    assert.equal(artistColumns, 2, 'Artist grid should honor the two-column setting.');
});
