    function initSwipeGesture() {
        const emu = document.querySelector('.emulator');
        if (!emu) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let swiping = false;

        emu.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            const rect = emu.getBoundingClientRect();
            swiping = (touchStartX - rect.left) < 40;
        }, { passive: true });

        emu.addEventListener('touchmove', (e) => {
            if (!swiping) return;
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
            if (deltaX > 60 && deltaY < 80) {
                openSidebar();
                swiping = false;
            }
        }, { passive: true });

        const edgeEl = getEl('swipe-edge');
        if (!edgeEl) return;

        let edgeStartX = 0;
        edgeEl.addEventListener('mousedown', (e) => {
            edgeStartX = e.clientX;
            e.preventDefault();

            const onMove = (ev) => {
                if (ev.clientX - edgeStartX > 50) {
                    openSidebar();
                    cleanup();
                }
            };

            const cleanup = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', cleanup);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', cleanup);
        });

        edgeEl.addEventListener('touchstart', (e) => {
            edgeStartX = e.touches[0].clientX;
        }, { passive: true });

        edgeEl.addEventListener('touchmove', (e) => {
            if (e.touches[0].clientX - edgeStartX > 50) openSidebar();
        }, { passive: true });
    }

    async function init() {
        // Spinner keyframes
        const st = document.createElement('style');
        st.innerHTML = '@keyframes spin { 100% { transform:rotate(360deg); } }';
        document.head.appendChild(st);

        clearDemoMarkup();
        hydrateLibraryData();
        initStatusBarClock();

        // Restore library cache and queue from previous session
        loadLibraryCache();
        await loadLocalMusicSnapshotFromServer({ force: true });
        restoreQueue();

        bindAudioEngine();
        renderHomeSections();
        renderLibraryViews({ force: true });
        syncEmptyState();
        setNowPlaying(nowPlaying, false);
        updateProgressUI(0, nowPlaying?.durationSec || 0);
        scheduleNowPlayingMarquee(document);

        initOnboarding();
        initSearchBinding();
        initClearQueueBinding();
        initLongPressSuppressor();
        initFolderPickerBindings();

        bindDragAndDrop('#search-cat-grid .cat-card[draggable="true"]');
        bindTouchReorder('#search-cat-grid .cat-card[draggable="true"]');

        ensureSortIndicators();
        renderSearchState();
        ensureAccessibility();

        syncSettingsToggles();
        const eqToggleBtn = getEl('eq-toggle-btn');
        if (eqToggleBtn) eqToggleBtn.classList.toggle('active', eqEnabled);

        document.addEventListener('keydown', (e) => {
            // Skip if user is typing in an input
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
                if (e.key === 'Escape') { closeTopLayer(); syncBottomNavVisibility(); }
                return;
            }
            if (e.key === 'Escape') {
                closeTopLayer();
                syncBottomNavVisibility();
                return;
            }
            // Space = toggle playback
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                togglePlayback(e);
                return;
            }
            // Arrow keys (no modifier)
            if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const engine = ensureAudioEngine();
                if (engine) { engine.currentTime = Math.min(engine.duration || 0, engine.currentTime + 10); }
                return;
            }
            if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const engine = ensureAudioEngine();
                if (engine) { engine.currentTime = Math.max(0, engine.currentTime - 10); }
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setVolume(currentVolume + 0.05);
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setVolume(currentVolume - 0.05);
                return;
            }
            // N = next, P = previous
            if (e.key === 'n' || e.key === 'N') { playNext(); return; }
            if (e.key === 'p' || e.key === 'P') { playPrevious(); return; }
            // S = toggle shuffle
            if (e.key === 's' || e.key === 'S') { toggleShuffle(); return; }
            // R = cycle repeat
            if (e.key === 'r' || e.key === 'R') { toggleRepeatMode(); return; }
            // M = mute
            if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
            // / = focus search
            if (e.key === '/') {
                e.preventDefault();
                const searchInput = getEl('search-input');
                if (searchInput) searchInput.focus();
                return;
            }
        });

        const joinInput = getEl('join-code-input');
        if (joinInput) {
            joinInput.addEventListener('input', () => {
                joinInput.value = joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                if (joinInput.value.length > 0) setJoinCodeError('');
            });
        }
