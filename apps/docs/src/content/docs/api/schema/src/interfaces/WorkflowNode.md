---
editUrl: false
next: false
prev: false
title: "WorkflowNode"
---

Defined in: [schema/src/workflow.ts:14](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L14)

Workflow 节点定义

## Properties

### id

> **id**: `string`

Defined in: [schema/src/workflow.ts:16](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L16)

节点唯一 ID

***

### type

> **type**: [`NodeType`](/docs/api/schema/src/type-aliases/nodetype/)

Defined in: [schema/src/workflow.ts:18](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L18)

节点类型

***

### capability?

> `optional` **capability?**: `string`

Defined in: [schema/src/workflow.ts:23](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L23)

引用的能力名，如 `image.resize`。
仅 `type === 'transform'` 时必填;load/export 节点可不填。

***

### params?

> `optional` **params?**: `Record`\<`string`, `unknown`\>

Defined in: [schema/src/workflow.ts:25](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L25)

能力参数

***

### label?

> `optional` **label?**: `string`

Defined in: [schema/src/workflow.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L27)

节点标签（UI 显示用）
