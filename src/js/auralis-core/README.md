# Auralis Core Source Shards

These files are concatenated in filename order to produce `../../../auralis-core.js`.
Files may live in subfolders, but each JavaScript shard keeps a unique numeric prefix so the build order stays obvious.

Use this folder as the source of truth for JavaScript work. The bundle exists so the static HTML app can keep running without a module loader or build pipeline.

## Rebuild

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-core.ps1
```

## Folder Map

- `app/`: app shell, shared state, bootstrapping, event delegation, compatibility bridge.
- `config/`: Zenith display/profile constants and formatting configuration.
- `data/`: library scanning, media folders, metadata editing, playlist import/export, backend sync.
- `screens/home/`: home screen hydration, empty states, sections, and editor actions.
- `screens/library/`: library views, search-adjacent library refresh, favorites, artists, and inline list compatibility.
- `screens/navigation/`: screen switching, detail routes, queue helpers, sheets, and album-art viewer.
- `screens/player/`: playback engine, active rows, player controls, queue state, and progress UI.
- `screens/search/`: search scoring, results, filters, and workspace sections.
- `screens/setup/`: first-run setup, dialogs, accessibility, and app initialization.
- `ui/`: reusable row/card factories and metadata render helpers.

## Shard Ownership

- `app/00-shell-state-helpers.js`: app shell, state, shared helpers.
- `data/01-library-scan-metadata.js`: library construction and metadata scanning.
- `screens/home/02-layout-favorites-hydration.js`: persisted layout, favorites, hydration.
- `screens/player/03-playback-engine.js`: audio element, transport, progress, active-row state.
- `screens/navigation/04a-navigation-shell-settings.js`: navigation shell, settings routes, overlays, and sort foundations.
- `screens/search/04b-search-workspace.js`: search scoring, results, workspace sections, and filters.
- `screens/navigation/04c-routing-details-playlists.js`: playback routing, detail routes, playlist picker, and album detail rendering.
- `screens/navigation/04d-queue-home-sheets.js`: queue rendering, home bridge helpers, action sheets, sidebar helpers, and album-art viewer.
- `data/05a-media-metadata-parsers.js`: ID3, Vorbis, and MP4 metadata parsing.
- `data/05b-media-db-canonical.js`: IndexedDB helpers and canonical backend cache/sync.
- `data/05c-media-folder-access.js`: folder picker support and folder scan source handling.
- `data/05d-media-folder-ui.js`: setup/settings folder lists and folder confirmation UI.
- `screens/setup/06-setup-init-a11y.js`: setup, initialization, accessibility.
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
