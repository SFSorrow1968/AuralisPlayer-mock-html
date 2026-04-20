import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
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
