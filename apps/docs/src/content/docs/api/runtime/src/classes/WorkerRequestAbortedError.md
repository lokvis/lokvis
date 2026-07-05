---
editUrl: false
next: false
prev: false
title: "WorkerRequestAbortedError"
---

Defined in: [runtime/src/worker-host.ts:116](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L116)

请求被 AbortSignal 取消(W3.5 cancel 贯穿)。

与超时/崩溃不同:cancel 是调用方主动发起的,Host 会向 Worker
发送 WorkerCancel 消息让在途操作尽快中止,同时本地立即 reject,
不等 Worker 回响应。

## Extends

- `Error`

## Constructors

### Constructor

> **new WorkerRequestAbortedError**(`method`): `WorkerRequestAbortedError`

Defined in: [runtime/src/worker-host.ts:118](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L118)

#### Parameters

##### method

`string`

#### Returns

`WorkerRequestAbortedError`

#### Overrides

`Error.constructor`

## Properties

### method

> `readonly` **method**: `string`

Defined in: [runtime/src/worker-host.ts:117](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L117)
