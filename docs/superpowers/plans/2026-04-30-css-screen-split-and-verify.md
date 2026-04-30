# CSS Screen Split And Verify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split oversized CSS files into screen/purpose files and add a single verification command.

**Architecture:** Preserve CSS cascade by keeping the HTML link order equivalent to the old file order. Add a lightweight Node script that checks local CSS/JS references in the HTML shell.

**Tech Stack:** Static HTML, CSS, Node script, npm scripts.

---

### Task 1: Split Oversized CSS

**Files:**
- Replace: `src/styles/polish/05-design-polish.css`
- Replace: `src/styles/screens/04-zenith-overrides.css`
- Modify: `Auralis_mock_zenith.html`
- Modify: `src/styles/README.md`
- Modify: `docs/agent-map.md`

- [x] **Step 1: Split `04-zenith-overrides.css`**

Cut the file into smaller ordered stylesheets for player/equalizer, home editing, track rows/cards, grid polish, and final empty-state/library/home polish.

- [x] **Step 2: Split `05-design-polish.css`**

Cut the file into smaller ordered stylesheets for global polish, home/library search polish, player polish, album/artist/queue polish, setup/settings polish, and final annotation polish.

- [x] **Step 3: Update stylesheet links**

Replace the two giant CSS links with smaller links in the same order.

### Task 2: Add One Verify Command

**Files:**
- Create: `scripts/verify-static-assets.mjs`
- Modify: `package.json`

- [x] **Step 1: Add static asset checker**

Read `Auralis_mock_zenith.html`, find local stylesheet and script references, strip query strings, and fail if any referenced file is missing.

- [x] **Step 2: Add `npm run verify`**

Run build, tests, and the static asset checker in one command.

### Task 3: Verify

**Files:**
- No source edits expected.

- [x] **Step 1: Run verify**

Run: `npm run verify`

Expected: build, tests, and static asset check pass.

- [x] **Step 2: Browser check**

Reload `http://127.0.0.1:8787/`.

Expected: the styled Auralis home screen renders.
