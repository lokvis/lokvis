---
editUrl: false
next: false
prev: false
title: "estimateDecodedBytes"
---

> **estimateDecodedBytes**(`width`, `height`): `number`

Defined in: [runtime/src/memory-guard.ts:67](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L67)

估算解码后位图占用的内存(RGBA,4 字节/像素)。

一个 4000×3000 的 JPEG,blob 可能只有 2MB,但 decode 成 ImageBitmap 后
占 4000*3000*4 ≈ 46MB。追踪中间结果时应以此为准而非 blob.size,
否则严重低估内存压力。

## Parameters

### width

`number`

### height

`number`

## Returns

`number`
