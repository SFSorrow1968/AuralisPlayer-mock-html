/*
 * Auralis JS shard: 07b-zenith-config-entity.js
 * Purpose: entity subtext prefs, meta nodes, long-press, profile layout helpers
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function buildSectionSubtext(section, itemCount) {
        const prefs = getSectionSubtextPrefs(section);
        const parts = [];
        if (prefs.showCount) {
            const count = Number.isFinite(itemCount) ? itemCount : Math.max(1, Number(section.limit || 0));
            parts.push(`${Math.max(0, count)} items`);
        }
        if (prefs.showLayout) parts.push(formatLayoutLabel(section.layout));
        if (prefs.showDensity) parts.push(section.density || 'large');
        if (prefs.showType) parts.push(section.itemType || 'songs');
        if (!parts.length) return '';
        return parts.join(' - ');
    }

    function applyHomeTitleMode() {
        if (document?.body) document.body.dataset.titleMode = homeTitleMode;
    }

    function saveHomeTitleMode() {
        safeStorage.setItem(HOME_TITLE_MODE_KEY, homeTitleMode);
    }

    function loadHomeTitleMode() {
        const raw = String(safeStorage.getItem(HOME_TITLE_MODE_KEY) || '').trim().toLowerCase();
        homeTitleMode = HOME_TITLE_MODES.includes(raw) ? raw : 'wrap';
        applyHomeTitleMode();
    }

    function setHomeTitleMode(mode) {
        if (!HOME_TITLE_MODES.includes(mode) || mode === homeTitleMode) return;
        homeTitleMode = mode;
        saveHomeTitleMode();
        applyHomeTitleMode();
        renderLibraryViews();
    }

    function saveEntitySubtextPrefs() {
        safeStorage.setJson(ENTITY_SUBTEXT_KEY, entitySubtextPrefs);
    }

    function getEntityFieldDefs(kind) {
        return Array.isArray(ENTITY_SUBTEXT_FIELD_DEFS[kind]) ? ENTITY_SUBTEXT_FIELD_DEFS[kind] : [];
    }

    function getEntityKindLabel(kind) {
        if (kind === 'song') return 'Song';
        if (kind === 'album') return 'Album';
        if (kind === 'playlist') return 'Playlist';
        if (kind === 'artist') return 'Artist';
        return 'Media';
    }

    function toEntityContext(context = 'library') {
        const key = String(context || 'library').trim().toLowerCase();
        return ENTITY_SUBTEXT_CONTEXTS.includes(key) ? key : 'library';
    }

    function getEntityContextLabel(context = 'library') {
        const key = toEntityContext(context);
        return ENTITY_SUBTEXT_CONTEXT_LABELS[key] || key;
    }

    function normalizeEntitySeparator(value, fallback = 'dot') {
        const key = String(value || '').trim().toLowerCase();
        if (ENTITY_SUBTEXT_SEPARATOR_OPTIONS.some((opt) => opt.key === key)) return key;
        return String(fallback || 'dot').trim().toLowerCase();
    }

    function getEntitySeparatorOption(separator = 'dot') {
        const key = normalizeEntitySeparator(separator, 'dot');
        return ENTITY_SUBTEXT_SEPARATOR_OPTIONS.find((opt) => opt.key === key) || ENTITY_SUBTEXT_SEPARATOR_OPTIONS[0];
    }

    function createDefaultEntitySubtextState() {
        const state = {};
        Object.entries(DEFAULT_ENTITY_SUBTEXT_PREFS).forEach(([kind, profile]) => {
            state[kind] = {};
            ENTITY_SUBTEXT_CONTEXTS.forEach((context) => {
                state[kind][context] = {
                    interactive: profile.interactive !== false,
                    separator: normalizeEntitySeparator(profile.separator, 'dot'),
                    fields: { ...(profile.fields || {}) }
                };
            });
        });
        return state;
    }

    function normalizeEntitySubtextProfile(kind, profile, fallbackProfile = null) {
        const defs = getEntityFieldDefs(kind);
        const fallback = fallbackProfile && typeof fallbackProfile === 'object'
            ? fallbackProfile
            : DEFAULT_ENTITY_SUBTEXT_PREFS[kind] || { interactive: true, separator: 'dot', fields: {} };
        const fallbackFields = fallback.fields && typeof fallback.fields === 'object' ? fallback.fields : {};
        const source = profile && typeof profile === 'object' ? profile : {};
        const sourceFields = source.fields && typeof source.fields === 'object' ? source.fields : source;
        const fields = {};
        defs.forEach((field) => {
            if (typeof sourceFields[field.key] === 'boolean') fields[field.key] = sourceFields[field.key];
            else fields[field.key] = fallbackFields[field.key] === true;
        });
        return {
            interactive: typeof source.interactive === 'boolean'
                ? source.interactive
                : (typeof source.clickable === 'boolean' ? source.clickable : fallback.interactive !== false),
            separator: normalizeEntitySeparator(source.separator, fallback.separator || 'dot'),
            fields
        };
    }

    function loadEntitySubtextPrefs() {
        entitySubtextPrefs = createDefaultEntitySubtextState();
        try {
            const parsed = safeStorage.getJson(ENTITY_SUBTEXT_KEY, null);
            if (!parsed || typeof parsed !== 'object') return;

            Object.keys(DEFAULT_ENTITY_SUBTEXT_PREFS).forEach((kind) => {
                const kindRaw = parsed[kind];
                if (!kindRaw || typeof kindRaw !== 'object') return;

                const contextLooksPresent = ENTITY_SUBTEXT_CONTEXTS.some((ctx) => kindRaw[ctx] && typeof kindRaw[ctx] === 'object');
                if (!contextLooksPresent) {
                    const normalized = normalizeEntitySubtextProfile(kind, kindRaw, entitySubtextPrefs[kind].default);
                    ENTITY_SUBTEXT_CONTEXTS.forEach((ctx) => {
                        entitySubtextPrefs[kind][ctx] = normalizeEntitySubtextProfile(kind, normalized, entitySubtextPrefs[kind][ctx]);
                    });
                    return;
                }

                ENTITY_SUBTEXT_CONTEXTS.forEach((ctx) => {
                    if (!kindRaw[ctx] || typeof kindRaw[ctx] !== 'object') return;
                    entitySubtextPrefs[kind][ctx] = normalizeEntitySubtextProfile(kind, kindRaw[ctx], entitySubtextPrefs[kind][ctx]);
                });
            });
        } catch (_) {
            // Ignore malformed persisted preferences
        }
    }

    function getEntitySubtextPrefs(kind, context = 'library') {
        if (!DEFAULT_ENTITY_SUBTEXT_PREFS[kind]) return { interactive: true, separator: 'dot', fields: {} };
        const ctx = toEntityContext(context);
        const kindPrefs = entitySubtextPrefs[kind] || {};
        const fallback = normalizeEntitySubtextProfile(kind, DEFAULT_ENTITY_SUBTEXT_PREFS[kind], DEFAULT_ENTITY_SUBTEXT_PREFS[kind]);
        const profile = kindPrefs[ctx] || kindPrefs.default || fallback;
        return normalizeEntitySubtextProfile(kind, profile, fallback);
    }

    function updateEntitySubtextPrefs(kind, context, patch) {
        if (!DEFAULT_ENTITY_SUBTEXT_PREFS[kind]) return;
        const ctx = toEntityContext(context);
        if (!entitySubtextPrefs[kind]) entitySubtextPrefs[kind] = {};
        const current = getEntitySubtextPrefs(kind, ctx);
        const next = normalizeEntitySubtextProfile(kind, {
            ...current,
            ...(patch || {}),
            fields: {
                ...(current.fields || {}),
                ...(((patch || {}).fields) || {})
            }
        }, current);
        entitySubtextPrefs[kind][ctx] = next;
        saveEntitySubtextPrefs();
        renderLibraryViews();
    }

    function resolveTrackGenre(track) {
        const fromTrack = String(track?.genre || '').trim();
        if (fromTrack) return fromTrack;
        const fromAlbum = String(track?.albumGenre || '').trim();
        if (fromAlbum) return fromAlbum;
        return '';
    }

    function resolveAlbumGenre(album) {
        const direct = String(album?.genre || '').trim();
        if (direct) return direct;
        const counts = new Map();
        (Array.isArray(album?.tracks) ? album.tracks : []).forEach((track) => {
            const genre = resolveTrackGenre(track);
            if (!genre) return;
            counts.set(genre, (counts.get(genre) || 0) + 1);
        });
        if (!counts.size) return '';
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }

    function getGenreBuckets() {
        const bucketMap = new Map();
        LIBRARY_TRACKS.forEach((track) => {
            const genre = resolveTrackGenre(track) || 'Unknown';
            if (!bucketMap.has(genre)) {
                bucketMap.set(genre, { name: genre, tracks: [] });
            }
            bucketMap.get(genre).tracks.push(track);
        });
        return Array.from(bucketMap.values())
            .map((bucket) => ({
                ...bucket,
                trackCount: bucket.tracks.length,
                topTrack: bucket.tracks.slice().sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0))[0] || null
            }))
            .sort((a, b) => Number(b.trackCount || 0) - Number(a.trackCount || 0));
    }

    function findTabNavButton(tabId) {
        return document.querySelector(`#tabs .nav-item[data-tab="${tabId}"]`) || null;
    }

    function routeToSearchQuery(query, filters = ['all']) {
        const targetFilters = Array.isArray(filters) && filters.length ? filters : ['all'];
        switchTab('library', findTabNavButton('library'));
        const canUseSearchFilters = typeof searchFilters !== 'undefined' && searchFilters && typeof searchFilters.clear === 'function';
        if (canUseSearchFilters) {
            searchFilters.clear();
            targetFilters.forEach((f) => searchFilters.add(f));
            if (!searchFilters.size) searchFilters.add('all');
        }
        if (typeof syncSearchFilterControls === 'function') {
            syncSearchFilterControls();
        } else {
            const filterRow = getEl('search-filter-row');
            if (filterRow) {
            filterRow.querySelectorAll('.filter-chip').forEach((chip) => {
                const f = chip.dataset.filter;
                chip.classList.toggle('active', canUseSearchFilters ? searchFilters.has(f) : f === 'all');
            });
            }
        }
        const input = getEl('search-input');
        if (input) {
            input.value = query || '';
            searchQuery = String(query || '').trim();
            rememberRecentSearch(searchQuery);
            persistSearchUiState();
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            rememberRecentSearch(query);
            persistSearchUiState();
            renderSearchState();
        }
    }

    function routeToArtist(name) {
        if (!name) return;
        routeToArtistProfile(name);
    }

    function routeToAlbum(title, artist, sourceAlbumId = '') {
        if (!title) return;
        routeToAlbumDetail(title, artist, sourceAlbumId);
    }

    function routeToPlaylist(id) {
        if (!id) return;
        routeToPlaylistDetail(id);
    }

    function routeToGenre(genre) {
        const value = String(genre || '').trim();
        if (!value) {
            toast('No genre metadata found');
            return;
        }
        routeToGenreBrowse(value);
    }

    function getMetaSeparatorText(separator = 'dot') {
        const key = normalizeEntitySeparator(separator, 'dot');
        if (key === 'bullet') return '•';
        if (key === 'middot') return '·';
        if (key === 'slash') return '/';
        if (key === 'pipe') return '|';
        if (key === 'dash') return '-';
        return '';
    }

    function createMetaNode({ label, onClick, onLongPress, interactive = true, className = '', title = '' }) {
        if (!label) return null;
        const canInteract = interactive !== false;
        if (!canInteract || typeof onClick !== 'function') {
            const text = document.createElement('span');
            if (className) text.className = className;
            text.textContent = label;
            if (title) text.title = title;
            return text;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `zenith-meta-link ${className}`.trim();
        btn.textContent = label;
        if (title) btn.title = title;
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        });
        if (canInteract && typeof onLongPress === 'function') {
            bindLongPressAction(btn, () => onLongPress(), 520);
        }
        return btn;
    }

    function createMetaLine(parts, config = {}) {
        const valid = Array.isArray(parts) ? parts.filter((part) => part && part.label) : [];
        if (!valid.length) return null;
        const separator = normalizeEntitySeparator(config.separator, 'dot');
        const interactive = config.interactive !== false;
        const line = document.createElement('div');
        line.className = 'zenith-meta zenith-meta-row';
        valid.forEach((part, idx) => {
            if (idx > 0 && separator !== 'none') {
                const sep = document.createElement('span');
                sep.className = 'zenith-meta-sep';
                if (separator === 'dot') sep.classList.add('is-dot');
                else sep.textContent = getMetaSeparatorText(separator);
                line.appendChild(sep);
            }
            const node = createMetaNode({ ...part, interactive });
            if (node) line.appendChild(node);
        });
        return line;
    }

    function createInlineMetaLink(label, className, onClick, onLongPress) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `zenith-inline-link ${className || ''}`.trim();
        btn.textContent = label || '';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof onClick === 'function') onClick();
        });
        if (typeof onLongPress === 'function') bindLongPressAction(btn, onLongPress, 520);
        return btn;
    }

    function bindLongPress(el, title, sub) {
        if (!el) return;
        el.addEventListener('mousedown', (e) => startLongPress(e, title, sub));
        el.addEventListener('mouseup', clearLongPress);
        el.addEventListener('mouseleave', clearLongPress);
        el.addEventListener('touchstart', (e) => startLongPress(e, title, sub), { passive: true });
        el.addEventListener('touchend', clearLongPress, { passive: true });
    }

    function bindLongPressAction(el, onLongPress, delayMs = 560) {
        if (!el || typeof onLongPress !== 'function') return;
        const cleanupExisting = longPressBindingCleanup.get(el);
        if (typeof cleanupExisting === 'function') cleanupExisting();

        let timer = null;
        let fired = false;

        const clear = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        const start = (event) => {
            if (event && event.type === 'mousedown' && event.button !== 0) return;
            fired = false;
            clear();
            timer = setTimeout(() => {
                timer = null;
                fired = true;
                markLongPressSuppressed(el);
                if (navigator.vibrate) navigator.vibrate(35);
                onLongPress();
            }, delayMs);
        };

        const blockPostLongPressClick = (event) => {
            if (!fired) return;
            event.preventDefault();
            event.stopPropagation();
            fired = false;
        };

        const openContextMenu = (event) => {
            event.preventDefault();
            onLongPress();
        };

        const handleKeyboard = (event) => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                event.preventDefault();
                onLongPress();
            }
        };

        el.addEventListener('mousedown', start);
        el.addEventListener('touchstart', start, { passive: true });
        el.addEventListener('mouseup', clear);
        el.addEventListener('mouseleave', clear);
        el.addEventListener('touchend', clear, { passive: true });
        el.addEventListener('touchcancel', clear, { passive: true });
        el.addEventListener('click', blockPostLongPressClick, true);
        el.addEventListener('contextmenu', openContextMenu);
        el.addEventListener('keydown', handleKeyboard);

        longPressBindingCleanup.set(el, () => {
            clear();
            el.removeEventListener('mousedown', start);
            el.removeEventListener('touchstart', start, { passive: true });
            el.removeEventListener('mouseup', clear);
            el.removeEventListener('mouseleave', clear);
            el.removeEventListener('touchend', clear, { passive: true });
            el.removeEventListener('touchcancel', clear, { passive: true });
            el.removeEventListener('click', blockPostLongPressClick, true);
            el.removeEventListener('contextmenu', openContextMenu);
            el.removeEventListener('keydown', handleKeyboard);
        });
    }

    function formatLayoutLabel(layout) {
        return LAYOUT_LABELS[layout] || 'Track Column';
    }

    function ensureSongLayoutForDensity(layout, density) {
        if (layout === 'columns') return 'list';
        if (density !== 'compact') return layout;
        return layout === 'grid' ? 'list' : layout;
    }

    function createHomeProfileId() {
        if (typeof toSafeId === 'function') return toSafeId('home');
        return `home-${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeSectionForProfile(section, index = 0) {
        const next = { ...(section || {}) };
        next.id = next.id || (typeof toSafeId === 'function' ? toSafeId(next.type || 'section') : `section-${index + 1}`);
        next.type = next.type || 'recent_activity';
        next.title = next.title || 'Section';
        next.itemType = next.itemType || 'songs';
        next.density = next.density || 'compact';
        next.layout = ensureSongLayoutForDensity(next.layout || 'list', next.density);
        next.limit = Math.max(1, Number(next.limit || 8));
        next.enabled = next.enabled !== false;
        next.core = Boolean(next.core);
        return next;
    }

    function cloneSectionsForProfile(sections) {
        const input = Array.isArray(sections) ? sections : [];
        return input.map((section, index) => normalizeSectionForProfile(section, index));
    }

    function normalizeHomeProfile(profile, index = 0) {
        const nameRaw = String(profile?.name || '').trim();
        const name = nameRaw || `Home ${index + 1}`;
        const titleRaw = String(profile?.title || '').trim();
        const sections = cloneSectionsForProfile(profile?.sections);
        return {
            id: String(profile?.id || createHomeProfileId()),
            name,
            title: titleRaw || DEFAULT_HOME_TITLE,
            sections: sections.length ? sections : cloneSectionsForProfile(getDefaultHomeSections())
        };
    }

