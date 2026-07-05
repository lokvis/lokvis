---
editUrl: false
next: false
prev: false
title: "WorkspaceState"
---

Defined in: [ui-react/src/store/types.ts:12](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L12)

工作台完整状态

## Properties

### runtime

> **runtime**: [`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/) \| `null`

Defined in: [ui-react/src/store/types.ts:14](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L14)

Runtime 实例

***

### initializing

> **initializing**: `boolean`

Defined in: [ui-react/src/store/types.ts:16](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L16)

是否正在初始化 Runtime

***

### initError

> **initError**: `string` \| `null`

Defined in: [ui-react/src/store/types.ts:18](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L18)

初始化错误

***

### assets

> **assets**: [`Asset`](/docs/api/schema/src/interfaces/asset/)[]

Defined in: [ui-react/src/store/types.ts:21](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L21)

所有已导入资产

***

### selectedAssetId

> **selectedAssetId**: `string` \| `null`

Defined in: [ui-react/src/store/types.ts:23](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L23)

当前选中的资产 ID

***

### thumbnails

> **thumbnails**: `Record`\<`string`, `string`\>

Defined in: [ui-react/src/store/types.ts:25](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L25)

资产缩略图（AssetId → ObjectURL）

***

### capabilities

> **capabilities**: [`Capability`](/docs/api/schema/src/interfaces/capability/)[]

Defined in: [ui-react/src/store/types.ts:28](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L28)

所有已注册能力

***

### capabilityMap

> **capabilityMap**: `CapabilityMap`

Defined in: [ui-react/src/store/types.ts:30](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L30)

能力映射表（name → Capability）

***

### nodes

> **nodes**: `WorkspaceNode`[]

Defined in: [ui-react/src/store/types.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L33)

工作流节点序列（线性链）

***

### selectedNodeId

> **selectedNodeId**: `string` \| `null`

Defined in: [ui-react/src/store/types.ts:35](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L35)

当前选中的节点 ID

***

### running

> **running**: `boolean`

Defined in: [ui-react/src/store/types.ts:38](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L38)

是否正在执行工作流

***

### statusMessage

> **statusMessage**: `string`

Defined in: [ui-react/src/store/types.ts:40](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L40)

全局状态消息

***

### error

> **error**: `string` \| `null`

Defined in: [ui-react/src/store/types.ts:42](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L42)

错误信息

***

### errorSeq

> **errorSeq**: `number`

Defined in: [ui-react/src/store/types.ts:48](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L48)

错误事件序号(单调递增)。每次 setError(非 null) 都递增,使
ErrorBanner 能在相同错误消息重复出现时仍感知到"新错误事件"重新弹出。
null error 不递增。0 表示初始无错误状态。

***

### storageUsage

> **storageUsage**: \{ `usage`: `number`; `quota`: `number`; \} \| `null`

Defined in: [ui-react/src/store/types.ts:51](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L51)

存储配额使用情况(W6.7):{ usage, quota } 字节,null 表示未查询

***

### historyEntries

> **historyEntries**: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

Defined in: [ui-react/src/store/types.ts:54](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L54)

历史栈条目(W7.1):当前活跃工作流的执行历史

***

### historyCursor

> **historyCursor**: `number`

Defined in: [ui-react/src/store/types.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L56)

历史栈游标(W7.1):-1 表示无已应用条目(初始);i 表示第 i 条已应用

***

### historyWorkflowId

> **historyWorkflowId**: `string` \| `null`

Defined in: [ui-react/src/store/types.ts:58](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L58)

当前历史所属的工作流 ID(W7.1)

***

### lastOutputIds

> **lastOutputIds**: `string`[]

Defined in: [ui-react/src/store/types.ts:61](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L61)

上次工作流执行的输出 Asset ID 列表(W9.4/W9.5):用于 before/after 对比与下载管理

***

### selectedOutputId

> **selectedOutputId**: `string` \| `null`

Defined in: [ui-react/src/store/types.ts:63](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L63)

当前选中的输出 Asset ID(W9.4):用于多输出场景选择

***

### currentRunId

> **currentRunId**: `string` \| `null`

Defined in: [ui-react/src/store/types.ts:66](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L66)

当前正在运行的工作流 ID(W11.6:用于 cancel)
