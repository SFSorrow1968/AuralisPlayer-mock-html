/**
 * Playwright verification: artist grouping uses track.artist, NOT albumArtist.
 * 
 * Simulates the real scenario:
 * - Tracks from various Minutemen albums in a "Miscellaneous" folder
 * - Some tracks have albumArtist tags, some don't
 * - Folder name "Music" should never appear as an artist
 * - "Various Artists" should never appear as an artist
 * - Each track's tagged artist should be the grouping key
 */
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const PORT = 9876;

// Serve static files so the app can load (file:// has CORS issues with some APIs)
function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            // Strip query string for file resolution
            const urlPath = decodeURIComponent(req.url.split('?')[0]);
            let filePath = path.join(ROOT, urlPath === '/' ? '/Auralis_mock_zenith.html' : urlPath);
            if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
            fs.readFile(filePath, (err, data) => {
                if (err) { res.writeHead(404); res.end('Not found: ' + filePath); return; }
                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(PORT, () => resolve(server));
    });
}

(async () => {
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warn') {
            console.log(`[PAGE ${msg.type()}] ${msg.text()}`);
        }
    });
    page.on('requestfailed', req => {
        console.log(`[NETWORK FAIL] ${req.url()} — ${req.failure()?.errorText}`);
    });

    await page.goto(`http://localhost:${PORT}/`);
    // Wait for AuralisApp to be defined (the IIFE runs after DOMContentLoaded)
    try {
        await page.waitForFunction(() => window.AuralisApp && typeof window.AuralisApp._installLibrarySnapshot === 'function', { timeout: 10000 });
    } catch (e) {
        const debug = await page.evaluate(() => ({
            hasAuralisApp: typeof window.AuralisApp !== 'undefined',
            keys: typeof window.AuralisApp === 'object' ? Object.keys(window.AuralisApp) : [],
            docState: document.readyState
        }));
        console.error('Timeout waiting for AuralisApp._installLibrarySnapshot');
        console.error('Debug:', JSON.stringify(debug, null, 2));
        await browser.close();
        server.close();
        process.exit(1);
    }

    // ── Inject mock library data that mimics the real scenario ──
    const result = await page.evaluate(() => {
        // The user's library has a "Music" root folder. Inside is "Minutemen/Miscellaneous/"
        // with tracks from various Minutemen albums. Some tracks have albumArtist tags.
        // Also tests the exact bug: tracks at root of "Music" folder with placeholder album/artist.
        const mockAlbums = [
            {
                id: 'test_misc',
                title: 'Miscellaneous',      // folder-derived album name
                artist: 'Music',             // folder-derived (root folder name — the bug)
                albumArtist: '',
                year: '',
                genre: '',
                artUrl: '',
                trackCount: 6,
                totalDurationLabel: '10:00',
                _scanned: true,
                _metaDone: true,
                tracks: [
                    { no: 1, title: 'Corona',              artist: 'Minutemen', albumArtist: '', albumTitle: 'Acoustic Blowout!', year: '1985', genre: 'Acoustic Rock', duration: '2:31', durationSec: 151, ext: 'flac', _metaDone: true },
                    { no: 2, title: 'Themselves',           artist: 'Minutemen', albumArtist: '', albumTitle: 'Acoustic Blowout!', year: '1985', genre: 'Acoustic Rock', duration: '1:21', durationSec: 81,  ext: 'flac', _metaDone: true },
                    { no: 1, title: 'I Felt Like A Gringo', artist: 'Minutemen', albumArtist: '', albumTitle: 'Ballot Result',     year: '1986', genre: 'Post-Hardcore', duration: '1:46', durationSec: 106, ext: 'flac', _metaDone: true },
                    { no: 1, title: '930 May 2',            artist: 'Minutemen', albumArtist: '', albumTitle: 'My First Bells (Incomplete)', year: '1980', genre: 'Post-Hardcore', duration: '2:07', durationSec: 127, ext: 'flac', _metaDone: true },
                    { no: 1, title: 'The Red and the Black',artist: 'Minutemen', albumArtist: '', albumTitle: 'Acoustic Blowout!', year: '1985', genre: 'Acoustic Rock', duration: '3:54', durationSec: 234, ext: 'flac', _metaDone: true },
                    { no: 1, title: 'Badges',               artist: 'Minutemen', albumArtist: '', albumTitle: 'Acoustic Blowout!', year: '1985', genre: 'Acoustic Rock', duration: '0:49', durationSec: 49,  ext: 'flac', _metaDone: true },
                ]
            },
            {
                // Simulates the EXACT screenshot bug: album title = "Music" (root folder name),
                // some tracks have artist tag, some have "Music" placeholder from folder,
                // all have albumTitle = "Music" (no album tag in file metadata).
                id: 'test_root_music',
                title: 'Music',              // ← THE BUG: this should be replaced with "Unknown Album"
                artist: 'Music',             // ← also placeholder
                albumArtist: '',
                year: '',
                genre: '',
                artUrl: '',
                trackCount: 3,
                totalDurationLabel: '6:00',
                _scanned: true,
                _metaDone: true,
                tracks: [
                    // Tracks with proper artist tags but no album tag (albumTitle = "Music" from folder)
                    { no: 1, title: 'Fake Track 1', artist: 'Minutemen', albumArtist: '', albumTitle: 'Music', year: '1984', genre: '', duration: '2:00', durationSec: 120, ext: 'mp3', _metaDone: true },
                    { no: 2, title: 'Fake Track 2', artist: 'Minutemen', albumArtist: '', albumTitle: 'Music', year: '1984', genre: '', duration: '2:00', durationSec: 120, ext: 'mp3', _metaDone: true },
                    // Track with NO artist tag — got "Music" from folder name (the artistGuess bug)
                    { no: 3, title: 'Fake Track 3', artist: 'Music',     albumArtist: '', albumTitle: 'Music', year: '',     genre: '', duration: '2:00', durationSec: 120, ext: 'mp3', _metaDone: true },
                ]
            },
            {
                id: 'test_tago',
                title: 'Tago Mago',
                artist: 'Can',
                albumArtist: 'Can',
                year: '1971',
                genre: 'Krautrock',
                artUrl: '',
                trackCount: 3,
                totalDurationLabel: '30:00',
                _scanned: true,
                _metaDone: true,
                tracks: [
                    { no: 1, title: 'Paperhouse',  artist: 'Can', albumArtist: 'Can', albumTitle: 'Tago Mago', year: '1971', genre: 'Krautrock', duration: '7:29', durationSec: 449, ext: 'flac', _metaDone: true },
                    { no: 2, title: 'Mushroom',     artist: 'Can', albumArtist: 'Can', albumTitle: 'Tago Mago', year: '1971', genre: 'Krautrock', duration: '4:09', durationSec: 249, ext: 'flac', _metaDone: true },
                    { no: 3, title: 'Oh Yeah',      artist: 'Can', albumArtist: 'Can', albumTitle: 'Tago Mago', year: '1971', genre: 'Krautrock', duration: '7:22', durationSec: 442, ext: 'flac', _metaDone: true },
                ]
            },
            {
                id: 'test_treasure',
                title: 'Treasure',
                artist: 'Cocteau Twins',
                albumArtist: 'Cocteau Twins',
                year: '1984',
                genre: 'Dream Pop',
                artUrl: '',
                trackCount: 3,
                totalDurationLabel: '12:00',
                _scanned: true,
                _metaDone: true,
                tracks: [
                    { no: 1, title: 'Ivo',      artist: 'Cocteau Twins', albumArtist: 'Cocteau Twins', albumTitle: 'Treasure', year: '1984', genre: 'Dream Pop', duration: '3:17', durationSec: 197, ext: 'flac', _metaDone: true },
                    { no: 2, title: 'Lorelei',   artist: 'Cocteau Twins', albumArtist: 'Cocteau Twins', albumTitle: 'Treasure', year: '1984', genre: 'Dream Pop', duration: '4:01', durationSec: 241, ext: 'flac', _metaDone: true },
                    { no: 3, title: 'Beatrix',   artist: 'Cocteau Twins', albumArtist: 'Cocteau Twins', albumTitle: 'Treasure', year: '1984', genre: 'Dream Pop', duration: '5:03', durationSec: 303, ext: 'flac', _metaDone: true },
                ]
            },
            {
                id: 'test_clouddead',
                title: 'cLOUDDEAD',
                artist: 'cLOUDDEAD',
                albumArtist: 'cLOUDDEAD',
                year: '2001',
                genre: 'Experimental Hip Hop',
                artUrl: '',
                trackCount: 2,
                totalDurationLabel: '8:00',
                _scanned: true,
                _metaDone: true,
                tracks: [
                    { no: 1, title: 'Apt. A (1)', artist: 'cLOUDDEAD', albumArtist: 'cLOUDDEAD', albumTitle: 'cLOUDDEAD', year: '2001', genre: 'Experimental Hip Hop', duration: '4:00', durationSec: 240, ext: 'flac', _metaDone: true },
                    { no: 2, title: 'Apt. A (2)', artist: 'cLOUDDEAD', albumArtist: 'cLOUDDEAD', albumTitle: 'cLOUDDEAD', year: '2001', genre: 'Experimental Hip Hop', duration: '4:00', durationSec: 240, ext: 'flac', _metaDone: true },
                ]
            }
        ];

        // Call the app's own library builder
        if (!window.AuralisApp || typeof window.AuralisApp._installLibrarySnapshot !== 'function') {
            return { error: 'AuralisApp._installLibrarySnapshot not found — app not loaded' };
        }

        window.AuralisApp._installLibrarySnapshot(mockAlbums, { force: true });

        // Now inspect the resulting state
        const lib = window.AuralisApp._getLibrary();
        const artists = lib.artists;
        const albums  = lib.albums;
        const tracks  = lib.tracks;

        return {
            artists: artists.map(a => ({ name: a.name, trackCount: a.trackCount, albumCount: a.albumCount })),
            albums: albums.map(a => ({
                title: a.title,
                artist: a.artist,
                albumArtist: a.albumArtist,
                isCompilation: a.isCompilation,
                year: a.year,
                trackCount: a.trackCount || a.tracks?.length
            })),
            trackArtists: tracks.map(t => ({ title: t.title, artist: t.artist, albumArtist: t.albumArtist })),
        };
    });

    await browser.close();
    server.close();

    // ── ASSERTIONS ──
    let passed = 0;
    let failed = 0;

    function assert(condition, msg) {
        if (condition) {
            console.log(`  ✓ ${msg}`);
            passed++;
        } else {
            console.error(`  ✗ FAIL: ${msg}`);
            failed++;
        }
    }

    if (result.error) {
        console.error('ERROR:', result.error);
        process.exit(1);
    }

    console.log('\n=== LIBRARY ARTISTS ===');
    result.artists.forEach(a => console.log(`  "${a.name}" — ${a.trackCount} tracks, ${a.albumCount} albums`));

    console.log('\n=== LIBRARY ALBUMS ===');
    result.albums.forEach(a => console.log(`  "${a.title}" by "${a.artist}" | albumArtist="${a.albumArtist}" | compilation=${a.isCompilation} | tracks=${a.trackCount}`));

    console.log('\n=== ASSERTIONS ===');

    // 1. "Music" must NEVER be an artist name
    const musicArtist = result.artists.find(a => a.name.toLowerCase() === 'music');
    assert(!musicArtist, '"Music" must not appear as an artist');

    // 2. "Various Artists" must NEVER be an artist name
    const vaArtist = result.artists.find(a => a.name === 'Various Artists');
    assert(!vaArtist, '"Various Artists" must not appear as an artist');

    // 3. "Unknown Artist" must NEVER appear (all tracks have tagged artists)
    const unknownArtist = result.artists.find(a => a.name === 'Unknown Artist');
    assert(!unknownArtist, '"Unknown Artist" must not appear');

    // 4. Minutemen must be an artist with 9 tracks (6 Miscellaneous + 3 root-Music)
    const minutemen = result.artists.find(a => a.name === 'Minutemen');
    assert(minutemen, 'Minutemen must be an artist');
    assert(minutemen && minutemen.trackCount === 9, `Minutemen must have 9 tracks (got ${minutemen?.trackCount})`);

    // 5. Can must be an artist with 3 tracks
    const can = result.artists.find(a => a.name === 'Can');
    assert(can, 'Can must be an artist');
    assert(can && can.trackCount === 3, `Can must have 3 tracks (got ${can?.trackCount})`);

    // 6. Cocteau Twins must be an artist with 3 tracks
    const ct = result.artists.find(a => a.name === 'Cocteau Twins');
    assert(ct, 'Cocteau Twins must be an artist');
    assert(ct && ct.trackCount === 3, `Cocteau Twins must have 3 tracks (got ${ct?.trackCount})`);

    // 7. cLOUDDEAD must be an artist with 2 tracks
    const cd = result.artists.find(a => a.name === 'cLOUDDEAD');
    assert(cd, 'cLOUDDEAD must be an artist');
    assert(cd && cd.trackCount === 2, `cLOUDDEAD must have 2 tracks (got ${cd?.trackCount})`);

    // 8. Exactly 4 artists total
    assert(result.artists.length === 4, `Expected 4 artists, got ${result.artists.length}: ${result.artists.map(a=>a.name).join(', ')}`);

    // 9. No track should have artist = "Music"
    const musicTracks = result.trackArtists.filter(t => t.artist.toLowerCase() === 'music');
    assert(musicTracks.length === 0, `No track should have artist "Music" (found ${musicTracks.length})`);

    // 10. All Minutemen tracks should have artist = "Minutemen" 
    // 6 from the Miscellaneous album + 3 from the root-Music album (including 1 propagated from album.artist)
    const minutemenTracks = result.trackArtists.filter(t => t.artist === 'Minutemen');
    assert(minutemenTracks.length === 9, `All 9 Minutemen tracks should keep artist "Minutemen" (got ${minutemenTracks.length})`);

    // 11. No page errors
    assert(errors.length === 0, `No page errors (got ${errors.length}: ${errors.join('; ')})`);

    // 12. The "Miscellaneous" album should show artist "Minutemen" (not "Music")
    const miscAlbum = result.albums.find(a => a.title === 'Miscellaneous');
    assert(miscAlbum && miscAlbum.artist === 'Minutemen', `Miscellaneous album.artist should be "Minutemen" (got "${miscAlbum?.artist}")`);

    // 13. No album should have artist "Music"
    const musicAlbums = result.albums.filter(a => a.artist.toLowerCase() === 'music');
    assert(musicAlbums.length === 0, `No album should have artist "Music" (found ${musicAlbums.length})`);

    // 14. No album should have title "Music" (root folder name must be replaced)
    const musicTitleAlbums = result.albums.filter(a => a.title.toLowerCase() === 'music');
    assert(musicTitleAlbums.length === 0, `No album should be titled "Music" (found ${musicTitleAlbums.length}: ${musicTitleAlbums.map(a=>a.title).join(', ')})`);

    // 15. The formerly-"Music"-titled album should now be "Unknown Album"
    const unknownAlbum = result.albums.find(a => a.title === 'Unknown Album');
    assert(unknownAlbum, 'Former "Music" album should be renamed to "Unknown Album"');

    // 16. "Unknown Album" should have artist "Minutemen" (derived from majority of track.artist)
    assert(unknownAlbum && unknownAlbum.artist === 'Minutemen', `"Unknown Album" artist should be "Minutemen" (got "${unknownAlbum?.artist}")`);

    // 17. No track should have artist "Music" — including the untagged one that got
    //     "Music" from the folder name (should have been propagated "Minutemen" from album)
    const musicTracks2 = result.trackArtists.filter(t => t.artist.toLowerCase() === 'music');
    assert(musicTracks2.length === 0, `No track should have artist "Music" after snapshot fix (found ${musicTracks2.length})`);

    // 18. Year should be preserved when tracks have year tags
    const tagoAlbum = result.albums.find(a => a.title === 'Tago Mago');
    assert(tagoAlbum && tagoAlbum.year === '1971', `Tago Mago year should be "1971" (got "${tagoAlbum?.year}")`);

    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
})();
