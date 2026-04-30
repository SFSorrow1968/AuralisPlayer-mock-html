    function openSectionConfig(sectionRef) {
        showSectionConfigMenu(sectionRef);
    }

    window.presentActionSheet = presentActionSheet;
    window.createLibrarySongRow = createLibrarySongRow;
    window.createCollectionRow = createCollectionRow;
    window.createCollectionCard = createCollectionCard;
    window.openAddHomeSection = openAddHomeSection;
    window.openCreateHomeProfile = openCreateHomeProfile;
    window.openArtistProfileSectionMenu = openArtistProfileSectionMenu;
    window.filterHome = filterHome;
    window.switchLib = switchLib;
    window.switchLibSongsSort = switchLibSongsSort;
    window.renderLibraryViews = renderLibraryViews;
    window.renderFolderBrowserView = renderFolderBrowserView;
    window.openSectionConfig = openSectionConfig;

    try {
        loadHomeLayout();
        loadHomeProfiles();
        loadHomeSubtextPrefs();
        loadHomeTitleMode();
        loadEntitySubtextPrefs();
        loadArtistProfileLayout();
    } catch (_) {
        // ignore
    }

    window.addEventListener('resize', () => {
        scheduleNowPlayingMarquee(document);
        scheduleTitleMotion(document);
    });

    window.addEventListener('beforeunload', () => {
        blobUrlCache.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
        blobUrlCache.clear();
        revokeUrlSet(playbackBlobUrls);
        revokeUrlSet(librarySnapshotArtworkUrls);
    });

// ═══════════════════════════════════════════════════════════════════