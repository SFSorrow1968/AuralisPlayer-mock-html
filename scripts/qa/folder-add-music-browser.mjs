import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';

import {
    assertNoVisualDefects,
    assertScreenHealthy,
    clearClientState,
    MUSIC_ROOT,
    reloadApp,
    withQaSession
} from './shared.mjs';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.opus', '.aac', '.m4a', '.wma', '.aiff', '.alac', '.ape', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function mimeFromExtension(extension) {
    if (extension === '.flac') return 'audio/flac';
    if (extension === '.mp3') return 'audio/mpeg';
    if (extension === '.m4a') return 'audio/mp4';
    if (extension === '.wav') return 'audio/wav';
    if (extension === '.ogg') return 'audio/ogg';
    if (extension === '.opus') return 'audio/opus';
    if (extension === '.png') return 'image/png';
    if (extension === '.webp') return 'image/webp';
    if (extension === '.gif') return 'image/gif';
    if (extension === '.bmp') return 'image/bmp';
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    return 'application/octet-stream';
}

async function buildHandleTree(absoluteDir) {
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    const children = [];
    let audioCount = 0;

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))) {
        const absolutePath = path.join(absoluteDir, entry.name);
        if (entry.isDirectory()) {
            const child = await buildHandleTree(absolutePath);
            if (child.audioCount > 0 || child.children.length > 0) {
                children.push({
                    kind: 'directory',
                    name: entry.name,
                    children: child.children
                });
                audioCount += child.audioCount;
            }
            continue;
        }

        if (!entry.isFile()) continue;
        const extension = path.extname(entry.name).toLowerCase();
        if (!AUDIO_EXTENSIONS.has(extension) && !IMAGE_EXTENSIONS.has(extension)) continue;

        const fileStat = await stat(absolutePath);
        children.push({
            kind: 'file',
            name: entry.name,
            lastModified: Math.floor(fileStat.mtimeMs),
            mime: mimeFromExtension(extension),
            size: fileStat.size
        });
        if (AUDIO_EXTENSIONS.has(extension)) audioCount++;
    }

    return { children, audioCount };
}

const musicTree = await buildHandleTree(MUSIC_ROOT);

await withQaSession('qa:folder-add-music-browser', async ({ assert, page, step }) => {
    step(`Preparing a browser folder-picker handle for the repo Music folder (${musicTree.audioCount} tracks).`);
    await clearClientState(page);
    await reloadApp(page);

    await page.evaluate(({ musicTree }) => {
        const makeFile = (entry) => {
            const byteLength = Math.max(1, Math.min(Number(entry.size || 1), 16));
            const bytes = new Uint8Array(byteLength);
            return new File([bytes], entry.name, {
                type: entry.mime || 'application/octet-stream',
                lastModified: Number(entry.lastModified || Date.now())
            });
        };

        const makeHandle = (node) => {
            if (node.kind === 'file') {
                return {
                    kind: 'file',
                    name: node.name,
                    getFile: async () => makeFile(node)
                };
            }
            const handle = {
                kind: 'directory',
                name: node.name,
                queryPermission: async () => 'prompt',
                requestPermission: async () => 'granted',
                isSameEntry: async (other) => other === handle,
                values: async function* values() {
                    for (const child of node.children || []) {
                        yield makeHandle(child);
                    }
                }
            };
            return handle;
        };

        window.showDirectoryPicker = async () => makeHandle({
            kind: 'directory',
            name: 'Music',
            children: musicTree.children
        });
    }, { musicTree });

    step('Opening the first-run folder setup and selecting the Music folder.');
    await page.locator('#home-empty-state [data-action="openMediaFolderSetup"]').click();
    await page.waitForSelector('#first-time-setup.active');
    await page.locator('#setup-add-folder-btn').click();
    await page.waitForFunction((expectedCount) => {
        const row = document.querySelector('#setup-folder-list .setup-folder-item');
        return row && row.textContent?.includes('Music') && row.textContent?.includes(`${expectedCount} audio files`);
    }, musicTree.audioCount);

    step('Completing Scan Selected and checking that the library is populated.');
    await page.locator('#setup-confirm-btn').click();
    await page.waitForFunction((expectedCount) => {
        const library = window.AuralisApp?._getLibrary?.();
        return Array.isArray(library?.tracks) && library.tracks.length === expectedCount;
    }, musicTree.audioCount, { timeout: 15000 });
    await page.waitForFunction(() => {
        const setup = document.getElementById('first-time-setup');
        return setup && !setup.classList.contains('active');
    }, { timeout: 5000 });

    const result = await page.evaluate(() => {
        const library = window.AuralisApp._getLibrary();
        return {
            albums: library.albums.length,
            tracks: library.tracks.length,
            artists: library.artists.length,
            setupVisible: document.getElementById('first-time-setup')?.classList.contains('active') || false,
            homeEmptyVisible: getComputedStyle(document.getElementById('home-empty-state')).display !== 'none'
        };
    });

    assert.equal(result.tracks, musicTree.audioCount);
    assert.ok(result.albums > 1, 'The Music folder should produce multiple album groups.');
    assert.ok(result.artists > 0, 'The Music folder should produce at least one artist.');
    assert.equal(result.setupVisible, false, 'The first-run setup should close after scan.');
    assert.equal(result.homeEmptyVisible, false, 'Home should no longer show the no-music empty state.');

    await assertScreenHealthy(assert, page, '#home', 'Home after Music import');
    await assertNoVisualDefects(assert, page, '#home', 'Home after Music import');
});
