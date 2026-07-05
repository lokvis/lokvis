---
editUrl: false
next: false
prev: false
title: "WorkspaceProps"
---

Defined in: [ui-react/src/components/Workspace.tsx:62](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L62)

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

## Extends

- [`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/)

## Properties

### enableOpfs?

> `optional` **enableOpfs?**: `boolean`

Defined in: [runtime/src/types.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L27)

是否启用 OPFS（默认 true，降级时关闭）

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`enableOpfs`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#enableopfs)

***

### enableIndexedDB?

> `optional` **enableIndexedDB?**: `boolean`

Defined in: [runtime/src/types.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L29)

是否启用 IndexedDB 元数据存储

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`enableIndexedDB`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#enableindexeddb)

***

### storageQuota?

> `optional` **storageQuota?**: `number`

Defined in: [runtime/src/types.ts:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L31)

存储配额（字节）

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`storageQuota`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#storagequota)

***

### enableLog?

> `optional` **enableLog?**: `boolean`

Defined in: [runtime/src/types.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L33)

是否启用日志

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`enableLog`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#enablelog)

***

### engineStrategy?

> `optional` **engineStrategy?**: [`EngineSelectionStrategy`](/docs/api/schema/src/type-aliases/engineselectionstrategy/)

Defined in: [runtime/src/types.ts:39](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L39)

引擎选择策略(默认 'first')。
当多个引擎实现同一能力且未显式指定 preferredEngine 时,据此选择:
'first'(注册顺序)/'fastest'(性能最优)/'balanced'(匹配能力声明性能,无则最快)。

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`engineStrategy`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#enginestrategy)

***

### assetStore?

> `optional` **assetStore?**: [`AssetStore`](/docs/api/runtime/src/interfaces/assetstore/)

Defined in: [runtime/src/types.ts:45](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L45)

注入自定义 AssetStore(测试或精细控制用)。
默认由 createRuntime 通过 createAssetStore 工厂自动创建,
按 OPFS → IndexedDB → Memory 降级。

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`assetStore`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#assetstore)

***

### historyStore?

> `optional` **historyStore?**: [`HistoryStore`](/docs/api/runtime/src/interfaces/historystore/)

Defined in: [runtime/src/types.ts:51](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L51)

注入自定义 HistoryStore(W7.2 历史持久化)。
默认由 createRuntime 在 enableIndexedDB 时通过 createHistoryStore 自动创建;
IndexedDB 不可用时为 undefined,历史退化为仅内存模式。

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`historyStore`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#historystore)

***

### historyStoreOptions?

> `optional` **historyStoreOptions?**: [`HistoryStoreOptions`](/docs/api/runtime/src/interfaces/historystoreoptions/)

Defined in: [runtime/src/types.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L56)

HistoryStore 工厂选项(W7.2,仅 historyStore 未注入时生效)。
测试可注入 dbInstance 或自定义 dbName。

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`historyStoreOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#historystoreoptions)

***

### isPro?

> `optional` **isPro?**: `boolean`

Defined in: [runtime/src/types.ts:63](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L63)

是否启用 Pro 模式(W6.2 / PROJECT_PLAN 17.4)。
- false(默认):批量上限 10 文件、并发 4、workflow 槽位 5
- true:批量无上限、并发 16、workflow 槽位无限
由 cloud 侧 createLokvis({ auth }) 注入 session 后置为 true。

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`isPro`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#ispro)

***

### memoryBudget?

> `optional` **memoryBudget?**: `number`

Defined in: [runtime/src/types.ts:68](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L68)

内存预算(字节,W3.3 MemoryGuard)。
默认 512MB。BatchProcessor 据此在内存压力高时收缩并发槽位。

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`memoryBudget`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#memorybudget)

***

### title?

> `optional` **title?**: `string`

Defined in: [ui-react/src/components/Workspace.tsx:64](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L64)

顶部标题

***

### showStatusBar?

> `optional` **showStatusBar?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:66](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L66)

是否显示状态栏（默认 true）

***

### showHistoryPanel?

> `optional` **showHistoryPanel?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:68](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L68)

是否显示历史面板（默认 true,W7.1）

***

### enableGlobalDropzone?

> `optional` **enableGlobalDropzone?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:70](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L70)

是否启用全屏拖拽导入（默认 true,W9.3）

***

### enableCommandPalette?

> `optional` **enableCommandPalette?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:72](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L72)

是否启用 Command Palette ⌘K（默认 true,W9.2）

***

### enableThemeToggle?

> `optional` **enableThemeToggle?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:74](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L74)

是否启用 ThemeToggle（默认 true,W9.7）

***

### enableCompare?

> `optional` **enableCompare?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:76](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L76)

是否启用 CompareSlider（默认 true,W9.4）

***

### enableDownloadPanel?

> `optional` **enableDownloadPanel?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:78](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L78)

是否启用 DownloadPanel（默认 true,W9.5）

***

### enableWorkflowEditor?

> `optional` **enableWorkflowEditor?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:80](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L80)

是否启用拖拽式 WorkflowEditor（默认 false,W10.4;关闭则用只读 PipelineBar）

***

### enableProgressBar?

> `optional` **enableProgressBar?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:82](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L82)

是否启用 ProgressBar + Cancel 按钮（默认 true,W11.6）

***

### enableErrorBanner?

> `optional` **enableErrorBanner?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:84](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L84)

是否启用 ErrorBanner 错误信息横幅（默认 true,W11.3）

***

### enableShareLink?

> `optional` **enableShareLink?**: `boolean`

Defined in: [ui-react/src/components/Workspace.tsx:86](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L86)

是否从 URL ?workflow= 参数加载分享工作流（默认 true,W11.5）

***

### className?

> `optional` **className?**: `string`

Defined in: [ui-react/src/components/Workspace.tsx:87](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/Workspace.tsx#L87)

***

### plugins?

> `optional` **plugins?**: [`PluginLoadEntry`](/docs/api/sdk/src/interfaces/pluginloadentry/)[]

Defined in: [ui-react/src/hooks/useLokvis.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useLokvis.ts#L27)

预加载的插件列表

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`plugins`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#plugins)

***

### autoInit?

> `optional` **autoInit?**: `boolean`

Defined in: [ui-react/src/hooks/useLokvis.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useLokvis.ts#L29)

是否在挂载时自动初始化（默认 true）

#### Inherited from

[`UseLokvisOptions`](/docs/api/ui-react/src/interfaces/uselokvisoptions/).[`autoInit`](/docs/api/ui-react/src/interfaces/uselokvisoptions/#autoinit)
