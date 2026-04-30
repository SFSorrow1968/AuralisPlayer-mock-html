# Auralis Design Sandbox

These screen folders open the real Auralis app in a safe frame and route it directly to one screen.

That means the first view is a 1:1 production baseline: real markup, real styles, real carousel/card components, and real screen behavior. The shared files that power this are:

- `shared/real-app-sandbox.css`
- `shared/real-app-sandbox.js`

The older per-screen `screen.css`, `screen.js`, and `mock-data.js` files are legacy mock-sandbox files. The current `index.html` files do not load them.
