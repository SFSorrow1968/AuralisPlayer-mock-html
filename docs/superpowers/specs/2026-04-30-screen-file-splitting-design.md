# Screen File Splitting Design

## Plain-English Summary

The previous refactor created labeled folders. This pass makes the biggest files inside those folders smaller, so each file answers a clearer question like "where is search?", "where is the queue?", or "where are folder picker controls?"

## Goal

Split the largest behavior files into smaller ordered shards without changing how the app works.

## Approach

Keep the current bundle model. Each new file gets a numbered name that preserves the exact old execution order when `auralis-core.js` is rebuilt. This is a mechanical split only: code moves into smaller files, but functions are not rewritten.

## Split Targets

- `screens/navigation/04-navigation-renderers.js` becomes smaller navigation, search, routing/detail, queue/home/action-sheet files.
- `data/05-media-folder-idb.js` becomes metadata parser, database/backend cache, folder access, and folder UI files.
- `screens/library/10-zenith-library-views.js` becomes appearance, collections, songs, artist/search/sidebar, render/folder browser, and section config files.

## Risks

The main risk is changing execution order. The numeric prefixes prevent that by making the new files sort in the same order as the old line ranges.

The second risk is accidentally cutting a function in half. Each split starts at a top-level function boundary found before moving content.

## Success Criteria

- `npm run build` succeeds.
- `npm test` passes.
- The local browser reloads the app successfully.
- Git recognizes the change as source reorganization, not behavior rewriting.
