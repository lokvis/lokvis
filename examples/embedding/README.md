# Embedding Example

Shows how to embed the Lokvis Workspace into an existing React app using `@lokvis/ui-react`,
including **cloud auth integration** (W17.6) for Pro tier unlocking.

## Files

- `App.tsx` — host app layout that renders `<Workspace />` from `@lokvis/ui-react`
  - Demonstrates 3 auth modes: `free` (local only) / `pro` (cloud session JWT) / `guest` (cloud but free)
  - Sidebar includes an auth mode switcher for interactive demo
  - Uses `key={authMode}` to remount Workspace when auth changes (since `useLokvis` initializes once on mount)
- `main.tsx` — React entry point rendering `App` into `#root`

## How to run

This example targets an existing React + Vite app. From the `lokvis` monorepo root:

```bash
# 1. Build all packages
pnpm build

# 2. Install deps for this example
pnpm install --filter @lokvis/example-embedding

# 3. Start Vite dev server
pnpm --filter @lokvis/example-embedding dev
```

To copy into your own React + Vite project:

```bash
pnpm add @lokvis/ui-react @lokvis/sdk @lokvis/plugin-image
# Then copy App.tsx and main.tsx into your project and run `pnpm dev`.
```

> The `<Workspace />` component initializes the Runtime itself via the
> `useLokvis` hook — you only need to pass the plugins (and optional `auth`) you want to load.

## Cloud auth integration (W17.6)

The `<Workspace />` component accepts an `auth` prop (via `WorkspaceProps extends UseLokvisOptions`)
that transparently flows to `createLokvis({ auth })` inside `useLokvis()`. The SDK uses
**presence-based** `isPro` derivation — no token validation happens locally (that's the cloud
gateway's job).

### Auth modes

| Mode | `auth` value | `isPro` | Batch | Concurrency | Workflow slots | Presets |
|------|-------------|---------|-------|-------------|----------------|---------|
| **Free** (local only) | `undefined` | `false` | 10 | 4 | 5 | 3 |
| **Pro** (cloud session) | `{ session: jwt }` | `true` | ∞ | 16 | ∞ | ∞ |
| **Guest** (cloud, but free) | `{ session: jwt, isPro: false }` | `false` | 10 | 4 | 5 | 3 |

### Real-world integration

In a real host app, you'd read the session from your own auth context (OAuth callback, cookie,
etc.) and pass it down — not switch it via UI buttons:

```tsx
import { Workspace } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { useAuthSession } from './my-auth-context'; // your own auth hook

function App() {
  const session = useAuthSession(); // string | null

  return (
    <Workspace
      title="Lokvis Workspace"
      plugins={[imageToolsPlugin()]}
      // Pass cloud session to unlock Pro limits.
      // When session is null (logged out), auth is undefined → free mode.
      auth={session ? { session } : undefined}
    />
  );
}
```

### Explicit guest override

If your cloud backend identifies a session as a guest (issued a session, but the user
shouldn't get Pro benefits), pass `isPro: false` explicitly:

```tsx
const auth = session
  ? { session, isPro: false } // guest override: presence would imply Pro, but we force free
  : undefined;
```

### API token (CLI / server scenarios)

For non-browser scenarios (CLI, server-side rendering), use `token` instead of `session`:

```tsx
const auth = { token: process.env.LOKVIS_API_TOKEN };
// → isPro: true if token is non-empty
```

## What it demonstrates

- Embed the full workspace in one line: `<Workspace plugins={[imageToolsPlugin()]} />`
- Host the workspace inside an existing app layout (sidebar + main area)
- Pass `auth` prop to unlock Pro tier limits (batch / concurrency / workflow slots / presets)
- Only `@lokvis/ui-react` + `@lokvis/plugin-image` are required; the Runtime is auto-initialized
- `@lokvis/sdk` is only needed for the `LokvisAuthSession` type import (type-only, no runtime cost)
