---
editUrl: false
next: false
prev: false
title: "Capability"
---

Defined in: [schema/src/capability.ts:51](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L51)

能力声明（由 Plugin 提供）

## Properties

### name

> **name**: `string`

Defined in: [schema/src/capability.ts:53](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L53)

能力名，如 `image.resize`

***

### description

> **description**: `string`

Defined in: [schema/src/capability.ts:54](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L54)

***

### inputTypes

> **inputTypes**: [`AssetType`](/docs/api/schema/src/type-aliases/assettype/)[]

Defined in: [schema/src/capability.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L56)

接受的输入 Asset 类型

***

### outputTypes

> **outputTypes**: [`AssetType`](/docs/api/schema/src/type-aliases/assettype/)[]

Defined in: [schema/src/capability.ts:58](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L58)

产出的输出 Asset 类型

***

### params

> **params**: [`CapabilityParam`](/docs/api/schema/src/interfaces/capabilityparam/)[]

Defined in: [schema/src/capability.ts:60](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L60)

参数 Schema

***

### performance

> **performance**: [`PerformanceLevel`](/docs/api/schema/src/type-aliases/performancelevel/)

Defined in: [schema/src/capability.ts:62](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L62)

性能预估，用于 UI 提示与调度优化

***

### batchable?

> `optional` **batchable?**: `boolean`

Defined in: [schema/src/capability.ts:64](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L64)

是否支持批量处理（一次处理多个 Asset）

***

### mcpExposure?

> `optional` **mcpExposure?**: `"public"` \| `"private"` \| `"batch-only"`

Defined in: [schema/src/capability.ts:71](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L71)

MCP 暴露配置(可选,见 docs/AI生态冲击调整方案.md §7.1):
- `'public'`(默认):暴露给 MCP server,可被 AI 客户端调用
- `'private'`:不暴露(如内部能力、危险操作)
- `'batch-only'`:仅在 batch 模式暴露(避免单文件误用)

***

### mcpToolName?

> `optional` **mcpToolName?**: `string`

Defined in: [schema/src/capability.ts:77](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L77)

MCP tool 名称覆盖(可选)。
默认为 `lokvis_${name.replace(/\./g, '_')}`,如 `image.resize` → `lokvis_image_resize`。
显式指定时用于更友好的命名(如 `lokvis_compress_image`)。
