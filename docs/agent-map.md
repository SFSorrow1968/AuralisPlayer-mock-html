# Agent Navigation Map

This repo is organized for agentic coding. Prefer editing the smallest source shard that owns the behavior, then rebuild only when needed.

## Runtime Entry Points

- `Auralis_mock_zenith.html` is the static shell and app markup.
- `src/styles/*/*.css` are runtime stylesheets linked directly by the HTML shell. Link order is significant.
- `auralis-core.js` is the browser runtime bundle generated from `src/js/auralis-core/**/*.js`.

## JavaScript Source Shards

Edit these files instead of editing `auralis-core.js` directly. The folders describe the app area, and the number prefix preserves the load order:

### App And Shared UI

- `src/js/auralis-core/app/00-shell-state-helpers.js`: IIFE shell, global app state, shared helpers, action sheets, album progress, playable URL resolution.
- `src/js/auralis-core/ui/08-zenith-components.js`: reusable row/card factories and metadata render helpers.
- `src/js/auralis-core/app/11-events-compat.js`: delegated event map, long-press delegation, legacy `window.AuralisApp` bridge.

### Library Data

- `src/js/auralis-core/data/library/01a-state-search-sync.js`: library state helpers, search index creation, media-state sync.
- `src/js/auralis-core/data/library/01b-snapshot-indexes.js`: scan operations, album identity merging/splitting, snapshot indexes.
- `src/js/auralis-core/data/library/01c-scan-merge.js`: scanned-file to library merge pass.
- `src/js/auralis-core/data/library/01d-metadata-diagnostics.js`: index refresh, scan diagnostics, background metadata refinement.
- `src/js/auralis-core/data/library/01e-cache-local-music.js`: library cache persistence and local `Music` folder auto-load.
- `src/js/auralis-core/data/library/01f-album-regroup-duration-art.js`: album artist/regrouping, duration probing, artwork helpers.
- `src/js/auralis-core/data/05a-media-metadata-parsers.js`: low-level metadata parsing for ID3, Vorbis, and MP4 tags.
- `src/js/auralis-core/data/05b-media-db-canonical.js`: IndexedDB helpers, canonical backend cache, and canonical library payload sync.
- `src/js/auralis-core/data/05c-media-folder-access.js`: folder picker support, native/fallback access, cached files, and folder scan sources.
- `src/js/auralis-core/data/05d-media-folder-ui.js`: folder confirmation dialogs, setup folder list, settings folder list, and setup empty states.
- `src/js/auralis-core/data/13-m3u-io.js`: M3U playlist import/export helpers.
- `src/js/auralis-core/data/14-backend-integration.js`: backend auth, sync, session publishing, metrics UI integration.

### Screens

- `src/js/auralis-core/screens/home/02-layout-favorites-hydration.js`: home layout persistence, favorites, library hydration, now-playing UI.
- `src/js/auralis-core/screens/player/03-playback-engine.js`: playback state, progress UI, active rows, audio element binding, transport controls.
- `src/js/auralis-core/screens/navigation/04a-navigation-shell-settings.js`: screen switching, settings routes, overlays, party/session placeholders, sorting foundations.
- `src/js/auralis-core/screens/search/04b-search-workspace.js`: search scoring, Album Lens results, search workspace sections, filters, and sort controls.
- `src/js/auralis-core/screens/navigation/04c-routing-entrypoints.js`: playback and detail route entrypoints.
- `src/js/auralis-core/screens/playlists/04d-playlist-detail-picker.js`: playlist detail screen, playlist menu, add-songs picker.
- `src/js/auralis-core/screens/albums/04e-album-detail.js`: album detail resolution and rendering.
- `src/js/auralis-core/screens/home/04f-home-filters-jumpback.js`: jump-back sections and home filter bridge.
- `src/js/auralis-core/screens/queue/04g-queue-home-sheets.js`: queue rendering, home filter bridge, action sheets, sidebar helpers, and album-art viewer.
- `src/js/auralis-core/screens/setup/06a-folder-settings-actions.js`: settings folder add/remove/rescan actions.
- `src/js/auralis-core/screens/queue/06b-queue-interactions.js`: queue reorder/remove/clear/shuffle behavior and queue menus.
- `src/js/auralis-core/screens/setup/06c-a11y-onboarding.js`: accessibility labels, top-layer closing, onboarding.
- `src/js/auralis-core/screens/search/06d-search-bindings.js`: search input, search mode, filter chip binding.
- `src/js/auralis-core/screens/setup/06e-boot-init.js`: swipe gesture and app boot sequence.
- `src/js/auralis-core/config/07-zenith-config-profiles.js`: Zenith constants, icon helpers, home profiles, entity subtext config.
- `src/js/auralis-core/screens/home/09-zenith-home-sections.js`: home section composition and section editor actions.
- `src/js/auralis-core/screens/library/10a-library-appearance.js`: library category order, visibility, appearance toolbar, and density controls.
- `src/js/auralis-core/screens/library/10b-library-collections.js`: album/playlist/artist collection sections and carousel grouping.
- `src/js/auralis-core/screens/library/10c-library-songs.js`: library song windowing, metadata subscriptions, and song sorting.
- `src/js/auralis-core/screens/library/10d-library-artist-search-sidebar.js`: artist profile sections, search browse grid, and sidebar playlist list.
- `src/js/auralis-core/screens/library/10e-library-render-folder.js`: main library render pass and folder browser view.
- `src/js/auralis-core/screens/library/10f-library-section-config.js`: library section configuration sheet.

After changing a JS shard, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-core.ps1
```

## Stylesheet Shards

- `src/styles/app/00-foundation.css`: tokens, reset, shell layout, search, sidebar, media/list foundations.
- `src/styles/player/01-player.css`: bottom nav, mini player, full player overlay, transport, inline queue shell.
- `src/styles/controls/02-controls-setup.css`: buttons, toggles, inline queue, setup, settings, sheets, home editor.
- `src/styles/screens/03-album-artist.css`: album detail, artist detail, onboarding, media setup.
- `src/styles/player/04a-equalizer-panel.css`: equalizer panel overrides.
- `src/styles/screens/home/04b-home-edit-overrides.css`: home edit and blueprint preview styles.
- `src/styles/ui/04c-track-row-overrides.css`: dense row/card interaction overrides.
- `src/styles/screens/library/04d-grid-card-overrides.css`: grid card sizing and wrapping polish.
- `src/styles/screens/library/04e-empty-state-library-overrides.css`: final empty-state and library simplification overrides.
- `src/styles/polish/05a-global-home-library-polish.css`: global, home, library, search, and row polish.
- `src/styles/player/05b-player-polish.css`: full player overlay and transport polish.
- `src/styles/screens/05c-album-artist-queue-polish.css`: album, artist, and queue polish.
- `src/styles/controls/05d-setup-settings-polish.css`: controls, setup, and settings polish.
- `src/styles/screens/05e-profile-library-empty-polish.css`: profile, library empty-state, and home canvas polish.
- `src/styles/polish/05f-final-annotation-polish.css`: final annotation-pass refinements.
- `src/styles/ui/06-shared-ui.css`: reusable control and collection layout styles shared across screens.

## Agent Rules

- Prefer source shards over generated files.
- Keep numbered shard prefixes unique and stable unless you also update `scripts/build-core.ps1` assumptions and this map.
- Avoid converting `auralis-core.js` to ES modules without first designing a shared state boundary; the current runtime depends on one IIFE lexical scope.
- For QA, serve from localhost before testing folder access.
- The integrated backend lives under `server/`; start it with `npm start` so the API and static shell share one origin.
