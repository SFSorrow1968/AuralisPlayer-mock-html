import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearClientState,
  installRichLibrary,
  reloadApp,
  withQaSession
} from '../scripts/qa/shared.mjs';

const FIXTURE_ALBUMS = [{
  id: 'fixture:album:playback-stats',
  title: 'Playback Stats QA',
  artist: 'QA Artist',
  albumArtist: 'QA Artist',
  year: '2026',
  genre: 'Test',
  artUrl: '',
  trackCount: 1,
  totalDurationLabel: '3:00',
  _sourceAlbumId: 'fixture:album:playback-stats',
  _sourceAlbumTitle: 'Playback Stats QA',
  tracks: [{
    no: 1,
    title: 'Stable Identity Song',
    artist: 'QA Artist',
    albumArtist: 'QA Artist',
    albumTitle: 'Playback Stats QA',
    year: '2026',
    genre: 'Test',
    duration: '3:00',
    durationSec: 180,
    ext: 'flac',
    artUrl: '',
    fileUrl: '/music/qa/stable-identity-song.flac',
    path: 'qa/Stable Identity Song.flac',
    _trackId: 'fixture:track:stable-identity-song',
    _sourceAlbumId: 'fixture:album:playback-stats',
    _sourceAlbumTitle: 'Playback Stats QA',
    _embeddedAlbumTitle: 'Playback Stats QA',
    _metadataSource: 'fixture',
    _metadataQuality: 'trusted',
    _scanned: true,
    _metaDone: true
  }]
}];

test('completed playback increments the existing stable-id play count', async () => {
  await withQaSession('test:stable-play-counts', async ({ page }) => {
    await clearClientState(page);
    await reloadApp(page);
    await installRichLibrary(page, FIXTURE_ALBUMS);

    const result = await page.evaluate(() => {
      const library = window.AuralisApp._getLibrary();
      const track = library.tracks[0];
      const stableKey = track._trackId;

      window.AuralisApp._applyBackendPayload({
        userState: {
          playCounts: { [stableKey]: 2 },
          lastPlayed: {},
          likedTracks: [],
          trackRatings: {},
          userPlaylists: [],
          metadataOverrides: {},
          albumProgress: {},
          preferences: {}
        }
      });

      window.AuralisApp.playTrack(track.title, track.artist, track.albumTitle, track._trackId);
      document.getElementById('audio-engine')?.dispatchEvent(new Event('ended'));

      const payload = window.AuralisApp._exportBackendPayload();
      return {
        playCount: window.AuralisApp.getPlayCount(track),
        playCounts: payload.userState.playCounts,
        lastPlayed: payload.userState.lastPlayed
      };
    });

    assert.equal(result.playCount, 3);
    assert.equal(result.playCounts['fixture:track:stable-identity-song'], 3);
    assert.ok(result.lastPlayed['fixture:track:stable-identity-song']);
  });
});
