---
editUrl: false
next: false
prev: false
title: "WorkflowInput"
---

Defined in: [schema/src/workflow.ts:37](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L37)

Workflow 输入定义

## Properties

### type

> **type**: [`AssetType`](/docs/api/schema/src/type-aliases/assettype/)

Defined in: [schema/src/workflow.ts:38](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L38)

***

### multiple

> **multiple**: `boolean`

Defined in: [schema/src/workflow.ts:40](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L40)

是否允许多个输入

***

### maxCount?

> `optional` **maxCount?**: `number`

Defined in: [schema/src/workflow.ts:42](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L42)

最大数量（multiple=true 时生效）

***

### accept?

> `optional` **accept?**: `string`[]

Defined in: [schema/src/workflow.ts:44](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L44)

文件类型过滤
