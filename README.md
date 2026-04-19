# Auralis Mock Player (HTML)

This repository contains the standalone mock player runtime and source shards optimized for agentic coding:

- `Auralis_mock_zenith.html`
- `src/styles/*.css`
- `src/js/auralis-core/*.js`
- `auralis-core.js` generated bundle

## Run

Serve the repo and open `Auralis_mock_zenith.html` in a modern Chromium browser:

```powershell
python -m http.server 8765
```

For folder access features (library scan), use HTTPS or localhost where the File System Access API is supported.

## Agent Workflow

Read `docs/agent-map.md` first. Edit source shards, not the generated bundle.

After changing JavaScript shards, rebuild:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-core.ps1
```
