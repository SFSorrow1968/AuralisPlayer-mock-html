# Auralis Design Sandbox

Standalone screen playgrounds for redesigning one app screen at a time without the full app engine.

Open any screen through the local server, for example:

```text
http://127.0.0.1:8787/design-sandbox/library/
http://127.0.0.1:8787/design-sandbox/player/
```

## Folder Pattern

Each screen folder has:

- `index.html`: the standalone page shell.
- `screen.css`: screen-specific visual direction.
- `screen.js`: tiny screen boot file.
- `mock-data.js`: fake content for that screen.

Shared visual scaffolding lives in `shared/`.

