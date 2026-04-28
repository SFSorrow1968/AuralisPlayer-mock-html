/*
 * Auralis JS shard: 07c-zenith-config-profiles.js
 * Purpose: home profile CRUD, title editor, scroll/motion helpers
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function getActiveHomeProfile() {
        return homeProfiles.find((profile) => profile.id === activeHomeProfileId) || null;
    }

    function saveHomeProfiles() {
        const safeProfiles = homeProfiles.map((profile, index) => normalizeHomeProfile(profile, index));
        homeProfiles = safeProfiles;
        safeStorage.setJson(HOME_PROFILES_KEY, safeProfiles);
        safeStorage.setItem(HOME_ACTIVE_PROFILE_KEY, String(activeHomeProfileId || (safeProfiles[0]?.id || '')));
        setUiPreference('homeProfile', String(activeHomeProfileId || (safeProfiles[0]?.id || '')));
    }

    function saveCurrentHomeProfileLayout() {
        const profile = getActiveHomeProfile();
        if (profile) {
            profile.sections = cloneSectionsForProfile(homeSections);
            profile.title = getActiveHomeTitle();
        }
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
    }

    function getActiveHomeTitle() {
        const profile = getActiveHomeProfile();
        return String(profile?.title || DEFAULT_HOME_TITLE).trim() || DEFAULT_HOME_TITLE;
    }

    function setActiveHomeTitle(value) {
        const profile = getActiveHomeProfile();
        if (!profile) return DEFAULT_HOME_TITLE;
        const next = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 42) || DEFAULT_HOME_TITLE;
        profile.title = next;
        saveHomeProfiles();
        renderHomeTitle();
        return next;
    }

    function syncHomeTitleEditability() {
        const title = getEl('home-title');
        if (!title) return;
        const editable = Boolean(inEditMode);
        title.contentEditable = editable ? 'plaintext-only' : 'false';
        title.setAttribute('aria-readonly', String(!editable));
        title.setAttribute('aria-label', editable ? 'Edit Home title' : 'Home title');
        title.tabIndex = editable ? 0 : -1;
    }

    function renderHomeTitle() {
        const title = getEl('home-title');
        if (!title) return;
        if (document.activeElement !== title) title.textContent = getActiveHomeTitle();
        syncHomeTitleEditability();
    }

    function commitHomeTitleEdit() {
        const title = getEl('home-title');
        if (!title) return;
        const before = getActiveHomeTitle();
        const after = setActiveHomeTitle(title.textContent);
        title.textContent = after;
        if (after !== before) toast('Home title updated');
    }

    function bindHomeTitleEditor() {
        const title = getEl('home-title');
        if (!title || title.dataset.homeTitleBound === '1') return;
        title.dataset.homeTitleBound = '1';
        title.addEventListener('blur', () => {
            if (inEditMode) commitHomeTitleEdit();
        });
        title.addEventListener('keydown', (event) => {
            if (!inEditMode) return;
            if (event.key === 'Enter') {
                event.preventDefault();
                commitHomeTitleEdit();
                title.blur();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                title.textContent = getActiveHomeTitle();
                title.blur();
            }
        });
        title.addEventListener('paste', (event) => {
            if (!inEditMode) return;
            event.preventDefault();
            const text = (event.clipboardData || window.clipboardData)?.getData('text/plain') || '';
            document.execCommand('insertText', false, text.replace(/\s+/g, ' '));
        });
        syncHomeTitleEditability();
    }

    function switchHomeProfile(profileId) {
        const profile = homeProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        saveCurrentHomeProfileLayout();
        activeHomeProfileId = profile.id;
        homeSections = cloneSectionsForProfile(profile.sections);
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
        renderHomeProfileNav();
        renderHomeTitle();
        renderHomeSections();
    }

    async function promptForHomeName(seed = '') {
        const initial = String(seed || '').trim() || `Home ${homeProfiles.length + 1}`;
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:99999; opacity:0; transition:all 0.2s ease;';
            
            const modal = document.createElement('div');
            modal.style.cssText = 'background:var(--navbar-bg, #121212); border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:24px; width:85%; max-width:320px; box-shadow:0 20px 40px rgba(0,0,0,0.6); transform:scale(0.95); transition:all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28); display:flex; flex-direction:column; gap:20px;';
            
            const title = document.createElement('div');
            title.innerText = 'Name this Home';
            title.style.cssText = 'font-size:1.15rem; font-weight:700; text-align:center; color:white; letter-spacing:-0.5px;';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = initial;
            input.autocomplete = 'off';
            input.style.cssText = 'width:100%; box-sizing:border-box; padding:14px 18px; border-radius:14px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:white; font-size:1rem; outline:none; transition:all 0.3s; font-family:inherit;';
            input.onfocus = () => { input.style.border = '1px solid rgba(255, 65, 108, 0.6)'; input.style.background = 'rgba(255,255,255,0.08)'; };
            input.onblur = () => { input.style.border = '1px solid rgba(255,255,255,0.12)'; input.style.background = 'rgba(255,255,255,0.04)'; };
            
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex; gap:12px; margin-top:4px;';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Cancel';
            cancelBtn.style.cssText = 'flex:1; padding:14px; border-radius:14px; background:rgba(255,255,255,0.06); border:none; color:#a0a0a0; font-weight:600; font-size:0.95rem; cursor:pointer; transition:background 0.2s;';
            cancelBtn.onmouseover = () => cancelBtn.style.background = 'rgba(255,255,255,0.1)';
            cancelBtn.onmouseout = () => cancelBtn.style.background = 'rgba(255,255,255,0.06)';
            
            const saveBtn = document.createElement('button');
            saveBtn.innerText = 'Done';
            saveBtn.style.cssText = 'flex:1; padding:14px; border-radius:14px; background:linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%); border:none; color:white; font-weight:600; font-size:0.95rem; cursor:pointer; box-shadow:0 4px 15px rgba(255, 65, 108, 0.3); transition:all 0.2s;';
            saveBtn.onmouseover = () => saveBtn.style.transform = 'translateY(-1px)';
            saveBtn.onmouseout = () => saveBtn.style.transform = 'translateY(0)';
            
            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(saveBtn);
            modal.appendChild(title);
            modal.appendChild(input);
            modal.appendChild(btnRow);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
                input.focus();
                input.select();
            });
            
            const cleanup = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.95)';
                setTimeout(() => overlay.remove(), 250);
            };
            
            cancelBtn.onclick = () => {
                cleanup();
                resolve('');
            };
            
            saveBtn.onclick = () => {
                const entered = String(input.value || '').trim().slice(0, 32);
                if (!entered) {
                    input.style.border = '1px solid rgba(255, 65, 108, 0.9)';
                    input.focus();
                    return;
                }
                cleanup();
                resolve(entered);
            };
            
            input.onkeydown = (e) => {
                if (e.key === 'Enter') saveBtn.click();
                if (e.key === 'Escape') cancelBtn.click();
            };
        });
    }

    async function openCreateHomeProfile() {
        const name = await promptForHomeName('');
        if (!name) return;
        const sections = []; // Start fully empty
        const profile = normalizeHomeProfile({ id: createHomeProfileId(), name, sections }, homeProfiles.length);
        homeProfiles.push(profile);
        activeHomeProfileId = profile.id;
        homeSections = cloneSectionsForProfile(profile.sections);
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
        renderHomeProfileNav();
        renderHomeTitle();
        renderHomeSections();
        toast(`Home "${name}" created`);
    }

    async function renameHomeProfile(profileId) {
        const profile = homeProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        const nextName = await promptForHomeName(profile.name);
        if (!nextName) return;
        profile.name = nextName;
        saveHomeProfiles();
        renderHomeProfileNav();
        toast(`Renamed to "${nextName}"`);
    }

    async function duplicateHomeProfile(profileId) {
        const profile = homeProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        const baseName = `${profile.name} Copy`;
        const name = await promptForHomeName(baseName);
        if (!name) return;
        const clone = normalizeHomeProfile({
            id: createHomeProfileId(),
            name,
            sections: cloneSectionsForProfile(profile.sections)
        }, homeProfiles.length);
        homeProfiles.push(clone);
        activeHomeProfileId = clone.id;
        homeSections = cloneSectionsForProfile(clone.sections);
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
        renderHomeProfileNav();
        renderHomeTitle();
        renderHomeSections();
        toast(`Created "${name}"`);
    }

    function deleteHomeProfile(profileId) {
        if (homeProfiles.length <= 1) {
            toast('At least one Home is required');
            return;
        }
        const idx = homeProfiles.findIndex((item) => item.id === profileId);
        if (idx < 0) return;
        const removed = homeProfiles[idx];
        homeProfiles.splice(idx, 1);
        if (activeHomeProfileId === profileId) {
            const fallback = homeProfiles[Math.max(0, idx - 1)] || homeProfiles[0];
            activeHomeProfileId = fallback?.id || '';
            homeSections = cloneSectionsForProfile(fallback?.sections || getDefaultHomeSections());
        }
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
        renderHomeProfileNav();
        renderHomeTitle();
        renderHomeSections();
        toast(`Removed "${removed.name}"`);
    }

    function openHomeProfileMenu(profileId) {
        const profile = homeProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        presentActionSheet(profile.name, 'Home navigation options', [
            {
                label: 'Rename Home',
                description: 'Set a custom name for this Home.',
                icon: 'manage',
                onSelect: () => renameHomeProfile(profile.id)
            },
            {
                label: 'Duplicate Home',
                description: 'Clone this Home with current sections and layout.',
                icon: 'stack',
                onSelect: () => duplicateHomeProfile(profile.id)
            },
            {
                label: 'Delete Home',
                description: 'Remove this Home profile from navigation.',
                icon: 'trash',
                danger: true,
                onSelect: () => deleteHomeProfile(profile.id)
            }
        ]);
    }

    function renderHomeProfileNav() {
        const nav = getEl('home-profile-nav');
        if (!nav) return;
        nav.innerHTML = '';
        homeProfiles.forEach((profile) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'home-profile-nav-item';
            if (profile.id === activeHomeProfileId) chip.classList.add('active');
            chip.textContent = profile.name;
            chip.addEventListener('click', () => switchHomeProfile(profile.id));
            bindLongPressAction(chip, () => openHomeProfileMenu(profile.id));
            nav.appendChild(chip);
        });
    }

    function loadHomeProfiles() {
        let parsedProfiles = [];
        try {
            const parsed = safeStorage.getJson(HOME_PROFILES_KEY, null);
            if (Array.isArray(parsed)) parsedProfiles = parsed;
        } catch (_) {
            parsedProfiles = [];
        }

        if (!parsedProfiles.length) {
            parsedProfiles = [{
                id: createHomeProfileId(),
                name: 'Home',
                sections: cloneSectionsForProfile(homeSections)
            }];
        }

        homeProfiles = parsedProfiles.map((profile, index) => normalizeHomeProfile(profile, index));
        const savedActive = String(getUiPreference('homeProfile', '') || safeStorage.getItem(HOME_ACTIVE_PROFILE_KEY) || '').trim();
        activeHomeProfileId = homeProfiles.some((item) => item.id === savedActive) ? savedActive : homeProfiles[0].id;
        const activeProfile = getActiveHomeProfile();
        homeSections = cloneSectionsForProfile(activeProfile?.sections || getDefaultHomeSections());
        currentHomeFilter = 'all';
        if (typeof saveHomeLayout === 'function') saveHomeLayout();
        saveHomeProfiles();
    }

    function createTitleRail(text, className = '') {
        const rail = document.createElement('div');
        rail.className = `zenith-title-rail ${className}`.trim();
        rail.dataset.mode = homeTitleMode;
        const track = document.createElement('span');
        track.className = 'zenith-title-track';
        track.textContent = text || '';
        rail.appendChild(track);
        return rail;
    }

    function updateTitleMotion(scope = document) {
        const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
        root.querySelectorAll('.zenith-title-rail').forEach((rail) => {
            const track = rail.querySelector('.zenith-title-track');
            if (!track) return;
            const forcedMarquee = rail.classList.contains('force-marquee');
            const marqueeMode = forcedMarquee || homeTitleMode === 'marquee';
            rail.dataset.mode = marqueeMode ? 'marquee' : homeTitleMode;
            if (!marqueeMode) {
                rail.dataset.overflow = '0';
                rail.style.removeProperty('--marquee-shift');
                return;
            }
            const overflow = track.scrollWidth - rail.clientWidth;
            if (overflow > 8) {
                rail.dataset.overflow = '1';
                rail.style.setProperty('--marquee-shift', `${Math.ceil(overflow) + 20}px`);
            } else {
                rail.dataset.overflow = '0';
                rail.style.removeProperty('--marquee-shift');
            }
        });
    }

    function updateScrollerMainCards(scope = document) {
        const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
        const scrollers = root.classList?.contains('horizon-scroller')
            ? [root]
            : Array.from(root.querySelectorAll('.horizon-scroller'));
        scrollers.forEach((scroller) => {
            const cards = Array.from(scroller.querySelectorAll('.zenith-media-card, .zenith-song-rail-item, .song-preview-card, .media-card'));
            cards.forEach((card) => card.classList.remove('is-main'));
            if (!cards.length) return;
            const scrollerCenter = scroller.scrollLeft + (scroller.clientWidth / 2);
            let bestCard = cards[0];
            let bestDistance = Number.POSITIVE_INFINITY;
            cards.forEach((card) => {
                const cardCenter = card.offsetLeft + (card.offsetWidth / 2);
                const distance = Math.abs(cardCenter - scrollerCenter);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestCard = card;
                }
            });
            bestCard.classList.add('is-main');
        });
    }

    function bindScrollerMainTracking(scope = document) {
        const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
        root.querySelectorAll('.horizon-scroller').forEach((scroller) => {
            if (scroller.dataset.mainTrackBound === '1') return;
            scroller.dataset.mainTrackBound = '1';
            let raf = null;
            const refresh = () => {
                if (raf) cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => {
                    raf = null;
                    updateScrollerMainCards(scroller);
                });
            };
            scroller.addEventListener('scroll', refresh, { passive: true });
            refresh();
        });
    }

    function scheduleTitleMotion(scope = document) {
        if (marqueeRaf) cancelAnimationFrame(marqueeRaf);
        marqueeRaf = requestAnimationFrame(() => {
            marqueeRaf = null;
            updateTitleMotion(scope);
            bindScrollerMainTracking(scope);
            updateScrollerMainCards(scope);
        });
