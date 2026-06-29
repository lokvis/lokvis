# Custom Workspace Example

Shows how to build a custom workspace UI from scratch using only `@lokvis/sdk` and `@lokvis/runtime`, without `@lokvis/ui-react`. Useful when you need full control over the UI.

This example renders a minimal image workspace: pick a file, preview it, then click **Resize** to run an `image.resize` workflow through the Lokvis Runtime and display the result.

## Files

- `index.html` — page structure (file input, image preview, Resize button)
- `main.ts` — custom workspace logic that drives `@lokvis/sdk` directly

## How to run

`index.html` loads `main.ts` as an ES module, so you need a dev server or bundler that can transpile TypeScript on the fly (Vite works out of the box). Browsers cannot load `.ts` files directly.

From the `lokvis-open` monorepo root:

```bash
# 1. Build all packages (sdk / runtime / plugin-image, etc.)
pnpm build

# 2. Serve this example with a dev server, e.g.:
npx vite examples/custom-workspace
# or, if you've bundled main.ts to main.js:
# npx serve examples/custom-workspace
```

> Want to skip the build entirely? Swap the imports in `main.ts` for CDN URLs
> such as `https://esm.sh/@lokvis/sdk@0.1.0` (requires the packages to be
> published to npm first). Otherwise, run `pnpm build` and serve locally.

## What it demonstrates

- Initialize the Runtime with `createLokvis({ plugins: [imageToolsPlugin()] })`
- Import a user-selected file with `runtime.importAsset()`
- Build a linear `Workflow` containing a single `image.resize` node
- Execute it with `runtime.run()` and export the result via `runtime.exportAsset()`
- Full control over the UI — no dependency on `@lokvis/ui-react`
