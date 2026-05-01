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

    function openLibraryCreateMenu() {
        presentActionSheet('Add to Library', 'Choose what to create or bring in', [
            {
                label: 'New Playlist',
                description: 'Create an empty playlist.',
                icon: 'playlist',
                onSelect: () => openCreatePlaylistDialog()
            },
            {
                label: 'Import Playlist',
                description: 'Import an M3U playlist file.',
                icon: 'folder',
                onSelect: () => importM3UFile()
            },
            {
                label: 'Smart Playlist',
                description: 'Rules-based playlists are coming soon.',
                icon: 'filter',
                onSelect: () => toast('Smart playlists coming soon')
            },
            {
                label: 'Playlist Folder',
                description: 'Folder organization placeholder.',
                icon: 'library',
                onSelect: () => toast('Playlist folders coming soon')
            }
        ]);
    }

    function showSectionConfigMenu(sectionRef) {
        const section = homeSections.find(s => s.id === sectionRef) || homeSections.find(s => s.title === sectionRef);
        if (!section) return;
        sectionConfigContextId = section.id;
        const nextDensity = section.density === 'compact' ? 'large' : 'compact';
        presentActionSheet(`${section.title} Settings`, '', [
            {
                label: 'Content',
                description: 'Choose what appears here.',
                icon: 'source',
                keepOpen: true,
                onSelect: () => openSectionTypeStep(section.id, 0)
            },
            {
                label: `Layout (${formatLayoutLabel(section.layout)})`,
                description: 'Column, carousel, or grid.',
                icon: section.layout === 'carousel' ? 'carousel' : section.layout === 'grid' ? 'grid' : 'stack',
                keepOpen: true,
                onSelect: () => openLayoutPicker(section.id, 0)
            },
            {
                label: 'Header Details',
                description: 'Pick the small stats line.',
                icon: 'filter',
                keepOpen: true,
                onSelect: () => openSectionSubtextMenu(section.id)
            },
            {
                label: `Title Style (${homeTitleMode === 'wrap' ? 'Wrap' : 'Marquee'})`,
                description: 'Control long titles.',
                icon: 'stack',
                keepOpen: true,
                onSelect: () => openTitleModeMenu(section.id)
            }
        ]);
    }

    function openAddHomeSection() {
        openAddTypeStep(0);
    }

    function showCountPopover(section, anchor) {
        // Dismiss any open popover first
        document.querySelectorAll('.count-popover').forEach(p => p.remove());

        const counts = [4, 6, 8, 12, 16];
        const popover = document.createElement('div');
        popover.className = 'count-popover';

        const label = document.createElement('span');
        label.className = 'count-popover-label';
        label.textContent = 'Show';
        popover.appendChild(label);

        counts.forEach(n => {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'count-popover-opt' + (section.limit === n ? ' is-current' : '');
            opt.textContent = n;
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                updateHomeSection(section.id, { limit: n });
                popover.remove();
            });
            popover.appendChild(opt);
        });

        // Append to emulator for correct absolute positioning
        const emulator = anchor.closest('.emulator') || document.querySelector('.emulator');
        const parent = emulator || document.body;
        popover.style.visibility = 'hidden';
        parent.appendChild(popover);

        const anchorRect = anchor.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const popWidth = popover.getBoundingClientRect().width || 220;
        const topPx = anchorRect.bottom - parentRect.top + 6;
        const idealLeft = anchorRect.left - parentRect.left + (anchor.offsetWidth / 2) - (popWidth / 2);
        const leftPx = Math.max(8, Math.min(idealLeft, parentRect.width - popWidth - 8));

        popover.style.top = topPx + 'px';
        popover.style.left = leftPx + 'px';
        popover.style.visibility = '';

        // Close on outside click
        requestAnimationFrame(() => {
            const dismiss = (ev) => {
                if (!popover.contains(ev.target)) {
                    popover.remove();
                    document.removeEventListener('click', dismiss, true);
                }
            };
            document.addEventListener('click', dismiss, true);
        });
    }

    function createSectionBlueprint(section) {
        const layout    = section.layout   || 'list';
        const itemType  = section.itemType || 'albums';
        const density   = section.density  || 'large';
        const limit     = section.limit    || 6;

        const typeIcons   = { songs: 'music', albums: 'album', artists: 'artist', playlists: 'playlist' };
        const typeLabels  = { songs: 'Songs', albums: 'Albums', artists: 'Artists', playlists: 'Playlists' };
        const layoutLabels = { list: 'Column', carousel: 'Carousel', grid: 'Grid' };
        const densityLabels = { compact: 'Compact', large: 'Large' };

        const bp = document.createElement('div');
        bp.className = 'section-blueprint';

        // Header: icon + config description
        const bpHead = document.createElement('div');
        bpHead.className = 'blueprint-head';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'blueprint-icon';
        iconWrap.innerHTML = getIconSvg(typeIcons[itemType] || 'source');

        const desc = document.createElement('div');
        desc.className = 'blueprint-desc';
        const parts = [
            typeLabels[itemType]   || itemType,
            layoutLabels[layout]  || layout,
            densityLabels[density] || density,
            `${limit} items`
        ];
        desc.innerHTML = parts.map(p => `<span class="blueprint-label">${p}</span>`).join('<span class="blueprint-sep"> · </span>');

        bpHead.appendChild(iconWrap);
        bpHead.appendChild(desc);
        bp.appendChild(bpHead);

        // Skeleton preview — shape matches the section's layout
        const preview = document.createElement('div');
        preview.className = `blueprint-preview blueprint-preview--${layout}`;

        const ghostCount = layout === 'grid' ? 4 : 3;
        for (let i = 0; i < ghostCount; i++) {
            const item = document.createElement('div');
            item.className = 'blueprint-ghost-item';

            const art = document.createElement('div');
            art.className = 'blueprint-ghost-art';
            item.appendChild(art);

            if (layout === 'list') {
                const textBlock = document.createElement('div');
                textBlock.className = 'blueprint-ghost-text';
                const l1 = document.createElement('div');
                l1.className = 'blueprint-ghost-line blueprint-ghost-line--primary';
                const l2 = document.createElement('div');
                l2.className = 'blueprint-ghost-line blueprint-ghost-line--secondary';
                textBlock.appendChild(l1);
                textBlock.appendChild(l2);
                item.appendChild(textBlock);
            } else {
                const l1 = document.createElement('div');
                l1.className = 'blueprint-ghost-line blueprint-ghost-line--primary';
                item.appendChild(l1);
            }

            preview.appendChild(item);
        }

        bp.appendChild(preview);
        return bp;
    }

    const HOME_COLLAPSED_SECTIONS_PREF = 'homeCollapsedSections';

    function getHomeSectionCollapseKey(sectionId) {
        return `${activeHomeProfileId || 'default'}:${sectionId}`;
    }

    function getHomeCollapsedSectionKeys() {
        const stored = getUiPreference(HOME_COLLAPSED_SECTIONS_PREF, []);
        return Array.isArray(stored) ? stored.filter(Boolean) : [];
    }

    function isHomeSectionCollapsed(sectionId) {
        return getHomeCollapsedSectionKeys().includes(getHomeSectionCollapseKey(sectionId));
    }

    function setHomeSectionCollapsed(sectionId, collapsed) {
        const key = getHomeSectionCollapseKey(sectionId);
        const keys = new Set(getHomeCollapsedSectionKeys());
        if (collapsed) keys.add(key);
        else keys.delete(key);
        setUiPreference(HOME_COLLAPSED_SECTIONS_PREF, Array.from(keys));
    }

    function createSectionCollapseToggle({ collapsed, label, onToggle }) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zenith-collapse-toggle';
        btn.title = collapsed ? `Expand ${label}` : `Collapse ${label}`;
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-expanded', String(!collapsed));
        btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"></path></svg>';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle();
        });
        return btn;
    }

    function renderHomeSections() {
        const root = getEl('home-sections-root');
        const music = getEl('home-music-section');
        const addBtn = document.querySelector('#home-music-section > .add-section-btn[data-action="openAddHomeSection"]');
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

        const sectionSnapshots = visible.map(section => ({
            section,
            items: getSectionItems(section)
        }));
        const hasVisibleItems = sectionSnapshots.some(snapshot => snapshot.items.length > 0);
        if (!hasVisibleItems && !inEditMode) {
            appendFragment(root, [
                createScreenEmptyState({
                    className: 'home-section-empty home-profile-empty home-overview-empty',
                    title: 'Nothing to show yet',
                    body: 'Add music or edit this Home.',
                    iconName: 'library',
                    action: { label: 'Add Music', action: 'openMediaFolderSetup' }
                })
            ]);
            ensureAccessibility();
            return;
        }

        const sectionNodes = sectionSnapshots.map(({ section, items }) => {
            const isCollapsed = isHomeSectionCollapsed(section.id);
            const block = document.createElement('div');
            block.className = 'home-section drag-target' + (isCollapsed ? ' is-collapsed' : '');
            block.dataset.sectionId = section.id;

            const header = document.createElement('div');
            header.className = 'section-header zenith-canvas-header';
            const left = document.createElement('div');
            left.className = 'section-header-left';
            const titleWrap = document.createElement('div');
            titleWrap.className = 'section-title-area';
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.textContent = section.title;
            const subtle = document.createElement('div');
            subtle.className = 'section-subtle';
            subtle.textContent = buildSectionSubtext(section, items.length);
            titleWrap.appendChild(h2);
            if (subtle.textContent) titleWrap.appendChild(subtle);
            left.appendChild(titleWrap);
            bindLongPressAction(left, () => showSectionConfigMenu(section.id));

            const collapseBtn = createSectionCollapseToggle({
                collapsed: isCollapsed,
                label: section.title,
                onToggle: () => {
                    setHomeSectionCollapsed(section.id, !isCollapsed);
                    renderHomeSections();
                }
            });

            const actions = document.createElement('div');
            actions.className = 'section-actions zenith-actions';
            
            // Zenith minimalistic iconography for canvas
            
            const densityBtn = document.createElement('div');
            densityBtn.className = 'icon-btn edit-action';
            densityBtn.title = 'Cycle Density';
            densityBtn.setAttribute('aria-label', 'Cycle density');
            densityBtn.innerHTML = getIconSvg('spacing');
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
            countBtn.setAttribute('aria-label', 'Item count');
            countBtn.innerHTML = getIconSvg('number');
            countBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showCountPopover(section, countBtn);
            });
            
            const settingsBtn = document.createElement('div');
            settingsBtn.className = 'icon-btn edit-action';
            settingsBtn.title = 'Settings';
            settingsBtn.setAttribute('aria-label', 'Section settings');
            settingsBtn.innerHTML = getIconSvg('manage');
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showSectionConfigMenu(section.id);
            });

            const removeBtn = document.createElement('div');
            removeBtn.className = 'icon-btn edit-action danger-action';
            removeBtn.title = 'Remove';
            removeBtn.setAttribute('aria-label', 'Remove section');
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
            header.appendChild(collapseBtn);
            header.appendChild(actions);
            block.appendChild(header);
            const contentWrap = document.createElement('div');
            contentWrap.className = 'section-content';
            contentWrap.appendChild(createHomeSectionContent(section, items));
            block.appendChild(contentWrap);
            block.appendChild(createSectionBlueprint(section));
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
        let pendingDrag = null;
        const dragThreshold = 6;
        const interactiveSelector = 'button, a, input, textarea, select, [contenteditable="true"], .icon-btn, .edit-action, .section-actions, .section-actions *, .search-workspace-section-actions, .search-workspace-section-actions *, .search-section-collapse-toggle, .search-section-collapse-toggle *';

        const canStartFromTarget = (event, block) => {
            if (!inEditMode) return false;
            const header = event.target?.closest?.('.section-header');
            if (!header || !block.contains(header)) return false;
            return !event.target.closest(interactiveSelector);
        };

        const moveDraggedSection = (point) => {
            if (!draggingEl) return;
            const siblings = Array.from(root.querySelectorAll('.home-section.drag-target'))
                .filter(node => node !== draggingEl);
            let target = null;
            let targetDistance = Number.POSITIVE_INFINITY;
            siblings.forEach((section) => {
                const rect = section.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const distance = Math.abs(point.clientY - centerY);
                if (distance < targetDistance) {
                    targetDistance = distance;
                    target = section;
                }
            });
            if (!target) return;
            const rect = target.getBoundingClientRect();
            const insertAfter = point.clientY > rect.top + rect.height / 2;
            root.insertBefore(draggingEl, insertAfter ? target.nextSibling : target);
        };

        const startPointerDrag = (event, block) => {
            draggingEl = block;
            block.classList.add('home-section-dragging');
            block.style.opacity = '0.42';
            block.style.touchAction = 'none';
            try {
                block.setPointerCapture?.(event.pointerId);
            } catch (_) {}
        };

        const recordDragPoint = (event) => {
            if (!pendingDrag) return;
            pendingDrag.lastX = event.clientX;
            pendingDrag.lastY = event.clientY;
        };

        const finishPointerDrag = () => {
            if (!draggingEl && !pendingDrag) return;
            const moved = Boolean(draggingEl);
            const block = draggingEl || pendingDrag?.block;
            if (block) {
                block.style.opacity = '';
                block.style.touchAction = '';
                block.classList.remove('home-section-dragging');
            }
            draggingEl = null;
            pendingDrag = null;
            if (moved) syncHomeSectionsFromDOM(root);
        };

        const removePointerListeners = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handlePointerUp);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        const handlePointerMove = (event) => {
            if (!pendingDrag) return;
            const dx = event.clientX - pendingDrag.startX;
            const dy = event.clientY - pendingDrag.startY;
            if (!draggingEl && Math.hypot(dx, dy) >= dragThreshold) startPointerDrag(event, pendingDrag.block);
            if (!draggingEl) return;
            event.preventDefault();
            moveDraggedSection(event);
        };

        const handlePointerUp = (event) => {
            recordDragPoint(event);
            if (draggingEl) moveDraggedSection({
                clientX: pendingDrag?.lastX ?? event.clientX,
                clientY: pendingDrag?.lastY ?? event.clientY
            });
            removePointerListeners();
            finishPointerDrag();
        };

        const handleMouseMove = (event) => {
            if (!pendingDrag) return;
            if (!draggingEl) startPointerDrag(event, pendingDrag.block);
            event.preventDefault();
            moveDraggedSection(event);
        };

        const handleMouseUp = (event) => {
            recordDragPoint(event);
            if (draggingEl) moveDraggedSection({
                clientX: pendingDrag?.lastX ?? event.clientX,
                clientY: pendingDrag?.lastY ?? event.clientY
            });
            removePointerListeners();
            finishPointerDrag();
        };

        if (root.dataset.homeDragDocumentBound !== '1') {
            root.dataset.homeDragDocumentBound = '1';
            document.addEventListener('pointermove', handlePointerMove, { passive: false });
            document.addEventListener('pointermove', recordDragPoint, true);
            document.addEventListener('pointerup', handlePointerUp);
            document.addEventListener('pointercancel', handlePointerUp);
            document.addEventListener('mousemove', handleMouseMove, { passive: false });
            document.addEventListener('mousemove', recordDragPoint, true);
            document.addEventListener('mouseup', handleMouseUp);
        }

        root.querySelectorAll('.home-section.drag-target').forEach(block => {
            if (block.dataset.homeDragBound === '1') return;
            block.dataset.homeDragBound = '1';
            block.draggable = Boolean(inEditMode);

            block.addEventListener('pointerdown', (event) => {
                if (!canStartFromTarget(event, block)) return;
                pendingDrag = {
                    block,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    lastX: event.clientX,
                    lastY: event.clientY
                };
                startPointerDrag(event, block);
                document.addEventListener('pointermove', handlePointerMove, { passive: false });
                document.addEventListener('pointerup', handlePointerUp);
                document.addEventListener('pointercancel', handlePointerUp);
                document.addEventListener('mousemove', handleMouseMove, { passive: false });
                document.addEventListener('mouseup', handleMouseUp);
            });

            block.addEventListener('mousedown', (event) => {
                if (event.button !== 0 || !canStartFromTarget(event, block)) return;
                pendingDrag = {
                    block,
                    pointerId: 'mouse',
                    startX: event.clientX,
                    startY: event.clientY,
                    lastX: event.clientX,
                    lastY: event.clientY
                };
                startPointerDrag(event, block);
                document.addEventListener('mousemove', handleMouseMove, { passive: false });
                document.addEventListener('mouseup', handleMouseUp);
                event.preventDefault();
            });

            block.addEventListener('pointermove', (event) => {
                if (!pendingDrag || pendingDrag.block !== block || pendingDrag.pointerId !== event.pointerId) return;
                const dx = event.clientX - pendingDrag.startX;
                const dy = event.clientY - pendingDrag.startY;
                if (!draggingEl && Math.hypot(dx, dy) >= dragThreshold) startPointerDrag(event, block);
                if (!draggingEl) return;
                event.preventDefault();
                moveDraggedSection(event);
            });

            block.addEventListener('pointerup', handlePointerUp);
            block.addEventListener('pointercancel', handlePointerUp);

            block.addEventListener('dragstart', (e) => {
                if (!canStartFromTarget(e, block)) {
                    e.preventDefault();
                    return;
                }
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

