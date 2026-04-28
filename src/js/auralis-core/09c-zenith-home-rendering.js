/*
 * Auralis JS shard: 09c-zenith-home-rendering.js
 * Purpose: home section rendering, blueprints, drag, DOM sync
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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
            const block = document.createElement('div');
            block.className = 'home-section drag-target';
            block.dataset.sectionId = section.id;

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

