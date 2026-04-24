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
    { dir: 'EELS/Electro-Shock Blues', genre: 'Alternative Rock' }
]);

await withQaSession('qa:inline-queue', async ({ assert, page, step }) => {
    step('Starting album playback and opening the full player queue.');
    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    const album = fixture.albums[0];
    await page.evaluate(({ title, artist }) => {
        window.AuralisApp.playAlbumInOrder(title, 0, artist);
        window.AuralisApp.toggleOverlay('player');
    }, { title: album.title, artist: album.artist });

    await page.waitForSelector('#player.active');
    await page.waitForSelector('#player-inline-queue-list .queue-row');

    const initialState = await page.evaluate(() => ({
        standaloneQueueScreen: Boolean(document.getElementById('queue')),
        queueNavItems: document.querySelectorAll('[data-tab="queue"]').length,
        inlineRows: document.querySelectorAll('#player-inline-queue-list .queue-row').length,
        firstInlineTitle: document.querySelector('#player-inline-queue-list .queue-row h3')?.textContent?.trim() || '',
        nowPlaying: document.getElementById('player-title')?.textContent?.trim() || ''
    }));

    assert.equal(initialState.standaloneQueueScreen, false, 'Standalone Queue screen should not exist.');
    assert.equal(initialState.queueNavItems, 0, 'Bottom navigation should not expose a Queue tab.');
    assert.ok(initialState.inlineRows > 0, 'Full player should show queued tracks inline.');
    assert.notEqual(initialState.firstInlineTitle, initialState.nowPlaying, 'Inline queue should list upcoming tracks, not duplicate the current track.');

    step('Activating a queued song from the full player inline queue.');
    await page.locator('#player-inline-queue-list .queue-row .item-clickable').first().click();
    await page.waitForFunction((title) => document.getElementById('player-title')?.textContent?.trim() === title, initialState.firstInlineTitle);

    step('Clearing upcoming tracks from the inline queue.');
    await page.locator('#player-inline-queue-section .queue-utility-btn.is-inline').click();
    await page.waitForSelector('#player-inline-queue-list .queue-inline-empty');
    const emptyText = await page.locator('#player-inline-queue-list .queue-inline-empty').innerText();
    assert.match(emptyText, /Nothing queued|No tracks queued/, 'Inline queue should show a clear empty state.');
});
