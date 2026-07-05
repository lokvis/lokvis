---
editUrl: false
next: false
prev: false
title: "BatchJob"
---

Defined in: [runtime/src/batch-processor.ts:83](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L83)

批量作业运行时状态(对外只读视图)

## Properties

### id

> **id**: `string`

Defined in: [runtime/src/batch-processor.ts:84](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L84)

***

### status

> **status**: [`BatchJobStatus`](/docs/api/schema/src/type-aliases/batchjobstatus/)

Defined in: [runtime/src/batch-processor.ts:85](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L85)

***

### items

> **items**: [`BatchItem`](/docs/api/runtime/src/interfaces/batchitem/)[]

Defined in: [runtime/src/batch-processor.ts:86](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L86)

***

### completed

> **completed**: `number`

Defined in: [runtime/src/batch-processor.ts:88](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L88)

已完成数(completed)

***

### failed

> **failed**: `number`

Defined in: [runtime/src/batch-processor.ts:90](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L90)

失败数(failed)

***

### total

> **total**: `number`

Defined in: [runtime/src/batch-processor.ts:92](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L92)

总项数

***

### startedAt

> **startedAt**: `number`

Defined in: [runtime/src/batch-processor.ts:94](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L94)

job 起始时间(ms)

***

### endedAt?

> `optional` **endedAt?**: `number`

Defined in: [runtime/src/batch-processor.ts:96](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L96)

job 结束时间(ms,完成后填)
