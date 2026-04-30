# Stylesheet Shards

The HTML shell links these files directly in order. Do not reorder links casually because later shards intentionally override earlier foundations.

- `app/00-foundation.css`: design tokens, reset, shell, generic layout, search/sidebar/media/list foundations.
- `player/01-player.css`: bottom nav, mini player, full player overlay, transport controls, inline queue shell.
- `controls/02-controls-setup.css`: buttons, toggles, inline queue controls, setup/settings, sheets, home editor.
- `screens/03-album-artist.css`: album detail, artist detail, onboarding, first-time setup, media setup.
- `player/04a-equalizer-panel.css`: equalizer panel overrides.
- `screens/home/04b-home-edit-overrides.css`: home edit and blueprint preview styles.
- `ui/04c-track-row-overrides.css`: dense row/card interaction overrides.
- `screens/library/04d-grid-card-overrides.css`: grid card sizing and wrapping polish.
- `screens/library/04e-empty-state-library-overrides.css`: final empty-state and library simplification overrides.
- `polish/05a-global-home-library-polish.css`: global, home, library, search, and row polish.
- `player/05b-player-polish.css`: full player overlay and transport polish.
- `screens/05c-album-artist-queue-polish.css`: album, artist, and queue polish.
- `controls/05d-setup-settings-polish.css`: controls, setup, and settings polish.
- `screens/05e-profile-library-empty-polish.css`: profile, library empty-state, and home canvas polish.
- `polish/05f-final-annotation-polish.css`: final annotation-pass refinements.
- `ui/06-shared-ui.css`: reusable control states and collection layout styles.
