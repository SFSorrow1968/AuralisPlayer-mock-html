# Screen Quality And Fidelity Design

## Goal

Massively improve Auralis screen quality so every major surface feels intentional, stable, efficient, and close to industry-leading music-app fidelity while preserving the existing product model and shard-based runtime.

## Context

Auralis is a shard-based HTML/CSS/JavaScript player shell. The runtime is assembled into `auralis-core.js` from source shards in `src/js/auralis-core/`, and the HTML shell links stylesheet shards directly from `src/styles/`. The repo guidance requires editing source shards instead of the generated bundle, rebuilding after JavaScript changes, validating with the smallest useful QA command first, and pushing completed work to `experimental` by default.

The current app surface includes Home, Search, Library subviews, Settings, Playlist Detail, Album Detail, Artist Profile, User Profile, the mini and full player, Queue, onboarding/setup, action sheets, dialogs, and the sidebar. The largest JavaScript shards are `00-shell-state-helpers.js`, `01-library-scan-metadata.js`, `04-navigation-renderers.js`, and `05-media-folder-idb.js`, so the work should avoid broad module surgery until screen behavior is better covered.

The expanded direction was approved from the visual companion board on April 22, 2026. The board reframed the work from render hardening alone into a screen-by-screen fidelity program with three lenses: product quality, engineering quality, and proof quality.

## Design Direction

Use a screen-by-screen fidelity program with selective performance hardening. Each pass improves visual hierarchy, interaction feedback, accessibility, edge states, render ownership, local state usage, DOM construction, and QA coverage for one coherent surface at a time.

This explicitly avoids an architecture-first split of the largest shards. The current runtime depends on one IIFE lexical scope, so a broad split would increase risk before the behavior is locked down. It also avoids a pure instrumentation phase; lightweight measurements are useful, but the repo already has obvious improvement areas in render ownership, repeated DOM work, and screen coverage.

The work should not become a cosmetic repaint. Visual changes must be tied to a user-facing quality improvement: clearer hierarchy, fewer confusing states, better touch targets, more predictable transitions, reduced overflow, better responsive fit inside the emulator, stronger now-playing feedback, or better empty/error handling.

## Quality Lenses

Every screen is evaluated through these lenses before edits are made:

- Visual fidelity: hierarchy, spacing, typography scale, artwork treatment, density, contrast, motion restraint, and consistency across similar screens.
- Interaction fidelity: tap targets, active states, disabled states, focus order, keyboard behavior, sheet/dialog behavior, navigation confidence, and feedback after actions.
- Data fidelity: metadata accuracy, album/artist grouping, duration/status labels, queue state, folder state, sync/account state, and persistence after reload.
- Render efficiency: deterministic render ownership, targeted updates, batched DOM insertion, avoiding high-frequency full rerenders, and preserving track UI registration cleanup.
- Accessibility: semantic controls, labels, `aria-selected`/`aria-checked` where appropriate, focus return for overlays, Escape/close behavior, readable contrast, and no text overlap.
- Proof: targeted Playwright QA, screenshot artifacts, console/page-error capture, duplicate/overflow assertions, and broad regression when shared behavior changes.

## Screen Order

1. Home and home sections.
2. Search and browse results.
3. Library subviews: playlists, albums, artists, songs, genres, and folders.
4. Album, artist, and playlist detail.
5. Queue and mini/full player.
6. Settings, setup, sidebar, sheets, and dialogs.

This order starts with high-traffic screens, then moves through navigation-heavy details, then finishes with system surfaces and overlays.

## Screen Targets

### Home

Home should feel curated rather than merely populated. The pass should improve section hierarchy, rail/card density, home profile controls, edit mode affordances, "Add Section" placement, playback warning treatment, and the no-music/empty-section states. The renderer should avoid duplicate section titles, batch section child insertion, and make disabled/empty profile states deterministic after reload.

### Search

Search should move cleanly between browse, query results, no-results, tag creation, and sorted result states. The pass should clarify result grouping, ensure browse recovery after clearing a query, keep custom tag controls from crowding the search field, and verify keyboard/focus behavior. Search rendering should clear owned nodes safely and avoid duplicate result rows.

### Library

Library should make every subview feel deliberately designed. Playlists, albums, artists, songs, genres, and folders need consistent tab state, visible active/selected semantics, usable density, durable empty states, and stable scroll behavior. The songs view should preserve virtualization behavior, while other views should use batched DOM insertion where it improves clarity and speed.

### Album, Artist, And Playlist Details

Detail screens should feel like high-fidelity music surfaces, not generic lists. Album and playlist heroes need clear artwork/title/metadata/action hierarchy. Artist profile sections need consistent album/song grouping and confident navigation. Track rows should expose duration, metadata status, active playback, and menu actions without layout jitter.

### Player And Queue

The player should separate high-frequency playback state from structural rendering. Progress, elapsed/remaining time, active row state, badges, artwork, like state, EQ, and transport controls should update directly without triggering unrelated screen rerenders. Queue should clearly distinguish now playing, up next, empty state, inline queue, and clear actions while avoiding duplicate visible rows.

### Settings, Setup, Sidebar, And Overlays

System surfaces should be dependable and accessible. Settings should clarify media folders, scan/retry progress, cache state, backend sync status, sessions, and observability without looking like unfinished diagnostics. Setup/onboarding should have clear forward motion and unsupported-browser feedback. Sheets, dialogs, sidebar, metadata editor, image viewer, tag creator, playlist dialog, and confirmation dialog should manage focus, close behavior, and labels predictably.

## Screen Pass Contract

Each screen pass follows the same contract:

1. Identify the owning renderer and the state it reads or mutates.
2. Capture or inspect the current screen visually when the change affects layout, hierarchy, text fit, or interaction polish.
3. Add or tighten QA around current behavior before changing internals when the behavior is not already covered.
4. Refactor only the local render path, style shard, or shared helper the screen actually uses.
5. Reduce full-screen rerenders when a targeted update is enough.
6. Verify no functional regression with the targeted QA script, screenshot artifacts for visible changes, and a broader pass when shared behavior changes.

The goal is not more abstraction. The goal is fewer hidden dependencies, fewer repeated DOM patterns, less unnecessary rerendering, clearer screen ownership, and deterministic rendering.

## Implementation Principles

- Edit source shards in `src/js/auralis-core/` and `src/styles/`; do not hand-edit `auralis-core.js`.
- Prefer existing factories and helpers before adding new ones.
- Add a helper only when it removes repeated behavior across real screens or clarifies a screen boundary.
- Keep render functions deterministic: input state in, DOM output out.
- Prefer `replaceChildren`, `DocumentFragment`, and focused element updates over repeated `innerHTML` clears when that improves clarity and safety.
- Preserve current UI behavior unless a clear fidelity, accessibility, or usability defect is found.
- Keep style changes scoped to the owning stylesheet shard.
- Use browser QA and screenshots for user-facing screen changes.
- Do not normalize the app into a one-note palette or over-carded layout; maintain a restrained music-player aesthetic with strong artwork, clear surfaces, and dense but readable controls.
- Do not add new placeholder features while improving polish. Existing placeholders may be made clearer, but not expanded into fake functionality.
- Keep user-created local state and persisted library state compatible across reloads.

## Data Flow And State Boundaries

Renderers should read from canonical library, playback, queue, playlist, and settings state, then update only the DOM region they own. Cross-screen state changes should go through existing app helpers such as playback, queue, playlist, metadata, and library dirty-state helpers.

Where a screen currently re-renders because shared state changed, the pass should decide whether the update can be localized. Examples include syncing active track rows, refreshing queue counts, updating player badges, and updating search or library result sections without rebuilding unrelated surfaces.

The implementation should treat existing untracked debug scripts as diagnostic context only unless they are intentionally promoted into `scripts/qa/` as maintained QA flows. Temporary scripts should not be committed as production tooling without naming, scope, and expected assertions.

## Error Handling And Edge States

Each screen should keep meaningful empty, loading, unsupported, and error states. This includes empty library, no search results, no queue items, folder API unsupported, metadata retry states, playback health warnings, and missing album art. Improvements should make these states more testable and less dependent on placeholder markup.

## Testing And Verification

Use the smallest proving command first:

- `npm run qa:home` for Home and section behavior.
- `npm run qa:navigation` and `npm run qa:library` for Search, Library, and detail routing.
- `npm run qa:queue` and `npm run qa:playback` for Queue and player changes.
- `npm run qa:folder`, `npm run qa:persistence`, and `npm test` for settings, setup, persistence, and backend-adjacent behavior.
- `npm run build` after JavaScript shard changes.

Before claiming completion for implementation work, run the relevant targeted QA and a broader regression pass for any shared renderer, playback, library, or storage change. For visible UI changes, retain screenshot artifacts under ignored output paths and summarize what was inspected.

## Out Of Scope

- Rewriting the runtime into ES modules.
- Replacing the static HTML shell with a framework.
- Changing the generated bundle workflow.
- Merging `experimental` into `main` without an explicit request.
- Cosmetic redesigns that do not improve functionality, efficiency, fidelity, accessibility, usability, or maintainability.
- New cloud/backend product features beyond clarifying existing sync, sessions, and observability UI.
- New audio DSP features beyond preserving and polishing existing player/EQ controls.

## Acceptance Criteria

- Each touched screen has clearer render ownership, less repeated local DOM code, and visibly improved hierarchy or interaction quality.
- Shared helpers are introduced only where they serve multiple real render paths.
- Targeted QA passes for each touched area.
- `npm run build` succeeds after JavaScript shard changes.
- User-facing screen behavior remains stable or improves in documented ways, including edge states and reload persistence.
- Screenshots or visual notes document the before/after quality checks for user-facing screen changes.
- Completed implementation is committed, tagged, and pushed to `experimental` unless the user explicitly requests a `main` merge.
