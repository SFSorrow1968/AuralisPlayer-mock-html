    // ─────────────────────────────────────────────────────────────────────────
    // 12 — Metadata Editor (inline tag editing without leaving the app)
    // ─────────────────────────────────────────────────────────────────────────

    // State private to this module
    let _metaEditorTrack  = null;
    let _metaEditorAlbum  = null;
    let _metaEditorMode   = 'track';   // 'track' | 'album'
    let _metaEditorOrigKey = '';       // trackKey at the moment the editor opened

    function _showMetadataEditor() {
        const scrim  = getEl('metadata-editor-scrim');
        const panel  = getEl('metadata-editor');
        if (!scrim || !panel) return;
        scrim.classList.add('show');
        panel.classList.add('show');
        // Trap focus inside the panel after the animation settles
        setTimeout(() => {
            const first = panel.querySelector('input, button');
            if (first) first.focus();
        }, 320);
    }

    function closeMetadataEditor() {
        const scrim = getEl('metadata-editor-scrim');
        const panel = getEl('metadata-editor');
        if (scrim) scrim.classList.remove('show');
        if (panel) panel.classList.remove('show');
        _metaEditorTrack   = null;
        _metaEditorAlbum   = null;
        _metaEditorOrigKey = '';
    }

    function _fillForm(fields) {
        const ids = ['title','artist','album-artist','album','year','genre'];
        const vals = [fields.title, fields.artist, fields.albumArtist, fields.album, fields.year, fields.genre];
        ids.forEach((id, i) => {
            const el = getEl('meta-edit-' + id);
            if (el) el.value = (vals[i] != null) ? String(vals[i]) : '';
        });
    }

    // Open the editor pre-filled from a single track.
    function openTrackMetadataEditor(track) {
        if (!track) return;
        _metaEditorMode    = 'track';
        _metaEditorTrack   = track;
        _metaEditorAlbum   = null;
        _metaEditorOrigKey = getTrackMetadataOverrideKey(track);

        const heading = getEl('metadata-editor-heading');
        if (heading) heading.textContent = 'Edit Track Info';

        _fillForm({
            title:       track.title,
            artist:      track.artist,
            albumArtist: track.albumArtist || '',
            album:       track.albumTitle,
            year:        track.year,
            genre:       track.genre
        });

        _showMetadataEditor();
    }

    // Open the editor for an entire album (edits apply to all its tracks).
    function openAlbumMetadataEditor(album) {
        if (!album) return;
        _metaEditorMode    = 'album';
        _metaEditorAlbum   = album;
        _metaEditorTrack   = null;
        _metaEditorOrigKey = '';

        const heading = getEl('metadata-editor-heading');
        if (heading) heading.textContent = 'Edit Album Info';

        _fillForm({
            title:       album.title,
            artist:      album.artist,
            albumArtist: album.albumArtist || album.artist || '',
            album:       album.title,
            year:        album.year,
            genre:       album.genre
        });

        _showMetadataEditor();
    }

    // Read back the form values.
    function _readForm() {
        return {
            title:       String(getEl('meta-edit-title')?.value       || '').trim(),
            artist:      String(getEl('meta-edit-artist')?.value      || '').trim(),
            albumArtist: String(getEl('meta-edit-album-artist')?.value|| '').trim(),
            album:       String(getEl('meta-edit-album')?.value       || '').trim(),
            year:        String(getEl('meta-edit-year')?.value        || '').trim(),
            genre:       String(getEl('meta-edit-genre')?.value       || '').trim()
        };
    }

    function saveMetadataEdits() {
        const fields = _readForm();

        if (_metaEditorMode === 'track' && _metaEditorTrack) {
            const track = _metaEditorTrack;

            // Persist the override for future library loads
            saveMetadataOverride(_metaEditorOrigKey, fields, track);

            // Update the live track object so the current session also sees the change
            if (fields.title)       track.title       = fields.title;
            if (fields.artist)      track.artist      = fields.artist;
            if (fields.albumArtist !== undefined) track.albumArtist = fields.albumArtist;
            if (fields.album)       track.albumTitle  = fields.album;
            if (fields.year)        track.year        = fields.year;
            if (fields.genre)       track.genre       = fields.genre;

        } else if (_metaEditorMode === 'album' && _metaEditorAlbum) {
            const album = _metaEditorAlbum;

            // Apply changes to every track in the album
            (Array.isArray(album.tracks) ? album.tracks : []).forEach((track) => {
                const origKey = getTrackMetadataOverrideKey(track);

                // Only override fields the user may have changed at album level:
                // title / albumArtist / year / genre.  Preserve per-track artist.
                const albumFields = {
                    albumArtist: fields.albumArtist,
                    album:       fields.title || album.title,
                    year:        fields.year,
                    genre:       fields.genre
                };
                saveMetadataOverride(origKey, albumFields, track);
                applyMetadataOverride(track);
            });

            // Update the album object itself
            if (fields.title)       album.title       = fields.title;
            if (fields.albumArtist) album.albumArtist = fields.albumArtist;
            if (fields.year)        album.year        = fields.year;
            if (fields.genre)       album.genre       = fields.genre;
        }

        closeMetadataEditor();

        // Re-index and re-render so the library reflects the changes immediately.
        // installLibrarySnapshot will call buildLibrarySnapshotIndexes which applies
        // all metadata overrides before creating the index.
        if (typeof installLibrarySnapshot === 'function') {
            installLibrarySnapshot(LIBRARY_ALBUMS, { renderLibrary: true, renderHome: true, force: true });
        }

        // Brief confirmation toast if available
        if (typeof showToast === 'function') {
            showToast('Tags updated', 'info');
        } else {
            // Fallback: flash the save button text
            const btn = document.querySelector('[data-action="saveMetadataEdits"]');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = 'Saved!';
                setTimeout(() => { btn.textContent = orig; }, 1500);
            }
        }
    }
