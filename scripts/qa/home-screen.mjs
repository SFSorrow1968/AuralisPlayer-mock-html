import {
    assertNoVisualDefects,
    assertScreenHealthy,
    buildFixtureSet,
    captureScreenShot,
    clearClientState,
    installRichLibrary,
    reloadApp,
    seedPersistedState,
    withQaSession
} from './shared.mjs';

function trackKey(track) {
    return `${String(track.title || '').trim().toLowerCase()}::${String(track.artist || '').trim().toLowerCase()}`;
}

const fixture = await buildFixtureSet([
    'EELS/Electro-Shock Blues',
    'Enya/Watermark',
    { dir: 'Minutemen/Miscellaneous', allowedExtensions: ['.mp3'] },
    'Minutemen/The Punch Line'
]);

const allTracks = fixture.albums.flatMap((album) => album.tracks.map((track) => ({ ...track, _album: album })));
const recentTrack = allTracks.find((track) => track.title === 'Last Stop This Town') || allTracks[0];
const secondRecentTrack = allTracks.find((track) => track.title === 'Orinoco Flow') || allTracks[1];
const likedTrack = allTracks.find((track) => track.title === 'Political Song For Michael Jackson To Sing') || allTracks[2];
const ratedTrack = allTracks.find((track) => track.title === 'Search') || allTracks[3];
const jumpAlbum = fixture.albums.find((album) => album.title === 'Watermark') || fixture.albums[1];

await withQaSession('qa:home', async ({ assert, page, step }) => {
    const networkErrors = [];
    page.on('response', (response) => {
        const url = response.url();
        if (response.status() >= 400 && !url.endsWith('/favicon.ico')) {
            networkErrors.push(`${response.status()} ${response.request().method()} ${url}`);
        }
    });

    step('Resetting state, mocking playback, and installing a seeded home library.');
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
    await installRichLibrary(page, fixture.albums);

    const now = Date.now();
    await page.evaluate(({ recentTrack, secondRecentTrack, likedTrack, ratedTrack, jumpAlbum, now }) => {
        const keyFor = (track) => `${String(track.title || '').trim().toLowerCase()}::${String(track.artist || '').trim().toLowerCase()}`;
        window.AuralisApp._applyBackendPayload({
            userState: {
                playCounts: {
                    [keyFor(recentTrack)]: 9,
                    [keyFor(secondRecentTrack)]: 5,
                    [keyFor(likedTrack)]: 2,
                    [keyFor(ratedTrack)]: 1
                },
                lastPlayed: {
                    [keyFor(recentTrack)]: now - 60_000,
                    [keyFor(secondRecentTrack)]: now - 3_600_000,
                    [keyFor(likedTrack)]: now - (2 * 86_400_000),
                    [keyFor(ratedTrack)]: now - (5 * 86_400_000)
                },
                likedTracks: [keyFor(likedTrack)],
                trackRatings: {
                    [keyFor(ratedTrack)]: 5
                },
                userPlaylists: [{
                    id: 'qa-home-playlist',
                    name: 'QA Home Mix',
                    tracks: [recentTrack, secondRecentTrack]
                }],
                albumProgress: {
                    [`${jumpAlbum.title.toLowerCase()}::${jumpAlbum.artist.toLowerCase()}`]: {
                        trackIndex: 2,
                        position: 43,
                        total: 180,
                        timestamp: now - 120_000
                    }
                },
                preferences: {
                    sort: 'Recently Added',
                    volume: 1,
                    speed: 1,
                    crossfadeEnabled: false,
                    replayGainEnabled: true,
                    gaplessEnabled: false,
                    eqEnabled: false,
                    eqBands: new Array(10).fill(0)
                }
            }
        });
    }, { recentTrack, secondRecentTrack, likedTrack, ratedTrack, jumpAlbum, now });

    step('Validating default Home sections and recent-activity ordering.');
    await page.waitForSelector('#home-sections-root .home-section');
    const homeMetrics = await assertScreenHealthy(assert, page, '#home', 'Home screen');
    assert.ok(homeMetrics.visibleRows >= 6, 'Home should render a meaningful fixture-backed surface.');
    await assertNoVisualDefects(assert, page, '#home', 'Home screen');
    await captureScreenShot(page, 'home-rich-after', { selector: '.emulator' });
    const duplicateTitles = await page.locator('#home-sections-root .section-title').evaluateAll((nodes) => {
        const counts = nodes.reduce((acc, node) => {
            const text = node.textContent.trim();
            acc[text] = (acc[text] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).filter(([, count]) => count > 1).map(([title]) => title);
    });
    assert.deepEqual(duplicateTitles, [], 'Home should not render duplicate section titles.');

    const sectionTitles = await page.locator('#home-sections-root .section-title').allTextContents();
    assert.deepEqual(sectionTitles.slice(0, 2), ['Recent Activity', 'Recently Added']);

    const firstRecentTrack = (await page.locator('#home-sections-root .home-section').first().locator('.item-content h3').first().textContent()) || '';
    assert.equal(firstRecentTrack.trim(), recentTrack.title);

    step('Playing a track from Home and confirming now-playing updates.');
    await page.locator('#home-sections-root .home-section').first().locator('[data-action="playTrack"]').first().click();
    await page.waitForFunction((title) => document.getElementById('player-title')?.textContent?.includes(title), recentTrack.title);

    step('Editing Home, adding Jump Back In, and navigating into an album from the new section.');
    await page.click('#edit-home-btn');
    await page.waitForFunction(() => document.getElementById('home')?.classList.contains('home-editor-active'));
    await page.click('[data-action="openAddHomeSection"]');
    await page.waitForFunction(() => document.getElementById('action-sheet')?.classList.contains('show'));
    await page.locator('#action-sheet .sheet-action', { hasText: 'Albums' }).click();
    await page.locator('#action-sheet .sheet-action', { hasText: 'Jump Back In' }).click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#home-sections-root .section-title')).some((el) => el.textContent.includes('Jump Back In')));

    const jumpSection = page.locator('#home-sections-root .home-section').filter({ hasText: 'Jump Back In' });
    assert.equal(await jumpSection.count(), 1);
    await page.click('#edit-home-btn');
    await page.waitForFunction(() => !document.getElementById('home')?.classList.contains('home-editor-active'));
    await jumpSection.locator('[data-action="navToAlbum"]').first().click();
    await page.waitForFunction(() => document.getElementById('album_detail')?.classList.contains('active'));
    const albumTitle = (await page.locator('#alb-title').textContent()) || '';
    assert.match(albumTitle, /Watermark/);

    step('Creating a new Home profile, hiding its default sections, and ensuring empty-state recovery is visible.');
    await page.evaluate(() => window.AuralisApp.switchTab('home'));
    await page.click('#home-profile-add');
    const modalInput = page.locator('body > div').filter({ hasText: 'Name this Home' }).locator('input[type="text"]');
    await modalInput.fill('QA Home');
    await modalInput.press('Enter');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#home-profile-nav .filter-chip')).some((el) => el.textContent.includes('QA Home')));

    await page.evaluate(() => {
        const profilesKey = 'auralis_home_profiles_v1';
        const activeKey = 'auralis_home_active_profile_v1';
        const activeProfileId = String(localStorage.getItem(activeKey) || '').trim();
        const profiles = JSON.parse(localStorage.getItem(profilesKey) || '[]');
        profiles.forEach((profile) => {
            if (profile.id !== activeProfileId) return;
            (Array.isArray(profile.sections) ? profile.sections : []).forEach((section) => {
                section.enabled = false;
            });
        });
        localStorage.setItem(profilesKey, JSON.stringify(profiles));
    });
    await reloadApp(page);
    await installRichLibrary(page, fixture.albums);

    const emptyText = (await page.locator('#home-sections-root').textContent()) || '';
    assert.match(emptyText, /Your Home is Empty/);
    const emptyStateClasses = await page.evaluate(() => ({
        home: document.querySelector('#home-sections-root .screen-empty-state')?.className || '',
        homeProfileLegacy: document.querySelector('#home-sections-root .home-section-empty')?.className || '',
        homeAction: document.querySelector('#home-sections-root .screen-empty-action')?.textContent?.trim() || ''
    }));
    assert.match(emptyStateClasses.home, /screen-empty-state/);
    assert.equal(emptyStateClasses.homeProfileLegacy.includes('home-section-empty'), false, 'Home empty profile should stop using the old boxed empty-state class.');
    assert.equal(emptyStateClasses.homeAction, 'Add Section');
    await assertNoVisualDefects(assert, page, '#home', 'Home empty profile');
    await captureScreenShot(page, 'home-empty-profile-after', { selector: '.emulator' });

    const addButtonDisplay = await page.locator('.add-section-btn[data-action="openAddHomeSection"]').evaluate((element) => getComputedStyle(element).display);
    assert.equal(addButtonDisplay, 'flex');

    await page.click('#home-sections-root .screen-empty-action[data-action="openAddHomeSection"]');
    await page.waitForFunction(() => {
        const title = document.getElementById('sheet-title');
        return document.getElementById('action-sheet')?.classList.contains('show') && title?.textContent?.includes('Create Home Section');
    });

    assert.deepEqual(networkErrors, []);
});
