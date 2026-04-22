# Screen Quality And Efficiency Design

## Goal

Massively improve Auralis screen quality by hardening each screen's functionality, render efficiency, state ownership, and regression coverage while preserving the existing product model and visual direction.

## Context

Auralis is a shard-based HTML/CSS/JavaScript player shell. The runtime is assembled into `auralis-core.js` from source shards in `src/js/auralis-core/`, and the HTML shell links stylesheet shards directly from `src/styles/`. The repo guidance requires editing source shards instead of the generated bundle, rebuilding after JavaScript changes, validating with the smallest useful QA command first, and pushing completed work to `experimental` by default.

The current app surface includes Home, Search, Library subviews, Settings, Playlist Detail, Album Detail, Artist Profile, User Profile, the mini and full player, Queue, onboarding/setup, action sheets, dialogs, and the sidebar. The largest JavaScript shards are `00-shell-state-helpers.js`, `01-library-scan-metadata.js`, `04-navigation-renderers.js`, and `05-media-folder-idb.js`, so the work should avoid broad module surgery until screen behavior is better covered.

## Design Direction

Use a screen-by-screen hardening program with selective performance checks. Each screen pass improves the owning render path, local state usage, DOM construction, and QA coverage. Visual fidelity remains important, but the primary target is code functionality and efficiency.

This explicitly avoids an architecture-first split of the largest shards. The current runtime depends on one IIFE lexical scope, so a broad split would increase risk before the behavior is locked down. It also avoids a pure instrumentation phase; lightweight measurements are useful, but the repo already has obvious improvement areas in render ownership, repeated DOM work, and screen coverage.

## Screen Order

1. Home and home sections.
2. Search and browse results.
3. Library subviews: playlists, albums, artists, songs, genres, and folders.
4. Album, artist, and playlist detail.
5. Queue and mini/full player.
6. Settings, setup, sidebar, sheets, and dialogs.

This order starts with high-traffic screens, then moves through navigation-heavy details, then finishes with system surfaces and overlays.

## Screen Pass Contract

Each screen pass follows the same contract:

1. Identify the owning renderer and the state it reads or mutates.
2. Add or tighten QA around the current behavior before changing internals when the behavior is not already covered.
3. Refactor only the local render path or shared helper the screen actually uses.
4. Reduce full-screen rerenders when a targeted update is enough.
5. Verify no functional regression with the targeted QA script and a broader pass when shared behavior changes.

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

## Data Flow And State Boundaries

Renderers should read from canonical library, playback, queue, playlist, and settings state, then update only the DOM region they own. Cross-screen state changes should go through existing app helpers such as playback, queue, playlist, metadata, and library dirty-state helpers.

Where a screen currently re-renders because shared state changed, the pass should decide whether the update can be localized. Examples include syncing active track rows, refreshing queue counts, updating player badges, and updating search or library result sections without rebuilding unrelated surfaces.

## Error Handling And Edge States

Each screen should keep meaningful empty, loading, unsupported, and error states. This includes empty library, no search results, no queue items, folder API unsupported, metadata retry states, playback health warnings, and missing album art. Improvements should make these states more testable and less dependent on placeholder markup.

## Testing And Verification

Use the smallest proving command first:

- `npm run qa:home` for Home and section behavior.
- `npm run qa:navigation` and `npm run qa:library` for Search, Library, and detail routing.
- `npm run qa:queue` and `npm run qa:playback` for Queue and player changes.
- `npm run qa:folder`, `npm run qa:persistence`, and `npm test` for settings, setup, persistence, and backend-adjacent behavior.
- `npm run build` after JavaScript shard changes.

Before claiming completion for implementation work, run the relevant targeted QA and a broader regression pass for any shared renderer, playback, library, or storage change.

## Out Of Scope

- Rewriting the runtime into ES modules.
- Replacing the static HTML shell with a framework.
- Changing the generated bundle workflow.
- Merging `experimental` into `main` without an explicit request.
- Cosmetic redesigns that do not improve functionality, efficiency, fidelity, accessibility, or maintainability.

## Acceptance Criteria

- Each touched screen has clearer render ownership and less repeated local DOM code.
- Shared helpers are introduced only where they serve multiple real render paths.
- Targeted QA passes for each touched area.
- `npm run build` succeeds after JavaScript shard changes.
- User-facing screen behavior remains stable or improves in documented ways.
- Completed implementation is committed, tagged, and pushed to `experimental` unless the user explicitly requests a `main` merge.
