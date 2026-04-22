/*
 * Auralis JS shard: 09-zenith-home-sections.js
 * Purpose: home section composition and editor actions
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        return item;
    }

    function createHomeSectionContent(section, items) {
        if (!items.length) {
            let iconName = 'source';
            if (section.layout === 'list') iconName = 'stack';
            else if (section.layout === 'carousel') iconName = 'carousel';
            else if (section.layout === 'grid') iconName = 'grid';

            return createScreenEmptyState({
                className: 'home-section-empty zenith-section-empty',
                body: 'No matching items right now.',
                iconName
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
        if (homeSections[idx].core) homeSections[idx].enabled = false;
        else homeSections.splice(idx, 1);
        saveCurrentHomeProfileLayout();
        renderHomeSections();
        toast('Section updated');
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

    function openEntitySubtextFieldsMenu(kind = 'song', context = 'library', offset = 0) {
        const defs = getEntityFieldDefs(kind);
        if (!defs.length) return;
        const ctx = toEntityContext(context);
        const prefs = getEntitySubtextPrefs(kind, ctx);
        const page = defs.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map((field) => {
            const enabled = prefs.fields?.[field.key] === true;
            return {
                label: `${enabled ? 'Hide' : 'Show'} ${field.label}`,
                description: field.description,
                icon: enabled ? 'down' : 'up',
                keepOpen: true,
                onSelect: () => {
                    updateEntitySubtextPrefs(kind, ctx, { fields: { [field.key]: !enabled } });
                    openEntitySubtextFieldsMenu(kind, ctx, offset);
                }
            };
        });
        if (offset + SHEET_PAGE_SIZE < defs.length) {
            actions.push({
                label: 'More Fields',
                description: 'Show additional metadata tokens.',
                icon: 'down',
                keepOpen: true,
                onSelect: () => openEntitySubtextFieldsMenu(kind, ctx, offset + SHEET_PAGE_SIZE)
            });
        } else if (offset > 0) {
            actions.push({
                label: 'Back',
                description: 'Return to previous field options.',
                icon: 'up',
                keepOpen: true,
                onSelect: () => openEntitySubtextFieldsMenu(kind, ctx, Math.max(0, offset - SHEET_PAGE_SIZE))
            });
        }
        presentActionSheet(`${getEntityKindLabel(kind)} Fields`, `${getEntityContextLabel(ctx)} metadata tokens`, actions);
    }

    function openEntitySubtextSeparatorMenu(kind = 'song', context = 'library', offset = 0) {
        const ctx = toEntityContext(context);
        const prefs = getEntitySubtextPrefs(kind, ctx);
        const page = ENTITY_SUBTEXT_SEPARATOR_OPTIONS.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map((option) => {
            const active = prefs.separator === option.key;
            const separatorLabel = option.sample ? ` "${option.sample}"` : ' no separator';
            return {
                label: `${option.label}${active ? ' (Active)' : ''}`,
                description: `Use${separatorLabel} between subtext items.`,
                icon: active ? 'up' : 'stack',
                keepOpen: true,
                onSelect: () => {
                    updateEntitySubtextPrefs(kind, ctx, { separator: option.key });
                    openEntitySubtextSeparatorMenu(kind, ctx, offset);
                }
            };
        });
        if (offset + SHEET_PAGE_SIZE < ENTITY_SUBTEXT_SEPARATOR_OPTIONS.length) {
            actions.push({
                label: 'More Separators',
                description: 'Show additional separator styles.',
                icon: 'down',
                keepOpen: true,
                onSelect: () => openEntitySubtextSeparatorMenu(kind, ctx, offset + SHEET_PAGE_SIZE)
            });
        } else if (offset > 0) {
            actions.push({
                label: 'Back',
                description: 'Return to previous separator styles.',
                icon: 'up',
                keepOpen: true,
                onSelect: () => openEntitySubtextSeparatorMenu(kind, ctx, Math.max(0, offset - SHEET_PAGE_SIZE))
            });
        }
        presentActionSheet(`${getEntityKindLabel(kind)} Separator`, `${getEntityContextLabel(ctx)} separator style`, actions);
    }

    function openEntitySubtextContextMenu(kind = 'song', currentContext = 'library', offset = 0) {
        const current = toEntityContext(currentContext);
        const contexts = ENTITY_SUBTEXT_CONTEXTS.filter((ctx) => ctx !== 'default').concat('default');
        const page = contexts.slice(offset, offset + SHEET_PAGE_SIZE);
        const actions = page.map((ctx) => {
            const isCurrent = ctx === current;
            return {
                label: `${getEntityContextLabel(ctx)}${isCurrent ? ' (Editing)' : ''}`,
                description: `Customize ${getEntityKindLabel(kind).toLowerCase()} subtext for this view.`,
                icon: isCurrent ? 'up' : 'open',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu(kind, ctx)
            };
        });
        if (offset + SHEET_PAGE_SIZE < contexts.length) {
            actions.push({
                label: 'More Views',
                description: 'Show additional view scopes.',
                icon: 'down',
                keepOpen: true,
                onSelect: () => openEntitySubtextContextMenu(kind, current, offset + SHEET_PAGE_SIZE)
            });
        } else if (offset > 0) {
            actions.push({
                label: 'Back',
                description: 'Return to previous scopes.',
                icon: 'up',
                keepOpen: true,
                onSelect: () => openEntitySubtextContextMenu(kind, current, Math.max(0, offset - SHEET_PAGE_SIZE))
            });
        }
        presentActionSheet(`${getEntityKindLabel(kind)} View Scope`, `${getEntityContextLabel(current)} currently selected`, actions);
    }

    function openEntitySubtextMenu(kind = 'song', context = 'library') {
        if (!DEFAULT_ENTITY_SUBTEXT_PREFS[kind]) return;
        const ctx = toEntityContext(context);
        const prefs = getEntitySubtextPrefs(kind, ctx);
        const separator = getEntitySeparatorOption(prefs.separator);
        presentActionSheet(
            `${getEntityKindLabel(kind)} Subtext`,
            `${getEntityContextLabel(ctx)} - ${prefs.interactive ? 'Interactive' : 'Static'} - ${separator.label}`,
            [
                {
                    label: 'Fields',
                    description: 'Insert or remove metadata tokens.',
                    icon: 'filter',
                    keepOpen: true,
                    onSelect: () => openEntitySubtextFieldsMenu(kind, ctx, 0)
                },
                {
                    label: prefs.interactive ? 'Disable Interactivity' : 'Enable Interactivity',
                    description: 'Toggle tap and long-press behavior on subtext tokens.',
                    icon: prefs.interactive ? 'down' : 'up',
                    keepOpen: true,
                    onSelect: () => {
                        updateEntitySubtextPrefs(kind, ctx, { interactive: !prefs.interactive });
                        openEntitySubtextMenu(kind, ctx);
                    }
                },
                {
                    label: 'Separator',
                    description: 'Customize how metadata tokens are separated.',
                    icon: 'stack',
                    keepOpen: true,
                    onSelect: () => openEntitySubtextSeparatorMenu(kind, ctx, 0)
                },
                {
                    label: 'View Scope',
                    description: 'Switch Home, Library, Playlist, Artist, and more.',
                    icon: 'open',
                    keepOpen: true,
                    onSelect: () => openEntitySubtextContextMenu(kind, ctx, 0)
                }
            ]
        );
    }

    function openMetadataDisplayMenu(context = 'home') {
        const ctx = toEntityContext(context);
        presentActionSheet('Metadata Display', `${getEntityContextLabel(ctx)} subtext studio`, [
            {
                label: 'Song Subtext',
                description: 'Configure song metadata tokens.',
                icon: 'music',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('song', ctx)
            },
            {
                label: 'Album Subtext',
                description: 'Configure album metadata tokens.',
                icon: 'album',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('album', ctx)
            },
            {
                label: 'Playlist Subtext',
                description: 'Configure playlist metadata tokens.',
                icon: 'playlist',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('playlist', ctx)
            },
            {
                label: 'Artist Subtext',
                description: 'Configure artist metadata tokens.',
                icon: 'artist',
                keepOpen: true,
                onSelect: () => openEntitySubtextMenu('artist', ctx)
            }
        ]);
    }

    function openGenreActionMenu(bucket) {
        if (!bucket || !bucket.name) return;
        const topTrack = bucket.topTrack || null;
        const topTracks = Array.isArray(bucket.tracks)
            ? bucket.tracks
                .slice()
                .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0))
                .slice(0, 5)
            : [];
        presentActionSheet(bucket.name, `${bucket.trackCount || topTracks.length} tracks`, [
            {
                label: 'Browse Genre',
                description: 'Open Search focused on this genre.',
                icon: 'open',
                onSelect: () => routeToGenre(bucket.name)
            },
            {
                label: topTrack ? `Play "${topTrack.title}"` : 'Play Top Song',
                description: topTrack ? 'Start with the most-played song in this genre.' : 'No songs available.',
                icon: 'music',
                onSelect: () => {
                    if (!topTrack) return;
                    playTrack(topTrack.title, topTrack.artist, topTrack.albumTitle);
                }
            },
            {
                label: topTracks.length ? `Queue Top ${topTracks.length}` : 'Queue Top Songs',
                description: topTracks.length ? 'Append top songs from this genre to queue.' : 'No songs available.',
                icon: 'queue',
                onSelect: () => {
                    if (!topTracks.length) return;
                    topTracks.forEach((track) => addTrackToQueue(track));
                }
            }
        ]);
    }

    function ensureLibraryHeaderBindings() {
        const headerTitle = document.querySelector('#library .top-bar h1');
        if (!headerTitle || headerTitle.dataset.metaMenuBound === '1') return;
        headerTitle.dataset.metaMenuBound = '1';
        bindLongPressAction(headerTitle, () => openMetadataDisplayMenu('library'), 540);
        headerTitle.title = 'Long press for metadata options';
    }

    function showSectionConfigMenu(sectionRef) {
        const section = homeSections.find(s => s.id === sectionRef) || homeSections.find(s => s.title === sectionRef);
        if (!section) return;
        sectionConfigContextId = section.id;
        const nextDensity = section.density === 'compact' ? 'large' : 'compact';
        presentActionSheet(`${section.title} Settings`, 'Zenith section controls', [
            {
                label: 'Source Builder',
                description: 'Step 1 type, step 2 filter.',
                icon: 'source',
                keepOpen: true,
                onSelect: () => openSectionTypeStep(section.id, 0)
            },
            {
                label: `Presentation (${formatLayoutLabel(section.layout)})`,
                description: 'Switch between track column, carousel, and poster grid.',
                icon: section.layout === 'carousel' ? 'carousel' : section.layout === 'grid' ? 'grid' : 'stack',
                keepOpen: true,
                onSelect: () => openLayoutPicker(section.id, 0)
            },
            {
                label: 'Header Subtext',
                description: 'Choose which stats appear under this section title.',
                icon: 'filter',
                keepOpen: true,
                onSelect: () => openSectionSubtextMenu(section.id)
            },
            {
                label: `Title Behavior (${homeTitleMode === 'wrap' ? 'Wrap' : 'Marquee'})`,
                description: 'Wrap long titles or keep marquee-style motion.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => openTitleModeMenu(section.id)
            }
        ]);
    }

    function openAddHomeSection() {
        openAddTypeStep(0);
    }

    function renderHomeSections() {
        const root = getEl('home-sections-root');
        const music = getEl('home-music-section');
        const addBtn = document.querySelector('[data-action="openAddHomeSection"]');
        if (!root || !music) return;

        music.style.display = 'block';

        // Legacy video section — removed from HTML; ignore gracefully
        const videos = getEl('home-videos-section');
        if (videos) videos.style.display = 'none';

        clearNodeChildren(root);
        const visible = homeSections.filter(section => section.enabled !== false);
        if (addBtn) {
            if (visible.length) {
                delete addBtn.dataset.forceVisible;
                addBtn.style.removeProperty('display');
            } else {
                addBtn.dataset.forceVisible = '1';
                addBtn.style.display = 'flex';
            }
        }
        if (!visible.length) {
            appendFragment(root, [
                createScreenEmptyState({
                    className: 'home-section-empty home-profile-empty',
                    title: 'Your Home is Empty',
                    body: 'Add a section to make this profile useful.',
                    iconName: 'library',
                    action: { label: 'Add Section', action: 'openAddHomeSection' }
                })
            ]);
            ensureAccessibility();
            return;
        }

        const sectionNodes = visible.map(section => {
            const block = document.createElement('div');
            block.className = 'home-section drag-target';
            block.dataset.sectionId = section.id;
            const items = getSectionItems(section);

            const header = document.createElement('div');
            header.className = 'section-header zenith-canvas-header';
            const left = document.createElement('div');
            left.className = 'section-header-left';
            const drag = document.createElement('span');
            drag.className = 'section-config drag-handle';
            drag.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 7h8v2H8V7zm0 4h8v2H8v-2zm0 4h8v2H8v-2z"></path></svg>';
            drag.style.color = 'var(--text-tertiary)';
            const titleWrap = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.textContent = section.title;
            const subtle = document.createElement('div');
            subtle.className = 'section-subtle';
            subtle.textContent = buildSectionSubtext(section, items.length);
            left.appendChild(drag);
            titleWrap.appendChild(h2);
            if (subtle.textContent) titleWrap.appendChild(subtle);
            left.appendChild(titleWrap);
            bindLongPressAction(left, () => showSectionConfigMenu(section.id));

            const actions = document.createElement('div');
            actions.className = 'section-actions zenith-actions';
            
            // Zenith minimalistic iconography for canvas
            
            const densityBtn = document.createElement('div');
            densityBtn.className = 'icon-btn edit-action';
            densityBtn.title = 'Cycle Density';
            densityBtn.innerHTML = getIconSvg('density');
            densityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nextDensity = section.density === 'compact' ? 'large' : 'compact';
                const patch = { density: nextDensity };
                if (section.itemType === 'songs') patch.layout = ensureSongLayoutForDensity(section.layout, nextDensity);
                updateHomeSection(section.id, patch);
            });

            const countBtn = document.createElement('div');
            countBtn.className = 'icon-btn edit-action';
            countBtn.title = 'Item Count';
            countBtn.innerHTML = getIconSvg('stack');
            countBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openItemCountPicker(section.id, 0);
            });
            
            const settingsBtn = document.createElement('div');
            settingsBtn.className = 'icon-btn edit-action';
            settingsBtn.title = 'Settings';
            settingsBtn.innerHTML = getIconSvg('manage');
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showSectionConfigMenu(section.id);
            });

            const removeBtn = document.createElement('div');
            removeBtn.className = 'icon-btn edit-action danger-action';
            removeBtn.title = 'Remove';
            removeBtn.innerHTML = getIconSvg('trash');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeHomeSection(section.id);
            });

            actions.appendChild(densityBtn);
            actions.appendChild(countBtn);
            actions.appendChild(settingsBtn);
            actions.appendChild(removeBtn);

            header.appendChild(left);
            header.appendChild(actions);
            block.appendChild(header);
            block.appendChild(createHomeSectionContent(section, items));
            return block;
        });

        appendFragment(root, sectionNodes);
        bindHomeSectionDrag(root);
        ensureAccessibility();
        scheduleTitleMotion(root);
    }

    function syncHomeSectionsFromDOM(root) {
        const domIds = Array.from(root.querySelectorAll('.home-section[data-section-id]'))
            .map(el => el.dataset.sectionId);
        const visible = homeSections.filter(s => s.enabled !== false);
        const hidden = homeSections.filter(s => s.enabled === false);
        const reordered = domIds.map(id => visible.find(s => s.id === id)).filter(Boolean);
        const missing = visible.filter(s => !domIds.includes(s.id));
        homeSections.length = 0;
        reordered.forEach(s => homeSections.push(s));
        missing.forEach(s => homeSections.push(s));
        hidden.forEach(s => homeSections.push(s));
        saveCurrentHomeProfileLayout();
        if (navigator.vibrate) navigator.vibrate(20);
    }

    function bindHomeSectionDrag(root) {
        let draggingEl = null;

        root.querySelectorAll('.home-section.drag-target').forEach(block => {
            if (block.dataset.homeDragBound === '1') return;
            block.dataset.homeDragBound = '1';

            const handle = block.querySelector('.drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', () => { block.draggable = true; });
                handle.addEventListener('touchstart', () => { block.draggable = true; }, { passive: true });
            }

            block.addEventListener('dragstart', (e) => {
                draggingEl = block;
                block.classList.add('home-section-dragging');
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { if (draggingEl) draggingEl.style.opacity = '0.35'; }, 0);
            });

            block.addEventListener('dragend', () => {
                block.draggable = false;
                block.style.opacity = '';
                block.classList.remove('home-section-dragging');
                root.querySelectorAll('.home-section-drop-indicator').forEach(el => el.remove());
                draggingEl = null;
                syncHomeSectionsFromDOM(root);
            });

            block.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggingEl || draggingEl === block) return;
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                const rect = block.getBoundingClientRect();
                const insertAfter = e.clientY > rect.top + rect.height / 2;
                root.insertBefore(draggingEl, insertAfter ? block.nextSibling : block);
            });
        });
    }

    function filterHome(type) {
        currentHomeFilter = 'all';
        renderHomeSections();
    }

    function switchLib(tab) {
        document.querySelectorAll('#library .filter-chip').forEach(btn => btn.classList.remove('active'));
