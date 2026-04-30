# Screen Folder Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move existing app source shards into clear category and screen folders without changing runtime behavior.

**Architecture:** Preserve the current single generated browser bundle. Source files may live in subfolders, but each JavaScript shard keeps a unique numeric prefix and the build script sorts by filename to preserve load order.

**Tech Stack:** Static HTML, plain JavaScript, CSS, PowerShell build script, Node backend preview server.

---

### Task 1: Folderize Source Shards

**Files:**
- Move: `src/js/auralis-core/*.js`
- Move: `src/styles/*.css`

- [x] **Step 1: Create category folders**

Create folders for app shell, data, config, UI, and screen-specific code.

- [x] **Step 2: Move JavaScript shards**

Move existing shards into category folders while keeping their original numeric prefixes.

- [x] **Step 3: Move CSS shards**

Move existing stylesheets into category folders while keeping their link order prefixes.

### Task 2: Teach Build Script About Subfolders

**Files:**
- Modify: `scripts/build-core.ps1`

- [x] **Step 1: Read JavaScript recursively**

Change the builder from top-level-only reads to recursive reads.

- [x] **Step 2: Preserve runtime order**

Sort nested JavaScript shards by filename, then full path, so the current numeric prefixes remain the source of truth.

- [x] **Step 3: Improve generated markers**

Write relative paths in generated bundle comments so future debugging shows the category folder.

### Task 3: Update Runtime Links And Docs

**Files:**
- Modify: `Auralis_mock_zenith.html`
- Modify: `docs/agent-map.md`
- Modify: `src/js/auralis-core/README.md`
- Modify: `src/styles/README.md`

- [x] **Step 1: Point HTML to moved CSS files**

Update stylesheet links to the new folder paths without changing order.

- [x] **Step 2: Update agent map**

Document the new source folders and explain that numeric prefixes still control bundle order.

- [x] **Step 3: Update source READMEs**

Explain the new folder map for JavaScript and CSS.

### Task 4: Rebuild And Verify

**Files:**
- Modify: `auralis-core.js`

- [x] **Step 1: Rebuild generated bundle**

Run: `npm run build`

Expected: The command exits successfully and reports that `auralis-core.js` was built from the nested shards.

- [x] **Step 2: Run the smallest automated proof**

Run: `npm test`

Expected: Existing server tests pass.

- [x] **Step 3: Verify in browser**

Reload `http://127.0.0.1:8787/` in the in-app browser.

Expected: The Auralis home screen renders instead of a blank or unstyled page.
