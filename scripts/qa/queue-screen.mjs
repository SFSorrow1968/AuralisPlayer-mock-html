import {
    assertNoVisualDefects,
    assertScreenHealthy,
    buildFixtureSet,
    captureScreenShot,
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
    await assertScreenHealthy(assert, page, '#queue', 'Queue screen');
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

    step('Using shuffle and repeat from the player controls and verifying they animate on the icon without falling back to toast feedback.');
    const shuffleState = await page.evaluate(async () => {
        const getTitles = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => node.textContent?.trim() || '');
        const shuffleBtn = document.getElementById('player-shuffle-btn');
        const toast = document.getElementById('toast');
        const originalRandom = Math.random;
        let calls = 0;
        Math.random = () => {
            calls += 1;
            return 0;
        };

        try {
            const before = getTitles('#queue-list .queue-upnext-row h3');
            const currentBefore = document.querySelector('#queue-list .queue-current-row h3')?.textContent?.trim() || '';
            if (toast) {
                toast.classList.remove('show');
                toast.textContent = '';
            }
            shuffleBtn?.click();
            const payload = window.AuralisApp._exportBackendPayload();
            const immediateFeedback = shuffleBtn?.classList.contains('player-control-feedback') || false;
            await new Promise((resolve) => setTimeout(resolve, 420));
            return {
                currentBefore,
                currentAfter: document.querySelector('#queue-list .queue-current-row h3')?.textContent?.trim() || '',
                before,
                after: getTitles('#queue-list .queue-upnext-row h3'),
                immediateFeedback,
                settledFeedback: shuffleBtn?.classList.contains('player-control-feedback') || false,
                ariaPressed: shuffleBtn?.getAttribute('aria-pressed'),
                title: shuffleBtn?.getAttribute('title'),
                shuffleMode: Boolean(payload?.playbackSession?.shuffleMode),
                randomCalls: calls,
                toastVisible: toast?.classList.contains('show') || false,
                toastText: toast?.textContent?.trim() || ''
            };
        } finally {
            Math.random = originalRandom;
        }
    });
    assert.equal(shuffleState.currentAfter, shuffleState.currentBefore);
    assert.notDeepEqual(shuffleState.after, shuffleState.before);
    assert.deepEqual([...shuffleState.after].sort(), [...shuffleState.before].sort());
    assert.equal(shuffleState.immediateFeedback, true);
    assert.equal(shuffleState.settledFeedback, false);
    assert.equal(shuffleState.ariaPressed, 'false');
    assert.equal(shuffleState.title, 'Shuffle');
    assert.equal(shuffleState.shuffleMode, false);
    assert.ok(shuffleState.randomCalls > 0, 'Expected the shuffle action to consume Math.random().');
    assert.equal(shuffleState.toastVisible, false);
    assert.equal(shuffleState.toastText, '');

    const repeatState = await page.evaluate(async () => {
        const repeatBtn = document.getElementById('player-repeat-btn');
        const toast = document.getElementById('toast');
        if (toast) {
            toast.classList.remove('show');
            toast.textContent = '';
        }
        repeatBtn?.click();
        const immediateFeedback = repeatBtn?.classList.contains('player-control-feedback') || false;
        const repeatOnImmediate = repeatBtn?.classList.contains('repeat-on') || false;
        const titleImmediate = repeatBtn?.getAttribute('title') || '';
        await new Promise((resolve) => setTimeout(resolve, 420));
        return {
            immediateFeedback,
            settledFeedback: repeatBtn?.classList.contains('player-control-feedback') || false,
            repeatOnImmediate,
            repeatOnSettled: repeatBtn?.classList.contains('repeat-on') || false,
            titleImmediate,
            titleSettled: repeatBtn?.getAttribute('title') || '',
            toastVisible: toast?.classList.contains('show') || false,
            toastText: toast?.textContent?.trim() || ''
        };
    });
    assert.equal(repeatState.immediateFeedback, true);
    assert.equal(repeatState.settledFeedback, false);
    assert.equal(repeatState.repeatOnImmediate, true);
    assert.equal(repeatState.repeatOnSettled, true);
    assert.equal(repeatState.titleImmediate, 'Repeat all');
    assert.equal(repeatState.titleSettled, 'Repeat all');
    assert.equal(repeatState.toastVisible, false);
    assert.equal(repeatState.toastText, '');

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
    await page.evaluate(() => {
        window.scrollTo(0, 0);
        const emulator = document.querySelector('.emulator');
        if (emulator) {
            emulator.scrollTop = 0;
            emulator.scrollLeft = 0;
            emulator.scrollIntoView({ block: 'center', inline: 'center' });
        }
    });
    await page.waitForTimeout(50);
    const activeQueueMetrics = await assertScreenHealthy(assert, page, '#queue', 'Active queue screen', 4000);
    assert.ok(activeQueueMetrics.visibleRows > 0, 'Active queue should render queue rows.');
    await assertNoVisualDefects(assert, page, '#queue', 'Queue screen');
    await captureScreenShot(page, 'queue-after', { selector: '.emulator' });
    await expectText(page, '#queue-summary', '6 tracks queued after now playing');
    await page.waitForTimeout(150);

    const timeupdateMutationState = await page.evaluate(async () => {
        const audio = document.getElementById('audio-engine');
        const queueList = document.getElementById('queue-list');
        const inlineList = document.getElementById('player-inline-queue-list');
        const before = {
            queueRows: queueList?.querySelectorAll('.queue-row').length || 0,
            inlineRows: inlineList?.querySelectorAll('.queue-row').length || 0
        };
        let mutations = 0;
        const observer = new MutationObserver((records) => {
            mutations += records.length;
        });
        if (queueList) observer.observe(queueList, { childList: true, subtree: true, attributes: true });
        if (inlineList) observer.observe(inlineList, { childList: true, subtree: true, attributes: true });
        for (let i = 0; i < 5; i += 1) {
            audio?.dispatchEvent(new Event('timeupdate'));
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        observer.disconnect();
        return {
            before,
            after: {
                queueRows: queueList?.querySelectorAll('.queue-row').length || 0,
                inlineRows: inlineList?.querySelectorAll('.queue-row').length || 0
            },
            mutations
        };
    });
    assert.deepEqual(timeupdateMutationState.after, timeupdateMutationState.before);
    assert.equal(timeupdateMutationState.mutations, 0, 'Timeupdate should not mutate queue DOM.');

    step('Clearing Up Next, checking the end-of-queue state, then undoing the clear without losing queue order.');
    const queueBeforeClear = await page.evaluate(() => window.AuralisApp.getQueueSnapshot());
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

    const restoredQueue = await page.evaluate(() => {
        const undone = window.AuralisApp.undoLastAction();
        const snapshot = window.AuralisApp.getQueueSnapshot();
        return { undone, snapshot };
    });
    assert.equal(restoredQueue.undone, true, 'Clearing Up Next should register an undo action.');
    assert.equal(restoredQueue.snapshot.index, queueBeforeClear.index, 'Undo should restore the active queue index.');
    assert.deepEqual(
        restoredQueue.snapshot.tracks.map((track) => track.title),
        queueBeforeClear.tracks.map((track) => track.title),
        'Undo should restore the queue in the same order.'
    );
    await expectText(page, '#queue-summary', '6 tracks queued after now playing');

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

    step('Reproducing a first-scan metadata refinement where placeholder queue rows must rebound to the refined library tracks and artwork.');
    const placeholderQueueCases = [
        {
            title: '930 May 2',
            path: 'Minutemen/My First Bells (Incomplete)/1 930 May 2.flac',
            artUrl: '/music/Minutemen/My%20First%20Bells%20(Incomplete)/Album%20Art.jpg',
            albumTitle: 'My First Bells (Incomplete)'
        },
        {
            title: 'Afternoons',
            path: 'Minutemen/_Bean-Spill_ E.P_/1 Afternoons.flac',
            artUrl: '/music/Minutemen/_Bean-Spill_%20E.P_/Album%20Art.jpg',
            albumTitle: '_Bean-Spill_ E.P_'
        },
        {
            title: 'Ain\'t Talkin\' \'Bout Love',
            path: 'Minutemen/_Tour-Spiel_ EP/1 Ain\'t Talkin\' \'Bout Love.flac',
            artUrl: '/music/Minutemen/_Tour-Spiel_%20EP/Album%20Art.jpg',
            albumTitle: '_Tour-Spiel_ EP'
        },
        {
            title: 'Anxious Mo-Fo',
            path: 'Minutemen/Double Nickels On The Dime/1 Anxious Mo-Fo.flac',
            artUrl: '/music/Minutemen/Double%20Nickels%20On%20The%20Dime/Album%20Art.jpg',
            albumTitle: 'Double Nickels On The Dime'
        },
        {
            title: 'Base King',
            path: 'Minutemen/The Politics Of Time/1 Base King.flac',
            artUrl: '/music/Minutemen/The%20Politics%20Of%20Time/Album%20Art.jpg',
            albumTitle: 'The Politics Of Time'
        },
        {
            title: 'Bob Dylan Wrote Propaganda Songs',
            path: 'Minutemen/What Makes A Man Start Fires_/1 Bob Dylan Wrote Propaganda Songs.flac',
            artUrl: '/music/Minutemen/What%20Makes%20A%20Man%20Start%20Fires_/Album%20Art.jpg',
            albumTitle: 'What Makes A Man Start Fires_'
        }
    ];
    const placeholderSharedArt = placeholderQueueCases[0].artUrl;

    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);
    await page.evaluate(({ placeholderQueueCases, placeholderSharedArt }) => {
        const placeholderAlbum = {
            id: 'scan:minutemen:first-pass',
            title: 'Unknown Album',
            artist: 'Unknown Artist',
            artUrl: placeholderSharedArt,
            trackCount: placeholderQueueCases.length,
            totalDurationLabel: '8:00',
            tracks: placeholderQueueCases.map((entry, index) => ({
                no: index + 1,
                title: entry.title,
                artist: 'Unknown Artist',
                albumTitle: 'Unknown Album',
                duration: '1:20',
                durationSec: 80,
                ext: 'flac',
                artUrl: placeholderSharedArt,
                fileUrl: `/music/${entry.path.split('/').map(encodeURIComponent).join('/')}`,
                path: entry.path,
                _trackId: `file:${entry.path.toLowerCase()}`,
                _sourceAlbumId: 'scan:minutemen:first-pass',
                _sourceAlbumTitle: 'Unknown Album',
                _metadataQuality: 'guessed',
                _scanned: true,
                _metaDone: false
            }))
        };

        const refinedAlbums = placeholderQueueCases.map((entry, index) => ({
            id: `album:${index}`,
            title: entry.albumTitle,
            artist: 'Minutemen',
            artUrl: entry.artUrl,
            trackCount: 1,
            totalDurationLabel: '1:20',
            tracks: [{
                no: 1,
                title: entry.title,
                artist: 'Minutemen',
                albumTitle: entry.albumTitle,
                duration: '1:20',
                durationSec: 80,
                ext: 'flac',
                artUrl: entry.artUrl,
                fileUrl: `/music/${entry.path.split('/').map(encodeURIComponent).join('/')}`,
                path: entry.path,
                _trackId: `file:${entry.path.toLowerCase()}`,
                _sourceAlbumId: `album:${index}`,
                _sourceAlbumTitle: entry.albumTitle,
                _metadataQuality: 'trusted',
                _scanned: true,
                _metaDone: true
            }]
        }));

        window.AuralisApp._installLibrarySnapshot([placeholderAlbum], {
            force: true,
            renderHome: true,
            renderLibrary: true,
            syncEmpty: true,
            updateHealth: true,
            resetPlayback: true
        });
        window.AuralisApp._installLibrarySnapshot(refinedAlbums, {
            force: true,
            renderHome: true,
            renderLibrary: true,
            syncEmpty: true,
            updateHealth: true
        });
    }, { placeholderQueueCases, placeholderSharedArt });
    await openQueue(page);

    const reboundQueueArt = await page.evaluate(() => Array.from(document.querySelectorAll('#queue-list .queue-row')).map((row) => ({
        title: row.querySelector('h3')?.textContent?.trim() || '',
        backgroundImage: getComputedStyle(row.querySelector('.item-icon')).backgroundImage || ''
    })));

    placeholderQueueCases.forEach((track) => {
        const rendered = reboundQueueArt.find((row) => row.title === track.title);
        assert.ok(rendered, `Expected rebound queue row for ${track.title}.`);
        assert.match(rendered.backgroundImage, new RegExp(track.artUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });

    step('Saving a mixed playlist from those tracks and verifying the persisted playlist payload keeps artwork and stable track identities.');
    const persistedPlaylist = await page.evaluate((tracks) => {
        const playlist = window.AuralisApp.createUserPlaylist('Queue QA Mixed');
        tracks.forEach((track) => window.AuralisApp.addTrackToUserPlaylist(playlist.id, track));
        const stored = JSON.parse(localStorage.getItem('auralis_user_playlists') || '[]');
        return stored.find((entry) => entry.id === playlist.id) || null;
    }, mixedQueueTracks);

    assert.ok(persistedPlaylist, 'Expected the QA playlist to be persisted.');
    assert.equal(persistedPlaylist.tracks.length, mixedQueueTracks.length);
    mixedQueueTracks.forEach((track, index) => {
        const storedTrack = persistedPlaylist.tracks[index];
        assert.equal(storedTrack.title, track.title);
        assert.equal(storedTrack._trackId, track._trackId);
        assert.equal(storedTrack._sourceAlbumId, track._sourceAlbumId);
        assert.equal(storedTrack.artUrl, track.artUrl);
    });
});
