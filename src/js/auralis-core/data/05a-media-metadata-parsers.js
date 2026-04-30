/*
 * Auralis JS shard: 05-media-folder-idb.js
 * Purpose: IndexedDB media folders, scanning, fallback folder picker plumbing
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        const scrim = getEl('image-viewer-scrim');
        if (!scrim) return;
        scrim.classList.remove('show');
        albumArtViewerOpen = false;
        syncBottomNavVisibility();
        const focusTarget = albumArtViewerLastFocus;
        albumArtViewerLastFocus = null;
        if (focusTarget && typeof focusTarget.focus === 'function') {
            setTimeout(() => focusTarget.focus({ preventScroll: true }), 0);
        }
    }

    // Onboarding
    function dismissOnboarding() {
        const ob = getEl('onboarding');
        if (!ob) return;
        safeStorage.setItem(ONBOARDED_KEY, '1');
        ob.classList.remove('active');
        setTimeout(() => {
            ob.style.display = 'none';
        if (safeStorage.getItem(SETUP_DONE_KEY) !== '1') {
                showFirstTimeSetup();
            } else {
                syncBottomNavVisibility();
            }
        }, 500);
    }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Â§ MEDIA FOLDER SYSTEM â€” Real File System Access + IndexedDB
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    const AUDIO_EXTENSIONS = new Set(['mp3','flac','wav','ogg','opus','aac','m4a','wma','aiff','alac','ape','webm']);
    const IMAGE_EXTENSIONS = new Set(['jpg','jpeg','png','webp','gif','bmp']);
    const ART_FILENAME_PATTERNS = ['cover','folder','album art','front','albumart','albumartsmall','thumb','artwork','scan','booklet','image','art','jacket','sleeve','insert','disc','cd','back','inlay'];

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Â§ LIGHTWEIGHT METADATA PARSER â€” ID3v2, Vorbis Comment, MP4 atoms
    // Reads embedded artwork + full tags from File objects (ArrayBuffer).
    // Zero external dependencies.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Parse as many bytes as we need from the start of a File.
     * ID3v2 headers are at offset 0, so we read a safe chunk upfront.
     */
    async function readFileChunk(file, maxBytes = 0) {
        const size = maxBytes > 0 ? Math.min(file.size, maxBytes) : file.size;
        const buf = await file.slice(0, size).arrayBuffer();
        return new Uint8Array(buf);
    }

    /**
     * Read the last N bytes of a File (needed for ID3v1 tags at EOF).
     */
    async function readFileTail(file, tailBytes = 128) {
        if (file.size < tailBytes) return new Uint8Array(0);
        const buf = await file.slice(file.size - tailBytes).arrayBuffer();
        return new Uint8Array(buf);
    }

    /**
     * Decode a syncsafe integer (ID3v2.4 uses these for tag/frame sizes).
     */
    function decodeSyncsafe(b0, b1, b2, b3) {
        return ((b0 & 0x7F) << 21) | ((b1 & 0x7F) << 14) | ((b2 & 0x7F) << 7) | (b3 & 0x7F);
    }

    /**
     * Read a null-terminated or fixed-length Latin-1/UTF-8/UTF-16 string
     * from a Uint8Array at offset `start` with length `len`.
     * `encoding`: 0=Latin-1, 1=UTF-16 BOM, 2=UTF-16 BE, 3=UTF-8
     */
    function decodeID3String(bytes, start, len, encoding) {
        const slice = bytes.subarray(start, start + len);
        try {
            if (encoding === 1 || encoding === 2) {
                // UTF-16: strip BOM if present, find null terminator (two 0x00)
                let s = start;
                let hasBom = false;
                let isBE = encoding === 2;
                if (encoding === 1 && s + 1 < start + len) {
                    if (bytes[s] === 0xFF && bytes[s + 1] === 0xFE) { s += 2; hasBom = true; isBE = false; }
                    else if (bytes[s] === 0xFE && bytes[s + 1] === 0xFF) { s += 2; hasBom = true; isBE = true; }
                }
                const end = Math.min(start + len, bytes.length);
                const subSlice = bytes.subarray(s, end);
                return new TextDecoder(isBE ? 'utf-16be' : 'utf-16le').decode(subSlice).replace(/\0.*$/, '');
            }
            if (encoding === 3) {
                return new TextDecoder('utf-8').decode(slice).replace(/\0.*$/, '');
            }
            // Latin-1
            return new TextDecoder('latin1').decode(slice).replace(/\0.*$/, '');
        } catch (_) {
            return '';
        }
    }

    /**
     * Parse ID3v2.2, 2.3 or 2.4 tags from the given bytes.
     * Returns { title, artist, album, year, genre, trackNo, pictureMime, pictureData }
     */
    function parseID3v2(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0, lyrics: '', replayGainTrack: NaN, replayGainAlbum: NaN };
        if (bytes.length < 10) return result;
        // Check header
        if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return result; // 'ID3'
        const majorVersion = bytes[3]; // 2, 3 or 4
        const flags = bytes[5];
        const hasExtHeader = (flags & 0x40) !== 0;
        const tagSize = decodeSyncsafe(bytes[6], bytes[7], bytes[8], bytes[9]);

        let pos = 10;
        if (hasExtHeader) {
            // Skip extended header
            const extSize = majorVersion === 4
                ? decodeSyncsafe(bytes[10], bytes[11], bytes[12], bytes[13])
                : ((bytes[10] << 24) | (bytes[11] << 16) | (bytes[12] << 8) | bytes[13]);
            pos += extSize;
        }

        const end = Math.min(10 + tagSize, bytes.length);
        const isV22 = majorVersion === 2;
        const frameIdLen = isV22 ? 3 : 4;
        const frameSizeLen = isV22 ? 3 : 4;

        let pictureMime = '';
        let pictureData = null;

        while (pos + frameIdLen + frameSizeLen < end) {
            // Frame ID
            const frameId = String.fromCharCode(...bytes.subarray(pos, pos + frameIdLen));
            pos += frameIdLen;
            if (frameId === '\0\0\0\0' || frameId === '\0\0\0') break; // padding

            // Frame size
            let frameSize;
            if (isV22) {
                frameSize = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
                pos += 3;
            } else if (majorVersion === 4) {
                frameSize = decodeSyncsafe(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
                pos += 4;
                pos += 2; // flags
            } else {
                frameSize = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
                pos += 4;
                pos += 2; // flags
            }

            if (frameSize <= 0 || pos + frameSize > end) break;

            const dataStart = pos;
            const encoding = bytes[dataStart];

            // Text frames
            const textFrames = isV22
                ? { TT2: 'title', TP1: 'artist', TP2: 'albumArtist', TAL: 'album', TYE: 'year', TCO: 'genre', TRK: 'trackNo', TPA: 'discNo' }
                : { TIT2: 'title', TPE1: 'artist', TPE2: 'albumArtist', TALB: 'album', TDRC: 'year', TYER: 'year', TCON: 'genre', TRCK: 'trackNo', TPOS: 'discNo' };

            if (textFrames[frameId]) {
                const str = decodeID3String(bytes, dataStart + 1, frameSize - 1, encoding).trim();
                if (textFrames[frameId] === 'trackNo') {
                    result.trackNo = parseInt(str.split('/')[0], 10) || 0;
                } else if (textFrames[frameId] === 'discNo') {
                    result.discNo = parseInt(str.split('/')[0], 10) || 0;
                } else if (textFrames[frameId] === 'genre') {
                    // Strip ID3v1 numeric genre codes like "(17)" â†’ "Rock"
                    result.genre = str.replace(/^\((\d+)\).*/, (_, n) => ID3_GENRES[parseInt(n, 10)] || str).trim();
                } else if (!result[textFrames[frameId]]) {
                    result[textFrames[frameId]] = str;
                }
            }

            // Picture frame
            const picFrame = isV22 ? 'PIC' : 'APIC';
            if (frameId === picFrame && !pictureData) {
                let p = dataStart + 1; // skip encoding byte
                if (isV22) {
                    // ID3v2.2 PIC: encoding(1) + image_format(3) + picture_type(1) + description + null + data
                    const imgFmt = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2]).toUpperCase();
                    p += 3;
                    pictureMime = imgFmt === 'PNG' ? 'image/png' : 'image/jpeg';
                } else {
                    // APIC: encoding(1) + mime_string + null(1) + picture_type(1) + description + null + data
                    let mimeEnd = p;
                    while (mimeEnd < pos + frameSize && bytes[mimeEnd] !== 0) mimeEnd++;
                    pictureMime = new TextDecoder('latin1').decode(bytes.subarray(p, mimeEnd));
                    if (!pictureMime || pictureMime === 'PNG') pictureMime = 'image/png';
                    if (pictureMime === 'JPG') pictureMime = 'image/jpeg';
                    if (!pictureMime.startsWith('image/')) pictureMime = 'image/jpeg';
                    p = mimeEnd + 1; // skip null terminator
                }
                const picType = bytes[p]; p++; // picture type (3 = front cover)
                // Skip description (null-terminated, respect encoding)
                const nullStride = (encoding === 1 || encoding === 2) ? 2 : 1;
                while (p < pos + frameSize - nullStride) {
                    if (nullStride === 2 ? (bytes[p] === 0 && bytes[p + 1] === 0) : bytes[p] === 0) { p += nullStride; break; }
                    p += nullStride;
                }
                // Only use front cover (type 3) unless no other found
                if (p < pos + frameSize && (picType === 3 || !pictureData)) {
                    const candidateData = bytes.slice(p, pos + frameSize);
                    // Validate image magic: JPEG (FF D8) or PNG (89 50 4E 47)
                    const isJpeg = candidateData.length > 2 && candidateData[0] === 0xFF && candidateData[1] === 0xD8;
                    const isPng  = candidateData.length > 4 && candidateData[0] === 0x89 && candidateData[1] === 0x50 && candidateData[2] === 0x4E && candidateData[3] === 0x47;
                    if (isJpeg || isPng) {
                        pictureData = candidateData;
                        result._pictureMime = pictureMime;
                        result._pictureData = pictureData;
                    }
                }
            }

            // TXXX user-defined text frame (ReplayGain lives here)
            const txxxFrame = isV22 ? 'TXX' : 'TXXX';
            if (frameId === txxxFrame) {
                const str = decodeID3String(bytes, dataStart + 1, frameSize - 1, encoding);
                const nullIdx = str.indexOf('\0');
                if (nullIdx >= 0) {
                    const desc = str.slice(0, nullIdx).toUpperCase().trim();
                    const val = str.slice(nullIdx + 1).trim();
                    if (desc === 'REPLAYGAIN_TRACK_GAIN') result.replayGainTrack = parseFloat(val) || NaN;
                    else if (desc === 'REPLAYGAIN_ALBUM_GAIN') result.replayGainAlbum = parseFloat(val) || NaN;
                }
            }

            // USLT unsynchronized lyrics
            const usltFrame = isV22 ? 'ULT' : 'USLT';
            if (frameId === usltFrame && !result.lyrics) {
                let p = dataStart + 1; // skip encoding byte
                p += 3; // skip language code
                // skip content descriptor (null-terminated)
                const nullStride2 = (encoding === 1 || encoding === 2) ? 2 : 1;
                while (p < pos + frameSize - nullStride2) {
                    if (nullStride2 === 2 ? (bytes[p] === 0 && bytes[p + 1] === 0) : bytes[p] === 0) { p += nullStride2; break; }
                    p += nullStride2;
                }
                if (p < pos + frameSize) {
                    result.lyrics = decodeID3String(bytes, p, pos + frameSize - p, encoding).trim();
                }
            }

            pos += frameSize;
        }

        return result;
    }

    /**
     * Parse Vorbis Comment block (used in FLAC, OGG Vorbis, OGG Opus).
     * For FLAC: starts with 4-byte block header. We look for the VORBIS_COMMENT block (type 4).
     */
    function parseVorbisComment(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0, lyrics: '', replayGainTrack: NaN, replayGainAlbum: NaN };
        if (bytes.length < 4) return result;

        // Find FLAC fLaC marker
        let pos = 0;
        const isFlac = bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43;
        if (!isFlac) return result;
        pos = 4;

        while (pos + 4 <= bytes.length) {
            const blockTypeByte = bytes[pos];
            const isLast = (blockTypeByte & 0x80) !== 0;
            const blockType = blockTypeByte & 0x7F;
            // Valid FLAC block types: 0-6 and 127. Anything else means
            // we've run past metadata into audio frames â€” stop parsing.
            if (blockType > 6 && blockType !== 127) break;
            const blockLen = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;
            if (blockLen < 0 || pos + blockLen > bytes.length) break;

            if (blockType === 4) {
                // VORBIS_COMMENT block â€” little-endian
                let p = pos;
                // vendor string length
                const vendorLen = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
                p += 4 + vendorLen;
                // comment count
                const commentCount = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
                p += 4;
                for (let i = 0; i < commentCount && p + 4 <= pos + blockLen; i++) {
                    const len = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
                    p += 4;
                    const comment = new TextDecoder('utf-8').decode(bytes.subarray(p, p + len));
                    p += len;
                    const eq = comment.indexOf('=');
                    if (eq < 0) continue;
                    const key = comment.slice(0, eq).toUpperCase();
                    const val = comment.slice(eq + 1).trim();
                    if (key === 'TITLE' && !result.title) result.title = val;
                    else if (key === 'ARTIST' && !result.artist) result.artist = val;
                    else if (key === 'ALBUM' && !result.album) result.album = val;
                    else if ((key === 'DATE' || key === 'YEAR') && !result.year) result.year = val.slice(0, 4);
                    else if (key === 'GENRE' && !result.genre) result.genre = val;
                    else if (key === 'TRACKNUMBER' && !result.trackNo) result.trackNo = parseInt(val, 10) || 0;
                    else if (key === 'ALBUMARTIST' && !result.albumArtist) result.albumArtist = val;
                    else if (key === 'DISCNUMBER' && !result.discNo) result.discNo = parseInt(val, 10) || 0;
                    else if ((key === 'LYRICS' || key === 'UNSYNCEDLYRICS') && !result.lyrics) result.lyrics = val;
                    else if (key === 'REPLAYGAIN_TRACK_GAIN') result.replayGainTrack = parseFloat(val) || NaN;
                    else if (key === 'REPLAYGAIN_ALBUM_GAIN') result.replayGainAlbum = parseFloat(val) || NaN;
                }
            }

            // PICTURE block in FLAC (type 6)
            if (blockType === 6 && !result._pictureData) {
                let p = pos;
                if (p + 32 <= pos + blockLen) { // minimum viable PICTURE header
                    const picType = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]; p += 4;
                    const mimeLen = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]; p += 4;
                    if (mimeLen >= 0 && mimeLen < 256 && p + mimeLen <= pos + blockLen) {
                        const mimeStr = new TextDecoder('latin1').decode(bytes.subarray(p, p + mimeLen)); p += mimeLen;
                        const descLen = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]; p += 4;
                        if (descLen >= 0 && descLen < 65536 && p + descLen + 16 + 4 <= pos + blockLen) {
                            p += descLen;
                            p += 16; // width, height, depth, colors
                            const dataLen = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]; p += 4;
                            // Only extract if we have the full picture data (not truncated by chunk boundary)
                            if (dataLen > 0 && p + dataLen <= bytes.length) {
                                const picBytes = bytes.subarray(p, p + dataLen);
                                // Validate image magic: JPEG (FF D8) or PNG (89 50 4E 47)
                                const isJpeg = picBytes[0] === 0xFF && picBytes[1] === 0xD8;
                                const isPng  = picBytes[0] === 0x89 && picBytes[1] === 0x50 && picBytes[2] === 0x4E && picBytes[3] === 0x47;
                                if ((isJpeg || isPng) && (picType === 3 || !result._pictureData)) {
                                    result._pictureMime = mimeStr || (isPng ? 'image/png' : 'image/jpeg');
                                    result._pictureData = picBytes.slice();
                                }
                            }
                        }
                    }
                }
            }

            pos += blockLen;
            if (isLast) break;
        }

        return result;
    }

    /**
     * Minimal ID3v1 fallback (128 bytes at end of MP3).
     */
    function parseID3v1(bytes) {
        if (bytes.length < 128) return null;
        const tag = bytes.subarray(bytes.length - 128);
        if (tag[0] !== 0x54 || tag[1] !== 0x41 || tag[2] !== 0x47) return null; // 'TAG'
        const latin1 = s => new TextDecoder('latin1').decode(s).replace(/\0.*$/, '').trim();
        const trackNo = tag[126] !== 0 && tag[125] === 0 ? tag[126] : 0;
        const genreIdx = tag[127];
        return {
            title:   latin1(tag.subarray(3, 33)),
            artist:  latin1(tag.subarray(33, 63)),
            album:   latin1(tag.subarray(63, 93)),
            year:    latin1(tag.subarray(93, 97)),
            genre:   ID3_GENRES[genreIdx] || '',
            trackNo
        };
    }

    /**
     * Parse Vorbis Comments from OGG Vorbis / OGG Opus containers.
     * Searches OGG pages for the comment header packet.
     */
    function parseOggVorbisComment(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0, lyrics: '', replayGainTrack: NaN, replayGainAlbum: NaN };
        if (bytes.length < 28) return result;

        // Find comment packet by scanning for markers:
        // Vorbis: \x03vorbis  (7 bytes)
        // Opus:   OpusTags    (8 bytes)
        let commentStart = -1;
        for (let i = 0; i < Math.min(bytes.length - 8, 65536); i++) {
            // \x03vorbis
            if (bytes[i] === 0x03 && bytes[i+1] === 0x76 && bytes[i+2] === 0x6F &&
                bytes[i+3] === 0x72 && bytes[i+4] === 0x62 && bytes[i+5] === 0x69 && bytes[i+6] === 0x73) {
                commentStart = i + 7;
                break;
            }
            // OpusTags
            if (bytes[i] === 0x4F && bytes[i+1] === 0x70 && bytes[i+2] === 0x75 && bytes[i+3] === 0x73 &&
                bytes[i+4] === 0x54 && bytes[i+5] === 0x61 && bytes[i+6] === 0x67 && bytes[i+7] === 0x73) {
                commentStart = i + 8;
                break;
            }
        }
        if (commentStart < 0 || commentStart + 8 > bytes.length) return result;

        let p = commentStart;
        // vendor string length (little-endian 32-bit)
        const vendorLen = bytes[p] | (bytes[p+1] << 8) | (bytes[p+2] << 16) | (bytes[p+3] << 24);
        p += 4;
        if (vendorLen < 0 || p + vendorLen + 4 > bytes.length) return result;
        p += vendorLen;
        // comment count
        const commentCount = bytes[p] | (bytes[p+1] << 8) | (bytes[p+2] << 16) | (bytes[p+3] << 24);
        p += 4;
        if (commentCount < 0 || commentCount > 10000) return result;

        for (let i = 0; i < commentCount && p + 4 <= bytes.length; i++) {
            const len = bytes[p] | (bytes[p+1] << 8) | (bytes[p+2] << 16) | (bytes[p+3] << 24);
            p += 4;
            if (len < 0 || len > 100000 || p + len > bytes.length) break;
            const comment = new TextDecoder('utf-8').decode(bytes.subarray(p, p + len));
            p += len;
            const eq = comment.indexOf('=');
            if (eq < 0) continue;
            const key = comment.slice(0, eq).toUpperCase();
            const val = comment.slice(eq + 1).trim();
            if (key === 'TITLE' && !result.title) result.title = val;
            else if (key === 'ARTIST' && !result.artist) result.artist = val;
            else if (key === 'ALBUMARTIST' && !result.albumArtist) result.albumArtist = val;
            else if (key === 'ALBUM' && !result.album) result.album = val;
            else if ((key === 'DATE' || key === 'YEAR') && !result.year) result.year = val.slice(0, 4);
            else if (key === 'GENRE' && !result.genre) result.genre = val;
            else if (key === 'TRACKNUMBER' && !result.trackNo) result.trackNo = parseInt(val, 10) || 0;
            else if (key === 'DISCNUMBER' && !result.discNo) result.discNo = parseInt(val, 10) || 0;
            else if ((key === 'LYRICS' || key === 'UNSYNCEDLYRICS') && !result.lyrics) result.lyrics = val;
            else if (key === 'REPLAYGAIN_TRACK_GAIN') result.replayGainTrack = parseFloat(val) || NaN;
            else if (key === 'REPLAYGAIN_ALBUM_GAIN') result.replayGainAlbum = parseFloat(val) || NaN;
        }
        return result;
    }

    /**
     * Read embedded metadata from an audio File object.
     * Returns a partial track meta object.
     */
    async function readEmbeddedMetadata(file) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, artBlobUrl: '', albumArtist: '', discNo: 0, lyrics: '', replayGainTrack: NaN, replayGainAlbum: NaN };
        let bytes;
        try {
            bytes = await readFileChunk(file); // Read full file for reliable embedded art
        } catch (_) { return result; }

        let parsed = null;

        if (ext === 'mp3') {
            parsed = parseID3v2(bytes);
            // Fallback to ID3v1 if ID3v2 yielded nothing useful
            if (!parsed.title && !parsed.artist) {
                try {
                    const tailBytes = await readFileTail(file, 128);
                    const v1 = parseID3v1(tailBytes);
                    if (v1) parsed = { ...parsed, ...Object.fromEntries(Object.entries(v1).filter(([,v]) => v)) };
                } catch (_) {}
            }
        } else if (ext === 'flac') {
            parsed = parseVorbisComment(bytes);
        } else if (ext === 'ogg' || ext === 'opus') {
            parsed = parseOggVorbisComment(bytes);
        } else if (ext === 'm4a' || ext === 'aac' || ext === 'mp4') {
            parsed = parseMP4Meta(bytes);
        }

        if (!parsed) return result;

        result.title   = parsed.title   || '';
        result.artist  = parsed.artist  || '';
        result.album   = parsed.album   || '';
        result.year    = (parsed.year   || '').slice(0, 4);
        result.genre   = parsed.genre   || '';
        result.trackNo = parsed.trackNo || 0;
        result.albumArtist = parsed.albumArtist || '';
        result.discNo  = parsed.discNo  || 0;
        result.lyrics  = parsed.lyrics  || '';
        result.replayGainTrack = parsed.replayGainTrack ?? NaN;
        result.replayGainAlbum = parsed.replayGainAlbum ?? NaN;

        // Convert embedded picture bytes to a blob URL
        if (parsed._pictureData && parsed._pictureData.length > 0) {
            try {
                const blob = new Blob([parsed._pictureData], { type: parsed._pictureMime || 'image/jpeg' });
                result.artBlobUrl = URL.createObjectURL(blob);
            } catch (_) {}
        }

        return result;
    }

    /**
     * Parse M4A/MP4 metadata (iTunes ilst atoms).
     * Enough to get title, artist, album, year, genre, track #, and cover art.
     */
    function parseMP4Meta(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0 };
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        function readUint32(offset) { try { return view.getUint32(offset, false); } catch (_) { return 0; } }
        function readStr(start, len) { return new TextDecoder('utf-8').decode(bytes.subarray(start, start + len)).trim(); }

        function walkAtoms(start, end, depth) {
            let pos = start;
            while (pos + 8 <= end) {
                const size = readUint32(pos);
                if (size < 8 || pos + size > end) break;
                const name = readStr(pos + 4, 4);
                const dataStart = pos + 8;
                const dataEnd = pos + size;

                if (name === 'moov' || name === 'udta' || name === 'meta' || name === 'ilst') {
                    const skip = name === 'meta' ? 4 : 0; // meta has a 4-byte version/flags prefix
                    walkAtoms(dataStart + skip, dataEnd, depth + 1);
                } else if (name === '\xA9nam' || name === '\xA9ART' || name === '\xA9alb' || name === '\xA9day'
                        || name === '\xA9gen' || name === 'trkn' || name === 'covr' || name === 'aART' || name === 'disk') {
                    // Find 'data' child atom
                    let p = dataStart;
                    while (p + 8 <= dataEnd) {
                        const ds = readUint32(p);
                        const dn = readStr(p + 4, 4);
                        if (dn === 'data' && ds >= 16) {
                            const type = readUint32(p + 8);
                            const val = bytes.subarray(p + 16, p + ds);
                            if (name === '\xA9nam') result.title  = result.title  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9ART') result.artist = result.artist || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9alb') result.album  = result.album  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9day') result.year   = result.year   || new TextDecoder('utf-8').decode(val).trim().slice(0, 4);
                            if (name === '\xA9gen') result.genre  = result.genre  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === 'trkn' && val.length >= 4) result.trackNo = (val[2] << 8) | val[3];
                            if (name === 'disk' && val.length >= 4) result.discNo = (val[2] << 8) | val[3];
                            if (name === 'aART') result.albumArtist = result.albumArtist || new TextDecoder('utf-8').decode(val).trim();
                            if (name === 'covr' && !result._pictureData) {
                                result._pictureMime = type === 13 ? 'image/jpeg' : 'image/png';
                                result._pictureData = val.slice();
                            }
                        }
                        p += Math.max(8, ds);
                    }
                }
                pos += size;
            }
        }
        walkAtoms(0, bytes.length, 0);
        return result;
    }

    /**
     * Standard ID3v1 genre list (abbreviated â€” first 80 entries cover most common genres).
     */
    const ID3_GENRES = [
        'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop',
        'Jazz','Metal','New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock',
        'Techno','Industrial','Alternative','Ska','Death Metal','Pranks','Soundtrack',
        'Euro-Techno','Ambient','Trip-Hop','Vocal','Jazz+Funk','Fusion','Trance',
        'Classical','Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise',
        'AlternRock','Bass','Soul','Punk','Space','Meditative','Instrumental Pop',
        'Instrumental Rock','Ethnic','Gothic','Darkwave','Techno-Industrial','Electronic',
        'Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta','Top 40',
        'Christian Rap','Pop/Funk','Jungle','Native American','Cabaret','New Wave',
        'Psychedelic','Rave','Showtunes','Trailer','Lo-Fi','Tribal','Acid Punk',
        'Acid Jazz','Polka','Retro','Musical','Rock & Roll','Hard Rock'
    ];
    const IDB_NAME = 'auralis_media_db';
    const IDB_VERSION = 3;
    const FOLDER_STORE = 'folders';
    const FILES_STORE = 'scanned_files';
    const ART_STORE = 'album_art';
    const BACKEND_META_STORE = 'backend_meta';
    const BACKEND_SOURCES_STORE = 'backend_media_sources';
    const BACKEND_FILES_STORE = 'backend_media_files';
    const BACKEND_RAW_TAGS_STORE = 'backend_raw_tag_snapshots';
    const BACKEND_ARTISTS_STORE = 'backend_artists';
    const BACKEND_TRACKS_STORE = 'backend_tracks';
    const BACKEND_RELEASES_STORE = 'backend_releases';
    const BACKEND_RELEASE_TRACKS_STORE = 'backend_release_tracks';
    const BACKEND_ARTWORK_STORE = 'backend_artwork_assets';
    const BACKEND_RELEASE_ARTWORK_STORE = 'backend_release_artwork';
    const BACKEND_SESSIONS_STORE = 'backend_playback_sessions';
    const BACKEND_QUEUE_STORE = 'backend_playback_queue';
    const BACKEND_SCHEMA_VERSION = '20260420_canonical_library_v2';
    const CANONICAL_CACHE_SOURCE_ID = 'source:cache-library';
    const CANONICAL_SESSION_ID = 'session:local-device';

    // In-memory state
    let mediaFolders = [];       // { id, name, handle, fileCount, lastScanned }
    let scannedFiles = [];       // { name, path, size, type, lastModified, folderId }
    let scanInProgress = false;
    let confirmCallback = null;
    let canonicalLibrarySyncTimer = 0;
    let canonicalLibrarySyncReason = '';
    let canonicalLibraryCachePromise = null;
    let canonicalLibraryCacheLoaded = false;
    let canonicalLibraryCacheRevision = 0;
    let canonicalLibraryCacheUpdatedAt = '';
    let canonicalLibraryAlbums = [];
    const canonicalLibraryAlbumByIdentity = new Map();
    const canonicalLibraryAlbumByReleaseId = new Map();
    const pickerPermissionGrantedHandles = new WeakSet();

    // â”€â”€ IndexedDB helpers â”€â”€
