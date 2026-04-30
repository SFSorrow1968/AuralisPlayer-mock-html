# Stylesheet Shards

The HTML shell links these files directly in order. Do not reorder links casually because later shards intentionally override earlier foundations.

- `app/00-foundation.css`: design tokens, reset, shell, generic layout, search/sidebar/media/list foundations.
- `player/01-player.css`: bottom nav, mini player, full player overlay, transport controls, inline queue shell.
- `controls/02-controls-setup.css`: buttons, toggles, inline queue controls, setup/settings, sheets, home editor.
- `screens/03-album-artist.css`: album detail, artist detail, onboarding, first-time setup, media setup.
- `screens/04-zenith-overrides.css`: final Zenith UI overrides, dense rows/cards, title motion, interaction polish.
- `polish/05-design-polish.css`: annotation-driven polish and targeted visual fixes.
- `ui/06-shared-ui.css`: reusable control states and collection layout styles.
