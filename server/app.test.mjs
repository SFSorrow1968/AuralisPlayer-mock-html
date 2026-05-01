import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createAuralisServer } from './app.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function createTestBackend() {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-backend-test-'));
  const backend = createAuralisServer({
    dataDir,
    port: 0,
    quiet: true,
    rootDir
  });
  const started = await backend.start();
  return {
    ...started,
    async close() {
      await backend.stop();
      await rm(dataDir, { recursive: true, force: true });
    }
  };
}

function createMinimalFlac({ durationSec = 123, sampleRate = 44100, comments = [] } = {}) {
  const streamInfo = Buffer.alloc(34);
  const channelsMinusOne = 1;
  const bitsMinusOne = 15;
  const totalSamples = BigInt(Math.round(durationSec * sampleRate));
  streamInfo[10] = (sampleRate >> 12) & 0xFF;
  streamInfo[11] = (sampleRate >> 4) & 0xFF;
  streamInfo[12] = ((sampleRate & 0x0F) << 4) | ((channelsMinusOne & 0x07) << 1) | ((bitsMinusOne >> 4) & 0x01);
  streamInfo[13] = ((bitsMinusOne & 0x0F) << 4) | Number((totalSamples >> 32n) & 0x0Fn);
  streamInfo[14] = Number((totalSamples >> 24n) & 0xFFn);
  streamInfo[15] = Number((totalSamples >> 16n) & 0xFFn);
  streamInfo[16] = Number((totalSamples >> 8n) & 0xFFn);
  streamInfo[17] = Number(totalSamples & 0xFFn);

  const vendor = Buffer.from('auralis-test', 'utf8');
  const commentBuffers = comments.map((comment) => Buffer.from(comment, 'utf8'));
  const vorbisLength = 4 + vendor.length + 4 + commentBuffers.reduce((sum, comment) => sum + 4 + comment.length, 0);
  const vorbis = Buffer.alloc(vorbisLength);
  let offset = 0;
  vorbis.writeUInt32LE(vendor.length, offset);
  offset += 4;
  vendor.copy(vorbis, offset);
  offset += vendor.length;
  vorbis.writeUInt32LE(commentBuffers.length, offset);
  offset += 4;
  for (const comment of commentBuffers) {
    vorbis.writeUInt32LE(comment.length, offset);
    offset += 4;
    comment.copy(vorbis, offset);
    offset += comment.length;
  }

  return Buffer.concat([
    Buffer.from('fLaC', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, streamInfo.length]),
    streamInfo,
    Buffer.from([0x84, (vorbis.length >> 16) & 0xFF, (vorbis.length >> 8) & 0xFF, vorbis.length & 0xFF]),
    vorbis
  ]);
}

test('register, sync, conflict detection, and metrics work end-to-end', async () => {
  const backend = await createTestBackend();
  try {
    const registerResponse = await fetch(`${backend.origin}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'listener@example.com',
        password: 'averysecurepassword',
        displayName: 'Listener',
        deviceId: 'desktop-test'
      })
    });
    assert.equal(registerResponse.status, 201);
    const registerBody = await registerResponse.json();
    assert.equal(registerBody.user.email, 'listener@example.com');
    assert.ok(registerBody.token);

    const authHeaders = {
      Authorization: `Bearer ${registerBody.token}`,
      'Content-Type': 'application/json'
    };

    const syncPayload = {
      userState: {
        ifMatch: '*',
        payload: {
          likedTracks: ['Song A::Artist A'],
          userPlaylists: [{ id: 'playlist_1', name: 'Favorites', tracks: [{ title: 'Song A', artist: 'Artist A', albumTitle: 'Album A', durationSec: 180 }] }],
          playCounts: { 'Song A::Artist A': 5 },
          preferences: { volume: 0.8, speed: 1 }
        }
      },
      librarySnapshot: {
        ifMatch: '*',
        payload: {
          sources: [{ id: 'source_1', displayName: 'Music Folder', kind: 'local_folder', status: 'active' }],
          albums: [{
            id: 'album_a',
            title: 'Album A',
            artist: 'Artist A',
            albumArtist: 'Artist A',
            tracks: [{ title: 'Song A', artist: 'Artist A', albumTitle: 'Album A', durationSec: 180, path: 'Artist A/Album A/Song A.flac', ext: 'flac' }]
          }]
        }
      },
      playbackSession: {
        payload: {
          deviceId: 'desktop-test',
          deviceName: 'Desktop',
          nowPlaying: { title: 'Song A', artist: 'Artist A', albumTitle: 'Album A', durationSec: 180 },
          queue: [{ title: 'Song A', artist: 'Artist A', albumTitle: 'Album A', durationSec: 180 }],
          queueIndex: 0,
          positionMs: 12000,
          isPlaying: true
        }
      }
    };

    const syncResponse = await fetch(`${backend.origin}/api/sync/full`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(syncPayload)
    });
    assert.equal(syncResponse.status, 200);
    const syncBody = await syncResponse.json();
    assert.equal(syncBody.sync.librarySnapshot.payload.summary.trackCount, 1);
    assert.equal(syncBody.sync.userState.payload.summary.likedCount, 1);

    const staleResponse = await fetch(`${backend.origin}/api/sync/full`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        userState: {
          ifMatch: 'W/"stale-etag"',
          payload: { likedTracks: [] }
        }
      })
    });
    assert.equal(staleResponse.status, 409);
    const staleBody = await staleResponse.json();
    assert.equal(staleBody.conflicts.userState.payload.summary.likedCount, 1);

    const sessionsResponse = await fetch(`${backend.origin}/api/playback/sessions`, {
      headers: { Authorization: `Bearer ${registerBody.token}` }
    });
    assert.equal(sessionsResponse.status, 200);
    const sessionsBody = await sessionsResponse.json();
    assert.equal(sessionsBody.sessions.length, 1);
    assert.equal(sessionsBody.sessions[0].payload.deviceName, 'Desktop');

    const metricsResponse = await fetch(`${backend.origin}/api/metrics`);
    assert.equal(metricsResponse.status, 200);
    const metricsBody = await metricsResponse.json();
    assert.equal(metricsBody.counts.users, 1);
    assert.equal(metricsBody.counts.librarySnapshots, 1);
    assert.equal(metricsBody.counts.playbackSessions, 1);
  } finally {
    await backend.close();
  }
});

test('playback sessions retain stable queue identifiers and discard transient artwork URLs', async () => {
  const backend = await createTestBackend();
  try {
    const registerResponse = await fetch(`${backend.origin}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'queue@example.com',
        password: 'averysecurepassword',
        displayName: 'Queue QA',
        deviceId: 'desktop-queue-test'
      })
    });
    assert.equal(registerResponse.status, 201);
    const registerBody = await registerResponse.json();

    const authHeaders = {
      Authorization: `Bearer ${registerBody.token}`,
      'Content-Type': 'application/json'
    };

    const publishResponse = await fetch(`${backend.origin}/api/sync/full`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        playbackSession: {
          payload: {
            deviceId: 'desktop-queue-test',
            deviceName: 'Desktop Queue Test',
            nowPlaying: {
              title: 'Anxious Mo-Fo',
              artist: 'Minutemen',
              albumTitle: 'Double Nickels on the Dime',
              durationSec: 80,
              artUrl: 'blob:https://auralis.invalid/transient-art',
              path: 'Music/Minutemen/Double Nickels on the Dime/04 Anxious Mo-Fo.flac',
              ext: 'flac',
              _trackId: 'fixture:minutemen-anxious-mo-fo',
              _sourceAlbumId: 'fixture:minutemen-double-nickels',
              _sourceAlbumTitle: 'Double Nickels on the Dime'
            },
            queue: [{
              title: 'Anxious Mo-Fo',
              artist: 'Minutemen',
              albumTitle: 'Double Nickels on the Dime',
              durationSec: 80,
              artUrl: '/music/Minutemen/Double%20Nickels%20on%20the%20Dime/cover.jpg',
              path: 'Music/Minutemen/Double Nickels on the Dime/04 Anxious Mo-Fo.flac',
              ext: 'flac',
              _trackId: 'fixture:minutemen-anxious-mo-fo',
              _sourceAlbumId: 'fixture:minutemen-double-nickels',
              _sourceAlbumTitle: 'Double Nickels on the Dime'
            }, {
              title: 'Afternoons',
              artist: 'EELS',
              albumTitle: 'Electro-Shock Blues',
              durationSec: 90,
              artUrl: 'blob:https://auralis.invalid/second-transient-art',
              path: 'Music/EELS/Electro-Shock Blues/02 Afternoons.flac',
              ext: 'flac',
              _trackId: 'fixture:eels-afternoons',
              _sourceAlbumId: 'fixture:eels-electro-shock-blues',
              _sourceAlbumTitle: 'Electro-Shock Blues'
            }],
            queueIndex: 0,
            isPlaying: true
          }
        }
      })
    });
    assert.equal(publishResponse.status, 200);

    const sessionsResponse = await fetch(`${backend.origin}/api/playback/sessions`, {
      headers: { Authorization: `Bearer ${registerBody.token}` }
    });
    assert.equal(sessionsResponse.status, 200);
    const sessionsBody = await sessionsResponse.json();
    assert.equal(sessionsBody.sessions.length, 1);

    const session = sessionsBody.sessions[0].payload;
    assert.equal(session.nowPlaying._trackId, 'fixture:minutemen-anxious-mo-fo');
    assert.equal(session.nowPlaying._sourceAlbumId, 'fixture:minutemen-double-nickels');
    assert.equal(session.nowPlaying._sourceAlbumTitle, 'Double Nickels on the Dime');
    assert.equal(session.nowPlaying.artUrl, '');
    assert.equal(session.queue[0]._trackId, 'fixture:minutemen-anxious-mo-fo');
    assert.equal(session.queue[0]._sourceAlbumId, 'fixture:minutemen-double-nickels');
    assert.equal(session.queue[0].artUrl, '/music/Minutemen/Double%20Nickels%20on%20the%20Dime/cover.jpg');
    assert.equal(session.queue[1]._trackId, 'fixture:eels-afternoons');
    assert.equal(session.queue[1]._sourceAlbumId, 'fixture:eels-electro-shock-blues');
    assert.equal(session.queue[1].artUrl, '');
  } finally {
    await backend.close();
  }
});

test('static shell is served from the backend root', async () => {
  const backend = await createTestBackend();
  try {
    const response = await fetch(`${backend.origin}/Auralis_mock_zenith.html`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /AuralisPlayer - Zenith Experience/);
  } finally {
    await backend.close();
  }
});

test('static directory paths serve their index file', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-backend-test-'));
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-root-test-'));
  try {
    await writeFile(path.join(rootDir, 'Auralis_mock_zenith.html'), '<!doctype html><title>Auralis</title>');
    await mkdir(path.join(rootDir, 'design-sandbox'), { recursive: true });
    await writeFile(path.join(rootDir, 'design-sandbox', 'index.html'), '<!doctype html><title>Sandbox</title><main>Design Sandbox</main>');

    const backend = createAuralisServer({
      dataDir,
      port: 0,
      quiet: true,
      rootDir
    });
    const started = await backend.start();
    try {
      const response = await fetch(`${started.origin}/design-sandbox/`);
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.match(body, /Design Sandbox/);
    } finally {
      await backend.stop();
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('lowercase /music alias serves files from the Music folder', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-backend-test-'));
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-root-test-'));
  try {
    await writeFile(path.join(rootDir, 'Auralis_mock_zenith.html'), '<!doctype html><title>Auralis</title>');
    const relativeTrackPath = path.join('Music', 'Minutemen', 'What Makes A Man Start Fires_', '1 Bob Dylan Wrote Propaganda Songs.flac');
    const absoluteTrackPath = path.join(rootDir, relativeTrackPath);
    await mkdir(path.dirname(absoluteTrackPath), { recursive: true });
    await writeFile(absoluteTrackPath, 'fake flac payload');

    const backend = createAuralisServer({
      dataDir,
      port: 0,
      quiet: true,
      rootDir
    });
    const started = await backend.start();
    try {
      const response = await fetch(`${started.origin}/music/Minutemen/What%20Makes%20A%20Man%20Start%20Fires_/1%20Bob%20Dylan%20Wrote%20Propaganda%20Songs.flac`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'audio/flac');
      const body = await response.text();
      assert.equal(body, 'fake flac payload');
    } finally {
      await backend.stop();
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('local music snapshot exposes albums and artists from the Music folder', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-backend-test-'));
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-root-test-'));
  try {
    await writeFile(path.join(rootDir, 'Auralis_mock_zenith.html'), '<!doctype html><title>Auralis</title>');
    const artists = ['Artist One', 'Artist Two', 'Artist Three', 'Artist Four', 'Artist Five'];
    for (let albumIndex = 0; albumIndex < 10; albumIndex += 1) {
      const artist = artists[albumIndex % artists.length];
      const album = `Album ${String(albumIndex + 1).padStart(2, '0')}`;
      const albumDir = path.join(rootDir, 'Music', artist, album);
      await mkdir(albumDir, { recursive: true });
      await writeFile(path.join(albumDir, '1 Opening Track.flac'), `fake ${artist} ${album} track 1`);
      await writeFile(path.join(albumDir, '2 Closing Track.flac'), `fake ${artist} ${album} track 2`);
    }

    const backend = createAuralisServer({
      dataDir,
      port: 0,
      quiet: true,
      rootDir
    });
    const started = await backend.start();
    try {
      const response = await fetch(`${started.origin}/api/local-music/snapshot`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.summary.albumCount, 10);
      assert.equal(body.summary.artistCount, 5);
      assert.equal(body.summary.trackCount, 20);
      assert.equal(body.libraryCache.albums.length, 10);
      assert.match(body.libraryCache.albums[0].tracks[0].fileUrl, /^\/music\//);
    } finally {
      await backend.stop();
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('local music snapshot reads FLAC duration and release year metadata', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-backend-test-'));
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'auralis-root-test-'));
  try {
    await writeFile(path.join(rootDir, 'Auralis_mock_zenith.html'), '<!doctype html><title>Auralis</title>');
    const albumDir = path.join(rootDir, 'Music', 'Minutemen', 'Double Nickels On The Dime');
    await mkdir(albumDir, { recursive: true });
    await writeFile(path.join(albumDir, '45 Love Dance.flac'), createMinimalFlac({
      durationSec: 123,
      comments: [
        'TITLE=Love Dance',
        'ARTIST=Minutemen',
        'ALBUM=Double Nickels On The Dime',
        'DATE=1984-07',
        'TRACKNUMBER=45'
      ]
    }));

    const backend = createAuralisServer({
      dataDir,
      port: 0,
      quiet: true,
      rootDir
    });
    const started = await backend.start();
    try {
      const response = await fetch(`${started.origin}/api/local-music/snapshot`);
      assert.equal(response.status, 200);
      const body = await response.json();
      const album = body.libraryCache.albums[0];
      const track = album.tracks[0];
      assert.equal(album.year, '1984');
      assert.equal(album.totalDurationLabel, '2:03');
      assert.equal(track.no, 45);
      assert.equal(track.title, 'Love Dance');
      assert.equal(track.durationSec, 123);
      assert.equal(track.duration, '2:03');
      assert.equal(track.year, '1984');
    } finally {
      await backend.stop();
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
    await rm(rootDir, { recursive: true, force: true });
  }
});
