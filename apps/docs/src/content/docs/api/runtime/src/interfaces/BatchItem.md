---
editUrl: false
next: false
prev: false
title: "BatchItem"
---

Defined in: [runtime/src/batch-processor.ts:60](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L60)

批量项运行时状态(对外只读视图)

## Properties

### id

> **id**: `string`

Defined in: [runtime/src/batch-processor.ts:62](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L62)

项 ID(自动生成,用于事件追踪与 UI 定位)

***

### index

> **index**: `number`

Defined in: [runtime/src/batch-processor.ts:64](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L64)

在 job 中的序号(0-based,用于事件中的 index 字段)

***

### status

> **status**: [`BatchItemStatus`](/docs/api/schema/src/type-aliases/batchitemstatus/)

Defined in: [runtime/src/batch-processor.ts:65](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L65)

***

### source

> **source**: [`AssetSource`](/docs/api/schema/src/type-aliases/assetsource/)

Defined in: [runtime/src/batch-processor.ts:67](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L67)

输入 source(便于失败时 UI 展示文件名)

***

### workflow

> **workflow**: [`Workflow`](/docs/api/schema/src/interfaces/workflow/)

Defined in: [runtime/src/batch-processor.ts:69](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L69)

该项执行的工作流

***

### outputAssetId?

> `optional` **outputAssetId?**: `string`

Defined in: [runtime/src/batch-processor.ts:71](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L71)

输出 AssetId(completed 时填)

***

### error?

> `optional` **error?**: `Error`

Defined in: [runtime/src/batch-processor.ts:73](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L73)

失败原因(failed 时填)

***

### attempts

> **attempts**: `number`

Defined in: [runtime/src/batch-processor.ts:75](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L75)

已重试次数

***

### maxRetries

> **maxRetries**: `number`

Defined in: [runtime/src/batch-processor.ts:77](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L77)

该项最大重试次数

***

### duration?

> `optional` **duration?**: `number`

Defined in: [runtime/src/batch-processor.ts:79](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L79)

单项执行耗时(ms,completed 时填)
