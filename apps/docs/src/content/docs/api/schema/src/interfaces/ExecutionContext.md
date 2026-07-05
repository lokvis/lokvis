---
editUrl: false
next: false
prev: false
title: "ExecutionContext"
---

Defined in: [schema/src/capability.ts:109](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L109)

能力执行上下文

## Properties

### workflowId

> **workflowId**: `string`

Defined in: [schema/src/capability.ts:111](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L111)

当前 Workflow ID

***

### nodeId

> **nodeId**: `string`

Defined in: [schema/src/capability.ts:113](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L113)

当前 Node ID

***

### signal

> **signal**: `AbortSignal`

Defined in: [schema/src/capability.ts:115](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L115)

取消信号

***

### onProgress?

> `optional` **onProgress?**: (`progress`, `message?`) => `void`

Defined in: [schema/src/capability.ts:117](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L117)

进度回调（0-1）

#### Parameters

##### progress

`number`

##### message?

`string`

#### Returns

`void`

***

### log

> **log**: (`level`, `message`) => `void`

Defined in: [schema/src/capability.ts:119](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L119)

日志函数

#### Parameters

##### level

`"info"` \| `"warn"` \| `"error"`

##### message

`string`

#### Returns

`void`
