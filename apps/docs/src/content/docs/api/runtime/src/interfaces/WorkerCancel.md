---
editUrl: false
next: false
prev: false
title: "WorkerCancel"
---

Defined in: [runtime/src/worker-protocol.ts:55](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-protocol.ts#L55)

取消一个正在执行的请求(W3.5 cancel 贯穿)。
Host 在 AbortSignal 触发时发送,Worker 据此中止当前计算。

## Properties

### type

> **type**: `"cancel"`

Defined in: [runtime/src/worker-protocol.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-protocol.ts#L56)

***

### id

> **id**: `string`

Defined in: [runtime/src/worker-protocol.ts:58](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-protocol.ts#L58)

要取消的请求 id
