# Implemented Feature Quality Integration Design

## Goal

Improve ten already implemented Auralis feature areas in one broad integration pass without changing the app's core product model, navigation structure, static HTML shell, stylesheet shards, or generated bundle workflow.

The pass should make the app feel more dependable, polished, recoverable, and production-like while staying inside existing surfaces: Home, Search, Library, playlist detail, album detail, artist profile, player, Queue, Settings, setup, overlays, and the maintained screen audit.

## Approved Direction

The user selected **Option B: One Large Integration Pass** from the visual companion on April 22, 2026.

This means all ten improvements are implemented as one coordinated workstream instead of separate feature programs. To manage risk, the work still uses internal checkpoint commits and targeted verification after each cluster. These checkpoints are implementation control points, not a change in user-facing scope.

## In Scope

1. Unified now-playing state across rows, cards, detail screens, Queue, mini-player, and full player.
2. Undo toasts for destructive actions that already exist.
3. Playlist detail polish using existing playlist behavior.
4. Better scan and metadata feedback in existing Settings/setup surfaces.
5. Search quality improvements inside the current Search screen.
6. Persisted UI state recovery for already implemented views.
7. Accessibility hardening for existing controls, tabs, chips, overlays, and player interactions.
8. Visual consistency and token cleanup across existing component families.
9. Artwork reliability for existing album, artist, playlist, and track art rendering.
10. Screenshot regression baselines built on top of the existing `qa:screens` audit.

## Out Of Scope

- No framework migration.
- No ES module conversion.
- No replacement of the static HTML shell.
- No new primary navigation model.
- No new cloud product features.
- No new audio DSP feature work beyond preserving and polishing existing player/EQ controls.
- No `main` merge unless explicitly requested.
- No destructive rewrite of existing branch history.
- No committing the existing untracked diagnostic scripts unless they are intentionally promoted into maintained QA with assertions and package scripts.

## Architecture

Keep the current shard-based runtime:

- Edit JavaScript source shards in `src/js/auralis-core/`.
- Edit stylesheet shards in `src/styles/`.
- Rebuild `auralis-core.js` with `npm run build` after JavaScript changes.
- Extend QA scripts under `scripts/qa/`.
- Keep screenshot artifacts under ignored `output/playwright/` paths.

The integration should favor small shared helpers only where multiple real surfaces use them. It should not introduce a broad state-management abstraction or split the IIFE runtime. The core design is to tighten existing contracts, not replace them.

## Feature Designs

### 1. Unified Now-Playing State

Create a consistent active-playback visual contract for existing song rows, collection cards, album/playlist detail rows, Queue rows, mini-player, and full player.

Expected behavior:

- The currently playing track has a stable active marker wherever it appears.
- Collection play buttons reflect whether their album or playlist is active.
- Active row styling is consistent across Library, Search, details, and Queue.
- The state updates through targeted sync functions, not full unrelated screen rerenders.

Implementation should build on existing `registerTrackUi`, playback collection keys, `setPlayButtonState`, and row/card factories.

### 2. Undo For Destructive Actions

Add a small undo-toast pattern for destructive actions that already exist, such as clearing Up Next, removing a queue item, removing from a playlist, deleting/clearing playlist content where supported, removing a media folder, and clearing user-created search/tag state where supported.

Expected behavior:

- A destructive action executes immediately.
- The toast offers a short-lived Undo affordance.
- Undo restores the prior local state and re-renders only the affected surface.
- If the timeout expires, no extra confirmation is needed.

This should not turn every action into a confirmation dialog. It should reduce user regret while keeping the app fast.

### 3. Playlist Detail Polish

Improve the existing playlist detail screen so it feels as mature as album detail.

Expected behavior:

- The playlist hero has stable artwork, title, subtitle, track count, and total duration.
- Empty playlists show a useful empty state with Add Songs guidance.
- Add Songs flow has clearer status and avoids duplicate additions.
- Track rows keep duration, artist metadata, active state, and menu behavior consistent with album/detail rows.
- Rename/delete/add actions provide clear feedback.

No new playlist product model is required.

### 4. Scan And Metadata Feedback

Improve the existing Settings/setup scan experience.

Expected behavior:

- Folder rows show last scan status, track count, failed count when available, and scan-in-progress state.
- Settings distinguishes unsupported folder APIs, empty library, scanning, success, and retry/error states.
- Metadata refinement status is visible without making the UI feel like debug output.
- QA proves the existing rescan and persistence flows still work.

This should use existing folder/media state where possible and avoid inventing backend-only data.

### 5. Search Quality

Improve Search within the existing Search screen.

Expected behavior:

- Recent searches are remembered locally.
- Clearing a search restores browse mode and focus reliably.
- Results show clearer section counts and selected-filter summary.
- No-results states suggest useful next steps.
- Matching is more tolerant for partial, punctuation, and case differences without adding a heavy search dependency.

Search should stay fast and local.

### 6. Persisted UI State Recovery

Persist small UI preferences and restore them after reload.

Expected behavior:

- Last Library tab is restored.
- Last Home profile is restored.
- Last Search query/filter state can be restored safely.
- Detail/player/queue state recovery does not reopen stale screens when the underlying data is missing.
- Scroll recovery is limited to stable root surfaces where it does not create jarring jumps.

Persistence must not corrupt existing user library, playback, playlist, or folder state.

### 7. Accessibility Hardening

Improve existing semantics and keyboard behavior.

Expected behavior:

- Filter chips and Library tabs expose consistent selected state.
- Icon-only buttons have useful labels.
- Escape closes currently open overlays/sheets/dialogs in a predictable order.
- Dialogs and sheets focus the first useful action and return focus when closed.
- Player and queue controls are reachable by keyboard.

This should extend existing `ensureAccessibility` and focus helpers rather than replacing them wholesale.

### 8. Visual Consistency And Tokens

Tighten consistency across existing components.

Expected behavior:

- Detail heroes, rows, chips, buttons, empty states, cards, and settings rows use consistent spacing and touch-target rules.
- Repeated one-off inline styles are reduced only where doing so lowers maintenance risk.
- Color and surface treatments remain aligned with the existing app personality.
- Text overflow and long-title handling stay robust.

This is a consistency pass, not a redesign.

### 9. Artwork Reliability

Improve existing artwork behavior.

Expected behavior:

- Album, artist, playlist, and track fallback art is stable for the same identity.
- Artwork placeholders avoid layout shift.
- Lazy loaded art updates the correct surface without cross-album bleed.
- Player and queue artwork remain stable after metadata refinement and backend playback-session sync.

Existing artwork tests should be extended where needed.

### 10. Screenshot Regression Baselines

Build screenshot regression on top of the maintained `qa:screens` audit.

Expected behavior:

- Baseline screenshots are stored in a maintained path.
- A compare script reports added, missing, and visually changed screen captures.
- The comparison uses tolerances appropriate for browser rendering differences.
- The update workflow is explicit and not automatic.
- CI-style output identifies which screen regressed.

The existing `qa:screens` command remains useful by itself. Baseline comparison should be a separate script to avoid making ordinary screen capture workflows too heavy.

## Data And State Boundaries

Use existing state owners:

- Playback and queue state stay in the playback/navigation shards.
- Library and playlist state stay in existing library/playlist helpers.
- Folder scan and media persistence stay in folder/IDB helpers.
- UI-only recovery state should be small, versioned, and resilient to missing library data.
- Visual baseline data belongs under QA tooling, not runtime code.

Any new persisted UI payload must be namespaced separately from library content so it can be reset without damaging user media or playlists.

## QA Strategy

Use the smallest useful proof after each internal checkpoint, then a full regression before final tag/push.

Targeted commands:

- `npm run qa:playback` and `npm run qa:queue` for now-playing state and undo in playback surfaces.
- `npm run qa:library` and `npm run qa:navigation` for playlist detail, Search, Library tabs, and detail routing.
- `npm run qa:folder`, `npm run qa:persistence`, and `npm test` for scan/metadata feedback and persisted UI state.
- `npm run qa:metadata` for artwork reliability.
- `npm run qa:screens` plus the new screenshot baseline comparison for visual regression.
- `npm run build` after JavaScript shard edits.

Final regression:

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

## Risks And Mitigations

- Playback-state changes can accidentally trigger expensive rerenders. Mitigation: add targeted assertions that timeupdate and active-state sync do not rebuild unrelated surfaces.
- Undo can conflict with persistence. Mitigation: capture minimal reversible snapshots and re-render only the affected owner.
- Search persistence can reopen stale states. Mitigation: restore only if the referenced screen and library data are valid.
- Screenshot baselines can be noisy. Mitigation: keep baseline comparison separate from `qa:screens` and use explicit update commands.
- Large integration scope can hide regressions. Mitigation: use internal checkpoint commits, run targeted QA per cluster, and preserve tagged snapshots.

## Acceptance Criteria

- All ten requested improvement areas are represented in code or QA tooling.
- Existing user-facing app structure remains recognizable.
- No new primary screens are introduced.
- Shared helpers are limited to real repeated behavior.
- Runtime edits are made in source shards and rebuilt into `auralis-core.js`.
- Targeted QA passes for changed areas.
- Final full regression passes.
- Final work is committed, tagged, and pushed to `experimental`.
- Existing untracked diagnostic files remain untouched unless explicitly promoted.

## Self-Review

- Placeholder scan: no TBD or TODO items remain.
- Scope check: this is broad but intentionally approved as one integration pass; internal checkpoint commits are required to manage risk.
- Consistency check: the design preserves the repo's shard architecture and default `experimental` branch workflow.
- Ambiguity check: screenshot baseline comparison is a separate command, not a replacement for `qa:screens`.
