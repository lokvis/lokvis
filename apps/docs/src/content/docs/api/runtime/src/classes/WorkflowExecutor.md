---
editUrl: false
next: false
prev: false
title: "WorkflowExecutor"
---

Defined in: [runtime/src/executor.ts:143](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/executor.ts#L143)

Workflow 执行器

## Constructors

### Constructor

> **new WorkflowExecutor**(`config`): `WorkflowExecutor`

Defined in: [runtime/src/executor.ts:149](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/executor.ts#L149)

#### Parameters

##### config

[`ExecutorConfig`](/docs/api/runtime/src/interfaces/executorconfig/)

#### Returns

`WorkflowExecutor`

## Methods

### execute()

> **execute**(`workflow`, `inputs`): `Promise`\<[`WorkflowResult`](/docs/api/schema/src/interfaces/workflowresult/)\>

Defined in: [runtime/src/executor.ts:154](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/executor.ts#L154)

执行工作流

#### Parameters

##### workflow

[`Workflow`](/docs/api/schema/src/interfaces/workflow/)

##### inputs

`string`[] \| [`Asset`](/docs/api/schema/src/interfaces/asset/)[]

#### Returns

`Promise`\<[`WorkflowResult`](/docs/api/schema/src/interfaces/workflowresult/)\>

***

### cancel()

> **cancel**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/executor.ts:301](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/executor.ts#L301)

取消执行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### pause()

> **pause**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/executor.ts:312](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/executor.ts#L312)

暂停执行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### resume()

> **resume**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/executor.ts:320](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/executor.ts#L320)

恢复执行

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>
