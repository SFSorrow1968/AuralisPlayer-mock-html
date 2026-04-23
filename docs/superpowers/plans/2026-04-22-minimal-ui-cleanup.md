# Minimal UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify Auralis so Home, Search, Library, and detail screens feel calmer, more intuitive, and more visually consistent without changing the core navigation model or shard-based runtime.

**Architecture:** Keep the current HTML shell plus shard-based CSS/JavaScript runtime. Introduce one shared empty-state/selection language, then apply it screen by screen through the existing owning renderers instead of layering on more special cases. Use QA scripts already in the repo to prove each surface got quieter without breaking navigation, edit behavior, or accessibility.

**Tech Stack:** Static HTML shell, plain JavaScript source shards in `src/js/auralis-core/`, direct CSS shards in `src/styles/`, generated `auralis-core.js`, Playwright QA scripts under `scripts/qa/`, Node test runner.

---

## File Structure

- Modify: `Auralis_mock_zenith.html`
  Clean up Search and Library header structure, reduce persistent controls, and add any new local buttons needed for quieter sort/refine flows.
- Modify: `src/js/auralis-core/04-navigation-renderers.js`
  Own Search toolbar behavior, browse/results mode, search refine action, and any search-specific visibility logic.
- Modify: `src/js/auralis-core/08-zenith-components.js`
  Own the shared empty-state factory so all blank states use one component family.
- Modify: `src/js/auralis-core/09-zenith-home-sections.js`
  Own Home section rendering, edit-mode affordances, contextual item count/layout controls, and Home empty-profile behavior.
- Modify: `src/js/auralis-core/10-zenith-library-views.js`
  Own Library tabs, songs sort controls, playlist/library empty states, and artist-section configuration behavior.
- Modify: `src/js/auralis-core/06-setup-init-a11y.js`
  Keep button labels and focus semantics aligned with any renamed actions.
- Modify: `src/styles/00-foundation.css`
  Own shared Search, chip, input, and empty-state styling.
- Modify: `src/styles/03-album-artist.css`
  Remove the older boxed empty-state treatment and soften focus/selection visuals that currently read like outlines.
- Modify: `src/styles/04-zenith-overrides.css`
  Own dense Library/List overrides, reduced sort-row chrome, and calmer row/card behavior.
- Modify: `scripts/qa/home-screen.mjs`
  Prove Home edit and Home empty states match the new interaction model.
- Modify: `scripts/qa/navigation-search.mjs`
  Prove Search browse mode, refine behavior, and hidden secondary controls work as intended.
- Modify: `scripts/qa/library-screen.mjs`
  Prove Library header simplification, primary-tab behavior, quieter sort controls, and playlist empty-state actions.
- Modify: `scripts/qa/screen-audit.mjs`
  Capture before/after visual health for Search, Library, and Home.
- Generated: `auralis-core.js`
  Rebuild with `npm run build`; do not edit manually.

## Task 1: Unify Empty States And Soften Selection Language

**Files:**
- Modify: `src/js/auralis-core/08-zenith-components.js`
- Modify: `src/styles/00-foundation.css`
- Modify: `src/styles/03-album-artist.css`
- Modify: `src/styles/04-zenith-overrides.css`
- Modify: `scripts/qa/home-screen.mjs`
- Modify: `scripts/qa/library-screen.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:home`, `npm run qa:library`

- [ ] **Step 1: Add failing QA that proves the old boxed empty-state treatment is gone**

In `scripts/qa/home-screen.mjs`, after the empty-profile reload block, add:

```js
const emptyStateClasses = await page.evaluate(() => ({
    home: document.querySelector('#home-sections-root .screen-empty-state')?.className || '',
    homeProfileLegacy: document.querySelector('#home-sections-root .home-section-empty')?.className || '',
    homeAction: document.querySelector('#home-sections-root .screen-empty-action')?.textContent?.trim() || ''
}));
assert.match(emptyStateClasses.home, /screen-empty-state/);
assert.equal(emptyStateClasses.homeProfileLegacy.includes('home-section-empty'), false, 'Home empty profile should stop using the old boxed empty-state class.');
assert.equal(emptyStateClasses.homeAction, 'Add Section');
```

In `scripts/qa/library-screen.mjs`, in the playlist-empty-state section, add:

```js
const playlistEmptyClasses = await page.evaluate(() => ({
    root: document.querySelector('#lib-playlists-list .screen-empty-state')?.className || '',
    title: document.querySelector('#lib-playlists-list .screen-empty-title')?.textContent?.trim() || '',
    copy: document.querySelector('#lib-playlists-list .screen-empty-copy')?.textContent?.trim() || ''
}));
assert.match(playlistEmptyClasses.root, /screen-empty-state/);
assert.equal(playlistEmptyClasses.title, 'No playlists yet');
assert.match(playlistEmptyClasses.copy, /playlist|M3U/i);
```

- [ ] **Step 2: Run the targeted QA to see the current failure**

Run:

```powershell
npm run qa:home
npm run qa:library
```

Expected: one or both commands fail because Home still renders `home-section-empty` and the shared empty-state family is not yet the only system.

- [ ] **Step 3: Expand the shared empty-state component**

In `src/js/auralis-core/08-zenith-components.js`, replace the current helper with:

```js
function createScreenEmptyState({
    className = 'screen-empty-state',
    title = '',
    body = '',
    iconName = '',
    action = null,
    tone = 'gentle'
} = {}) {
    const box = document.createElement('section');
    box.className = `${className} screen-empty-state--${tone}`.trim();

    if (iconName) {
        const media = document.createElement('div');
        media.className = 'screen-empty-media';
        const icon = document.createElement('div');
        icon.className = 'screen-empty-icon';
        icon.innerHTML = getIconSvg(iconName);
        media.appendChild(icon);
        box.appendChild(media);
    }

    const copyWrap = document.createElement('div');
    copyWrap.className = 'screen-empty-copy-wrap';

    if (title) {
        const heading = document.createElement('strong');
        heading.className = 'screen-empty-title';
        heading.textContent = title;
        copyWrap.appendChild(heading);
    }

    if (body) {
        const copy = document.createElement('p');
        copy.className = 'screen-empty-copy';
        copy.textContent = body;
        copyWrap.appendChild(copy);
    }

    box.appendChild(copyWrap);

    if (action && action.label && action.action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'screen-empty-action';
        button.dataset.action = action.action;
        if (action.target) button.dataset.target = action.target;
        button.textContent = action.label;
        box.appendChild(button);
    }

    return box;
}
```

- [ ] **Step 4: Replace the older boxed empty-state styling**

In `src/styles/00-foundation.css`, replace the existing empty-state block with:

```css
.screen-empty-state,
.home-profile-empty {
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    gap:14px;
    padding:28px 22px;
    border:none;
    border-radius:24px;
    background:linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%);
}
.screen-empty-media {
    display:flex;
    align-items:center;
    justify-content:center;
}
.screen-empty-icon {
    width:52px;
    height:52px;
    border-radius:18px;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(255,255,255,0.06);
    color:#f8fafc;
}
.screen-empty-title {
    color:var(--text-primary);
    font-size:19px;
    font-weight:700;
    letter-spacing:-0.02em;
}
.screen-empty-copy {
    margin:0;
    max-width:280px;
    color:var(--text-secondary);
    font-size:14px;
    line-height:1.55;
}
.screen-empty-action {
    border:none;
    border-radius:999px;
    min-height:40px;
    padding:0 16px;
    background:rgba(255,255,255,0.09);
    color:var(--text-primary);
    font:inherit;
    font-size:13px;
    font-weight:700;
}
```

In `src/styles/03-album-artist.css`, replace the old boxed rules with:

```css
.empty-state,
.home-section-empty {
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    justify-content:flex-start;
    text-align:left;
    padding:0;
    border:none;
    background:transparent;
    color:inherit;
    margin:0;
    gap:0;
    backdrop-filter:none;
}
.empty-state-icon,
.home-section-empty svg {
    display:none;
}
```

- [ ] **Step 5: Soften focus and selected states**

In `src/styles/03-album-artist.css`, replace the current global focus block with:

```css
[role="button"]:focus-visible,
a:focus-visible,
button:focus-visible,
input:focus-visible {
    outline:none;
    box-shadow:0 0 0 1px rgba(255,255,255,0.16), 0 0 0 6px rgba(255,255,255,0.05);
}
```

In `src/styles/00-foundation.css`, reduce the selected-chip visual harshness:

```css
.filter-chip.active,
.pill-btn.active {
    background:linear-gradient(135deg, #7068f6 0%, #8d7aff 100%);
    color:#fff;
    border-color:transparent;
    box-shadow:0 10px 22px rgba(99,102,241,0.22);
    text-shadow:none;
}
```

- [ ] **Step 6: Rebuild and rerun the QA**

Run:

```powershell
npm run build
npm run qa:home
npm run qa:library
```

Expected: all commands exit 0 and the new assertions pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add scripts/qa/home-screen.mjs scripts/qa/library-screen.mjs src/js/auralis-core/08-zenith-components.js src/styles/00-foundation.css src/styles/03-album-artist.css src/styles/04-zenith-overrides.css auralis-core.js
git commit -m "refactor: unify empty states and soften selection language"
git tag -a snapshot-20260422-minimal-ui-empty-selection -m "Minimal UI cleanup empty states and selection"
```

## Task 2: Simplify Search Into Search First, Refine Second

**Files:**
- Modify: `Auralis_mock_zenith.html`
- Modify: `src/js/auralis-core/04-navigation-renderers.js`
- Modify: `src/js/auralis-core/06-setup-init-a11y.js`
- Modify: `src/styles/00-foundation.css`
- Modify: `scripts/qa/navigation-search.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:navigation`

- [ ] **Step 1: Add failing QA for quieter browse mode**

In `scripts/qa/navigation-search.mjs`, after the initial Search browse assertions, add:

```js
const browseChrome = await page.evaluate(() => ({
    refineLabel: document.getElementById('search-refine-btn')?.getAttribute('aria-label') || '',
    tagDisplay: getComputedStyle(document.getElementById('search-tag-row')).display,
    summaryDisplay: getComputedStyle(document.getElementById('search-filter-summary')).display,
    browseVisible: getComputedStyle(document.getElementById('search-browse')).display
}));
assert.match(browseChrome.refineLabel, /refine|filter/i);
assert.equal(browseChrome.tagDisplay, 'none', 'Search tags should stay hidden in calm browse mode.');
assert.equal(browseChrome.summaryDisplay, 'none', 'Filter summary should stay hidden until refine mode or a query is active.');
assert.equal(browseChrome.browseVisible, 'block');
```

- [ ] **Step 2: Run the Search QA to capture the current failure**

Run:

```powershell
npm run qa:navigation
```

Expected: fail because the current button is still a sort trigger and tag/filter summary chrome is visible in browse mode.

- [ ] **Step 3: Rename and repurpose the trailing search action**

In `Auralis_mock_zenith.html`, replace the current button with:

```html
<button aria-label="Refine search" class="icon-btn search-sort-btn" data-action="openSearchRefine" id="search-refine-btn" type="button">
  <svg fill="var(--text-secondary)" viewBox="0 0 24 24" width="16"><path d="M3 5h18v2H3V5zm3 6h12v2H6v-2zm3 6h6v2H9v-2z"></path></svg>
</button>
```

In `src/js/auralis-core/04-navigation-renderers.js`, replace the current Search-specific trigger logic with:

```js
function openSearchRefine() {
    presentActionSheet('Refine Search', searchQuery.trim() ? `Query: ${searchQuery.trim()}` : 'Choose what to search', [
        {
            label: 'All Media',
            description: 'Show songs, albums, and artists together.',
            icon: 'stack',
            onSelect: () => applySearchFilters(['all'])
        },
        {
            label: 'Songs Only',
            description: 'Focus Search on songs.',
            icon: 'music',
            onSelect: () => applySearchFilters(['songs'])
        },
        {
            label: 'Albums Only',
            description: 'Focus Search on albums.',
            icon: 'album',
            onSelect: () => applySearchFilters(['albums'])
        },
        {
            label: 'Artists Only',
            description: 'Focus Search on artists.',
            icon: 'artist',
            onSelect: () => applySearchFilters(['artists'])
        }
    ]);
}
```

Also update `ACTION_MAP` in `src/js/auralis-core/11-events-compat.js`:

```js
openSearchRefine: () => openSearchRefine(),
```

- [ ] **Step 4: Hide secondary Search chrome in browse mode**

In `src/js/auralis-core/04-navigation-renderers.js`, add:

```js
function setSearchSecondaryChromeVisible(visible) {
    const tagRow = getEl('search-tag-row');
    const summary = getEl('search-filter-summary');
    if (tagRow) tagRow.style.display = visible ? 'flex' : 'none';
    if (summary) summary.style.display = visible ? 'flex' : 'none';
}
```

Update `renderSearchState()` so browse mode becomes:

```js
if (shouldShowBrowse) {
    browse.style.display = 'block';
    results.style.display = 'none';
    setSearchSecondaryChromeVisible(false);
    setSearchStatus('Browse recently added albums or search your full library.');
} else {
    browse.style.display = 'none';
    results.style.display = 'block';
    setSearchSecondaryChromeVisible(true);
    renderSearchResults();
}
```

- [ ] **Step 5: Tighten the visual layout**

In `src/styles/00-foundation.css`, add:

```css
#search-tag-row[style*="display: none"],
#search-filter-summary[style*="display: none"] {
    margin:0;
}
.search-toolbar {
    margin-bottom:12px;
}
.search-section-heading {
    margin-top:10px;
}
.search-sort-btn {
    width:34px;
    height:34px;
    border-radius:12px;
    background:rgba(255,255,255,0.06);
}
```

- [ ] **Step 6: Update accessibility labels**

In `src/js/auralis-core/06-setup-init-a11y.js`, replace the Search action mapping text:

```js
if (onclickText.includes('openSearchRefine')) return 'Refine search';
```

- [ ] **Step 7: Rebuild and rerun Search QA**

Run:

```powershell
npm run build
npm run qa:navigation
```

Expected: exit 0 and the new browse-mode assertions pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add Auralis_mock_zenith.html scripts/qa/navigation-search.mjs src/js/auralis-core/04-navigation-renderers.js src/js/auralis-core/06-setup-init-a11y.js src/js/auralis-core/11-events-compat.js src/styles/00-foundation.css auralis-core.js
git commit -m "refactor: simplify search toolbar and browse mode"
git tag -a snapshot-20260422-minimal-ui-search -m "Minimal UI cleanup search"
```

## Task 3: Simplify Library Header, Tabs, And Songs Sorting

**Files:**
- Modify: `Auralis_mock_zenith.html`
- Modify: `src/js/auralis-core/10-zenith-library-views.js`
- Modify: `src/styles/00-foundation.css`
- Modify: `src/styles/04-zenith-overrides.css`
- Modify: `scripts/qa/library-screen.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:library`

- [ ] **Step 1: Add failing QA for the reduced primary tab set**

In `scripts/qa/library-screen.mjs`, after opening the Library screen, add:

```js
const libraryChrome = await page.evaluate(() => ({
    headerIcons: document.querySelectorAll('#library .top-bar .icon-btn').length,
    primaryTabs: Array.from(document.querySelectorAll('#library > .filter-row .filter-chip')).map((node) => node.textContent.trim()),
    songsSortButtons: document.querySelectorAll('#lib-songs-sort-row .filter-chip').length
}));
assert.ok(libraryChrome.headerIcons <= 3, 'Library header should not keep more than three round icon buttons visible.');
assert.deepEqual(libraryChrome.primaryTabs, ['Playlists', 'Albums', 'Artists', 'Songs', 'More']);
assert.equal(libraryChrome.songsSortButtons, 0, 'Songs sort should stop using a second chip row.');
```

- [ ] **Step 2: Run the Library QA to confirm current failure**

Run:

```powershell
npm run qa:library
```

Expected: fail because the current header has four round buttons, the tab row still includes Genres/Folders, and songs still use a chip sort row.

- [ ] **Step 3: Reduce the persistent header actions and main tabs**

In `Auralis_mock_zenith.html`, replace the Library header/tab block with:

```html
<div class="top-bar library-top-bar" style="margin-bottom:12px;">
  <div class="icon-btn" data-action="openSidebar" style="margin-right:8px;"><svg fill="var(--text-primary)" viewbox="0 0 24 24" width="20"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path></svg></div>
  <h1 style="text-align:left; margin:0; flex:1;">Your Library</h1>
  <div class="icon-btn" data-action="openLibraryMoreMenu" aria-label="Library actions" style="width:36px; height:36px; background:rgba(255,255,255,0.05); border-radius:12px;">
    <svg fill="var(--text-secondary)" viewbox="0 0 24 24" width="20"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg>
  </div>
  <div class="icon-btn" data-action="openCreatePlaylistDialog" title="New Playlist" aria-label="Create playlist" style="margin-left:8px;"><svg viewbox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg></div>
</div>
<div class="filter-row" style="margin-bottom:16px; margin-top:0;">
  <button class="filter-chip active" id="lib-btn-playlists" data-action="switchLib" data-section="playlists">Playlists</button>
  <button class="filter-chip" id="lib-btn-albums" data-action="switchLib" data-section="albums">Albums</button>
  <button class="filter-chip" id="lib-btn-artists" data-action="switchLib" data-section="artists">Artists</button>
  <button class="filter-chip" id="lib-btn-songs" data-action="switchLib" data-section="songs">Songs</button>
  <button class="filter-chip" id="lib-btn-more" data-action="openLibraryMoreMenu" data-section="more">More</button>
</div>
<div id="lib-songs-sort-row" style="display:none;"></div>
```

- [ ] **Step 4: Replace songs sort chips with a single menu trigger**

In `src/js/auralis-core/10-zenith-library-views.js`, add:

```js
function openLibrarySongsSortMenu() {
    presentActionSheet('Sort Songs', `Current: ${formatLibrarySongSortLabel(libSongsSortMode)}`, [
        { label: 'A–Z', description: 'Alphabetical order.', icon: 'stack', onSelect: () => switchLibSongsSort('alpha') },
        { label: 'Most Played', description: 'Show your most-played tracks first.', icon: 'music', onSelect: () => switchLibSongsSort('most_played') },
        { label: 'Recently Played', description: 'Show recent playback first.', icon: 'open', onSelect: () => switchLibSongsSort('recent') },
        { label: 'Recently Added', description: 'Show new additions first.', icon: 'down', onSelect: () => switchLibSongsSort('added') }
    ]);
}
```

When `tab === 'songs'`, insert one inline button above the list:

```js
let sortButton = getEl('lib-songs-sort-button');
if (!sortButton) {
    sortButton = document.createElement('button');
    sortButton.type = 'button';
    sortButton.id = 'lib-songs-sort-button';
    sortButton.className = 'filter-chip library-inline-sort';
    sortButton.dataset.action = 'openLibrarySongsSortMenu';
    songsList.parentElement.insertBefore(sortButton, songsList);
}
sortButton.textContent = `Sort: ${formatLibrarySongSortLabel(libSongsSortMode)}`;
```

Also update `ACTION_MAP` in `src/js/auralis-core/11-events-compat.js`:

```js
openLibrarySongsSortMenu: () => openLibrarySongsSortMenu(),
openLibraryMoreMenu: () => openLibraryMoreMenu(),
```

- [ ] **Step 5: Move Genres and Folders into the More menu**

In `src/js/auralis-core/10-zenith-library-views.js`, add:

```js
function openLibraryMoreMenu() {
    presentActionSheet('Library More', 'Secondary library views and actions', [
        { label: 'Genres', description: 'Browse your library by tags and mood.', icon: 'tag', onSelect: () => switchLib('genres') },
        { label: 'Folders', description: 'Browse albums by folder path.', icon: 'folder', onSelect: () => switchLib('folders') },
        { label: 'Import M3U', description: 'Import an existing playlist file.', icon: 'playlist', onSelect: () => importM3U() }
    ]);
}
```

- [ ] **Step 6: Tighten the Library visuals**

In `src/styles/04-zenith-overrides.css`, add:

```css
.library-inline-sort {
    margin:10px 0 8px;
    width:max-content;
}
.library-top-bar .icon-btn + .icon-btn {
    margin-left:8px;
}
#library > .filter-row {
    gap:10px;
}
```

- [ ] **Step 7: Rebuild and rerun Library QA**

Run:

```powershell
npm run build
npm run qa:library
```

Expected: exit 0 and the tab/header assertions pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add Auralis_mock_zenith.html scripts/qa/library-screen.mjs src/js/auralis-core/10-zenith-library-views.js src/js/auralis-core/11-events-compat.js src/styles/00-foundation.css src/styles/04-zenith-overrides.css auralis-core.js
git commit -m "refactor: simplify library header tabs and sort controls"
git tag -a snapshot-20260422-minimal-ui-library -m "Minimal UI cleanup library"
```

## Task 4: Make Home Edit Contextual And Reduce Carousel Overuse

**Files:**
- Modify: `src/js/auralis-core/09-zenith-home-sections.js`
- Modify: `src/js/auralis-core/10-zenith-library-views.js`
- Modify: `src/styles/03-album-artist.css`
- Modify: `scripts/qa/home-screen.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:home`

- [ ] **Step 1: Add failing QA for contextual Home edit**

In `scripts/qa/home-screen.mjs`, after opening edit mode, replace the generic add-section-only path with:

```js
await page.locator('#home-sections-root .home-section .section-header-left').first().click();
await page.waitForFunction(() => document.querySelector('#home-sections-root .section-edit-tray'));
const editTrayState = await page.evaluate(() => ({
    trayButtons: Array.from(document.querySelectorAll('#home-sections-root .section-edit-tray button')).map((node) => node.textContent.trim()),
    countPicker: document.querySelector('#home-sections-root .section-count-picker')?.textContent || ''
}));
assert.deepEqual(editTrayState.trayButtons, ['Source', 'Layout', 'Count', 'Density']);
assert.equal(editTrayState.countPicker, '');
```

- [ ] **Step 2: Run Home QA to confirm the current failure**

Run:

```powershell
npm run qa:home
```

Expected: fail because Home edit still uses the generic action-sheet-driven section menu.

- [ ] **Step 3: Replace generic Home section settings with an inline edit tray**

In `src/js/auralis-core/09-zenith-home-sections.js`, add:

```js
let activeSectionEditTrayId = '';

function toggleSectionEditTray(sectionId) {
    activeSectionEditTrayId = activeSectionEditTrayId === sectionId ? '' : sectionId;
    renderHomeSections();
}

function createSectionEditTray(section) {
    const tray = document.createElement('div');
    tray.className = 'section-edit-tray';

    const actions = [
        ['Source', () => openSectionTypeStep(section.id, 0)],
        ['Layout', () => openLayoutPicker(section.id, 0)],
        ['Count', () => toggleSectionCountPicker(section.id)],
        ['Density', () => updateHomeSection(section.id, { density: section.density === 'compact' ? 'large' : 'compact' })]
    ];

    actions.forEach(([label, onClick]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-chip';
        button.textContent = label;
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            onClick();
        });
        tray.appendChild(button);
    });

    return tray;
}
```

Update the section header click path:

```js
if (document.getElementById('home')?.classList.contains('home-editor-active')) {
    left.addEventListener('click', () => toggleSectionEditTray(section.id));
}
```

- [ ] **Step 4: Replace the generic item-count action sheet with an inline count picker**

Still in `src/js/auralis-core/09-zenith-home-sections.js`, add:

```js
let activeSectionCountPickerId = '';

function toggleSectionCountPicker(sectionId) {
    activeSectionCountPickerId = activeSectionCountPickerId === sectionId ? '' : sectionId;
    renderHomeSections();
}

function createSectionCountPicker(section) {
    const picker = document.createElement('div');
    picker.className = 'section-count-picker';

    [4, 6, 8, 12].forEach((limit) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `filter-chip${Number(section.limit || 0) === limit ? ' active' : ''}`;
        button.textContent = String(limit);
        button.addEventListener('click', () => {
            updateHomeSection(section.id, { limit });
            activeSectionCountPickerId = '';
        });
        picker.appendChild(button);
    });

    return picker;
}
```

When rendering each section:

```js
if (document.getElementById('home')?.classList.contains('home-editor-active') && activeSectionEditTrayId === section.id) {
    block.appendChild(createSectionEditTray(section));
    if (activeSectionCountPickerId === section.id) block.appendChild(createSectionCountPicker(section));
}
```

- [ ] **Step 5: Reduce carousel defaults**

In `src/js/auralis-core/09-zenith-home-sections.js`, update the song and collection rendering branches so list becomes the default fallback:

```js
const layout = section.layout === 'carousel' || section.layout === 'grid' ? section.layout : 'list';
```

For non-song sections, keep:

```js
if (section.layout === 'grid') { /* existing grid path */ }
if (section.layout === 'carousel' && items.length > 5) { /* existing carousel path */ }
```

Otherwise fall back to `list-wrap`.

- [ ] **Step 6: Mirror the same item-count behavior on Artist sections**

In `src/js/auralis-core/10-zenith-library-views.js`, replace the nested `presentActionSheet('Item Count', ...)` block inside `showArtistSectionConfigMenu()` with:

```js
const countActions = countOptions.map((limit) => ({
    label: `${limit}`,
    description: `Show ${limit} items in this section.`,
    icon: Number(section.limit || 0) === limit ? 'up' : 'stack',
    onSelect: () => updateArtistSection(sectionId, { limit })
}));
presentActionSheet('Section Count', section.title, countActions);
```

This still uses the sheet, but it becomes a focused contextual chooser instead of looking like the same broad settings menu.

- [ ] **Step 7: Add styles for the new edit tray**

In `src/styles/03-album-artist.css`, add:

```css
.section-edit-tray,
.section-count-picker {
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin:10px 0 6px;
}
.section-edit-tray .filter-chip,
.section-count-picker .filter-chip {
    min-height:34px;
    padding:7px 14px;
}
```

- [ ] **Step 8: Rebuild and rerun Home QA**

Run:

```powershell
npm run build
npm run qa:home
```

Expected: exit 0 and the inline edit tray assertions pass.

- [ ] **Step 9: Commit**

Run:

```powershell
git add scripts/qa/home-screen.mjs src/js/auralis-core/09-zenith-home-sections.js src/js/auralis-core/10-zenith-library-views.js src/styles/03-album-artist.css auralis-core.js
git commit -m "refactor: make home editing contextual and calmer"
git tag -a snapshot-20260422-minimal-ui-home-edit -m "Minimal UI cleanup home edit"
```

## Task 5: Remove Low-Value Badges, Quiet Detail Controls, And Run Visual Regression

**Files:**
- Modify: `src/js/auralis-core/00-shell-state-helpers.js`
- Modify: `Auralis_mock_zenith.html`
- Modify: `src/styles/04-zenith-overrides.css`
- Modify: `scripts/qa/screen-audit.mjs`
- Modify: `scripts/qa/home-screen.mjs`
- Modify: `scripts/qa/library-screen.mjs`
- Modify: `scripts/qa/navigation-search.mjs`
- Generated: `auralis-core.js`
- Test: `npm run build`, `npm run qa:home`, `npm run qa:navigation`, `npm run qa:library`, `npm run qa:screens`

- [ ] **Step 1: Add failing QA for badge reduction**

In `scripts/qa/library-screen.mjs`, on the songs tab, add:

```js
const badgeCount = await page.locator('#lib-songs-list .metadata-quality-badge, #lib-songs-list .chip-badge').count();
assert.equal(badgeCount, 0, 'Default Library songs view should not render metadata-quality badges.');
```

In `scripts/qa/home-screen.mjs`, on the Home screen, add:

```js
const homeBadgeCount = await page.locator('#home-sections-root .metadata-quality-badge, #home-sections-root .chip-badge').count();
assert.equal(homeBadgeCount, 0, 'Default Home sections should not render metadata-quality badges.');
```

- [ ] **Step 2: Run QA to confirm the current failure**

Run:

```powershell
npm run qa:home
npm run qa:library
```

Expected: fail because `Partial tags` badges still render in default list views.

- [ ] **Step 3: Stop rendering metadata-quality badges in default list contexts**

In `src/js/auralis-core/00-shell-state-helpers.js`, keep the label helper for other contexts but gate default list usage:

```js
function shouldShowMetadataBadge(context = 'library') {
    return ['detail', 'editor', 'metadata'].includes(String(context || '').toLowerCase());
}
```

Where row metadata is assembled, wrap the badge insertion:

```js
if (shouldShowMetadataBadge(metaContext) && qualityLabel) {
    metaRow.appendChild(createMetadataQualityBadge(qualityLabel));
}
```

Use the existing row metadata builder in `08-zenith-components.js` or the owning helper where the badge currently gets appended.

- [ ] **Step 4: Quiet detail-screen floating controls**

In `Auralis_mock_zenith.html`, for the artist hero controls, replace the inline backgrounds:

```html
<div class="icon-btn detail-hero-btn" data-action="pop">...</div>
<div class="icon-btn detail-hero-btn" data-action="openArtistProfileSectionMenu">...</div>
```

Do the same for album and playlist detail menus where present.

In `src/styles/04-zenith-overrides.css`, add:

```css
.detail-hero-btn {
    background:rgba(0,0,0,0.22) !important;
    backdrop-filter:blur(10px);
    -webkit-backdrop-filter:blur(10px);
}
.detail-hero-btn:hover,
.detail-hero-btn:focus-visible {
    background:rgba(0,0,0,0.3) !important;
}
```

- [ ] **Step 5: Extend the screen audit to capture the quieter surfaces**

In `scripts/qa/screen-audit.mjs`, keep the existing capture set but ensure the output still includes:

```js
await captureAuditScreen(assert, page, summary, 'home', '#home', 'Home screen');
await captureAuditScreen(assert, page, summary, 'search-browse', '#search', 'Search browse screen');
await captureAuditScreen(assert, page, summary, 'library-songs', '#library', 'Library songs tab');
await captureAuditScreen(assert, page, summary, 'artist-profile', '#artist_profile', 'Artist profile');
```

If names differ in the current file, keep the existing calls and only add missing ones.

- [ ] **Step 6: Rebuild and run the final UI-focused regression**

Run:

```powershell
npm run build
npm run qa:home
npm run qa:navigation
npm run qa:library
npm run qa:screens
```

Expected: exit 0 and the QA assertions prove badge reduction plus calmer screen chrome.

- [ ] **Step 7: Inspect the working tree before final commit**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only the intended plan files and source changes are staged; the existing untracked debug scripts remain untouched.

- [ ] **Step 8: Commit**

Run:

```powershell
git add Auralis_mock_zenith.html scripts/qa/screen-audit.mjs scripts/qa/home-screen.mjs scripts/qa/library-screen.mjs scripts/qa/navigation-search.mjs src/js/auralis-core/00-shell-state-helpers.js src/styles/04-zenith-overrides.css auralis-core.js
git commit -m "refactor: finish minimal ui cleanup pass"
git tag -a snapshot-20260422-minimal-ui-final -m "Minimal UI cleanup final"
```

## Task 6: Final Regression And Push

**Files:**
- Verify: all changed files
- Test: full regression commands

- [ ] **Step 1: Run the final regression**

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
```

Expected: every command exits 0.

- [ ] **Step 2: Inspect the visual audit summary**

Run:

```powershell
Get-Content output/playwright/screen-fidelity/audit-summary.json
Get-ChildItem output/playwright/screen-fidelity -Filter *.png
```

Expected: the audit still includes Home, Search, Library tabs, detail screens, player, Queue, and Settings captures.

- [ ] **Step 3: Create the final release tag for this cleanup**

Run:

```powershell
git tag -a v2026.04.22-minimal-ui-cleanup -m "Minimal UI cleanup"
```

Expected: tag points at the final implementation commit.

- [ ] **Step 4: Push the branch and tags**

Run:

```powershell
git push origin experimental
git push origin v2026.04.22-minimal-ui-cleanup
git push origin snapshot-20260422-minimal-ui-empty-selection
git push origin snapshot-20260422-minimal-ui-search
git push origin snapshot-20260422-minimal-ui-library
git push origin snapshot-20260422-minimal-ui-home-edit
git push origin snapshot-20260422-minimal-ui-final
```

Expected: branch and tags push successfully.

## Self-Review

- Spec coverage: the plan covers shared empty states, softer selection/focus treatment, Search cleanup, Library simplification, contextual Home edit controls, reduced carousel/badge noise, quieter detail controls, and full regression.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: action names are consistent across tasks: `openSearchRefine`, `openLibraryMoreMenu`, `openLibrarySongsSortMenu`, `toggleSectionEditTray`, `toggleSectionCountPicker`, and `shouldShowMetadataBadge`.
- Scope check: the plan stays inside the existing app structure and does not introduce a framework rewrite or navigation reset.
- Verification coverage: each surface has targeted QA plus a full final regression.
