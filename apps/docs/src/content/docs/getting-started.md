---
title: Getting Started
description: Install Lokvis, run the web app, and embed the runtime in your project.
draft: false
head: []
---

# Getting Started

## Install

```bash
pnpm install
```

## Run the Web App

```bash
pnpm dev --filter @lokvis/web
```

## Embed the Runtime

```typescript
import { createLokvis } from '@lokvis/sdk';
import imageToolsPlugin from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
});

const assetId = await lokvis.importAsset({ kind: 'file', file });
const result = await lokvis.run(workflow, [assetId]);
```

## Use the Workspace UI

```tsx
import { Workspace } from '@lokvis/ui-react';
import imageToolsPlugin from '@lokvis/plugin-image';

function App() {
  return (
    <Workspace
      title="My Image Tools"
      plugins={[imageToolsPlugin()]}
    />
  );
}
```
