---
editUrl: false
next: false
prev: false
title: "WorkflowBuilderOptions"
---

Defined in: [runtime/src/workflow-builder.ts:53](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L53)

WorkflowBuilder 构造选项

## Properties

### id

> **id**: `string`

Defined in: [runtime/src/workflow-builder.ts:55](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L55)

工作流 ID(必填,需全局唯一)

***

### name

> **name**: `string`

Defined in: [runtime/src/workflow-builder.ts:57](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L57)

工作流名称

***

### description?

> `optional` **description?**: `string`

Defined in: [runtime/src/workflow-builder.ts:59](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L59)

工作流描述(可选,默认为空字符串)

***

### author?

> `optional` **author?**: [`WorkflowAuthor`](/docs/api/schema/src/interfaces/workflowauthor/)

Defined in: [runtime/src/workflow-builder.ts:61](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L61)

作者信息(可选,默认本地用户)

***

### category?

> `optional` **category?**: [`WorkflowCategory`](/docs/api/schema/src/type-aliases/workflowcategory/)

Defined in: [runtime/src/workflow-builder.ts:63](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L63)

分类(可选,默认 'image')

***

### tags?

> `optional` **tags?**: `string`[]

Defined in: [runtime/src/workflow-builder.ts:65](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L65)

标签(可选)

***

### official?

> `optional` **official?**: `boolean`

Defined in: [runtime/src/workflow-builder.ts:67](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L67)

是否为官方工作流(可选,默认 false)

***

### maxSteps?

> `optional` **maxSteps?**: `number`

Defined in: [runtime/src/workflow-builder.ts:69](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L69)

最大节点数(可选,默认 MAX_WORKFLOW_STEPS;测试或特殊场景可放宽)
