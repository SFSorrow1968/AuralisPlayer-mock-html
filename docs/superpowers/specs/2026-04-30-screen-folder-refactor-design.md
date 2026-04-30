# Screen Folder Refactor Design

## Plain-English Summary

This refactor makes the codebase easier to browse by moving the existing JavaScript and CSS shards into labeled folders. It does not change the player experience. It only changes where source files live and how the bundle builder finds them.

## Goal

Make the repository feel organized around app areas such as app shell, data, screens, player, library, setup, and shared UI so a vibe coder can find the right file without reading every large shard.

## Approach

The safe first pass keeps each existing shard intact and moves it into a category folder. The numeric prefixes stay on every JavaScript file, and `scripts/build-core.ps1` sorts all nested JavaScript shards by filename so the generated `auralis-core.js` keeps the same load order.

Stylesheets move into matching top-level style folders, and the HTML shell links the new paths in the same order as before.

## What Changes

- JavaScript source shards move from `src/js/auralis-core/*.js` into subfolders like `app/`, `data/`, `screens/home/`, `screens/library/`, `screens/player/`, `screens/setup/`, `config/`, and `ui/`.
- CSS shards move from `src/styles/*.css` into subfolders like `app/`, `player/`, `controls/`, `screens/`, `polish/`, and `ui/`.
- The build script reads JavaScript shards recursively instead of only reading the top-level folder.
- Documentation explains the new map so future edits start in the right place.

## Risks

The main risk is load order. The app currently relies on one generated script where earlier files define helpers used by later files. Keeping unique numeric prefixes and sorting by filename protects that order.

The second risk is broken stylesheet links. Updating the HTML shell and validating in the browser catches that.

## Success Criteria

- `npm run build` succeeds.
- `auralis-core.js` is regenerated from nested source shards.
- The browser opens `http://127.0.0.1:8787/` without a blank screen.
- The home screen still renders.
- Documentation points future work toward the new folders.
