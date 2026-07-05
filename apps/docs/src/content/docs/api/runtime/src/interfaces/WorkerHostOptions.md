---
editUrl: false
next: false
prev: false
title: "WorkerHostOptions"
---

Defined in: [runtime/src/worker-host.ts:127](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L127)

## Properties

### heartbeatIntervalMs?

> `optional` **heartbeatIntervalMs?**: `number`

Defined in: [runtime/src/worker-host.ts:129](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L129)

心跳发送间隔

***

### heartbeatTimeoutMs?

> `optional` **heartbeatTimeoutMs?**: `number`

Defined in: [runtime/src/worker-host.ts:131](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L131)

心跳超时(未收到 pong 视为崩溃)

***

### requestTimeoutMs?

> `optional` **requestTimeoutMs?**: `number`

Defined in: [runtime/src/worker-host.ts:133](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L133)

单个请求默认超时

***

### readyTimeoutMs?

> `optional` **readyTimeoutMs?**: `number`

Defined in: [runtime/src/worker-host.ts:135](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L135)

等待 Worker ready 的超时

***

### maxRestarts?

> `optional` **maxRestarts?**: `number`

Defined in: [runtime/src/worker-host.ts:137](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L137)

崩溃后最大重启次数

***

### createTransport

> **createTransport**: () => [`WorkerTransport`](/docs/api/runtime/src/interfaces/workertransport/)

Defined in: [runtime/src/worker-host.ts:139](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L139)

传输层工厂(重启时复用)

#### Returns

[`WorkerTransport`](/docs/api/runtime/src/interfaces/workertransport/)

***

### enableLog?

> `optional` **enableLog?**: `boolean`

Defined in: [runtime/src/worker-host.ts:141](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L141)

是否输出日志
