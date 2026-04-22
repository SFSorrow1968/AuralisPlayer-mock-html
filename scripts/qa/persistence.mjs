import {
    assertNoVisualDefects,
    assertScreenHealthy,
    buildFixtureSet,
    captureScreenShot,
    clearClientState,
    expectText,
    installRichLibrary,
    openSettings,
    playTrackFromSnapshot,
    reloadApp,
    returnFromSettings,
    seedPersistedState,
    switchToRootScreen,
    withQaSession
} from './shared.mjs';

const fixture = await buildFixtureSet([
    'EELS/Electro-Shock Blues'
]);

const targetTrack = fixture.albums[0].tracks.find((track) => track.title === 'Last Stop This Town') || fixture.albums[0].tracks[0];

await withQaSession('qa:persistence', async ({ assert, page, step }) => {
    step('Installing the fixture library and mutating local user state.');
    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    await playTrackFromSnapshot(page, targetTrack);
    await expectText(page, '#player-title', targetTrack.title);

    await page.click('.like-btn');
    await openSettings(page);
    await page.click('#settings-gapless-toggle');

    await page.evaluate((track) => {
        const playlist = window.AuralisApp.createUserPlaylist('QA Persistence');
        window.AuralisApp.addTrackToUserPlaylist(playlist.id, track);
    }, targetTrack);
    await switchToRootScreen(page, 'library');
    await page.locator('#lib-btn-songs').click();
    await page.waitForFunction(() => document.getElementById('lib-btn-songs')?.classList.contains('active'));
    await switchToRootScreen(page, 'search');
    await page.fill('#search-input', 'last');
    await page.waitForFunction(() => document.getElementById('search-results')?.textContent?.toLowerCase().includes('last'));

    step('Reloading the app, reinstalling the fixture snapshot, and verifying persisted state survives.');
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);
    await playTrackFromSnapshot(page, targetTrack);

    const likeButtonClass = await page.locator('.like-btn').getAttribute('class');
    assert.ok(likeButtonClass && likeButtonClass.includes('is-liked'));

    await openSettings(page);
    const gaplessToggleClass = await page.locator('#settings-gapless-toggle').getAttribute('class');
    assert.ok(gaplessToggleClass && gaplessToggleClass.includes('active'));
    await assertScreenHealthy(assert, page, '#settings', 'Settings screen after reload');
    await assertNoVisualDefects(assert, page, '#settings', 'Settings screen after reload');
    await captureScreenShot(page, 'persistence-settings', { selector: '.emulator' });

    await returnFromSettings(page);
    await switchToRootScreen(page, 'library');
    const storedPlaylists = await page.evaluate(() => localStorage.getItem('auralis_user_playlists') || '[]');
    assert.match(storedPlaylists, /QA Persistence/);
    const restoredLibraryTab = await page.evaluate(() => ({
        songsActive: document.getElementById('lib-btn-songs')?.classList.contains('active') || false,
        songsVisible: getComputedStyle(document.getElementById('lib-view-songs')).display !== 'none'
    }));
    assert.deepEqual(restoredLibraryTab, { songsActive: true, songsVisible: true }, 'Library should restore the last selected tab.');
    await switchToRootScreen(page, 'search');
    const restoredSearch = await page.evaluate(() => ({
        query: document.getElementById('search-input')?.value || '',
        recentText: document.getElementById('search-recent-list')?.textContent || ''
    }));
    assert.match(`${restoredSearch.query} ${restoredSearch.recentText}`, /last/i, 'Search UI state should survive reload.');
});
