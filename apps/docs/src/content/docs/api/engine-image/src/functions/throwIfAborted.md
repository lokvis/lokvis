---
editUrl: false
next: false
prev: false
title: "throwIfAborted"
---

> **throwIfAborted**(`signal?`): `void`

Defined in: [engine-image/src/operations/utils.ts:18](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/operations/utils.ts#L18)

若 signal 已取消则抛出 AbortError(W3.5 cancel 贯穿)。

操作在 decode / draw / encode 之间调用此助手,避免在 AbortSignal 触发后
继续做昂贵的 canvas 工作(尤其 compressToTargetSize 的二分循环)。
抛 DOMException('AbortError') 以与 Web 平台约定一致,上层
(executor) 已将 cancelled 状态映射到 WorkflowResult.cancelled。

## Parameters

### signal?

`AbortSignal`

## Returns

`void`
