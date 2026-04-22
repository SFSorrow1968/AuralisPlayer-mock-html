import {
    assertScreenHealthy,
    buildFixtureSet,
    clearClientState,
    openSettings,
    reloadApp,
    seedPersistedState,
    withQaSession
} from './shared.mjs';

const initialFixture = await buildFixtureSet([
    'EELS/Electro-Shock Blues',
    'Enya/Watermark'
]);

const rescannedFixture = await buildFixtureSet([
    'EELS/Electro-Shock Blues',
    'Enya/Watermark',
    'Minutemen/The Punch Line'
]);

await withQaSession('qa:folder', async ({ assert, page, step }) => {
    step('Clearing client state and seeding the initial folder fixture.');
    await clearClientState(page);
    await seedPersistedState(page, {
        folders: initialFixture.folders,
        scannedFiles: initialFixture.scannedFiles
    });
    await reloadApp(page);

    step('Opening Settings and checking the indexed folder summary.');
    await openSettings(page);
    await page.waitForSelector('#settings');
    await assertScreenHealthy(assert, page, '#settings', 'Settings screen');

    const initialHeader = (await page.locator('#settings-media-header').textContent()) || '';
    assert.match(initialHeader, /Media Folders \(1\)/);
    assert.match(initialHeader, new RegExp(`${initialFixture.scannedFiles.length} files`));

    const initialFolderCopy = (await page.locator('.settings-folder-item').first().textContent()) || '';
    assert.match(initialFolderCopy, new RegExp(`${initialFixture.scannedFiles.length} audio files`));
    const initialFolderState = await page.evaluate(() => ({
        rows: document.querySelectorAll('.settings-folder-item').length,
        removeLabels: Array.from(document.querySelectorAll('.settings-folder-remove')).map((button) => button.getAttribute('aria-label') || '')
    }));
    assert.equal(initialFolderState.rows, 1);
    assert.ok(initialFolderState.removeLabels.every(Boolean), 'Settings folder remove buttons should have labels.');

    const playbackWarningVisible = await page.locator('#settings-playback-warning').evaluate((element) => {
        return getComputedStyle(element).display !== 'none';
    });
    assert.equal(playbackWarningVisible, true);

    step('Simulating a broader rescan against the Music fixture and reloading the page.');
    await seedPersistedState(page, {
        folders: rescannedFixture.folders,
        scannedFiles: rescannedFixture.scannedFiles
    });
    await reloadApp(page);
    await openSettings(page);
    await assertScreenHealthy(assert, page, '#settings', 'Settings screen after rescan');

    const rescannedHeader = (await page.locator('#settings-media-header').textContent()) || '';
    assert.match(rescannedHeader, /Media Folders \(1\)/);
    assert.match(rescannedHeader, new RegExp(`${rescannedFixture.scannedFiles.length} files`));
    assert.ok(rescannedFixture.scannedFiles.length > initialFixture.scannedFiles.length);
    const rescannedFolderState = await page.evaluate(() => ({
        rows: document.querySelectorAll('.settings-folder-item').length,
        rowText: document.querySelector('.settings-folder-item')?.textContent || ''
    }));
    assert.equal(rescannedFolderState.rows, 1);
    assert.match(rescannedFolderState.rowText, new RegExp(`${rescannedFixture.scannedFiles.length} audio files`));
});
