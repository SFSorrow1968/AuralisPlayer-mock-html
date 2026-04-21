import {
    clearClientState,
    expectText,
    installRichLibrary,
    reloadApp,
    seedPersistedState,
    withQaSession
} from './shared.mjs';

const lyricsFixture = [{
    id: 'qa:lyrics-album',
    title: 'Lyrics QA Album',
    artist: 'QA Artist',
    albumArtist: 'QA Artist',
    artUrl: '',
    trackCount: 2,
    totalDurationLabel: '4:00',
    tracks: [
        {
            no: 1,
            title: 'First Lyrics Track',
            artist: 'QA Artist',
            albumArtist: 'QA Artist',
            albumTitle: 'Lyrics QA Album',
            duration: '2:00',
            durationSec: 120,
            ext: 'mp3',
            artUrl: '',
            fileUrl: '/music/qa/first.mp3',
            path: 'qa/first.mp3',
            lyrics: 'first track lyrics',
            _trackId: 'qa:lyrics-track-1',
            _sourceAlbumId: 'qa:lyrics-album',
            _sourceAlbumTitle: 'Lyrics QA Album',
            _metadataQuality: 'trusted',
            _scanned: true,
            _metaDone: true
        },
        {
            no: 2,
            title: 'Second Lyrics Track',
            artist: 'QA Artist',
            albumArtist: 'QA Artist',
            albumTitle: 'Lyrics QA Album',
            duration: '2:00',
            durationSec: 120,
            ext: 'mp3',
            artUrl: '',
            fileUrl: '/music/qa/second.mp3',
            path: 'qa/second.mp3',
            lyrics: 'second track lyrics',
            _trackId: 'qa:lyrics-track-2',
            _sourceAlbumId: 'qa:lyrics-album',
            _sourceAlbumTitle: 'Lyrics QA Album',
            _metadataQuality: 'trusted',
            _scanned: true,
            _metaDone: true
        }
    ]
}];

await withQaSession('qa:lyrics-current-track', async ({ page, step }) => {
    step('Loading a two-track fixture with distinct lyrics for each song.');
    await clearClientState(page);
    await seedPersistedState(page);
    await reloadApp(page);
    await installRichLibrary(page, lyricsFixture);

    await page.evaluate(() => {
        const audio = document.getElementById('audio-engine');
        if (!audio) return;

        let qaPaused = true;
        let qaCurrentTime = 0;
        const qaDuration = 120;

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

        audio.load = () => {
            audio.dispatchEvent(new Event('loadedmetadata'));
        };
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

    step('Opening the fullscreen lyrics panel for the first track.');
    await page.evaluate(() => {
        const album = window.AuralisApp._resolveAlbumMeta('Lyrics QA Album', 'QA Artist');
        if (!album) throw new Error('Missing QA album fixture.');
        window.AuralisApp.playTrack(album.tracks[0].title, album.tracks[0].artist, album.tracks[0].albumTitle, album.tracks[0]._trackId);
    });
    await expectText(page, '#player-title', 'First Lyrics Track');
    await page.click('.mini-player');
    await page.waitForFunction(() => document.getElementById('player')?.classList.contains('active'));
    await page.evaluate(() => {
        window.AuralisApp.toggleLyrics();
    });
    await expectText(page, '#lyrics-content', 'first track lyrics');

    step('Advancing playback and checking that the visible lyrics panel follows the new current track.');
    await page.evaluate(() => {
        window.AuralisApp.playNext();
    });
    await expectText(page, '#player-title', 'Second Lyrics Track');
    await expectText(page, '#lyrics-content', 'second track lyrics');
});
