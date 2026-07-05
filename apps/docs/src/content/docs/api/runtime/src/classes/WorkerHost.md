---
editUrl: false
next: false
prev: false
title: "WorkerHost"
---

Defined in: [runtime/src/worker-host.ts:173](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L173)

## Constructors

### Constructor

> **new WorkerHost**(`opts`): `WorkerHost`

Defined in: [runtime/src/worker-host.ts:189](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L189)

#### Parameters

##### opts

[`WorkerHostOptions`](/docs/api/runtime/src/interfaces/workerhostoptions/)

#### Returns

`WorkerHost`

## Accessors

### currentStatus

#### Get Signature

> **get** **currentStatus**(): [`WorkerHostStatus`](/docs/api/runtime/src/type-aliases/workerhoststatus/)

Defined in: [runtime/src/worker-host.ts:201](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L201)

##### Returns

[`WorkerHostStatus`](/docs/api/runtime/src/type-aliases/workerhoststatus/)

***

### currentRestartCount

#### Get Signature

> **get** **currentRestartCount**(): `number`

Defined in: [runtime/src/worker-host.ts:206](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L206)

已发生的重启次数

##### Returns

`number`

## Methods

### on()

> **on**\<`K`\>(`type`, `handler`): () => `void`

Defined in: [runtime/src/worker-host.ts:211](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L211)

订阅事件,返回取消订阅

#### Type Parameters

##### K

`K` *extends* keyof [`WorkerHostEventMap`](/docs/api/runtime/src/interfaces/workerhosteventmap/)

#### Parameters

##### type

`K`

##### handler

`Listener`\<[`WorkerHostEventMap`](/docs/api/runtime/src/interfaces/workerhosteventmap/)\[`K`\]\>

#### Returns

() => `void`

***

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [runtime/src/worker-host.ts:240](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L240)

启动并完成 ready 握手

#### Returns

`Promise`\<`void`\>

***

### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [runtime/src/worker-host.ts:247](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L247)

销毁:终止 Worker、清理定时器、拒绝所有 pending

#### Returns

`Promise`\<`void`\>

***

### request()

> **request**\<`T`\>(`method`, `params?`, `options?`): `Promise`\<`T`\>

Defined in: [runtime/src/worker-host.ts:258](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L258)

调用 Worker 方法并等待响应

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### method

`string`

##### params?

`unknown`

##### options?

###### transfer?

`Transferable`[]

###### timeoutMs?

`number`

###### signal?

`AbortSignal`

取消信号:触发时向 Worker 发送 WorkerCancel 并立即 reject(W3.5)

#### Returns

`Promise`\<`T`\>
