import {
    assertNoVisualDefects,
    assertScreenHealthy,
    buildFixtureSet,
    captureScreenShot,
    clearClientState,
    expectText,
    installRichLibrary,
    reloadApp,
    seedPersistedState,
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
    await seedPersistedState(page);
    await reloadApp(page);
    await page.evaluate(() => {
        const audio = document.getElementById('audio-engine');
        if (!audio) return;

        let qaPaused = true;
        let qaCurrentTime = 0;
        const qaDuration = 214;

        Object.defineProperty(audio, 'paused', {
            configurable: true,
            get: () => qaPaused
        });

        Object.defineProperty(audio, 'duration', {
            configurable: true,
            get: () => qaDuration
        });

        Object.defineProperty(audio, 'currentTime', {
            configurable: true,
            get: () => qaCurrentTime,
            set: (value) => {
                qaCurrentTime = Number(value) || 0;
            }
        });

        audio.load = () => {
            audio.dispatchEvent(new Event('loadedmetadata'));
        };
        audio.play = async () => {
            qaPaused = false;
            audio.dispatchEvent(new Event('play'));
            return Promise.resolve();
        };
        audio.pause = () => {
            qaPaused = true;
            audio.dispatchEvent(new Event('pause'));
        };
    });
    await installRichLibrary(page, fixture.albums);

    step('Navigating to the Songs view and starting playback from a track row.');
    await switchToRootScreen(page, 'library');
    await page.click('#lib-btn-songs');
    await page.waitForSelector('#lib-songs-list [data-track-key]');

    const firstTitle = fixture.albums[0].tracks[0].title;
    const secondTitle = fixture.albums[0].tracks[1].title;
    await page.evaluate((track) => {
        window.AuralisApp.playTrack(track.title, track.artist, track.albumTitle);
    }, fixture.albums[0].tracks[0]);
    await expectText(page, '#player-title', firstTitle);
    await page.waitForFunction(() => Boolean(document.getElementById('audio-engine')?.src));

    const audioStartedPaused = await page.evaluate(() => {
        const audio = document.getElementById('audio-engine');
        return Boolean(audio && audio.paused);
    });
    if (audioStartedPaused) {
        await page.click('#mini-play-toggle');
    }

    await page.waitForFunction(() => {
        const audio = document.getElementById('audio-engine');
        return Boolean(audio && !audio.paused);
    });

    await page.click('.mini-player');
    await page.waitForFunction(() => document.getElementById('player')?.classList.contains('active'));
    await page.waitForFunction(() => {
        const player = document.getElementById('player');
        return Boolean(player && getComputedStyle(player).transform === 'matrix(1, 0, 0, 1, 0, 0)');
    });

    step('Verifying full player overlay layout and visual fidelity.');
    await assertScreenHealthy(assert, page, '#player', 'Full player overlay');
    await assertNoVisualDefects(assert, page, '#player', 'Full player');
    await captureScreenShot(page, 'player-full-after', { selector: '.emulator' });

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

    const activePlaybackState = await page.evaluate(() => ({
        activeRows: document.querySelectorAll('[data-track-key].is-now-playing, [data-track-key].playing-row').length,
        miniTitle: document.querySelector('.mini-title')?.textContent?.trim() || '',
        playerTitle: document.getElementById('player-title')?.textContent?.trim() || '',
        activeButtons: document.querySelectorAll('[data-collection-type].is-playing, .catalog-play-btn.is-playing').length
    }));
    assert.ok(activePlaybackState.miniTitle, 'Mini player should show a now-playing title.');
    assert.equal(activePlaybackState.playerTitle, activePlaybackState.miniTitle, 'Full player and mini player should agree on now-playing title.');
    assert.ok(activePlaybackState.activeRows >= 1, 'At least one visible row should expose active now-playing state.');

    step('Opening and checking the EQ panel.');
    const eqBtnVisible = await page.locator('#player-eq-btn').isVisible();
    if (eqBtnVisible) {
        await page.click('#player-eq-btn');
        await page.waitForFunction(() => {
            const panel = document.getElementById('eq-panel');
            return panel && getComputedStyle(panel).display !== 'none';
        });
        await assertNoVisualDefects(assert, page, '#player', 'Full player EQ');
    }

    step('Proving timeupdate does not rerender unrelated screens.');
    const beforeMutCounts = await page.evaluate(() => ({
        queueHtml: document.getElementById('queue-list')?.innerHTML || '',
        homeHtml: document.getElementById('home-sections-root')?.innerHTML || ''
    }));
    await page.evaluate(() => {
        const audio = document.getElementById('audio-engine');
        if (audio) {
            audio.currentTime = 42;
            audio.dispatchEvent(new Event('timeupdate'));
        }
    });
    const afterMutCounts = await page.evaluate(() => ({
        queueHtml: document.getElementById('queue-list')?.innerHTML || '',
        homeHtml: document.getElementById('home-sections-root')?.innerHTML || ''
    }));
    assert.equal(afterMutCounts.queueHtml, beforeMutCounts.queueHtml, 'timeupdate should not rerender queue markup.');
    assert.equal(afterMutCounts.homeHtml, beforeMutCounts.homeHtml, 'timeupdate should not rerender home markup.');
});
