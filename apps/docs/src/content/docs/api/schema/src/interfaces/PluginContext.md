---
editUrl: false
next: false
prev: false
title: "PluginContext"
---

Defined in: [schema/src/plugin.ts:97](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L97)

Plugin 上下文（Plugin 能访问的全部 API）

Plugin 只能看到受限的 Runtime API，看不到 React/Redux/Cloud。
通过 runtime 读写 Asset，通过 registerCapability 注册能力实现。

注意:Plugin SDK 已定位为浏览器内嵌入的兼容层(见
docs/AI生态冲击调整方案.md §4)。若目标是让 AI 客户端调用本地能力,
推荐使用 @lokvis/mcp-server(MCP 标准),而非 Plugin SDK。

## Properties

### runtime

> **runtime**: `object`

Defined in: [schema/src/plugin.ts:99](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L99)

Runtime 受限 API

#### getAsset

> **getAsset**: (`id`) => `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

获取资产元数据

##### Parameters

###### id

`string`

##### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

#### importAsset

> **importAsset**: (`file`) => `Promise`\<`string`\>

导入文件为资产，返回 AssetId

##### Parameters

###### file

`File` \| `Blob`

##### Returns

`Promise`\<`string`\>

#### getAssetBlob

> **getAssetBlob**: (`asset`) => `Promise`\<`Blob`\>

读取资产的实际 Blob 数据（用于处理）

##### Parameters

###### asset

[`Asset`](/docs/api/schema/src/interfaces/asset/)

##### Returns

`Promise`\<`Blob`\>

#### createAsset

> **createAsset**: (`blob`, `metadata`, `type`) => `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

从 Blob 创建新资产（能力产出物）

##### Parameters

###### blob

`Blob`

###### metadata

[`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/)

###### type

[`AssetType`](/docs/api/schema/src/type-aliases/assettype/)

##### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

#### listCapabilities

> **listCapabilities**: () => `Promise`\<[`Capability`](/docs/api/schema/src/interfaces/capability/)[]\>

列出所有已注册能力

##### Returns

`Promise`\<[`Capability`](/docs/api/schema/src/interfaces/capability/)[]\>

***

### eventBus

> **eventBus**: [`EventBus`](/docs/api/schema/src/interfaces/eventbus/)

Defined in: [schema/src/plugin.ts:116](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L116)

事件总线

## Methods

### registerCapability()

> **registerCapability**(`impl`): `void`

Defined in: [schema/src/plugin.ts:118](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L118)

注册能力实现(变换:Asset→Asset)

#### Parameters

##### impl

[`CapabilityImplementation`](/docs/api/schema/src/interfaces/capabilityimplementation/)

#### Returns

`void`

***

### registerMetadataReader()

> **registerMetadataReader**\<`T`\>(`name`, `reader`): `void`

Defined in: [schema/src/plugin.ts:129](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L129)

注册元数据读取函数(查询:Asset→T)。

用于非变换类能力(如 EXIF 读取)。Runtime 持有 reader 引用,
UI 通过 runtime.readAssetExif(id) 间接调用,不直接依赖 Plugin / Engine。
同名 reader 重复注册时覆盖前者(支持热更新)。

#### Type Parameters

##### T

`T`

#### Parameters

##### name

`string`

读取器名称,约定与能力名对齐(如 'image.read-exif')

##### reader

[`MetadataReader`](/docs/api/schema/src/type-aliases/metadatareader/)\<`T`\>

读取函数

#### Returns

`void`

***

### registerPanel()

> **registerPanel**(`panel`): `void`

Defined in: [schema/src/plugin.ts:131](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L131)

注册 UI Panel

#### Parameters

##### panel

[`PanelDefinition`](/docs/api/schema/src/interfaces/paneldefinition/)

#### Returns

`void`

***

### log()

> **log**(`level`, `message`): `void`

Defined in: [schema/src/plugin.ts:133](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L133)

日志

#### Parameters

##### level

`"info"` \| `"warn"` \| `"error"`

##### message

`string`

#### Returns

`void`
