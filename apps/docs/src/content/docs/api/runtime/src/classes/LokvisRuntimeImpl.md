---
editUrl: false
next: false
prev: false
title: "LokvisRuntimeImpl"
---

Defined in: [runtime/src/runtime.ts:192](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L192)

Runtime 实现类

## Implements

- [`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/)

## Constructors

### Constructor

> **new LokvisRuntimeImpl**(`config?`): `LokvisRuntimeImpl`

Defined in: [runtime/src/runtime.ts:264](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L264)

#### Parameters

##### config?

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/) = `{}`

#### Returns

`LokvisRuntimeImpl`

## Properties

### version

> `readonly` **version**: `"0.1.0"` = `RUNTIME_VERSION`

Defined in: [runtime/src/runtime.ts:193](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L193)

Runtime 版本

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`version`](/docs/api/runtime/src/interfaces/lokvisruntime/#version)

***

### eventBus

> `readonly` **eventBus**: [`EventBus`](/docs/api/schema/src/interfaces/eventbus/)

Defined in: [runtime/src/runtime.ts:194](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L194)

事件总线

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`eventBus`](/docs/api/runtime/src/interfaces/lokvisruntime/#eventbus)

## Accessors

### status

#### Get Signature

> **get** **status**(): [`RuntimeStatus`](/docs/api/runtime/src/type-aliases/runtimestatus/)

Defined in: [runtime/src/runtime.ts:328](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L328)

当前状态

##### Returns

[`RuntimeStatus`](/docs/api/runtime/src/type-aliases/runtimestatus/)

当前状态

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`status`](/docs/api/runtime/src/interfaces/lokvisruntime/#status)

***

### isPro

#### Get Signature

> **get** **isPro**(): `boolean`

Defined in: [runtime/src/runtime.ts:332](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L332)

是否为 Pro 模式(影响批量上限/并发槽位/workflow 数,W6.2)

##### Returns

`boolean`

是否为 Pro 模式(影响批量上限/并发槽位/workflow 数,W6.2)

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`isPro`](/docs/api/runtime/src/interfaces/lokvisruntime/#ispro)

***

### batch

#### Get Signature

> **get** **batch**(): [`BatchProcessor`](/docs/api/runtime/src/classes/batchprocessor/)

Defined in: [runtime/src/runtime.ts:336](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L336)

批量处理器(W6.1:并发控制 + 进度 + 失败重试)

##### Returns

[`BatchProcessor`](/docs/api/runtime/src/classes/batchprocessor/)

批量处理器(W6.1:并发控制 + 进度 + 失败重试)

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`batch`](/docs/api/runtime/src/interfaces/lokvisruntime/#batch)

## Methods

### \_registerMetadataReader()

> **\_registerMetadataReader**(`name`, `reader`): `void`

Defined in: [runtime/src/runtime.ts:260](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L260)

注册元数据读取器(由 PluginContext.registerMetadataReader 转发)。
下划线前缀表示内部 API,不暴露在 LokvisRuntime 公开接口。

#### Parameters

##### name

`string`

##### reader

[`MetadataReader`](/docs/api/schema/src/type-aliases/metadatareader/)

#### Returns

`void`

***

### run()

> **run**(`workflow`, `inputs`, `options?`): `Promise`\<[`WorkflowResult`](/docs/api/schema/src/interfaces/workflowresult/)\>

Defined in: [runtime/src/runtime.ts:342](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L342)

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

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`run`](/docs/api/runtime/src/interfaces/lokvisruntime/#run)

***

### cancel()

> **cancel**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:425](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L425)

取消运行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`cancel`](/docs/api/runtime/src/interfaces/lokvisruntime/#cancel)

***

### pause()

> **pause**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:429](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L429)

暂停运行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`pause`](/docs/api/runtime/src/interfaces/lokvisruntime/#pause)

***

### resume()

> **resume**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:433](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L433)

恢复运行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`resume`](/docs/api/runtime/src/interfaces/lokvisruntime/#resume)

***

### disposeWorkflow()

> **disposeWorkflow**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:452](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L452)

销毁指定工作流的运行时状态（W2.8 内存治理）。

调用时机：
  - ui-react 卸载 Workspace 组件时
  - 用户主动关闭工作流标签页时

行为：
  - 调用 stack.reset() 触发 onEvict → assetStore.remove 回收历史 outputs 资产
  - 从 historyStacks / initialInputsMap / currentOutputsMap 三 Map 中删除 entry
  - 调用 executor.cancel 取消运行中的执行（若有）

修复 review 报告：原实现无清理入口,Workflow 组件卸载后 Map 中残留 entry,
长会话累积导致内存与 OPFS 空间双泄漏。

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`disposeWorkflow`](/docs/api/runtime/src/interfaces/lokvisruntime/#disposeworkflow)

***

### history()

> **history**(`workflowId`): `Promise`\<[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]\>

Defined in: [runtime/src/runtime.ts:467](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L467)

获取工作流的执行历史

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`history`](/docs/api/runtime/src/interfaces/lokvisruntime/#history)

***

### getHistoryState()

> **getHistoryState**(`workflowId`): `Promise`\<\{ `entries`: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]; `cursor`: `number`; \}\>

Defined in: [runtime/src/runtime.ts:472](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L472)

获取工作流历史状态(条目 + 当前游标)。
游标 -1 表示无已应用条目(初始状态);i 表示第 i 条已应用。
比 history() 多返回 cursor,UI 据此高亮当前步骤。

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<\{ `entries`: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]; `cursor`: `number`; \}\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`getHistoryState`](/docs/api/runtime/src/interfaces/lokvisruntime/#gethistorystate)

***

### undo()

> **undo**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:481](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L481)

撤销一步

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`undo`](/docs/api/runtime/src/interfaces/lokvisruntime/#undo)

***

### redo()

> **redo**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:496](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L496)

重做一步

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`redo`](/docs/api/runtime/src/interfaces/lokvisruntime/#redo)

***

### jumpTo()

> **jumpTo**(`workflowId`, `index`): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:505](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L505)

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

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`jumpTo`](/docs/api/runtime/src/interfaces/lokvisruntime/#jumpto)

***

### importAsset()

> **importAsset**(`source`): `Promise`\<`string`\>

Defined in: [runtime/src/runtime.ts:520](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L520)

导入资产

#### Parameters

##### source

[`AssetSource`](/docs/api/schema/src/type-aliases/assetsource/)

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`importAsset`](/docs/api/runtime/src/interfaces/lokvisruntime/#importasset)

***

### getAsset()

> **getAsset**(`id`): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

Defined in: [runtime/src/runtime.ts:551](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L551)

获取资产

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`getAsset`](/docs/api/runtime/src/interfaces/lokvisruntime/#getasset)

***

### exportAsset()

> **exportAsset**(`id`, `format?`): `Promise`\<`Blob`\>

Defined in: [runtime/src/runtime.ts:557](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L557)

导出资产为 Blob

#### Parameters

##### id

`string`

##### format?

`string`

#### Returns

`Promise`\<`Blob`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`exportAsset`](/docs/api/runtime/src/interfaces/lokvisruntime/#exportasset)

***

### readAssetExif()

> **readAssetExif**(`id`): `Promise`\<[`ExifData`](/docs/api/schema/src/interfaces/exifdata/) \| `null`\>

Defined in: [runtime/src/runtime.ts:580](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L580)

读取 image 资产的 EXIF 元数据(W7.3/7.4 长期方案:MetadataReader 依赖反转)。

Runtime 持有 plugin-image 通过 ctx.registerMetadataReader('image.read-exif', fn)
注册的 reader 引用,按名调用。reader 内部调 readExifFromBlob(exifr)。
Plugin 未安装时优雅降级返回 null(不抛错)。

架构决策:readExif 是 Blob→ExifData 查询,不符合 Engine 层 Blob↔Blob 纯函数
约束,也不符合 Capability Asset[]→Asset[] 契约,故走 MetadataReader 机制,
不进 engine-image、不走 Capability execute。

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ExifData`](/docs/api/schema/src/interfaces/exifdata/) \| `null`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`readAssetExif`](/docs/api/runtime/src/interfaces/lokvisruntime/#readassetexif)

***

### removeAsset()

> **removeAsset**(`id`): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:588](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L588)

删除资产

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`removeAsset`](/docs/api/runtime/src/interfaces/lokvisruntime/#removeasset)

***

### listAssets()

> **listAssets**(): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

Defined in: [runtime/src/runtime.ts:593](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L593)

列出所有资产

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`listAssets`](/docs/api/runtime/src/interfaces/lokvisruntime/#listassets)

***

### getStorageUsage()

> **getStorageUsage**(): `Promise`\<\{ `usage`: `number`; `quota`: `number`; \}\>

Defined in: [runtime/src/runtime.ts:597](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L597)

查询存储配额使用情况(W6.7)。

返回 `{ usage, quota }`:
- `usage`:当前已用字节数(所有资产 metadata.size 之和)
- `quota`:配置的存储配额上限(RuntimeConfig.storageQuota,默认 1GB)

UI 据此展示"已用/总额"进度条,接近上限(>=80%)时警告。
注意:usage 基于 listAssets 实时计算,反映 runtime 实际占用,
与浏览器 `navigator.storage.estimate()`(origin 整体 OPFS)不同。

#### Returns

`Promise`\<\{ `usage`: `number`; `quota`: `number`; \}\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`getStorageUsage`](/docs/api/runtime/src/interfaces/lokvisruntime/#getstorageusage)

***

### capabilities()

> **capabilities**(): `Promise`\<[`Capability`](/docs/api/schema/src/interfaces/capability/)[]\>

Defined in: [runtime/src/runtime.ts:616](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L616)

列出所有已注册能力

#### Returns

`Promise`\<[`Capability`](/docs/api/schema/src/interfaces/capability/)[]\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`capabilities`](/docs/api/runtime/src/interfaces/lokvisruntime/#capabilities)

***

### hasCapability()

> **hasCapability**(`name`): `Promise`\<`boolean`\>

Defined in: [runtime/src/runtime.ts:620](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L620)

检查能力是否可用

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`hasCapability`](/docs/api/runtime/src/interfaces/lokvisruntime/#hascapability)

***

### toMcpManifest()

> **toMcpManifest**(`options?`): [`McpManifest`](/docs/api/schema/src/interfaces/mcpmanifest/)

Defined in: [runtime/src/runtime.ts:635](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L635)

生成 MCP server manifest(不启动 server,仅描述当前可被 MCP 暴露的能力)。
- `mcpExposure='private'`:任何模式都不暴露
- `mcpExposure='batch-only'`:仅在 `options.batchMode=true` 时暴露
  (避免单文件误用)
- 其余(默认 'public'):总是暴露
- tool 名取 capability.mcpToolName 或 `lokvis_${name.replace(/\./g, '_')}`
- resource 固定为 capabilities 与 workflows 两个清单

#### Parameters

##### options?

[`ToMcpManifestOptions`](/docs/api/runtime/src/interfaces/tomcpmanifestoptions/) = `{}`

#### Returns

[`McpManifest`](/docs/api/schema/src/interfaces/mcpmanifest/)

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`toMcpManifest`](/docs/api/runtime/src/interfaces/lokvisruntime/#tomcpmanifest)

***

### \_getAssetStore()

> **\_getAssetStore**(): [`AssetStore`](/docs/api/runtime/src/interfaces/assetstore/)

Defined in: [runtime/src/runtime.ts:679](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L679)

获取 AssetStore（内部用）

#### Returns

[`AssetStore`](/docs/api/runtime/src/interfaces/assetstore/)

***

### \_getCapabilityRegistry()

> **\_getCapabilityRegistry**(): [`CapabilityRegistry`](/docs/api/runtime/src/classes/capabilityregistry/)

Defined in: [runtime/src/runtime.ts:684](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L684)

获取 CapabilityRegistry（内部用）

#### Returns

[`CapabilityRegistry`](/docs/api/runtime/src/classes/capabilityregistry/)

***

### \_getMemoryGuard()

> **\_getMemoryGuard**(): [`MemoryGuard`](/docs/api/runtime/src/classes/memoryguard/)

Defined in: [runtime/src/runtime.ts:691](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L691)

获取 MemoryGuard(内部用,供集成测试驱动内存压力验证 BatchProcessor 收缩)。

#### Returns

[`MemoryGuard`](/docs/api/runtime/src/classes/memoryguard/)

***

### \_getCurrentOutputs()

> **\_getCurrentOutputs**(`workflowId`): `string`[]

Defined in: [runtime/src/runtime.ts:696](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L696)

获取工作流当前输出 AssetId（undo/redo 后的"当前"状态,内部用）

#### Parameters

##### workflowId

`string`

#### Returns

`string`[]

***

### getCurrentOutputs()

> **getCurrentOutputs**(`workflowId`): `Promise`\<`string`[]\>

Defined in: [runtime/src/runtime.ts:701](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L701)

获取工作流当前输出 AssetId（公开 API，供 UI / MCP 查询）

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/).[`getCurrentOutputs`](/docs/api/runtime/src/interfaces/lokvisruntime/#getcurrentoutputs)

***

### loadPersistedHistory()

> **loadPersistedHistory**(): `Promise`\<`void`\>

Defined in: [runtime/src/runtime.ts:877](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L877)

从 historyStore 预加载所有持久化的历史快照,恢复到内存。

由 createRuntime 工厂在构造完 impl 后调用一次。加载期间置 isLoadingHistory
守卫,使 restore() 触发的 onChanged → persistHistory 跳过冗余写回;
但被跳过的 workflowId 记入 dirtyDuringLoad,加载结束后补 persist,
避免加载期间其他来源(run / undo / 外部事件)的变更被永久丢弃。

注意:restore 会 emit history:changed 事件,但此时 UI 尚未订阅
(runtime-slice.init 在 createRuntime resolve 后才订阅),故无副作用。

非 LokvisRuntime 接口的一部分,仅为 impl 的初始化钩子(工厂调用)。

#### Returns

`Promise`\<`void`\>
