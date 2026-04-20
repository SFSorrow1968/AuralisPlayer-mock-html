import {
    buildFixtureSet,
    clearClientState,
    expectText,
    installRichLibrary,
    openSettings,
    playTrackFromSnapshot,
    reloadApp,
    returnFromSettings,
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

    step('Reloading the app, reinstalling the fixture snapshot, and verifying persisted state survives.');
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);
    await playTrackFromSnapshot(page, targetTrack);

    const likeButtonClass = await page.locator('.like-btn').getAttribute('class');
    assert.ok(likeButtonClass && likeButtonClass.includes('is-liked'));

    await openSettings(page);
    const gaplessToggleClass = await page.locator('#settings-gapless-toggle').getAttribute('class');
    assert.ok(gaplessToggleClass && gaplessToggleClass.includes('active'));

    await returnFromSettings(page);
    await switchToRootScreen(page, 'library');
    await page.waitForFunction(() => document.body.textContent.includes('QA Persistence'));
});
