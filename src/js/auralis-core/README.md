# Auralis Core Source Shards

These files are concatenated in filename order to produce `../../../auralis-core.js`.
Files may live in subfolders, but each JavaScript shard keeps a unique numeric prefix so the build order stays obvious.

Use this folder as the source of truth for JavaScript work. The bundle exists so the static HTML app can keep running without a module loader or build pipeline.

## Rebuild

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-core.ps1
```

## Folder Map

- `app/`: app shell, shared state, event delegation, compatibility bridge.
- `config/`: display/profile constants, icons, entity subtext, sorting helpers.
- `data/library/`: library state, indexing, scanned-file merging, cache/local music, album regrouping, duration/art helpers.
- `data/`: media folders, metadata parsing/editing, playlist import/export, backend sync.
- `screens/albums/`: album detail screen rendering and album navigation.
- `screens/home/`: home hydration, home sections, filters, jump-back sections.
- `screens/library/`: library category screens and library appearance controls.
- `screens/navigation/`: high-level navigation shell, routing entrypoints, settings routes.
- `screens/player/`: playback engine, transport, progress, active-row state.
- `screens/playlists/`: playlist detail screen and add-songs picker.
- `screens/queue/`: queue rendering, queue action sheets, queue interactions.
- `screens/search/`: search scoring/results/workspace plus search input bindings.
- `screens/setup/`: folder settings actions, onboarding/accessibility, boot initialization.
- `ui/`: reusable row/card factories and metadata render helpers.

## Shard Ownership

- `app/00-shell-state-helpers.js`: app shell, state, shared helpers.
- `data/library/01a-state-search-sync.js`: library state helpers, search index creation, media-state sync.
- `data/library/01b-snapshot-indexes.js`: scan operations, album merging/splitting, snapshot indexes.
- `data/library/01c-scan-merge.js`: scanned-file to library merge pass.
- `data/library/01d-metadata-diagnostics.js`: library index refresh, diagnostics, background metadata pass.
- `data/library/01e-cache-local-music.js`: library cache persistence and local `Music` folder auto-load.
- `data/library/01f-album-regroup-duration-art.js`: album artist/regrouping, duration probing, artwork helpers.
- `screens/home/02-layout-favorites-hydration.js`: persisted layout, favorites, hydration.
- `screens/player/03-playback-engine.js`: audio element, transport, progress, active-row state.
- `screens/navigation/04a-navigation-shell-settings.js`: navigation shell, settings routes, overlays, and sort foundations.
- `screens/search/04b-search-workspace.js`: search scoring, result rows, Album Lens behavior, workspace sections, filters.
- `screens/navigation/04c-routing-entrypoints.js`: route helpers for playback, albums, artists, playlists, genres.
- `screens/playlists/04d-playlist-detail-picker.js`: playlist detail screen, playlist menu, add-songs picker.
- `screens/albums/04e-album-detail.js`: album resolution, album detail rendering, album layout toggle.
- `screens/home/04f-home-filters-jumpback.js`: jump-back sections, placeholders, home filter bridge.
- `screens/queue/04g-queue-home-sheets.js`: queue rendering, action sheets, sidebar helpers, album-art viewer.
- `data/05a-media-metadata-parsers.js`: ID3, Vorbis, and MP4 metadata parsing.
- `data/05b-media-db-canonical.js`: IndexedDB helpers and canonical backend cache/sync.
- `data/05c-media-folder-access.js`: folder picker support and folder scan source handling.
- `data/05d-media-folder-ui.js`: setup/settings folder lists and folder confirmation UI.
- `screens/setup/06a-folder-settings-actions.js`: settings folder add/remove/rescan actions.
- `screens/queue/06b-queue-interactions.js`: queue reorder, remove, clear, shuffle, and long-press menus.
- `screens/setup/06c-a11y-onboarding.js`: labels, accessibility pass, top-layer close behavior, onboarding.
- `screens/search/06d-search-bindings.js`: search mode state, search input, filter chip binding.
- `screens/setup/06e-boot-init.js`: swipe gesture and app boot sequence.
- `config/07-zenith-config-profiles.js`: Zenith config/profile/subtext systems.
- `ui/08-zenith-components.js`: UI component factories.
- `screens/home/09-zenith-home-sections.js`: home section rendering/editor.
- `screens/library/10a-library-appearance.js`: category order, visibility, and appearance toolbar.
- `screens/library/10b-library-collections.js`: collection sections and carousel grouping.
- `screens/library/10c-library-songs.js`: song windowing, metadata subscription, and song sort.
- `screens/library/10d-library-artist-search-sidebar.js`: artist profile sections, search browse grid, and sidebar playlists.
- `screens/library/10e-library-render-folder.js`: main library render pass and folder browser view.
- `screens/library/10f-library-section-config.js`: section configuration sheet.
- `app/11-events-compat.js`: action map, event delegation, compatibility bridge.
- `data/12-metadata-editor.js`: metadata editing helpers.
- `data/13-m3u-io.js`: playlist import/export helpers.
- `data/14-backend-integration.js`: backend auth, remote sync, session list, and observability UI hooks.
