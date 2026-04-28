/*
 * Auralis JS shard: 09b-zenith-home-section-menus.js
 * Purpose: entity subtext menus, library section menus, subtext preferences UI
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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

