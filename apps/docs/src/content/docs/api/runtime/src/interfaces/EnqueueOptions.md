---
editUrl: false
next: false
prev: false
title: "EnqueueOptions"
---

Defined in: [runtime/src/batch-processor.ts:100](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L100)

enqueue 选项

## Properties

### items

> **items**: [`BatchItemInput`](/docs/api/runtime/src/interfaces/batchiteminput/)[]

Defined in: [runtime/src/batch-processor.ts:102](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L102)

作业项

***

### maxRetries?

> `optional` **maxRetries?**: `number`

Defined in: [runtime/src/batch-processor.ts:104](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L104)

job 级最大重试次数(默认 0,单项可 BatchItemInput.maxRetries 覆盖)

***

### concurrency?

> `optional` **concurrency?**: `number`

Defined in: [runtime/src/batch-processor.ts:109](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L109)

并发槽位上限(默认按 isPro:free=4,pro=16)。
实际并发会按 MemoryGuard 压力动态收缩。
