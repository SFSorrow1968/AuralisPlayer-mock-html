/*
 * Auralis JS shard: 00b-strings.js
 * Purpose: Shared user-facing and diagnostic text for the runtime.
 * Populates AuralisStrings (initialized as {} in 00a-runtime-logger.js).
 *
 * Style rules:
 *  - All keys use camelCase.
 *  - Template-style strings (needing interpolation) are functions that return a string.
 *  - Duplicates found across shards are the highest priority: one source of truth.
 *  - Aria-labels and tooltips live in their own sub-objects for clarity.
 */
    Object.assign(AuralisStrings, {

        /* ── Storage diagnostics (consumed by 00-shell-state-helpers.js) ────── */
        storageReadFailed:          'Browser storage could not be read.',
        storageWriteFailed:         'Browser storage could not be updated.',
        storageRemoveFailed:        'Browser storage entry could not be removed.',
        storageClearFailed:         'Browser storage cleanup could not remove an entry.',
        storageJsonParseFailed:     'Saved browser storage data could not be parsed.',
        storageJsonStringifyFailed: 'Saved browser storage data could not be prepared.',
        storageLargeWrite:          'A large browser storage write was detected.',
        verificationReady:          'Auralis runtime verification is available.',

        /* ── Playback feedback toasts ───────────────────────────────────────── */
        playBlockedGesture:         'Tap play to start \u2014 browsers require a user gesture first',
        playNoFolderNotSupported:   'Add a music folder in Settings so Auralis can access your files',
        playNoFolderHttp:           'Add a music folder in Settings to play local files',
        playOpenSettings:           'Open Settings and tap Scan Library to enable playback',
        playNoTrackFound:           'No playable track found',
        sleepTimerEnded:            'Sleep timer ended \u2014 playback paused',
        replayGainEnabled:          'ReplayGain enabled',
        replayGainDisabled:         'ReplayGain disabled',
        eqEnabled:                  'Equalizer on',
        eqDisabled:                 'Equalizer bypassed',
        gaplessEnabled:             'Gapless playback enabled',
        gaplessDisabled:            'Gapless playback disabled',
        crossfadeEnabled:           'Crossfade enabled',
        crossfadeDisabled:          'Crossfade disabled',
        darkThemeEnabled:           'Dark theme enabled',
        darkThemeDisabled:          'Dark theme disabled',
        hqAudioEnabled:             'High quality audio enabled',
        hqAudioDisabled:            'High quality audio disabled',

        /* ── Queue & playlist toasts ────────────────────────────────────────── */
        noPlaylistsAvailable:       'No playlists available',
        addFolderFirst:             'Add a folder first',
        notEnoughTracksToShuffle:   'Not enough tracks to shuffle',
        queueOrderShuffled:         'Queue order shuffled',
        queueAlreadyEmpty:          'Queue is already empty',
        trackMovedToTop:            'Track moved to top of queue',
        trackAlreadyPlaying:        'Track is already playing',
        trackWillPlayNext:          'Track will play next',
        trackAlreadyNext:           'Track is already next',
        removeOnlyFromPlaylistOrQueue: 'Remove is only available from playlists or the queue',

        /* ── Navigation toasts ──────────────────────────────────────────────── */
        artistUnavailable:          'Artist unavailable',
        playlistUnavailable:        'Playlist unavailable',
        noGenreMetadata:            'No genre metadata found',
        noArtworkAvailable:         'No artwork available',
        invalidJoinCode:            'Invalid join code',
        workspaceEditorUnlocked:    'Workspace Editor Unlocked',
        layoutSettingsSaved:        'Layout Settings Saved',
        noFiltersForType:           'No filters available for this type',
        smartPlaylistsComing:       'Smart playlists coming soon',
        playlistFoldersComing:      'Playlist folders coming soon',
        atLeastOneHomeRequired:     'At least one Home is required',

        /* ── Undo toasts ────────────────────────────────────────────────────── */
        undone:                     'Undone',
        nothingToUndo:              'Nothing to undo',
        queueNowEmpty:              'Queue is now empty',
        clearedUpcomingTracks:      'Cleared upcoming tracks',
        queueCleared:               'Queue cleared',
        undoLabel:                  'Undo',

        /* ── Share / clipboard toasts ───────────────────────────────────────── */
        trackInfoCopied:            'Track info copied to clipboard',
        shareNotAvailable:          'Share not available on this device',

        /* ── Metadata editor toasts ─────────────────────────────────────────── */
        tagsUpdated:                'Tags updated',
        metadataEditorSaved:        'Saved!',

        /* ── M3U import/export toasts ───────────────────────────────────────── */
        playlistIsEmpty:            'Playlist is empty',
        queueIsEmpty:               'Queue is empty',
        m3uCouldNotReadFile:        'Could not read file',
        m3uNoTracksFound:           'No tracks found in M3U file',

        /* ── Backend / sync toasts ──────────────────────────────────────────── */
        backendRemoteStateApplied:  'Remote library state applied',
        backendSyncComplete:        'Backend sync complete',
        backendConflictResolved:    'Backend conflict resolved using remote state',
        backendAccountCreated:      'Backend account created',
        backendSignedIn:            'Signed into backend',
        backendSessionCleared:      'Backend session cleared',
        backendNotConnected:        'Not connected',

        /* ── Scan / status labels ───────────────────────────────────────────── */
        scanning:                   'Scanning...',
        scanError:                  'Scan error \u2014 some files may be missing',
        scanContinueAnyway:         'Continue Anyway',
        scanComplete:               'Scan complete!',
        scanSelected:               'Scan Selected',
        scanLibrary:                'Scan Library',
        usingIndexedContents:       'Using indexed folder contents...',
        noLibrarySetup:             'Add a folder and run Scan Library',
        folderAccessUnsupported:    'This browser does not support folder access. Use desktop Chrome, Edge, or Opera.',

        /* ── Scan / status template strings (call as functions) ─────────────── */
        scanningFolder:             function(name) { return 'Scanning ' + name + '...'; },
        tracksAddedToLibrary:       function(n) { return n + ' tracks added to your library'; },
        durationProbeFailed:        function(n) { return n + ' track(s) could not be probed for duration'; },

        /* ── Empty states ───────────────────────────────────────────────────── */
        emptySongs:                 'No songs yet.',
        emptyPlaylists:             'No playlists yet.',
        emptyGenres:                'No tagged genres yet.',
        emptyFolders:               'No folders found. Scan a music library to browse by folder.',
        emptyNoMatchingSongs:       'No matching songs.',
        emptyNoSongsInLibrary:      'No songs in library yet.',
        emptySearchHint:            'Try another filter or clear your query.',
        emptyLibraryHint:           'Your local library has no matching items. Try browsing to add more.',
        emptyQueueFull:             'Queue is empty. Find something to play and it will appear here.',
        emptyQueueInline:           'No tracks queued yet.',
        emptyUpNext:                'Nothing queued after the current track.',
        emptyQueueEnd:              'You are at the end of the queue. Add more music or shuffle another album.',
        emptyPlaylist:              'This playlist is empty',
        emptyLyricsNoTrack:         'No track playing',
        emptyLyricsNoData:          'No lyrics available for this track',
        emptyHomeTitle:             'Your Home is Empty',
        emptyHomeBody:              'Add a section to make this profile useful.',
        emptyHomeSectionsTitle:     'Nothing to show yet',
        emptyHomeSectionsBody:      'Add music or edit this Home.',
        emptyFoldersAdded:          'No folders added yet.',
        emptyBackendSessions:       'No active sessions published yet.',
        emptyBackendMetrics:        'Metrics unavailable.',
        emptyBackendAudit:          'No audit events yet.',

        /* ── Empty state section labels (template) ──────────────────────────── */
        emptySectionTitle:          function(label) { return 'No ' + label; },

        /* ── Browse / catalog CTAs ──────────────────────────────────────────── */
        browseCatalog:              'Browse Catalog',
        findMusic:                  'Find Music',
        showMoreSongs:              'Show more songs',

        /* ── Sort & filter labels ───────────────────────────────────────────── */
        sortSheet:                  'Sort & Order',
        sortRecentlyAdded:          'Recently Added',
        sortAlphabetical:           'A-Z',
        sortMostPlayed:             'Most Played',
        sortDuration:               'Duration',

        /* ── Settings / folder labels ───────────────────────────────────────── */
        mediaFoldersHeading:        'Media Folders',
        addMusicFolder:             'Add music folder',
        removeFolder:               'Remove folder',

        /* ── Home profile dialogs ───────────────────────────────────────────── */
        nameThisHome:               'Name this Home',
        dialogCancel:               'Cancel',
        dialogDone:                 'Done',

        /* ── Metadata editor headings ───────────────────────────────────────── */
        editTrackInfo:              'Edit Track Info',
        editAlbumInfo:              'Edit Album Info',

        /* ── Home section context menu labels ───────────────────────────────── */
        displayAsGrid:              'Display as Grid',
        displayAsList:              'Display as List',
        editFilters:                'Edit Filters...',
        removeSection:              'Remove Section',

        /* ── Queue screen button labels ─────────────────────────────────────── */
        shuffleUpNext:              'Shuffle Up Next',
        clearUpNext:                'Clear Up Next',

        /* ── Player status labels ───────────────────────────────────────────── */
        statusReady:                'READY',
        statusAudio:                'AUDIO',
        timeZero:                   '0:00',
        timePlaceholder:            '--:--',

        /* ── Action sheet descriptions ──────────────────────────────────────── */
        actionPlayNext:             'Insert this track right after the current one.',
        actionAddToQueue:           'Append this song to the current queue.',
        actionOpenAlbum:            'Jump to source album.',
        actionEditInfo:             'Fix title, artist, album artist, year, genre.',
        actionShare:                'Copy track info or share via system sheet.',
        actionRemoveFromPlaylist:   'Remove this track from the current playlist.',
        actionOpenArtist:           'View artist profile and top tracks.',
        actionPlayArtist:           'Start with the most-played track.',
        actionPlayArtistUnavailable:'Play unavailable (no tracks).',
        actionQueueArtist:          'Add the top track to your queue.',
        actionQueueArtistUnavailable:'No tracks available to queue.',
        actionPlayAlbum:            'Start from track 1 in album order.',

        /* ── Aria-labels ─────────────────────────────────────────────────────── */
        ariaLabels: {
            shuffleQueue:           'Shuffle queue',
            repeatOff:              'Repeat off',
            repeatAll:              'Repeat all',
            repeatOnce:             'Repeat once',
            unlike:                 'Unlike',
            like:                   'Like',
            clearUpNext:            'Clear up next',
            clearUpNextUnavailable: 'Clear up next unavailable',
            cycleDensity:           'Cycle density',
            itemCount:              'Item count',
            sectionSettings:        'Section settings',
            removeSectionAria:      'Remove section',
            reorderTrack:           function(title) { return 'Reorder ' + (title || 'track'); },
            openArtwork:            function(albumTitle) { return 'Open artwork for ' + albumTitle; }
        },

        /* ── Tooltip (title) attributes ──────────────────────────────────────── */
        tooltips: {
            shuffle:                'Shuffle',
            repeatOff:              'Repeat off',
            repeatAll:              'Repeat all',
            repeatOnce:             'Repeat once',
            removeFolder:           'Remove folder',
            longPressForOptions:    'Long press for metadata options',
            cycleDensity:           'Cycle Density',
            itemCount:              'Item Count',
            settings:               'Settings',
            remove:                 'Remove'
        },

        /* ── Confirm dialog templates ────────────────────────────────────────── */
        confirmRemoveFromPlaylist:  function(plName, trackTitle) {
            return {
                title:  'Remove from \u201c' + plName + '\u201d?',
                body:   '\u201c' + trackTitle + '\u201d will be removed from this playlist.',
                action: 'Remove'
            };
        },
        confirmRemoveFromQueue:     function(trackTitle) {
            return {
                title:  'Remove from queue?',
                body:   '\u201c' + trackTitle + '\u201d will be removed from the queue.',
                action: 'Remove'
            };
        },
        confirmRemoveFolder:        function(folderName, count) {
            return {
                title:  'Remove \u201c' + folderName + '\u201d?',
                body:   'This will remove the folder and its ' + count + ' indexed files from your library. No files will be deleted from your device.',
                action: 'Remove'
            };
        },
        confirmDeletePlaylist:      function(plName) {
            return {
                title:  'Delete \u201c' + plName + '\u201d?',
                body:   'This playlist will be permanently deleted.',
                action: 'Delete'
            };
        }
    });
