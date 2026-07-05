---
editUrl: false
next: false
prev: false
title: "LokvisRuntime"
---

Defined in: [runtime/src/types.ts:96](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L96)

核心 Runtime API（第一版，必须克制）

## Properties

### version

> `readonly` **version**: `string`

Defined in: [runtime/src/types.ts:98](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L98)

Runtime 版本

***

### status

> `readonly` **status**: [`RuntimeStatus`](/docs/api/runtime/src/type-aliases/runtimestatus/)

Defined in: [runtime/src/types.ts:100](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L100)

当前状态

***

### eventBus

> `readonly` **eventBus**: [`EventBus`](/docs/api/schema/src/interfaces/eventbus/)

Defined in: [runtime/src/types.ts:102](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L102)

事件总线

***

### isPro

> `readonly` **isPro**: `boolean`

Defined in: [runtime/src/types.ts:104](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L104)

是否为 Pro 模式(影响批量上限/并发槽位/workflow 数,W6.2)

***

### batch

> `readonly` **batch**: [`BatchProcessor`](/docs/api/runtime/src/classes/batchprocessor/)

Defined in: [runtime/src/types.ts:106](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L106)

批量处理器(W6.1:并发控制 + 进度 + 失败重试)

## Methods

### run()

> **run**(`workflow`, `inputs`, `options?`): `Promise`\<[`WorkflowResult`](/docs/api/schema/src/interfaces/workflowresult/)\>

Defined in: [runtime/src/types.ts:110](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L110)

运行工作流

#### Parameters

##### workflow

[`Workflow`](/docs/api/schema/src/interfaces/workflow/)

##### inputs

`string`[] \| [`Asset`](/docs/api/schema/src/interfaces/asset/)[]

##### options?

[`RunOptions`](/docs/api/runtime/src/interfaces/runoptions/)

#### Returns

`Promise`\<[`WorkflowResult`](/docs/api/schema/src/interfaces/workflowresult/)\>

***

### cancel()

> **cancel**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/types.ts:112](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L112)

取消运行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### pause()

> **pause**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/types.ts:114](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L114)

暂停运行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### resume()

> **resume**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/types.ts:116](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L116)

恢复运行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### getCurrentOutputs()

> **getCurrentOutputs**(`workflowId`): `Promise`\<`string`[]\>

Defined in: [runtime/src/types.ts:125](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L125)

获取工作流当前输出 AssetId（undo/redo 后的"当前"状态）。

用途：
- UI 实时展示工作流中间结果
- MCP server 查询当前工作流产物
- 暂停时检查中间输出

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`string`[]\>

***

### disposeWorkflow()

> **disposeWorkflow**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/types.ts:132](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L132)

销毁工作流的运行时状态（取消运行 + 清空历史栈 + 回收历史 outputs 资产）。

修复 review 报告：原接口无清理入口，长会话累积导致 historyStacks Map
与 AssetStore 中孤儿资产泄漏。ui-react 应在 Workspace 卸载时调用。

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### history()

> **history**(`workflowId`): `Promise`\<[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]\>

Defined in: [runtime/src/types.ts:136](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L136)

获取工作流的执行历史

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]\>

***

### getHistoryState()

> **getHistoryState**(`workflowId`): `Promise`\<\{ `entries`: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]; `cursor`: `number`; \}\>

Defined in: [runtime/src/types.ts:142](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L142)

获取工作流历史状态(条目 + 当前游标)。
游标 -1 表示无已应用条目(初始状态);i 表示第 i 条已应用。
比 history() 多返回 cursor,UI 据此高亮当前步骤。

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<\{ `entries`: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]; `cursor`: `number`; \}\>

***

### undo()

> **undo**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/types.ts:146](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L146)

撤销一步

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### redo()

> **redo**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/types.ts:148](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L148)

重做一步

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### jumpTo()

> **jumpTo**(`workflowId`, `index`): `Promise`\<`void`\>

Defined in: [runtime/src/types.ts:154](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L154)

跳转到指定历史条目(按时间顺序的索引,-1 表示回到初始)。
用于 HistoryPanel 点击条目直接跳转,等价于连续 undo/redo 到目标位置。
越界或游标未变时为 no-op。

#### Parameters

##### workflowId

`string`

##### index

`number`

#### Returns

`Promise`\<`void`\>

***

### importAsset()

> **importAsset**(`source`): `Promise`\<`string`\>

Defined in: [runtime/src/types.ts:158](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L158)

导入资产

#### Parameters

##### source

[`AssetSource`](/docs/api/schema/src/type-aliases/assetsource/)

#### Returns

`Promise`\<`string`\>

***

### getAsset()

> **getAsset**(`id`): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

Defined in: [runtime/src/types.ts:160](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L160)

获取资产

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

***

### exportAsset()

> **exportAsset**(`id`, `format?`): `Promise`\<`Blob`\>

Defined in: [runtime/src/types.ts:162](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L162)

导出资产为 Blob

#### Parameters

##### id

`string`

##### format?

`string`

#### Returns

`Promise`\<`Blob`\>

***

### readAssetExif()

> **readAssetExif**(`id`): `Promise`\<[`ExifData`](/docs/api/schema/src/interfaces/exifdata/) \| `null`\>

Defined in: [runtime/src/types.ts:176](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L176)

读取 image 资产的 EXIF 元数据(W7.3/7.4)。

长期方案(MetadataReader 依赖反转):Runtime 持有 plugin-image 通过
`ctx.registerMetadataReader('image.read-exif', fn)` 注册的读取器引用,
按名调用。Plugin 未安装时优雅降级返回 null。
readExif 实现位于 plugin-image(Capability 层),不进 engine-image
(不符合 Engine 层 Blob↔Blob 纯函数约束)。
UI 通过此方法访问 EXIF,不直接依赖 Engine/Plugin 包(五层架构单向依赖)。

#### Parameters

##### id

`string`

资产 ID(须为 image 类型)

#### Returns

`Promise`\<[`ExifData`](/docs/api/schema/src/interfaces/exifdata/) \| `null`\>

ExifData;非 image / 无 EXIF / 解析失败 / reader 未注册返回 null

***

### removeAsset()

> **removeAsset**(`id`): `Promise`\<`void`\>

Defined in: [runtime/src/types.ts:178](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L178)

删除资产

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### listAssets()

> **listAssets**(): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

Defined in: [runtime/src/types.ts:180](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L180)

列出所有资产

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

***

### getStorageUsage()

> **getStorageUsage**(): `Promise`\<\{ `usage`: `number`; `quota`: `number`; \}\>

Defined in: [runtime/src/types.ts:192](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L192)

查询存储配额使用情况(W6.7)。

返回 `{ usage, quota }`:
- `usage`:当前已用字节数(所有资产 metadata.size 之和)
- `quota`:配置的存储配额上限(RuntimeConfig.storageQuota,默认 1GB)

UI 据此展示"已用/总额"进度条,接近上限(>=80%)时警告。
注意:usage 基于 listAssets 实时计算,反映 runtime 实际占用,
与浏览器 `navigator.storage.estimate()`(origin 整体 OPFS)不同。

#### Returns

`Promise`\<\{ `usage`: `number`; `quota`: `number`; \}\>

***

### capabilities()

> **capabilities**(): `Promise`\<[`Capability`](/docs/api/schema/src/interfaces/capability/)[]\>

Defined in: [runtime/src/types.ts:196](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L196)

列出所有已注册能力

#### Returns

`Promise`\<[`Capability`](/docs/api/schema/src/interfaces/capability/)[]\>

***

### hasCapability()

> **hasCapability**(`name`): `Promise`\<`boolean`\>

Defined in: [runtime/src/types.ts:198](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L198)

检查能力是否可用

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`boolean`\>

***

### toMcpManifest()

> **toMcpManifest**(`options?`): [`McpManifest`](/docs/api/schema/src/interfaces/mcpmanifest/)

Defined in: [runtime/src/types.ts:217](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L217)

生成 MCP server manifest(不启动 server,仅描述当前可被 MCP 暴露的能力)。
用于:
1. @lokvis/mcp-server 注册 tools 前的能力探测
2. Dashboard 展示"可被 AI 调用的能力"
3. 文档站自动生成 MCP tools 列表

`options.batchMode` 控制是否暴露 `mcpExposure='batch-only'` 的能力:
- 默认 false(单文件模式):不暴露 batch-only 能力
- true(batch 模式):暴露 batch-only 能力
`mcpExposure='private'` 的能力在任何模式下都不暴露。

注:本方法同步返回 —— manifest 是对 `capabilityRegistry.list()`
(同步)的纯计算,无 I/O,故无需 async。`capabilities()` 仍为 async
仅为接口对称性(未来可能涉及异步加载)。

#### Parameters

##### options?

[`ToMcpManifestOptions`](/docs/api/runtime/src/interfaces/tomcpmanifestoptions/)

#### Returns

[`McpManifest`](/docs/api/schema/src/interfaces/mcpmanifest/)
