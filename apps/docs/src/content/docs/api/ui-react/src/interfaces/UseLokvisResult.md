---
editUrl: false
next: false
prev: false
title: "UseLokvisResult"
---

Defined in: [ui-react/src/hooks/useLokvis.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useLokvis.ts#L32)

@lokvis/ui-react

Lokvis Workspace UI - React workspace component library.

Provides:
- `<Workspace />` - Ready-to-use local-first workspace
- `<AssetPanel />` - Asset panel (import / select / preview)
- `<Canvas />` - Canvas preview area
- `<Inspector />` - Right panel for capability configuration
- `<PipelineBar />` - Workflow pipeline step bar
- `<Toolbar />` - Top toolbar
- `<StatusBar />` - Bottom status bar
- `<HistoryPanel />` - History panel (W7.1, supports horizontal variant W9.1)
- `<CommandPalette />` - ⌘K command palette (W9.2)
- `<GlobalDropzone />` - Full-screen drag-drop with MIME validation (W9.3)
- `<CompareSlider />` - before/after comparison slider (W9.4)
- `<DownloadPanel />` - Workflow outputs download panel (W9.5)
- `<ThemeToggle />` - Dark mode toggle button (W9.7)
- `useLokvis()` - React hook for initializing Runtime + plugins
- `useTheme()` - Dark mode hook with localStorage + system preference (W9.7)
- `useMediaQuery()` / `useBreakpoints()` - Responsive hooks (W9.8)
- `useCommandPalette()` - ⌘K shortcut registration hook (W9.2)

## Properties

### runtime

> **runtime**: [`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/) \| `null`

Defined in: [ui-react/src/hooks/useLokvis.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useLokvis.ts#L33)

***

### status

> **status**: `"error"` \| `"idle"` \| `"ready"` \| `"initializing"`

Defined in: [ui-react/src/hooks/useLokvis.ts:34](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useLokvis.ts#L34)

***

### error

> **error**: `string` \| `null`

Defined in: [ui-react/src/hooks/useLokvis.ts:35](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useLokvis.ts#L35)
