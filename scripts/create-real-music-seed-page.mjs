import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const musicRoot = path.join(repoRoot, 'Music');
const outputDir = path.join(repoRoot, 'output');
const outputPath = path.join(outputDir, 'seed-real-music.html');

const audioExtensions = new Set(['.flac', '.mp3', '.m4a']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const imagePriority = ['album art', 'cover', 'folder', 'front'];
const mimeTypes = {
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4'
};

function slashPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function encodeMusicUrl(relativePath) {
  return `/music/${slashPath(relativePath).split('/').map(encodeURIComponent).join('/')}`;
}

function parseTrackFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const numbered = base.match(/^(\d{1,3})[\s.\-_]+(.+)$/);
  if (numbered) return { no: Number(numbered[1]), title: numbered[2].trim() };
  const dashed = base.match(/^(.+?)\s*-\s*(.+)$/);
  if (dashed) return { no: 0, title: dashed[2].trim() };
  return { no: 0, title: base.trim() };
}

function extractYear(text) {
  const match = String(text || '').match(/(?:\(|\[)?((?:19|20)\d{2})(?:\)|\])?/);
  return match ? match[1] : '';
}

function durationLabel(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function walk(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = slashPath(path.join(prefix, entry.name));
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function pickAlbumArt(files) {
  const images = files
    .filter((file) => imageExtensions.has(path.extname(file).toLowerCase()))
    .sort((left, right) => {
      const leftName = path.basename(left).toLowerCase();
      const rightName = path.basename(right).toLowerCase();
      const leftIndex = imagePriority.findIndex((token) => leftName.includes(token));
      const rightIndex = imagePriority.findIndex((token) => rightName.includes(token));
      const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return safeLeft - safeRight || leftName.localeCompare(rightName);
    });
  return images[0] ? encodeMusicUrl(images[0]) : '';
}

const allFiles = await walk(musicRoot);
const albumFiles = new Map();
for (const file of allFiles) {
  const dir = slashPath(path.dirname(file));
  if (!albumFiles.has(dir)) albumFiles.set(dir, []);
  albumFiles.get(dir).push(file);
}

const folderId = 'local-real-music';
const albums = [];
const scannedFiles = [];

for (const [albumDir, files] of [...albumFiles.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
  const audioFiles = files
    .filter((file) => audioExtensions.has(path.extname(file).toLowerCase()))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true, sensitivity: 'base' }));
  if (!audioFiles.length) continue;

  const segments = albumDir.split('/').filter(Boolean);
  const artist = segments[0] || 'Unknown Artist';
  const albumTitle = segments.slice(1).join('/') || artist || 'Unknown Album';
  const year = extractYear(albumTitle) || extractYear(albumDir);
  const artUrl = pickAlbumArt(files);
  const tracks = [];

  for (const [index, relativePath] of audioFiles.entries()) {
    const absolutePath = path.join(musicRoot, relativePath);
    const fileStat = await stat(absolutePath);
    const ext = path.extname(relativePath).toLowerCase();
    const parsed = parseTrackFilename(path.basename(relativePath));
    const durationSec = 150 + (index * 11);
    const subDir = slashPath(path.dirname(relativePath));
    const name = path.basename(relativePath);

    tracks.push({
      no: parsed.no || index + 1,
      title: parsed.title || name.replace(ext, ''),
      artist,
      albumArtist: artist,
      albumTitle,
      year,
      genre: '',
      duration: durationLabel(durationSec),
      durationSec,
      ext: ext.slice(1),
      discNo: 0,
      artUrl,
      fileUrl: encodeMusicUrl(relativePath),
      path: relativePath,
      _handleKey: '',
      _trackId: `local:${relativePath.toLowerCase()}`,
      _sourceAlbumId: `local:${albumDir.toLowerCase()}`,
      _sourceAlbumTitle: albumTitle,
      _embeddedAlbumTitle: albumTitle,
      _fileSize: fileStat.size,
      _lastModified: Math.floor(fileStat.mtimeMs),
      _metadataSource: 'local-seed',
      _metadataQuality: 'trusted',
      _scanned: true,
      _metaDone: true
    });

    scannedFiles.push({
      name,
      folderId,
      path: relativePath,
      subDir,
      size: fileStat.size,
      type: mimeTypes[ext] || 'application/octet-stream',
      lastModified: Math.floor(fileStat.mtimeMs)
    });
  }

  const totalDuration = tracks.reduce((sum, track) => sum + track.durationSec, 0);
  albums.push({
    _cacheSchema: 4,
    id: `local:${albumDir.toLowerCase()}`,
    title: albumTitle,
    artist,
    albumArtist: artist,
    year,
    genre: '',
    artUrl,
    trackCount: tracks.length,
    totalDurationLabel: durationLabel(totalDuration),
    tracks,
    _sourceAlbumId: `local:${albumDir.toLowerCase()}`,
    _sourceAlbumTitle: albumTitle,
    _scanned: true,
    _metaDone: true
  });
}

const payload = {
  storageVersion: '20260419-runtime-refactor-v1',
  libraryCache: { schema: 4, albums },
  folders: [{
    id: folderId,
    name: 'Music',
    handle: null,
    fileCount: scannedFiles.length,
    lastScanned: Date.now()
  }],
  scannedFiles
};

const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');
const html = `<!doctype html>
<meta charset="utf-8">
<title>Load Auralis Music</title>
<style>
  html, body { margin: 0; width: 100%; height: 100%; background: #111; color: #f7f7f7; font: 16px/1.5 system-ui, sans-serif; overflow: hidden; }
  main { position: fixed; inset: 0; display: grid; place-items: center; z-index: 2; background: #111; }
  main > div { max-width: 520px; padding: 32px; }
  strong { display: block; font-size: 22px; margin-bottom: 8px; }
  iframe { width: 100%; height: 100%; border: 0; display: block; }
  .loaded main { display: none; }
</style>
<main>
  <div>
    <strong>Loading your local music...</strong>
    <div id="status">Preparing the library.</div>
  </div>
</main>
<iframe id="app-frame" src="/Auralis_mock_zenith.html?realMusicSeedFrame=${Date.now()}"></iframe>
<script type="application/json" id="seed-data">${payloadJson}</script>
<script>
(async () => {
  const status = document.getElementById('status');
  const frame = document.getElementById('app-frame');
  const data = JSON.parse(document.getElementById('seed-data').textContent);
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('auralis_storage_version', data.storageVersion);
  localStorage.setItem('auralis_onboarded', '1');
  localStorage.setItem('auralis_setup_done', '1');
  localStorage.setItem('auralis_library_cache_v2', JSON.stringify(data.libraryCache));
  status.textContent = 'Indexed ' + data.scannedFiles.length + ' tracks across ' + data.libraryCache.albums.length + ' albums.';

  await new Promise((resolve, reject) => {
    const request = indexedDB.open('auralis_media_db', 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('scanned_files')) {
        const store = db.createObjectStore('scanned_files', { keyPath: ['folderId', 'path'] });
        store.createIndex('folderId', 'folderId', { unique: false });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const stores = Array.from(db.objectStoreNames).filter((name) => ['folders', 'scanned_files'].includes(name));
      if (!stores.length) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(stores, 'readwrite');
      if (stores.includes('folders')) {
        const folderStore = tx.objectStore('folders');
        folderStore.clear();
      }
      if (stores.includes('scanned_files')) {
        const fileStore = tx.objectStore('scanned_files');
        fileStore.clear();
      }
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

  await new Promise((resolve) => {
    if (frame.contentDocument?.readyState === 'complete') resolve();
    else frame.addEventListener('load', resolve, { once: true });
  });
  const appWindow = frame.contentWindow;
  await new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (appWindow?.AuralisApp?._installLibrarySnapshot) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > 10000) {
        clearInterval(timer);
        reject(new Error('The player did not become ready in time.'));
      }
    }, 100);
  });
  appWindow.localStorage.setItem('auralis_storage_version', data.storageVersion);
  appWindow.localStorage.setItem('auralis_onboarded', '1');
  appWindow.localStorage.setItem('auralis_setup_done', '1');
  appWindow.localStorage.setItem('auralis_library_cache_v2', JSON.stringify(data.libraryCache));
  appWindow.AuralisApp._installLibrarySnapshot(data.libraryCache.albums, {
    force: true,
    renderHome: true,
    renderLibrary: true,
    syncEmpty: true,
    updateHealth: true,
    resetPlayback: true
  });
  appWindow.AuralisApp.switchTab('library');
  const library = appWindow.AuralisApp._getLibrary();
  const searchInput = appWindow.document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = 'EELS';
    searchInput.dispatchEvent(new appWindow.Event('input', { bubbles: true }));
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  document.body.dataset.librarySummary = JSON.stringify({
    albums: Array.isArray(library?.albums) ? library.albums.length : 0,
    tracks: Array.isArray(library?.tracks) ? library.tracks.length : 0,
    searchText: appWindow.document.getElementById('search-results')?.textContent?.trim().slice(0, 500) || ''
  });
  document.documentElement.classList.add('loaded');
})().catch((error) => {
  document.getElementById('status').textContent = 'Could not load music: ' + (error?.message || error);
});
</script>
`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, html, 'utf8');

console.log(`Wrote ${outputPath}`);
console.log(`Albums: ${albums.length}`);
console.log(`Tracks: ${scannedFiles.length}`);
