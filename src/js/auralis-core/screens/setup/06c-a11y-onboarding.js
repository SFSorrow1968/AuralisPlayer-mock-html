    function labelFromOnclick(onclickText) {
        if (!onclickText) return '';
        if (onclickText.includes('openSearchSort')) return 'Open sort options';
        if (onclickText.includes('openSidebar')) return 'Open sidebar';
        if (onclickText.includes('toggleOverlay')) return 'Open player';
        if (onclickText.includes('pop(')) return 'Back';
        if (onclickText.includes('startParty')) return 'Start party session';
        if (onclickText.includes('leaveParty')) return 'Leave party session';
        return '';
    }

    function inferAriaLabel(el) {
        const fromOnclick = labelFromOnclick(el.getAttribute('onclick'));
        if (fromOnclick) return fromOnclick;

        if (el.classList.contains('nav-item')) {
            const idx = Array.from(el.parentElement.children).indexOf(el);
            return ['Listen Now', 'Library'][idx] || 'Navigate';
        }

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return text || 'Activate control';
    }

    function updateStatusClock() {
        const clock = getEl('status-clock');
        if (!clock) return;
        clock.textContent = new Intl.DateTimeFormat([], {
            hour: 'numeric',
            minute: '2-digit'
        }).format(new Date());
    }

    function initStatusBarClock() {
        updateStatusClock();
        window.setInterval(updateStatusClock, 30000);
    }

    function syncSettingsToggles() {
        const settings = [
            { id: 'settings-dark-theme-toggle', value: darkThemeEnabled },
            { id: 'settings-hq-audio-toggle', value: hqAudioEnabled },
            { id: 'settings-gapless-toggle', value: gaplessEnabled }
        ];

        settings.forEach(({ id, value }) => {
            const toggle = getEl(id);
            if (!toggle) return;
            toggle.classList.toggle('active', Boolean(value));
            toggle.setAttribute('role', 'switch');
            toggle.setAttribute('aria-checked', String(Boolean(value)));
            if (!toggle.hasAttribute('tabindex')) toggle.setAttribute('tabindex', '0');
        });
    }

    function toggleSettingsPreference(setting) {
        const key = String(setting || '').trim();
        if (key === 'darkTheme') {
            darkThemeEnabled = !darkThemeEnabled;
            safeStorage.setItem(STORAGE_KEYS.darkTheme, darkThemeEnabled ? '1' : '0');
            syncSettingsToggles();
            toast(darkThemeEnabled ? 'Dark theme enabled' : 'Dark theme disabled');
            return;
        }
        if (key === 'hqAudio') {
            hqAudioEnabled = !hqAudioEnabled;
            safeStorage.setItem(STORAGE_KEYS.hqAudio, hqAudioEnabled ? '1' : '0');
            syncSettingsToggles();
            toast(hqAudioEnabled ? 'High quality audio enabled' : 'High quality audio disabled');
        }
    }

    function ensureAccessibility() {
        const targets = document.querySelectorAll('div[onclick], .item-clickable, .media-card, .video-card, .icon-btn, .nav-item, .p-btn, .filter-chip');
        targets.forEach(el => {
            const tag = el.tagName;
            if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
            if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', inferAriaLabel(el));

            if (el.dataset.kbBound !== '1') {
                el.dataset.kbBound = '1';
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        el.click();
                    }
                });
            }
        });
    }

    // Esc / Layer handling
    function closeTopLayer() {
        if (albumArtViewerOpen || getEl('image-viewer-scrim')?.classList.contains('show')) {
            closeAlbumArtViewer();
            return true;
        }
        if (getEl('action-sheet').classList.contains('show')) {
            closeSheet();
            return true;
        }
        if (getEl('tag-creator').classList.contains('show')) {
            closeTagCreator();
            return true;
        }
        if (getEl('create-playlist-scrim')?.classList.contains('show')) {
            closeCreatePlaylistDialog();
            return true;
        }
        if (getEl('sidebar').classList.contains('show')) {
            closeSidebar();
            return true;
        }
        // Close EQ panel if visible (before closing the player overlay)
        const eqPanel = getEl('eq-panel');
        if (eqPanel && eqPanel.style.display !== 'none' && eqPanel.style.display !== '') {
            closeEq();
            return true;
        }
        if (getEl('confirm-scrim')?.classList.contains('show')) {
            confirmCancel();
            return true;
        }
        if (getEl('player').classList.contains('active')) {
            toggleOverlay('player');
            return true;
        }
        if (isOnboardingVisible()) {
            dismissOnboarding();
            return true;
        }
        if (isSetupVisible()) {
            skipSetup();
            return true;
        }
        if (historyStack.length > 1) {
            pop();
            return true;
        }
        return false;
    }

    // Boot
    async function initOnboarding() {
        // Load persisted media folders from IndexedDB first
        await loadMediaFolders();

        const ob = getEl('onboarding');
        if (!ob) return;

        if (safeStorage.getItem(ONBOARDED_KEY) === '1') {
            ob.style.display = 'none';
            ob.classList.remove('active');
            // If onboarding done but setup not done, show setup
            if (safeStorage.getItem(SETUP_DONE_KEY) !== '1' && safeStorage.getItem(SETUP_DONE_KEY) !== 'skipped') {
                showFirstTimeSetup();
            } else {
                syncEmptyState();
                renderSettingsFolderList();
            }
        } else {
            ob.style.display = 'flex';
            setTimeout(() => ob.classList.add('active'), 40);
        }
    }
