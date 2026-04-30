# CSS Screen Split And Verify Design

## Plain-English Summary

This pass makes styling easier to find by splitting the two largest CSS files into smaller files grouped by screen or purpose. It also adds one `npm run verify` command that runs the normal safety checks before pushing.

## Goal

Reduce CSS clutter and make pre-push checking easier without changing how the app looks or behaves.

## Approach

The split is mechanical. The old CSS is cut into smaller files, and the HTML shell links those files in the same order as the original large files. That preserves the browser cascade while making the source easier to browse.

The verify command runs the build, server tests, and a local static asset check that confirms every local CSS and JS file referenced by the HTML shell exists.

## Success Criteria

- The app still loads with the same visual styling.
- `npm run verify` succeeds.
- `npm test` succeeds through the verify command.
- The browser reloads `http://127.0.0.1:8787/` successfully.
