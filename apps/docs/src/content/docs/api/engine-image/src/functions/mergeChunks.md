---
editUrl: false
next: false
prev: false
title: "mergeChunks"
---

> **mergeChunks**(`chunks`, `totalWidth`, `totalHeight`, `format`, `quality?`, `signal?`): `Promise`\<`Blob`\>

Defined in: [engine-image/src/operations/tiles.ts:72](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/operations/tiles.ts#L72)

把已编码的分片(chunk)合回单张 Blob。

实现:decode 每个 chunk 的 blob → drawImage 到 (totalW × totalH) 的
输出 canvas 的对应 tile 位置 → 整张 encode。

内存:合并阶段需同时持有输出 canvas 与当前 chunk 的 bitmap(单 tile 级),
输出 canvas 大小为 totalW × totalH(与原图等大)。

## Parameters

### chunks

[`ImageChunk`](/docs/api/engine-image/src/interfaces/imagechunk/)[]

分片编码结果(每个含 tile 位置 + blob)

### totalWidth

`number`

输出图总宽

### totalHeight

`number`

输出图总高

### format

[`ImageOutputFormat`](/docs/api/engine-image/src/type-aliases/imageoutputformat/)

输出格式

### quality?

`number` = `95`

质量(0-100),仅对有损格式生效

### signal?

`AbortSignal`

可选取消信号;每个 chunk decode 前检查(W3.5)

## Returns

`Promise`\<`Blob`\>
