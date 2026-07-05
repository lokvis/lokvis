---
editUrl: false
next: false
prev: false
title: "createBrowserWorkerTransport"
---

> **createBrowserWorkerTransport**(`url`): [`WorkerTransport`](/docs/api/runtime/src/interfaces/workertransport/)

Defined in: [runtime/src/worker-host.ts:536](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L536)

创建浏览器 Web Worker 传输层。
仅在浏览器主线程可用(Node 测试应注入 Fake 传输)。

## Parameters

### url

`string` \| `URL`

## Returns

[`WorkerTransport`](/docs/api/runtime/src/interfaces/workertransport/)
