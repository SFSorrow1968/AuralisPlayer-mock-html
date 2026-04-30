# Screen File Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the largest screen/category files into smaller ordered shards while preserving runtime behavior.

**Architecture:** Continue using the generated `auralis-core.js` bundle. New source files keep numeric prefixes so recursive filename sorting reconstructs the same execution order.

**Tech Stack:** Static HTML, plain JavaScript, CSS, PowerShell build script, Node backend preview server.

---

### Task 1: Split Navigation And Search

**Files:**
- Replace: `src/js/auralis-core/screens/navigation/04-navigation-renderers.js`
- Create: `src/js/auralis-core/screens/navigation/04a-navigation-shell-settings.js`
- Create: `src/js/auralis-core/screens/search/04b-search-workspace.js`
- Create: `src/js/auralis-core/screens/navigation/04c-routing-details-playlists.js`
- Create: `src/js/auralis-core/screens/navigation/04d-queue-home-sheets.js`

- [x] **Step 1: Split on top-level function boundaries**

Use existing function boundaries at `getSearchTerms`, `playTrack`, `switchLib`, and `setHomeEditMode`.

### Task 2: Split Media Folder Data

**Files:**
- Replace: `src/js/auralis-core/data/05-media-folder-idb.js`
- Create: `src/js/auralis-core/data/05a-media-metadata-parsers.js`
- Create: `src/js/auralis-core/data/05b-media-db-canonical.js`
- Create: `src/js/auralis-core/data/05c-media-folder-access.js`
- Create: `src/js/auralis-core/data/05d-media-folder-ui.js`

- [x] **Step 1: Split on top-level function boundaries**

Use existing function boundaries at `openMediaDB`, `hasFileSystemAccess`, and `showConfirm`.

### Task 3: Split Library Views

**Files:**
- Replace: `src/js/auralis-core/screens/library/10-zenith-library-views.js`
- Create: `src/js/auralis-core/screens/library/10a-library-appearance.js`
- Create: `src/js/auralis-core/screens/library/10b-library-collections.js`
- Create: `src/js/auralis-core/screens/library/10c-library-songs.js`
- Create: `src/js/auralis-core/screens/library/10d-library-artist-search-sidebar.js`
- Create: `src/js/auralis-core/screens/library/10e-library-render-folder.js`
- Create: `src/js/auralis-core/screens/library/10f-library-section-config.js`

- [x] **Step 1: Split on top-level function boundaries**

Use existing function boundaries at `getAlbumsGroupedByArtist`, `scheduleLibrarySongWork`, `saveArtistProfileLayout`, `renderLibraryViews`, `renderFolderBrowserView`, and `openSectionConfig`.

### Task 4: Rebuild And Verify

**Files:**
- Modify: `auralis-core.js`
- Modify: `docs/agent-map.md`
- Modify: `src/js/auralis-core/README.md`

- [x] **Step 1: Update docs**

Document the new smaller screen and data files.

- [x] **Step 2: Rebuild**

Run: `npm run build`

Expected: build exits successfully.

- [x] **Step 3: Test**

Run: `npm test`

Expected: existing tests pass.

- [x] **Step 4: Browser check**

Reload `http://127.0.0.1:8787/`.

Expected: the app renders the home screen.
