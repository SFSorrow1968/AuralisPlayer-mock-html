import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'Auralis_mock_zenith.html');
const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture console output
    page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));

    await page.goto(fileUrl);
    // Give the app time to boot and hydrate from localStorage/IDB
    await page.waitForTimeout(3000);

    // Dump the LIBRARY_ALBUMS, LIBRARY_ARTISTS from window scope
    const result = await page.evaluate(() => {
        const albums = (typeof LIBRARY_ALBUMS !== 'undefined' ? LIBRARY_ALBUMS : []);
        const artists = (typeof LIBRARY_ARTISTS !== 'undefined' ? LIBRARY_ARTISTS : []);
        const tracks = (typeof LIBRARY_TRACKS !== 'undefined' ? LIBRARY_TRACKS : []);

        return {
            artistCount: artists.length,
            artists: artists.map(a => ({
                name: a.name,
                trackCount: a.trackCount,
                albumCount: a.albumCount
            })),
            albumCount: albums.length,
            albums: albums.map(a => ({
                title: a.title,
                artist: a.artist,
                albumArtist: a.albumArtist,
                isCompilation: a.isCompilation,
                trackCount: a.trackCount || (a.tracks && a.tracks.length)
            })),
            sampleTracks: tracks.slice(0, 10).map(t => ({
                title: t.title,
                artist: t.artist,
                albumArtist: t.albumArtist,
                albumTitle: t.albumTitle
            }))
        };
    });

    console.log('\n=== LIBRARY ARTISTS ===');
    result.artists.forEach(a => {
        console.log(`  "${a.name}" — ${a.trackCount} tracks, ${a.albumCount} albums`);
    });

    console.log('\n=== LIBRARY ALBUMS ===');
    result.albums.forEach(a => {
        console.log(`  "${a.title}" by "${a.artist}" | albumArtist="${a.albumArtist}" | compilation=${a.isCompilation} | tracks=${a.trackCount}`);
    });

    console.log('\n=== SAMPLE TRACKS ===');
    result.sampleTracks.forEach(t => {
        console.log(`  "${t.title}" | artist="${t.artist}" | albumArtist="${t.albumArtist}" | album="${t.albumTitle}"`);
    });

    await browser.close();
})();
