import {
    assertNoVisualDefects,
    assertScreenHealthy,
    clearClientState,
    openSettings,
    reloadApp,
    withQaSession
} from './shared.mjs';

async function openLibrarySettingsPanel(page) {
    await page.locator('[data-action="openSettingsPanel"][data-settings-panel="library"]').click();
    await page.waitForFunction(() => {
        const settings = document.getElementById('settings');
        const panel = document.querySelector('.settings-detail-panel[data-settings-panel="library"]');
        return settings?.dataset.settingsPanel === 'library' && panel && !panel.hidden;
    });
}

await withQaSession('qa:folder-add-browser', async ({ assert, page, step }) => {
    step('Clearing state and opening the Settings media-folder panel.');
    await clearClientState(page);
    await reloadApp(page);
    await openSettings(page);
    await openLibrarySettingsPanel(page);

    step('Installing a browser-native folder picker mock with audio files.');
    await page.evaluate(() => {
        const files = [
            new File(['mock audio'], '01 Browser Added Track.flac', { type: 'audio/flac', lastModified: 1713820000000 }),
            new File(['mock audio'], '02 Browser Added Track.flac', { type: 'audio/flac', lastModified: 1713820001000 }),
            new File(['mock cover'], 'cover.jpg', { type: 'image/jpeg', lastModified: 1713820002000 })
        ];
        const entries = files.map((file) => ({
            kind: 'file',
            name: file.name,
            getFile: async () => file
        }));
        const handle = {
            kind: 'directory',
            name: 'Browser Music',
            queryPermission: async () => 'prompt',
            requestPermission: async () => 'granted',
            isSameEntry: async (other) => other === handle,
            values: async function* values() {
                for (const entry of entries) yield entry;
            }
        };
        window.showDirectoryPicker = async () => handle;
    });

    step('Clicking Add Folder and waiting for the selected folder to scan into the library.');
    await page.locator('.settings-add-folder').click();
    await page.waitForFunction(() => {
        const row = document.querySelector('.settings-folder-item');
        return row && /Browser Music/.test(row.textContent || '') && /2 audio files/.test(row.textContent || '');
    });
    await page.waitForFunction(() => {
        const library = window.AuralisApp?._getLibrary?.();
        return Array.isArray(library?.tracks) && library.tracks.length === 2;
    });

    await assertScreenHealthy(assert, page, '#settings', 'Settings after browser folder add');
    await assertNoVisualDefects(assert, page, '#settings', 'Settings after browser folder add');

    const state = await page.evaluate(() => ({
        folderRows: document.querySelectorAll('.settings-folder-item').length,
        folderText: document.querySelector('.settings-folder-item')?.textContent || '',
        header: document.getElementById('settings-media-header')?.textContent || '',
        songCount: window.AuralisApp?._getLibrary?.().tracks?.length || 0
    }));

    assert.equal(state.folderRows, 1);
    assert.match(state.folderText, /Browser Music/);
    assert.match(state.folderText, /2 audio files/);
    assert.match(state.header, /Media Folders \(1\).*2 files/);
    assert.equal(state.songCount, 2, 'The browser-added folder should merge tracks into the visible library state.');
});
