# Implemented Feature Quality Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ten quality improvements for existing Auralis features in one coordinated integration pass without changing the app's core navigation, shell, or shard architecture.

**Architecture:** Keep the current static HTML/CSS/JavaScript IIFE runtime. Add small shared helpers in the existing shards only where multiple real screens use them, then improve existing renderers and QA around those helpers. Use checkpoint commits after each internal cluster even though this is one broad integration pass.

**Tech Stack:** Plain JavaScript source shards in `src/js/auralis-core/`, direct CSS shards in `src/styles/`, generated `auralis-core.js`, Node test runner, Playwright QA scripts.

---

## File Structure

- Modify: `package.json`
  Add screenshot baseline scripts.
- Modify: `scripts/qa/shared.mjs`
  Add screenshot baseline path helpers and reusable image comparison support if Playwright snapshots are not enough.
- Create: `scripts/qa/screen-baseline.mjs`
  Compare `output/playwright/screen-fidelity/*.png` against committed baselines and write a JSON report.
- Create: `scripts/qa/update-screen-baselines.mjs`
  Copy current `qa:screens` output into the baseline directory intentionally.
- Modify: `scripts/qa/playback-controls.mjs`
  Prove unified now-playing state, targeted active-state sync, and keyboard/player accessibility.
- Modify: `scripts/qa/queue-screen.mjs`
  Prove undo for queue actions, active state consistency, artwork stability, and no duplicate visible rows.
- Modify: `scripts/qa/library-screen.mjs`
  Prove playlist detail polish, persisted Library tab restore, active row state, and accessibility semantics.
- Modify: `scripts/qa/navigation-search.mjs`
  Prove recent searches, selected filter summaries, no-results suggestions, search restore, and detail routing.
- Modify: `scripts/qa/folder-setup-rescan.mjs`
  Prove scan history/status feedback and visual fit in Settings.
- Modify: `scripts/qa/persistence.mjs`
  Prove UI-only state recovery does not corrupt library/user state.
- Modify: `scripts/qa/metadata-album-art.mjs`
  Prove fallback artwork identity stability and metadata refinement art sync.
- Modify: `scripts/qa/screen-audit.mjs`
  Capture any new visual states needed by the baseline comparison.
- Modify: `src/js/auralis-core/00-shell-state-helpers.js`
  Add storage keys, UI preference helpers, undo action helper, stable artwork fallback helpers, and active-playback helper contracts.
- Modify: `src/js/auralis-core/02-layout-favorites-hydration.js`
  Use targeted now-playing/active-state sync for mini/full player and Home surfaces.
- Modify: `src/js/auralis-core/03-playback-engine.js`
  Keep playback event paths targeted and call active-state sync where appropriate.
- Modify: `src/js/auralis-core/04-navigation-renderers.js`
  Improve Search, playlist detail, Queue undo paths, navigation-state persistence, and detail/player active state.
- Modify: `src/js/auralis-core/05-media-folder-idb.js`
  Improve Settings folder scan/status rendering and folder remove undo.
- Modify: `src/js/auralis-core/06-setup-init-a11y.js`
  Harden keyboard/focus/Escape behavior.
- Modify: `src/js/auralis-core/08-zenith-components.js`
  Apply unified active row/card/action-zone state and stable artwork fallback helpers.
- Modify: `src/js/auralis-core/09-zenith-home-sections.js`
  Persist active Home profile and use unified active row/card state.
- Modify: `src/js/auralis-core/10-zenith-library-views.js`
  Persist Library tab, harden artist/library active state and artwork updates.
- Modify: `src/js/auralis-core/11-events-compat.js`
  Route existing destructive delegated actions through undo helpers and expose test hooks where needed.
- Modify: `src/styles/00-foundation.css`
  Add shared active state, recent search, selected filter, and baseline-safe overflow styles.
- Modify: `src/styles/01-player.css`
  Polish player active/keyboard states.
- Modify: `src/styles/02-controls-setup.css`
  Polish undo toast, settings scan status, dialogs, and focus states.
- Modify: `src/styles/03-album-artist.css`
  Polish playlist detail and detail active states.
- Modify: `src/styles/04-zenith-overrides.css`
  Keep dense row/card consistency overrides here.
- Generated: `auralis-core.js`
  Rebuild with `npm run build`; do not edit manually.

## Task 1: Shared Runtime Contracts For UI Quality

**Files:**
- Modify: `src/js/auralis-core/00-shell-state-helpers.js`
- Modify: `src/js/auralis-core/11-events-compat.js`
- Test: `npm run build`, `npm run qa:persistence`

- [ ] **Step 1: Add storage keys and UI preference defaults**

In `src/js/auralis-core/00-shell-state-helpers.js`, extend the existing `STORAGE_KEYS` definition with a namespaced UI preferences key:

```js
uiPreferences: 'auralis_ui_preferences_v1'
```

Add this near the existing `searchFilters` / `searchQuery` state:

```js
const UI_PREFS_VERSION = 1;
let uiPreferences = safeStorage.getJson(STORAGE_KEYS.uiPreferences, {});
if (!uiPreferences || typeof uiPreferences !== 'object' || uiPreferences.version !== UI_PREFS_VERSION) {
    uiPreferences = { version: UI_PREFS_VERSION };
}

function persistUiPreferences() {
    safeStorage.setJson(STORAGE_KEYS.uiPreferences, {
        version: UI_PREFS_VERSION,
        libraryTab: uiPreferences.libraryTab || '',
        homeProfile: uiPreferences.homeProfile || '',
        searchQuery: uiPreferences.searchQuery || '',
        searchFilters: Array.isArray(uiPreferences.searchFilters) ? uiPreferences.searchFilters : [],
        scroll: uiPreferences.scroll && typeof uiPreferences.scroll === 'object' ? uiPreferences.scroll : {}
    });
}

function setUiPreference(key, value) {
    uiPreferences[key] = value;
    persistUiPreferences();
}

function getUiPreference(key, fallback = '') {
    return uiPreferences && Object.prototype.hasOwnProperty.call(uiPreferences, key)
        ? uiPreferences[key]
        : fallback;
}
```

- [ ] **Step 2: Add stable artwork fallback helper**

Add this in `00-shell-state-helpers.js` near artwork/url helpers:

```js
function hashIdentity(value) {
    const input = String(value || 'auralis').trim() || 'auralis';
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
}

function getStableArtworkFallback(identity = '', kind = 'album') {
    const palettes = [
        ['#1f2937', '#0f766e'],
        ['#111827', '#7c3aed'],
        ['#172554', '#0891b2'],
        ['#3f1d38', '#be123c'],
        ['#052e16', '#65a30d'],
        ['#312e81', '#2563eb']
    ];
    const index = hashIdentity(`${kind}:${identity}`) % palettes.length;
    const [from, to] = palettes[index];
    return `linear-gradient(135deg, ${from}, ${to})`;
}
```

Then update `applyArtBackground` so empty or unresolved art falls back to `getStableArtworkFallback(identity, kind)` when callers pass a metadata object or dataset identity. Keep existing explicit fallback behavior intact.

- [ ] **Step 3: Add undo action helper**

Add this in `00-shell-state-helpers.js` near `toast` or shared action helpers:

```js
let activeUndoTimer = null;
let activeUndoAction = null;

function presentUndoToast(message, undoLabel, undoAction, timeoutMs = 5200) {
    activeUndoAction = typeof undoAction === 'function' ? undoAction : null;
    if (activeUndoTimer) clearTimeout(activeUndoTimer);
    activeUndoTimer = setTimeout(() => {
        activeUndoAction = null;
        activeUndoTimer = null;
    }, timeoutMs);
    toast(`${message} · ${undoLabel}`);
}

function runActiveUndoAction() {
    const action = activeUndoAction;
    activeUndoAction = null;
    if (activeUndoTimer) clearTimeout(activeUndoTimer);
    activeUndoTimer = null;
    if (typeof action === 'function') {
        action();
        toast('Undone');
        return true;
    }
    toast('Nothing to undo');
    return false;
}
```

- [ ] **Step 4: Wire delegated undo action**

In `src/js/auralis-core/11-events-compat.js`, add to `ACTION_MAP`:

```js
undoLastAction: () => runActiveUndoAction(),
```

Update the toast markup only if needed so a user can activate undo through a button. If the existing toast element is text-only, keep text fallback in this task and add button polish in Task 8.

- [ ] **Step 5: Rebuild and run persistence smoke test**

Run:

```powershell
npm run build
npm run qa:persistence
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit checkpoint**

Run:

```powershell
git add src/js/auralis-core/00-shell-state-helpers.js src/js/auralis-core/11-events-compat.js auralis-core.js
git commit -m "feat: add shared quality integration helpers"
git tag -a snapshot-20260422-quality-shared-helpers -m "Quality integration shared helpers"
```

## Task 2: Unified Now-Playing State

**Files:**
- Modify: `src/js/auralis-core/02-layout-favorites-hydration.js`
- Modify: `src/js/auralis-core/03-playback-engine.js`
- Modify: `src/js/auralis-core/04-navigation-renderers.js`
- Modify: `src/js/auralis-core/08-zenith-components.js`
- Modify: `src/js/auralis-core/09-zenith-home-sections.js`
- Modify: `src/js/auralis-core/10-zenith-library-views.js`
- Modify: `src/styles/00-foundation.css`
- Modify: `src/styles/01-player.css`
- Modify: `src/styles/04-zenith-overrides.css`
- Modify: `scripts/qa/playback-controls.mjs`
- Modify: `scripts/qa/queue-screen.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:playback`, `npm run qa:queue`, `npm run qa:screens`

- [ ] **Step 1: Add active-state assertions before implementation**

In `scripts/qa/playback-controls.mjs`, after starting playback and opening the full player, add:

```js
const activePlaybackState = await page.evaluate(() => ({
    activeRows: document.querySelectorAll('[data-track-key].is-now-playing, [data-track-key].playing-row').length,
    miniTitle: document.getElementById('mini-title')?.textContent?.trim() || '',
    playerTitle: document.getElementById('player-title')?.textContent?.trim() || '',
    activeButtons: document.querySelectorAll('[data-collection-type].is-playing, .catalog-play-btn.is-playing').length
}));
assert.ok(activePlaybackState.miniTitle, 'Mini player should show a now-playing title.');
assert.equal(activePlaybackState.playerTitle, activePlaybackState.miniTitle, 'Full player and mini player should agree on now-playing title.');
assert.ok(activePlaybackState.activeRows >= 1, 'At least one visible row should expose active now-playing state.');
```

- [ ] **Step 2: Add active row sync helper**

In `00-shell-state-helpers.js` or the existing playback helper shard that already owns `syncTrackActiveStates`, ensure the helper applies a stable class and aria label:

```js
function syncTrackActiveStates() {
    const activeKey = nowPlaying ? getTrackIdentityKey(nowPlaying) : '';
    const activeId = nowPlaying ? getStableTrackIdentity(nowPlaying) : '';
    document.querySelectorAll('[data-track-key], [data-track-id]').forEach((node) => {
        const matches = Boolean(activeKey && node.dataset.trackKey === activeKey)
            || Boolean(activeId && node.dataset.trackId === activeId);
        node.classList.toggle('is-now-playing', matches);
        node.classList.toggle('playing-row', matches && node.classList.contains('list-item'));
        if (matches) node.setAttribute('aria-current', 'true');
        else node.removeAttribute('aria-current');
    });
}
```

If `syncTrackActiveStates` already exists, update it to match this behavior instead of creating a duplicate.

- [ ] **Step 3: Call active sync after playback state changes**

In `src/js/auralis-core/03-playback-engine.js`, after `setNowPlaying`, queue activation, next/previous, and loaded metadata paths, ensure:

```js
syncTrackActiveStates();
setPlayButtonState(isPlaying);
```

Do not call `renderHomeSections()`, `renderLibraryViews()`, or `renderQueue()` from high-frequency `timeupdate`.

- [ ] **Step 4: Apply active classes in row/card factories**

In `src/js/auralis-core/08-zenith-components.js`, make `createLibrarySongRow`, `createQueueTrackRow`, `createCollectionCard`, and detail row helper output compatible `data-track-key`, `data-track-id`, `data-collection-type`, and `data-collection-key` attributes.

Use:

```js
if (nowPlaying && isSameTrack(track, nowPlaying)) {
    row.classList.add('is-now-playing', 'playing-row');
    row.setAttribute('aria-current', 'true');
}
```

- [ ] **Step 5: Add shared styles**

In `src/styles/00-foundation.css` or `04-zenith-overrides.css`, add:

```css
.is-now-playing {
    border-color:rgba(99,102,241,0.36) !important;
    background:rgba(99,102,241,0.08) !important;
}
.is-now-playing .item-content h3,
.is-now-playing .media-title {
    color:var(--text-primary);
}
.is-now-playing [aria-label*="Play"],
.catalog-play-btn.is-playing {
    box-shadow:0 0 0 1px rgba(99,102,241,0.38), 0 8px 24px rgba(0,0,0,0.24);
}
```

- [ ] **Step 6: Verify playback state**

Run:

```powershell
npm run build
npm run qa:playback
npm run qa:queue
npm run qa:screens
```

Expected: all commands exit 0; playback QA proves active rows exist and `timeupdate` still avoids unrelated rerenders.

- [ ] **Step 7: Commit checkpoint**

Run:

```powershell
git add scripts/qa/playback-controls.mjs scripts/qa/queue-screen.mjs src/js/auralis-core/02-layout-favorites-hydration.js src/js/auralis-core/03-playback-engine.js src/js/auralis-core/04-navigation-renderers.js src/js/auralis-core/08-zenith-components.js src/js/auralis-core/09-zenith-home-sections.js src/js/auralis-core/10-zenith-library-views.js src/styles/00-foundation.css src/styles/01-player.css src/styles/04-zenith-overrides.css auralis-core.js
git commit -m "feat: unify now-playing state across surfaces"
git tag -a snapshot-20260422-quality-now-playing -m "Quality integration now-playing state"
```

## Task 3: Undo For Existing Destructive Actions

**Files:**
- Modify: `src/js/auralis-core/04-navigation-renderers.js`
- Modify: `src/js/auralis-core/05-media-folder-idb.js`
- Modify: `src/js/auralis-core/11-events-compat.js`
- Modify: `src/styles/02-controls-setup.css`
- Modify: `scripts/qa/queue-screen.mjs`
- Modify: `scripts/qa/library-screen.mjs`
- Modify: `scripts/qa/folder-setup-rescan.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:queue`, `npm run qa:library`, `npm run qa:folder`

- [ ] **Step 1: Add QA for queue undo**

In `scripts/qa/queue-screen.mjs`, after clearing Up Next, add:

```js
const queueAfterClear = await page.evaluate(() => window.AuralisApp.getQueueSnapshot?.() || null);
await page.evaluate(() => window.AuralisApp.undoLastAction?.());
const queueAfterUndo = await page.evaluate(() => window.AuralisApp.getQueueSnapshot?.() || null);
assert.ok(queueAfterClear, 'Queue snapshot should be exposed for QA.');
assert.ok(queueAfterUndo.tracks.length > queueAfterClear.tracks.length, 'Undo should restore cleared queue tracks.');
```

Expose `undoLastAction` and `getQueueSnapshot` through `window.AuralisApp` in Task 3 implementation.

- [ ] **Step 2: Wrap queue clear**

In `src/js/auralis-core/04-navigation-renderers.js`, update `clearQueue()`:

```js
function clearQueue() {
    const previousTracks = queueTracks.slice();
    const previousIndex = queueIndex;
    queueTracks = nowPlaying ? [nowPlaying] : [];
    queueIndex = queueTracks.length ? 0 : -1;
    persistQueue();
    renderQueue();
    presentUndoToast('Up Next cleared', 'Undo', () => {
        queueTracks = previousTracks.slice();
        queueIndex = previousIndex;
        persistQueue();
        renderQueue();
        syncTrackActiveStates();
    });
}
```

Preserve existing behavior if the current implementation keeps the now-playing track.

- [ ] **Step 3: Wrap queue item removal**

In `removeQueueTrack(index)`, capture the removed track and index:

```js
const removedTrack = queueTracks[index];
const removedIndex = index;
queueTracks.splice(index, 1);
persistQueue();
renderQueue();
presentUndoToast(`Removed "${removedTrack.title}"`, 'Undo', () => {
    queueTracks.splice(Math.max(0, Math.min(removedIndex, queueTracks.length)), 0, removedTrack);
    persistQueue();
    renderQueue();
    syncTrackActiveStates();
});
```

- [ ] **Step 4: Wrap playlist track removal**

In `removeTrackFromUserPlaylist(playlistId, index)`, restore the removed track on undo:

```js
const removedTrack = playlist.tracks[index];
playlist.tracks.splice(index, 1);
persistUserPlaylists();
renderPlaylistDetail?.(playlist);
presentUndoToast(`Removed from ${playlist.name || playlist.title}`, 'Undo', () => {
    playlist.tracks.splice(Math.max(0, Math.min(index, playlist.tracks.length)), 0, removedTrack);
    persistUserPlaylists();
    renderPlaylistDetail?.(playlist);
    renderLibraryViews({ force: true });
});
```

- [ ] **Step 5: Wrap folder removal**

In `src/js/auralis-core/05-media-folder-idb.js`, when a settings folder is removed, snapshot the folder row data and restore it through the existing IndexedDB helper:

```js
const removedFolder = { ...folder };
await deleteMediaFolder(folder.id);
renderSettingsFolderList();
presentUndoToast(`Removed ${folder.name || 'folder'}`, 'Undo', async () => {
    await saveMediaFolder(removedFolder);
    await renderSettingsFolderList();
});
```

Use the actual local function names in this shard; do not invent duplicate IDB open logic.

- [ ] **Step 6: Add toast undo action styling**

In `src/styles/02-controls-setup.css`, add:

```css
#toast [data-action="undoLastAction"],
.toast-undo-action {
    margin-left:10px;
    border:0;
    background:transparent;
    color:#000;
    font:inherit;
    font-weight:800;
    text-decoration:underline;
    cursor:pointer;
}
```

- [ ] **Step 7: Verify undo**

Run:

```powershell
npm run build
npm run qa:queue
npm run qa:library
npm run qa:folder
```

Expected: all commands exit 0 and undo assertions pass.

- [ ] **Step 8: Commit checkpoint**

Run:

```powershell
git add scripts/qa/queue-screen.mjs scripts/qa/library-screen.mjs scripts/qa/folder-setup-rescan.mjs src/js/auralis-core/04-navigation-renderers.js src/js/auralis-core/05-media-folder-idb.js src/js/auralis-core/11-events-compat.js src/styles/02-controls-setup.css auralis-core.js
git commit -m "feat: add undo for destructive actions"
git tag -a snapshot-20260422-quality-undo -m "Quality integration undo actions"
```

## Task 4: Playlist Detail, Search, And UI State Recovery

**Files:**
- Modify: `src/js/auralis-core/04-navigation-renderers.js`
- Modify: `src/js/auralis-core/09-zenith-home-sections.js`
- Modify: `src/js/auralis-core/10-zenith-library-views.js`
- Modify: `src/styles/00-foundation.css`
- Modify: `src/styles/03-album-artist.css`
- Modify: `scripts/qa/library-screen.mjs`
- Modify: `scripts/qa/navigation-search.mjs`
- Modify: `scripts/qa/persistence.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:library`, `npm run qa:navigation`, `npm run qa:persistence`

- [ ] **Step 1: Add playlist detail QA**

In `scripts/qa/library-screen.mjs`, after opening playlist detail, add:

```js
const playlistHero = await page.evaluate(() => ({
    title: document.getElementById('playlist-title')?.textContent?.trim() || '',
    subtitle: document.getElementById('playlist-subtitle')?.textContent?.trim() || '',
    emptyState: document.querySelector('#playlist-track-list .screen-empty-state')?.textContent?.trim() || '',
    rows: document.querySelectorAll('#playlist-track-list .album-track-row, #playlist-track-list .detail-track-row').length
}));
assert.equal(playlistHero.title, playlistName);
assert.match(playlistHero.subtitle, /song|songs/);
assert.ok(playlistHero.rows > 0, 'Playlist detail should render track rows.');
```

Add a second playlist with no tracks and assert an empty state:

```js
const emptyPlaylistName = await page.evaluate(() => window.AuralisApp.createUserPlaylist('QA Empty Detail Mix').name);
await page.evaluate((name) => {
    const playlist = window.AuralisApp._getLibrary().playlists.find((entry) => entry.name === name || entry.title === name);
    window.AuralisApp.routeToPlaylistDetail(playlist.id);
}, emptyPlaylistName);
await page.waitForFunction(() => document.getElementById('playlist_detail')?.classList.contains('active'));
assert.match((await page.locator('#playlist-track-list').textContent()) || '', /Add Songs|empty/i);
```

- [ ] **Step 2: Improve playlist detail renderer**

In `src/js/auralis-core/04-navigation-renderers.js`, update `openPlaylist(playlistId)` to compute total duration and render an empty state:

```js
const totalSeconds = playlist.tracks.reduce((sum, track) => sum + Number(track.durationSec || toDurationSeconds(track.duration) || 0), 0);
if (subEl) {
    const tc = playlist.tracks.length;
    const durationLabel = totalSeconds > 0 ? ` • ${toDurationLabel(totalSeconds)}` : '';
    subEl.textContent = `${tc} ${tc === 1 ? 'song' : 'songs'}${durationLabel}`;
}
if (list) {
    clearNodeChildren(list);
    if (!playlist.tracks.length) {
        list.appendChild(createScreenEmptyState({
            title: 'This playlist is empty',
            body: 'Add songs from Search, Library, or the Queue.',
            iconName: 'playlist',
            action: { label: 'Add Songs', action: 'openAddSongsToPlaylist' }
        }));
    } else {
        appendFragment(list, playlist.tracks.slice(0, 200).map((track, idx) => createPlaylistDetailTrackRow(playlist, track, idx, playlist.tracks.length)));
    }
}
```

- [ ] **Step 3: Add recent search and filter-summary QA**

In `scripts/qa/navigation-search.mjs`, after searching, clearing, and reloading, add:

```js
await page.fill('#search-input', 'water');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.getElementById('search-results')?.textContent?.includes('Watermark'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.AuralisApp));
await page.evaluate(() => window.AuralisApp.switchTab('search'));
const restoredSearchState = await page.evaluate(() => ({
    query: document.getElementById('search-input')?.value || '',
    recentText: document.getElementById('search-recent-list')?.textContent || '',
    summary: document.getElementById('search-filter-summary')?.textContent || ''
}));
assert.match(`${restoredSearchState.query} ${restoredSearchState.recentText}`, /water/i);
assert.match(restoredSearchState.summary, /All|Songs|Albums|Artists/i);
```

- [ ] **Step 4: Implement search state persistence**

In `src/js/auralis-core/04-navigation-renderers.js`, update search input and filter handlers:

```js
function persistSearchUiState() {
    setUiPreference('searchQuery', searchQuery || '');
    setUiPreference('searchFilters', Array.from(searchFilters));
}
```

Call it after query and filter changes. Add a recent search list capped at five values:

```js
function rememberRecentSearch(query) {
    const value = String(query || '').trim();
    if (!value) return;
    const recent = Array.isArray(uiPreferences.recentSearches) ? uiPreferences.recentSearches : [];
    uiPreferences.recentSearches = [value, ...recent.filter((entry) => entry.toLowerCase() !== value.toLowerCase())].slice(0, 5);
    persistUiPreferences();
}
```

Render recent searches in an existing Search-owned container, or create one inside the Search browse root if no container exists:

```js
function renderRecentSearches() {
    const root = getEl('search-browse');
    if (!root) return;
    let list = getEl('search-recent-list');
    if (!list) {
        list = document.createElement('div');
        list.id = 'search-recent-list';
        list.className = 'search-recent-list';
        root.prepend(list);
    }
    const recent = Array.isArray(uiPreferences.recentSearches) ? uiPreferences.recentSearches : [];
    list.replaceChildren(...recent.map((query) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-chip';
        button.textContent = query;
        button.addEventListener('click', () => routeToSearchQuery(query));
        return button;
    }));
}
```

- [ ] **Step 5: Persist Library tab and Home profile**

In `src/js/auralis-core/10-zenith-library-views.js`, when switching tabs:

```js
setUiPreference('libraryTab', nextSection);
```

During Library render/init, read:

```js
const restoredTab = getUiPreference('libraryTab', 'playlists');
if (restoredTab && allTabs.includes(restoredTab)) currentLibrarySection = restoredTab;
```

In `src/js/auralis-core/09-zenith-home-sections.js`, persist the active profile id:

```js
setUiPreference('homeProfile', activeHomeProfileId);
```

Restore only if the profile exists.

- [ ] **Step 6: Add styles**

In `src/styles/00-foundation.css`:

```css
.search-recent-list,
.search-filter-summary {
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin:10px 0 14px;
}
.search-filter-summary {
    color:var(--text-secondary);
    font-size:12px;
}
```

- [ ] **Step 7: Verify playlist/search/persistence**

Run:

```powershell
npm run build
npm run qa:library
npm run qa:navigation
npm run qa:persistence
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit checkpoint**

Run:

```powershell
git add scripts/qa/library-screen.mjs scripts/qa/navigation-search.mjs scripts/qa/persistence.mjs src/js/auralis-core/04-navigation-renderers.js src/js/auralis-core/09-zenith-home-sections.js src/js/auralis-core/10-zenith-library-views.js src/styles/00-foundation.css src/styles/03-album-artist.css auralis-core.js
git commit -m "feat: improve playlist search and ui recovery"
git tag -a snapshot-20260422-quality-playlist-search-state -m "Quality integration playlist search state"
```

## Task 5: Scan Feedback, Accessibility, Visual Consistency, And Artwork Reliability

**Files:**
- Modify: `src/js/auralis-core/05-media-folder-idb.js`
- Modify: `src/js/auralis-core/06-setup-init-a11y.js`
- Modify: `src/js/auralis-core/08-zenith-components.js`
- Modify: `src/js/auralis-core/10-zenith-library-views.js`
- Modify: `src/styles/00-foundation.css`
- Modify: `src/styles/01-player.css`
- Modify: `src/styles/02-controls-setup.css`
- Modify: `src/styles/04-zenith-overrides.css`
- Modify: `scripts/qa/folder-setup-rescan.mjs`
- Modify: `scripts/qa/metadata-album-art.mjs`
- Modify: `scripts/qa/library-screen.mjs`
- Modify: `scripts/qa/playback-controls.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:folder`, `npm run qa:metadata`, `npm run qa:library`, `npm run qa:playback`, `npm run qa:screens`

- [ ] **Step 1: Add folder scan feedback QA**

In `scripts/qa/folder-setup-rescan.mjs`, extend folder row checks:

```js
const scanFeedback = await page.evaluate(() => ({
    header: document.getElementById('settings-media-header')?.textContent || '',
    folderStatus: document.querySelector('.settings-folder-item .settings-folder-status')?.textContent || '',
    folderMeta: document.querySelector('.settings-folder-item .settings-folder-info span')?.textContent || ''
}));
assert.match(scanFeedback.header, /files/i);
assert.match(`${scanFeedback.folderStatus} ${scanFeedback.folderMeta}`, /scan|audio|file|updated/i);
```

- [ ] **Step 2: Render scan status**

In `src/js/auralis-core/05-media-folder-idb.js`, update the settings folder row factory:

```js
const status = document.createElement('div');
status.className = 'settings-folder-status';
const lastScanned = Number(folder.lastScanned || 0);
status.textContent = lastScanned
    ? `Last scanned ${new Date(lastScanned).toLocaleDateString()}`
    : 'Ready to scan';
info.appendChild(status);
```

If scanned file count and failed count are available, include:

```js
const failedCount = Number(folder.failedCount || 0);
const fileCount = Number(folder.fileCount || 0);
meta.textContent = `${fileCount} audio file${fileCount === 1 ? '' : 's'}${failedCount ? ` • ${failedCount} failed` : ''}`;
```

- [ ] **Step 3: Add Escape and focus QA**

In `scripts/qa/playback-controls.mjs` or `scripts/qa/library-screen.mjs`, open a sheet/dialog, press Escape, and assert it closes:

```js
await page.keyboard.press('Escape');
const overlayOpen = await page.evaluate(() => Array.from(document.querySelectorAll('.show, .active'))
    .some((node) => ['action-sheet', 'create-playlist-scrim', 'tag-creator'].includes(node.id)));
assert.equal(overlayOpen, false, 'Escape should close the top open overlay.');
```

- [ ] **Step 4: Harden Escape behavior**

In `src/js/auralis-core/06-setup-init-a11y.js`, add or extend a single document keydown listener:

```js
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (albumArtViewerOpen) { closeAlbumArtViewer(); event.preventDefault(); return; }
    if (getEl('action-sheet')?.classList.contains('show')) { closeSheet(); event.preventDefault(); return; }
    if (getEl('tag-creator')?.classList.contains('show')) { closeTagCreator(); event.preventDefault(); return; }
    if (getEl('create-playlist-scrim')?.classList.contains('show')) { closeCreatePlaylistDialog(); event.preventDefault(); return; }
    if (getEl('sidebar')?.classList.contains('show')) { closeSidebar(); event.preventDefault(); return; }
    if (getEl('player')?.classList.contains('active')) { toggleOverlay('player'); event.preventDefault(); }
});
```

Guard against duplicate listeners with a dataset flag or module-level boolean if this init can run more than once.

- [ ] **Step 5: Improve artwork fallback application**

In `src/js/auralis-core/08-zenith-components.js` and `10-zenith-library-views.js`, replace generic fallback gradients for album/artist/playlist cards with:

```js
applyArtBackground(cover, item.artUrl, getStableArtworkFallback(item.title || item.name || item.id, kind));
```

For tracks:

```js
applyArtBackground(icon, track.artUrl, getStableArtworkFallback(getStableTrackIdentity(track) || track.title, 'track'));
```

- [ ] **Step 6: Add artwork QA**

In `scripts/qa/metadata-album-art.mjs`, add a no-art fixture check:

```js
const fallbackArt = await page.evaluate(() => {
    const first = document.querySelector('.media-card .media-cover, .item-icon');
    return first ? getComputedStyle(first).backgroundImage : '';
});
assert.match(fallbackArt, /gradient|linear-gradient/i, 'Missing artwork should use a stable fallback gradient.');
```

- [ ] **Step 7: Add visual consistency styles**

In `src/styles/04-zenith-overrides.css`, consolidate repeated row/card minimums:

```css
.zenith-row,
.album-track-row,
.queue-row,
.settings-folder-item {
    min-height:44px;
}
.zenith-row .item-clickable,
.album-track-row .item-clickable,
.queue-row .item-clickable {
    min-width:0;
}
.zenith-action-zone,
.album-track-duration {
    flex:0 0 auto;
}
```

- [ ] **Step 8: Verify scan/accessibility/artwork**

Run:

```powershell
npm run build
npm run qa:folder
npm run qa:metadata
npm run qa:library
npm run qa:playback
npm run qa:screens
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit checkpoint**

Run:

```powershell
git add scripts/qa/folder-setup-rescan.mjs scripts/qa/metadata-album-art.mjs scripts/qa/library-screen.mjs scripts/qa/playback-controls.mjs src/js/auralis-core/05-media-folder-idb.js src/js/auralis-core/06-setup-init-a11y.js src/js/auralis-core/08-zenith-components.js src/js/auralis-core/10-zenith-library-views.js src/styles/00-foundation.css src/styles/01-player.css src/styles/02-controls-setup.css src/styles/04-zenith-overrides.css auralis-core.js
git commit -m "feat: improve scan accessibility and artwork quality"
git tag -a snapshot-20260422-quality-trust-fit-art -m "Quality integration trust fit art"
```

## Task 6: Screenshot Regression Baselines

**Files:**
- Modify: `package.json`
- Modify: `scripts/qa/shared.mjs`
- Create: `scripts/qa/screen-baseline.mjs`
- Create: `scripts/qa/update-screen-baselines.mjs`
- Modify: `scripts/qa/screen-audit.mjs`
- Test: `npm run qa:screens`, `npm run qa:screens:update-baseline`, `npm run qa:screens:compare`

- [ ] **Step 1: Add package scripts**

In `package.json`, add:

```json
"qa:screens:update-baseline": "node scripts/qa/update-screen-baselines.mjs",
"qa:screens:compare": "node scripts/qa/screen-baseline.mjs"
```

- [ ] **Step 2: Create baseline updater**

Create `scripts/qa/update-screen-baselines.mjs`:

```js
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from './shared.mjs';

const sourceDir = path.join(REPO_ROOT, 'output', 'playwright', 'screen-fidelity');
const baselineDir = path.join(REPO_ROOT, 'scripts', 'qa', 'baselines', 'screen-fidelity');
await mkdir(baselineDir, { recursive: true });

const pngs = (await readdir(sourceDir)).filter((name) => name.endsWith('.png')).sort();
if (!pngs.length) {
    throw new Error(`No screen captures found in ${sourceDir}. Run npm run qa:screens first.`);
}

for (const name of pngs) {
    await copyFile(path.join(sourceDir, name), path.join(baselineDir, name));
}

await writeFile(path.join(baselineDir, 'manifest.json'), JSON.stringify({
    updatedAt: new Date().toISOString(),
    screens: pngs
}, null, 2));

console.log(`[qa:screens:update-baseline] Updated ${pngs.length} baselines.`);
```

- [ ] **Step 3: Create baseline compare script**

Create `scripts/qa/screen-baseline.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from './shared.mjs';

const currentDir = path.join(REPO_ROOT, 'output', 'playwright', 'screen-fidelity');
const baselineDir = path.join(REPO_ROOT, 'scripts', 'qa', 'baselines', 'screen-fidelity');
const reportDir = path.join(REPO_ROOT, 'output', 'playwright', 'screen-baseline');
await mkdir(reportDir, { recursive: true });

async function listPngs(dir) {
    try {
        return (await readdir(dir)).filter((name) => name.endsWith('.png')).sort();
    } catch (_) {
        return [];
    }
}

const baseline = await listPngs(baselineDir);
const current = await listPngs(currentDir);
const missing = baseline.filter((name) => !current.includes(name));
const added = current.filter((name) => !baseline.includes(name));
const changed = [];

for (const name of baseline.filter((entry) => current.includes(entry))) {
    const [left, right] = await Promise.all([
        readFile(path.join(baselineDir, name)),
        readFile(path.join(currentDir, name))
    ]);
    if (left.length !== right.length || !left.equals(right)) {
        const baseStat = await stat(path.join(baselineDir, name));
        const currentStat = await stat(path.join(currentDir, name));
        changed.push({ name, baselineBytes: baseStat.size, currentBytes: currentStat.size });
    }
}

const report = { generatedAt: new Date().toISOString(), missing, added, changed };
await writeFile(path.join(reportDir, 'screen-baseline-report.json'), JSON.stringify(report, null, 2));

assert.deepEqual(missing, [], 'Every baseline screenshot should have a current capture.');
assert.deepEqual(added, [], 'Every current screenshot should have an intentional baseline.');
assert.deepEqual(changed, [], 'Current screenshots should match committed baselines. Run qa:screens:update-baseline after approving visual changes.');
console.log('[qa:screens:compare] PASS');
```

This byte-level comparison is intentionally strict for the first iteration. If it proves too noisy, replace the changed-file block with a pixel tolerance implementation in a follow-up.

- [ ] **Step 4: Generate initial baselines**

Run:

```powershell
npm run qa:screens
npm run qa:screens:update-baseline
npm run qa:screens:compare
```

Expected: all commands exit 0 and baseline PNGs plus `manifest.json` are created under `scripts/qa/baselines/screen-fidelity/`.

- [ ] **Step 5: Commit checkpoint**

Run:

```powershell
git add package.json scripts/qa/shared.mjs scripts/qa/screen-audit.mjs scripts/qa/screen-baseline.mjs scripts/qa/update-screen-baselines.mjs scripts/qa/baselines/screen-fidelity
git commit -m "test: add screen regression baselines"
git tag -a snapshot-20260422-quality-screen-baselines -m "Quality integration screen baselines"
```

## Task 7: Full Regression, Final Tag, And Push

**Files:**
- Verify: all changed files
- Test: full regression commands

- [ ] **Step 1: Run full regression**

Run:

```powershell
npm run build
npm test
npm run qa:home
npm run qa:navigation
npm run qa:library
npm run qa:queue
npm run qa:playback
npm run qa:folder
npm run qa:persistence
npm run qa:metadata
npm run qa:screens
npm run qa:screens:compare
```

Expected: every command exits 0.

- [ ] **Step 2: Inspect final audit artifacts**

Run:

```powershell
Get-Content output/playwright/screen-fidelity/audit-summary.json
Get-Content output/playwright/screen-baseline/screen-baseline-report.json
Get-ChildItem output/playwright/screen-fidelity -Filter *.png
```

Expected: audit summary includes Home, Search, all Library tabs, playlist detail, album detail, artist profile, full player, Queue, and Settings. Baseline report has empty `missing`, `added`, and `changed` arrays.

- [ ] **Step 3: Inspect working tree**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only existing untracked diagnostic scripts remain, unless explicitly promoted in earlier tasks. No unintended source changes remain unstaged.

- [ ] **Step 4: Create final tag**

Run:

```powershell
git tag -a v2026.04.22-implemented-feature-quality-integration -m "Implemented feature quality integration"
```

Expected: tag points at the final implementation commit.

- [ ] **Step 5: Push experimental and tags**

Run:

```powershell
git push origin experimental
git push origin v2026.04.22-implemented-feature-quality-integration
git push origin snapshot-20260422-quality-shared-helpers
git push origin snapshot-20260422-quality-now-playing
git push origin snapshot-20260422-quality-undo
git push origin snapshot-20260422-quality-playlist-search-state
git push origin snapshot-20260422-quality-trust-fit-art
git push origin snapshot-20260422-quality-screen-baselines
```

Expected: branch and tags push successfully to origin.

## Self-Review

- Spec coverage: Tasks cover all ten requested improvements: now-playing, undo, playlist detail, scan feedback, Search quality, UI recovery, accessibility, visual consistency, artwork reliability, and screenshot baselines.
- Placeholder scan: no TBD/TODO placeholders remain.
- Scope check: the plan honors the user-selected one-pass direction while using internal checkpoint commits for risk control.
- Type consistency: helper names are consistent: `setUiPreference`, `getUiPreference`, `persistUiPreferences`, `presentUndoToast`, `runActiveUndoAction`, `getStableArtworkFallback`, `syncTrackActiveStates`.
- Verification coverage: targeted QA commands are included per task, plus full final regression.
- Branch policy: plan pushes to `experimental` and does not merge `main`.
