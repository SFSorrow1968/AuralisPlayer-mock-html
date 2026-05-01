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
    "da' Skunk Junkies/Mental Masturbation (1998)",
    'EELS/Electro-Shock Blues',
    'Enya/Watermark',
    'Minutemen/3-Way Tie (For Last)',
    'Minutemen/Double Nickels On The Dime',
    'Minutemen/The Punch Line',
    'Minutemen/What Makes A Man Start Fires_'
]);

const libraryTabs = ['playlists', 'albums', 'artists', 'songs', 'genres', 'folders'];

async function assertItemVisible(page, itemSelector, containerSelector, assert, label) {
    const metrics = await page.evaluate(({ itemSelector, containerSelector }) => {
        const item = document.querySelector(itemSelector);
        const container = document.querySelector(containerSelector);
        if (!item || !container) return null;
        const itemRect = item.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return {
            itemLeft: itemRect.left,
            itemRight: itemRect.right,
            itemTop: itemRect.top,
            itemBottom: itemRect.bottom,
            containerLeft: containerRect.left,
            containerRight: containerRect.right,
            containerTop: containerRect.top,
            containerBottom: containerRect.bottom
        };
    }, { itemSelector, containerSelector });

    assert.ok(metrics, `Missing item metrics for ${label}.`);
    assert.ok(metrics.itemLeft >= metrics.containerLeft - 1, `${label} should not overflow on the left.`);
    assert.ok(metrics.itemRight <= metrics.containerRight + 1, `${label} should not overflow on the right.`);
    assert.ok(metrics.itemTop >= metrics.containerTop - 1, `${label} should not overflow at the top.`);
    assert.ok(metrics.itemBottom <= metrics.containerBottom + 1, `${label} should not overflow at the bottom.`);
}

async function assertLibraryTabState(page, assert, tab) {
    const state = await page.evaluate(({ targetTab, tabs }) => {
        const buttons = tabs.map((name) => {
            const button = document.getElementById(`lib-btn-${name}`);
            return {
                name,
                active: button?.classList.contains('active') || false,
                current: button?.getAttribute('aria-current') || ''
            };
        });
        const screens = tabs.map((name) => {
            const screen = document.getElementById(`library-screen-${name}`);
            return {
                name,
                active: screen?.classList.contains('active') || false,
                ariaHidden: screen?.getAttribute('aria-hidden') || ''
            };
        });
        return {
            activeTabs: buttons.filter((button) => button.active).map((button) => button.name),
            currentTabs: buttons.filter((button) => button.current === 'page').map((button) => button.name),
            targetScreen: screens.find((screen) => screen.name === targetTab) || null,
            inactiveScreens: screens.filter((screen) => screen.name !== targetTab)
        };
    }, { targetTab: tab, tabs: libraryTabs });
    assert.deepEqual(state.activeTabs, [tab], `${tab} should be the only active Library nav item.`);
    assert.deepEqual(state.currentTabs, [tab], `${tab} should be the only aria-current Library nav item.`);
    assert.ok(state.targetScreen, `${tab} category screen should exist.`);
    assert.equal(state.targetScreen.active, true, `${tab} category screen should be active.`);
    assert.equal(state.targetScreen.ariaHidden, 'false', `${tab} category screen should expose aria-hidden="false".`);
    state.inactiveScreens.forEach((screen) => {
        assert.equal(screen.active, false, `${screen.name} screen should not be active while ${tab} is selected.`);
    });
}

async function assertLibraryTabHealthy(page, assert, tab, label) {
    await assertLibraryTabState(page, assert, tab);
    await assertNoVisualDefects(assert, page, `#library-screen-${tab}`, label);
}

async function openLibraryCategory(page, tab) {
    await switchToRootScreen(page, 'library');
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));
    await page.locator(`#lib-btn-${tab}`).click();
    await page.waitForFunction((targetTab) => document.getElementById(`library-screen-${targetTab}`)?.classList.contains('active'), tab);
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
    assert.equal(title.trim(), 'Library');
    const libraryMetrics = await assertScreenHealthy(assert, page, '#library', 'Library screen');
    assert.ok(libraryMetrics.width > 300, 'Library should render within the emulator viewport.');
    await assertItemVisible(page, '#lib-btn-playlists', '#library-nav-container', assert, 'Playlists nav item');

    step('Checking Library category drag feedback and drag reordering.');
    await page.locator('#library-edit-toggle-btn').click();
    await page.waitForFunction(() => document.getElementById('library-nav-container')?.classList.contains('is-editing'));
    const albumNavButton = page.locator('#lib-btn-albums');
    await albumNavButton.scrollIntoViewIfNeeded();
    const albumNavBox = await albumNavButton.boundingBox();
    assert.ok(albumNavBox, 'Albums Library category should be measurable for drag feedback.');
    await page.mouse.move(albumNavBox.x + 24, albumNavBox.y + albumNavBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(albumNavBox.x + 24, albumNavBox.y + albumNavBox.height + 42, { steps: 6 });
    const libraryDragState = await page.evaluate(() => ({
        reordering: document.getElementById('library-nav-container')?.classList.contains('is-reordering') || false,
        dividerCount: document.querySelectorAll('#library-nav-container .is-drop-before, #library-nav-container .is-drop-after').length,
        order: Array.from(document.querySelectorAll('#library-nav-container .library-nav-item[data-section]')).map(button => button.dataset.section)
    }));
    await page.mouse.up();
    assert.equal(libraryDragState.reordering, true, 'Library categories should expose a drag state while reordering.');
    assert.ok(libraryDragState.dividerCount > 0, 'Library categories should show insertion dividers while reordering.');
    await page.waitForFunction(() => {
        const order = Array.from(document.querySelectorAll('#library-nav-container .library-nav-item[data-section]')).map(button => button.dataset.section);
        return order.indexOf('albums') > order.indexOf('artists');
    });
    await page.locator('#library-edit-toggle-btn').click();
    await page.waitForFunction(() => !document.getElementById('library-nav-container')?.classList.contains('is-editing'));

    step('Checking the playlist empty state uses guided actions instead of a dead-end message.');
    await openLibraryCategory(page, 'playlists');
    await assertLibraryTabHealthy(page, assert, 'playlists', 'Library playlists tab');
    const playlistState = await page.evaluate(() => ({
        text: document.getElementById('lib-playlists-list')?.textContent || '',
        actions: Array.from(document.querySelectorAll('#lib-playlists-list .library-empty-action')).map((button) => button.textContent.trim())
    }));
    assert.match(playlistState.text, /No playlists/i);
    assert.deepEqual(playlistState.actions, ['Create Playlist', 'Import M3U']);

    step('Opening the create playlist dialog and closing it with Escape.');
    await page.locator('#lib-playlists-list .library-empty-action.primary').click();
    await page.waitForFunction(() => document.getElementById('create-playlist-scrim')?.classList.contains('show'));
    await page.keyboard.press('Escape');
    const createDialogOpen = await page.evaluate(() => document.getElementById('create-playlist-scrim')?.classList.contains('show') || false);
    assert.equal(createDialogOpen, false, 'Escape should close the create playlist dialog.');

    step('Creating and opening a playlist detail view.');
    const playlistSeed = await page.evaluate(() => {
        const library = window.AuralisApp._getLibrary();
        const playlist = window.AuralisApp.createUserPlaylist('QA Detail Mix for Very Long Playlist Title Coverage That Should Wrap Cleanly In The Hero Without Overlap');
        library.tracks.slice(0, 2).forEach((track) => window.AuralisApp.addTrackToUserPlaylist(playlist.id, track));
        window.AuralisApp._applyBackendPayload({ userState: window.AuralisApp._exportBackendPayload().userState });
        return {
            id: playlist.id,
            name: playlist.name,
            firstTitle: playlist.tracks[0]?.title || ''
        };
    });
    const playlistName = playlistSeed.name;
    await page.waitForFunction((name) => document.getElementById('lib-playlists-list')?.textContent?.includes(name), playlistName);
    await page.locator('#lib-playlists-list .item-clickable', { hasText: playlistName }).click();
    await page.waitForFunction(() => document.getElementById('playlist_detail')?.classList.contains('active'));
    const playlistDetail = await assertScreenHealthy(assert, page, '#playlist_detail', 'Playlist detail');
    assert.ok(playlistDetail.visibleRows > 0, 'Playlist detail should render track rows.');
    assert.ok(((await page.locator('#playlist-track-list').textContent()) || '').trim().length > 0, 'Playlist detail track list should not be empty.');
    assert.equal(((await page.locator('#playlist-title').textContent()) || '').trim(), playlistName, 'Playlist detail should render the selected playlist title.');
    const playlistHero = await page.evaluate(() => ({
        title: document.getElementById('playlist-title')?.textContent?.trim() || '',
        subtitle: document.getElementById('playlist-subtitle')?.textContent?.trim() || '',
        rows: document.querySelectorAll('#playlist-track-list .album-track-row, #playlist-track-list .detail-track-row').length
    }));
    assert.equal(playlistHero.title, playlistName);
    assert.match(playlistHero.subtitle, /^2 songs( - \d+:\d{2})?$/, 'Playlist detail should include song count and optional total duration.');
    assert.ok(playlistHero.rows > 0, 'Playlist detail should render track rows.');
    const playlistTrackUndo = await page.evaluate(({ id }) => {
        const readPlaylist = () => JSON.parse(localStorage.getItem('auralis_user_playlists') || '[]').find((entry) => entry.id === id) || null;
        const before = readPlaylist();
        window.AuralisApp.removeTrackFromUserPlaylist(id, 0);
        const afterRemove = readPlaylist();
        const undone = window.AuralisApp.undoLastAction();
        const afterUndo = readPlaylist();
        return {
            beforeTitles: (before?.tracks || []).map((track) => track.title),
            afterRemoveTitles: (afterRemove?.tracks || []).map((track) => track.title),
            undone,
            afterUndoTitles: (afterUndo?.tracks || []).map((track) => track.title)
        };
    }, playlistSeed);
    assert.equal(playlistTrackUndo.undone, true, 'Removing a playlist track should register an undo action.');
    assert.equal(playlistTrackUndo.afterRemoveTitles.length, playlistTrackUndo.beforeTitles.length - 1, 'Playlist track removal should remove exactly one song.');
    assert.deepEqual(playlistTrackUndo.afterUndoTitles, playlistTrackUndo.beforeTitles, 'Undo should restore the playlist track order.');
    await assertNoVisualDefects(assert, page, '#playlist_detail', 'Playlist detail');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library-screen-playlists')?.classList.contains('active'));

    const playlistDeleteUndo = await page.evaluate(({ id }) => {
        const readIds = () => JSON.parse(localStorage.getItem('auralis_user_playlists') || '[]').map((entry) => entry.id);
        const beforeIds = readIds();
        window.AuralisApp.deleteUserPlaylist(id);
        const afterDeleteIds = readIds();
        const undone = window.AuralisApp.undoLastAction();
        const afterUndoIds = readIds();
        return { beforeIds, afterDeleteIds, undone, afterUndoIds };
    }, playlistSeed);
    assert.equal(playlistDeleteUndo.undone, true, 'Deleting a playlist should register an undo action.');
    assert.equal(playlistDeleteUndo.afterDeleteIds.includes(playlistSeed.id), false, 'Playlist should be absent immediately after delete.');
    assert.deepEqual(playlistDeleteUndo.afterUndoIds, playlistDeleteUndo.beforeIds, 'Undo should restore the deleted playlist in its original position.');

    const emptyPlaylist = await page.evaluate(() => {
        const playlist = window.AuralisApp.createUserPlaylist('QA Empty Detail Mix');
        return { id: playlist.id, name: playlist.name };
    });
    await page.evaluate((id) => window.AuralisApp.routeToPlaylistDetail(id), emptyPlaylist.id);
    await page.waitForFunction(() => document.getElementById('playlist_detail')?.classList.contains('active'));
    const emptyPlaylistText = (await page.locator('#playlist-track-list').textContent()) || '';
    assert.match(emptyPlaylistText, /This playlist is empty|Add Songs/i, 'Empty playlist detail should show a useful empty state.');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library-screen-playlists')?.classList.contains('active'));

    step('Verifying album routing and tab visibility.');
    await openLibraryCategory(page, 'albums');
    await assertLibraryTabHealthy(page, assert, 'albums', 'Library albums tab');
    await assertItemVisible(page, '#lib-btn-albums', '#library-nav-container', assert, 'Albums nav item');
    const albumsText = (await page.locator('#lib-albums-grid').textContent()) || '';
    assert.match(albumsText, /Watermark/);
    await page.locator('#lib-albums-grid .media-card, #lib-albums-grid .zenith-media-card').first().click();
    await page.waitForFunction(() => document.getElementById('album_detail')?.classList.contains('active'));
    const albumDetail = await assertScreenHealthy(assert, page, '#album_detail', 'Album detail');
    assert.ok(albumDetail.visibleRows > 0, 'Album detail should render track rows.');
    assert.ok(((await page.locator('#album-track-list').textContent()) || '').trim().length > 0, 'Album track list should not be empty.');
    assert.ok(((await page.locator('#alb-title').textContent()) || '').trim().length > 0, 'Album detail should show the selected album.');
    await assertNoVisualDefects(assert, page, '#album_detail', 'Album detail');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library-screen-albums')?.classList.contains('active'));

    step('Verifying artist routing and counts.');
    await openLibraryCategory(page, 'artists');
    await assertLibraryTabHealthy(page, assert, 'artists', 'Library artists tab');
    await assertItemVisible(page, '#lib-btn-artists', '#library-nav-container', assert, 'Artists nav item');
    await page.locator('#lib-artists-list .item-clickable').first().click();
    await page.waitForFunction(() => document.getElementById('artist_profile')?.classList.contains('active'));
    const artistDetail = await assertScreenHealthy(assert, page, '#artist_profile', 'Artist profile');
    assert.ok(artistDetail.visibleRows > 0, 'Artist profile should render section rows or cards.');
    const artistMeta = (await page.locator('#art-meta').textContent()) || '';
    assert.match(artistMeta, /album/);
    assert.match(artistMeta, /track/);
    const stressedArtistTitle = await page.evaluate(() => {
        const nameEl = document.getElementById('art-name');
        if (!nameEl) return '';
        const nextTitle = `${nameEl.textContent} and the Extended Artist Profile Header That Needs Stable Wrapping Under QA`;
        nameEl.textContent = nextTitle;
        return nextTitle;
    });
    assert.equal(((await page.locator('#art-name').textContent()) || '').trim(), stressedArtistTitle, 'Artist profile should expose the stressed artist title.');
    await assertNoVisualDefects(assert, page, '#artist_profile', 'Artist profile');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library-screen-artists')?.classList.contains('active'));

    step('Checking songs sort controls stay active and visible across tab changes.');
    await openLibraryCategory(page, 'songs');
    await assertLibraryTabHealthy(page, assert, 'songs', 'Library songs tab');
    await assertItemVisible(page, '#lib-btn-songs', '#library-nav-container', assert, 'Songs nav item');
    const songsRenderState = await page.locator('#lib-songs-list').evaluate((node) => ({
        virtualized: node.dataset.virtualized || 'false',
        renderedRows: node.querySelectorAll('.list-item, .zenith-row, .zenith-track-row').length,
        sentinelPresent: Boolean(node.querySelector('.library-virtual-sentinel')),
        statusText: node.querySelector('.library-virtual-status')?.textContent || ''
    }));
    assert.equal(songsRenderState.virtualized, 'true', 'This seeded fixture should trigger the songs virtualization path.');
    assert.ok(songsRenderState.renderedRows > 0, 'Songs list should render concrete rows for the seeded fixture.');
    assert.ok(songsRenderState.renderedRows <= 80, 'Songs list should cap the initial render at the virtualization threshold.');
    assert.equal(songsRenderState.sentinelPresent, true, 'Songs list should render a virtualization sentinel for this fixture.');
    assert.match(songsRenderState.statusText, /^Showing \d+ of \d+ songs$/, 'Songs list should expose virtualized progress copy.');
    await page.locator('#lib-songs-sort-row [data-sort=\"added\"]').click();
    await assertItemVisible(page, '#lib-songs-sort-row [data-sort=\"added\"]', '#lib-songs-sort-row', assert, 'Recently Added sort chip');
    const addedSortActive = await page.locator('#lib-songs-sort-row [data-sort="added"]').evaluate((node) => node.classList.contains('active'));
    assert.equal(addedSortActive, true);
    await openLibraryCategory(page, 'albums');
    await openLibraryCategory(page, 'songs');
    const persistedSortActive = await page.locator('#lib-songs-sort-row [data-sort="added"]').evaluate((node) => node.classList.contains('active'));
    assert.equal(persistedSortActive, true, 'The selected songs sort should survive tab switches.');

    step('Treating genre-less libraries as an empty tagged state, not an Unknown bucket.');
    await openLibraryCategory(page, 'genres');
    await assertLibraryTabHealthy(page, assert, 'genres', 'Library genres tab');
    await assertItemVisible(page, '#lib-btn-genres', '#library-nav-container', assert, 'Genres nav item');
    const genresText = (await page.locator('#lib-view-genres').textContent()) || '';
    assert.match(genresText, /No genres/i);
    assert.match(genresText, /Add genre tags\./i);
    assert.doesNotMatch(genresText, /^Unknown/i);

    step('Checking folder grouping and album routing from the folder browser.');
    await openLibraryCategory(page, 'folders');
    await assertLibraryTabHealthy(page, assert, 'folders', 'Library folders tab');
    await assertItemVisible(page, '#lib-btn-folders', '#library-nav-container', assert, 'Folders nav item');
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
    await page.waitForFunction(() => document.getElementById('library-screen-folders')?.classList.contains('active'));

    step('Exercising the folder empty state with no album snapshot data.');
    await installRichLibrary(page, []);
    await openLibraryCategory(page, 'folders');
    await assertLibraryTabHealthy(page, assert, 'folders', 'Library folders empty tab');
    const folderEmptyState = await page.evaluate(() => {
        const tree = document.getElementById('lib-folders-tree');
        const empty = tree?.querySelector('.screen-empty-state');
        return {
            title: empty?.querySelector('.screen-empty-title')?.textContent?.trim() || '',
            copy: empty?.querySelector('.screen-empty-copy')?.textContent?.trim() || '',
            iconPresent: Boolean(empty?.querySelector('.screen-empty-icon svg')),
            actionCount: empty?.querySelectorAll('.screen-empty-action, .library-empty-action').length || 0
        };
    });
    assert.equal(folderEmptyState.title, 'No folders', 'Folder empty state should use the createScreenEmptyState title.');
    assert.equal(folderEmptyState.copy, 'Add music folders.', 'Folder empty state should use the expected body copy.');
    assert.equal(folderEmptyState.iconPresent, true, 'Folder empty state should include the shared empty-state icon.');
    assert.equal(folderEmptyState.actionCount, 0, 'Folder empty state should not render stray empty-state actions.');

    step('Returning to Playlists should bring the leading tab back into view.');
    await openLibraryCategory(page, 'playlists');
    await assertItemVisible(page, '#lib-btn-playlists', '#library-nav-container', assert, 'Playlists nav item after returning from later categories');
});
