---
editUrl: false
next: false
prev: false
title: "dispatchImageMethod"
---

> **dispatchImageMethod**(`method`, `params`, `signal?`): `Promise`\<`unknown`\>

Defined in: [engine-image/src/worker-adapter.ts:143](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/worker-adapter.ts#L143)

派发单个方法调用(纯函数,可单测)。
抛错由调用方捕获并转成 WorkerResponse.err。

W3.5:接受可选 AbortSignal 并下传给操作,使 cancel 能在 canvas
decode/encode 之间生效。AbortError 会被上层 catch 转为 err 响应。

## Parameters

### method

`string`

### params

`unknown`

### signal?

`AbortSignal`

## Returns

`Promise`\<`unknown`\>
