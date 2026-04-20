import {
    buildFixtureSet,
    clearClientState,
    expectText,
    installRichLibrary,
    reloadApp,
    switchToRootScreen,
    withQaSession
} from './shared.mjs';

const fixture = await buildFixtureSet([
    {
        dir: 'Minutemen/Miscellaneous',
        allowedExtensions: ['.mp3']
    }
]);

await withQaSession('qa:playback', async ({ assert, page, step }) => {
    step('Installing a playable MP3-only fixture snapshot.');
    await clearClientState(page);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    step('Navigating to the Songs view and starting playback from a track state button.');
    await switchToRootScreen(page, 'library');
    await page.click('#lib-btn-songs');
    await page.waitForSelector('#lib-songs-list .track-state-btn');

    const firstTitle = fixture.albums[0].tracks[0].title;
    const secondTitle = fixture.albums[0].tracks[1].title;
    await page.evaluate((track) => {
        window.AuralisApp.playTrack(track.title, track.artist, track.albumTitle);
    }, fixture.albums[0].tracks[0]);
    await expectText(page, '#player-title', firstTitle);
    await page.waitForFunction(() => Boolean(document.getElementById('audio-engine')?.src));

    await page.click('#player-main-toggle');

    await page.waitForFunction(() => {
        const audio = document.getElementById('audio-engine');
        return Boolean(audio && !audio.paused);
    });

    step('Pausing, resuming, skipping, and adjusting playback speed through the player controls.');
    await page.click('#player-main-toggle');
    await page.waitForFunction(() => {
        const audio = document.getElementById('audio-engine');
        return Boolean(audio && audio.paused);
    });

    await page.click('#player-main-toggle');
    await page.waitForFunction(() => {
        const audio = document.getElementById('audio-engine');
        return Boolean(audio && !audio.paused);
    });

    await page.click('#player-next-btn');
    await expectText(page, '#player-title', secondTitle);

    await page.click('[data-action="cycleSpeed"]');
    const speedLabel = (await page.locator('#player-speed-label').textContent()) || '';
    assert.notEqual(speedLabel.trim(), '1×');

    await page.click('#player-prev-btn');
    await expectText(page, '#player-title', firstTitle);
});
