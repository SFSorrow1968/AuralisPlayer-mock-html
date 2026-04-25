# Agent Navigation Map

This repo is organized for agentic coding. Prefer editing the smallest source shard that owns the behavior, then rebuild only when needed.

## Runtime Entry Points

- `Auralis_mock_zenith.html` is the static shell and app markup.
- `src/styles/*.css` are runtime stylesheets linked directly by the HTML shell. Link order is significant.
- `auralis-core.js` is the browser runtime bundle generated from `src/js/auralis-core/*.js`.

## JavaScript Source Shards

Edit these files instead of editing `auralis-core.js` directly:

- `src/js/auralis-core/00-shell-state-helpers.js`: IIFE shell, global app state, shared helpers, action sheets, album progress, playable URL resolution.
- `src/js/auralis-core/01-library-scan-metadata.js`: scanned media to library merge, metadata parsing, duration probing, artwork.
- `src/js/auralis-core/02-layout-favorites-hydration.js`: home layout persistence, favorites, library hydration, now-playing UI.
- `src/js/auralis-core/03-playback-engine.js`: playback state, progress UI, active rows, audio element binding, transport controls.
- `src/js/auralis-core/04-navigation-renderers.js`: screen navigation, search, album/playlist/artist rendering, queue rendering.
- `src/js/auralis-core/05-media-folder-idb.js`: IndexedDB stores, media folder scans, fallback folder picker.
- `src/js/auralis-core/06-setup-init-a11y.js`: first-time setup, dialogs, accessibility, boot/init.
- `src/js/auralis-core/07-zenith-config-profiles.js`: Zenith constants, icon helpers, home profiles, entity subtext config.
- `src/js/auralis-core/08-zenith-components.js`: row/card factories and metadata render helpers.
- `src/js/auralis-core/09-zenith-home-sections.js`: home section composition and section editor actions.
- `src/js/auralis-core/10-zenith-library-views.js`: favorites, artist, search, sidebar, library refresh.
- `src/js/auralis-core/11-events-compat.js`: delegated event map, long-press delegation, legacy `window.AuralisApp` bridge.
- `src/js/auralis-core/14-backend-integration.js`: backend auth, sync, session publishing, metrics UI integration.

After changing a JS shard, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-core.ps1
```

## Stylesheet Shards

- `src/styles/00-foundation.css`: tokens, reset, shell layout, search, sidebar, media/list foundations.
- `src/styles/01-player.css`: bottom nav, mini player, full player overlay, transport, inline queue shell.
- `src/styles/02-controls-setup.css`: buttons, toggles, inline queue, setup, settings, sheets, home editor.
- `src/styles/03-album-artist.css`: album detail, artist detail, onboarding, media setup.
- `src/styles/04-zenith-overrides.css`: dense Zenith renderer overrides and interaction polish.
- `src/styles/05-design-polish.css`: annotation-driven polish and targeted visual fixes.
- `src/styles/06-shared-ui.css`: reusable control and collection layout styles shared across screens.

## Agent Rules

- Prefer source shards over generated files.
- Keep numbered shard order stable unless you also update `scripts/build-core.ps1` assumptions and this map.
- Avoid converting `auralis-core.js` to ES modules without first designing a shared state boundary; the current runtime depends on one IIFE lexical scope.
- For QA, serve from localhost before testing folder access.
- The integrated backend lives under `server/`; start it with `npm start` so the API and static shell share one origin.
