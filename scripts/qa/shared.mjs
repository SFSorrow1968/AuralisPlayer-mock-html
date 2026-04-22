import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { createAuralisServer } from '../../server/app.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const MUSIC_ROOT = path.join(REPO_ROOT, 'Music');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const IMAGE_PRIORITY = ['album art', 'cover', 'folder', 'front'];
const MIME_TYPES = {
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4'
};

const IDB_NAME = 'auralis_media_db';
const IDB_VERSION = 3;
const LIBRARY_CACHE_SCHEMA_VERSION = 4;
const STORAGE_VERSION = '20260419-runtime-refactor-v1';

export async function collectScreenMetrics(page, screenSelector) {
    return page.locator(screenSelector).evaluate((screen) => {
        const rect = screen.getBoundingClientRect();
        const style = getComputedStyle(screen);
        const opacityValue = Number.parseFloat(style.opacity || '1');
        const emulator = screen.closest('.emulator');
        const emulatorRect = emulator?.getBoundingClientRect();
        const viewportRect = {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight
        };
        const screenLike = screen.classList.contains('screen') || screen.classList.contains('player-overlay');
        const activeClassRequired = screenLike;
        const hasActiveClass = screen.classList.contains('active');
        const intersectionLeft = Math.max(rect.left, viewportRect.left, emulatorRect?.left ?? viewportRect.left);
        const intersectionTop = Math.max(rect.top, viewportRect.top, emulatorRect?.top ?? viewportRect.top);
        const intersectionRight = Math.min(rect.right, viewportRect.right, emulatorRect?.right ?? viewportRect.right);
        const intersectionBottom = Math.min(rect.bottom, viewportRect.bottom, emulatorRect?.bottom ?? viewportRect.bottom);
        const intersectionWidth = Math.max(0, intersectionRight - intersectionLeft);
        const intersectionHeight = Math.max(0, intersectionBottom - intersectionTop);
        const visible = (
            style.display !== 'none'
            && style.visibility !== 'hidden'
            && opacityValue >= 0.95
            && rect.width > 0
            && rect.height > 0
            && intersectionWidth > 120
            && intersectionHeight > 120
            && (!activeClassRequired || hasActiveClass)
        );
        const visibleRows = Array.from(screen.querySelectorAll('.list-item, .album-track-row, .queue-row, .zenith-media-card, .media-card, .song-preview-card, .compact-song-item, .zenith-song-rail-item'))
            .filter((node) => {
                const nodeRect = node.getBoundingClientRect();
                return nodeRect.width > 0 && nodeRect.height > 0;
            }).length;
        const duplicateIds = Object.entries(
            Array.from(screen.querySelectorAll('[id]')).reduce((acc, node) => {
                acc[node.id] = (acc[node.id] || 0) + 1;
                return acc;
            }, {})
        ).filter(([, count]) => count > 1).map(([id]) => id);
        return {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            bottom: rect.bottom,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            opacityValue,
            hasActiveClass,
            activeClassRequired,
            visible,
            viewportIntersection: {
                width: intersectionWidth,
                height: intersectionHeight
            },
            visibleRows,
            duplicateIds,
            scrollHeight: screen.scrollHeight,
            clientHeight: screen.clientHeight
        };
    });
}

export async function assertScreenHealthy(assert, page, screenSelector, label) {
    await page.waitForFunction((selector) => {
        const screen = document.querySelector(selector);
        if (!screen) return false;
        const rect = screen.getBoundingClientRect();
        const style = getComputedStyle(screen);
        const opacityValue = Number.parseFloat(style.opacity || '1');
        const emulator = screen.closest('.emulator');
        const emulatorRect = emulator?.getBoundingClientRect();
        const viewportRect = {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight
        };
        const screenLike = screen.classList.contains('screen') || screen.classList.contains('player-overlay');
        const intersectionLeft = Math.max(rect.left, viewportRect.left, emulatorRect?.left ?? viewportRect.left);
        const intersectionTop = Math.max(rect.top, viewportRect.top, emulatorRect?.top ?? viewportRect.top);
        const intersectionRight = Math.min(rect.right, viewportRect.right, emulatorRect?.right ?? viewportRect.right);
        const intersectionBottom = Math.min(rect.bottom, viewportRect.bottom, emulatorRect?.bottom ?? viewportRect.bottom);
        return (
            style.display !== 'none'
            && style.visibility !== 'hidden'
            && opacityValue >= 0.95
            && rect.width > 0
            && rect.height > 0
            && Math.max(0, intersectionRight - intersectionLeft) > 120
            && Math.max(0, intersectionBottom - intersectionTop) > 120
            && (!screenLike || screen.classList.contains('active'))
        );
    }, screenSelector, { timeout: 1200 });
    const metrics = await collectScreenMetrics(page, screenSelector);
    assert.ok(metrics.width > 300, `${label} should have a usable width.`);
    assert.ok(metrics.height > 300, `${label} should have a usable height.`);
    assert.notEqual(metrics.display, 'none', `${label} should not be display:none.`);
    assert.notEqual(metrics.visibility, 'hidden', `${label} should not be visibility:hidden.`);
    assert.ok(metrics.opacityValue >= 0.95, `${label} should be fully visible.`);
    assert.ok(metrics.viewportIntersection.width > 120, `${label} should intersect the emulator viewport horizontally.`);
    assert.ok(metrics.viewportIntersection.height > 120, `${label} should intersect the emulator viewport vertically.`);
    if (metrics.activeClassRequired) {
        assert.equal(metrics.hasActiveClass, true, `${label} should be the active screen or overlay.`);
    }
    assert.equal(metrics.visible, true, `${label} should be visible and active in the emulator viewport.`);
    assert.deepEqual(metrics.duplicateIds, [], `${label} should not render duplicate ids.`);
    return metrics;
}

export async function captureScreenShot(page, name, options = {}) {
    const outputDir = options.outputDir || path.join(REPO_ROOT, 'output', 'playwright', 'screen-fidelity');
    await mkdir(outputDir, { recursive: true });
    const target = options.selector ? page.locator(options.selector) : page.locator('.emulator');
    const filePath = path.join(outputDir, `${name}.png`);
    await target.screenshot({ path: filePath, animations: 'disabled' });
    return filePath;
}

export async function collectVisualDefects(page, screenSelector) {
    return page.locator(screenSelector).evaluate((screen) => {
        const screenRect = screen.getBoundingClientRect();
        const defects = [];
        const nodes = Array.from(screen.querySelectorAll('button, input, .filter-chip, .list-item, .media-card, .zenith-media-card, .album-track-row, .queue-row, h1, h2, h3, p, span'));

        function hasScrollableHorizontalAncestor(node) {
            let current = node.parentElement;
            while (current && current !== screen) {
                const style = getComputedStyle(current);
                const overflowX = style.overflowX || style.overflow;
                if (['auto', 'scroll', 'hidden'].includes(overflowX) && current.scrollWidth > current.clientWidth + 2) {
                    return true;
                }
                current = current.parentElement;
            }
            return false;
        }

        for (const node of nodes) {
            const rect = node.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            const style = getComputedStyle(node);
            if ((rect.right > screenRect.right + 2 || rect.left < screenRect.left - 2) && !hasScrollableHorizontalAncestor(node)) {
                defects.push({ type: 'horizontal-overflow', text: node.textContent.trim().slice(0, 80), className: node.className || '', id: node.id || '' });
            }
            if (style.visibility !== 'hidden' && style.display !== 'none' && node.scrollWidth > node.clientWidth + 2 && style.overflow === 'visible') {
                defects.push({ type: 'text-overflow', text: node.textContent.trim().slice(0, 80), className: node.className || '', id: node.id || '' });
            }
        }
        return defects;
    });
}

export async function assertNoVisualDefects(assert, page, screenSelector, label) {
    const defects = await collectVisualDefects(page, screenSelector);
    assert.deepEqual(defects, [], `${label} should not have obvious overflow defects.`);
}

function toDurationLabel(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function parseTrackFilename(filename) {
    const base = filename.replace(/\.[^.]+$/, '');
    const numberedMatch = base.match(/^(\d{1,3})[\s.\-_]+(.+)$/);
    if (numberedMatch) {
        return {
            no: Number(numberedMatch[1]),
            title: numberedMatch[2].trim()
        };
    }

    const dashedMatch = base.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashedMatch) {
        return {
            no: 0,
            title: dashedMatch[2].trim()
        };
    }

    return {
        no: 0,
        title: base.trim()
    };
}

function extractYear(text) {
    const match = String(text || '').match(/(?:\(|\[)?((?:19|20)\d{2})(?:\)|\])?/);
    return match ? match[1] : '';
}

function encodeMusicUrl(relativePath) {
    return `/music/${relativePath.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
}

function createFileDescriptor(relativePath, folderId) {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const segments = normalizedPath.split('/');
    const name = segments.at(-1) || '';
    return {
        name,
        folderId,
        path: normalizedPath,
        subDir: segments.slice(0, -1).join('/')
    };
}

async function pickAlbumArt(relativeAlbumDir) {
    const absoluteAlbumDir = path.join(MUSIC_ROOT, relativeAlbumDir);
    const entries = await readdir(absoluteAlbumDir, { withFileTypes: true });
    const imageEntries = entries
        .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .sort((left, right) => {
            const leftName = left.name.toLowerCase();
            const rightName = right.name.toLowerCase();
            const leftIndex = IMAGE_PRIORITY.findIndex((token) => leftName.includes(token));
            const rightIndex = IMAGE_PRIORITY.findIndex((token) => rightName.includes(token));
            const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
            const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
            return safeLeft - safeRight || leftName.localeCompare(rightName);
        });

    if (!imageEntries.length) return '';
    return encodeMusicUrl(`${relativeAlbumDir}/${imageEntries[0].name}`);
}

async function buildAlbumFromSpec(spec, folderId) {
    const relativeAlbumDir = String(spec.dir || '').replace(/\\/g, '/');
    if (!relativeAlbumDir) {
        throw new Error('Fixture spec is missing a dir value.');
    }

    const absoluteAlbumDir = path.join(MUSIC_ROOT, relativeAlbumDir);
    const albumEntries = await readdir(absoluteAlbumDir, { withFileTypes: true });
    const allowedExtensions = spec.allowedExtensions
        ? new Set(spec.allowedExtensions.map((ext) => ext.toLowerCase()))
        : AUDIO_EXTENSIONS;

    const trackEntries = albumEntries
        .filter((entry) => entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase()))
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (!trackEntries.length) {
        throw new Error(`No supported audio files matched ${relativeAlbumDir}.`);
    }

    const [artistDir, ...albumParts] = relativeAlbumDir.split('/');
    const artist = spec.artist || artistDir || 'Unknown Artist';
    const albumTitle = spec.albumTitle || albumParts.join('/') || artistDir || 'Unknown Album';
    const year = spec.year || extractYear(albumTitle) || extractYear(relativeAlbumDir);
    const artUrl = await pickAlbumArt(relativeAlbumDir);

    const tracks = [];
    const scannedFiles = [];

    for (const [index, entry] of trackEntries.entries()) {
        const relativePath = `${relativeAlbumDir}/${entry.name}`;
        const absoluteTrackPath = path.join(MUSIC_ROOT, relativePath);
        const fileStat = await stat(absoluteTrackPath);
        const parsed = parseTrackFilename(entry.name);
        const ext = path.extname(entry.name).toLowerCase();
        const durationSec = spec.durationBase
            ? spec.durationBase + (index * 9)
            : 150 + (index * 11);

        tracks.push({
            no: parsed.no || index + 1,
            title: parsed.title || entry.name.replace(ext, ''),
            artist,
            albumArtist: artist,
            albumTitle,
            year,
            genre: spec.genre || '',
            duration: toDurationLabel(durationSec),
            durationSec,
            ext: ext.slice(1),
            artUrl,
            fileUrl: encodeMusicUrl(relativePath),
            path: relativePath,
            _trackId: `fixture:${relativePath.toLowerCase()}`,
            _sourceAlbumId: `fixture:${relativeAlbumDir.toLowerCase()}`,
            _sourceAlbumTitle: albumTitle,
            _embeddedAlbumTitle: albumTitle,
            _fileSize: fileStat.size,
            _lastModified: Math.floor(fileStat.mtimeMs),
            _metadataSource: 'fixture',
            _metadataQuality: 'trusted',
            _scanned: true,
            _metaDone: true
        });

        scannedFiles.push({
            ...createFileDescriptor(relativePath, folderId),
            size: fileStat.size,
            type: MIME_TYPES[ext] || 'application/octet-stream',
            lastModified: Math.floor(fileStat.mtimeMs)
        });
    }

    const totalDuration = tracks.reduce((sum, track) => sum + Number(track.durationSec || 0), 0);

    return {
        album: {
            id: `fixture:${relativeAlbumDir.toLowerCase()}`,
            title: albumTitle,
            artist,
            albumArtist: artist,
            year,
            genre: spec.genre || '',
            artUrl,
            trackCount: tracks.length,
            totalDurationLabel: toDurationLabel(totalDuration),
            tracks,
            _sourceAlbumId: `fixture:${relativeAlbumDir.toLowerCase()}`,
            _sourceAlbumTitle: albumTitle,
            _scanned: true,
            _metaDone: true
        },
        scannedFiles
    };
}

export async function buildFixtureSet(specs, options = {}) {
    const folderId = options.folderId || 'qa-fixture-music';
    const folderName = options.folderName || 'Music';
    const folders = [{
        id: folderId,
        name: folderName,
        handle: null,
        fileCount: 0,
        lastScanned: Date.now()
    }];

    const albums = [];
    const scannedFiles = [];

    for (const spec of specs) {
        const result = await buildAlbumFromSpec(typeof spec === 'string' ? { dir: spec } : spec, folderId);
        albums.push(result.album);
        scannedFiles.push(...result.scannedFiles);
    }

    folders[0].fileCount = scannedFiles.length;

    return {
        folders,
        scannedFiles,
        albums,
        libraryCache: {
            schema: LIBRARY_CACHE_SCHEMA_VERSION,
            albums: albums.map((album) => ({
                _cacheSchema: LIBRARY_CACHE_SCHEMA_VERSION,
                id: album.id,
                title: album.title,
                artist: album.artist,
                year: album.year,
                genre: album.genre,
                trackCount: album.trackCount,
                totalDurationLabel: album.totalDurationLabel,
                _sourceAlbumId: album._sourceAlbumId,
                _sourceAlbumTitle: album._sourceAlbumTitle,
                tracks: album.tracks.map((track) => ({
                    no: track.no,
                    title: track.title,
                    artist: track.artist,
                    albumTitle: track.albumTitle,
                    year: track.year,
                    genre: track.genre,
                    duration: track.duration,
                    durationSec: track.durationSec,
                    ext: track.ext,
                    discNo: 0,
                    albumArtist: track.albumArtist,
                    _handleKey: '',
                    _trackId: track._trackId,
                    _sourceAlbumId: track._sourceAlbumId,
                    _sourceAlbumTitle: track._sourceAlbumTitle,
                    _embeddedAlbumTitle: track._embeddedAlbumTitle,
                    _fileSize: track._fileSize,
                    _lastModified: track._lastModified,
                    _metadataSource: track._metadataSource,
                    _metadataQuality: track._metadataQuality,
                    _scanned: true,
                    _metaDone: true
                }))
            }))
        }
    };
}

export async function withQaSession(name, callback) {
    const backend = createAuralisServer({
        port: 0,
        quiet: true,
        rootDir: REPO_ROOT
    });
    const { origin } = await backend.start();

    const browser = await chromium.launch({
        headless: process.env.HEADFUL !== '1'
    });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 }
    });
    const page = await context.newPage();

    page.on('console', (message) => {
        if (message.type() === 'error') {
            console.error(`[browser] ${message.text()}`);
        }
    });

    let completed = false;
    try {
        await page.goto(`${origin}/Auralis_mock_zenith.html`, { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);
        await callback({
            assert,
            origin,
            page,
            step: (text) => console.log(`[${name}] ${text}`)
        });
        completed = true;
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
        await backend.stop().catch(() => {});
        if (completed) {
            console.log(`[${name}] PASS`);
        }
    }
}

export async function waitForAppReady(page) {
    await page.waitForFunction(() => Boolean(window.AuralisApp && document.getElementById('player-main-toggle')));
}

export async function waitForInteractiveUi(page) {
    await page.waitForFunction(() => {
        const overlays = [
            document.getElementById('onboarding'),
            document.getElementById('first-time-setup')
        ].filter(Boolean);

        return overlays.every((overlay) => {
            const style = getComputedStyle(overlay);
            return style.display === 'none' || !overlay.classList.contains('active');
        });
    });
}

export async function dismissBlockingOverlays(page) {
    await page.evaluate(() => {
        ['onboarding', 'first-time-setup'].forEach((id) => {
            const element = document.getElementById(id);
            if (!element) return;
            element.classList.remove('active');
            element.style.display = 'none';
        });
    });
}

export async function clearClientState(page) {
    await page.evaluate(async ({ idbName, idbVersion }) => {
        localStorage.clear();
        sessionStorage.clear();

        await new Promise((resolve, reject) => {
            const request = indexedDB.open(idbName, idbVersion);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = () => {};
            request.onsuccess = () => {
                const db = request.result;
                const storeNames = Array.from(db.objectStoreNames);
                if (!storeNames.length) {
                    db.close();
                    resolve();
                    return;
                }

                const tx = db.transaction(storeNames, 'readwrite');
                storeNames.forEach((storeName) => tx.objectStore(storeName).clear());
                tx.oncomplete = () => {
                    db.close();
                    resolve();
                };
                tx.onerror = () => {
                    db.close();
                    reject(tx.error);
                };
            };
        });
    }, {
        idbName: IDB_NAME,
        idbVersion: IDB_VERSION
    });
}

export async function seedPersistedState(page, { folders = [], scannedFiles = [], libraryCache = null, localStorageEntries = {} } = {}) {
    await page.evaluate(async ({ idbName, idbVersion, storageVersion, folders, scannedFiles, libraryCache, localStorageEntries }) => {
        const serialise = (value) => typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.clear();
        sessionStorage.clear();

        localStorage.setItem('auralis_storage_version', storageVersion);
        localStorage.setItem('auralis_onboarded', '1');
        localStorage.setItem('auralis_setup_done', '1');

        if (libraryCache) {
            localStorage.setItem('auralis_library_cache_v2', JSON.stringify(libraryCache));
        }

        Object.entries(localStorageEntries).forEach(([key, value]) => {
            localStorage.setItem(key, serialise(value));
        });

        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(idbName, idbVersion);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = () => {};
            request.onsuccess = () => resolve(request.result);
        });

        const storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length) {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(storeNames, 'readwrite');
                storeNames.forEach((storeName) => tx.objectStore(storeName).clear());
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        if (folders.length) {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(['folders'], 'readwrite');
                const store = tx.objectStore('folders');
                folders.forEach((folder) => store.put(folder));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        if (scannedFiles.length) {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(['scanned_files'], 'readwrite');
                const store = tx.objectStore('scanned_files');
                scannedFiles.forEach((file) => store.put(file));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        db.close();
    }, {
        idbName: IDB_NAME,
        idbVersion: IDB_VERSION,
        storageVersion: STORAGE_VERSION,
        folders,
        scannedFiles,
        libraryCache,
        localStorageEntries
    });
}

export async function reloadApp(page) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await waitForInteractiveUi(page);
    await dismissBlockingOverlays(page);
}

export async function installRichLibrary(page, albums, options = {}) {
    await page.evaluate(({ albums, options }) => {
        localStorage.setItem('auralis_onboarded', '1');
        localStorage.setItem('auralis_setup_done', '1');
        window.AuralisApp._installLibrarySnapshot(albums, {
            force: true,
            renderHome: true,
            renderLibrary: true,
            syncEmpty: true,
            updateHealth: true,
            resetPlayback: true,
            ...options
        });
    }, { albums, options });
}

export async function playTrackFromSnapshot(page, track) {
    await page.evaluate((targetTrack) => {
        window.AuralisApp.playTrack(targetTrack.title, targetTrack.artist, targetTrack.albumTitle);
    }, track);
}

export async function switchToRootScreen(page, screenId) {
    await page.evaluate((nextScreenId) => {
        window.AuralisApp.switchTab(nextScreenId);
    }, screenId);
}

export async function openSettings(page) {
    await page.evaluate(() => {
        window.AuralisApp.navigate('settings');
    });
}

export async function returnFromSettings(page) {
    await page.evaluate(() => {
        window.AuralisApp.back();
    });
}

export async function expectText(page, selector, expectedText) {
    await page.waitForFunction(({ selector, expectedText }) => {
        const element = document.querySelector(selector);
        return element && element.textContent && element.textContent.includes(expectedText);
    }, { selector, expectedText });
}

export async function expectStyleContains(page, selector, property, expectedText) {
    await page.waitForFunction(({ selector, property, expectedText }) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const value = getComputedStyle(element)[property] || '';
        return value.includes(expectedText);
    }, { selector, property, expectedText });
}
