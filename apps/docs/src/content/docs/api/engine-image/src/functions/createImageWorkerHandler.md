---
editUrl: false
next: false
prev: false
title: "createImageWorkerHandler"
---

> **createImageWorkerHandler**(): (`request`, `signal?`) => `Promise`\<[`WorkerResponse`](/docs/api/engine-image/src/type-aliases/workerresponse/)\>

Defined in: [engine-image/src/worker-adapter.ts:187](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/worker-adapter.ts#L187)

创建请求处理器(纯函数,返回响应)。供测试直接调用,
也供 startImageWorker 在 Worker 内使用。

W3.5:接受可选 AbortSignal 并下传,使 Host 的 cancel 经由
startImageWorker 的 inflight 控制器抵达操作。

## Returns

(`request`, `signal?`) => `Promise`\<[`WorkerResponse`](/docs/api/engine-image/src/type-aliases/workerresponse/)\>
