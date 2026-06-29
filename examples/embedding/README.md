# Embedding Example

Shows how to embed the Lokvis Workspace into an existing React app using `@lokvis/ui-react`.

## Files

- `App.tsx` — host app layout that renders `<Workspace />` from `@lokvis/ui-react`
- `main.tsx` — React entry point rendering `App` into `#root`

## How to run

This example targets an existing React + Vite app. From the `lokvis-open` monorepo root:

```bash
# 1. Build all packages
pnpm build

# 2. In your own React + Vite project, add the workspace dependencies:
#    pnpm add @lokvis/ui-react @lokvis/sdk @lokvis/runtime @lokvis/plugin-image
#    Then copy App.tsx and main.tsx into your project and run `pnpm dev`.
```

> The `<Workspace />` component initializes the Runtime itself via the
> `useLokvis` hook — you only need to pass the plugins you want to load.

## What it demonstrates

- Embed the full workspace in one line: `<Workspace plugins={[imageToolsPlugin()]} />`
- Host the workspace inside an existing app layout (sidebar + main area)
- Only `@lokvis/ui-react` + `@lokvis/plugin-image` are required; the Runtime is auto-initialized
