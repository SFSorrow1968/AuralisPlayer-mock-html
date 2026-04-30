# Library Data Folder Map

This folder is the app's local-library brain, split by responsibility so each behavior has a clear home.

- `01a-state-search-sync.js`: shared library state helpers, search index creation, and syncing the visible library from media state.
- `01b-snapshot-indexes.js`: scan operation bookkeeping, album identity merging/splitting, and normalized snapshot indexes.
- `01c-scan-merge.js`: turns scanned files/folders into album and track library entries.
- `01d-metadata-diagnostics.js`: rebuild helpers, scan diagnostics, and background metadata refinement.
- `01e-cache-local-music.js`: localStorage cache plus automatic loading from the repo `Music` folder.
- `01f-album-regroup-duration-art.js`: album-artist cleanup, album regrouping, duration probing, artwork loading, featured albums.

Rule of thumb: cache/local server music lives in `01e`; scanned folder merging lives in `01c`; album cleanup/art/duration lives in `01f`.
