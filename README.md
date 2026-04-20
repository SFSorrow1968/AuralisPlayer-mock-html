# Auralis Mock Player (HTML)

This repository contains the standalone mock player runtime and source shards optimized for agentic coding:

- `Auralis_mock_zenith.html`
- `src/styles/*.css`
- `src/js/auralis-core/*.js`
- `auralis-core.js` generated bundle

## Run

Start the integrated backend and static shell:

```powershell
npm start
```

Then open [http://localhost:8787/Auralis_mock_zenith.html](http://localhost:8787/Auralis_mock_zenith.html) in a modern Chromium browser.

The Node service now provides:

- persisted auth
- server-backed library and user-state sync
- playback session publishing
- audit logs and metrics
- static file hosting for the mock shell

For folder access features (library scan), use localhost or HTTPS where the File System Access API is supported.

## Test

```powershell
npm test
```

## Local QA

Each QA flow runs the local backend, opens the static app in Chromium through Playwright, and uses the existing `Music/` fixture where it makes sense.

```powershell
npm run qa:live
npm run qa:folder
npm run qa:home
npm run qa:metadata
npm run qa:playback
npm run qa:navigation
npm run qa:library
npm run qa:queue
npm run qa:persistence
```

`qa:live` starts the backend on an ephemeral localhost port, opens a headed Chromium window to the app shell, and keeps the session alive until you close the browser or stop the process. Add `-- --devtools` if you want Chromium DevTools opened on launch.

Direct PowerShell entry points are also available if you prefer not to go through `npm`:

```powershell
node .\scripts\qa\live-session.mjs
node .\scripts\qa\folder-setup-rescan.mjs
node .\scripts\qa\home-screen.mjs
node .\scripts\qa\metadata-album-art.mjs
node .\scripts\qa\playback-controls.mjs
node .\scripts\qa\navigation-search.mjs
node .\scripts\qa\library-screen.mjs
node .\scripts\qa\queue-screen.mjs
node .\scripts\qa\persistence.mjs
```

What each script covers:

- `qa:folder`: persisted folder setup and a simulated rescan using indexed fixture data from `Music/`.
- `qa:home`: home feed ranking, Home profile creation, section editing, and empty-state recovery.
- `qa:metadata`: now-playing metadata plus the album-art viewer using real artwork from the fixture.
- `qa:playback`: play/pause, next/previous, and speed controls against playable fixture tracks.
- `qa:navigation`: library tab switching plus search query/filter behavior.
- `qa:library`: mobile-width library tab visibility, songs sorting, empty states, folder grouping, and detail routing.
- `qa:queue`: queue empty-state recovery, queue visibility, play-now handoff, Move Next reordering, and clearing up next.
- `qa:persistence`: liked state, gapless preference, and a user playlist surviving a reload.

## Agent Workflow

Read `docs/agent-map.md` first. Edit source shards, not the generated bundle.

After changing JavaScript shards, rebuild:

```powershell
npm run build
```
