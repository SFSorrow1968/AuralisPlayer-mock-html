import http from 'node:http';
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = Number(process.env.PORT || 8787);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DATA_DIR = path.resolve(DEFAULT_ROOT_DIR, '.auralis-backend');
const JSON_BODY_LIMIT = 15 * 1024 * 1024;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PBKDF2_ITERATIONS = 210000;
const STATIC_CONTENT_TYPES = new Map([
  ['.aac', 'audio/aac'],
  ['.css', 'text/css; charset=utf-8'],
  ['.flac', 'audio/flac'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.m4a', 'audio/mp4'],
  ['.mp3', 'audio/mpeg'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.ogg', 'audio/ogg'],
  ['.opus', 'audio/ogg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wav', 'audio/wav'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2']
]);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = 'id') {
  return `${prefix}_${randomBytes(10).toString('hex')}`;
}

function sha256(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}

function derivePasswordHash(password, salt) {
  return pbkdf2Sync(String(password), String(salt), PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
}

function makeEtag(payload) {
  return `W/"${sha256(JSON.stringify(payload))}"`;
}

function jsonClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function scrubEmail(email) {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function sanitizeString(value, fallback = '') {
  return String(value == null ? fallback : value).trim();
}

function sanitizeStoredArtUrl(value) {
  const raw = sanitizeString(value);
  if (!raw || /^blob:/i.test(raw)) return '';
  return raw;
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stableTrackHash(track = {}, album = {}) {
  return sha256(JSON.stringify([
    sanitizeString(track.path),
    sanitizeString(track.title),
    sanitizeString(track.artist),
    sanitizeString(track.albumTitle || album.title),
    numeric(track.durationSec),
    sanitizeString(track.ext)
  ]));
}

function stableAudioFingerprint(track = {}, album = {}) {
  return sha256(JSON.stringify([
    sanitizeString(track.title),
    sanitizeString(track.artist),
    sanitizeString(track.albumTitle || album.title),
    numeric(track.durationSec),
    numeric(track.no),
    numeric(track.discNo, 1)
  ]));
}

function normalizeTrack(track = {}, album = {}, index = 0) {
  const normalized = {
    title: sanitizeString(track.title, `Track ${index + 1}`),
    artist: sanitizeString(track.artist || album.artist, 'Unknown Artist'),
    albumTitle: sanitizeString(track.albumTitle || album.title, album.title || 'Unknown Album'),
    albumArtist: sanitizeString(track.albumArtist || album.albumArtist || album.artist, album.artist || 'Unknown Artist'),
    year: sanitizeString(track.year || album.year),
    genre: sanitizeString(track.genre || album.genre),
    duration: sanitizeString(track.duration),
    durationSec: numeric(track.durationSec),
    path: sanitizeString(track.path),
    artUrl: sanitizeStoredArtUrl(track.artUrl || album.artUrl),
    ext: sanitizeString(track.ext).toLowerCase(),
    no: numeric(track.no || track.trackNo, index + 1),
    discNo: numeric(track.discNo, 1),
    plays: numeric(track.plays),
    addedRank: numeric(track.addedRank),
    lastPlayedDays: numeric(track.lastPlayedDays),
    lyrics: sanitizeString(track.lyrics),
    isFavorite: Boolean(track.isFavorite),
    replayGainTrack: Number.isFinite(Number(track.replayGainTrack)) ? Number(track.replayGainTrack) : null,
    replayGainAlbum: Number.isFinite(Number(track.replayGainAlbum)) ? Number(track.replayGainAlbum) : null,
    _handleKey: sanitizeString(track._handleKey),
    _trackId: sanitizeString(track._trackId),
    _sourceAlbumId: sanitizeString(track._sourceAlbumId),
    _sourceAlbumTitle: sanitizeString(track._sourceAlbumTitle || track.albumTitle || album.title),
    _embeddedAlbumTitle: sanitizeString(track._embeddedAlbumTitle),
    _fileSize: Math.max(0, numeric(track._fileSize)),
    _lastModified: Math.max(0, numeric(track._lastModified)),
    _metadataSource: sanitizeString(track._metadataSource),
    _metadataQuality: sanitizeString(track._metadataQuality),
    _scanned: Boolean(track._scanned),
    _metaDone: track._metaDone !== false
  };
  normalized.contentHash = stableTrackHash(normalized, album);
  normalized.audioFingerprint = stableAudioFingerprint(normalized, album);
  return normalized;
}

function normalizeAlbum(album = {}, index = 0) {
  const title = sanitizeString(album.title, `Album ${index + 1}`);
  const artist = sanitizeString(album.artist, 'Unknown Artist');
  const normalizedAlbum = {
    id: sanitizeString(album.id, `${artist}::${title}`),
    title,
    artist,
    albumArtist: sanitizeString(album.albumArtist || artist, artist),
    year: sanitizeString(album.year),
    genre: sanitizeString(album.genre),
    artUrl: sanitizeString(album.artUrl),
    trackCount: numeric(album.trackCount),
    totalDurationLabel: sanitizeString(album.totalDurationLabel),
    isCompilation: Boolean(album.isCompilation),
    tracks: []
  };
  const tracks = Array.isArray(album.tracks) ? album.tracks : [];
  normalizedAlbum.tracks = tracks.map((track, trackIndex) => normalizeTrack(track, normalizedAlbum, trackIndex));
  normalizedAlbum.trackCount = normalizedAlbum.tracks.length || normalizedAlbum.trackCount;
  return normalizedAlbum;
}

function normalizeLibrarySnapshot(snapshot = {}) {
  const albums = (Array.isArray(snapshot.albums) ? snapshot.albums : []).map((album, index) => normalizeAlbum(album, index));
  const tracks = albums.flatMap((album) => album.tracks);
  const artists = Array.from(new Set(albums.map((album) => album.albumArtist || album.artist).concat(tracks.map((track) => track.artist))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: sha256(name), name }));
  const sources = (Array.isArray(snapshot.sources) ? snapshot.sources : []).map((source) => ({
    id: sanitizeString(source.id, randomId('source')),
    name: sanitizeString(source.name || source.displayName, 'Unknown Source'),
    displayName: sanitizeString(source.displayName || source.name, 'Unknown Source'),
    kind: sanitizeString(source.kind, 'local_folder'),
    lastScanned: sanitizeString(source.lastScanned || source.lastScanAt),
    status: sanitizeString(source.status, 'active')
  }));
  const payload = {
    albums,
    tracks,
    artists,
    sources,
    generatedAt: sanitizeString(snapshot.generatedAt, nowIso()),
    summary: {
      albumCount: albums.length,
      artistCount: artists.length,
      trackCount: tracks.length,
      sourceCount: sources.length
    }
  };
  payload.signature = sha256(JSON.stringify(payload.summary) + JSON.stringify(tracks.map((track) => track.contentHash)));
  return payload;
}

function normalizeUserState(userState = {}) {
  const playlists = Array.isArray(userState.userPlaylists) ? userState.userPlaylists : [];
  const normalized = {
    playCounts: Object.fromEntries(Object.entries(userState.playCounts || {}).map(([key, value]) => [String(key), numeric(value)])),
    lastPlayed: Object.fromEntries(Object.entries(userState.lastPlayed || {}).map(([key, value]) => [String(key), numeric(value)])),
    likedTracks: Array.from(new Set((Array.isArray(userState.likedTracks) ? userState.likedTracks : []).map((value) => String(value).trim()).filter(Boolean))).sort(),
    trackRatings: Object.fromEntries(Object.entries(userState.trackRatings || {}).map(([key, value]) => [String(key), numeric(value)])),
    userPlaylists: playlists.map((playlist) => ({
      id: sanitizeString(playlist.id, randomId('playlist')),
      name: sanitizeString(playlist.name, 'Playlist'),
      tracks: (Array.isArray(playlist.tracks) ? playlist.tracks : []).map((track, index) => normalizeTrack(track, { title: playlist.name, artist: '' }, index))
    })),
    metadataOverrides: Object.fromEntries(Object.entries(userState.metadataOverrides || {}).map(([key, value]) => [String(key), value || {}])),
    albumProgress: Object.fromEntries(Object.entries(userState.albumProgress || {}).map(([key, value]) => [String(key), value || {}])),
    preferences: {
      sort: sanitizeString(userState.preferences?.sort, 'Recently Added'),
      volume: numeric(userState.preferences?.volume, 1),
      speed: numeric(userState.preferences?.speed, 1),
      crossfadeEnabled: Boolean(userState.preferences?.crossfadeEnabled),
      replayGainEnabled: userState.preferences?.replayGainEnabled !== false,
      gaplessEnabled: Boolean(userState.preferences?.gaplessEnabled),
      eqEnabled: Boolean(userState.preferences?.eqEnabled),
      eqBands: Array.isArray(userState.preferences?.eqBands) ? userState.preferences.eqBands.map((value) => numeric(value)) : new Array(10).fill(0)
    }
  };
  normalized.summary = {
    likedCount: normalized.likedTracks.length,
    playlistCount: normalized.userPlaylists.length,
    ratingCount: Object.keys(normalized.trackRatings).length
  };
  return normalized;
}

function normalizePlaybackSession(session = {}) {
  const queue = (Array.isArray(session.queue) ? session.queue : []).map((track, index) => normalizeTrack(track, { title: sanitizeString(track.albumTitle), artist: sanitizeString(track.artist) }, index));
  return {
    deviceId: sanitizeString(session.deviceId),
    deviceName: sanitizeString(session.deviceName, 'Auralis Device'),
    nowPlaying: session.nowPlaying ? normalizeTrack(session.nowPlaying, { title: sanitizeString(session.nowPlaying.albumTitle), artist: sanitizeString(session.nowPlaying.artist) }) : null,
    queue,
    queueIndex: Math.max(0, Math.min(numeric(session.queueIndex), Math.max(0, queue.length - 1))),
    repeatMode: sanitizeString(session.repeatMode, 'off'),
    shuffleMode: Boolean(session.shuffleMode),
    isPlaying: Boolean(session.isPlaying),
    positionMs: Math.max(0, numeric(session.positionMs)),
    activeId: sanitizeString(session.activeId, 'home'),
    updatedAt: sanitizeString(session.updatedAt, nowIso())
  };
}

function normalizePartyState(session = {}) {
  return {
    joinCode: sanitizeString(session.joinCode).toUpperCase(),
    hostDeviceId: sanitizeString(session.hostDeviceId),
    hostDeviceName: sanitizeString(session.hostDeviceName, 'Auralis Host'),
    playbackSession: session.playbackSession ? normalizePlaybackSession(session.playbackSession) : null,
    members: Array.isArray(session.members)
      ? session.members.map((member) => ({
          userId: sanitizeString(member.userId),
          deviceId: sanitizeString(member.deviceId),
          deviceName: sanitizeString(member.deviceName, 'Auralis Guest'),
          role: sanitizeString(member.role, 'guest'),
          joinedAt: sanitizeString(member.joinedAt, nowIso()),
          lastSeenAt: sanitizeString(member.lastSeenAt, nowIso())
        }))
      : [],
    updatedAt: sanitizeString(session.updatedAt, nowIso())
  };
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function createStructuredLogger({ quiet = false } = {}) {
  return function log(level, event, meta = {}) {
    if (quiet && level === 'info') return;
    const entry = {
      ts: nowIso(),
      level,
      event,
      ...meta
    };
    console.log(JSON.stringify(entry));
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function sendEmpty(res, statusCode = 204) {
  res.writeHead(statusCode, { 'Cache-Control': 'no-store' });
  res.end();
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store'
  });
  res.end(text);
}

async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > JSON_BODY_LIMIT) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Malformed JSON body');
    error.statusCode = 400;
    throw error;
  }
}

function createStore({ dbPath, log }) {
  ensureDir(path.dirname(dbPath));
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      etag TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS library_snapshots (
      user_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      etag TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playback_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS party_sessions (
      join_code TEXT PRIMARY KEY,
      host_user_id TEXT NOT NULL,
      host_device_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const statements = {
    insertUser: db.prepare(`
      INSERT INTO users (id, email, display_name, password_salt, password_hash, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    findUserByEmail: db.prepare(`
      SELECT id, email, display_name AS displayName, password_salt AS passwordSalt, password_hash AS passwordHash,
             created_at AS createdAt, updated_at AS updatedAt, last_login_at AS lastLoginAt
      FROM users
      WHERE email = ?
    `),
    updateUserLogin: db.prepare(`
      UPDATE users
      SET last_login_at = ?, updated_at = ?
      WHERE id = ?
    `),
    insertToken: db.prepare(`
      INSERT INTO auth_tokens (id, user_id, device_id, token_hash, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    findToken: db.prepare(`
      SELECT t.id, t.user_id AS userId, t.device_id AS deviceId, t.token_hash AS tokenHash, t.expires_at AS expiresAt,
             u.email, u.display_name AS displayName
      FROM auth_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ?
    `),
    touchToken: db.prepare(`
      UPDATE auth_tokens
      SET last_seen_at = ?, expires_at = ?
      WHERE id = ?
    `),
    revokeToken: db.prepare(`DELETE FROM auth_tokens WHERE token_hash = ?`),
    pruneExpiredTokens: db.prepare(`DELETE FROM auth_tokens WHERE expires_at <= ?`),
    getUserState: db.prepare(`SELECT revision, etag, payload_json AS payloadJson, updated_at AS updatedAt FROM user_state WHERE user_id = ?`),
    upsertUserState: db.prepare(`
      INSERT INTO user_state (user_id, revision, etag, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision, etag = excluded.etag, payload_json = excluded.payload_json, updated_at = excluded.updated_at
    `),
    getLibrarySnapshot: db.prepare(`SELECT revision, etag, payload_json AS payloadJson, updated_at AS updatedAt FROM library_snapshots WHERE user_id = ?`),
    upsertLibrarySnapshot: db.prepare(`
      INSERT INTO library_snapshots (user_id, revision, etag, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision, etag = excluded.etag, payload_json = excluded.payload_json, updated_at = excluded.updated_at
    `),
    upsertPlaybackSession: db.prepare(`
      INSERT INTO playback_sessions (id, user_id, device_id, device_name, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET device_name = excluded.device_name, payload_json = excluded.payload_json, updated_at = excluded.updated_at
    `),
    listPlaybackSessions: db.prepare(`
      SELECT id, device_id AS deviceId, device_name AS deviceName, payload_json AS payloadJson, updated_at AS updatedAt
      FROM playback_sessions
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `),
    getPartySession: db.prepare(`
      SELECT join_code AS joinCode, host_user_id AS hostUserId, host_device_id AS hostDeviceId,
             payload_json AS payloadJson, updated_at AS updatedAt, ended_at AS endedAt
      FROM party_sessions
      WHERE join_code = ?
    `),
    upsertPartySession: db.prepare(`
      INSERT INTO party_sessions (join_code, host_user_id, host_device_id, payload_json, updated_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(join_code) DO UPDATE SET host_device_id = excluded.host_device_id, payload_json = excluded.payload_json, updated_at = excluded.updated_at, ended_at = excluded.ended_at
    `),
    listPartiesForUser: db.prepare(`
      SELECT join_code AS joinCode, host_user_id AS hostUserId, host_device_id AS hostDeviceId,
             payload_json AS payloadJson, updated_at AS updatedAt, ended_at AS endedAt
      FROM party_sessions
      WHERE host_user_id = ?
      ORDER BY updated_at DESC
    `),
    insertAuditLog: db.prepare(`
      INSERT INTO audit_logs (user_id, kind, payload_json, created_at)
      VALUES (?, ?, ?, ?)
    `),
    listAuditLogs: db.prepare(`
      SELECT id, user_id AS userId, kind, payload_json AS payloadJson, created_at AS createdAt
      FROM audit_logs
      WHERE user_id = ? OR user_id IS NULL
      ORDER BY id DESC
      LIMIT ?
    `),
    metricsCounts: {
      users: db.prepare(`SELECT COUNT(*) AS value FROM users`),
      authTokens: db.prepare(`SELECT COUNT(*) AS value FROM auth_tokens`),
      userState: db.prepare(`SELECT COUNT(*) AS value FROM user_state`),
      librarySnapshots: db.prepare(`SELECT COUNT(*) AS value FROM library_snapshots`),
      playbackSessions: db.prepare(`SELECT COUNT(*) AS value FROM playback_sessions`),
      partySessions: db.prepare(`SELECT COUNT(*) AS value FROM party_sessions WHERE ended_at IS NULL`),
      auditLogs: db.prepare(`SELECT COUNT(*) AS value FROM audit_logs`)
    }
  };

  function audit(userId, kind, payload = {}) {
    statements.insertAuditLog.run(userId || null, kind, JSON.stringify(payload), nowIso());
  }

  function compactUserRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastLoginAt: row.lastLoginAt
    };
  }

  function createTokenSession(user, deviceId = 'web-client') {
    const rawToken = `${randomId('token')}.${randomBytes(18).toString('base64url')}`;
    const tokenHash = sha256(rawToken);
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    statements.insertToken.run(randomId('auth'), user.id, sanitizeString(deviceId, 'web-client'), tokenHash, createdAt, createdAt, expiresAt);
    return {
      token: rawToken,
      expiresAt
    };
  }

  function registerUser({ email, password, displayName, deviceId }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      const error = new Error('A valid email address is required.');
      error.statusCode = 400;
      throw error;
    }
    if (String(password || '').length < 8) {
      const error = new Error('Password must be at least 8 characters.');
      error.statusCode = 400;
      throw error;
    }
    if (statements.findUserByEmail.get(normalizedEmail)) {
      const error = new Error('An account with that email already exists.');
      error.statusCode = 409;
      throw error;
    }
    const id = randomId('user');
    const salt = randomBytes(16).toString('hex');
    const passwordHash = derivePasswordHash(password, salt);
    const timestamp = nowIso();
    const normalizedDisplayName = sanitizeString(displayName, normalizedEmail.split('@')[0]);
    statements.insertUser.run(id, normalizedEmail, normalizedDisplayName, salt, passwordHash, timestamp, timestamp, timestamp);
    const user = compactUserRow(statements.findUserByEmail.get(normalizedEmail));
    const auth = createTokenSession(user, deviceId);
    audit(user.id, 'auth.register', { email: scrubEmail(normalizedEmail), deviceId: sanitizeString(deviceId) });
    return { user, ...auth };
  }

  function loginUser({ email, password, deviceId }) {
    const normalizedEmail = normalizeEmail(email);
    const userRow = statements.findUserByEmail.get(normalizedEmail);
    if (!userRow) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }
    const expectedHash = derivePasswordHash(password, userRow.passwordSalt);
    const matches = timingSafeEqual(Buffer.from(userRow.passwordHash, 'hex'), Buffer.from(expectedHash, 'hex'));
    if (!matches) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }
    const timestamp = nowIso();
    statements.updateUserLogin.run(timestamp, timestamp, userRow.id);
    const user = compactUserRow(statements.findUserByEmail.get(normalizedEmail));
    const auth = createTokenSession(user, deviceId);
    audit(user.id, 'auth.login', { email: scrubEmail(normalizedEmail), deviceId: sanitizeString(deviceId) });
    return { user, ...auth };
  }

  function authenticate(rawToken) {
    if (!rawToken) return null;
    statements.pruneExpiredTokens.run(nowIso());
    const row = statements.findToken.get(sha256(rawToken));
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      statements.revokeToken.run(sha256(rawToken));
      return null;
    }
    const renewedExpiry = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    statements.touchToken.run(nowIso(), renewedExpiry, row.id);
    return {
      user: {
        id: row.userId,
        email: row.email,
        displayName: row.displayName
      },
      deviceId: row.deviceId,
      expiresAt: renewedExpiry
    };
  }

  function logout(rawToken, userId) {
    if (!rawToken) return;
    statements.revokeToken.run(sha256(rawToken));
    audit(userId || null, 'auth.logout', {});
  }

  function parseResource(row) {
    if (!row) return null;
    return {
      revision: Number(row.revision || 0),
      etag: row.etag,
      updatedAt: row.updatedAt,
      payload: JSON.parse(row.payloadJson || '{}')
    };
  }

  function updateVersionedResource({ table, getStatement, putStatement, userId, payload, ifMatch, normalize, kind }) {
    const current = parseResource(getStatement.get(userId));
    if (ifMatch && ifMatch !== '*' && current?.etag && current.etag !== ifMatch) {
      return { conflict: true, resource: current };
    }
    const nextPayload = normalize(payload || {});
    const nextResource = {
      revision: (current?.revision || 0) + 1,
      etag: makeEtag(nextPayload),
      updatedAt: nowIso(),
      payload: nextPayload
    };
    putStatement.run(userId, nextResource.revision, nextResource.etag, JSON.stringify(nextResource.payload), nextResource.updatedAt);
    audit(userId, kind, {
      table,
      revision: nextResource.revision,
      etag: nextResource.etag
    });
    return { conflict: false, resource: nextResource };
  }

  function upsertUserState({ userId, payload, ifMatch }) {
    return updateVersionedResource({
      table: 'user_state',
      getStatement: statements.getUserState,
      putStatement: statements.upsertUserState,
      userId,
      payload,
      ifMatch,
      normalize: normalizeUserState,
      kind: 'sync.user_state'
    });
  }

  function upsertLibrarySnapshot({ userId, payload, ifMatch }) {
    return updateVersionedResource({
      table: 'library_snapshots',
      getStatement: statements.getLibrarySnapshot,
      putStatement: statements.upsertLibrarySnapshot,
      userId,
      payload,
      ifMatch,
      normalize: normalizeLibrarySnapshot,
      kind: 'sync.library_snapshot'
    });
  }

  function getSyncBundle(userId) {
    return {
      userState: parseResource(statements.getUserState.get(userId)),
      librarySnapshot: parseResource(statements.getLibrarySnapshot.get(userId)),
      playbackSessions: listPlaybackSessions(userId),
      partySessions: listPartySessions(userId)
    };
  }

  function upsertPlaybackSession({ userId, payload, deviceId }) {
    const normalized = normalizePlaybackSession({
      ...payload,
      deviceId: sanitizeString(payload?.deviceId, deviceId),
      updatedAt: nowIso()
    });
    const id = `${userId}:${normalized.deviceId || deviceId || 'device'}`;
    const updatedAt = nowIso();
    statements.upsertPlaybackSession.run(id, userId, normalized.deviceId || deviceId || 'device', normalized.deviceName, JSON.stringify(normalized), updatedAt);
    audit(userId, 'sync.playback_session', {
      deviceId: normalized.deviceId || deviceId || 'device',
      nowPlaying: normalized.nowPlaying?.title || ''
    });
    return {
      id,
      updatedAt,
      payload: normalized
    };
  }

  function listPlaybackSessions(userId) {
    return statements.listPlaybackSessions.all(userId).map((row) => ({
      id: row.id,
      deviceId: row.deviceId,
      deviceName: row.deviceName,
      updatedAt: row.updatedAt,
      payload: JSON.parse(row.payloadJson || '{}')
    }));
  }

  function generateJoinCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let joinCode = '';
    do {
      joinCode = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    } while (statements.getPartySession.get(joinCode));
    return joinCode;
  }

  function startParty({ userId, deviceId, deviceName, playbackSession }) {
    const joinCode = generateJoinCode();
    const payload = normalizePartyState({
      joinCode,
      hostDeviceId: deviceId,
      hostDeviceName: deviceName,
      playbackSession,
      members: [{
        userId,
        deviceId,
        deviceName,
        role: 'host',
        joinedAt: nowIso(),
        lastSeenAt: nowIso()
      }],
      updatedAt: nowIso()
    });
    statements.upsertPartySession.run(joinCode, userId, deviceId, JSON.stringify(payload), nowIso(), null);
    audit(userId, 'party.start', { joinCode, deviceId });
    return payload;
  }

  function joinParty({ userId, deviceId, deviceName, joinCode }) {
    const existing = statements.getPartySession.get(String(joinCode || '').toUpperCase());
    if (!existing || existing.endedAt) {
      const error = new Error('Party session not found.');
      error.statusCode = 404;
      throw error;
    }
    const payload = normalizePartyState(JSON.parse(existing.payloadJson || '{}'));
    const nextMembers = payload.members.filter((member) => !(member.userId === userId && member.deviceId === deviceId));
    nextMembers.push({
      userId,
      deviceId,
      deviceName,
      role: payload.hostDeviceId === deviceId && existing.hostUserId === userId ? 'host' : 'guest',
      joinedAt: nowIso(),
      lastSeenAt: nowIso()
    });
    payload.members = nextMembers;
    payload.updatedAt = nowIso();
    statements.upsertPartySession.run(payload.joinCode, existing.hostUserId, existing.hostDeviceId, JSON.stringify(payload), payload.updatedAt, null);
    audit(userId, 'party.join', { joinCode: payload.joinCode, deviceId });
    return payload;
  }

  function updateParty({ userId, deviceId, joinCode, playbackSession }) {
    const existing = statements.getPartySession.get(String(joinCode || '').toUpperCase());
    if (!existing || existing.endedAt) {
      const error = new Error('Party session not found.');
      error.statusCode = 404;
      throw error;
    }
    const payload = normalizePartyState(JSON.parse(existing.payloadJson || '{}'));
    payload.members = payload.members.map((member) => (
      member.userId === userId && member.deviceId === deviceId
        ? { ...member, lastSeenAt: nowIso() }
        : member
    ));
    if (existing.hostUserId === userId && existing.hostDeviceId === deviceId && playbackSession) {
      payload.playbackSession = normalizePlaybackSession(playbackSession);
    }
    payload.updatedAt = nowIso();
    statements.upsertPartySession.run(payload.joinCode, existing.hostUserId, existing.hostDeviceId, JSON.stringify(payload), payload.updatedAt, null);
    audit(userId, 'party.update', { joinCode: payload.joinCode, deviceId });
    return payload;
  }

  function leaveParty({ userId, deviceId, joinCode }) {
    const existing = statements.getPartySession.get(String(joinCode || '').toUpperCase());
    if (!existing || existing.endedAt) return null;
    const payload = normalizePartyState(JSON.parse(existing.payloadJson || '{}'));
    if (existing.hostUserId === userId && existing.hostDeviceId === deviceId) {
      statements.upsertPartySession.run(payload.joinCode, existing.hostUserId, existing.hostDeviceId, JSON.stringify(payload), nowIso(), nowIso());
      audit(userId, 'party.end', { joinCode: payload.joinCode });
      return { ended: true, joinCode: payload.joinCode };
    }
    payload.members = payload.members.filter((member) => !(member.userId === userId && member.deviceId === deviceId));
    payload.updatedAt = nowIso();
    statements.upsertPartySession.run(payload.joinCode, existing.hostUserId, existing.hostDeviceId, JSON.stringify(payload), payload.updatedAt, null);
    audit(userId, 'party.leave', { joinCode: payload.joinCode, deviceId });
    return payload;
  }

  function listPartySessions(userId) {
    return statements.listPartiesForUser.all(userId).map((row) => ({
      joinCode: row.joinCode,
      hostUserId: row.hostUserId,
      hostDeviceId: row.hostDeviceId,
      updatedAt: row.updatedAt,
      endedAt: row.endedAt,
      payload: JSON.parse(row.payloadJson || '{}')
    }));
  }

  function getParty(joinCode) {
    const row = statements.getPartySession.get(String(joinCode || '').toUpperCase());
    if (!row || row.endedAt) return null;
    return {
      joinCode: row.joinCode,
      hostUserId: row.hostUserId,
      hostDeviceId: row.hostDeviceId,
      updatedAt: row.updatedAt,
      payload: JSON.parse(row.payloadJson || '{}')
    };
  }

  function getMetrics(requestCounts, startedAt) {
    return {
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      databasePath: dbPath,
      counts: {
        users: statements.metricsCounts.users.get().value,
        authTokens: statements.metricsCounts.authTokens.get().value,
        userStateRows: statements.metricsCounts.userState.get().value,
        librarySnapshots: statements.metricsCounts.librarySnapshots.get().value,
        playbackSessions: statements.metricsCounts.playbackSessions.get().value,
        activePartySessions: statements.metricsCounts.partySessions.get().value,
        auditLogs: statements.metricsCounts.auditLogs.get().value
      },
      requests: Object.fromEntries([...requestCounts.entries()].sort(([a], [b]) => a.localeCompare(b)))
    };
  }

  function listAuditLogs(userId, limit = 30) {
    return statements.listAuditLogs.all(userId, Math.max(1, Math.min(Number(limit) || 30, 100))).map((row) => ({
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      createdAt: row.createdAt,
      payload: JSON.parse(row.payloadJson || '{}')
    }));
  }

  function close() {
    db.close();
  }

  log('info', 'backend.store.ready', { dbPath });

  return {
    authenticate,
    audit,
    close,
    getMetrics,
    getParty,
    getSyncBundle,
    listAuditLogs,
    listPlaybackSessions,
    loginUser,
    logout,
    registerUser,
    scrubEmail,
    startParty,
    upsertLibrarySnapshot,
    upsertPlaybackSession,
    upsertUserState,
    updateParty,
    joinParty,
    leaveParty
  };
}

export function createAuralisServer({
  dataDir = DEFAULT_DATA_DIR,
  port = DEFAULT_PORT,
  quiet = false,
  rootDir = DEFAULT_ROOT_DIR
} = {}) {
  ensureDir(dataDir);
  const log = createStructuredLogger({ quiet });
  const startedAt = Date.now();
  const requestCounts = new Map();
  const store = createStore({
    dbPath: path.join(dataDir, 'auralis.db'),
    log
  });

  function recordRequestMetric(routeKey, statusCode) {
    const key = `${routeKey}#${statusCode}`;
    requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  }

  function authFromRequest(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return store.authenticate(header.slice('Bearer '.length).trim());
  }

  async function handleApi(req, res, url) {
    const pathname = url.pathname;
    const method = req.method || 'GET';
    const auth = authFromRequest(req);

    if (pathname === '/api/health' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'auralis-backend',
        now: nowIso()
      });
      return true;
    }

    if (pathname === '/api/metrics' && method === 'GET') {
      sendJson(res, 200, store.getMetrics(requestCounts, startedAt));
      return true;
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = store.registerUser(body);
      sendJson(res, 201, result);
      return true;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = store.loginUser(body);
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      if (auth) {
        const header = req.headers.authorization || '';
        store.logout(header.slice('Bearer '.length).trim(), auth.user.id);
      }
      sendEmpty(res, 204);
      return true;
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      if (!auth) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return true;
      }
      sendJson(res, 200, {
        user: auth.user,
        deviceId: auth.deviceId,
        expiresAt: auth.expiresAt
      });
      return true;
    }

    if (!auth) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return true;
    }

    if (pathname === '/api/sync/full' && method === 'GET') {
      sendJson(res, 200, {
        user: auth.user,
        sync: store.getSyncBundle(auth.user.id)
      });
      return true;
    }

    if (pathname === '/api/sync/full' && method === 'PUT') {
      const body = await readJsonBody(req);
      const response = {
        user: auth.user,
        sync: store.getSyncBundle(auth.user.id),
        conflicts: {}
      };

      if (body.userState) {
        const result = store.upsertUserState({
          userId: auth.user.id,
          payload: body.userState.payload,
          ifMatch: body.userState.ifMatch
        });
        if (result.conflict) response.conflicts.userState = result.resource;
      }

      if (body.librarySnapshot) {
        const result = store.upsertLibrarySnapshot({
          userId: auth.user.id,
          payload: body.librarySnapshot.payload,
          ifMatch: body.librarySnapshot.ifMatch
        });
        if (result.conflict) response.conflicts.librarySnapshot = result.resource;
      }

      if (body.playbackSession?.payload) {
        store.upsertPlaybackSession({
          userId: auth.user.id,
          payload: body.playbackSession.payload,
          deviceId: sanitizeString(body.playbackSession.payload.deviceId, auth.deviceId)
        });
      }

      response.sync = store.getSyncBundle(auth.user.id);
      if (Object.keys(response.conflicts).length) {
        sendJson(res, 409, response);
        return true;
      }
      sendJson(res, 200, response);
      return true;
    }

    if (pathname === '/api/playback/sessions' && method === 'GET') {
      sendJson(res, 200, {
        sessions: store.listPlaybackSessions(auth.user.id)
      });
      return true;
    }

    if (pathname === '/api/playback/heartbeat' && method === 'POST') {
      const body = await readJsonBody(req);
      const session = store.upsertPlaybackSession({
        userId: auth.user.id,
        payload: body,
        deviceId: sanitizeString(body.deviceId, auth.deviceId)
      });
      sendJson(res, 200, { session });
      return true;
    }

    if (pathname === '/api/party/start' && method === 'POST') {
      const body = await readJsonBody(req);
      const payload = store.startParty({
        userId: auth.user.id,
        deviceId: sanitizeString(body.deviceId, auth.deviceId),
        deviceName: sanitizeString(body.deviceName, 'Auralis Host'),
        playbackSession: body.playbackSession
      });
      sendJson(res, 201, { party: payload });
      return true;
    }

    if (pathname === '/api/party/join' && method === 'POST') {
      const body = await readJsonBody(req);
      const payload = store.joinParty({
        userId: auth.user.id,
        deviceId: sanitizeString(body.deviceId, auth.deviceId),
        deviceName: sanitizeString(body.deviceName, 'Auralis Guest'),
        joinCode: body.joinCode
      });
      sendJson(res, 200, { party: payload });
      return true;
    }

    if (pathname === '/api/party/update' && method === 'POST') {
      const body = await readJsonBody(req);
      const payload = store.updateParty({
        userId: auth.user.id,
        deviceId: sanitizeString(body.deviceId, auth.deviceId),
        joinCode: body.joinCode,
        playbackSession: body.playbackSession
      });
      sendJson(res, 200, { party: payload });
      return true;
    }

    if (pathname === '/api/party/leave' && method === 'POST') {
      const body = await readJsonBody(req);
      const payload = store.leaveParty({
        userId: auth.user.id,
        deviceId: sanitizeString(body.deviceId, auth.deviceId),
        joinCode: body.joinCode
      });
      sendJson(res, 200, { party: payload });
      return true;
    }

    if (pathname === '/api/party' && method === 'GET') {
      const joinCode = sanitizeString(url.searchParams.get('joinCode')).toUpperCase();
      if (!joinCode) {
        sendJson(res, 400, { error: 'joinCode is required.' });
        return true;
      }
      const party = store.getParty(joinCode);
      if (!party) {
        sendJson(res, 404, { error: 'Party session not found.' });
        return true;
      }
      sendJson(res, 200, { party });
      return true;
    }

    if (pathname === '/api/audit' && method === 'GET') {
      sendJson(res, 200, {
        entries: store.listAuditLogs(auth.user.id, url.searchParams.get('limit'))
      });
      return true;
    }

    sendJson(res, 404, { error: 'API route not found.' });
    return true;
  }

  async function handleStatic(req, res, url) {
    let pathname = decodeURIComponent(url.pathname || '/');
    if (pathname === '/') pathname = '/Auralis_mock_zenith.html';
    const normalizedPath = path.normalize(pathname).replace(/^([/\\])+/, '');
    const rootPath = path.resolve(rootDir);
    let filePath = path.resolve(rootDir, normalizedPath);
    if (!filePath.startsWith(rootPath)) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    if (!existsSync(filePath)) {
      const musicAliasMatch = pathname.replace(/\\/g, '/').match(/^\/music(?:\/(.*))?$/i);
      if (musicAliasMatch) {
        const suffixParts = String(musicAliasMatch[1] || '')
          .split('/')
          .filter(Boolean);
        const aliasedPath = path.resolve(rootDir, 'Music', ...suffixParts);
        if (!aliasedPath.startsWith(rootPath)) {
          sendText(res, 403, 'Forbidden');
          return;
        }
        if (existsSync(aliasedPath)) {
          filePath = aliasedPath;
        }
      }
    }
    if (!existsSync(filePath)) {
      sendText(res, 404, 'Not found');
      return;
    }
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = STATIC_CONTENT_TYPES.get(ext) || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300'
    });
    createReadStream(filePath).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    const routeKey = `${req.method || 'GET'} ${req.url || '/'}`;
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else {
        await handleStatic(req, res, url);
      }
      recordRequestMetric(routeKey, res.statusCode || 200);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500);
      const message = statusCode >= 500 ? 'Internal server error.' : String(error.message || 'Request failed.');
      log(statusCode >= 500 ? 'error' : 'warn', 'backend.request.failed', {
        routeKey,
        statusCode,
        message
      });
      if (!res.headersSent) sendJson(res, statusCode, { error: message });
      recordRequestMetric(routeKey, statusCode);
    }
  });

  async function start() {
    await new Promise((resolve) => {
      server.listen(port, resolve);
    });
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    log('info', 'backend.server.started', {
      port: actualPort,
      rootDir,
      dataDir
    });
    return {
      port: actualPort,
      origin: `http://127.0.0.1:${actualPort}`
    };
  }

  async function stop() {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    store.close();
  }

  return {
    server,
    start,
    stop
  };
}
