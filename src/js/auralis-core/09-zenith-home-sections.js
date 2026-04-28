/*
 * Auralis JS shard: 09-zenith-home-sections.js
 * Purpose: home section composition and editor actions
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        return item;
    }

    function createHomeSectionContent(section, items) {
        if (!items.length) {
            const typeIcons = { songs: 'music', albums: 'album', artists: 'artist', playlists: 'playlist' };
            const typeLabels = { songs: 'songs', albums: 'albums', artists: 'artists', playlists: 'playlists' };
            const label = typeLabels[section.itemType] || 'items';

            return createScreenEmptyState({
                className: 'home-section-empty zenith-section-empty',
                title: `No ${label}`,
                body: 'Nothing here yet.',
                iconName: typeIcons[section.itemType] || 'library'
            });
        }

        if (section.itemType === 'songs') {
            const density = section.density === 'compact' ? 'compact' : 'large';
            const layout = ensureSongLayoutForDensity(section.layout || 'list', density);

            if (layout === 'carousel') {
                const scroller = document.createElement('div');
                scroller.className = `horizon-scroller ${density === 'compact' ? 'zenith-song-rail' : ''}`;
                appendFragment(scroller, items.map(track => (
                    density === 'compact'
                        ? createCompactSongRailItem(track, 'home')
                        : createSongPreviewCard(track, 'large', true, 'home')
                )));
                return scroller;
            }

            if (layout === 'grid' && density !== 'compact') {
                const grid = document.createElement('div');
                grid.className = 'song-preview-grid';
                grid.style.gridTemplateColumns = '1fr 1fr';
                appendFragment(grid, items.map(track => createSongPreviewCard(track, 'large', false, 'home')));
                return grid;
            }

            const wrap = document.createElement('div');
            wrap.className = 'list-wrap';
            wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';
            appendFragment(wrap, items.map((track, idx) => {
                const row = createLibrarySongRow(track, true, {
                    compact: density === 'compact',
                    hideAlbum: false,
                    showDuration: true,
                    metaContext: 'home'
                });
                if (idx === items.length - 1) row.style.border = 'none';
                return row;
            }));
            return wrap;
        }

        if (section.layout === 'list') {
            const wrap = document.createElement('div');
            wrap.className = 'list-wrap';
            wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';
            const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
            appendFragment(wrap, items.map((item, idx) => {
                const row = createCollectionRow(kind, item, 'home');
                if (idx === items.length - 1) row.style.border = 'none';
                return row;
            }));
            return wrap;
        }

        if (section.layout === 'grid') {
            const grid = document.createElement('div');
            grid.className = 'cat-grid';
            const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
            appendFragment(grid, items.map(item => createCollectionCard(kind, item, section.density, true, 'home')));
            return grid;
        }

        const scroller = document.createElement('div');
        scroller.className = 'horizon-scroller';
        const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
        appendFragment(scroller, items.map(item => createCollectionCard(kind, item, section.density, false, 'home')));
        return scroller;
    }

    function updateHomeSection(sectionId, patch) {
        const idx = homeSections.findIndex(section => section.id === sectionId);
        if (idx < 0) return;
        const next = { ...homeSections[idx], ...patch };
        if (next.itemType === 'songs') next.layout = ensureSongLayoutForDensity(next.layout, next.density);
        homeSections[idx] = next;
        saveCurrentHomeProfileLayout();
        renderHomeSections();
    }

    function moveHomeSection(sectionId, direction) {
        const idx = homeSections.findIndex(section => section.id === sectionId);
        if (idx < 0) return;
        const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= homeSections.length) return;
        const temp = homeSections[idx];
        homeSections[idx] = homeSections[nextIdx];
        homeSections[nextIdx] = temp;
        saveCurrentHomeProfileLayout();
        renderHomeSections();
    }
    function removeHomeSection(sectionId) {
        const idx = homeSections.findIndex(section => section.id === sectionId);
        if (idx < 0) return;
        const removed = { ...homeSections[idx] };
        if (homeSections[idx].core) homeSections[idx].enabled = false;
        else homeSections.splice(idx, 1);
        saveCurrentHomeProfileLayout();
        renderHomeSections();
        presentUndoToast(`${removed.title || 'Section'} removed`, 'Undo', () => {
            const currentIndex = homeSections.findIndex(section => section.id === removed.id);
            if (currentIndex >= 0) {
                homeSections[currentIndex] = { ...homeSections[currentIndex], enabled: true };
            } else {
                homeSections.splice(Math.max(0, Math.min(idx, homeSections.length)), 0, removed);
            }
            saveCurrentHomeProfileLayout();
            renderHomeSections();
        });
    }

    function openItemCountPicker(sectionId, offset = 0) {
        const section = homeSections.find(s => s.id === sectionId);
        if (!section) return;
        const options = [4, 6, 8, 12, 16];
        const page = options.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map(limit => ({
            label: `${limit} items`,
            description: 'Visible before truncation.',
            icon: 'stack',
            onSelect: () => updateHomeSection(sectionId, { limit })
        }));
        if (offset + SHEET_PAGE_SIZE < options.length) {
            actions.push({ label: 'More Counts', description: 'Show larger item limits.', icon: 'down', keepOpen: true, onSelect: () => openItemCountPicker(sectionId, offset + SHEET_PAGE_SIZE) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous counts.', icon: 'up', keepOpen: true, onSelect: () => openItemCountPicker(sectionId, Math.max(0, offset - SHEET_PAGE_SIZE)) });
        }
        presentActionSheet('Item Count', section.title, actions);
    }

    function getLayoutOptionsForSection(section) {
        if (section.itemType !== 'songs') {
            return [
                { value: 'list', label: 'Track Column', description: 'Vertical rows with inline actions.', icon: 'stack' },
                { value: 'carousel', label: 'Carousel', description: 'Horizontal shelf presentation.', icon: 'carousel' },
                { value: 'grid', label: 'Poster Grid', description: 'Visual browsing grid.', icon: 'grid' }
            ];
        }
        return [
            { value: 'list', label: 'Track Column', description: 'Compact rows with artwork and quick actions.', icon: 'stack' },
            { value: 'carousel', label: 'Carousel', description: 'Immersive horizontal song rail.', icon: 'carousel' },
            { value: 'grid', label: 'Poster Grid', description: 'Cover-driven song tiles.', icon: 'grid' }
        ].filter(option => !(section.density === 'compact' && option.value === 'grid'));
    }

    function openLayoutPicker(sectionId, offset = 0) {
        const section = homeSections.find(s => s.id === sectionId);
        if (!section) return;
        const options = getLayoutOptionsForSection(section);
        const page = options.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map(option => ({
            label: option.label,
            description: option.description,
            icon: option.icon,
            onSelect: () => updateHomeSection(sectionId, { layout: option.value })
        }));
        if (offset + SHEET_PAGE_SIZE < options.length) {
            actions.push({ label: 'More Layouts', description: 'Show additional presentation modes.', icon: 'down', keepOpen: true, onSelect: () => openLayoutPicker(sectionId, offset + SHEET_PAGE_SIZE) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous layout options.', icon: 'up', keepOpen: true, onSelect: () => openLayoutPicker(sectionId, Math.max(0, offset - SHEET_PAGE_SIZE)) });
        }
        presentActionSheet('Presentation Mode', section.title, actions);
    }

    function applySectionTemplate(sectionId, template) {
        updateHomeSection(sectionId, {
            type: template.type,
            title: template.title,
            itemType: template.itemType,
            layout: template.layout,
            density: template.density,
            limit: template.limit,
            enabled: true
        });
    }

    function addSectionFromTemplate(template) {
        const existing = homeSections.find(section => section.type === template.type);
        if (existing && existing.enabled !== false) {
            toast(`${template.title} already exists`);
            showSectionConfigMenu(existing.id);
            return;
        }
        if (existing && existing.enabled === false) {
            updateHomeSection(existing.id, { enabled: true });
            toast(`${template.title} restored`);
            return;
        }
        homeSections.push({
            id: toSafeId(template.type),
            type: template.type,
            title: template.title,
            itemType: template.itemType,
            layout: template.layout,
            density: template.density,
            limit: template.limit,
            enabled: true,
            core: Boolean(template.core)
        });
        saveCurrentHomeProfileLayout();
        renderHomeSections();
        toast(`${template.title} added`);
    }

    function openSectionFilterStep({ mode, sectionId = '', itemType, offset = 0 }) {
        const all = getSectionCatalog().filter(template => template.itemType === itemType);
        if (!all.length) {
            toast('No filters available for this type');
            return;
        }
        const page = all.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map(template => {
            const existing = homeSections.find(section => section.type === template.type);
            const alreadyVisible = existing && existing.enabled !== false;
            const isCurrent = mode === 'update' && sectionId && existing && existing.id === sectionId;
            const description = `${formatLayoutLabel(template.layout)} • ${template.limit} items`;
            if (mode === 'add') {
                if (alreadyVisible) {
                    return { label: `${template.title} (Added)`, description, icon: 'filter', onSelect: () => showSectionConfigMenu(existing.id) };
                }
                return { label: template.title, description, icon: 'filter', onSelect: () => addSectionFromTemplate(template) };
            }
            return { label: template.title, description, icon: 'filter', onSelect: () => applySectionTemplate(sectionId, template), active: Boolean(isCurrent) };
        });

        if (offset + SHEET_PAGE_SIZE < all.length) {
            actions.push({ label: 'More Filters', description: 'See additional filter choices.', icon: 'down', keepOpen: true, onSelect: () => openSectionFilterStep({ mode, sectionId, itemType, offset: offset + SHEET_PAGE_SIZE }) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous filters.', icon: 'up', keepOpen: true, onSelect: () => openSectionFilterStep({ mode, sectionId, itemType, offset: Math.max(0, offset - SHEET_PAGE_SIZE) }) });
        } else {
            actions.push({
                label: 'Change Type',
                description: 'Return to step 1.',
                icon: 'source',
                keepOpen: true,
                onSelect: () => {
                    if (mode === 'add') openAddTypeStep(0);
                    else openSectionTypeStep(sectionId, 0);
                }
            });
        }
        presentActionSheet(mode === 'add' ? 'Create Home Section' : 'Section Source', 'Step 2 of 2 • Select filter', actions);
    }

    function openSectionTypeStep(sectionId, offset = 0) {
        const section = homeSections.find(s => s.id === sectionId);
        if (!section) return;
        const page = SECTION_TYPE_CHOICES.slice(offset, offset + TYPE_STEP_SIZE);
        const actions = page.map(choice => ({
            label: choice.label,
            description: choice.description,
            icon: choice.icon,
            onSelect: () => openSectionFilterStep({ mode: 'update', sectionId, itemType: choice.key, offset: 0 }),
            keepOpen: true
        }));
        if (offset + TYPE_STEP_SIZE < SECTION_TYPE_CHOICES.length) {
            actions.push({ label: 'More Types', description: 'Show additional section categories.', icon: 'down', keepOpen: true, onSelect: () => openSectionTypeStep(sectionId, offset + TYPE_STEP_SIZE) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous type choices.', icon: 'up', keepOpen: true, onSelect: () => openSectionTypeStep(sectionId, Math.max(0, offset - TYPE_STEP_SIZE)) });
        }
        presentActionSheet('Section Source', 'Step 1 of 2 • Select type', actions);
    }

    function openAddTypeStep(offset = 0) {
        const page = SECTION_TYPE_CHOICES.slice(offset, offset + TYPE_STEP_SIZE);
        const actions = page.map(choice => ({
            label: choice.label,
            description: choice.description,
            icon: choice.icon,
            keepOpen: true,
            onSelect: () => openSectionFilterStep({ mode: 'add', itemType: choice.key, offset: 0 })
        }));
        if (offset + TYPE_STEP_SIZE < SECTION_TYPE_CHOICES.length) {
            actions.push({ label: 'More Types', description: 'Show additional section categories.', icon: 'down', keepOpen: true, onSelect: () => openAddTypeStep(offset + TYPE_STEP_SIZE) });
        } else if (offset > 0) {
            actions.push({ label: 'Back', description: 'Return to previous type choices.', icon: 'up', keepOpen: true, onSelect: () => openAddTypeStep(Math.max(0, offset - TYPE_STEP_SIZE)) });
        }
        presentActionSheet('Create Home Section', 'Step 1 of 2 • Select type', actions);
    }

    function openSectionSubtextMenu(sectionId) {
        const section = homeSections.find((s) => s.id === sectionId);
        if (!section) return;
        const prefs = getSectionSubtextPrefs(section);
        const toggleAction = (label, description, key, enabled) => ({
            label: `${enabled ? 'Hide' : 'Show'} ${label}`,
            description,
            icon: enabled ? 'down' : 'up',
            keepOpen: true,
            onSelect: () => {
                updateSectionSubtextPrefs(sectionId, { [key]: !enabled });
                openSectionSubtextMenu(sectionId);
            }
        });
        presentActionSheet('Header Subtext', section.title, [
            toggleAction('Item count', 'Primary stat under each section title.', 'showCount', prefs.showCount),
            toggleAction('Type', 'Show section kind: songs, albums, artists, playlists.', 'showType', prefs.showType)
        ]);
    }

    function openTitleModeMenu(sectionId) {
        const section = homeSections.find((s) => s.id === sectionId);
        if (!section) return;
        presentActionSheet('Title Behavior', section.title, [
            {
                label: `Wrap in Area${homeTitleMode === 'wrap' ? ' (Active)' : ''}`,
                description: 'Allow long names to use up to two lines and stay inside each tile/row.',
                icon: 'stack',
                onSelect: () => setHomeTitleMode('wrap')
            },
            {
                label: `Marquee on Focus${homeTitleMode === 'marquee' ? ' (Active)' : ''}`,
                description: 'Keep one line and animate on hover/focus and the main carousel item.',
                icon: 'carousel',
                onSelect: () => setHomeTitleMode('marquee')
            }
        ]);
    }

