/*
 * Auralis JS shard: 09-zenith-home-sections.js
 * Purpose: home section composition and editor actions
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
        return item;
    }

    function createHomeSectionContent(section, items) {
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'home-section-empty';
            empty.textContent = 'No matching items right now.';
            return empty;
        }

        if (section.itemType === 'songs') {
            const density = section.density === 'compact' ? 'compact' : 'large';
            const layout = ensureSongLayoutForDensity(section.layout || 'list', density);

            if (layout === 'carousel') {
                const scroller = document.createElement('div');
                scroller.className = `horizon-scroller ${density === 'compact' ? 'zenith-song-rail' : ''}`;
                items.forEach(track => {
                    if (density === 'compact') scroller.appendChild(createCompactSongRailItem(track, 'home'));
                    else scroller.appendChild(createSongPreviewCard(track, 'large', true, 'home'));
                });
                return scroller;
            }

            if (layout === 'grid' && density !== 'compact') {
                const grid = document.createElement('div');
                grid.className = 'song-preview-grid';
                grid.style.gridTemplateColumns = '1fr 1fr';
                items.forEach(track => grid.appendChild(createSongPreviewCard(track, 'large', false, 'home')));
                return grid;
            }

            const wrap = document.createElement('div');
            wrap.className = 'list-wrap';
            wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';
            items.forEach((track, idx) => {
                const row = createLibrarySongRow(track, true, {
                    compact: density === 'compact',
                    hideAlbum: false,
                    showDuration: true,
                    metaContext: 'home'
                });
                if (idx === items.length - 1) row.style.border = 'none';
                wrap.appendChild(row);
            });
            return wrap;
        }

        if (section.layout === 'list') {
            const wrap = document.createElement('div');
            wrap.className = 'list-wrap';
            wrap.style.cssText = 'background:transparent; border:none; margin-bottom:0;';
            const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
            items.forEach((item, idx) => {
                const row = createCollectionRow(kind, item, 'home');
                if (idx === items.length - 1) row.style.border = 'none';
                wrap.appendChild(row);
            });
            return wrap;
        }

        if (section.layout === 'grid') {
            const grid = document.createElement('div');
            grid.className = 'cat-grid';
            const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
            items.forEach(item => grid.appendChild(createCollectionCard(kind, item, section.density, true, 'home')));
            return grid;
        }

        const scroller = document.createElement('div');
        scroller.className = 'horizon-scroller';
        const kind = section.itemType === 'albums' ? 'album' : section.itemType === 'artists' ? 'artist' : 'playlist';
        items.forEach(item => scroller.appendChild(createCollectionCard(kind, item, section.density, false, 'home')));
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
            const description = `${formatLayoutLabel(template.layout)} â€¢ ${template.limit} items`;
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
        presentActionSheet(mode === 'add' ? 'Create Home Section' : 'Section Source', 'Step 2 of 2 â€¢ Select filter', actions);
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
        presentActionSheet('Section Source', 'Step 1 of 2 â€¢ Select type', actions);
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
        presentActionSheet('Create Home Section', 'Step 1 of 2 â€¢ Select type', actions);
    }

    function showSectionManageMenu(sectionId) {
        const section = homeSections.find(s => s.id === sectionId);
        if (!section) return;
        presentActionSheet(section.title, 'Placement and visibility controls', [
            { label: 'Move Up', description: 'Shift this section earlier in Home.', icon: 'up', onSelect: () => moveHomeSection(sectionId, 'up') },
            { label: 'Move Down', description: 'Shift this section later in Home.', icon: 'down', onSelect: () => moveHomeSection(sectionId, 'down') },
            { label: `Item Count (${section.limit || 8})`, description: 'Choose how many items are shown.', icon: 'stack', keepOpen: true, onSelect: () => openItemCountPicker(sectionId, 0) },
            { label: section.core ? 'Hide Section' : 'Remove Section', description: section.core ? 'Keep preset but hide from Home.' : 'Delete this custom section.', icon: 'trash', danger: true, onSelect: () => removeHomeSection(sectionId) }
        ]);
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
            toggleAction('Layout', 'Track Column, Carousel, or Poster Grid.', 'showLayout', prefs.showLayout),
            toggleAction('Density', 'Compact or large density indicator.', 'showDensity', prefs.showDensity),
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
            },
            {
                label: `Density: ${section.density} -> ${nextDensity}`,
                description: 'Compact boosts scan speed; large emphasizes artwork.',
                icon: 'density',
                onSelect: () => {
                    const patch = { density: nextDensity };
                    if (section.itemType === 'songs') patch.layout = ensureSongLayoutForDensity(section.layout, nextDensity);
                    updateHomeSection(section.id, patch);
                }
            },
            {
                label: 'Manage Position',
                description: 'Reorder, item count, hide, or remove.',
                icon: 'manage',
                keepOpen: true,
                onSelect: () => showSectionManageMenu(section.id)
            }
        ]);
    }

    function openAddHomeSection() {
        openAddTypeStep(0);
    }

    function renderHomeSections() {
        const root = getEl('home-sections-root');
        const music = getEl('home-music-section');
        const videos = getEl('home-videos-section');
        if (!root || !music || !videos) return;

        videos.style.display = 'none';
        music.style.display = 'block';

        clearTrackUiRegistryForRoot(root);
        root.innerHTML = '';
        const visible = homeSections.filter(section => section.enabled !== false);
        if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'home-section-empty';
            empty.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <div style="font-weight:600; color:white; font-size:1.1rem; margin-top:8px;">Your Home is Empty</div>
                <div style="max-width:280px; line-height:1.5;">Get started by using 'Add Section' to customize your layout and bring this page to life.</div>
            `;
            root.appendChild(empty);
            ensureAccessibility();
            return;
        }

        visible.forEach(section => {
            const block = document.createElement('div');
            block.className = 'home-section drag-target';
            block.dataset.sectionId = section.id;
            const items = getSectionItems(section);

            const header = document.createElement('div');
            header.className = 'section-header';
            const left = document.createElement('div');
            left.className = 'section-header-left';
            const drag = document.createElement('span');
            drag.className = 'section-config';
            drag.textContent = 'â‹®â‹®';
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
            actions.className = 'section-actions';

            header.appendChild(left);
            header.appendChild(actions);
            block.appendChild(header);
            block.appendChild(createHomeSectionContent(section, items));
            root.appendChild(block);
        });

        ensureAccessibility();
        scheduleTitleMotion(root);
    }

    function filterHome(type) {
        currentHomeFilter = 'all';
        renderHomeSections();
    }

    function switchLib(tab) {
        document.querySelectorAll('#library .filter-chip').forEach(btn => btn.classList.remove('active'));

