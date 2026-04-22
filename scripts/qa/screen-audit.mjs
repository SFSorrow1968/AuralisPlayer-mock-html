import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import {
    assertNoVisualDefects,
    assertScreenHealthy,
    buildFixtureSet,
    captureScreenShot,
    clearClientState,
    installRichLibrary,
    playTrackFromSnapshot,
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

const playableTrack = fixture.albums
    .flatMap((album) => album.tracks)
    .find((track) => track.ext === 'mp3') || fixture.albums[0].tracks[0];

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
        await page.waitForTimeout(100);
        await captureAuditScreen(assert, page, summary, `library-${tab}`, '#library', `Library ${tab} tab`);
    }

    step('Capturing album detail and artist profile.');
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

    step('Capturing full player and Queue.');
    await playTrackFromSnapshot(page, playableTrack);
    await page.evaluate(() => window.AuralisApp.toggleOverlay('player'));
    await page.waitForFunction(() => document.getElementById('player')?.classList.contains('active'));
    await captureAuditScreen(assert, page, summary, 'full-player', '#player', 'Full player');
    await page.evaluate(() => window.AuralisApp.toggleOverlay('player'));
    await page.waitForFunction(() => !document.getElementById('player')?.classList.contains('active'));

    await switchToRootScreen(page, 'queue');
    await page.waitForFunction(() => document.getElementById('queue')?.classList.contains('active'));
    await captureAuditScreen(assert, page, summary, 'queue', '#queue', 'Queue screen');

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
