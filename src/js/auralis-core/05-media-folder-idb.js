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

// ═══════════════════════════════════════════════════════════════════
// § MEDIA FOLDER SYSTEM — Real File System Access + IndexedDB
// ═══════════════════════════════════════════════════════════════════

    const AUDIO_EXTENSIONS = new Set(['mp3','flac','wav','ogg','opus','aac','m4a','wma','aiff','alac','ape','webm']);
    const IMAGE_EXTENSIONS = new Set(['jpg','jpeg','png','webp','gif','bmp']);
    const ART_FILENAME_PATTERNS = ['cover','folder','album art','front','albumart','albumartsmall','thumb','artwork','scan','booklet','image','art','jacket','sleeve','insert','disc','cd','back','inlay'];

    // ═══════════════════════════════════════════════════════════════════
    // § LIGHTWEIGHT METADATA PARSER — ID3v2, Vorbis Comment, MP4 atoms
    // Reads embedded artwork + full tags from File objects (ArrayBuffer).
    // Zero external dependencies.
    // ═══════════════════════════════════════════════════════════════════

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
                    // Strip ID3v1 numeric genre codes like "(17)" → "Rock"
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
            // we've run past metadata into audio frames — stop parsing.
            if (blockType > 6 && blockType !== 127) break;
            const blockLen = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;
            if (blockLen < 0 || pos + blockLen > bytes.length) break;

            if (blockType === 4) {
                // VORBIS_COMMENT block — little-endian
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
     * Standard ID3v1 genre list (abbreviated — first 80 entries cover most common genres).
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

    // ── IndexedDB helpers ──

    function openMediaDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(FOLDER_STORE)) {
                    db.createObjectStore(FOLDER_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(FILES_STORE)) {
                    const fs = db.createObjectStore(FILES_STORE, { keyPath: 'id', autoIncrement: true });
                    fs.createIndex('folderId', 'folderId', { unique: false });
                }
                if (!db.objectStoreNames.contains(ART_STORE)) {
                    db.createObjectStore(ART_STORE, { keyPath: 'key' });
                }
                ensureCanonicalBackendStores(db);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function ensureCanonicalBackendStores(db) {
        if (!db.objectStoreNames.contains(BACKEND_META_STORE)) {
            db.createObjectStore(BACKEND_META_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(BACKEND_SOURCES_STORE)) {
            db.createObjectStore(BACKEND_SOURCES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_FILES_STORE)) {
            const store = db.createObjectStore(BACKEND_FILES_STORE, { keyPath: 'id' });
            store.createIndex('sourceId', 'sourceId', { unique: false });
            store.createIndex('relativePath', 'relativePath', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RAW_TAGS_STORE)) {
            const store = db.createObjectStore(BACKEND_RAW_TAGS_STORE, { keyPath: 'id' });
            store.createIndex('fileId', 'fileId', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_ARTISTS_STORE)) {
            const store = db.createObjectStore(BACKEND_ARTISTS_STORE, { keyPath: 'id' });
            store.createIndex('normalizedName', 'normalizedName', { unique: true });
        }
        if (!db.objectStoreNames.contains(BACKEND_TRACKS_STORE)) {
            const store = db.createObjectStore(BACKEND_TRACKS_STORE, { keyPath: 'id' });
            store.createIndex('artistId', 'canonicalArtistId', { unique: false });
            store.createIndex('normalizedTitle', 'normalizedTitle', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASES_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASES_STORE, { keyPath: 'id' });
            store.createIndex('albumArtistId', 'albumArtistId', { unique: false });
            store.createIndex('normalizedTitle', 'normalizedTitle', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASE_TRACKS_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASE_TRACKS_STORE, { keyPath: 'id' });
            store.createIndex('releaseId', 'releaseId', { unique: false });
            store.createIndex('fileId', 'fileId', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_ARTWORK_STORE)) {
            db.createObjectStore(BACKEND_ARTWORK_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASE_ARTWORK_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASE_ARTWORK_STORE, { keyPath: 'id' });
            store.createIndex('releaseId', 'releaseId', { unique: true });
        }
        if (!db.objectStoreNames.contains(BACKEND_SESSIONS_STORE)) {
            db.createObjectStore(BACKEND_SESSIONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_QUEUE_STORE)) {
            const store = db.createObjectStore(BACKEND_QUEUE_STORE, { keyPath: 'id' });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('ordinal', 'ordinal', { unique: false });
        }
    }

    function idbPut(db, storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(item);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbDelete(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbGetAll(db, storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function idbClearByIndex(db, storeName, indexName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const idx = store.index(indexName);
            const req = idx.openCursor(IDBKeyRange.only(key));
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { cursor.delete(); cursor.continue(); }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbClearStore(db, storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbGet(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    function canonicalArtistId(name) {
        const normalized = toArtistKey(name || ARTIST_NAME);
        return normalized ? `artist:${normalized}` : `artist:${toArtistKey(ARTIST_NAME)}`;
    }

    function canonicalTrackId(track, fallbackArtist = '') {
        const stableId = getStableTrackIdentity(track);
        if (stableId) return `track:${stableId}`;
        const artistName = String(track?.artist || fallbackArtist || ARTIST_NAME).trim() || ARTIST_NAME;
        return `track:${trackKey(track?.title || 'unknown-track', artistName)}`;
    }

    function canonicalReleaseId(album) {
        return `release:${getAlbumMergeIdentityKey(album, album?.artist || '')}`;
    }

    function canonicalArtworkId(seed) {
        return `art:${String(seed || '').trim().toLowerCase()}`;
    }

    function canonicalSourceId(folder) {
        return folder?.id ? `source:${folder.id}` : CANONICAL_CACHE_SOURCE_ID;
    }

    function canonicalScannedFileId(file) {
        const handleKey = getHandleCacheKey(file?.folderId, file?.subDir, file?.name);
        if (handleKey) return `file:${handleKey}`;
        const pathKey = normalizeRelativeDir(file?.path || joinRelativeDir(file?.subDir, file?.name)).toLowerCase();
        if (file?.folderId && pathKey) return `file:${String(file.folderId).toLowerCase()}::${pathKey}`;
        return '';
    }

    function toCanonicalReleasePayload(album) {
        return {
            id: String(album?.id || '').trim(),
            schema: LIBRARY_CACHE_SCHEMA_VERSION,
            title: album?.title || 'Unknown Album',
            artist: album?.artist || ARTIST_NAME,
            albumArtist: album?.albumArtist || getAlbumPrimaryArtistName(album, album?.artist || ARTIST_NAME) || ARTIST_NAME,
            year: String(album?.year || '').trim(),
            genre: String(album?.genre || '').trim(),
            artUrl: album?.artUrl || '',
            isCompilation: Boolean(album?.isCompilation),
            _sourceAlbumId: album?._sourceAlbumId || getAlbumSourceIdentity(album),
            _sourceAlbumTitle: album?._sourceAlbumTitle || album?.title || '',
            trackCount: Number(album?.trackCount || (Array.isArray(album?.tracks) ? album.tracks.length : 0) || 0),
            totalDurationLabel: album?.totalDurationLabel || ''
        };
    }

    function toCanonicalReleaseTrackPayload(track, album) {
        return {
            title: track?.title || '',
            artist: track?.artist || album?.artist || ARTIST_NAME,
            albumTitle: track?.albumTitle || album?.title || '',
            albumArtist: track?.albumArtist || album?.albumArtist || '',
            year: String(track?.year || album?.year || '').trim(),
            genre: String(track?.genre || album?.genre || '').trim(),
            no: Number(track?.no || 0),
            discNo: Number(track?.discNo || 1) || 1,
            duration: track?.duration || '',
            durationSec: Number(track?.durationSec || 0),
            artUrl: track?.artUrl || album?.artUrl || '',
            path: track?.path || '',
            plays: Number(track?.plays || 0),
            addedRank: Number(track?.addedRank || 0),
            lastPlayedDays: Number(track?.lastPlayedDays || 0),
            ext: track?.ext || '',
            lyrics: track?.lyrics || '',
            replayGainTrack: Number.isFinite(track?.replayGainTrack) ? Number(track.replayGainTrack) : null,
            replayGainAlbum: Number.isFinite(track?.replayGainAlbum) ? Number(track.replayGainAlbum) : null,
            isFavorite: Boolean(track?.isFavorite),
            _handleKey: track?._handleKey || '',
            _sourceAlbumId: track?._sourceAlbumId || getTrackSourceAlbumIdentity(track, album),
            _sourceAlbumTitle: track?._sourceAlbumTitle || getTrackSourceAlbumTitle(track, album?._sourceAlbumTitle || album?.title || ''),
            _embeddedAlbumTitle: track?._embeddedAlbumTitle || '',
            _metaDone: Boolean(track?._metaDone)
        };
    }

    function parseCanonicalPayloadJson(rawValue, fallback = {}) {
        if (typeof rawValue !== 'string' || !rawValue) return fallback;
        try {
            return JSON.parse(rawValue);
        } catch (_) {
            return fallback;
        }
    }

    function materializeCanonicalLibraryCache(dataset = {}, meta = {}) {
        const artistsById = new Map((Array.isArray(dataset.artists) ? dataset.artists : []).map((row) => [row.id, row]));
        const tracksById = new Map((Array.isArray(dataset.tracks) ? dataset.tracks : []).map((row) => [row.id, row]));
        const rawTagsByFileId = new Map((Array.isArray(dataset.rawTags) ? dataset.rawTags : []).map((row) => [row.fileId, row]));
        const artworkById = new Map((Array.isArray(dataset.artwork) ? dataset.artwork : []).map((row) => [row.id, row]));
        const artworkByReleaseId = new Map();
        (Array.isArray(dataset.releaseArtwork) ? dataset.releaseArtwork : []).forEach((row) => {
            const artwork = artworkById.get(row?.artworkId);
            if (artwork) artworkByReleaseId.set(row.releaseId, artwork);
        });

        const releaseTracksByReleaseId = new Map();
        (Array.isArray(dataset.releaseTracks) ? dataset.releaseTracks : []).forEach((row) => {
            if (!releaseTracksByReleaseId.has(row.releaseId)) releaseTracksByReleaseId.set(row.releaseId, []);
            releaseTracksByReleaseId.get(row.releaseId).push(row);
        });

        const nextAlbums = [];
        const nextByIdentity = new Map();
        const nextByReleaseId = new Map();

        (Array.isArray(dataset.releases) ? dataset.releases : []).forEach((release) => {
            const releasePayload = parseCanonicalPayloadJson(release?.payloadJson, {});
            const releaseArtwork = artworkByReleaseId.get(release?.id);
            const albumArtistName = artistsById.get(release?.albumArtistId)?.name
                || releasePayload.albumArtist
                || releasePayload.artist
                || ARTIST_NAME;
            const album = {
                id: releasePayload.id || release?.sourceGroupKey || release?.id || '',
                title: releasePayload.title || release?.title || 'Unknown Album',
                artist: releasePayload.artist || albumArtistName,
                albumArtist: releasePayload.albumArtist || albumArtistName,
                year: releasePayload.year || String(release?.releaseYear || '').trim(),
                genre: releasePayload.genre || '',
                artUrl: releasePayload.artUrl || releaseArtwork?.storagePath || '',
                isCompilation: Boolean(releasePayload.isCompilation || release?.releaseType === 'compilation'),
                trackCount: Number(releasePayload.trackCount || release?.trackCount || 0),
                totalDurationLabel: releasePayload.totalDurationLabel || release?.totalDurationLabel || '',
                tracks: [],
                _sourceAlbumId: releasePayload._sourceAlbumId || release?.sourceGroupKey || '',
                _sourceAlbumTitle: releasePayload._sourceAlbumTitle || releasePayload.title || release?.title || ''
            };

            const releaseTracks = (releaseTracksByReleaseId.get(release?.id) || []).slice().sort((a, b) =>
                Number(a?.discNumber || 1) - Number(b?.discNumber || 1)
                || Number(a?.trackNumber || 0) - Number(b?.trackNumber || 0)
            );

            album.tracks = releaseTracks.map((releaseTrack, index) => {
                const trackPayload = parseCanonicalPayloadJson(releaseTrack?.payloadJson, {});
                const tagRow = rawTagsByFileId.get(releaseTrack?.fileId);
                const rawPayload = parseCanonicalPayloadJson(tagRow?.payloadJson, {});
                const trackRow = tracksById.get(releaseTrack?.trackId);
                const artistName = artistsById.get(releaseTrack?.displayArtistId)?.name
                    || artistsById.get(trackRow?.canonicalArtistId)?.name
                    || trackPayload.artist
                    || tagRow?.artist
                    || album.artist
                    || ARTIST_NAME;
                const durationSec = Number(trackPayload.durationSec || 0) || Math.round(Number(releaseTrack?.durationMs || tagRow?.durationMs || trackRow?.durationMs || 0) / 1000);
                return {
                    title: trackPayload.title || releaseTrack?.displayTitle || trackRow?.title || tagRow?.title || `Track ${index + 1}`,
                    artist: artistName,
                    albumTitle: trackPayload.albumTitle || tagRow?.album || album.title,
                    albumArtist: trackPayload.albumArtist || tagRow?.albumArtist || album.albumArtist || album.artist,
                    year: trackPayload.year || String(tagRow?.releaseYear || album.year || '').trim(),
                    genre: trackPayload.genre || String(tagRow?.genre || album.genre || '').trim(),
                    no: Number(trackPayload.no || tagRow?.trackNumber || releaseTrack?.trackNumber || index + 1) || (index + 1),
                    discNo: Number(trackPayload.discNo || tagRow?.discNumber || releaseTrack?.discNumber || 1) || 1,
                    duration: trackPayload.duration || toDurationLabel(durationSec),
                    durationSec,
                    artUrl: trackPayload.artUrl || album.artUrl || '',
                    path: trackPayload.path || rawPayload.path || '',
                    plays: Number(trackPayload.plays || 0),
                    addedRank: Number(trackPayload.addedRank || 0),
                    lastPlayedDays: Number(trackPayload.lastPlayedDays || 0),
                    ext: trackPayload.ext || rawPayload.ext || '',
                    lyrics: trackPayload.lyrics || '',
                    replayGainTrack: Number.isFinite(trackPayload.replayGainTrack) ? Number(trackPayload.replayGainTrack) : NaN,
                    replayGainAlbum: Number.isFinite(trackPayload.replayGainAlbum) ? Number(trackPayload.replayGainAlbum) : NaN,
                    isFavorite: Boolean(trackPayload.isFavorite),
                    _handleKey: trackPayload._handleKey || rawPayload.handleKey || '',
                    _sourceAlbumId: trackPayload._sourceAlbumId || album._sourceAlbumId || '',
                    _sourceAlbumTitle: trackPayload._sourceAlbumTitle || album._sourceAlbumTitle || album.title || '',
                    _embeddedAlbumTitle: trackPayload._embeddedAlbumTitle || tagRow?.album || '',
                    _metaDone: trackPayload._metaDone !== undefined ? Boolean(trackPayload._metaDone) : true,
                    _backendReleaseId: release?.id || '',
                    _backendReleaseTrackId: releaseTrack?.id || ''
                };
            });

            album.trackCount = album.tracks.length || album.trackCount;
            album.totalDurationLabel = album.totalDurationLabel || toLibraryDurationTotal(album.tracks);
            if (album.tracks.length && typeof finaliseAlbumArtist === 'function') {
                finaliseAlbumArtist(album, album.tracks);
            }

            nextAlbums.push(album);
            nextByReleaseId.set(release?.id, album);
            nextByIdentity.set(getAlbumIdentityKey(album, album.artist), album);
        });

        canonicalLibraryAlbums = nextAlbums;
        canonicalLibraryAlbumByIdentity.clear();
        nextByIdentity.forEach((value, key) => canonicalLibraryAlbumByIdentity.set(key, value));
        canonicalLibraryAlbumByReleaseId.clear();
        nextByReleaseId.forEach((value, key) => canonicalLibraryAlbumByReleaseId.set(key, value));
        canonicalLibraryCacheLoaded = true;
        canonicalLibraryCacheRevision = Math.max(0, Number(meta?.revision || 0));
        canonicalLibraryCacheUpdatedAt = meta?.updatedAt || '';
        return nextAlbums;
    }

    function getCanonicalBackendAlbumMeta(inputTitle, inputArtist = '') {
        if (!canonicalLibraryCacheLoaded && !canonicalLibraryAlbums.length) return null;
        if (inputTitle && typeof inputTitle === 'object' && inputTitle._backendReleaseId) {
            const releaseMatch = canonicalLibraryAlbumByReleaseId.get(inputTitle._backendReleaseId);
            if (releaseMatch) return releaseMatch;
        }

        const rawTitle = typeof inputTitle === 'string'
            ? inputTitle
            : (inputTitle && typeof inputTitle === 'object' ? inputTitle.title : '');
        const rawArtist = typeof inputTitle === 'object' && inputTitle
            ? (inputTitle.albumArtist || inputTitle.artist || inputArtist || '')
            : inputArtist;
        const normalizedTitle = normalizeAlbumTitle(rawTitle);
        const normalizedKey = albumKey(normalizedTitle);
        const normalizedArtist = toArtistKey(rawArtist);

        if (normalizedKey && normalizedArtist) {
            const exact = canonicalLibraryAlbumByIdentity.get(albumIdentityKey(normalizedTitle, rawArtist));
            if (exact) return exact;
        }

        if (!normalizedKey) return null;
        return canonicalLibraryAlbums.find((album) => (
            albumKey(album?.title || '') === normalizedKey
            && albumMatchesArtistHint(album, rawArtist)
        )) || null;
    }

    async function hydrateCanonicalLibraryBackendCache(reason = 'cache_read') {
        let db;
        try {
            db = await openMediaDB();
            const [metaRows, artists, tracks, releases, releaseTracks, artwork, releaseArtwork, rawTags] = await Promise.all([
                idbGetAll(db, BACKEND_META_STORE),
                idbGetAll(db, BACKEND_ARTISTS_STORE),
                idbGetAll(db, BACKEND_TRACKS_STORE),
                idbGetAll(db, BACKEND_RELEASES_STORE),
                idbGetAll(db, BACKEND_RELEASE_TRACKS_STORE),
                idbGetAll(db, BACKEND_ARTWORK_STORE),
                idbGetAll(db, BACKEND_RELEASE_ARTWORK_STORE),
                idbGetAll(db, BACKEND_RAW_TAGS_STORE)
            ]);
            const metaMap = new Map((metaRows || []).map((row) => [row.key, row.value]));
            if (metaMap.get('schema_version') !== BACKEND_SCHEMA_VERSION) {
                canonicalLibraryAlbums = [];
                canonicalLibraryAlbumByIdentity.clear();
                canonicalLibraryAlbumByReleaseId.clear();
                canonicalLibraryCacheLoaded = true;
                canonicalLibraryCacheRevision = 0;
                canonicalLibraryCacheUpdatedAt = '';
                return;
            }
            materializeCanonicalLibraryCache({
                artists,
                tracks,
                releases,
                releaseTracks,
                artwork,
                releaseArtwork,
                rawTags
            }, {
                revision: metaMap.get('library_revision'),
                updatedAt: metaMap.get('updated_at')
            });
        } catch (e) {
            console.warn('[Auralis] canonical backend hydration failed:', reason, e);
        } finally {
            if (db) db.close();
        }
    }

    function scheduleCanonicalLibraryBackendHydration(reason = 'cache_read') {
        if (canonicalLibraryCacheLoaded) return Promise.resolve(canonicalLibraryAlbums);
        if (canonicalLibraryCachePromise) return canonicalLibraryCachePromise;
        canonicalLibraryCachePromise = hydrateCanonicalLibraryBackendCache(reason)
            .finally(() => {
                canonicalLibraryCachePromise = null;
            });
        return canonicalLibraryCachePromise;
    }

    function buildCanonicalLibraryBackendPayload() {
        const sourceRows = [];
        const sourceIdSet = new Set();
        (Array.isArray(mediaFolders) ? mediaFolders : []).forEach((folder) => {
            const sourceId = canonicalSourceId(folder);
            sourceIdSet.add(sourceId);
            sourceRows.push({
                id: sourceId,
                kind: 'local_folder',
                rootUri: `folder://${folder.id || folder.name || 'unknown'}`,
                displayName: folder?.name || 'Local Folder',
                status: 'active',
                lastScanAt: folder?.lastScanned ? new Date(folder.lastScanned).toISOString() : ''
            });
        });
        if (!sourceIdSet.has(CANONICAL_CACHE_SOURCE_ID)) {
            sourceRows.push({
                id: CANONICAL_CACHE_SOURCE_ID,
                kind: 'local_cache',
                rootUri: 'cache://library',
                displayName: 'Cached Library',
                status: 'active',
                lastScanAt: ''
            });
        }

        const mediaFileRows = [];
        const mediaFileByHandle = new Map();
        const mediaFileByPath = new Map();
        (Array.isArray(scannedFiles) ? scannedFiles : []).forEach((file) => {
            const fileId = canonicalScannedFileId(file);
            if (!fileId) return;
            const relativePath = normalizeRelativeDir(file?.path || joinRelativeDir(file?.subDir, file?.name));
            const row = {
                id: fileId,
                sourceId: canonicalSourceId({ id: file?.folderId }),
                relativePath,
                sizeBytes: Number(file?.size || 0),
                mtimeMs: Number(file?.lastModified || 0),
                extension: String(file?.name || '').split('.').pop().toLowerCase(),
                contentHash: '',
                audioFingerprint: '',
                scanStatus: 'indexed'
            };
            mediaFileRows.push(row);
            if (file?.folderId && file?.subDir !== undefined && file?.name) {
                mediaFileByHandle.set(getHandleCacheKey(file.folderId, file.subDir, file.name), fileId);
            }
            if (relativePath) {
                mediaFileByPath.set(relativePath.toLowerCase(), fileId);
            }
        });

        const artistRows = new Map();
        const trackRows = new Map();
        const releaseRows = new Map();
        const releaseTrackRows = [];
        const artworkRows = new Map();
        const releaseArtworkRows = [];
        const rawTagRows = new Map();
        const releaseTrackIdByFileId = new Map();
        const releaseTrackIdByTrackKey = new Map();

        function ensureArtist(name) {
            const resolvedName = String(name || ARTIST_NAME).trim() || ARTIST_NAME;
            const id = canonicalArtistId(resolvedName);
            if (!artistRows.has(id)) {
                artistRows.set(id, {
                    id,
                    name: resolvedName,
                    sortName: resolvedName,
                    normalizedName: toArtistKey(resolvedName)
                });
            }
            return id;
        }

        function ensureVirtualMediaFile(track, album, ordinal) {
            const fileId = `file:virtual:${canonicalReleaseId(album)}:${ordinal}`;
            if (!mediaFileRows.some((row) => row.id === fileId)) {
                mediaFileRows.push({
                    id: fileId,
                    sourceId: CANONICAL_CACHE_SOURCE_ID,
                    relativePath: normalizeRelativeDir(track?.path || `${album?.title || 'album'}/${track?.title || ordinal}`),
                    sizeBytes: 0,
                    mtimeMs: 0,
                    extension: String(track?.ext || '').toLowerCase(),
                    contentHash: '',
                    audioFingerprint: '',
                    scanStatus: 'virtual'
                });
            }
            return fileId;
        }

        (Array.isArray(LIBRARY_ALBUMS) ? LIBRARY_ALBUMS : []).forEach((album) => {
            const releaseId = canonicalReleaseId(album);
            const albumArtistName = getAlbumPrimaryArtistName(album, album?.artist || ARTIST_NAME) || ARTIST_NAME;
            const albumArtistId = ensureArtist(albumArtistName);
            const orderedTracks = (Array.isArray(album?.tracks) ? album.tracks : []).slice().sort((a, b) =>
                Number(a?.discNo || 1) - Number(b?.discNo || 1)
                || Number(a?.no || 0) - Number(b?.no || 0)
            );

            releaseRows.set(releaseId, {
                id: releaseId,
                title: album?.title || 'Unknown Album',
                sortTitle: normalizeAlbumTitle(album?.title || 'Unknown Album'),
                normalizedTitle: albumKey(album?.title || 'Unknown Album'),
                albumArtistId,
                releaseYear: String(album?.year || '').trim(),
                releaseType: album?.isCompilation ? 'compilation' : 'album',
                sourceGroupKey: String(album?.id || '').trim(),
                trackCount: orderedTracks.length,
                totalDurationLabel: album?.totalDurationLabel || toLibraryDurationTotal(orderedTracks),
                payloadJson: JSON.stringify(toCanonicalReleasePayload(album))
            });

            if (album?.artUrl) {
                const artworkId = canonicalArtworkId(releaseId);
                artworkRows.set(artworkId, {
                    id: artworkId,
                    hash: String(album.artUrl),
                    mimeType: '',
                    width: 0,
                    height: 0,
                    storagePath: String(album.artUrl)
                });
                releaseArtworkRows.push({
                    id: `release_art:${releaseId}`,
                    releaseId,
                    artworkId
                });
            }

            orderedTracks.forEach((track, index) => {
                const displayArtistName = String(track?.artist || album?.artist || ARTIST_NAME).trim() || ARTIST_NAME;
                const displayArtistId = ensureArtist(displayArtistName);
                const trackId = canonicalTrackId(track, displayArtistName);
                if (!trackRows.has(trackId)) {
                    trackRows.set(trackId, {
                        id: trackId,
                        title: track?.title || `Track ${index + 1}`,
                        sortTitle: String(track?.title || `Track ${index + 1}`),
                        normalizedTitle: String(track?.title || `Track ${index + 1}`).trim().toLowerCase(),
                        canonicalArtistId: displayArtistId,
                        durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                        isrc: '',
                        fingerprint: ''
                    });
                }

                const relativePath = normalizeRelativeDir(track?.path || '');
                const fileId = (track?._handleKey && mediaFileByHandle.get(track._handleKey))
                    || (relativePath ? mediaFileByPath.get(relativePath.toLowerCase()) : '')
                    || ensureVirtualMediaFile(track, album, index + 1);
                const discNumber = Number(track?.discNo || 1) || 1;
                const trackNumber = Number(track?.no || index + 1) || (index + 1);
                const releaseTrackId = `${releaseId}::d${String(discNumber).padStart(2, '0')}::t${String(trackNumber).padStart(3, '0')}::${trackId}`;

                releaseTrackRows.push({
                    id: releaseTrackId,
                    releaseId,
                    trackId,
                    fileId,
                    discNumber,
                    trackNumber,
                    displayTitle: track?.title || `Track ${index + 1}`,
                    displayArtistId,
                    durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                    payloadJson: JSON.stringify(toCanonicalReleaseTrackPayload(track, album))
                });
                releaseTrackIdByFileId.set(fileId, releaseTrackId);
                releaseTrackIdByTrackKey.set(`${trackKey(track?.title, displayArtistName)}::${albumKey(track?.albumTitle || album?.title || '')}`, releaseTrackId);

                if (!rawTagRows.has(fileId)) {
                    rawTagRows.set(fileId, {
                        id: `raw:${fileId}`,
                        fileId,
                        extractorVersion: STORAGE_VERSION,
                        title: track?.title || '',
                        artist: displayArtistName,
                        album: track?.albumTitle || album?.title || '',
                        albumArtist: track?.albumArtist || albumArtistName,
                        trackNumber,
                        trackTotal: orderedTracks.length,
                        discNumber,
                        discTotal: 0,
                        releaseYear: String(track?.year || album?.year || '').trim(),
                        genre: String(track?.genre || album?.genre || '').trim(),
                        durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                        payloadJson: JSON.stringify({
                            ext: track?.ext || '',
                            path: track?.path || '',
                            handleKey: track?._handleKey || '',
                            sourceAlbumId: track?._sourceAlbumId || getTrackSourceAlbumIdentity(track, album),
                            sourceAlbumTitle: track?._sourceAlbumTitle || getTrackSourceAlbumTitle(track, album?._sourceAlbumTitle || album?.title || ''),
                            embeddedAlbumTitle: track?._embeddedAlbumTitle || ''
                        }),
                        createdAt: new Date().toISOString()
                    });
                }
            });
        });

        const currentReleaseId = nowPlaying ? `release:${albumIdentityKey(nowPlaying.albumTitle || activeAlbumTitle, activeAlbumArtist || nowPlaying.artist || '')}` : '';
        const currentQueueTrackKey = nowPlaying
            ? `${trackKey(nowPlaying.title, nowPlaying.artist)}::${albumKey(nowPlaying.albumTitle || activeAlbumTitle || '')}`
            : '';
        const currentReleaseTrackId = releaseTrackIdByTrackKey.get(currentQueueTrackKey) || '';
        const sessionRows = [{
            id: CANONICAL_SESSION_ID,
            deviceName: 'Auralis Local Device',
            currentReleaseId,
            currentReleaseTrackId,
            positionMs: 0,
            repeatMode: repeatMode || 'off',
            shuffleMode: false,
            queueRevision: Date.now(),
            updatedAt: new Date().toISOString()
        }];
        const queueRows = (Array.isArray(queueTracks) ? queueTracks : []).map((track, index) => {
            const queueKey = `${trackKey(track?.title, track?.artist)}::${albumKey(track?.albumTitle || '')}`;
            return {
                id: `queue:${CANONICAL_SESSION_ID}:${index}`,
                sessionId: CANONICAL_SESSION_ID,
                ordinal: index,
                releaseTrackId: releaseTrackIdByTrackKey.get(queueKey) || '',
                trackTitle: track?.title || '',
                trackArtist: track?.artist || '',
                albumTitle: track?.albumTitle || ''
            };
        });

        return {
            sources: sourceRows,
            files: mediaFileRows,
            rawTags: Array.from(rawTagRows.values()),
            artists: Array.from(artistRows.values()),
            tracks: Array.from(trackRows.values()),
            releases: Array.from(releaseRows.values()),
            releaseTracks: releaseTrackRows,
            artwork: Array.from(artworkRows.values()),
            releaseArtwork: releaseArtworkRows,
            sessions: sessionRows,
            queue: queueRows
        };
    }

    function replaceCanonicalLibraryBackend(db, payload, meta = {}) {
        const storeNames = [
            BACKEND_META_STORE,
            BACKEND_SOURCES_STORE,
            BACKEND_FILES_STORE,
            BACKEND_RAW_TAGS_STORE,
            BACKEND_ARTISTS_STORE,
            BACKEND_TRACKS_STORE,
            BACKEND_RELEASES_STORE,
            BACKEND_RELEASE_TRACKS_STORE,
            BACKEND_ARTWORK_STORE,
            BACKEND_RELEASE_ARTWORK_STORE,
            BACKEND_SESSIONS_STORE,
            BACKEND_QUEUE_STORE
        ];
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeNames, 'readwrite');
            tx.onerror = () => reject(tx.error);
            tx.oncomplete = () => resolve();

            [
                BACKEND_SOURCES_STORE,
                BACKEND_FILES_STORE,
                BACKEND_RAW_TAGS_STORE,
                BACKEND_ARTISTS_STORE,
                BACKEND_TRACKS_STORE,
                BACKEND_RELEASES_STORE,
                BACKEND_RELEASE_TRACKS_STORE,
                BACKEND_ARTWORK_STORE,
                BACKEND_RELEASE_ARTWORK_STORE,
                BACKEND_SESSIONS_STORE,
                BACKEND_QUEUE_STORE,
                BACKEND_META_STORE
            ].forEach((storeName) => tx.objectStore(storeName).clear());

            const putMany = (storeName, rows) => {
                const store = tx.objectStore(storeName);
                (Array.isArray(rows) ? rows : []).forEach((row) => store.put(row));
            };

            putMany(BACKEND_SOURCES_STORE, payload.sources);
            putMany(BACKEND_FILES_STORE, payload.files);
            putMany(BACKEND_RAW_TAGS_STORE, payload.rawTags);
            putMany(BACKEND_ARTISTS_STORE, payload.artists);
            putMany(BACKEND_TRACKS_STORE, payload.tracks);
            putMany(BACKEND_RELEASES_STORE, payload.releases);
            putMany(BACKEND_RELEASE_TRACKS_STORE, payload.releaseTracks);
            putMany(BACKEND_ARTWORK_STORE, payload.artwork);
            putMany(BACKEND_RELEASE_ARTWORK_STORE, payload.releaseArtwork);
            putMany(BACKEND_SESSIONS_STORE, payload.sessions);
            putMany(BACKEND_QUEUE_STORE, payload.queue);

            const metaStore = tx.objectStore(BACKEND_META_STORE);
            metaStore.put({ key: 'schema_version', value: BACKEND_SCHEMA_VERSION });
            metaStore.put({ key: 'library_revision', value: Number(meta.revision || 1) });
            metaStore.put({ key: 'last_sync_reason', value: String(meta.reason || 'unspecified') });
            metaStore.put({ key: 'updated_at', value: meta.updatedAt || new Date().toISOString() });
        });
    }

    async function syncCanonicalLibraryBackend(reason = 'library_snapshot') {
        let db;
        try {
            const payload = buildCanonicalLibraryBackendPayload();
            db = await openMediaDB();
            const revisionRecord = await idbGet(db, BACKEND_META_STORE, 'library_revision');
            const nextRevision = Math.max(0, Number(revisionRecord?.value || 0)) + 1;
            const updatedAt = new Date().toISOString();
            await replaceCanonicalLibraryBackend(db, payload, {
                revision: nextRevision,
                reason,
                updatedAt
            });
            materializeCanonicalLibraryCache(payload, { revision: nextRevision, updatedAt });
        } catch (e) {
            console.warn('[Auralis] canonical backend sync failed:', e);
        } finally {
            if (db) db.close();
        }
    }

    function scheduleCanonicalLibraryBackendSync(reason = 'library_snapshot') {
        canonicalLibrarySyncReason = reason;
        if (canonicalLibrarySyncTimer) return;
        canonicalLibrarySyncTimer = window.setTimeout(async () => {
            const syncReason = canonicalLibrarySyncReason || 'library_snapshot';
            canonicalLibrarySyncReason = '';
            canonicalLibrarySyncTimer = 0;
            await syncCanonicalLibraryBackend(syncReason);
        }, 120);
    }

    async function getCanonicalLibraryBackendSummary() {
        let db;
        try {
            db = await openMediaDB();
            const [meta, sources, files, artists, tracks, releases, releaseTracks, sessions, queue] = await Promise.all([
                idbGetAll(db, BACKEND_META_STORE),
                idbGetAll(db, BACKEND_SOURCES_STORE),
                idbGetAll(db, BACKEND_FILES_STORE),
                idbGetAll(db, BACKEND_ARTISTS_STORE),
                idbGetAll(db, BACKEND_TRACKS_STORE),
                idbGetAll(db, BACKEND_RELEASES_STORE),
                idbGetAll(db, BACKEND_RELEASE_TRACKS_STORE),
                idbGetAll(db, BACKEND_SESSIONS_STORE),
                idbGetAll(db, BACKEND_QUEUE_STORE)
            ]);
            const metaMap = new Map((meta || []).map((entry) => [entry.key, entry.value]));
            return {
                schemaVersion: metaMap.get('schema_version') || '',
                libraryRevision: Number(metaMap.get('library_revision') || 0),
                updatedAt: metaMap.get('updated_at') || '',
                counts: {
                    sources: (sources || []).length,
                    files: (files || []).length,
                    artists: (artists || []).length,
                    tracks: (tracks || []).length,
                    releases: (releases || []).length,
                    releaseTracks: (releaseTracks || []).length,
                    sessions: (sessions || []).length,
                    queueItems: (queue || []).length
                },
                currentSession: (sessions || [])[0] || null
            };
        } catch (e) {
            console.warn('[Auralis] canonical backend summary failed:', e);
            return null;
        } finally {
            if (db) db.close();
        }
    }

    function getCanonicalLibraryBackendCacheSummary() {
        return {
            loaded: canonicalLibraryCacheLoaded,
            revision: canonicalLibraryCacheRevision,
            updatedAt: canonicalLibraryCacheUpdatedAt,
            albumCount: canonicalLibraryAlbums.length
        };
    }

    // ── Persistent album art cache ──────────────────────────────────

    // Key format: lowercase "artist\0album" to deduplicate across sessions.
    function artCacheKey(artist, albumTitle) {
        return (String(artist || '').trim() + '\0' + String(albumTitle || '').trim()).toLowerCase();
    }

    // Retrieve cached artwork blob URL from IDB. Returns '' if not found.
    async function getCachedArt(artist, albumTitle) {
        const key = artCacheKey(artist, albumTitle);
        let db;
        try {
            db = await openMediaDB();
            const record = await idbGet(db, ART_STORE, key);
            if (record && record.blob) {
                return URL.createObjectURL(record.blob);
            }
        } catch (_) {} finally { if (db) db.close(); }
        return '';
    }

    // Persist artwork blob to IDB for future sessions.
    async function putCachedArt(artist, albumTitle, blob) {
        if (!blob) return;
        const key = artCacheKey(artist, albumTitle);
        let db;
        try {
            db = await openMediaDB();
            await idbPut(db, ART_STORE, { key, blob, ts: Date.now() });
        } catch (_) {} finally { if (db) db.close(); }
    }

    // Bulk-load all cached art keys (for quick "has art?" checks without per-album round-trips).
    async function loadArtCacheIndex() {
        let db;
        try {
            db = await openMediaDB();
            const all = await idbGetAll(db, ART_STORE);
            const map = new Map();
            for (const rec of all) {
                if (rec.key && rec.blob) map.set(rec.key, rec.blob);
            }
            return map;
        } catch (_) { return new Map(); } finally { if (db) db.close(); }
    }

    function toPersistedScannedFileRecord(file) {
        const normalized = {
            name: String(file?.name || ''),
            size: Number(file?.size || 0),
            type: String(file?.type || ''),
            lastModified: Number(file?.lastModified || 0),
            folderId: String(file?.folderId || ''),
            subDir: String(file?.subDir || '')
        };
        if (file?.path) normalized.path = String(file.path);
        return normalized;
    }

    async function rewritePersistedScannedFiles(files) {
        let db;
        try {
            db = await openMediaDB();
            await idbClearStore(db, FILES_STORE);
            for (const file of files) {
                await idbPut(db, FILES_STORE, toPersistedScannedFileRecord(file));
            }
        } catch (e) {
            console.warn('Failed to rewrite scanned file cache:', e);
        } finally {
            if (db) db.close();
        }
    }

    // ── Check API support ──

    function hasFileSystemAccess() {
        return typeof window.showDirectoryPicker === 'function' && window.isSecureContext;
    }

    function hasFallbackFolderInput() {
        const inp = document.createElement('input');
        return typeof inp.webkitdirectory !== 'undefined';
    }

    function getFolderAccessUnsupportedMessage() {
        // If native File System Access API is available and will work, no message needed
        if (shouldUseNativePicker()) return '';
        // If fallback <input webkitdirectory> works, no message needed either
        if (hasFallbackFolderInput()) return '';
        // Truly unsupported — no way to pick folders
        return 'This browser does not support folder access. Use desktop Chrome, Edge, or Opera.';
    }

    // ── Load persisted folders from IDB on boot ──

    async function loadMediaFolders() {
        let db;
        try {
            db = await openMediaDB();
            mediaFolders = await idbGetAll(db, FOLDER_STORE);
            scannedFiles = await idbGetAll(db, FILES_STORE);
        } catch (e) {
            console.warn('Failed to load media folders from IndexedDB:', e);
            mediaFolders = [];
            scannedFiles = [];
        } finally {
            if (db) db.close();
        }

        // Prune stale fallback-only folders: added via <input webkitdirectory> in a
        // previous session with no native handle — their File objects are gone and
        // they can never be rescanned. Remove them so they don't silently produce
        // zero results on every scan.
        const scannedFileIdsInIDB = new Set((Array.isArray(scannedFiles) ? scannedFiles : []).map(f => f.folderId));
        const staleFallbackIds = mediaFolders
            .filter(f => !f.handle && !scannedFileIdsInIDB.has(f.id))
            .map(f => f.id);
        if (staleFallbackIds.length > 0) {
            console.warn('[Auralis] Pruning', staleFallbackIds.length, 'stale fallback folder(s) from IDB (no handle, no scanned files):', staleFallbackIds);
            let pruneDb;
            try {
                pruneDb = await openMediaDB();
                for (const id of staleFallbackIds) {
                    await idbDelete(pruneDb, FOLDER_STORE, id);
                }
            } catch (e) {
                console.warn('[Auralis] Failed to prune stale fallback folders:', e);
            } finally {
                if (pruneDb) pruneDb.close();
            }
            mediaFolders = mediaFolders.filter(f => !staleFallbackIds.includes(f.id));
        }

        const activeFolderIds = new Set(mediaFolders.map(folder => folder.id));
        const normalizedFiles = (Array.isArray(scannedFiles) ? scannedFiles : [])
            .map(toPersistedScannedFileRecord)
            .filter(file => file.folderId && activeFolderIds.has(file.folderId));
        if (normalizedFiles.length !== scannedFiles.length) {
            scannedFiles = normalizedFiles;
            await rewritePersistedScannedFiles(scannedFiles);
        } else {
            scannedFiles = normalizedFiles;
        }

        if (DEBUG) console.log('[Auralis] loadMediaFolders: mediaFolders=' + mediaFolders.length + ', scannedFiles=' + scannedFiles.length);

        // Also try to rebuild file handle cache for playback (needs permission)
        if (mediaFolders.length > 0) {
            await rebuildFileHandleCache();
        }

        await syncLibraryFromMediaState();
        void scheduleCanonicalLibraryBackendHydration('loadMediaFolders');
        updatePlaybackHealthWarnings();
    }

    // Re-walk stored folder handles to rebuild fileHandleCache without full rescan
    async function rebuildFileHandleCache() {
        for (const folder of mediaFolders) {
            if (!folder.handle) continue;
            try {
                const perm = await folder.handle.queryPermission({ mode: 'read' });
                if (perm !== 'granted') continue;
                await walkHandlesOnly(folder.handle, folder.id, '');
            } catch (e) {
                console.warn('Could not rebuild handles for', folder.name, e);
            }
        }
        if (DEBUG) console.log('[Auralis] rebuildFileHandleCache: rebuilt ' + fileHandleCache.size + ' handles');
        return fileHandleCache.size;
    }

    // Lightweight walk: only caches file handles, doesn't read file contents
    async function walkHandlesOnly(dirHandle, folderId, parentDir) {
        const dirPath = normalizeRelativeDir(parentDir);
        let fallbackImageEntry = null;
        try {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    const ext = entry.name.split('.').pop().toLowerCase();
                    if (AUDIO_EXTENSIONS.has(ext)) {
                        const handleKey = getHandleCacheKey(folderId, dirPath, entry.name);
                        fileHandleCache.set(handleKey, entry);
                        if (!fileHandleCache.has(entry.name.toLowerCase())) fileHandleCache.set(entry.name.toLowerCase(), entry);
                    } else if (IMAGE_EXTENSIONS.has(ext)) {
                        const baseName = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
                        const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                        const artKey = getArtCacheKey(folderId, dirPath);
                        if (isArtFile && !artHandleCache.has(artKey)) {
                            artHandleCache.set(artKey, entry);
                        } else if (!fallbackImageEntry) {
                            fallbackImageEntry = entry;
                        }
                    }
                } else if (entry.kind === 'directory') {
                    await walkHandlesOnly(entry, folderId, joinRelativeDir(dirPath, entry.name));
                }
            }
            // Fallback: use any image file in the directory if no named art was found
            const artKey = getArtCacheKey(folderId, dirPath);
            if (!artHandleCache.has(artKey) && fallbackImageEntry) {
                artHandleCache.set(artKey, fallbackImageEntry);
            }
        } catch (_) {
            // Silently skip inaccessible directories
        }
    }

    // ── Recursive directory scan ──

    async function scanDirectoryHandle(dirHandle, folderId, onFileFound, parentDir) {
        const dirPath = normalizeRelativeDir(parentDir);
        let fallbackImageEntry = null;
        try {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const ext = entry.name.split('.').pop().toLowerCase();
                if (AUDIO_EXTENSIONS.has(ext)) {
                    let file;
                    try { file = await entry.getFile(); } catch (_) { continue; }
                    if (!file) continue;
                    const record = {
                        name: file.name,
                        size: file.size,
                        type: file.type || ('audio/' + ext),
                        lastModified: file.lastModified,
                        folderId: folderId,
                        subDir: dirPath
                    };
                    // Cache the file handle for later playback resolution
                    const handleKey = getScannedFileHandleKey(record);
                    if (handleKey) fileHandleCache.set(handleKey, entry);
                    if (!fileHandleCache.has(file.name.toLowerCase())) fileHandleCache.set(file.name.toLowerCase(), entry);
                    if (onFileFound) onFileFound(record);
                } else if (IMAGE_EXTENSIONS.has(ext)) {
                    // Cache art image handle for this directory
                    const baseName = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
                    const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                    const artKey = getArtCacheKey(folderId, dirPath);
                    if (isArtFile && !artHandleCache.has(artKey)) {
                        artHandleCache.set(artKey, entry);
                    } else if (!fallbackImageEntry) {
                        fallbackImageEntry = entry;
                    }
                }
            } else if (entry.kind === 'directory') {
                await scanDirectoryHandle(entry, folderId, onFileFound, joinRelativeDir(dirPath, entry.name));
            }
        }
        // Fallback: use any image file in the directory if no named art was found
        const artKey = getArtCacheKey(folderId, dirPath);
        if (!artHandleCache.has(artKey) && fallbackImageEntry) {
            artHandleCache.set(artKey, fallbackImageEntry);
        }
        } catch (e) {
            console.warn('[Auralis] Error scanning directory "' + (dirPath || dirHandle.name) + '":', e);
        }
    }

    async function scanFolder(folder, onProgress) {
        // Fallback path: folder was added via <input webkitdirectory>
        if (folder._fallbackFiles && Array.isArray(folder._fallbackFiles)) {
            const files = [];
            for (const file of folder._fallbackFiles) {
                const ext = file.name.split('.').pop().toLowerCase();
                const relPath = file.webkitRelativePath || file.name;
                const parts = relPath.split(/[\\\/]/);
                const subDir = normalizeRelativeDir(parts.length > 1 ? parts.slice(1, -1).join('/') : '');

                // Cache sidecar image files for album art (cover.jpg, folder.jpeg, etc.)
                if (IMAGE_EXTENSIONS.has(ext)) {
                    const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase();
                    const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                    const artKey = getArtCacheKey(folder.id, subDir);
                    if (isArtFile && !artHandleCache.has(artKey)) {
                        // Store a File-object shim in artHandleCache that supports .getFile()
                        const artBlobUrl = URL.createObjectURL(file);
                        artHandleCache.set(artKey, {
                            _file: file,
                            _blobUrl: artBlobUrl,
                            getFile: async () => file
                        });
                    } else if (!artHandleCache.has(getArtCacheKey(folder.id, subDir))) {
                        // Fallback: use any image if no named art pattern matched
                        const artBlobUrl = URL.createObjectURL(file);
                        artHandleCache.set(artKey, {
                            _file: file,
                            _blobUrl: artBlobUrl,
                            getFile: async () => file
                        });
                    }
                    continue; // not an audio file
                }

                if (!AUDIO_EXTENSIONS.has(ext)) continue;

                const record = {
                    name: file.name,
                    size: file.size,
                    type: file.type || ('audio/' + ext),
                    lastModified: file.lastModified,
                    folderId: folder.id,
                    subDir: subDir
                };
                // Cache a blob URL for playback and a getFile() shim so
                // mergeScannedIntoLibrary can read embedded metadata/artwork.
                const blobUrl = URL.createObjectURL(file);
                const cacheKey = getScannedFileHandleKey(record);
                const shimHandle = {
                    _blobUrl: blobUrl,
                    getFile: async () => file
                };
                if (cacheKey) {
                    fileHandleCache.set(cacheKey, shimHandle);
                    blobUrlCache.set(cacheKey, blobUrl);
                }
                if (!fileHandleCache.has(file.name.toLowerCase())) fileHandleCache.set(file.name.toLowerCase(), shimHandle);
                if (!blobUrlCache.has(file.name.toLowerCase())) blobUrlCache.set(file.name.toLowerCase(), blobUrl);
                files.push(record);
                if (onProgress) onProgress(files.length);
            }
            return files;
        }

        // Native File System Access path
        if (!folder.handle) {
            toast('Cannot scan "' + folder.name + '" — handle unavailable');
            return [];
        }
        const perm = await verifyPermission(folder.handle);
        if (!perm) {
            toast('Permission denied for ' + folder.name);
            return [];
        }
        const files = [];
        await scanDirectoryHandle(folder.handle, folder.id, (record) => {
            files.push(record);
            if (onProgress) onProgress(files.length);
        });
        return files;
    }

    async function verifyPermission(handle) {
        if (!handle || !handle.queryPermission) return false;
        let perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') return true;
        try {
            perm = await handle.requestPermission({ mode: 'read' });
            return perm === 'granted';
        } catch (_) {
            return false;
        }
    }

    // ── Pick a folder via browser dialog ──

    // Determine upfront whether native File System Access API is likely to work.
    // On file:// in Chrome, showDirectoryPicker exists and isSecureContext is true,
    // but the API still throws SecurityError. We detect this scenario and skip native.
    function shouldUseNativePicker() {
        if (typeof window.showDirectoryPicker !== 'function') return false;
        if (!window.isSecureContext) return false;
        // file:// pages in Chrome report isSecureContext = true but
        // showDirectoryPicker throws SecurityError. Avoid the native path.
        if (location.protocol === 'file:') return false;
        return true;
    }

    async function pickFolder() {
        const canFallback = hasFallbackFolderInput();
        console.log('[Auralis][FolderPicker] pickFolder: shouldUseNative=', shouldUseNativePicker(), 'canFallback=', canFallback);

        if (shouldUseNativePicker()) {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'read' });
                // Deduplicate: check if already added
                for (const existing of mediaFolders) {
                    if (existing.handle && await existing.handle.isSameEntry(handle)) {
                        toast('"' + handle.name + '" is already added');
                        return null;
                    }
                }
                return handle;
            } catch (e) {
                if (e.name === 'AbortError') {
                    return null;
                }
                console.warn('[Auralis] showDirectoryPicker failed:', e.name, e.message);
                toast('Could not access folder: ' + e.message);
                return null;
            }
        }

        // Fallback: <input type="file" webkitdirectory>
        // This path is reached synchronously from the click handler,
        // so user activation is still valid for input.click().
        if (canFallback) {
            console.log('[Auralis][FolderPicker] Using <input webkitdirectory> fallback');
            return pickFolderViaInput();
        }

        toast('Folder access is not supported in this browser. Use desktop Chrome, Edge, or Opera.');
        return null;
    }

    function pickFolderViaInput() {
        console.log('[Auralis][FolderPicker] pickFolderViaInput: creating hidden input and calling .click()');
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.multiple = true;
            // Use offscreen positioning instead of display:none — some browsers
            // silently ignore .click() on hidden inputs.
            input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
            document.body.appendChild(input);
            console.log('[Auralis][FolderPicker] input appended to body, about to call input.click()');

            let resolved = false;

            input.addEventListener('change', () => {
                resolved = true;
                const files = Array.from(input.files || []);
                input.remove();
                if (files.length === 0) {
                    toast('No files selected');
                    resolve(null);
                    return;
                }
                // Derive folder name from webkitRelativePath (handle both / and \ separators)
                const firstPath = files[0].webkitRelativePath || '';
                const folderName = firstPath.split(/[\\\/]/)[0] || 'Selected Folder';
                // Check for duplicate by name
                const existing = mediaFolders.find(f => f.name === folderName);
                if (existing) {
                    toast('"' + folderName + '" is already added');
                    resolve(null);
                    return;
                }
                resolve({ name: folderName, _files: files, _fallback: true });
            });

            // Chrome 91+ fires 'cancel' event
            input.addEventListener('cancel', () => {
                if (!resolved) {
                    resolved = true;
                    input.remove();
                    resolve(null);
                }
            });

            // Older browsers: detect cancel via focus-back heuristic.
            // Use a generous timeout (5 s) because on some platforms (Windows Chrome
            // via file://) the window fires a spurious focus event when the native
            // picker dialog opens, which would start the countdown before the user
            // has even had a chance to select a folder.
            const onFocusBack = () => {
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        input.remove();
                        resolve(null);
                    }
                    window.removeEventListener('focus', onFocusBack);
                }, 5000);
            };
            window.addEventListener('focus', onFocusBack);

            input.click();
        });
    }

    // ── Add a folder to the store ──

    async function addFolderFromHandle(handle) {
        const folder = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: handle.name,
            handle: handle._fallback ? null : handle,
            fileCount: 0,
            lastScanned: null,
            _fallbackFiles: handle._fallback ? handle._files : null
        };
        mediaFolders.push(folder);
        let db;
        try {
            db = await openMediaDB();
            // Don't persist _fallbackFiles (File objects aren't serializable to IDB structured clone in all browsers)
            const storable = { id: folder.id, name: folder.name, handle: folder.handle, fileCount: folder.fileCount, lastScanned: folder.lastScanned };
            await idbPut(db, FOLDER_STORE, storable);
        } catch (e) {
            console.warn('IDB put failed:', e);
        } finally {
            if (db) db.close();
        }
        return folder;
    }

    // ── Remove a folder from the store ──

    async function removeFolderById(folderId) {
        mediaFolders = mediaFolders.filter(f => f.id !== folderId);
        scannedFiles = scannedFiles.filter(f => f.folderId !== folderId);

        for (const url of blobUrlCache.values()) {
            try { URL.revokeObjectURL(url); } catch (_) {}
        }
        blobUrlCache.clear();
        fileHandleCache.clear();
        artHandleCache.clear();

        let db;
        try {
            db = await openMediaDB();
            await idbDelete(db, FOLDER_STORE, folderId);
            await idbClearByIndex(db, FILES_STORE, 'folderId', folderId);
        } catch (e) {
            console.warn('IDB delete failed:', e);
        } finally {
            if (db) db.close();
        }

        if (mediaFolders.length > 0) {
            await rebuildFileHandleCache();
        }
    }

    // ── Full scan of all folders ──

    async function scanAllFolders(progressUI) {
        if (scanInProgress) return;
        scanInProgress = true;

        // Clear stale blob URLs on rescan
        for (const url of blobUrlCache.values()) {
            try { URL.revokeObjectURL(url); } catch (_) {}
        }
        blobUrlCache.clear();
        fileHandleCache.clear();
        artHandleCache.clear();

        const allFiles = [];
        let totalFound = 0;
        let foldersScanned = 0;
        const totalFolders = mediaFolders.length;

        let db;
        try {
            db = await openMediaDB();
        } catch (e) {
            console.warn('Could not open IDB for scan:', e);
            scanInProgress = false;
            return [];
        }

        try {
            for (const folder of mediaFolders) {
                const files = await scanFolder(folder, (count) => {
                    totalFound = allFiles.length + count;
                    if (progressUI) progressUI(totalFound, folder.name, foldersScanned, totalFolders);
                });
                folder.fileCount = files.length;
                folder.lastScanned = Date.now();
                allFiles.push(...files);
                foldersScanned++;
                try {
                    await idbClearByIndex(db, FILES_STORE, 'folderId', folder.id);
                    for (const f of files) await idbPut(db, FILES_STORE, f);
                    await idbPut(db, FOLDER_STORE, folder);
                } catch (_) {}
            }
        } finally {
            if (db) db.close();
            scannedFiles = allFiles;
            scanInProgress = false;
        }

        return allFiles;
    }

    // ── Confirm dialog ──

    function showConfirm(title, body, acceptLabel, callback) {
        const scrim = getEl('confirm-scrim');
        if (!scrim) return;
        const titleEl = getEl('confirm-title');
        const bodyEl = getEl('confirm-body');
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.textContent = body;
        const acceptBtn = getEl('confirm-accept-btn');
        if (acceptBtn) acceptBtn.textContent = acceptLabel;
        confirmCallback = callback;
        scrim.classList.add('show');
        // Focus the cancel button for keyboard accessibility
        setTimeout(() => {
            const cancelBtn = scrim.querySelector('.confirm-cancel');
            if (cancelBtn) cancelBtn.focus();
        }, 50);
    }

    function confirmCancel() {
        const scrim = getEl('confirm-scrim');
        if (scrim) scrim.classList.remove('show');
        confirmCallback = null;
    }

    async function confirmAccept() {
        const scrim = getEl('confirm-scrim');
        if (scrim) scrim.classList.remove('show');
        if (confirmCallback) { const cb = confirmCallback; confirmCallback = null; await cb(); }
    }

    // Escape key dismisses confirm dialog
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && getEl('confirm-scrim')?.classList.contains('show')) {
            e.stopPropagation();
            confirmCancel();
        }
    });

    // ── UI: Render setup folder list ──

    function renderSetupFolderList() {
        const list = getEl('setup-folder-list');
        if (!list) return;
        list.innerHTML = '';
        if (mediaFolders.length === 0) {
            list.innerHTML = '<div class="setup-folder-empty-hint"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg><p>No folders added yet.<br>Tap below to browse.</p></div>';
        }
        mediaFolders.forEach(folder => {
            const el = document.createElement('div');
            el.className = 'setup-folder-item selected';
            el.dataset.folderId = folder.id;
            el.dataset.action = 'toggleSetupFolder';
            el.tabIndex = 0;
            el.setAttribute('role', 'checkbox');
            el.setAttribute('aria-checked', 'true');
            el.setAttribute('aria-label', folder.name);
            el.innerHTML =
                '<div class="folder-icon"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></div>' +
                '<div class="folder-info"><h3>' + escapeHtml(folder.name) + '</h3><span>' +
                (folder.fileCount > 0 ? folder.fileCount + ' audio files' : 'Not scanned yet') + '</span></div>' +
                '<div class="folder-check"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>';
            // Keyboard toggle support
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSetupFolder(el);
                }
            });
            list.appendChild(el);
        });
        syncSetupConfirmBtn();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function syncSetupConfirmBtn() {
        const btn = getEl('setup-confirm-btn');
        if (!btn) return;
        const selected = document.querySelectorAll('#setup-folder-list .setup-folder-item.selected');
        if (selected.length > 0) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.pointerEvents = 'none';
        }
    }

    // ── UI: Render settings folder list ──

    function renderSettingsFolderList() {
        const wrap = getEl('settings-media-folders');
        if (!wrap) return;
        // Remove all folder items (keep the add button and empty state)
        wrap.querySelectorAll('.settings-folder-item').forEach(el => el.remove());
        const addBtn = wrap.querySelector('.settings-add-folder');
        const emptyEl = getEl('settings-folder-empty');
        const unsupportedBanner = getEl('settings-api-unsupported');
        const unsupportedBannerText = getEl('settings-api-unsupported-text');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();

        if (unsupportedBanner) {
            unsupportedBanner.style.display = unsupportedMessage ? 'flex' : 'none';
        }
        if (unsupportedBannerText && unsupportedMessage) {
            unsupportedBannerText.textContent = unsupportedMessage;
        }
        if (addBtn) {
            addBtn.classList.toggle('is-disabled', Boolean(unsupportedMessage));
            addBtn.setAttribute('aria-disabled', unsupportedMessage ? 'true' : 'false');
            addBtn.title = unsupportedMessage || 'Add music folder';
        }

        if (mediaFolders.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            if (emptyEl) {
                const messageEl = emptyEl.querySelector('p');
                if (messageEl) {
                    messageEl.textContent = unsupportedMessage || 'No folders added yet';
                    messageEl.style.color = unsupportedMessage ? 'var(--sys-warning)' : 'var(--text-tertiary)';
                }
            }
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            mediaFolders.forEach(folder => {
                const el = document.createElement('div');
                el.className = 'settings-folder-item';
                el.dataset.folderId = folder.id;
                const countText = folder.fileCount > 0
                    ? folder.fileCount + ' audio files'
                    : (folder.lastScanned ? 'No audio files found' : 'Not scanned yet');
                const scanDate = folder.lastScanned
                    ? ' · Scanned ' + new Date(folder.lastScanned).toLocaleDateString()
                    : '';
                el.innerHTML =
                    '<div class="settings-folder-icon"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></div>' +
                    '<div class="settings-folder-info"><h3>' + escapeHtml(folder.name) + '</h3><span>' +
                    countText + scanDate + '</span></div>' +
                    '<button class="settings-folder-remove" data-action="removeSettingsFolder" data-folder-id="' + folder.id + '" title="Remove folder">' +
                    '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>';
                wrap.insertBefore(el, addBtn);
            });
        }

        // Update rescan button state
        const rescanBtn = getEl('settings-rescan-btn');
        if (rescanBtn) {
            if (mediaFolders.length === 0 || scanInProgress) {
                rescanBtn.style.opacity = '0.4';
                rescanBtn.style.pointerEvents = 'none';
            } else {
                rescanBtn.style.opacity = '1';
                rescanBtn.style.pointerEvents = 'auto';
            }
        }

        // Update header with folder/file count
        const header = getEl('settings-media-header');
        if (header) {
            const totalFiles = scannedFiles.length;
            if (mediaFolders.length === 0) {
                header.textContent = 'Media Folders';
            } else {
                header.textContent = 'Media Folders (' + mediaFolders.length + ')' +
                    (totalFiles > 0 ? ' · ' + totalFiles + ' files' : '');
            }
        }

        updatePlaybackHealthWarnings();
    }

    // ── UI: Sync empty state (driven by real data) ──

    function syncEmptyState() {
        const emptyState = getEl('home-empty-state');
        const sectionsRoot = getEl('home-sections-root');
        const addBtn = document.querySelector('[data-action="openAddHomeSection"]');
        if (!emptyState) return;

        const hasMedia = scannedFiles.length > 0 || (LIBRARY_TRACKS && LIBRARY_TRACKS.length > 0);

        if (!hasMedia && mediaFolders.length === 0) {
            emptyState.style.display = 'flex';
            if (sectionsRoot) sectionsRoot.style.display = 'none';
            if (addBtn) addBtn.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            if (sectionsRoot) sectionsRoot.style.display = '';
            if (addBtn) addBtn.style.display = addBtn.dataset.forceVisible === '1' ? 'flex' : '';
        }

        updatePlaybackHealthWarnings();
    }

    // ── Action handlers ──

    function showFirstTimeSetup() {
        const setup = getEl('first-time-setup');
        if (!setup) return;

        // Check for API support
        const banner = getEl('setup-api-unsupported');
        const bannerText = banner ? banner.querySelector('span') : null;
        const addBtn = getEl('setup-add-folder-btn');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();
        if (unsupportedMessage) {
            if (banner) banner.style.display = 'flex';
            if (bannerText) bannerText.textContent = unsupportedMessage;
            if (addBtn) { addBtn.style.opacity = '0.4'; addBtn.style.pointerEvents = 'none'; }
        } else {
            if (banner) banner.style.display = 'none';
            if (addBtn) { addBtn.style.opacity = '1'; addBtn.style.pointerEvents = 'auto'; }
        }

        // Reset scan progress UI
        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const btn = getEl('setup-confirm-btn');
        if (progress) progress.style.display = 'none';
        if (fill) fill.style.width = '0%';
        if (btn) { btn.textContent = 'Scan Selected'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; }

        renderSetupFolderList();
        setup.style.display = 'flex';
        setTimeout(() => setup.classList.add('active'), 40);
    }

    function hideFirstTimeSetup() {
        const setup = getEl('first-time-setup');
        if (!setup) return;
        setup.classList.remove('active');
        setTimeout(() => {
            setup.style.display = 'none';
            syncBottomNavVisibility();
            syncEmptyState();
            renderSettingsFolderList();
        }, 500);
    }

    function toggleSetupFolder(el) {
        el.classList.toggle('selected');
        el.setAttribute('aria-checked', el.classList.contains('selected') ? 'true' : 'false');
        syncSetupConfirmBtn();
    }

    async function addFolderViaPicker(options = {}) {
        console.log('[Auralis][FolderPicker] addFolderViaPicker called');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();
        console.log('[Auralis][FolderPicker] unsupportedMessage=', JSON.stringify(unsupportedMessage));
        if (unsupportedMessage) {
            toast(unsupportedMessage);
            if (typeof options.onUnsupported === 'function') options.onUnsupported();
            return null;
        }

        const trigger = options.triggerEl || null;
        if (trigger) {
            trigger.style.pointerEvents = 'none';
            trigger.style.opacity = '0.5';
        }

        try {
            console.log('[Auralis][FolderPicker] calling pickFolder()...');
            const handle = await pickFolder();
            console.log('[Auralis][FolderPicker] pickFolder returned:', handle);
            if (!handle) return null;
            const folder = await addFolderFromHandle(handle);
            if (typeof options.onSelected === 'function') await options.onSelected(folder);

            // Auto-scan fallback folders immediately while File objects are still live.
            // (<input webkitdirectory> File objects cannot be serialized to IDB across sessions.)
            if (folder._fallbackFiles && folder._fallbackFiles.length > 0) {
                console.log('[Auralis][FolderPicker] Auto-scanning fallback folder (async path):', folder.name);
                const files = await scanFolder(folder, null);
                folder.fileCount = files.length;
                folder.lastScanned = Date.now();
                let idb;
                try {
                    idb = await openMediaDB();
                    await idbClearByIndex(idb, FILES_STORE, 'folderId', folder.id);
                    for (const f of files) await idbPut(idb, FILES_STORE, f);
                    const storable = { id: folder.id, name: folder.name, handle: null, fileCount: folder.fileCount, lastScanned: folder.lastScanned };
                    await idbPut(idb, FOLDER_STORE, storable);
                } catch (e) {
                    console.warn('[Auralis] Failed to persist auto-scanned fallback files (async):', e);
                } finally {
                    if (idb) idb.close();
                }
                scannedFiles = scannedFiles.filter(f => f.folderId !== folder.id);
                scannedFiles.push(...files);
                console.log('[Auralis][FolderPicker] Auto-scan complete (async):', files.length, 'files for', folder.name);
            }

            if (typeof options.onAdded === 'function') await options.onAdded(folder);
            return folder;
        } catch (err) {
            console.error('[Auralis][FolderPicker] addFolderViaPicker error:', err);
            toast('Folder error: ' + (err.message || err));
            return null;
        } finally {
            if (trigger) {
                trigger.style.pointerEvents = 'auto';
                trigger.style.opacity = '1';
            }
        }
    }

    async function addSetupFolder() {
        const btn = getEl('setup-add-folder-btn');
        await addFolderViaPicker({
            triggerEl: btn,
            onSelected: renderSetupFolderList,
            onAdded: renderSetupFolderList
        });
    }

    async function confirmSetup() {
        // Remove deselected folders
        const selectedIds = new Set();
        document.querySelectorAll('#setup-folder-list .setup-folder-item.selected').forEach(el => {
            selectedIds.add(el.dataset.folderId);
        });
        const toRemove = mediaFolders.filter(f => !selectedIds.has(f.id));
        for (const f of toRemove) await removeFolderById(f.id);

        if (mediaFolders.length === 0) {
            toast('Add at least one folder first');
            return;
        }

        safeStorage.setItem(SETUP_DONE_KEY, '1');

        // Show real scan progress
        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const label = getEl('setup-scan-label');
        const count = getEl('setup-scan-count');
        const btn = getEl('setup-confirm-btn');
        if (progress) progress.style.display = 'block';
        if (btn) { btn.textContent = 'Scanning...'; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6'; }

        try {
            await scanAllFolders((totalFiles, folderName, done, total) => {
                const folderPct = total > 0 ? (done / total) * 80 : 0;
                const pct = Math.min(99, folderPct + 10);
                if (fill) fill.style.width = pct + '%';
                if (label) label.textContent = 'Scanning ' + folderName + '...';
                if (count) count.textContent = totalFiles + ' files found';
            });
        } catch (e) {
            console.warn('Scan error:', e);
            if (label) label.textContent = 'Scan error — some files may be missing';
            if (btn) { btn.textContent = 'Continue Anyway'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; }
            toast('Scan encountered an error: ' + (e.message || 'unknown'));
        }

        if (fill) fill.style.width = '100%';
        if (label) label.textContent = 'Scan complete!';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';

        // Build playable library entries from scanned files
        await mergeScannedIntoLibrary();

        toast(scannedFiles.length + ' tracks added to your library');
        setTimeout(() => hideFirstTimeSetup(), 800);
    }

    async function confirmSetupSmart() {
        const selectedIds = new Set();
        document.querySelectorAll('#setup-folder-list .setup-folder-item.selected').forEach(el => {
            selectedIds.add(el.dataset.folderId);
        });

        const allSelectedFallbackFolders = mediaFolders.length > 0
            && mediaFolders.every((folder) => selectedIds.has(folder.id))
            && mediaFolders.every((folder) => {
                const hasLiveFallbackFiles = Array.isArray(folder?._fallbackFiles) && folder._fallbackFiles.length > 0;
                if (!hasLiveFallbackFiles) return false;
                return scannedFiles.some((file) => file.folderId === folder.id);
            });

        if (!allSelectedFallbackFolders) {
            return confirmSetup();
        }

        const toRemove = mediaFolders.filter(f => !selectedIds.has(f.id));
        for (const f of toRemove) await removeFolderById(f.id);

        if (mediaFolders.length === 0) {
            toast('Add at least one folder first');
            return;
        }

        safeStorage.setItem(SETUP_DONE_KEY, '1');

        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const label = getEl('setup-scan-label');
        const count = getEl('setup-scan-count');
        const btn = getEl('setup-confirm-btn');

        if (progress) progress.style.display = 'block';
        if (fill) fill.style.width = '100%';
        if (label) label.textContent = 'Using indexed folder contents...';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';
        if (btn) { btn.textContent = 'Scanning...'; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6'; }

        await mergeScannedIntoLibrary();

        if (label) label.textContent = 'Scan complete!';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';

        toast(scannedFiles.length + ' tracks added to your library');
        setTimeout(() => hideFirstTimeSetup(), 800);
    }

    function skipSetup() {
        safeStorage.setItem(SETUP_DONE_KEY, 'skipped');
        hideFirstTimeSetup();
    }

    function openMediaFolderSetup() {
        showFirstTimeSetup();
    }
