---
editUrl: false
next: false
prev: false
title: "BatchProcessor"
---

Defined in: [runtime/src/batch-processor.ts:181](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L181)

BatchProcessor 实现。

不直接依赖 LokvisRuntimeImpl(避免循环引用),通过构造注入 LokvisRuntime 接口。
内部用纯 JS Map 管理作业,无 React state(可被 SDK / MCP / Node 复用)。

## Constructors

### Constructor

> **new BatchProcessor**(`opts`): `BatchProcessor`

Defined in: [runtime/src/batch-processor.ts:191](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L191)

#### Parameters

##### opts

###### runtime

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/)

###### eventBus

[`EventBus`](/docs/api/schema/src/interfaces/eventbus/)

###### isPro

`boolean`

###### memoryGuard?

[`MemoryGuard`](/docs/api/runtime/src/classes/memoryguard/)

#### Returns

`BatchProcessor`

## Methods

### enqueue()

> **enqueue**(`options`): [`BatchJob`](/docs/api/runtime/src/interfaces/batchjob/)

Defined in: [runtime/src/batch-processor.ts:208](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L208)

入队批量作业。返回 job 视图(只读)。
超过免费上限时同步抛 BatchLimitExceededError,不创建 job。
空 items 抛错(避免静默产出 0 项 completed job,遮蔽调用方逻辑错误)。

#### Parameters

##### options

[`EnqueueOptions`](/docs/api/runtime/src/interfaces/enqueueoptions/)

#### Returns

[`BatchJob`](/docs/api/runtime/src/interfaces/batchjob/)

***

### list()

> **list**(): [`BatchJob`](/docs/api/runtime/src/interfaces/batchjob/)[]

Defined in: [runtime/src/batch-processor.ts:258](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L258)

列出所有作业(只读视图)

#### Returns

[`BatchJob`](/docs/api/runtime/src/interfaces/batchjob/)[]

***

### get()

> **get**(`jobId`): [`BatchJob`](/docs/api/runtime/src/interfaces/batchjob/) \| `undefined`

Defined in: [runtime/src/batch-processor.ts:263](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L263)

获取指定 job

#### Parameters

##### jobId

`string`

#### Returns

[`BatchJob`](/docs/api/runtime/src/interfaces/batchjob/) \| `undefined`

***

### cancel()

> **cancel**(`jobId`): `Promise`\<`void`\>

Defined in: [runtime/src/batch-processor.ts:269](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L269)

取消整个 job:逐个取消 in-flight 项,pending 项标记 cancelled

#### Parameters

##### jobId

`string`

#### Returns

`Promise`\<`void`\>

***

### pause()

> **pause**(`jobId`): `Promise`\<`void`\>

Defined in: [runtime/src/batch-processor.ts:309](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L309)

暂停 job:schedule 不再补满,已 in-flight 项跑完即止

#### Parameters

##### jobId

`string`

#### Returns

`Promise`\<`void`\>

***

### resume()

> **resume**(`jobId`): `Promise`\<`void`\>

Defined in: [runtime/src/batch-processor.ts:320](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L320)

恢复 job:解除 pause,schedule 继续补满

#### Parameters

##### jobId

`string`

#### Returns

`Promise`\<`void`\>

***

### retryFailed()

> **retryFailed**(`jobId`): `Promise`\<`void`\>

Defined in: [runtime/src/batch-processor.ts:335](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L335)

重试 job 中所有 failed 项(仅当 job 已结束)。
重置 attempts/error/status,pending 重新等待 schedule。

#### Parameters

##### jobId

`string`

#### Returns

`Promise`\<`void`\>

***

### onProgress()

> **onProgress**(`jobId`, `handler`): () => `void`

Defined in: [runtime/src/batch-processor.ts:354](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L354)

订阅 job 进度(返回取消订阅函数)

#### Parameters

##### jobId

`string`

##### handler

(`p`) => `void`

#### Returns

() => `void`

***

### waitForCompletion()

> **waitForCompletion**(`jobId`, `timeoutMs?`): `Promise`\<[`BatchJob`](/docs/api/runtime/src/interfaces/batchjob/)\>

Defined in: [runtime/src/batch-processor.ts:377](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L377)

等待 job 完成(completed/failed/cancelled 任一)。

M5 修复:
- 增加 timeoutMs(默认 5min),超时 reject,避免坏 job 永久挂起泄漏订阅
- batch:completed 事件已涵盖 failed(maybeComplete 对 failed>0 的 job
  同样发 batch:completed),故只需监听 completed + cancelled
- resolve 后立即解绑所有订阅,避免调用方丢弃 promise 时泄漏
- cancel/maybeComplete 进入终态时也会 cleanupJobSubs 兜底

#### Parameters

##### jobId

`string`

##### timeoutMs?

`number` = `...`

#### Returns

`Promise`\<[`BatchJob`](/docs/api/runtime/src/interfaces/batchjob/)\>
