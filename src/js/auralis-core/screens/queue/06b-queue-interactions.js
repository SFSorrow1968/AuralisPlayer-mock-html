    function startLongPress(e, title, sub) {
        clearLongPress();
        if (e && e.type === 'mousedown' && e.button !== 0) return;

        lpTimer = setTimeout(() => {
            markLongPressSuppressed(e?.currentTarget || e?.target || null);
            if (navigator.vibrate) navigator.vibrate(40);
            if (openInferredLongPressMenu(title, sub)) return;
            openSheet(title || 'Action Options', sub || 'Media Object');
        }, 600);
    }

    function clearLongPress() {
        if (lpTimer) {
            clearTimeout(lpTimer);
            lpTimer = null;
        }
    }
    // Queue behavior
    function moveQueueTrack(fromIndex, toIndex) {
        const from = Number(fromIndex);
        let to = Number(toIndex);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
        if (from < 0 || from >= queueTracks.length) return false;
        to = Math.max(0, Math.min(to, queueTracks.length - 1));
        if (from === to) return false;

        const currentIdx = getCurrentQueueIndex();
        const [moved] = queueTracks.splice(from, 1);
        queueTracks.splice(to, 0, moved);

        if (currentIdx === from) {
            queueIndex = to;
        } else if (from < currentIdx && to >= currentIdx) {
            queueIndex = Math.max(0, currentIdx - 1);
        } else if (from > currentIdx && to <= currentIdx) {
            queueIndex = Math.min(queueTracks.length - 1, currentIdx + 1);
        } else if (currentIdx >= 0) {
            queueIndex = currentIdx;
        }
        renderQueue();
        return true;
    }

    function moveQueueTrackNext(index) {
        const from = Number(index);
        if (!Number.isFinite(from)) return;
        const currentIdx = getCurrentQueueIndex();
        if (currentIdx < 0) {
            if (moveQueueTrack(from, 0)) {
                renderQueue();
                toast('Track moved to top of queue');
            }
            return;
        }
        if (from === currentIdx) {
            toast('Track is already playing');
            return;
        }
        const target = Math.min(currentIdx + 1, queueTracks.length - 1);
        if (moveQueueTrack(from, target)) {
            renderQueue();
            toast('Track will play next');
        } else {
            toast('Track is already next');
        }
    }

    function removeQueueTrack(index) {
        const idx = Number(index);
        if (!Number.isFinite(idx) || idx < 0 || idx >= queueTracks.length) return;

        const previousQueueTracks = queueTracks.slice();
        const previousQueueIndex = queueIndex;
        const previousNowPlaying = nowPlaying;
        const removed = queueTracks[idx];
        const currentIdx = getCurrentQueueIndex();
        const removingCurrent = idx === currentIdx;
        const engine = ensureAudioEngine();
        const wasPlaying = Boolean(isPlaying && engine && !engine.paused);

        const restoreRemovedTrack = () => {
            const shouldReload = Boolean(previousNowPlaying && !isSameTrack(nowPlaying, previousNowPlaying));
            queueTracks = previousQueueTracks.slice();
            queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
            if (previousNowPlaying) {
                setNowPlaying(previousNowPlaying, false);
                queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
                if (shouldReload) loadTrackIntoEngine(previousNowPlaying, wasPlaying, true);
                else setPlayButtonState(wasPlaying);
            } else {
                clearNowPlayingState();
                setPlayButtonState(false);
            }
            commitQueueChange();
            syncTrackActiveStates();
        };

        queueTracks.splice(idx, 1);
        if (!queueTracks.length) {
            queueIndex = 0;
            if (removingCurrent && engine) {
                engine.pause();
                setPlayButtonState(false);
            }
            commitQueueChange();
            presentUndoToast('Queue is now empty', 'Undo', restoreRemovedTrack);
            return;
        }

        if (removingCurrent) {
            const nextIdx = Math.min(idx, queueTracks.length - 1);
            const nextTrack = queueTracks[nextIdx];
            queueIndex = nextIdx;
            if (nextTrack) {
                setNowPlaying(nextTrack, true);
                loadTrackIntoEngine(nextTrack, wasPlaying, true);
            }
        } else if (idx < currentIdx) {
            queueIndex = Math.max(0, currentIdx - 1);
        }

        commitQueueChange();
        presentUndoToast(`Removed "${removed?.title || 'track'}"`, 'Undo', restoreRemovedTrack);
    }

    function shuffleQueueUpNext() {
        if (!shuffleQueueOrder()) {
            toast('Not enough tracks to shuffle');
            return;
        }
        renderQueue();
        toast('Queue order shuffled');
    }

    function openQueueTrackMenu(track, index) {
        if (!track) return;
        showZenithActionSheet(
            track.title || 'Queue Track',
            `${track.artist || ARTIST_NAME} - ${track.albumTitle || 'Single'} - ${track.duration || '--:--'}`,
            [
                {
                    label: 'Play Now',
                    description: 'Jump to this track immediately.',
                    icon: 'music',
                    onSelect: () => playQueueTrackAt(index, true)
                },
                {
                    label: 'Move Next',
                    description: 'Place this track right after the current song.',
                    icon: 'next',
                    onSelect: () => moveQueueTrackNext(index)
                },
                {
                    label: 'Open Album',
                    description: track.albumTitle || 'Jump to source album.',
                    icon: 'album',
                    onSelect: () => routeToAlbumDetail(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track))
                },
                {
                    label: 'Remove From Queue',
                    description: 'Drop this track from the run list.',
                    icon: 'trash',
                    danger: true,
                    onSelect: () => removeQueueTrack(index)
                }
            ]
        );
    }

    function clearQueue() {
        if (!queueTracks.length) {
            toast('Queue is already empty');
            renderQueue();
            return;
        }
        const previousQueueTracks = queueTracks.slice();
        const previousQueueIndex = queueIndex;
        const previousNowPlaying = nowPlaying;
        const engine = ensureAudioEngine();
        const wasPlaying = Boolean(isPlaying && engine && !engine.paused);

        const restoreClearedQueue = () => {
            const shouldReload = Boolean(previousNowPlaying && !isSameTrack(nowPlaying, previousNowPlaying));
            queueTracks = previousQueueTracks.slice();
            queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
            if (previousNowPlaying) {
                setNowPlaying(previousNowPlaying, false);
                queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
                if (shouldReload) loadTrackIntoEngine(previousNowPlaying, wasPlaying, true);
                else setPlayButtonState(wasPlaying);
            } else {
                clearNowPlayingState();
                setPlayButtonState(false);
            }
            commitQueueChange();
            syncTrackActiveStates();
        };

        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0 && queueTracks[currentIdx]) {
            const currentTrack = queueTracks[currentIdx];
            queueTracks = [currentTrack];
            queueIndex = 0;
            commitQueueChange();
            presentUndoToast('Cleared upcoming tracks', 'Undo', restoreClearedQueue);
            return;
        }
        queueTracks = [];
        queueIndex = 0;
        commitQueueChange();
        presentUndoToast('Queue cleared', 'Undo', restoreClearedQueue);
    }

    function addCurrentToQueue() {
        if (!nowPlaying) return;
        if (!insertTrackInQueue(nowPlaying, 'end')) return;
        commitQueueChange(`Added "${nowPlaying.title}" to queue`);
    }

    function playCurrentNext() {
        if (!nowPlaying) return;
        const key = getTrackIdentityKey(nowPlaying);
        queueTracks = queueTracks.filter((track) => getTrackIdentityKey(track) !== key);
        const currentIdx = Math.max(0, getCurrentQueueIndex());
        queueTracks.splice(Math.min(currentIdx + 1, queueTracks.length), 0, nowPlaying);
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(0, MAX_QUEUE_SIZE);
        commitQueueChange(`"${nowPlaying.title}" will play next`);
    }

    function bindQueueInteractions(container = null) {
        const list = container || getEl('player-inline-queue-list');
        if (!list || list.dataset.queueBound === '1') return;
        list.dataset.queueBound = '1';

        let dragSourceIndex = -1;
        let dragSourceRow = null;

        const clearDropMarkers = () => {
            list.querySelectorAll('.queue-row.queue-drop-before, .queue-row.queue-drop-after').forEach((row) => {
                row.classList.remove('queue-drop-before', 'queue-drop-after');
            });
        };

        list.addEventListener('dragstart', (evt) => {
            const handle = evt.target?.closest('.queue-drag-handle');
            const row = handle?.closest('.queue-row');
            if (!row || row.dataset.queueReorderable !== '1') {
                evt.preventDefault();
                return;
            }
            dragSourceRow = row;
            dragSourceIndex = Number(row.dataset.queueIndex);
            row.classList.add('is-dragging');
            if (evt.dataTransfer) {
                evt.dataTransfer.effectAllowed = 'move';
                evt.dataTransfer.setData('text/plain', String(dragSourceIndex));
            }
        });

        list.addEventListener('dragover', (evt) => {
            const row = evt.target?.closest('.queue-row');
            if (!row || row === dragSourceRow || !list.contains(row) || row.dataset.queueReorderable !== '1') return;
            evt.preventDefault();
            clearDropMarkers();
            const rect = row.getBoundingClientRect();
            const insertAfter = evt.clientY > (rect.top + rect.height / 2);
            row.classList.add(insertAfter ? 'queue-drop-after' : 'queue-drop-before');
        });

        list.addEventListener('drop', (evt) => {
            const row = evt.target?.closest('.queue-row');
            if (!row || row === dragSourceRow || dragSourceIndex < 0 || row.dataset.queueReorderable !== '1') return;
            evt.preventDefault();
            const targetIndex = Number(row.dataset.queueIndex);
            const rect = row.getBoundingClientRect();
            const insertAfter = evt.clientY > (rect.top + rect.height / 2);
            let nextIndex = targetIndex + (insertAfter ? 1 : 0);
            if (dragSourceIndex < nextIndex) nextIndex -= 1;
            if (moveQueueTrack(dragSourceIndex, nextIndex)) {
                queueDragSuppressUntil = Date.now() + 220;
                renderQueue();
            }
        });

        list.addEventListener('dragend', () => {
            clearDropMarkers();
            if (dragSourceRow) dragSourceRow.classList.remove('is-dragging');
            dragSourceRow = null;
            dragSourceIndex = -1;
        });

        let touchDrag = null;
        const cleanupTouchDrag = (applyMove) => {
            if (!touchDrag) return;
            const { row, ghost, placeholder, fromIndex } = touchDrag;
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
            if (row) {
                row.style.visibility = '';
                row.classList.remove('is-dragging');
            }

            if (applyMove && placeholder && list.contains(placeholder)) {
                const previousRow = placeholder.previousElementSibling?.classList?.contains('queue-row')
                    ? placeholder.previousElementSibling
                    : null;
                const nextRow = placeholder.nextElementSibling?.classList?.contains('queue-row')
                    ? placeholder.nextElementSibling
                    : null;
                const nextIndexBeforeRemoval = nextRow
                    ? Number(nextRow.dataset.queueIndex)
                    : queueTracks.length;
                let toIndex = nextIndexBeforeRemoval;
                if (fromIndex < nextIndexBeforeRemoval) toIndex -= 1;
                if (!nextRow && previousRow && !Number.isFinite(toIndex)) {
                    toIndex = Number(previousRow.dataset.queueIndex);
                }
                if (moveQueueTrack(fromIndex, toIndex)) {
                    queueDragSuppressUntil = Date.now() + 220;
                    renderQueue();
                }
            }
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            touchDrag = null;
            clearDropMarkers();
        };

        list.addEventListener('pointerdown', (evt) => {
            if (evt.pointerType === 'mouse') return;
            const handle = evt.target?.closest('.queue-drag-handle');
            const row = handle?.closest('.queue-row');
            if (!row || !list.contains(row) || row.dataset.queueReorderable !== '1') return;
            const fromIndex = Number(row.dataset.queueIndex);
            if (!Number.isFinite(fromIndex)) return;
            evt.preventDefault();

            const rect = row.getBoundingClientRect();
            const ghost = row.cloneNode(true);
            ghost.classList.add('queue-drag-ghost');
            ghost.style.left = `${rect.left}px`;
            ghost.style.top = `${rect.top}px`;
            ghost.style.width = `${rect.width}px`;
            ghost.style.height = `${rect.height}px`;
            document.body.appendChild(ghost);

            const placeholder = document.createElement('div');
            placeholder.className = 'queue-drop-placeholder';
            placeholder.style.height = `${rect.height}px`;
            row.parentNode.insertBefore(placeholder, row.nextSibling);
            row.style.visibility = 'hidden';
            row.classList.add('is-dragging');

            touchDrag = {
                pointerId: evt.pointerId,
                row,
                ghost,
                placeholder,
                fromIndex,
                offsetY: evt.clientY - rect.top,
                offsetX: evt.clientX - rect.left
            };
        });

        list.addEventListener('pointermove', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            evt.preventDefault();
            const { ghost, offsetY, offsetX, row, placeholder } = touchDrag;
            ghost.style.top = `${evt.clientY - offsetY}px`;
            ghost.style.left = `${evt.clientX - offsetX}px`;

            const over = document.elementFromPoint(evt.clientX, evt.clientY);
            const targetRow = over?.closest('.queue-row');
            if (targetRow && targetRow !== row && list.contains(targetRow) && targetRow.dataset.queueReorderable === '1') {
                const rect = targetRow.getBoundingClientRect();
                const insertAfter = evt.clientY > (rect.top + rect.height / 2);
                list.insertBefore(placeholder, insertAfter ? targetRow.nextSibling : targetRow);
            }

            const queueScrollRoot = list?.closest('.player-inline-queue-list') || list;
            if (queueScrollRoot) {
                const bounds = queueScrollRoot.getBoundingClientRect();
                const edge = 72;
                if (evt.clientY < bounds.top + edge) queueScrollRoot.scrollTop -= 12;
                if (evt.clientY > bounds.bottom - edge) queueScrollRoot.scrollTop += 12;
            }
        });

        list.addEventListener('pointerup', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            cleanupTouchDrag(true);
        });
        list.addEventListener('pointercancel', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            cleanupTouchDrag(false);
        });
    }

    // Drag + Drop
    function bindDragAndDrop(selector) {
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.dragBound === '1') return;
            el.dataset.dragBound = '1';

            el.addEventListener('dragstart', (e) => {
                el.classList.add('dragging');
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                const dragging = el.parentElement?.querySelector('.dragging');
                if (!dragging || dragging === el) return;

                const parent = el.parentElement;
                const nodes = Array.from(parent.children);
                const dragIndex = nodes.indexOf(dragging);
                const targetIndex = nodes.indexOf(el);
                if (dragIndex < targetIndex) parent.insertBefore(dragging, el.nextSibling);
                else parent.insertBefore(dragging, el);

                if (navigator.vibrate) navigator.vibrate(20);
            });
        });
    }

    function bindTouchReorder(selector) {
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.touchReorderBound === '1') return;
            el.dataset.touchReorderBound = '1';
        });

        let drag = null;

        const start = (point, target) => {
            const rect = target.getBoundingClientRect();

            const ghost = target.cloneNode(true);
            ghost.style.cssText = `position:fixed; left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; opacity:0.85; z-index:3000; pointer-events:none; transform:scale(1.02);`;
            document.body.appendChild(ghost);

            const placeholder = document.createElement('div');
            placeholder.style.cssText = `width:${rect.width}px; height:${rect.height}px; border:2px dashed var(--sys-primary); border-radius:14px; margin:4px 0;`;

            target.style.opacity = '0.2';
            target.parentNode.insertBefore(placeholder, target.nextSibling);

            drag = {
                item: target,
                ghost,
                placeholder,
                offsetX: point.clientX - rect.left,
                offsetY: point.clientY - rect.top
            };
        };

        const move = (point) => {
            if (!drag) return;
            drag.ghost.style.left = `${point.clientX - drag.offsetX}px`;
            drag.ghost.style.top = `${point.clientY - drag.offsetY}px`;

            const parent = drag.item.parentNode;
            const siblings = Array.from(parent.querySelectorAll(selector)).filter(el => el !== drag.item);
            if (siblings.length === 0) return;

            let closest = null;
            let closestDist = Number.POSITIVE_INFINITY;
            siblings.forEach((sib) => {
                const r = sib.getBoundingClientRect();
                const cx = r.left + (r.width / 2);
                const cy = r.top + (r.height / 2);
                const dist = Math.hypot(point.clientX - cx, point.clientY - cy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = sib;
                }
            });

            if (!closest) return;
            const cRect = closest.getBoundingClientRect();
            const insertAfter = point.clientY > cRect.top + (cRect.height / 2);
            parent.insertBefore(drag.placeholder, insertAfter ? closest.nextSibling : closest);
        };

        const end = () => {
            if (!drag) return;
            const { item, ghost, placeholder } = drag;
            if (placeholder.parentNode) placeholder.parentNode.insertBefore(item, placeholder);
            item.style.opacity = '1';
            placeholder.remove();
            ghost.remove();
            drag = null;
            if (navigator.vibrate) navigator.vibrate(20);
        };

        document.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            const target = e.target.closest(selector);
            if (!target || !target.draggable) return;
            start(e, target);
            e.preventDefault();
        });

        document.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') return;
            move(e);
        });

        document.addEventListener('pointerup', end);
        document.addEventListener('pointercancel', end);

        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest(selector);
            if (!target || !target.draggable) return;
            if (!e.touches || e.touches.length === 0) return;
            start(e.touches[0], target);
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            move(Object.assign({}, e.touches[0], { target: e.target }));
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', end, { passive: true });
        document.addEventListener('touchcancel', end, { passive: true });
    }

    // Accessibility
