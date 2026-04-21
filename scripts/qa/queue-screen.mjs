import {
    buildFixtureSet,
    clearClientState,
    expectText,
    playTrackFromSnapshot,
    reloadApp,
    seedPersistedState,
    withQaSession
} from './shared.mjs';

const fixture = await buildFixtureSet([
    'EELS/Electro-Shock Blues',
    'Enya/Watermark',
    'Minutemen/The Punch Line'
]);

async function openQueue(page) {
    await page.click('[data-tab="queue"]');
    await page.waitForFunction(() => document.getElementById('queue')?.classList.contains('active'));
    await page.waitForFunction(() => {
        const queue = document.getElementById('queue');
        if (!queue) return false;
        const rect = queue.getBoundingClientRect();
        return rect.top < 160 && rect.bottom > 320;
    });
}

async function getQueueRowTitles(page, selector) {
    return page.locator(`${selector} h3`).evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() || ''));
}

await withQaSession('qa:queue', async ({ assert, page, step }) => {
    step('Seeding the app with a clean library and verifying the queue empty state is reachable from the bottom navigation.');
    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);

    await openQueue(page);
    await expectText(page, '#queue-summary', 'Queue is empty');
    assert.match((await page.locator('#queue-list').innerText()) || '', /Find Music/);

    await page.click('#queue-list .queue-utility-btn.is-primary');
    await page.waitForFunction(() => document.getElementById('search')?.classList.contains('active'));

    step('Starting playback, reopening Queue, and confirming the screen renders in the viewport with the expected summary.');
    await page.evaluate((albums) => {
        window.AuralisApp._installLibrarySnapshot(albums, {
            force: true,
            renderHome: true,
            renderLibrary: true,
            syncEmpty: true,
            updateHealth: true,
            resetPlayback: true
        });
    }, fixture.albums);
    await playTrackFromSnapshot(page, fixture.albums[0].tracks[0]);
    await openQueue(page);

    const queueRect = await page.locator('#queue').evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
    });
    assert.ok(queueRect.top < 160, `Queue screen top should be in view, got ${queueRect.top}`);
    assert.ok(queueRect.bottom > 320, `Queue screen bottom should extend into the viewport, got ${queueRect.bottom}`);
    await expectText(page, '#queue-summary', '7 tracks queued after now playing');

    step('Confirming queue rows are reduced to tap/hold plus title and duration, then activating a queued track directly.');
    const redundantControlCounts = await page.evaluate(() => ({
        stateButtons: document.querySelectorAll('#queue-list .queue-state-btn, #player-inline-queue-list .queue-state-btn').length,
        optionButtons: document.querySelectorAll('#queue-list .queue-option-btn, #player-inline-queue-list .queue-option-btn').length,
        dragHandles: document.querySelectorAll('#queue-list .queue-drag-handle, #player-inline-queue-list .queue-drag-handle').length
    }));
    assert.deepEqual(redundantControlCounts, {
        stateButtons: 0,
        optionButtons: 0,
        dragHandles: 0
    });
    const queueRowDurations = await page.locator('#queue-list .queue-row .zenith-time-pill').evaluateAll((nodes) =>
        nodes.map((node) => node.textContent?.trim() || '')
    );
    assert.ok(queueRowDurations.every(Boolean), 'Expected every visible queue row to retain a duration label.');

    const queuedTitle = (await getQueueRowTitles(page, '#queue-list .queue-upnext-row')).at(0);
    assert.ok(queuedTitle, 'Expected at least one up-next row in the queue.');

    await page.waitForTimeout(350);
    await page.locator('#queue-list .queue-upnext-row').filter({ hasText: queuedTitle }).first().locator('.item-clickable').click();
    await page.waitForFunction((title) => {
        const current = document.querySelector('#queue-list .queue-current-row h3');
        return current && current.textContent && current.textContent.includes(title);
    }, queuedTitle);
    await expectText(page, '#queue-summary', '6 tracks queued after now playing');

    step('Clearing Up Next and checking that the queue falls back to the end-of-queue state with disabled actions.');
    await page.locator('#queue-list .queue-footer-actions .queue-utility-btn').nth(1).click();
    await expectText(page, '#queue-summary', 'No tracks are queued after the current song');
    await expectText(page, '#queue-list', 'You are at the end of the queue');

    const actionState = await page.evaluate(() => ({
        topClearDisabled: document.getElementById('queue-clear-btn')?.disabled,
        footerButtons: Array.from(document.querySelectorAll('#queue-list .queue-footer-actions .queue-utility-btn')).map((btn) => ({
            text: btn.textContent?.trim(),
            disabled: btn.disabled
        }))
    }));
    assert.equal(actionState.topClearDisabled, true);
    assert.deepEqual(actionState.footerButtons, [
        { text: 'Shuffle Up Next', disabled: true },
        { text: 'Clear Up Next', disabled: true }
    ]);

    step('Applying a mixed backend playback session and verifying each queue row keeps its own artwork instead of collapsing to fallback or shared art.');
    const mixedQueueTracks = [
        fixture.albums[0].tracks[0],
        fixture.albums[1].tracks[0],
        fixture.albums[2].tracks[0]
    ];

    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);
    await page.evaluate(({ albums, playbackSession }) => {
        window.AuralisApp._installLibrarySnapshot(albums, {
            force: true,
            renderHome: true,
            renderLibrary: true,
            syncEmpty: true,
            updateHealth: true,
            resetPlayback: true
        });
        window.AuralisApp._applyBackendPayload({ playbackSession });
    }, {
        albums: fixture.albums,
        playbackSession: {
            nowPlaying: mixedQueueTracks[0],
            queue: mixedQueueTracks,
            queueIndex: 0,
            isPlaying: true
        }
    });
    await openQueue(page);
    await expectText(page, '#queue-summary', '2 tracks queued after now playing');

    const mixedQueueArt = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#queue-list .queue-row'));
        return rows.map((row) => ({
            title: row.querySelector('h3')?.textContent?.trim() || '',
            backgroundImage: getComputedStyle(row.querySelector('.item-icon')).backgroundImage || ''
        }));
    });

    mixedQueueTracks.forEach((track) => {
        const rendered = mixedQueueArt.find((row) => row.title === track.title);
        assert.ok(rendered, `Expected queue row for ${track.title}.`);
        assert.match(rendered.backgroundImage, new RegExp(track.artUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
});
