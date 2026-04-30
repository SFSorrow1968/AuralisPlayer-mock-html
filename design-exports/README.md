# Design Exports

These files are one-file HTML capsules for uploading into tools like Google AI Studio.

Each capsule is generated from the real app screen, with the rendered phone markup and CSS inlined into one standalone file. They are design snapshots, not the source of truth.

Use:

```powershell
npm run export:design
```

To export one screen:

```powershell
npm run export:design:library
```

Upload the matching `*-standalone.html` file from the screen folder. After AI Studio suggests a design change, bring the useful parts back into the real source files under `src/js/auralis-core/` and `src/styles/`.
