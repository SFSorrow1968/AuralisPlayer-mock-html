# Continuous Quality Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the five highest-use Auralis surfaces polished by turning repeated manual review into repeatable checks.

**Architecture:** The app stays shard-based: behavior lives in `src/js/auralis-core/`, shared presentation lives in `src/styles/`, and browser-level confidence lives in `scripts/qa/`. The plan favors small QA scripts that exercise real fixture music and clear visual assertions over broad, fragile snapshots.

**Tech Stack:** Static HTML/CSS/JavaScript app, generated `auralis-core.js`, Node backend, Playwright-backed repo QA scripts.

---

### Task 1: Guard Search Fallback Icons

**Files:**
- Modify: `src/js/auralis-core/04-navigation-renderers.js`
- Modify: `src/styles/06-shared-ui.css`
- Test: `scripts/qa/high-touch-surfaces.mjs`

- [x] **Step 1: Reproduce the empty icon**

Search for a folder-style result such as `Double Nickels`; observe that the result tile shows only a colored square when no artwork exists.

- [x] **Step 2: Fix the root cause**

Add a shared search fallback icon mapper and render an SVG glyph into generic search rows when `item.artUrl` is missing.

- [x] **Step 3: Keep the test**

Run: `npm run qa:high-touch`

Expected: the search fallback icon check reports a visible SVG in the folder result tile.

### Task 2: Keep Library Search Healthy

**Files:**
- Test: `scripts/qa/high-touch-surfaces.mjs`

- [x] **Step 1: Query real fixture data**

Use `Double Nickels` to exercise folder, album, and song result density in one search pass.

- [x] **Step 2: Assert result usability**

Verify that `#search-results` is visible, contains rows, and has no obvious overflow defects.

### Task 3: Keep Album View Settings Healthy

**Files:**
- Test: `scripts/qa/high-touch-surfaces.mjs`

- [x] **Step 1: Open Albums settings**

Navigate to Library > Albums, open the appearance control, and verify it renders two-column collapsible setting groups.

- [x] **Step 2: Toggle grid columns**

Select the two-column grid setting and assert the album grid resolves to two columns.

### Task 4: Keep Home First Impression Healthy

**Files:**
- Test: `scripts/qa/high-touch-surfaces.mjs`

- [x] **Step 1: Open Home**

Switch to the Home tab after fixture installation.

- [x] **Step 2: Assert above-the-fold content**

Verify Recent Activity and Recently Added both render real music rows/cards without obvious overflow defects.

### Task 5: Keep Full Player Queue Healthy

**Files:**
- Test: `scripts/qa/high-touch-surfaces.mjs`

- [x] **Step 1: Start album playback**

Start a fixture album, open the full player, and scroll to the inline queue.

- [x] **Step 2: Assert queue usefulness**

Verify upcoming rows exist, the current track is not duplicated as the first upcoming row, and the inline queue surface has no obvious overflow defects.

### Task 6: Keep Library Category Gateway Healthy

**Files:**
- Test: `scripts/qa/high-touch-surfaces.mjs`

- [x] **Step 1: Clear search and return to Library**

Clear any active query and show the Library category gateway.

- [x] **Step 2: Assert hub clarity**

Verify Playlists, Albums, Artists, Songs, Genres, and Folders are visible as category rows.
