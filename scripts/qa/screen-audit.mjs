import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import {
    assertNoVisualDefects,
    assertScreenHealthy,
    buildFixtureSet,
    captureScreenShot,
    clearClientState,
    installRichLibrary,
    reloadApp,
    REPO_ROOT,
    seedPersistedState,
    switchToRootScreen,
    withQaSession
} from './shared.mjs';

const outputDir = path.join(REPO_ROOT, 'output', 'playwright', 'screen-fidelity');

const fixture = await buildFixtureSet([
    "da' Skunk Junkies/Mental Masturbation (1998)",
    'EELS/Electro-Shock Blues',
    'Enya/Watermark',
    { dir: 'Minutemen/Miscellaneous', allowedExtensions: ['.mp3'] },
    'Minutemen/Double Nickels On The Dime',
    'Minutemen/The Punch Line',
    'Minutemen/What Makes A Man Start Fires_'
]);

async function waitForAuditScreenSettled(page, screenSelector) {
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
        const screenLike = screen.classList.contains('screen') || screen.classList.contains('player-overlay') || screen.id === 'player';
        const rectArea = Math.max(1, rect.width * rect.height);
        const intersectionLeft = Math.max(rect.left, viewportRect.left, emulatorRect?.left ?? viewportRect.left);
        const intersectionTop = Math.max(rect.top, viewportRect.top, emulatorRect?.top ?? viewportRect.top);
        const intersectionRight = Math.min(rect.right, viewportRect.right, emulatorRect?.right ?? viewportRect.right);
        const intersectionBottom = Math.min(rect.bottom, viewportRect.bottom, emulatorRect?.bottom ?? viewportRect.bottom);
        const intersectionRatio = (Math.max(0, intersectionRight - intersectionLeft) * Math.max(0, intersectionBottom - intersectionTop)) / rectArea;
        const emulatorIntersectionLeft = Math.max(rect.left, emulatorRect?.left ?? viewportRect.left);
        const emulatorIntersectionTop = Math.max(rect.top, emulatorRect?.top ?? viewportRect.top);
        const emulatorIntersectionRight = Math.min(rect.right, emulatorRect?.right ?? viewportRect.right);
        const emulatorIntersectionBottom = Math.min(rect.bottom, emulatorRect?.bottom ?? viewportRect.bottom);
        const emulatorIntersectionRatio = (
            Math.max(0, emulatorIntersectionRight - emulatorIntersectionLeft)
            * Math.max(0, emulatorIntersectionBottom - emulatorIntersectionTop)
        ) / rectArea;
        const condition = (
            style.display !== 'none'
            && style.visibility !== 'hidden'
            && opacityValue >= 0.995
            && rect.width > 0
            && rect.height > 0
            && (!screenLike || screen.classList.contains('active'))
            && (!screenLike || intersectionRatio >= 0.98)
            && (!screenLike || emulatorIntersectionRatio >= 0.98)
        );

        const key = `screen:${selector}`;
        window.__auralisScreenAuditSettle = window.__auralisScreenAuditSettle || {};
        const previous = window.__auralisScreenAuditSettle[key];
        const sample = {
            opacityValue,
            intersectionRatio,
            emulatorIntersectionRatio,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            count: 0
        };

        if (!condition) {
            window.__auralisScreenAuditSettle[key] = sample;
            return false;
        }

        const stable = previous
            && Math.abs(previous.opacityValue - opacityValue) < 0.001
            && Math.abs(previous.intersectionRatio - intersectionRatio) < 0.001
            && Math.abs(previous.emulatorIntersectionRatio - emulatorIntersectionRatio) < 0.001
            && Math.abs(previous.top - rect.top) < 0.5
            && Math.abs(previous.left - rect.left) < 0.5
            && Math.abs(previous.width - rect.width) < 0.5
            && Math.abs(previous.height - rect.height) < 0.5;

        sample.count = stable ? (previous.count || 0) + 1 : 1;
        window.__auralisScreenAuditSettle[key] = sample;
        return sample.count >= 2;
    }, screenSelector, { polling: 'raf', timeout: 2500 });
}

async function mockAudioEngine(page) {
    await page.evaluate(() => {
        const audio = document.getElementById('audio-engine');
        if (!audio) return;

        let qaPaused = true;
        let qaCurrentTime = 24;
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

        audio.load = () => audio.dispatchEvent(new Event('loadedmetadata'));
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
}

async function captureAuditScreen(assert, page, summary, name, screenSelector, label) {
    const screenshotSelector = '.emulator';
    await page.waitForSelector(screenSelector);
    await waitForAuditScreenSettled(page, screenSelector);
    const metrics = await assertScreenHealthy(assert, page, screenSelector, label);
    await assertNoVisualDefects(assert, page, screenSelector, label);
    const screenshot = await captureScreenShot(page, name, { outputDir, selector: screenshotSelector });
    summary.screens.push({
        name,
        label,
        screenSelector,
        screenshotSelector,
        screenshot,
        metrics
    });
}

async function openLibraryTab(page, tab) {
    await switchToRootScreen(page, 'library');
    await page.locator(`#lib-btn-${tab}`).click();
    await page.waitForFunction((viewId) => {
        const view = document.getElementById(viewId);
        return Boolean(view && getComputedStyle(view).display !== 'none');
    }, `lib-view-${tab}`);
}

async function createAuditPlaylist(page) {
    return page.evaluate(() => {
        const library = window.AuralisApp._getLibrary();
        const playlist = window.AuralisApp.createUserPlaylist('Screen Audit Playlist Detail That Exercises A Much Longer Header Treatment');
        library.tracks.slice(0, 3).forEach((track) => window.AuralisApp.addTrackToUserPlaylist(playlist.id, track));
        window.AuralisApp._applyBackendPayload({ userState: window.AuralisApp._exportBackendPayload().userState });
        return playlist.name;
    });
}

await withQaSession('qa:screens', async ({ assert, page, step }) => {
    const networkErrors = [];
    const summary = {
        generatedAt: new Date().toISOString(),
        screens: []
    };

    page.on('response', (response) => {
        const url = response.url();
        if (response.status() >= 400 && !url.endsWith('/favicon.ico')) {
            networkErrors.push(`${response.status()} ${response.request().method()} ${url}`);
        }
    });

    step('Installing fixture library for screen fidelity capture.');
    await clearClientState(page);
    await seedPersistedState(page, fixture);
    await reloadApp(page);
    await mockAudioEngine(page);
    await installRichLibrary(page, fixture.albums);

    step('Capturing Home.');
    await switchToRootScreen(page, 'home');
    await page.waitForSelector('#home-sections-root .home-section, #home-sections-root .zenith-section');
    await captureAuditScreen(assert, page, summary, 'home', '#home', 'Home screen');

    step('Capturing Search browse and results.');
    await switchToRootScreen(page, 'search');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('search-browse')).display !== 'none');
    await captureAuditScreen(assert, page, summary, 'search-browse', '#search', 'Search browse screen');
    await page.fill('#search-input', 'shock');
    await page.waitForFunction(() => {
        const results = document.getElementById('search-results');
        return Boolean(results && getComputedStyle(results).display !== 'none' && results.textContent.includes('Electro-Shock Blues'));
    });
    await captureAuditScreen(assert, page, summary, 'search-results', '#search', 'Search results screen');

    step('Capturing Library tabs.');
    for (const tab of ['playlists', 'albums', 'artists', 'songs', 'genres', 'folders']) {
        await openLibraryTab(page, tab);
        await captureAuditScreen(assert, page, summary, `library-${tab}`, '#library', `Library ${tab} tab`);
    }

    step('Capturing playlist detail, album detail, and artist profile.');
    const auditPlaylistName = await createAuditPlaylist(page);
    await openLibraryTab(page, 'playlists');
    await page.locator('#lib-playlists-list .item-clickable', { hasText: auditPlaylistName }).click();
    await page.waitForFunction(() => document.getElementById('playlist_detail')?.classList.contains('active'));
    await captureAuditScreen(assert, page, summary, 'playlist-detail', '#playlist_detail', 'Playlist detail');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    await openLibraryTab(page, 'albums');
    await page.locator('#lib-albums-grid .media-card, #lib-albums-grid .zenith-media-card').first().click();
    await page.waitForFunction(() => document.getElementById('album_detail')?.classList.contains('active'));
    await captureAuditScreen(assert, page, summary, 'album-detail', '#album_detail', 'Album detail');
    await page.evaluate(() => window.AuralisApp.back());
    await page.waitForFunction(() => document.getElementById('library')?.classList.contains('active'));

    await openLibraryTab(page, 'artists');
    await page.locator('#lib-artists-list .item-clickable').first().click();
    await page.waitForFunction(() => document.getElementById('artist_profile')?.classList.contains('active'));
    await captureAuditScreen(assert, page, summary, 'artist-profile', '#artist_profile', 'Artist profile');

    step('Capturing full player with its inline queue.');
    await page.evaluate((album) => {
        window.AuralisApp.playAlbumInOrder(album.title, 0, album.artist);
        window.AuralisApp.toggleOverlay('player');
    }, fixture.albums[0]);
    await page.waitForFunction(() => document.getElementById('player')?.classList.contains('active'));
    await page.waitForFunction(() => document.querySelectorAll('#player-inline-queue-list .queue-row').length > 0);
    await captureAuditScreen(assert, page, summary, 'full-player', '#player', 'Full player');
    await page.evaluate(() => window.AuralisApp.toggleOverlay('player'));
    await page.waitForFunction(() => !document.getElementById('player')?.classList.contains('active'));

    step('Capturing Settings and writing audit summary.');
    await page.evaluate(() => window.AuralisApp.navigate('settings'));
    await page.waitForFunction(() => document.getElementById('settings')?.classList.contains('active'));
    await captureAuditScreen(assert, page, summary, 'settings', '#settings', 'Settings screen');

    assert.deepEqual(networkErrors, []);
    await mkdir(outputDir, { recursive: true });
    await writeFile(
        path.join(outputDir, 'audit-summary.json'),
        `${JSON.stringify(summary, null, 2)}\n`,
        'utf8'
    );
});
