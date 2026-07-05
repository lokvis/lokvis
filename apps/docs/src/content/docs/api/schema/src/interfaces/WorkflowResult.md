---
editUrl: false
next: false
prev: false
title: "WorkflowResult"
---

Defined in: [schema/src/workflow.ts:120](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L120)

Workflow 执行结果

## Properties

### workflowId

> **workflowId**: `string`

Defined in: [schema/src/workflow.ts:121](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L121)

***

### outputs

> **outputs**: `string`[]

Defined in: [schema/src/workflow.ts:123](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L123)

输出 Asset ID 列表

***

### duration

> **duration**: `number`

Defined in: [schema/src/workflow.ts:125](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L125)

执行耗时（毫秒）

***

### status

> **status**: `"completed"` \| `"cancelled"` \| `"failed"`

Defined in: [schema/src/workflow.ts:127](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L127)

执行状态

***

### error?

> `optional` **error?**: `string`

Defined in: [schema/src/workflow.ts:129](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L129)

错误信息（status=failed 时）
