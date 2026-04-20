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

## Agent Workflow

Read `docs/agent-map.md` first. Edit source shards, not the generated bundle.

After changing JavaScript shards, rebuild:

```powershell
npm run build
```
