---
editUrl: false
next: false
prev: false
title: "WorkerTransport"
---

Defined in: [runtime/src/worker-host.ts:48](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L48)

传输层接口:屏蔽 浏览器 Worker / Node worker_threads / Fake 差异。
Host 仅依赖该接口,便于单测注入 Fake。

## Methods

### send()

> **send**(`message`, `transfer?`): `void`

Defined in: [runtime/src/worker-host.ts:50](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L50)

向 Worker 发消息(可附带可转移对象)

#### Parameters

##### message

`unknown`

##### transfer?

`Transferable`[]

#### Returns

`void`

***

### onMessage()

> **onMessage**(`handler`): () => `void`

Defined in: [runtime/src/worker-host.ts:52](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L52)

监听 Worker → Host 消息,返回取消订阅

#### Parameters

##### handler

(`data`) => `void`

#### Returns

() => `void`

***

### onError()

> **onError**(`handler`): () => `void`

Defined in: [runtime/src/worker-host.ts:54](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L54)

监听传输层错误(脚本加载失败 / 未捕获异常 / 异常退出),返回取消订阅

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### terminate()

> **terminate**(): `void`

Defined in: [runtime/src/worker-host.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L56)

终止 Worker

#### Returns

`void`
