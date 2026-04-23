# Minimal UI Cleanup Design

## Goal

Make Auralis feel cleaner, quieter, and more fluent without changing the app's core product model, screen map, shard-based runtime, or local-first playback/library behavior.

The work should reduce visual noise, remove confusing control reuse, unify empty states, and make each major screen communicate its purpose more clearly through layout and behavior instead of extra labels, pills, icons, and carousels.

## Approved Direction

On April 22, 2026, the user approved the recommended direction: a focused redesign that keeps the existing app structure but simplifies each screen's control system and visual language.

This is not a full product reset and not a cosmetic paint-over. The design is a structural cleanup pass that changes how UI patterns are used so the app feels more minimal, intuitive, and durable.

## Plain-English Summary

Right now, too many parts of the app are speaking in the same loud voice. Search controls, Library controls, Home edit controls, creation actions, and settings-style menus all look and behave too similarly. That makes the app feel crowded even when the actual amount of content is reasonable.

The redesign should make the UI easier to read at a glance by doing four things:

1. Reduce the number of always-visible controls.
2. Give different jobs different interaction patterns.
3. Replace boxed placeholder emptiness with a single warmer empty-state system.
4. Let artwork, spacing, typography, and hierarchy carry more of the experience than chips and icons.

## Why This Matters

Minimalism only works when the interface makes strong choices. If every control is equally prominent, every state uses a different empty treatment, and every screen stacks multiple chip rows and icon clusters, the app feels busy and uncertain.

This cleanup matters because Auralis is trying to feel fluid and intentional. The current UI already has strong content surfaces and artwork, but the supporting chrome is over-explaining itself. Reducing that noise will make the app feel more premium, easier to trust, and faster to use.

## Design Principles

- Show, do not narrate. Prefer artwork, spacing, and clear grouping over repeated labels and helper copy.
- One control pattern per job. Search refinement, sorting, editing, creation, and settings should not all use the same generic action sheet language.
- Fewer visible options by default. Advanced or secondary actions should move into contextual menus or overflow surfaces.
- Filled selection, not outlined selection. Selected states should feel calm and intentional, not boxed in.
- One empty-state family. Empty screens should feel human and consistent instead of like dead placeholders.
- Reduce carousels. Horizontal rails should be used only where they add real browsing value.
- Preserve accessibility. Removing harsh outlines must not remove keyboard focus visibility; focus needs a softer replacement, not disappearance.

## In Scope

1. Home screen visual cleanup and quieter header/profile controls.
2. Home edit interaction redesign, especially contextual handling for item count and section presentation controls.
3. Search screen simplification, including search-bar action meaning, chip density, and browse-mode restraint.
4. Library screen simplification, especially header actions, visible tabs, song sort controls, and redundant icon usage.
5. Shared empty-state redesign across Home, Search, Library, playlist/detail empties, and related blank states.
6. Selection and focus treatment cleanup so selected elements do not use harsh outlined boxes.
7. Library information-density reduction, especially unnecessary carousels, badges, and repeated chips.
8. Artist/detail screen cleanup where controls overpower artwork or metadata hierarchy.

## Out Of Scope

- No framework migration.
- No ES module conversion.
- No replacement of the static HTML shell.
- No new major navigation structure.
- No new cloud/backend features.
- No rewrite of the playback engine or library data model.
- No `main` merge unless explicitly requested.
- No committing existing untracked debug scripts unless they are intentionally promoted into maintained QA.

## Current Problems

### 1. Too Many Shared Patterns

The app currently reuses chips, circular icon buttons, and generic action sheets across tasks that should feel different. Search sort, Library sort, Home edit, section configuration, and some settings-like controls all blur together.

This makes the app feel visually consistent in the wrong way: everything looks like a generic toggle or menu instead of feeling purpose-built.

### 2. Too Many Simultaneous Decisions

Several screens ask the user to make too many decisions before they can focus on content.

Examples:

- Search shows the field, a sort/refine button, filter chips, tag chips, and browse content all at once.
- Library shows multiple icon actions in the header, one chip row for sections, and another chip row for song sorting.
- Home edit uses general-purpose sheets for layout and count choices that should feel local to the section being edited.

### 3. Empty States Feel Mechanical

The app uses multiple empty-state systems with different shapes, borders, spacing, and tone. Some are outlined boxes with centered text, some are card-like, some are more polished.

The result is inconsistency and a colder feeling than the product wants.

### 4. Library Feels Over-Tooled

The Library screen has the highest concentration of controls, chips, and optional navigation paths. It currently feels more like a control panel than a quiet music library.

## Proposed Design

## Global Design Rules

### A. Control Hierarchy

Every screen should follow this hierarchy:

- One primary action at the screen level.
- One optional secondary overflow entry point.
- Local actions appear next to the thing they affect.
- Sorting and filtering stay close to the content they change.
- Editing controls appear only while editing.

This means the app stops advertising every capability all the time.

### B. Selection And Focus

Selected state:

- Use filled chips, subtle tint, elevation, or glow.
- Do not use a visible rectangular outline box for selected state.
- Use the same selection language across chips, cards, rows, and picker choices where practical.

Keyboard focus:

- Keep `:focus-visible`, but replace the current boxy outline treatment with a softer halo or inset glow that matches the app's visual system.
- Pointer selection and keyboard focus should not look identical.

### C. Empty-State System

Create one shared empty-state component family with:

- a soft illustration or icon treatment,
- a short title,
- one sentence of supportive copy,
- one obvious next action when needed,
- no heavy outline box as the primary framing device.

Tone should be warm, quiet, and brief. Empty states should feel like guidance, not error handling.

### D. Reduce Persistent Chrome

If a control is not needed most of the time, it should not stay visible most of the time.

This especially applies to:

- extra Library header icons,
- secondary tabs such as Genres and Folders,
- song sort chip rows,
- tags and custom chips in Search browse mode,
- edit-only Home controls.

## Screen Designs

### Home

Home should feel like a listening destination, not a dashboard of controls.

Changes:

- Keep the title and one clear entry point for editing.
- De-emphasize the profile add/switch controls so they read as secondary, not equal to playback content.
- Keep the playback warning present only when needed and visually quieter.
- Reduce the number of rail/carousel presentations on Home. Use vertical lists more often for scan speed and calmness.
- Empty sections should use the shared empty-state system, not outlined placeholder boxes.

Desired result:

The screen opens on music, not on tools.

### Home Edit

Home edit should feel like arranging the room, not opening Settings over and over.

Changes:

- Section controls should feel attached to each section.
- `Item Count` should open a contextual chooser that is clearly about layout density, not a generic settings action sheet.
- Count options should be presented as visually scannable choices such as `4`, `6`, `8`, `12`, not a long repeated menu list.
- Presentation and density controls should live in the same local editing context.
- Edit-only affordances should appear only in edit mode and disappear fully outside it.

Desired result:

Editing feels direct and spatial.

### Search

Search should have one obvious first action: search.

Changes:

- The button inside the search field should be search-specific. It should mean refine/filter/search options, not share the same sort language used in Library and other surfaces.
- In browse mode, reduce visible control density. Do not show every chip system before the user types.
- Keep the top of the screen calm: title, supporting line, search field, then one restrained browsing surface.
- Move custom tags behind a contextual entry point or hide them until they are relevant.
- No-results states should use the new shared empty-state system with helpful, short copy.

Desired result:

The screen feels like a search experience with browse support, not a search lab.

### Search Browse

Browse mode should show fewer, better things.

Changes:

- Replace the current busy combination of chips and grid with a single curated content block.
- Prefer one recent/recommended albums presentation instead of multiple competing entry points.
- Avoid a dense wall of equally styled cards if the browse surface already sits below a control stack.

Desired result:

Browse feels editorial and calm.

### Library Header

Library is currently over-signaled.

Changes:

- Keep one strong primary action in the header.
- Move `Import M3U` out of the persistent global header and into playlist-specific context or empty states.
- Reduce the number of simultaneous round icon buttons.
- Keep overflow or contextual menus for less-common actions.

Desired result:

The header frames the screen instead of competing with it.

### Library Tabs

Not every category needs equal visibility.

Changes:

- Treat `Playlists`, `Albums`, `Artists`, and `Songs` as primary tabs.
- Move `Genres` and `Folders` into secondary navigation or overflow.
- Keep tab behavior stable and accessible, but reduce the visible choice count.

Desired result:

The top of Library becomes readable in one pass.

### Library Songs

Songs view currently stacks navigation chips on top of sort chips, which creates immediate clutter.

Changes:

- Replace the sort chip row with a single sort control, compact segmented control, or small inline selector.
- Reduce repeated metadata badges such as `Partial tags` in the default list view unless they are essential.
- Keep rows strong, clear, and scannable with stable artwork, title, artist/album, and duration.

Desired result:

The songs list feels like content, not a filter dashboard.

### Library Playlists

Playlists view should feel intentionally sparse, not accidentally empty.

Changes:

- Improve row spacing, text hierarchy, and thumbnail treatment so the view still feels designed with few playlists.
- Playlist creation/import guidance should live naturally in the empty state, not in the global header.

Desired result:

Sparse content still feels finished.

### Library Genres And Folders

These are useful, but not primary.

Changes:

- Move them out of the main visible tab set.
- Use the shared empty-state system when they have no content.
- Keep them discoverable without making them compete with the primary listening views.

Desired result:

Useful secondary views stop overwhelming the main Library experience.

### Artist, Album, And Playlist Detail

Detail screens are closest to the desired product feeling because artwork already leads.

Changes:

- Reduce control prominence where hero art and title already do the heavy lifting.
- Simplify floating circular actions.
- Keep metadata compact and readable.
- Remove decorative repetition that steals attention from the artwork and track list.

Desired result:

Detail screens feel confident, immersive, and less tool-heavy.

## Technical Translation

The design should be implemented by changing the owning shards rather than layering more one-off CSS on top.

Primary implementation targets:

- `Auralis_mock_zenith.html` for visible header/control structure changes on Home, Search, and Library.
- `src/js/auralis-core/04-navigation-renderers.js` for Search state, search-field action meaning, and search result/browse behavior.
- `src/js/auralis-core/09-zenith-home-sections.js` for Home edit patterns, contextual item count behavior, and section empty states.
- `src/js/auralis-core/10-zenith-library-views.js` for Library tab reduction, Library header behavior, Library song sort treatment, playlist/library empty states, and artist section config behavior.
- `src/js/auralis-core/08-zenith-components.js` for a shared empty-state component contract.
- `src/styles/00-foundation.css`, `src/styles/03-album-artist.css`, and `src/styles/04-zenith-overrides.css` for unified empty-state styling, selection/focus behavior, reduced chip noise, and calmer control density.

## Implementation Strategy

Do the work in this order:

1. Define the shared visual language:
   - empty-state system,
   - selection/focus system,
   - chip/control density rules.
2. Simplify the highest-noise shared surfaces:
   - Search header/toolbar,
   - Library header/tabs/sort controls.
3. Redesign Home edit behavior so it uses contextual controls instead of settings-like sheets.
4. Reduce carousel and badge overuse across Home and Library.
5. Apply the same language to detail screens and remaining blank states.
6. Verify the resulting UI with screen QA and focused browser inspection.

This sequence matters because the later screens should inherit the calmer shared language instead of re-solving the same problems separately.

## Risks And Tradeoffs

- Reducing visible controls can make some secondary actions less discoverable.
  Mitigation: keep them in contextual menus or overflow, not removed outright.

- Removing harsh outlines can hurt accessibility if done carelessly.
  Mitigation: keep a softer but still clearly visible `:focus-visible` treatment.

- Reducing tabs and chips can irritate users who rely on direct access to secondary views.
  Mitigation: keep secondary views available through a `More` or overflow model rather than deleting them.

- Replacing many patterns at once can cause visual inconsistency during implementation.
  Mitigation: define the shared rules first and apply them screen by screen.

## QA Strategy

Use the smallest proving command first for each area:

- `npm run qa:home` for Home and Home edit changes.
- `npm run qa:navigation` for Search behavior and detail navigation.
- `npm run qa:library` for Library tab, sort, and empty-state changes.
- `npm run qa:screens` for broad visual regression on major surfaces.
- `npm run build` after JavaScript shard edits.

Visual checks should confirm:

- calmer header density,
- no selection boxes that read like error outlines,
- one consistent empty-state language,
- reduced chip clutter in Search and Library,
- improved readability with fewer visible controls.

## Acceptance Criteria

- Search, Library, and Home feel visibly calmer without changing the app's core information architecture.
- Home edit controls feel contextual rather than settings-like.
- The search-bar trailing action is search-specific and no longer reads like a reused settings/menu trigger.
- Library header chrome is reduced and secondary actions no longer crowd the title.
- Main Library tabs are reduced to the primary listening categories.
- Songs view no longer relies on a second noisy chip row for sorting.
- Empty states across the app use one shared style family with warmer tone and shorter copy.
- Selected state no longer appears as a harsh outline box.
- Carousels are used more selectively, especially in Library.
- Relevant targeted QA passes, and the broad screen audit still renders healthy major screens.

## Self-Review

- Placeholder scan: no TBD or TODO items remain.
- Scope check: the work is focused on UI cleanup and interaction simplification, not a product rewrite.
- Consistency check: the design preserves the repo's shard architecture and `experimental` branch workflow.
- Ambiguity check: secondary actions are hidden or relocated, not removed without replacement.
