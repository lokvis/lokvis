---
editUrl: false
next: false
prev: false
title: "startImageWorker"
---

> **startImageWorker**(`scope?`): `ImageWorkerScope`

Defined in: [engine-image/src/worker-adapter.ts:238](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/worker-adapter.ts#L238)

在 Worker 入口安装图像处理逻辑:
- 立即发送 ready(携带协议版本)。
- 收到 ping → 回 pong。
- 收到 request → 派发并回 response;同时把 AbortController 登记到
  inflight 表,使 cancel 能及时中止在途操作(W3.5)。
- 收到 cancel → 查表中止对应请求的 AbortController。
- 收到 messageerror → 忽略(主线程会因超时重启)。

## Parameters

### scope?

`ImageWorkerScope`

Worker 全局对象,默认 `self`。测试可注入 Fake。

## Returns

`ImageWorkerScope`
