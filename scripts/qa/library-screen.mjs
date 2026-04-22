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

async function assertLibraryTabState(page, assert, tab) {
    const state = await page.evaluate(({ targetTab, tabs }) => {
        const buttons = tabs.map((name) => {
            const button = document.getElementById(`lib-btn-${name}`);
            return {
                name,
                active: button?.classList.contains('active') || false,
                selected: button?.getAttribute('aria-selected') || ''
            };
        });
        const views = tabs.map((name) => {
            const view = document.getElementById(`lib-view-${name}`);
            return {
                name,
                display: view ? getComputedStyle(view).display : '',
                ariaHidden: view?.getAttribute('aria-hidden') || ''
            };
        });
        return {
            activeTabs: buttons.filter((button) => button.active).map((button) => button.name),
            selectedTabs: buttons.filter((button) => button.selected === 'true').map((button) => button.name),
            targetView: views.find((view) => view.name === targetTab) || null,
            hiddenViews: views.filter((view) => view.name !== targetTab)
        };
    }, { targetTab: tab, tabs: libraryTabs });
    assert.deepEqual(state.activeTabs, [tab], `${tab} should be the only active Library tab.`);
    assert.deepEqual(state.selectedTabs, [tab], `${tab} should be the only aria-selected Library tab.`);
    assert.ok(state.targetView, `${tab} view should exist.`);
    assert.notEqual(state.targetView.display, 'none', `${tab} view should be visible.`);
    assert.equal(state.targetView.ariaHidden, 'false', `${tab} view should expose aria-hidden="false".`);
    state.hiddenViews.forEach((view) => {
        assert.equal(view.display, 'none', `${view.name} view should be hidden while ${tab} is selected.`);
        assert.equal(view.ariaHidden, 'true', `${view.name} view should expose aria-hidden="true" while ${tab} is selected.`);
    });
}

async function assertLibraryTabHealthy(page, assert, tab, label) {
    await assertLibraryTabState(page, assert, tab);
    await assertNoVisualDefects(assert, page, '#library', label);
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
    const libraryMetrics = await assertScreenHealthy(assert, page, '#library', 'Library screen');
    assert.ok(libraryMetrics.width > 300, 'Library should render within the emulator viewport.');

    step('Checking the playlist empty state uses guided actions instead of a dead-end message.');
    await assertLibraryTabHealthy(page, assert, 'playlists', 'Library playlists tab');
    const playlistState = await page.evaluate(() => ({
        text: document.getElementById('lib-playlists-list')?.textContent || '',
        actions: Array.from(document.querySelectorAll('#lib-playlists-list .library-empty-action')).map((button) => button.textContent.trim())
    }));
    assert.match(playlistState.text, /No playlists yet/i);
    assert.deepEqual(playlistState.actions, ['Create Playlist', 'Import M3U']);
    await assertChipVisible(page, '#lib-btn-playlists', '#library > .filter-row', assert, 'Playlists tab');

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
    assert.match(playlistHero.subtitle, /2 songs.*\d+:\d{2}/, 'Playlist detail should include song count and total duration.');
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
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

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
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Verifying album routing and tab visibility.');
    await page.locator('#lib-btn-albums').click();
    await page.waitForFunction(() => document.getElementById('lib-view-albums') && getComputedStyle(document.getElementById('lib-view-albums')).display !== 'none');
    await assertLibraryTabHealthy(page, assert, 'albums', 'Library albums tab');
    await assertChipVisible(page, '#lib-btn-albums', '#library > .filter-row', assert, 'Albums tab');
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
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Verifying artist routing and counts.');
    await page.locator('#lib-btn-artists').click();
    await page.waitForFunction(() => document.getElementById('lib-view-artists') && getComputedStyle(document.getElementById('lib-view-artists')).display !== 'none');
    await assertLibraryTabHealthy(page, assert, 'artists', 'Library artists tab');
    await assertChipVisible(page, '#lib-btn-artists', '#library > .filter-row', assert, 'Artists tab');
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
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    step('Checking songs sort controls stay active and visible across tab changes.');
    await page.locator('#lib-btn-songs').click();
    await page.waitForFunction(() => document.getElementById('lib-view-songs') && getComputedStyle(document.getElementById('lib-view-songs')).display !== 'none');
    await assertLibraryTabHealthy(page, assert, 'songs', 'Library songs tab');
    await assertChipVisible(page, '#lib-btn-songs', '#library > .filter-row', assert, 'Songs tab');
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
    await assertLibraryTabHealthy(page, assert, 'genres', 'Library genres tab');
    await assertChipVisible(page, '#lib-btn-genres', '#library > .filter-row', assert, 'Genres tab');
    const genresText = (await page.locator('#lib-view-genres').textContent()) || '';
    assert.match(genresText, /No genres yet/i);
    assert.match(genresText, /Add genre tags to tracks to browse this view\./i);
    assert.doesNotMatch(genresText, /^Unknown/i);

    step('Checking folder grouping and album routing from the folder browser.');
    await page.locator('#lib-btn-folders').click();
    await page.waitForFunction(() => document.getElementById('lib-view-folders') && getComputedStyle(document.getElementById('lib-view-folders')).display !== 'none');
    await assertLibraryTabHealthy(page, assert, 'folders', 'Library folders tab');
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

    step('Exercising the folder empty state with no album snapshot data.');
    await installRichLibrary(page, []);
    await switchToRootScreen(page, 'library');
    await page.locator('#lib-btn-folders').click();
    await page.waitForFunction(() => document.getElementById('lib-view-folders') && getComputedStyle(document.getElementById('lib-view-folders')).display !== 'none');
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
    assert.equal(folderEmptyState.title, 'No folders yet', 'Folder empty state should use the createScreenEmptyState title.');
    assert.equal(folderEmptyState.copy, 'Scan a music library to browse albums by folder.', 'Folder empty state should use the expected body copy.');
    assert.equal(folderEmptyState.iconPresent, true, 'Folder empty state should include the shared empty-state icon.');
    assert.equal(folderEmptyState.actionCount, 0, 'Folder empty state should not render stray empty-state actions.');

    step('Returning to Playlists should bring the leading tab back into view.');
    await page.locator('#lib-btn-playlists').click();
    await assertChipVisible(page, '#lib-btn-playlists', '#library > .filter-row', assert, 'Playlists tab after returning from later tabs');
});
