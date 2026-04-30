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
- `screens/navigation/`: shared screen navigation and detail renderers.
- `screens/player/`: playback engine, active rows, player controls, queue state, and progress UI.
- `screens/setup/`: first-run setup, dialogs, accessibility, and app initialization.
- `ui/`: reusable row/card factories and metadata render helpers.

## Shard Ownership

- `app/00-shell-state-helpers.js`: app shell, state, shared helpers.
- `data/01-library-scan-metadata.js`: library construction and metadata scanning.
- `screens/home/02-layout-favorites-hydration.js`: persisted layout, favorites, hydration.
- `screens/player/03-playback-engine.js`: audio element, transport, progress, active-row state.
- `screens/navigation/04-navigation-renderers.js`: navigation and major screen renderers.
- `data/05-media-folder-idb.js`: file/folder storage and scan flows.
- `screens/setup/06-setup-init-a11y.js`: setup, initialization, accessibility.
- `config/07-zenith-config-profiles.js`: Zenith config/profile/subtext systems.
- `ui/08-zenith-components.js`: UI component factories.
- `screens/home/09-zenith-home-sections.js`: home section rendering/editor.
- `screens/library/10-zenith-library-views.js`: library/search/favorites/artist refresh.
- `app/11-events-compat.js`: action map, event delegation, compatibility bridge.
- `data/12-metadata-editor.js`: metadata editing helpers.
- `data/13-m3u-io.js`: playlist import/export helpers.
- `data/14-backend-integration.js`: backend auth, remote sync, session list, and observability UI hooks.
