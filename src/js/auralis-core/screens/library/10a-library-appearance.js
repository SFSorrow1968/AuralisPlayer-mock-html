/*
 * Auralis JS shard: 10-zenith-library-views.js
 * Purpose: favorites, artist, search, sidebar, library render refresh
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    const LIBRARY_SECTIONS = ['playlists', 'albums', 'artists', 'songs', 'genres', 'folders'];
    const LIBRARY_APPEARANCE_MODES = ['list', 'grid', 'carousel'];
    const LIBRARY_DENSITY_MODES = ['compact', 'large'];
    const LIBRARY_SORT_MODES = ['most_played', 'recent', 'forgotten'];
    const LIBRARY_GRID_COLUMN_OPTIONS = [1, 2, 3];
    const LIBRARY_APPEARANCE_GROUPS = ['view', 'size', 'columns', 'sort', 'group'];
    const LIBRARY_COLLECTION_LAYOUT_CLASSES = LIBRARY_APPEARANCE_MODES.map(mode => `library-view-${mode}`).concat(['library-view-compact', 'library-view-two-row']);
    let libraryEditMode = false;
    const categoryAppearanceEditModes = new Set();

    function normalizeLibrarySection(tab) {
        return LIBRARY_SECTIONS.includes(tab) ? tab : 'playlists';
    }

    function getLibraryCategoryOrder() {
        const stored = getUiPreference('libraryCategoryOrder', []);
        const order = Array.isArray(stored) ? stored.filter(section => LIBRARY_SECTIONS.includes(section)) : [];
        return order.concat(LIBRARY_SECTIONS).filter((section, index, list) => list.indexOf(section) === index);
    }

    function persistLibraryCategoryOrder(order) {
        setUiPreference('libraryCategoryOrder', order.filter(section => LIBRARY_SECTIONS.includes(section)));
    }

    function getLibraryAppearancePrefs() {
        const prefs = getUiPreference('libraryAppearance', {});
        return prefs && typeof prefs === 'object' ? prefs : {};
    }

    function getDefaultLibraryAppearance(section) {
        section = normalizeLibrarySection(section);
        return {
            mode: (section === 'albums' || section === 'genres') ? 'grid' : 'list',
            columns: section === 'artists' ? 2 : 2,
            density: 'compact',
            sort: 'most_played',
            groupByArtist: section === 'albums'
        };
    }

    function normalizeLibraryGridColumns(value, fallback = 2) {
        const numeric = Math.round(Number(value));
        if (LIBRARY_GRID_COLUMN_OPTIONS.includes(numeric)) return numeric;
        return fallback;
    }

    function normalizeLibraryCollapsedGroups(value) {
        return Array.isArray(value)
            ? value.filter(group => LIBRARY_APPEARANCE_GROUPS.includes(group))
            : [];
    }

    function getLibraryAppearanceConfig(section) {
        section = normalizeLibrarySection(section);
        const prefs = getLibraryAppearancePrefs();
        const raw = prefs[section] && typeof prefs[section] === 'object' ? prefs[section] : {};
        const defaults = getDefaultLibraryAppearance(section);
        let mode = raw.mode || defaults.mode;
        if (mode === 'compact' || mode === 'twoRow') mode = section === 'albums' ? 'carousel' : 'grid';
        if (!LIBRARY_APPEARANCE_MODES.includes(mode)) mode = defaults.mode;
        const columns = normalizeLibraryGridColumns(raw.columns, defaults.columns);
        const density = LIBRARY_DENSITY_MODES.includes(raw.density) ? raw.density : defaults.density;
        const sort = LIBRARY_SORT_MODES.includes(raw.sort) ? raw.sort : defaults.sort;
        return {
            mode,
            columns,
            density,
            sort,
            groupByArtist: raw.groupByArtist == null ? defaults.groupByArtist : Boolean(raw.groupByArtist),
            collapsedGroups: normalizeLibraryCollapsedGroups(raw.collapsedGroups)
        };
    }

    function setLibraryAppearanceGroupCollapsed(section, groupKey, collapsed) {
        section = normalizeLibrarySection(section);
        if (!LIBRARY_APPEARANCE_GROUPS.includes(groupKey)) return;
        const prefs = getLibraryAppearancePrefs();
        const config = getLibraryAppearanceConfig(section);
        const nextCollapsed = new Set(config.collapsedGroups);
        if (collapsed) nextCollapsed.add(groupKey);
        else nextCollapsed.delete(groupKey);
        prefs[section] = { ...config, collapsedGroups: Array.from(nextCollapsed) };
        setUiPreference('libraryAppearance', prefs);
    }

    function buildSettingsGroup({ label, groupKey, collapsedGroups, onToggle }) {
        const group = document.createElement('details');
        group.className = 'settings-choice-group library-appearance-group';
        group.open = !collapsedGroups.includes(groupKey);

        const summary = document.createElement('summary');
        summary.className = 'settings-choice-label library-appearance-label';
        const title = document.createElement('span');
        title.textContent = label;
        const state = document.createElement('span');
        state.className = 'settings-choice-chevron library-appearance-chevron';
        state.setAttribute('aria-hidden', 'true');
        state.textContent = group.open ? '-' : '+';
        summary.append(title, state);

        const options = document.createElement('div');
        options.className = 'settings-choice-options library-appearance-options';
        group.append(summary, options);
        group.addEventListener('toggle', () => {
            state.textContent = group.open ? '-' : '+';
            if (typeof onToggle === 'function') onToggle(groupKey, !group.open);
        });
        return { group, options };
    }

    function appendSettingsChoice(container, { label = '', title, icon = '', active = false, onClick }) {
        if (!container) return null;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `settings-choice library-appearance-choice${active ? ' active' : ''}`;
        if (!icon) btn.classList.add('is-text');
        btn.title = title;
        btn.setAttribute('aria-label', title);
        btn.innerHTML = icon ? getIconSvg(icon) : `<span>${label}</span>`;
        btn.addEventListener('click', onClick);
        container.appendChild(btn);
        return btn;
    }

    function renderSettingsToolbar(toolbar, groups, collapsedGroups, onToggle) {
        if (!toolbar) return;
        toolbar.replaceChildren();
        groups.forEach((groupConfig) => {
            const { group, options } = buildSettingsGroup({
                label: groupConfig.label,
                groupKey: groupConfig.key,
                collapsedGroups,
                onToggle
            });
            toolbar.appendChild(group);
            groupConfig.choices.forEach(choice => appendSettingsChoice(options, choice));
        });
    }

    function getLibraryHiddenCategories() {
        const prefs = getUiPreference('libraryHiddenCategories', []);
        return new Set(Array.isArray(prefs) ? prefs.filter(section => LIBRARY_SECTIONS.includes(section)) : []);
    }

    function setLibraryCategoryHidden(section, hidden) {
        section = normalizeLibrarySection(section);
        const next = getLibraryHiddenCategories();
        if (hidden) next.add(section);
        else next.delete(section);
        if (next.size >= LIBRARY_SECTIONS.length) next.delete(section);
        setUiPreference('libraryHiddenCategories', Array.from(next));
        syncLibraryCategoryOrder();
    }

    function getLibraryAppearanceMode(section) {
        return getLibraryAppearanceConfig(section).mode;
    }

    function setLibraryAppearanceOption(section, patch) {
        section = normalizeLibrarySection(section);
        const prefs = getLibraryAppearancePrefs();
        prefs[section] = { ...getLibraryAppearanceConfig(section), ...(patch || {}) };
        setUiPreference('libraryAppearance', prefs);
        renderLibraryViews({ force: true });
    }

    function setLibraryAppearance(section, mode) {
        if (!LIBRARY_APPEARANCE_MODES.includes(mode)) return;
        setLibraryAppearanceOption(section, { mode });
    }

    function moveLibraryCategory(section, delta) {
        const order = getLibraryCategoryOrder();
        const index = order.indexOf(normalizeLibrarySection(section));
        const nextIndex = index + Number(delta || 0);
        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
        const [item] = order.splice(index, 1);
        order.splice(nextIndex, 0, item);
        persistLibraryCategoryOrder(order);
        syncLibraryCategoryOrder();
    }

    function getLibraryCategoryDomOrder(nav) {
        return Array.from(nav?.querySelectorAll?.('.library-nav-item[data-section]') || [])
            .map(button => normalizeLibrarySection(button.dataset.section))
            .filter((section, index, list) => LIBRARY_SECTIONS.includes(section) && list.indexOf(section) === index);
    }

    function clearLibraryCategoryDropIndicators(nav) {
        nav?.querySelectorAll?.('.is-drop-before, .is-drop-after, .library-category-dragging')?.forEach(button => {
            button.classList.remove('is-drop-before', 'is-drop-after', 'library-category-dragging');
            button.style.touchAction = '';
        });
        nav?.classList?.remove('is-reordering');
    }

    function bindLibraryCategoryDrag(nav) {
        if (!nav || nav.dataset.libraryCategoryDragBound === 'true') return;
        nav.dataset.libraryCategoryDragBound = 'true';

        const dragThreshold = 6;
        const blockedSelector = '.library-nav-edit-actions, .library-nav-edit-actions *, a, input, textarea, select, [contenteditable="true"]';
        let pendingDrag = null;
        let draggingEl = null;
        let moved = false;
        let suppressNextClick = false;

        const canDrag = () => libraryEditMode && !(typeof searchModeActive !== 'undefined' && searchModeActive);

        const setDropIndicator = (target, insertAfter) => {
            nav.querySelectorAll('.is-drop-before, .is-drop-after').forEach(button => {
                button.classList.remove('is-drop-before', 'is-drop-after');
            });
            target?.classList.add(insertAfter ? 'is-drop-after' : 'is-drop-before');
        };

        const moveDraggedCategory = (point) => {
            if (!draggingEl) return;
            const siblings = Array.from(nav.querySelectorAll('.library-nav-item[data-section]'))
                .filter(button => button !== draggingEl && !button.hidden);
            const target = siblings.find(button => {
                const rect = button.getBoundingClientRect();
                return point.clientY < rect.top + rect.height / 2;
            }) || siblings[siblings.length - 1];
            if (!target) return;
            const rect = target.getBoundingClientRect();
            const insertAfter = point.clientY > rect.top + rect.height / 2;
            setDropIndicator(target, insertAfter);
            nav.insertBefore(draggingEl, insertAfter ? target.nextSibling : target);
        };

        const startDrag = (event, button) => {
            draggingEl = button;
            moved = true;
            nav.classList.add('is-reordering');
            button.classList.add('library-category-dragging');
            button.style.touchAction = 'none';
            try {
                button.setPointerCapture?.(event.pointerId);
            } catch (error) {
                // Pointer capture is optional; dragging still works without it.
            }
        };

        const finishDrag = () => {
            if (!pendingDrag && !draggingEl) return;
            const shouldPersist = Boolean(draggingEl && moved);
            clearLibraryCategoryDropIndicators(nav);
            draggingEl = null;
            pendingDrag = null;
            moved = false;
            if (shouldPersist) {
                suppressNextClick = true;
                setTimeout(() => {
                    suppressNextClick = false;
                }, 0);
                persistLibraryCategoryOrder(getLibraryCategoryDomOrder(nav));
                syncLibraryCategoryOrder();
            }
        };

        nav.addEventListener('click', (event) => {
            if (!suppressNextClick) return;
            suppressNextClick = false;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);

        nav.addEventListener('pointerdown', (event) => {
            if (!canDrag() || event.button !== 0 || event.target?.closest?.(blockedSelector)) return;
            const button = event.target?.closest?.('.library-nav-item[data-section]');
            if (!button || !nav.contains(button) || button.hidden) return;
            pendingDrag = {
                button,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY
            };
        });

        nav.addEventListener('pointermove', (event) => {
            if (!canDrag()) {
                finishDrag();
                return;
            }
            if (!draggingEl && pendingDrag) {
                const distance = Math.hypot(event.clientX - pendingDrag.startX, event.clientY - pendingDrag.startY);
                if (distance < dragThreshold) return;
                startDrag(event, pendingDrag.button);
            }
            if (!draggingEl) return;
            event.preventDefault();
            moveDraggedCategory(event);
        });

        nav.addEventListener('pointerup', finishDrag);
        nav.addEventListener('pointercancel', finishDrag);
        nav.addEventListener('lostpointercapture', finishDrag);
    }

    function toggleLibraryEditMode() {
        libraryEditMode = !libraryEditMode;
        renderLibraryViews({ force: true });
    }

    function toggleCategoryAppearanceEdit(section) {
        section = normalizeLibrarySection(section);
        if (categoryAppearanceEditModes.has(section)) categoryAppearanceEditModes.delete(section);
        else categoryAppearanceEditModes.add(section);
        renderLibraryViews({ force: true });
    }

    function toggleLibraryTopEditMode() {
        if (typeof searchModeActive !== 'undefined' && searchModeActive && typeof toggleSearchWorkspaceEdit === 'function') {
            libraryEditMode = false;
            syncLibraryCategoryOrder();
            toggleSearchWorkspaceEdit();
            ensureLibraryEditControls();
            return;
        }
        toggleLibraryEditMode();
    }

    function syncLibraryCategoryOrder() {
        const nav = getEl('library-nav-container');
        const library = getEl('library');
        if (!nav) return;
        bindLibraryCategoryDrag(nav);
        const hidden = getLibraryHiddenCategories();
        const navEditing = libraryEditMode && !(typeof searchModeActive !== 'undefined' && searchModeActive);
        getLibraryCategoryOrder().forEach(section => {
            const button = getEl(`lib-btn-${section}`);
            if (button) nav.appendChild(button);
        });
        nav.classList.toggle('is-editing', navEditing);
        if (!navEditing) clearLibraryCategoryDropIndicators(nav);
        if (library) library.classList.toggle('library-edit-mode', navEditing);
        nav.querySelectorAll('.library-nav-item').forEach((button) => {
            const section = normalizeLibrarySection(button.dataset.section);
            const isHidden = hidden.has(section);
            button.classList.toggle('is-hidden-category', isHidden);
            button.hidden = isHidden && !navEditing;
            let actions = button.querySelector('.library-nav-edit-actions');
            if (!navEditing) {
                actions?.remove();
                return;
            }
            actions?.remove();
            actions = document.createElement('span');
            actions.className = 'library-nav-edit-actions';
            [
                ['Move earlier', 'up', () => moveLibraryCategory(button.dataset.section, -1)],
                ['Move later', 'down', () => moveLibraryCategory(button.dataset.section, 1)],
                [isHidden ? 'Show category' : 'Hide category', isHidden ? 'open' : 'trash', () => setLibraryCategoryHidden(button.dataset.section, !isHidden)]
            ].forEach(([label, icon, handler]) => {
                const action = document.createElement('button');
                action.type = 'button';
                action.setAttribute('aria-label', label);
                action.innerHTML = getIconSvg(icon);
                action.addEventListener('click', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    handler();
                });
                actions.appendChild(action);
            });
            button.appendChild(actions);
        });
    }

    function ensureLibraryEditControls() {
        const topBar = document.querySelector('#library .top-bar');
        const createBtn = topBar?.querySelector('.library-create-btn');
        if (!topBar || !createBtn) return;
        let editBtn = getEl('library-edit-toggle-btn');
        if (!editBtn) {
            editBtn = document.createElement('button');
            editBtn.id = 'library-edit-toggle-btn';
            editBtn.type = 'button';
            editBtn.className = 'icon-btn library-edit-toggle-btn';
            editBtn.dataset.action = 'toggleLibraryTopEditMode';
            topBar.insertBefore(editBtn, createBtn);
        }
        const searchEditing = typeof searchModeActive !== 'undefined' && searchModeActive && typeof searchWorkspaceEditing !== 'undefined' && searchWorkspaceEditing;
        const isActive = searchEditing || libraryEditMode;
        editBtn.classList.toggle('active', isActive);
        editBtn.title = isActive ? 'Finish editing' : 'Edit library';
        editBtn.setAttribute('aria-label', editBtn.title);
        editBtn.innerHTML = getIconSvg(isActive ? 'source' : 'manage');
        editBtn.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleLibraryTopEditMode();
        };
    }

    function ensureAppearanceToolbar(section) {
        const screen = getEl(getLibraryScreenId(section));
        const topBar = screen?.querySelector('.top-bar');
        if (!screen || !topBar) return;
        let editBtn = screen.querySelector('.category-appearance-edit-btn');
        if (!editBtn) {
            editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'icon-btn category-appearance-edit-btn';
            editBtn.setAttribute('aria-label', 'Edit view appearance');
            topBar.appendChild(editBtn);
        }
        const isEditing = categoryAppearanceEditModes.has(section);
        editBtn.classList.toggle('active', isEditing);
        editBtn.title = isEditing ? 'Finish view settings' : 'View settings';
        editBtn.setAttribute('aria-label', editBtn.title);
        editBtn.innerHTML = getIconSvg('tune');
        editBtn.onclick = () => toggleCategoryAppearanceEdit(section);
        let toolbar = screen.querySelector('.library-appearance-toolbar');
        if (!isEditing) {
            toolbar?.remove();
            return;
        }
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'settings-choice-toolbar library-appearance-toolbar';
            topBar.insertAdjacentElement('afterend', toolbar);
        }
        const config = getLibraryAppearanceConfig(section);
        const groups = [{
            key: 'view',
            label: 'View',
            choices: LIBRARY_APPEARANCE_MODES.map(mode => ({
                title: `${section} ${mode} view`,
                icon: mode === 'grid' ? 'grid' : mode === 'carousel' ? 'carousel' : 'listMusic',
                active: config.mode === mode,
                onClick: () => setLibraryAppearance(section, mode)
            }))
        }];
        if (['grid', 'carousel'].includes(config.mode)) {
            groups.push({
                key: 'size',
                label: 'Size',
                choices: [
                    ['compact', 'S'],
                    ['large', 'L']
                ].map(([density, label]) => ({
                    label,
                    title: `${section} ${density} cards`,
                    active: config.density === density,
                    onClick: () => setLibraryAppearanceOption(section, { density })
                }))
            });
        }

        if (config.mode === 'grid') {
            groups.push({
                key: 'columns',
                label: 'Columns',
                choices: LIBRARY_GRID_COLUMN_OPTIONS.map(columns => ({
                    label: String(columns),
                    title: `${columns} column${columns === 1 ? '' : 's'}`,
                    active: config.columns === columns,
                    onClick: () => setLibraryAppearanceOption(section, { columns })
                }))
            });
        }

        if (['albums', 'artists', 'playlists'].includes(section)) {
            groups.push({
                key: 'sort',
                label: 'Sort',
                choices: [
                    ['most_played', 'Plays'],
                    ['recent', 'Recent'],
                    ['forgotten', 'Old']
                ].map(([sort, label]) => ({
                    label,
                    title: `${section} sorted by ${label.toLowerCase()}`,
                    active: config.sort === sort,
                    onClick: () => setLibraryAppearanceOption(section, { sort })
                }))
            });
        }

        if (section === 'albums' && config.mode === 'carousel') {
            groups.push({
                key: 'group',
                label: 'Group',
                choices: [{
                    label: 'Artist',
                    title: 'Group albums by artist',
                    active: config.groupByArtist,
                    onClick: () => setLibraryAppearanceOption(section, { groupByArtist: !config.groupByArtist })
                }]
            });
        }

        renderSettingsToolbar(
            toolbar,
            groups,
            config.collapsedGroups,
            (groupKey, collapsed) => setLibraryAppearanceGroupCollapsed(section, groupKey, collapsed)
        );
    }

    function applyLibraryAppearance(section, container) {
        if (!container) return;
        const config = getLibraryAppearanceConfig(section);
        const mode = config.mode;
        container.dataset.appearance = mode;
        container.dataset.density = config.density;
        container.style.setProperty('--library-grid-columns', String(config.columns));
        container.classList.remove(...LIBRARY_COLLECTION_LAYOUT_CLASSES);
        container.classList.add(`library-view-${mode}`);
        container.classList.toggle('library-artist-carousel-groups', section === 'albums' && mode === 'carousel' && config.groupByArtist);
    }
