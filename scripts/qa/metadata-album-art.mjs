import {
    buildFixtureSet,
    clearClientState,
    expectStyleContains,
    expectText,
    installRichLibrary,
    playTrackFromSnapshot,
    reloadApp,
    withQaSession
} from './shared.mjs';

const fixture = await buildFixtureSet([
    'EELS/Electro-Shock Blues',
    'Enya/Watermark'
]);

const targetTrack = fixture.albums[0].tracks.find((track) => track.title === 'Last Stop This Town') || fixture.albums[0].tracks[0];

await withQaSession('qa:metadata', async ({ assert, page, step }) => {
    step('Resetting local state and installing a rich fixture snapshot with real album art URLs.');
    await clearClientState(page);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    step('Selecting a fixture track and confirming the now-playing metadata updates.');
    await playTrackFromSnapshot(page, targetTrack);
    await expectText(page, '#player-title', targetTrack.title);
    await expectText(page, '#player-artist', targetTrack.artist);
    await expectStyleContains(page, '#player-art', 'backgroundImage', 'Album%20Art');

    step('Opening the artwork viewer and verifying the image source and album labels.');
    await page.evaluate(() => {
        const art = document.getElementById('player-art');
        art?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => {
        const scrim = document.getElementById('image-viewer-scrim');
        return Boolean(scrim && scrim.classList.contains('show'));
    });

    const viewerImage = await page.locator('#image-viewer-img').getAttribute('src');
    assert.ok(viewerImage && viewerImage.includes('Album%20Art'));

    await expectText(page, '#image-viewer-title', fixture.albums[0].title);
    await expectText(page, '#image-viewer-sub', fixture.albums[0].artist);
});
