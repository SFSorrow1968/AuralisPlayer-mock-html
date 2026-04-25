# Auralis Core Source Shards

These files are concatenated in filename order to produce `../../../auralis-core.js`.

Use this folder as the source of truth for JavaScript work. The bundle exists so the static HTML app can keep running without a module loader or build pipeline.

## Rebuild

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-core.ps1
```

## Architecture Notes

See `../../../docs/runtime-architecture.md` for the plain-English runtime map and staged refactor direction.

## Shard Ownership

- `00-shell-state-helpers.js`: app shell, state, central diagnostics, shared strings, storage helpers, action sheets, album progress, playable URL resolution.
- `01-library-scan-metadata.js`: library construction and metadata scanning.
- `02-layout-favorites-hydration.js`: persisted layout, favorites, hydration.
- `03-playback-engine.js`: audio element, transport, progress, active-row state.
- `04-navigation-renderers.js`: navigation and major screen renderers.
- `05-media-folder-idb.js`: file/folder storage and scan flows.
- `06-setup-init-a11y.js`: setup, initialization, accessibility.
- `07-zenith-config-profiles.js`: Zenith config/profile/subtext systems.
- `08-zenith-components.js`: UI component factories.
- `09-zenith-home-sections.js`: home section rendering/editor.
- `10-zenith-library-views.js`: library/search/favorites/artist refresh.
- `11-events-compat.js`: action map, event delegation, compatibility bridge.
- `12-metadata-editor.js`: metadata edit dialog and override persistence.
- `13-m3u-io.js`: M3U playlist import/export helpers.
- `14-backend-integration.js`: backend auth, remote sync, session list, and observability UI hooks.
