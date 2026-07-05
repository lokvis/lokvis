---
editUrl: false
next: false
prev: false
title: "BatchItemInput"
---

Defined in: [runtime/src/batch-processor.ts:47](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L47)

批量项输入(每个文件一个)

## Properties

### source

> **source**: [`AssetSource`](/docs/api/schema/src/type-aliases/assetsource/)

Defined in: [runtime/src/batch-processor.ts:52](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L52)

资产来源:通常为 { kind: 'file', file }(用户拖入),也可为 blob/url。
BatchProcessor 在执行前调 runtime.importAsset(source) 导入为 AssetId。

***

### workflow

> **workflow**: [`Workflow`](/docs/api/schema/src/interfaces/workflow/)

Defined in: [runtime/src/batch-processor.ts:54](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L54)

该项要执行的工作流(每个文件独立 workflow 实例,便于独立 cancel)

***

### maxRetries?

> `optional` **maxRetries?**: `number`

Defined in: [runtime/src/batch-processor.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L56)

该项最大重试次数(覆盖 job 级 maxRetries)
