# Screen Folder Map

Each folder owns one visible area or one navigation-adjacent behavior. If you are vibe-coding, start here before opening the generated `auralis-core.js` bundle.

- `albums/`: album detail page and album-specific route resolution.
- `home/`: Listen Now/Home sections, home filters, jump-back shelves, layout hydration.
- `library/`: Library category screens, category appearance, songs/albums/artists/folders rendering.
- `navigation/`: top-level screen switching, settings routes, search/sort foundations, route entrypoints.
- `player/`: audio engine, playback state, mini/full player, progress, active track states.
- `playlists/`: playlist detail page, playlist action menu, add-songs picker.
- `queue/`: visible queue UI, queue sheets, queue reorder/remove/clear behavior.
- `search/`: search result logic, search workspace, Album Lens, search input/filter bindings.
- `setup/`: folder settings actions, onboarding/accessibility, app boot.

Rule of thumb: if a change affects what a user sees on one screen, edit that screen folder first. If it affects shared rows/cards, use `../ui/`. If it affects raw library data, use `../data/library/`.
